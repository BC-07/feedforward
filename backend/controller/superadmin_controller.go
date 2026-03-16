package controller

import (
	"fmt"
	"time"

	"FeedForward/backend/middleware"
	"FeedForward/backend/model"
	"FeedForward/backend/model/errors"
	"FeedForward/backend/model/response"
	"FeedForward/backend/model/status"

	"github.com/gofiber/fiber/v2"
	"golang.org/x/crypto/bcrypt"
)

func superAdminAuth(c *fiber.Ctx) bool {
	return c.Get("X-SuperAdmin-Token") == middleware.GetEnv("SUPERADMIN_KEY")
}

func SuperAdminLogin(c *fiber.Ctx) error {
	var req struct {
		Key string `json:"key"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(response.ResponseModel{
			RetCode: "400",
			Message: status.RetCode400,
			Data:    errors.ErrorModel{Message: "Invalid request body", IsSuccess: false, Error: err},
		})
	}
	if req.Key != middleware.GetEnv("SUPERADMIN_KEY") {
		return c.Status(401).JSON(response.ResponseModel{
			RetCode: "401",
			Message: "Invalid superadmin key",
			Data:    errors.ErrorModel{Message: "The provided key is incorrect", IsSuccess: false},
		})
	}
	expiresAt := time.Now().Add(8 * time.Hour).Format(time.RFC3339)
	return c.Status(200).JSON(response.ResponseModel{
		RetCode: "200",
		Message: "Superadmin login successful",
		Data: map[string]any{
			"token":     middleware.GetEnv("SUPERADMIN_KEY"),
			"name":      "Superadmin",
			"expiresAt": expiresAt,
		},
	})
}

func SuperAdminListAdmins(c *fiber.Ctx) error {
	if !superAdminAuth(c) {
		return c.Status(401).JSON(response.ResponseModel{
			RetCode: "401",
			Message: "Unauthorized superadmin access",
			Data:    errors.ErrorModel{Message: "Invalid or missing superadmin token", IsSuccess: false},
		})
	}
	db := middleware.DBConn
	var admins []model.Admin
	if err := db.Table("public.admins").Order("created_at DESC").Find(&admins).Error; err != nil {
		return c.Status(500).JSON(response.ResponseModel{
			RetCode: "500",
			Message: status.RetCode500,
			Data:    errors.ErrorModel{Message: "Failed to fetch admins", IsSuccess: false, Error: err},
		})
	}
	return c.Status(200).JSON(response.ResponseModel{
		RetCode: "200",
		Message: "Success",
		Data:    admins,
	})
}

func SuperAdminCreateAdmin(c *fiber.Ctx) error {
	if !superAdminAuth(c) {
		return c.Status(401).JSON(response.ResponseModel{
			RetCode: "401",
			Message: "Unauthorized superadmin access",
			Data:    errors.ErrorModel{Message: "Invalid or missing superadmin token", IsSuccess: false},
		})
	}
	db := middleware.DBConn

	var req struct {
		FirstName string `json:"firstName"`
		LastName  string `json:"lastName"`
		Email     string `json:"email"`
		Password  string `json:"password"`
		Unit      string `json:"unit"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(response.ResponseModel{
			RetCode: "400",
			Message: status.RetCode400,
			Data:    errors.ErrorModel{Message: "Invalid request body", IsSuccess: false, Error: err},
		})
	}

	var existing model.Admin
	if db.Table("public.admins").Where("email = ?", req.Email).First(&existing).Error == nil {
		return c.Status(409).JSON(response.ResponseModel{
			RetCode: "409",
			Message: "Email already registered",
			Data:    errors.ErrorModel{Message: "An admin with this email already exists", IsSuccess: false},
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

	now := time.Now().Format(time.RFC3339)
	admin := model.Admin{
		ID:        fmt.Sprintf("ADMIN-%d", time.Now().UnixMilli()),
		FirstName: req.FirstName,
		LastName:  req.LastName,
		Email:     req.Email,
		Password:  string(hashedPassword),
		Unit:      req.Unit,
		CreatedAt: now,
		UpdatedAt: now,
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
		Message: "Admin created successfully",
		Data:    admin,
	})
}

func SuperAdminUpdateAdmin(c *fiber.Ctx) error {
	if !superAdminAuth(c) {
		return c.Status(401).JSON(response.ResponseModel{
			RetCode: "401",
			Message: "Unauthorized superadmin access",
			Data:    errors.ErrorModel{Message: "Invalid or missing superadmin token", IsSuccess: false},
		})
	}
	db := middleware.DBConn
	id := c.Params("id")

	var req struct {
		FirstName string `json:"firstName"`
		LastName  string `json:"lastName"`
		Email     string `json:"email"`
		Password  string `json:"password"`
		Unit      string `json:"unit"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(response.ResponseModel{
			RetCode: "400",
			Message: status.RetCode400,
			Data:    errors.ErrorModel{Message: "Invalid request body", IsSuccess: false, Error: err},
		})
	}

	updates := map[string]any{
		"updated_at": time.Now().Format(time.RFC3339),
	}
	if req.FirstName != "" {
		updates["first_name"] = req.FirstName
	}
	if req.LastName != "" {
		updates["last_name"] = req.LastName
	}
	if req.Email != "" {
		updates["email"] = req.Email
	}
	if req.Unit != "" {
		updates["unit"] = req.Unit
	}
	if req.Password != "" {
		hashed, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
		if err != nil {
			return c.Status(500).JSON(response.ResponseModel{
				RetCode: "500",
				Message: status.RetCode500,
				Data:    errors.ErrorModel{Message: "Failed to process password", IsSuccess: false, Error: err},
			})
		}
		updates["password"] = string(hashed)
	}

	if err := db.Table("public.admins").Where("id = ?", id).Updates(updates).Error; err != nil {
		return c.Status(500).JSON(response.ResponseModel{
			RetCode: "500",
			Message: status.RetCode500,
			Data:    errors.ErrorModel{Message: "Failed to update admin", IsSuccess: false, Error: err},
		})
	}

	var admin model.Admin
	db.Table("public.admins").Where("id = ?", id).First(&admin)

	return c.Status(200).JSON(response.ResponseModel{
		RetCode: "200",
		Message: "Admin updated successfully",
		Data:    admin,
	})
}

func SuperAdminDeleteAdmin(c *fiber.Ctx) error {
	if !superAdminAuth(c) {
		return c.Status(401).JSON(response.ResponseModel{
			RetCode: "401",
			Message: "Unauthorized superadmin access",
			Data:    errors.ErrorModel{Message: "Invalid or missing superadmin token", IsSuccess: false},
		})
	}
	db := middleware.DBConn
	id := c.Params("id")

	if err := db.Table("public.admins").Where("id = ?", id).Delete(&map[string]any{}).Error; err != nil {
		return c.Status(500).JSON(response.ResponseModel{
			RetCode: "500",
			Message: status.RetCode500,
			Data:    errors.ErrorModel{Message: "Failed to delete admin", IsSuccess: false, Error: err},
		})
	}

	return c.Status(200).JSON(response.ResponseModel{
		RetCode: "200",
		Message: "Admin deleted successfully",
		Data:    "Admin " + id + " deleted",
	})
}

func SuperAdminDisableAdmin(c *fiber.Ctx) error {
	if !superAdminAuth(c) {
		return c.Status(401).JSON(response.ResponseModel{
			RetCode: "401",
			Message: "Unauthorized superadmin access",
			Data:    errors.ErrorModel{Message: "Invalid or missing superadmin token", IsSuccess: false},
		})
	}

	db := middleware.DBConn
	id := c.Params("id")

	updates := map[string]any{
		"is_disabled": true,
		"updated_at":  time.Now().Format(time.RFC3339),
	}

	result := db.Table("public.admins").Where("id = ?", id).Updates(updates)
	if result.Error != nil {
		return c.Status(500).JSON(response.ResponseModel{
			RetCode: "500",
			Message: status.RetCode500,
			Data:    errors.ErrorModel{Message: "Failed to disable admin", IsSuccess: false, Error: result.Error},
		})
	}

	if result.RowsAffected == 0 {
		return c.Status(404).JSON(response.ResponseModel{
			RetCode: "404",
			Message: "Admin not found",
			Data:    errors.ErrorModel{Message: "No admin found with id: " + id, IsSuccess: false},
		})
	}

	var admin model.Admin
	if err := db.Table("public.admins").Where("id = ?", id).First(&admin).Error; err != nil {
		return c.Status(500).JSON(response.ResponseModel{
			RetCode: "500",
			Message: status.RetCode500,
			Data:    errors.ErrorModel{Message: "Failed to load admin after disable", IsSuccess: false, Error: err},
		})
	}

	return c.Status(200).JSON(response.ResponseModel{
		RetCode: "200",
		Message: "Admin disabled successfully",
		Data:    admin,
	})
}
