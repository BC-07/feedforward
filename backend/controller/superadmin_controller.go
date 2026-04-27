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
	db := middleware.DBConn

	sessionID := middleware.GetSessionIDFromCookies(c, middleware.SessionRoleSuperAdmin)
	if sessionID == "" {
		return false
	}

	session, err := middleware.GetActiveSessionByIDAndRole(sessionID, middleware.SessionRoleSuperAdmin)
	if err != nil || session == nil {
		return false
	}
	if session.AdminID == nil || strings.TrimSpace(*session.AdminID) == "" {
		return false
	}
	superAdminID := strings.TrimSpace(*session.AdminID)
	if headerID := strings.TrimSpace(c.Get("X-SuperAdmin-Id")); headerID != "" && headerID != superAdminID {
		return false
	}
	middleware.TouchSession(sessionID)

	var admin model.Admin
	result := db.Table("public.admins").
		Select("id, is_disabled, is_superadmin").
		Where("id = ?", superAdminID).
		Limit(1).
		Find(&admin)

	if result.Error != nil || result.RowsAffected == 0 {
		return false
	}

	return admin.IsSuperAdmin && !admin.IsDisabled
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

	normalizedEmail := strings.ToLower(strings.TrimSpace(req.Email))
	if normalizedEmail == "" {
		return c.Status(400).JSON(response.ResponseModel{
			RetCode: "400",
			Message: status.RetCode400,
			Data:    errors.ErrorModel{Message: "Email is required", IsSuccess: false},
		})
	}

	var existing model.Admin
	if db.Table("public.admins").Where("LOWER(TRIM(email)) = ?", normalizedEmail).First(&existing).Error == nil {
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
		Email:     normalizedEmail,
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
		Email:     normalizedEmail,
		ExpiresAt: nowTime.Add(24 * time.Hour),
	}
	adminSetupMu.Unlock()

	frontendBase := strings.TrimRight(strings.TrimSpace(middleware.GetEnv("FRONTEND_BASE_URL")), "/")
	if frontendBase == "" {
		frontendBase = "http://localhost:3000"
	}

	setupURL := fmt.Sprintf("%s/dashboard/change-password?token=%s", frontendBase, setupToken)
	mailBody := fmt.Sprintf(`
	<div style="background:#f3f4f6;padding:24px;font-family:Arial,Helvetica,sans-serif;">
	  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;">
	    <div style="background:#f59e0b;padding:18px 20px;color:#111827;">
	      <div style="font-size:15px;font-weight:800;letter-spacing:.04em;">FEED FORWARD</div>
	      <div style="font-size:11px;margin-top:2px;">SMART. FAST. SAFE.</div>
	    </div>

	    <div style="padding:18px 20px;">
	      <div style="font-size:22px;font-weight:700;color:#111827;">Admin account created</div>
	      <div style="font-size:13px;color:#4b5563;margin-top:8px;">Hello %s.</div>
	      <div style="font-size:13px;color:#4b5563;margin-top:8px;line-height:1.6;">Your admin account is ready. Use the temporary password below, then set your new password.</div>

	      <table style="width:100%%;margin-top:18px;border-collapse:collapse;">
	        <tr>
	          <td style="width:36%%;padding:8px 0;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.08em;">Unit</td>
	          <td style="padding:8px 0;font-size:13px;color:#111827;">%s</td>
	        </tr>
	        <tr>
	          <td style="padding:8px 0;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.08em;">Temporary password</td>
	          <td style="padding:8px 0;font-size:18px;color:#111827;font-weight:700;letter-spacing:.04em;word-break:break-all;">%s</td>
	        </tr>
	        <tr>
	          <td style="padding:8px 0;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.08em;">Setup link expires</td>
	          <td style="padding:8px 0;font-size:13px;color:#111827;">24 hours</td>
	        </tr>
	      </table>

	      <div style="margin-top:18px;">
	        <a href="%s" style="display:inline-block;background:#f59e0b;color:#111827;text-decoration:none;font-size:12px;font-weight:700;padding:10px 14px;border-radius:6px;">Go to Change Password</a>
	      </div>

	      <div style="margin-top:16px;font-size:11px;color:#6b7280;">If you did not expect this email, contact your super admin.</div>
	      <div style="margin-top:16px;font-size:11px;color:#9ca3af;">Thank you,<br/>FeedForward</div>
	    </div>
	  </div>
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
	if err := db.Table("public.admins").Where("id = ?", id).First(&existing).Error; err != nil {
		return c.Status(404).JSON(response.ResponseModel{
			RetCode: "404",
			Message: "Admin not found",
			Data:    errors.ErrorModel{Message: "Admin not found", IsSuccess: false, Error: err},
		})
	}

	if strings.TrimSpace(req.Email) != "" {
		incomingEmail := strings.ToLower(strings.TrimSpace(req.Email))
		currentEmail := strings.ToLower(strings.TrimSpace(existing.Email))
		if incomingEmail != currentEmail {
			return c.Status(400).JSON(response.ResponseModel{
				RetCode: "400",
				Message: status.RetCode400,
				Data: errors.ErrorModel{
					Message:   "Admin email cannot be changed",
					IsSuccess: false,
				},
			})
		}
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
	if req.Unit != "" {
		updates["unit"] = req.Unit
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

func SuperAdminEnableAdmin(c *fiber.Ctx) error {
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
		"is_disabled": false,
		"updated_at":  time.Now().Format(time.RFC3339),
	}

	result := db.Table("public.admins").Where("id = ?", id).Updates(updates)
	if result.Error != nil {
		return c.Status(500).JSON(response.ResponseModel{
			RetCode: "500",
			Message: status.RetCode500,
			Data:    errors.ErrorModel{Message: "Failed to enable admin", IsSuccess: false, Error: result.Error},
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
			Data:    errors.ErrorModel{Message: "Failed to load admin after enable", IsSuccess: false, Error: err},
		})
	}

	return c.Status(200).JSON(response.ResponseModel{
		RetCode: "200",
		Message: "Admin enabled successfully",
		Data:    admin,
	})
}

func SuperAdminReverify(c *fiber.Ctx) error {
	if !superAdminAuth(c) {
		return c.Status(401).JSON(response.ResponseModel{
			RetCode: "401",
			Message: "Unauthorized superadmin access",
			Data:    errors.ErrorModel{Message: "Invalid or missing superadmin token", IsSuccess: false},
		})
	}

	var req struct {
		Password string `json:"password"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(response.ResponseModel{
			RetCode: "400",
			Message: status.RetCode400,
			Data:    errors.ErrorModel{Message: "Invalid request body", IsSuccess: false, Error: err},
		})
	}

	password := strings.TrimSpace(req.Password)
	if password == "" {
		return c.Status(400).JSON(response.ResponseModel{
			RetCode: "400",
			Message: status.RetCode400,
			Data:    errors.ErrorModel{Message: "Password is required", IsSuccess: false},
		})
	}

	sessionID := middleware.GetSessionIDFromCookies(c, middleware.SessionRoleSuperAdmin)
	if sessionID == "" {
		return c.Status(401).JSON(response.ResponseModel{
			RetCode: "401",
			Message: "Unauthorized superadmin access",
			Data:    errors.ErrorModel{Message: "Session not found", IsSuccess: false},
		})
	}

	session, err := middleware.GetActiveSessionByIDAndRole(sessionID, middleware.SessionRoleSuperAdmin)
	if err != nil {
		return c.Status(500).JSON(response.ResponseModel{
			RetCode: "500",
			Message: status.RetCode500,
			Data:    errors.ErrorModel{Message: "Failed to fetch session", IsSuccess: false, Error: err},
		})
	}
	if session == nil || session.AdminID == nil || strings.TrimSpace(*session.AdminID) == "" {
		return c.Status(401).JSON(response.ResponseModel{
			RetCode: "401",
			Message: "Unauthorized superadmin access",
			Data:    errors.ErrorModel{Message: "Session expired", IsSuccess: false},
		})
	}

	adminID := strings.TrimSpace(*session.AdminID)
	db := middleware.DBConn
	var admin model.Admin
	result := db.Table("public.admins").Where("id = ?", adminID).Limit(1).Find(&admin)
	if result.Error != nil {
		return c.Status(500).JSON(response.ResponseModel{
			RetCode: "500",
			Message: status.RetCode500,
			Data:    errors.ErrorModel{Message: "Failed to query admin account", IsSuccess: false, Error: result.Error},
		})
	}
	if result.RowsAffected == 0 || !admin.IsSuperAdmin || admin.IsDisabled {
		return c.Status(401).JSON(response.ResponseModel{
			RetCode: "401",
			Message: "Unauthorized superadmin access",
			Data:    errors.ErrorModel{Message: "Superadmin account not available", IsSuccess: false},
		})
	}

	if err := bcrypt.CompareHashAndPassword([]byte(admin.Password), []byte(password)); err != nil {
		if strings.TrimSpace(admin.Password) != password {
			return c.Status(401).JSON(response.ResponseModel{
				RetCode: "401",
				Message: "Invalid password",
				Data:    errors.ErrorModel{Message: "Incorrect password", IsSuccess: false},
			})
		}

		hashedPassword, hashErr := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
		if hashErr == nil {
			_ = db.Table("public.admins").Where("id = ?", admin.ID).Update("password", string(hashedPassword)).Error
		}
	}

	middleware.TouchSession(sessionID)
	return c.Status(200).JSON(response.ResponseModel{
		RetCode: "200",
		Message: "Superadmin re-verified",
		Data:    map[string]any{"verified": true},
	})
}
