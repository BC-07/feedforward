package controller

import (
	"crypto/rand"
	"fmt"
	"math/big"
	"strings"
	"sync"
	"time"

	"FeedForward/backend/middleware"
	"FeedForward/backend/model"
	"FeedForward/backend/model/errors"
	"FeedForward/backend/model/response"
	"FeedForward/backend/model/status"

	"github.com/gofiber/fiber/v2"
	"golang.org/x/crypto/bcrypt"
)

type adminSetupEntry struct {
	Email     string
	ExpiresAt time.Time
}

var (
	adminSetupTokens = map[string]adminSetupEntry{}
	adminSetupMu     sync.Mutex
)

const adminSetupAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789"

func generateRandomString(length int) (string, error) {
	b := make([]byte, length)
	max := big.NewInt(int64(len(adminSetupAlphabet)))
	for i := range b {
		n, err := rand.Int(rand.Reader, max)
		if err != nil {
			return "", err
		}
		b[i] = adminSetupAlphabet[n.Int64()]
	}
	return string(b), nil
}

func generateTempAdminPassword() (string, error) {
	return generateRandomString(6)
}

func generateAdminSetupToken() (string, error) {
	return generateRandomString(24)
}

func cleanupExpiredAdminSetupTokens(now time.Time) {
	for token, entry := range adminSetupTokens {
		if now.After(entry.ExpiresAt) {
			delete(adminSetupTokens, token)
		}
	}
}

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

	tempPassword, err := generateTempAdminPassword()
	if err != nil {
		return c.Status(500).JSON(response.ResponseModel{
			RetCode: "500",
			Message: status.RetCode500,
			Data:    errors.ErrorModel{Message: "Failed to generate temporary password", IsSuccess: false, Error: err},
		})
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(tempPassword), bcrypt.DefaultCost)
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

	setupToken, err := generateAdminSetupToken()
	if err != nil {
		return c.Status(500).JSON(response.ResponseModel{
			RetCode: "500",
			Message: status.RetCode500,
			Data:    errors.ErrorModel{Message: "Failed to create setup token", IsSuccess: false, Error: err},
		})
	}

	nowTime := time.Now()
	adminSetupMu.Lock()
	cleanupExpiredAdminSetupTokens(nowTime)
	adminSetupTokens[setupToken] = adminSetupEntry{
		Email:     strings.ToLower(strings.TrimSpace(req.Email)),
		ExpiresAt: nowTime.Add(24 * time.Hour),
	}
	adminSetupMu.Unlock()

	frontendBase := strings.TrimRight(strings.TrimSpace(middleware.GetEnv("FRONTEND_BASE_URL")), "/")
	if frontendBase == "" {
		frontendBase = "http://localhost:3000"
	}

	setupURL := fmt.Sprintf("%s/dashboard/change-password?token=%s", frontendBase, setupToken)
	mailBody := fmt.Sprintf(`
	<div style="font-family:Arial,Helvetica,sans-serif;line-height:1.6;color:#111827;">
	  <h2 style="margin:0 0 10px;">Your FeedForward admin account is ready</h2>
	  <p style="margin:0 0 8px;">Hello %s,</p>
	  <p style="margin:0 0 12px;">Your admin account for <strong>%s</strong> has been created.</p>
	  <p style="margin:0 0 8px;">Temporary password (6 characters):</p>
	  <div style="padding:12px 14px;border:1px solid #e5e7eb;border-radius:8px;background:#f9fafb;font-size:18px;font-weight:700;letter-spacing:.04em;word-break:break-all;">%s</div>
	  <p style="margin:12px 0 8px;">Use this link to directly set your new password:</p>
	  <p style="margin:0 0 12px;"><a href="%s" style="display:inline-block;padding:10px 14px;background:#111827;color:#ffffff;text-decoration:none;border-radius:6px;">Go to Change Password</a></p>
	  <p style="margin:0;font-size:12px;color:#6b7280;">This setup link expires in 24 hours.</p>
	</div>
	`, strings.TrimSpace(admin.FirstName), strings.TrimSpace(admin.Unit), tempPassword, setupURL)

	if mailErr := SendHTMLEmail(req.Email, "FeedForward admin account created", mailBody); mailErr != nil {
		return c.Status(500).JSON(response.ResponseModel{
			RetCode: "500",
			Message: status.RetCode500,
			Data:    errors.ErrorModel{Message: "Admin created but failed to send setup email", IsSuccess: false, Error: mailErr},
		})
	}

	return c.Status(201).JSON(response.ResponseModel{
		RetCode: "201",
		Message: "Admin created successfully",
		Data:    admin,
	})
}

func SetAdminPassword(c *fiber.Ctx) error {
	db := middleware.DBConn

	var req struct {
		Token       string `json:"token"`
		NewPassword string `json:"newPassword"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(response.ResponseModel{
			RetCode: "400",
			Message: status.RetCode400,
			Data:    errors.ErrorModel{Message: "Invalid request body", IsSuccess: false, Error: err},
		})
	}

	token := strings.TrimSpace(req.Token)
	newPassword := strings.TrimSpace(req.NewPassword)
	if token == "" || newPassword == "" {
		return c.Status(400).JSON(response.ResponseModel{
			RetCode: "400",
			Message: status.RetCode400,
			Data:    errors.ErrorModel{Message: "Token and new password are required", IsSuccess: false},
		})
	}
	if len(newPassword) < 6 {
		return c.Status(400).JSON(response.ResponseModel{
			RetCode: "400",
			Message: status.RetCode400,
			Data:    errors.ErrorModel{Message: "Password must be at least 6 characters", IsSuccess: false},
		})
	}

	adminSetupMu.Lock()
	cleanupExpiredAdminSetupTokens(time.Now())
	entry, exists := adminSetupTokens[token]
	if exists {
		delete(adminSetupTokens, token)
	}
	adminSetupMu.Unlock()

	if !exists {
		return c.Status(400).JSON(response.ResponseModel{
			RetCode: "400",
			Message: status.RetCode400,
			Data:    errors.ErrorModel{Message: "Invalid or expired setup link", IsSuccess: false},
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

	if err := db.Table("public.admins").Where("LOWER(TRIM(email)) = ?", strings.ToLower(strings.TrimSpace(entry.Email))).Update("password", string(hashedPassword)).Error; err != nil {
		return c.Status(500).JSON(response.ResponseModel{
			RetCode: "500",
			Message: status.RetCode500,
			Data:    errors.ErrorModel{Message: "Failed to update password", IsSuccess: false, Error: err},
		})
	}

	return c.Status(200).JSON(response.ResponseModel{
		RetCode: "200",
		Message: "Admin password updated successfully",
		Data:    map[string]any{"success": true},
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
