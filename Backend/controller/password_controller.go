package controller

import (
	"crypto/rand"
	"fmt"
	"math/big"
	"net/url"
	"strings"
	"sync"
	"time"

	"intern_template_v1/middleware"
	"intern_template_v1/model"

	"github.com/gofiber/fiber/v2"
)

type forgotPasswordRequest struct {
	Email string `json:"email"`
}

type verifyResetOTPRequest struct {
	Email string `json:"email"`
	OTP   string `json:"otp"`
}

type resetPasswordRequest struct {
	Email       string `json:"email"`
	NewPassword string `json:"newPassword"`
	Role        string `json:"role"`
}

type passwordResetEntry struct {
	Email     string
	ExpiresAt time.Time
	Role      string
}

type adminSetPasswordEntry struct {
	AdminID   string
	Email     string
	ExpiresAt time.Time
}

var (
	passwordResetTokens    = map[string]passwordResetEntry{}
	passwordResetMu        sync.Mutex
	verifiedResetEmails    = map[string]time.Time{}
	verifiedResetMu        sync.Mutex
	adminSetPasswordTokens = map[string]adminSetPasswordEntry{}
	adminSetPasswordMu     sync.Mutex
)

func resetKey(role string, email string) string {
	return strings.ToLower(strings.TrimSpace(role)) + ":" + strings.ToLower(strings.TrimSpace(email))
}

func cleanupExpiredResetTokens(now time.Time) {
	for token, entry := range passwordResetTokens {
		if now.After(entry.ExpiresAt) {
			delete(passwordResetTokens, token)
		}
	}
}

func cleanupExpiredVerifiedResetEmails(now time.Time) {
	for email, expiresAt := range verifiedResetEmails {
		if now.After(expiresAt) {
			delete(verifiedResetEmails, email)
		}
	}
}

func cleanupExpiredAdminSetPasswordTokens(now time.Time) {
	for token, entry := range adminSetPasswordTokens {
		if now.After(entry.ExpiresAt) {
			delete(adminSetPasswordTokens, token)
		}
	}
}

func generateSecureOTP() (string, error) {
	n, err := rand.Int(rand.Reader, big.NewInt(1000000))
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%06d", n.Int64()), nil
}

func loginPortalURL() string {
	base := strings.TrimSpace(middleware.GetEnv("FRONTEND_BASE_URL"))
	if base == "" {
		return ""
	}
	return strings.TrimRight(base, "/") + "/login"
}

func adminSetPasswordURL(token string) string {
	base := strings.TrimSpace(middleware.GetEnv("FRONTEND_BASE_URL"))
	if base == "" {
		return ""
	}
	return strings.TrimRight(base, "/") + "/admin/set-password?token=" + url.QueryEscape(token)
}

func buildOTPEmailHTML(otp string) string {
	content := fmt.Sprintf(
		`<p style="margin:0 0 12px 0;font-size:15px;line-height:22px;color:#111827;">We received a request to reset your password.</p>
<p style="margin:0 0 16px 0;font-size:15px;line-height:22px;color:#111827;">Use this one-time password (OTP) to continue:</p>
<div style="margin:20px 0;text-align:center;">
  <div style="display:inline-block;padding:18px 22px;border-radius:14px;background:#fff3e0;font-size:30px;font-weight:800;letter-spacing:0.35em;color:#111827;">%s</div>
</div>
<p style="margin:16px 0 0 0;font-size:13px;line-height:20px;color:#6b7280;">This OTP expires in 5 minutes. If you did not request this, you can ignore this email.</p>`,
		otp,
	)

	return buildEmailShell("Password reset OTP", content)
}

func buildOTPEmailText(otp string) string {
	lines := []string{
		"We received a request to reset your password.",
		fmt.Sprintf("Use this OTP to continue: %s", otp),
		"This OTP expires in 5 minutes.",
		"If you did not request this, you can ignore this email.",
	}
	return strings.Join(lines, "\n")
}

func buildAdminSetPasswordEmailHTML(name string, token string) string {
	intro := "A superadmin created your FeedForward admin account."
	if strings.TrimSpace(name) != "" {
		intro = fmt.Sprintf("Hello %s, a superadmin created your FeedForward admin account.", esc(name))
	}
	body := fmt.Sprintf(
		`<p style="margin:0 0 12px 0;font-size:15px;line-height:22px;color:#111827;">%s</p>
<p style="margin:0 0 16px 0;font-size:15px;line-height:22px;color:#111827;">Set a password to activate your access.</p>`,
		intro,
	)
	if link := adminSetPasswordURL(token); link != "" {
		body += primaryButton("Set your password", link)
	}
	body += `<p style="margin:16px 0 0 0;font-size:13px;line-height:20px;color:#6b7280;">This link expires in 24 hours.</p>`
	return buildEmailShell("Set your admin password", body)
}

func buildAdminSetPasswordEmailText(token string) string {
	lines := []string{
		"A superadmin created your FeedForward admin account.",
		"Set your password to activate your access.",
		"This link expires in 24 hours.",
	}
	if link := adminSetPasswordURL(token); link != "" {
		lines = append(lines, fmt.Sprintf("Set password: %s", link))
	}
	return strings.Join(lines, "\n")
}

func ForgotPassword(c *fiber.Ctx) error {
	var req forgotPasswordRequest
	if err := parseBody(c, &req); err != nil {
		return parseError(c, "invalid request body", err)
	}

	email := strings.ToLower(strings.TrimSpace(req.Email))
	if email == "" {
		return invalidRequest(c, "email is required")
	}

	role := "user"
	user, err := fetchUserByEmail(email)
	if err != nil || strings.TrimSpace(user.ID) == "" {
		admin, adminErr := fetchAdminByEmail(email)
		if adminErr != nil || strings.TrimSpace(admin.ID) == "" {
			return invalidRequest(c, "email is not registered")
		}
		role = "admin"
	}

	otp, err := generateSecureOTP()
	if err != nil {
		return serverError(c, "failed to generate OTP", err)
	}

	now := utcNow()
	passwordResetMu.Lock()
	cleanupExpiredResetTokens(now)
	passwordResetTokens[otp] = passwordResetEntry{
		Email:     email,
		ExpiresAt: now.Add(5 * time.Minute),
		Role:      role,
	}
	passwordResetMu.Unlock()

	if mailErr := sendEmail(email, "FeedForward password reset OTP", buildOTPEmailText(otp), buildOTPEmailHTML(otp)); mailErr != nil {
		return serverError(c, "failed to send OTP email", mailErr)
	}

	return success(c, fiber.StatusOK, map[string]any{"sent": true})
}

func VerifyResetOTP(c *fiber.Ctx) error {
	var req verifyResetOTPRequest
	if err := parseBody(c, &req); err != nil {
		return parseError(c, "invalid request body", err)
	}

	email := strings.ToLower(strings.TrimSpace(req.Email))
	otp := normalizeOTP(req.OTP)
	if email == "" || otp == "" {
		return invalidRequest(c, "email and OTP are required")
	}

	now := utcNow()
	passwordResetMu.Lock()
	cleanupExpiredResetTokens(now)
	entry, exists := passwordResetTokens[otp]
	if exists && entry.Email == email {
		delete(passwordResetTokens, otp)
	}
	passwordResetMu.Unlock()

	if !exists || entry.Email != email {
		return invalidRequest(c, "invalid or expired OTP")
	}

	verifiedResetMu.Lock()
	cleanupExpiredVerifiedResetEmails(now)
	verifiedResetEmails[resetKey(entry.Role, email)] = now.Add(10 * time.Minute)
	verifiedResetMu.Unlock()

	return success(c, fiber.StatusOK, map[string]any{
		"verified": true,
		"role":     entry.Role,
	})
}

func ResetPassword(c *fiber.Ctx) error {
	var req resetPasswordRequest
	if err := parseBody(c, &req); err != nil {
		return parseError(c, "invalid request body", err)
	}

	email := strings.ToLower(strings.TrimSpace(req.Email))
	newPassword := strings.TrimSpace(req.NewPassword)
	role := strings.ToLower(strings.TrimSpace(req.Role))
	if email == "" || newPassword == "" {
		return invalidRequest(c, "email and new password are required")
	}
	if len(newPassword) < 6 {
		return invalidRequest(c, "password must be at least 6 characters")
	}

	now := utcNow()
	verifiedResetMu.Lock()
	cleanupExpiredVerifiedResetEmails(now)
	if role == "" {
		userKey := resetKey("user", email)
		adminKey := resetKey("admin", email)
		userVerified := verifiedResetEmails[userKey]
		adminVerified := verifiedResetEmails[adminKey]
		if !userVerified.IsZero() && !adminVerified.IsZero() {
			verifiedResetMu.Unlock()
			return invalidRequest(c, "ambiguous reset request, please try again")
		}
		if !userVerified.IsZero() {
			role = "user"
			delete(verifiedResetEmails, userKey)
		}
		if !adminVerified.IsZero() {
			role = "admin"
			delete(verifiedResetEmails, adminKey)
		}
	} else {
		key := resetKey(role, email)
		if _, verified := verifiedResetEmails[key]; verified {
			delete(verifiedResetEmails, key)
		} else {
			role = ""
		}
	}
	verifiedResetMu.Unlock()

	if role == "" {
		return invalidRequest(c, "please verify OTP before resetting password")
	}

	hashed, err := hashPassword(newPassword)
	if err != nil {
		return serverError(c, "failed to process password", err)
	}

	if role == "admin" {
		if err := middleware.DBConn.Exec(
			`UPDATE `+adminTable+` SET password = ?, updated_at = ? WHERE LOWER(email) = LOWER(?)`,
			hashed, utcNow(), email,
		).Error; err != nil {
			return serverError(c, "failed to reset password", err)
		}
	} else {
		if err := middleware.DBConn.Exec(
			`UPDATE `+userTable+` SET password = ?, updated_at = ? WHERE LOWER(email) = LOWER(?)`,
			hashed, utcNow(), email,
		).Error; err != nil {
			return serverError(c, "failed to reset password", err)
		}
	}

	return success(c, fiber.StatusOK, map[string]any{"success": true})
}

func issueAdminSetPasswordToken(adminID string, email string) (string, error) {
	token, err := newSessionID()
	if err != nil {
		return "", err
	}
	now := utcNow()
	adminSetPasswordMu.Lock()
	cleanupExpiredAdminSetPasswordTokens(now)
	adminSetPasswordTokens[token] = adminSetPasswordEntry{
		AdminID:   adminID,
		Email:     email,
		ExpiresAt: now.Add(24 * time.Hour),
	}
	adminSetPasswordMu.Unlock()
	return token, nil
}

func sendAdminSetPasswordEmail(admin model.AdminModel, token string) error {
	name := strings.TrimSpace(admin.FirstName)
	if name == "" {
		name = strings.TrimSpace(admin.Name)
	}
	return sendEmail(
		strings.TrimSpace(admin.Email),
		"Set your FeedForward admin password",
		buildAdminSetPasswordEmailText(token),
		buildAdminSetPasswordEmailHTML(name, token),
	)
}

func SetAdminPassword(c *fiber.Ctx) error {
	var req struct {
		Token       string `json:"token"`
		NewPassword string `json:"newPassword"`
	}
	if err := parseBody(c, &req); err != nil {
		return parseError(c, "invalid request body", err)
	}

	token := strings.TrimSpace(req.Token)
	newPassword := strings.TrimSpace(req.NewPassword)
	if token == "" || newPassword == "" {
		return invalidRequest(c, "token and new password are required")
	}
	if len(newPassword) < 6 {
		return invalidRequest(c, "password must be at least 6 characters")
	}

	now := utcNow()
	adminSetPasswordMu.Lock()
	cleanupExpiredAdminSetPasswordTokens(now)
	entry, ok := adminSetPasswordTokens[token]
	if ok {
		delete(adminSetPasswordTokens, token)
	}
	adminSetPasswordMu.Unlock()
	if !ok {
		return invalidRequest(c, "invalid or expired token")
	}

	hashed, err := hashPassword(newPassword)
	if err != nil {
		return serverError(c, "failed to secure admin password", err)
	}

	if err := middleware.DBConn.Exec(
		`UPDATE `+adminTable+` SET password = ?, updated_at = ? WHERE id = ?`,
		hashed, utcNow(), entry.AdminID,
	).Error; err != nil {
		return serverError(c, "failed to set admin password", err)
	}

	return success(c, fiber.StatusOK, map[string]any{"success": true})
}
