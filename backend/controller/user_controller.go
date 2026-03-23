package controller

import (
	"fmt"
	"strings"
	"time"

	"FeedForward/backend/middleware"
	"FeedForward/backend/model"
	"FeedForward/backend/model/errors"
	"FeedForward/backend/model/response"
	"FeedForward/backend/model/status"

	"github.com/gofiber/fiber/v2"
	"golang.org/x/crypto/bcrypt"
)

func RegisterUser(c *fiber.Ctx) error {
	db := middleware.DBConn

	var req model.RegisterUserRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(response.ResponseModel{
			RetCode: "400",
			Message: status.RetCode400,
			Data:    errors.ErrorModel{Message: "Invalid request body", IsSuccess: false, Error: err},
		})
	}

	if req.FirstName == "" || req.LastName == "" || req.Email == "" || req.Password == "" {
		return c.Status(400).JSON(response.ResponseModel{
			RetCode: "400",
			Message: "Missing required fields",
			Data:    errors.ErrorModel{Message: "First name, last name, email, and password are required", IsSuccess: false},
		})
	}

	if !req.TermsAccepted {
		return c.Status(400).JSON(response.ResponseModel{
			RetCode: "400",
			Message: "Terms and Conditions must be accepted",
			Data:    errors.ErrorModel{Message: "Please accept Terms and Conditions to continue", IsSuccess: false},
		})
	}

	var existing model.User
	if result := db.Table("public.users").Where("email = ?", req.Email).First(&existing); result.Error == nil {
		return c.Status(409).JSON(response.ResponseModel{
			RetCode: "409",
			Message: "Email already registered",
			Data:    errors.ErrorModel{Message: "A user with this email already exists", IsSuccess: false},
		})
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return c.Status(500).JSON(response.ResponseModel{
			RetCode: "500",
			Message: status.RetCode500,
			Data:    errors.ErrorModel{Message: "Failed to process password", IsSuccess: false, Error: err},
		})
	}

	userId := fmt.Sprintf("USER-%d", time.Now().UnixMilli())
	user := model.User{
		ID:        userId,
		FirstName: req.FirstName,
		LastName:  req.LastName,
		Email:     req.Email,
		Password:  string(hashedPassword),
		CreatedAt: time.Now().Format(time.RFC3339),
	}

	if err := db.Table("public.users").Create(&user).Error; err != nil {
		return c.Status(500).JSON(response.ResponseModel{
			RetCode: "500",
			Message: status.RetCode500,
			Data:    errors.ErrorModel{Message: "Failed to create user", IsSuccess: false, Error: err},
		})
	}

	return c.Status(201).JSON(response.ResponseModel{
		RetCode: "201",
		Message: "User registered successfully",
		Data: map[string]any{
			"id":    user.ID,
			"name":  user.FirstName + " " + user.LastName,
			"email": user.Email,
		},
	})
}

func LoginUser(c *fiber.Ctx) error {
	db := middleware.DBConn

	var req model.LoginRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(response.ResponseModel{
			RetCode: "400",
			Message: status.RetCode400,
			Data:    errors.ErrorModel{Message: "Invalid request body", IsSuccess: false, Error: err},
		})
	}

	var user model.User
	if err := db.Table("public.users").Where("email = ?", req.Email).First(&user).Error; err != nil {
		return c.Status(401).JSON(response.ResponseModel{
			RetCode: "401",
			Message: "Invalid email or password",
			Data:    errors.ErrorModel{Message: "User not found", IsSuccess: false},
		})
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password)); err != nil {
		return c.Status(401).JSON(response.ResponseModel{
			RetCode: "401",
			Message: "Invalid email or password",
			Data:    errors.ErrorModel{Message: "Incorrect password", IsSuccess: false},
		})
	}

	return c.Status(200).JSON(response.ResponseModel{
		RetCode: "200",
		Message: "Login successful",
		Data: map[string]any{
			"id":    user.ID,
			"name":  user.Name,
			"email": user.Email,
		},
	})
}

func ChangeUserPassword(c *fiber.Ctx) error {
	db := middleware.DBConn

	var req model.ChangeUserPasswordRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(response.ResponseModel{
			RetCode: "400",
			Message: status.RetCode400,
			Data:    errors.ErrorModel{Message: "Invalid request body", IsSuccess: false, Error: err},
		})
	}

	email := strings.ToLower(strings.TrimSpace(req.Email))
	currentPassword := strings.TrimSpace(req.CurrentPassword)
	newPassword := strings.TrimSpace(req.NewPassword)

	if email == "" || currentPassword == "" || newPassword == "" {
		return c.Status(400).JSON(response.ResponseModel{
			RetCode: "400",
			Message: status.RetCode400,
			Data:    errors.ErrorModel{Message: "Email, current password, and new password are required", IsSuccess: false},
		})
	}

	if len(newPassword) < 6 {
		return c.Status(400).JSON(response.ResponseModel{
			RetCode: "400",
			Message: status.RetCode400,
			Data:    errors.ErrorModel{Message: "New password must be at least 6 characters", IsSuccess: false},
		})
	}

	var user model.User
	if err := db.Table("public.users").Where("LOWER(TRIM(email)) = ?", email).First(&user).Error; err != nil {
		return c.Status(404).JSON(response.ResponseModel{
			RetCode: "404",
			Message: "User not found",
			Data:    errors.ErrorModel{Message: "No user found for this account", IsSuccess: false},
		})
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(currentPassword)); err != nil {
		return c.Status(401).JSON(response.ResponseModel{
			RetCode: "401",
			Message: "Current password is incorrect",
			Data:    errors.ErrorModel{Message: "Current password is incorrect", IsSuccess: false},
		})
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return c.Status(500).JSON(response.ResponseModel{
			RetCode: "500",
			Message: status.RetCode500,
			Data:    errors.ErrorModel{Message: "Failed to process password", IsSuccess: false, Error: err},
		})
	}

	if err := db.Table("public.users").Where("LOWER(TRIM(email)) = ?", email).Update("password", string(hashedPassword)).Error; err != nil {
		return c.Status(500).JSON(response.ResponseModel{
			RetCode: "500",
			Message: status.RetCode500,
			Data:    errors.ErrorModel{Message: "Failed to update password", IsSuccess: false, Error: err},
		})
	}

	return c.Status(200).JSON(response.ResponseModel{
		RetCode: "200",
		Message: "Password changed successfully",
		Data:    map[string]any{"success": true},
	})
}
