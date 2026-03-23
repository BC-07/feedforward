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
	if err := db.Table("public.users").Select("email").Where("LOWER(TRIM(email)) = ?", email).First(&user).Error; err != nil {
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

	otpBody := fmt.Sprintf(`
	<div style="font-family:Arial,Helvetica,sans-serif;line-height:1.6;color:#111827;">
	  <h2 style="margin:0 0 10px;">Reset your FeedForward password</h2>
	  <p style="margin:0 0 12px;">Use the 6-digit OTP below to reset your password. This OTP expires in 5 minutes.</p>
	  <div style="padding:12px 14px;border:1px solid #e5e7eb;border-radius:8px;background:#f9fafb;font-size:18px;font-weight:700;letter-spacing:.04em;word-break:break-all;">%s</div>
	  <p style="margin:12px 0 0;font-size:12px;color:#6b7280;">If you did not request this, you can ignore this email.</p>
	</div>
	`, token)

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

	return c.Status(200).JSON(response.ResponseModel{
		RetCode: "200",
		Message: "OTP verified",
		Data:    map[string]any{"verified": true},
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
