package controller

import (
	"crypto/rand"
	"fmt"
	"math/big"
	"strings"
	"sync"
	"time"

	"intern_template_v1/middleware"

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
}

type passwordResetEntry struct {
	Email     string
	ExpiresAt time.Time
}

var (
	passwordResetTokens = map[string]passwordResetEntry{}
	passwordResetMu     sync.Mutex
	verifiedResetEmails = map[string]time.Time{}
	verifiedResetMu     sync.Mutex
)

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

func buildOTPEmailHTML(otp string) string {
	content := fmt.Sprintf(
		`<p style="margin:0 0 12px 0;font-size:15px;line-height:22px;color:#111827;">We received a request to reset your password.</p>
<p style="margin:0 0 16px 0;font-size:15px;line-height:22px;color:#111827;">Use this one-time password (OTP) to continue:</p>
<div style="margin:16px 0;padding:14px 16px;border-radius:12px;background:#fff3e0;display:inline-block;font-size:24px;font-weight:700;letter-spacing:0.3em;color:#111827;">%s</div>
<p style="margin:16px 0 0 0;font-size:13px;line-height:20px;color:#6b7280;">This OTP expires in 5 minutes. If you did not request this, you can ignore this email.</p>`,
		otp,
	)

	if url := loginPortalURL(); url != "" {
		content += primaryButton("Go to login", url)
	}

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

func ForgotPassword(c *fiber.Ctx) error {
	var req forgotPasswordRequest
	if err := parseBody(c, &req); err != nil {
		return parseError(c, "invalid request body", err)
	}

	email := strings.ToLower(strings.TrimSpace(req.Email))
	if email == "" {
		return invalidRequest(c, "email is required")
	}

	user, err := fetchUserByEmail(email)
	if err != nil || strings.TrimSpace(user.ID) == "" {
		return success(c, fiber.StatusOK, map[string]any{"sent": true})
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
	otp := strings.TrimSpace(req.OTP)
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
	verifiedResetEmails[email] = now.Add(10 * time.Minute)
	verifiedResetMu.Unlock()

	user, err := fetchUserByEmail(email)
	if err != nil || strings.TrimSpace(user.ID) == "" {
		return notFound(c, "user not found", err)
	}

	session, err := createSession(sessionRoleUser, &user.ID, nil, nil, userSessionTTL)
	if err != nil {
		return serverError(c, "failed to create session", err)
	}
	setSessionCookie(c, session)

	return success(c, fiber.StatusOK, map[string]any{
		"verified": true,
		"id":       user.ID,
		"name":     strings.TrimSpace(user.Name),
		"email":    strings.ToLower(strings.TrimSpace(user.Email)),
	})
}

func ResetPassword(c *fiber.Ctx) error {
	var req resetPasswordRequest
	if err := parseBody(c, &req); err != nil {
		return parseError(c, "invalid request body", err)
	}

	email := strings.ToLower(strings.TrimSpace(req.Email))
	newPassword := strings.TrimSpace(req.NewPassword)
	if email == "" || newPassword == "" {
		return invalidRequest(c, "email and new password are required")
	}
	if len(newPassword) < 6 {
		return invalidRequest(c, "password must be at least 6 characters")
	}

	now := utcNow()
	verifiedResetMu.Lock()
	cleanupExpiredVerifiedResetEmails(now)
	_, verified := verifiedResetEmails[email]
	if verified {
		delete(verifiedResetEmails, email)
	}
	verifiedResetMu.Unlock()

	if !verified {
		return invalidRequest(c, "please verify OTP before resetting password")
	}

	hashed, err := hashPassword(newPassword)
	if err != nil {
		return serverError(c, "failed to process password", err)
	}

	if err := middleware.DBConn.Exec(
		`UPDATE `+userTable+` SET password = ?, updated_at = ? WHERE LOWER(email) = LOWER(?)`,
		hashed, utcNow(), email,
	).Error; err != nil {
		return serverError(c, "failed to reset password", err)
	}

	return success(c, fiber.StatusOK, map[string]any{"success": true})
}
