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

const AdminRegistrationKey = "FEEDFORWARD2026"

func RegisterAdmin(c *fiber.Ctx) error {
	db := middleware.DBConn

	var req model.RegisterAdminRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(response.ResponseModel{
			RetCode: "400",
			Message: status.RetCode400,
			Data:    errors.ErrorModel{Message: "Invalid request body", IsSuccess: false, Error: err},
		})
	}

	if req.AdminKey != AdminRegistrationKey {
		return c.Status(401).JSON(response.ResponseModel{
			RetCode: "401",
			Message: "Invalid admin registration key",
			Data:    errors.ErrorModel{Message: "The provided admin key is incorrect", IsSuccess: false},
		})
	}

	var existingEmail model.Admin
	if err := db.Table("public.admins").Where("email = ?", req.Email).First(&existingEmail).Error; err == nil {
		return c.Status(409).JSON(response.ResponseModel{
			RetCode: "409",
			Message: "Email already registered",
			Data:    errors.ErrorModel{Message: "An admin with this email already exists", IsSuccess: false},
		})
	}

	var existingUnit model.Admin
	if err := db.Table("public.admins").Where("LOWER(unit) = LOWER(?)", req.Unit).First(&existingUnit).Error; err == nil {
		return c.Status(409).JSON(response.ResponseModel{
			RetCode: "409",
			Message: "This unit already has an admin",
			Data:    errors.ErrorModel{Message: "Each unit can only have one admin", IsSuccess: false},
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

	adminId := fmt.Sprintf("ADMIN-%d", time.Now().UnixMilli())
	admin := model.Admin{
		ID:        adminId,
		FirstName: req.FirstName,
		LastName:  req.LastName,
		Email:     req.Email,
		Password:  string(hashedPassword),
		Unit:      req.Unit,
		CreatedAt: time.Now().Format(time.RFC3339),
	}

	if err := db.Table("public.admins").Create(&admin).Error; err != nil {
		return c.Status(500).JSON(response.ResponseModel{
			RetCode: "500",
			Message: status.RetCode500,
			Data:    errors.ErrorModel{Message: "Failed to create admin", IsSuccess: false, Error: err},
		})
	}

	return c.Status(201).JSON(response.ResponseModel{
		RetCode: "201",
		Message: "Admin registered successfully",
		Data: map[string]any{
			"id":    admin.ID,
			"name":  admin.FirstName + " " + admin.LastName,
			"email": admin.Email,
			"unit":  admin.Unit,
		},
	})
}

func LoginAdmin(c *fiber.Ctx) error {
	db := middleware.DBConn

	var req model.LoginRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(response.ResponseModel{
			RetCode: "400",
			Message: status.RetCode400,
			Data:    errors.ErrorModel{Message: "Invalid request body", IsSuccess: false, Error: err},
		})
	}

	email := strings.ToLower(strings.TrimSpace(req.Email))
	password := strings.TrimSpace(req.Password)
	if email == "" || password == "" {
		return c.Status(400).JSON(response.ResponseModel{
			RetCode: "400",
			Message: status.RetCode400,
			Data:    errors.ErrorModel{Message: "Email and password are required", IsSuccess: false},
		})
	}

	var admin model.Admin
	result := db.Table("public.admins").Where("LOWER(TRIM(email)) = ?", email).Limit(1).Find(&admin)
	if result.Error != nil {
		return c.Status(500).JSON(response.ResponseModel{
			RetCode: "500",
			Message: status.RetCode500,
			Data:    errors.ErrorModel{Message: "Failed to query admin account", IsSuccess: false, Error: result.Error},
		})
	}
	if result.RowsAffected == 0 {
		return c.Status(401).JSON(response.ResponseModel{
			RetCode: "401",
			Message: "Invalid email or password",
			Data:    errors.ErrorModel{Message: "Admin not found", IsSuccess: false},
		})
	}

	if err := bcrypt.CompareHashAndPassword([]byte(admin.Password), []byte(password)); err != nil {
		if strings.TrimSpace(admin.Password) != password {
			return c.Status(401).JSON(response.ResponseModel{
				RetCode: "401",
				Message: "Invalid email or password",
				Data:    errors.ErrorModel{Message: "Incorrect password", IsSuccess: false},
			})
		}

		hashedPassword, hashErr := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
		if hashErr == nil {
			_ = db.Table("public.admins").Where("id = ?", admin.ID).Update("password", string(hashedPassword)).Error
		}
	}

	if admin.IsDisabled {
		return c.Status(403).JSON(response.ResponseModel{
			RetCode: "403",
			Message: "Admin account is disabled",
			Data:    errors.ErrorModel{Message: "Contact superadmin to restore access", IsSuccess: false},
		})
	}

	name := strings.TrimSpace(admin.Name)
	if name == "" {
		name = strings.TrimSpace(admin.FirstName + " " + admin.LastName)
	}

	adminID := admin.ID
	role := middleware.SessionRoleAdmin
	var superadminUsername *string
	if admin.IsSuperAdmin {
		role = middleware.SessionRoleSuperAdmin
		superadmin := strings.ToLower(strings.TrimSpace(admin.Email))
		superadminUsername = &superadmin
	}

	session, sessionErr := middleware.CreateSession(c, role, nil, &adminID, superadminUsername, 7*24*time.Hour, nil)
	if sessionErr != nil {
		return c.Status(500).JSON(response.ResponseModel{
			RetCode: "500",
			Message: status.RetCode500,
			Data:    errors.ErrorModel{Message: "Failed to create session", IsSuccess: false, Error: sessionErr},
		})
	}

	return c.Status(200).JSON(response.ResponseModel{
		RetCode: "200",
		Message: "Login successful",
		Data: map[string]any{
			"id":           admin.ID,
			"name":         name,
			"email":        admin.Email,
			"unit":         admin.Unit,
			"isSuperAdmin": admin.IsSuperAdmin,
			"sessionId":    session.ID,
		},
	})
}

func UpdateAdminUnit(c *fiber.Ctx) error {
	db := middleware.DBConn

	adminId := c.Params("id")

	var req struct {
		Unit string `json:"unit"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(response.ResponseModel{
			RetCode: "400",
			Message: status.RetCode400,
			Data:    errors.ErrorModel{Message: "Invalid request body", IsSuccess: false, Error: err},
		})
	}

	var existingUnit model.Admin
	if err := db.Table("public.admins").Where("LOWER(unit) = LOWER(?) AND id != ?", req.Unit, adminId).First(&existingUnit).Error; err == nil {
		return c.Status(409).JSON(response.ResponseModel{
			RetCode: "409",
			Message: "This unit already has an admin",
			Data:    errors.ErrorModel{Message: "Change is not allowed", IsSuccess: false},
		})
	}

	if err := db.Table("public.admins").Where("id = ?", adminId).Updates(map[string]any{
		"unit":       req.Unit,
		"department": req.Unit,
	}).Error; err != nil {
		return c.Status(500).JSON(response.ResponseModel{
			RetCode: "500",
			Message: status.RetCode500,
			Data:    errors.ErrorModel{Message: "Failed to update unit", IsSuccess: false, Error: err},
		})
	}

	return c.Status(200).JSON(response.ResponseModel{
		RetCode: "200",
		Message: "Unit updated successfully",
		Data:    map[string]any{"unit": req.Unit},
	})
}
