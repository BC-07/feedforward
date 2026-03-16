package controller

import (
	"strings"

	"FeedForward/backend/middleware"
	"FeedForward/backend/model"
	"FeedForward/backend/model/errors"
	"FeedForward/backend/model/response"
	"FeedForward/backend/model/status"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

func listAllCategories(db *gorm.DB) ([]model.Category, error) {
	var categories []model.Category
	err := db.Table("public.categories").Order("id ASC").Find(&categories).Error
	return categories, err
}

func SuperAdminListCategories(c *fiber.Ctx) error {
	db := middleware.DBConn
	categories, err := listAllCategories(db)
	if err != nil {
		return c.Status(500).JSON(response.ResponseModel{
			RetCode: "500",
			Message: status.RetCode500,
			Data:    errors.ErrorModel{Message: "Failed to fetch categories", IsSuccess: false, Error: err},
		})
	}
	return c.Status(200).JSON(response.ResponseModel{
		RetCode: "200",
		Message: "Success",
		Data:    categories,
	})
}

func SuperAdminCreateCategory(c *fiber.Ctx) error {
	if !superAdminAuth(c) {
		return c.Status(401).JSON(response.ResponseModel{
			RetCode: "401",
			Message: "Unauthorized superadmin access",
			Data:    errors.ErrorModel{Message: "Invalid or missing superadmin token", IsSuccess: false},
		})
	}
	db := middleware.DBConn

	var req struct {
		Name string `json:"name"`
	}
	if err := c.BodyParser(&req); err != nil || strings.TrimSpace(req.Name) == "" {
		return c.Status(400).JSON(response.ResponseModel{
			RetCode: "400",
			Message: status.RetCode400,
			Data:    errors.ErrorModel{Message: "Category name is required", IsSuccess: false},
		})
	}

	category := model.Category{Name: strings.TrimSpace(req.Name)}
	if err := db.Table("public.categories").Create(&category).Error; err != nil {
		return c.Status(500).JSON(response.ResponseModel{
			RetCode: "500",
			Message: status.RetCode500,
			Data:    errors.ErrorModel{Message: "Failed to create category", IsSuccess: false, Error: err},
		})
	}

	categories, err := listAllCategories(db)
	if err != nil {
		return c.Status(500).JSON(response.ResponseModel{
			RetCode: "500",
			Message: status.RetCode500,
			Data:    errors.ErrorModel{Message: "Failed to fetch updated categories", IsSuccess: false, Error: err},
		})
	}
	return c.Status(201).JSON(response.ResponseModel{
		RetCode: "201",
		Message: "Category created successfully",
		Data:    categories,
	})
}

func SuperAdminUpdateCategory(c *fiber.Ctx) error {
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
		Name string `json:"name"`
	}
	if err := c.BodyParser(&req); err != nil || strings.TrimSpace(req.Name) == "" {
		return c.Status(400).JSON(response.ResponseModel{
			RetCode: "400",
			Message: status.RetCode400,
			Data:    errors.ErrorModel{Message: "Category name is required", IsSuccess: false},
		})
	}

	if err := db.Table("public.categories").Where("id = ?", id).Update("name", strings.TrimSpace(req.Name)).Error; err != nil {
		return c.Status(500).JSON(response.ResponseModel{
			RetCode: "500",
			Message: status.RetCode500,
			Data:    errors.ErrorModel{Message: "Failed to update category", IsSuccess: false, Error: err},
		})
	}

	categories, err := listAllCategories(db)
	if err != nil {
		return c.Status(500).JSON(response.ResponseModel{
			RetCode: "500",
			Message: status.RetCode500,
			Data:    errors.ErrorModel{Message: "Failed to fetch updated categories", IsSuccess: false, Error: err},
		})
	}
	return c.Status(200).JSON(response.ResponseModel{
		RetCode: "200",
		Message: "Category updated successfully",
		Data:    categories,
	})
}

func SuperAdminDeleteCategory(c *fiber.Ctx) error {
	if !superAdminAuth(c) {
		return c.Status(401).JSON(response.ResponseModel{
			RetCode: "401",
			Message: "Unauthorized superadmin access",
			Data:    errors.ErrorModel{Message: "Invalid or missing superadmin token", IsSuccess: false},
		})
	}
	db := middleware.DBConn
	id := c.Params("id")

	var category model.Category
	if err := db.Table("public.categories").Where("id = ?", id).First(&category).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(response.ResponseModel{
				RetCode: "404",
				Message: "Category not found",
				Data:    errors.ErrorModel{Message: "No category found with id: " + id, IsSuccess: false},
			})
		}
		return c.Status(500).JSON(response.ResponseModel{
			RetCode: "500",
			Message: status.RetCode500,
			Data:    errors.ErrorModel{Message: "Failed to load category", IsSuccess: false, Error: err},
		})
	}

	var activeAdminCount int64
	if err := db.Table("public.admins").Where("LOWER(TRIM(unit)) = LOWER(TRIM(?)) AND is_disabled = FALSE", category.Name).Count(&activeAdminCount).Error; err != nil {
		return c.Status(500).JSON(response.ResponseModel{
			RetCode: "500",
			Message: status.RetCode500,
			Data:    errors.ErrorModel{Message: "Failed to validate category usage", IsSuccess: false, Error: err},
		})
	}

	if activeAdminCount > 0 {
		return c.Status(409).JSON(response.ResponseModel{
			RetCode: "409",
			Message: "Category cannot be deleted",
			Data: errors.ErrorModel{
				Message:   "Disable or reassign active admin accounts for this category before deleting it",
				IsSuccess: false,
			},
		})
	}

	if err := db.Table("public.categories").Where("id = ?", id).Delete(&model.Category{}).Error; err != nil {
		return c.Status(500).JSON(response.ResponseModel{
			RetCode: "500",
			Message: status.RetCode500,
			Data:    errors.ErrorModel{Message: "Failed to delete category", IsSuccess: false, Error: err},
		})
	}

	categories, err := listAllCategories(db)
	if err != nil {
		return c.Status(500).JSON(response.ResponseModel{
			RetCode: "500",
			Message: status.RetCode500,
			Data:    errors.ErrorModel{Message: "Failed to fetch updated categories", IsSuccess: false, Error: err},
		})
	}
	return c.Status(200).JSON(response.ResponseModel{
		RetCode: "200",
		Message: "Category deleted successfully",
		Data:    categories,
	})
}
