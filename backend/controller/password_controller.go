package controller

import (
	"crypto/rand"
	"fmt"
	"html"
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

func cleanupExpiredVerifiedResetEmails(now time.Time) {
	for email, expiresAt := range verifiedResetEmails {
		if now.After(expiresAt) {
			delete(verifiedResetEmails, email)
		}
	}
}

func generateSecureToken() (string, error) {
	n, err := rand.Int(rand.Reader, big.NewInt(1000000))
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%06d", n.Int64()), nil
}

func cleanupExpiredResetTokens(now time.Time) {
	for token, entry := range passwordResetTokens {
		if now.After(entry.ExpiresAt) {
			delete(passwordResetTokens, token)
		}
	}
}

func formatOTPDisplay(otp string) string {
	parts := make([]string, 0, len(otp))
	for _, char := range otp {
		parts = append(parts, string(char))
	}
	return strings.Join(parts, "&nbsp;&nbsp;&nbsp;")
}

func buildOTPEmailHTML(title string, greetingName string, intro string, buttonText string, buttonURL string, otp string, note string) string {
	greeting := "Hello,"
	name := strings.TrimSpace(greetingName)
	if name != "" {
		greeting = fmt.Sprintf("Hello %s,", html.EscapeString(name))
	}

	return fmt.Sprintf(`
	<div style="background:#f3f4f6;padding:24px;font-family:Arial,Helvetica,sans-serif;">
	  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:10px;border:1px solid #e5e7eb;overflow:hidden;">
	    <div style="padding:26px 24px 22px;text-align:center;">
	      <div style="font-size:42px;line-height:1;color:#f59e0b;">&#128274;</div>
	      <div style="margin-top:14px;font-size:32px;font-weight:300;color:#1f2937;">%s</div>
	      <div style="margin-top:18px;font-size:22px;color:#374151;">%s</div>
	      <div style="margin-top:8px;font-size:17px;color:#4b5563;line-height:1.5;">%s</div>

	      <div style="margin-top:20px;">
	        <a href="%s" style="display:inline-block;background:#c9474d;color:#ffffff;text-decoration:none;font-size:30px;font-weight:700;padding:16px 38px;border-radius:6px;">%s</a>
	      </div>

	      <div style="margin-top:26px;font-size:18px;color:#4b5563;line-height:1.5;">Or, copy and paste this OTP in FeedForward.</div>
	      <div style="margin-top:16px;font-size:42px;font-weight:700;letter-spacing:.32em;color:#111827;">%s</div>

	      <div style="margin-top:24px;font-size:16px;color:#6b7280;line-height:1.5;">%s</div>
	    </div>
	  </div>
	</div>
	`,
		html.EscapeString(title),
		greeting,
		html.EscapeString(intro),
		html.EscapeString(buttonURL),
		html.EscapeString(buttonText),
		formatOTPDisplay(html.EscapeString(otp)),
		html.EscapeString(note),
	)
}

func ForgotPassword(c *fiber.Ctx) error {
	db := middleware.DBConn

	var req model.ForgotPasswordRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(response.ResponseModel{
			RetCode: "400",
			Message: status.RetCode400,
			Data:    errors.ErrorModel{Message: "Invalid request body", IsSuccess: false, Error: err},
		})
	}

	email := strings.TrimSpace(strings.ToLower(req.Email))
	if email == "" {
		return c.Status(400).JSON(response.ResponseModel{
			RetCode: "400",
			Message: status.RetCode400,
			Data:    errors.ErrorModel{Message: "Email is required", IsSuccess: false},
		})
	}

	var user model.User
	if err := db.Table("public.users").Select("email, first_name, last_name, name").Where("LOWER(TRIM(email)) = ?", email).First(&user).Error; err != nil {
		return c.Status(200).JSON(response.ResponseModel{
			RetCode: "200",
			Message: "If this email is registered, an OTP has been sent",
			Data:    map[string]any{"sent": true},
		})
	}

	token, tokenErr := generateSecureToken()
	if tokenErr != nil {
		return c.Status(500).JSON(response.ResponseModel{
			RetCode: "500",
			Message: status.RetCode500,
			Data:    errors.ErrorModel{Message: "Failed to generate OTP", IsSuccess: false, Error: tokenErr},
		})
	}

	now := time.Now()
	passwordResetMu.Lock()
	cleanupExpiredResetTokens(now)
	passwordResetTokens[token] = passwordResetEntry{
		Email:     email,
		ExpiresAt: now.Add(5 * time.Minute),
	}
	passwordResetMu.Unlock()

	userName := strings.TrimSpace(user.Name)
	if userName == "" {
		userName = strings.TrimSpace(user.FirstName + " " + user.LastName)
	}

	otpBody := buildOTPEmailHTML(
		"Confirm it's you",
		userName,
		"Use the button below or copy the code to continue resetting your password. This OTP expires in 5 minutes.",
		"Confirm email",
		fmt.Sprintf("%s/login", getTrackBaseURL()),
		token,
		"If you did not request a password reset, ignore this email.",
	)

	if mailErr := SendHTMLEmail(email, "FeedForward password reset OTP", otpBody); mailErr != nil {
		return c.Status(500).JSON(response.ResponseModel{
			RetCode: "500",
			Message: status.RetCode500,
			Data:    errors.ErrorModel{Message: "Failed to send OTP email", IsSuccess: false, Error: mailErr},
		})
	}

	return c.Status(200).JSON(response.ResponseModel{
		RetCode: "200",
		Message: "If this email is registered, an OTP has been sent",
		Data:    map[string]any{"sent": true},
	})
}

func VerifyResetOTP(c *fiber.Ctx) error {
	db := middleware.DBConn

	var req model.VerifyResetOTPRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(response.ResponseModel{
			RetCode: "400",
			Message: status.RetCode400,
			Data:    errors.ErrorModel{Message: "Invalid request body", IsSuccess: false, Error: err},
		})
	}

	email := strings.ToLower(strings.TrimSpace(req.Email))
	otp := strings.TrimSpace(req.OTP)

	if email == "" || otp == "" {
		return c.Status(400).JSON(response.ResponseModel{
			RetCode: "400",
			Message: status.RetCode400,
			Data:    errors.ErrorModel{Message: "Email and OTP are required", IsSuccess: false},
		})
	}

	now := time.Now()
	passwordResetMu.Lock()
	cleanupExpiredResetTokens(now)
	entry, exists := passwordResetTokens[otp]
	if exists && entry.Email == email {
		delete(passwordResetTokens, otp)
	}
	passwordResetMu.Unlock()

	if !exists || entry.Email != email {
		return c.Status(400).JSON(response.ResponseModel{
			RetCode: "400",
			Message: status.RetCode400,
			Data:    errors.ErrorModel{Message: "Invalid or expired OTP", IsSuccess: false},
		})
	}

	verifiedResetMu.Lock()
	cleanupExpiredVerifiedResetEmails(now)
	verifiedResetEmails[email] = now.Add(10 * time.Minute)
	verifiedResetMu.Unlock()

	var user model.User
	if err := db.Table("public.users").Where("LOWER(TRIM(email)) = ?", email).First(&user).Error; err != nil {
		return c.Status(404).JSON(response.ResponseModel{
			RetCode: "404",
			Message: "User not found",
			Data:    errors.ErrorModel{Message: "No user found for this email", IsSuccess: false},
		})
	}

	name := strings.TrimSpace(user.Name)
	if name == "" {
		name = strings.TrimSpace(user.FirstName + " " + user.LastName)
	}

	userID := user.ID
	session, sessionErr := middleware.CreateSession(c, middleware.SessionRoleUser, &userID, nil, nil, 7*24*time.Hour, nil)
	if sessionErr != nil {
		return c.Status(500).JSON(response.ResponseModel{
			RetCode: "500",
			Message: status.RetCode500,
			Data:    errors.ErrorModel{Message: "Failed to create session", IsSuccess: false, Error: sessionErr},
		})
	}

	return c.Status(200).JSON(response.ResponseModel{
		RetCode: "200",
		Message: "OTP verified. Login successful",
		Data: map[string]any{
			"verified":  true,
			"id":        user.ID,
			"name":      name,
			"email":     strings.ToLower(strings.TrimSpace(user.Email)),
			"sessionId": session.ID,
		},
	})
}

func ResetPassword(c *fiber.Ctx) error {
	db := middleware.DBConn

	var req model.ResetPasswordRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(response.ResponseModel{
			RetCode: "400",
			Message: status.RetCode400,
			Data:    errors.ErrorModel{Message: "Invalid request body", IsSuccess: false, Error: err},
		})
	}

	email := strings.ToLower(strings.TrimSpace(req.Email))
	newPassword := strings.TrimSpace(req.NewPassword)

	if email == "" || newPassword == "" {
		return c.Status(400).JSON(response.ResponseModel{
			RetCode: "400",
			Message: status.RetCode400,
			Data:    errors.ErrorModel{Message: "Email and new password are required", IsSuccess: false},
		})
	}
	if len(newPassword) < 6 {
		return c.Status(400).JSON(response.ResponseModel{
			RetCode: "400",
			Message: status.RetCode400,
			Data:    errors.ErrorModel{Message: "Password must be at least 6 characters", IsSuccess: false},
		})
	}

	now := time.Now()
	verifiedResetMu.Lock()
	cleanupExpiredVerifiedResetEmails(now)
	_, verified := verifiedResetEmails[email]
	if verified {
		delete(verifiedResetEmails, email)
	}
	verifiedResetMu.Unlock()

	if !verified {
		return c.Status(400).JSON(response.ResponseModel{
			RetCode: "400",
			Message: status.RetCode400,
			Data:    errors.ErrorModel{Message: "Please verify OTP before resetting password", IsSuccess: false},
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
			Data:    errors.ErrorModel{Message: "Failed to reset password", IsSuccess: false, Error: err},
		})
	}

	return c.Status(200).JSON(response.ResponseModel{
		RetCode: "200",
		Message: "Password reset successful",
		Data:    map[string]any{"success": true},
	})
}
