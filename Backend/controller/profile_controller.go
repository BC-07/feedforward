package controller

import (
	"fmt"
	"intern_template_v1/middleware"
	"strings"

	"github.com/gofiber/fiber/v2"
)

func UpdateUserProfile(c *fiber.Ctx) error {
	if err := requireUserSessionForID(c, c.Params("id")); err != nil {
		return err
	}
	//Storage preparation
	var payload struct {
		FirstName string `json:"firstName"`
		LastName  string `json:"lastName"`
	}

	//validating user input in json
	if err := parseBody(c, &payload); err != nil {
		return parseError(c, "failed to parse user profile", err)
	}

	payload.FirstName = strings.TrimSpace(payload.FirstName)
	payload.LastName = strings.TrimSpace(payload.LastName)
	if payload.FirstName == "" || payload.LastName == "" {
		return invalidRequest(c, "first name and last name are required")
	}
	if containsEmailLike(payload.LastName) {
		return invalidRequest(c, "last name must not contain an email")
	}

	if err := execUpdateByID(
		userTable,
		c.Params("id"),
		"failed to update user profile",
		"user not found",
		[]string{"first_name = ?", "last_name = ?", "updated_at = ?"},
		payload.FirstName, payload.LastName, utcNow(),
	); err != nil {
		return respondDBResult(c, err)
	}

	user, err := fetchUserByID(c.Params("id"))
	if err != nil {
		return serverError(c, "failed to fetch user", err)
	}
	return success(c, fiber.StatusOK, user)
}

func UpdateAdminProfile(c *fiber.Ctx) error {
	if err := requireAdminSessionForID(c, c.Params("id")); err != nil {
		return err
	}
	//Storage preparation
	var payload struct {
		FirstName string `json:"firstName"`
		LastName  string `json:"lastName"`
	}

	//validating user input in json
	if err := parseBody(c, &payload); err != nil {
		return parseError(c, "failed to parse admin profile", err)
	}

	payload.FirstName = strings.TrimSpace(payload.FirstName)
	payload.LastName = strings.TrimSpace(payload.LastName)
	if payload.FirstName == "" || payload.LastName == "" {
		return invalidRequest(c, "first name and last name are required")
	}
	if containsEmailLike(payload.LastName) {
		return invalidRequest(c, "last name must not contain an email")
	}

	if err := execUpdateByID(
		adminTable,
		c.Params("id"),
		"failed to update admin profile",
		"admin not found",
		[]string{"first_name = ?", "last_name = ?", "updated_at = ?"},
		payload.FirstName, payload.LastName, utcNow(),
	); err != nil {
		return respondDBResult(c, err)
	}

	admin, err := fetchAdminByID(c.Params("id"))
	if err != nil || admin.ID == "" {
		return notFound(c, "admin not found", err)
	}

	return success(c, fiber.StatusOK, admin)
}

func UpdateUserPassword(c *fiber.Ctx) error {
	if err := requireUserSessionForID(c, c.Params("id")); err != nil {
		return err
	}
	return updatePassword(c, userTable, "user")
}

func DeleteUserAccount(c *fiber.Ctx) error {
	if err := requireUserSessionForID(c, c.Params("id")); err != nil {
		return err
	}
	return deleteByID(c, userTable, "user", c.Params("id"))
}

func UpdateAdminPassword(c *fiber.Ctx) error {
	if err := requireAdminSessionForID(c, c.Params("id")); err != nil {
		return err
	}
	return updatePassword(c, adminTable, "admin")
}

func DeleteAdminAccount(c *fiber.Ctx) error {
	return unauthorized(c, "admin self-deletion is not allowed")
}

func updatePassword(c *fiber.Ctx, table string, entity string) error {
	//Storage preparation
	var payload struct {
		CurrentPassword string `json:"currentPassword"`
		NewPassword     string `json:"newPassword"`
	}

	//validating user input in json
	if err := parseBody(c, &payload); err != nil {
		return parseError(c, "failed to parse password update", err)
	}

	payload.CurrentPassword = strings.TrimSpace(payload.CurrentPassword)
	payload.NewPassword = strings.TrimSpace(payload.NewPassword)
	if payload.CurrentPassword == "" || payload.NewPassword == "" {
		return invalidRequest(c, "current password and new password are required")
	}
	if len(payload.NewPassword) < 6 {
		return invalidRequest(c, "new password must be at least 6 characters")
	}

	result := middleware.DBConn.Exec(
		fmt.Sprintf("UPDATE %s SET password = ?, updated_at = ? WHERE id = ? AND password = ?", table),
		payload.NewPassword, utcNow(), c.Params("id"), payload.CurrentPassword,
	)
	if result.Error != nil {
		return serverError(c, "failed to update password", result.Error)
	}
	if result.RowsAffected == 0 {
		return unauthorized(c, fmt.Sprintf("%s current password is incorrect", entity))
	}

	return success(c, fiber.StatusOK, map[string]string{"id": c.Params("id")})
}
