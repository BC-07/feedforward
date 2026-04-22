package controller

import (
	"crypto/rand"
	"fmt"
	"html"
	"math/big"
	"strings"
	"sync"
	"time"
	"unicode"

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

func normalizeOTP(raw string) string {
	clean := strings.Map(func(r rune) rune {
		if unicode.IsDigit(r) || unicode.IsLetter(r) {
			return r
		}
		return -1
	}, raw)

	return strings.TrimSpace(clean)
}

func buildOTPEmailHTML(title string, greetingName string, intro string, buttonText string, buttonURL string, otp string, note string) string {
	greeting := "Hello"
	name := strings.TrimSpace(greetingName)
	if name != "" {
		greeting = fmt.Sprintf("Hello %s", html.EscapeString(name))
	}

	return fmt.Sprintf(`
	<div style="background:#f3f4f6;padding:24px;font-family:Arial,Helvetica,sans-serif;">
	  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;">
	    <div style="background:#f59e0b;padding:18px 20px;color:#111827;">
	      <div style="font-size:15px;font-weight:800;letter-spacing:.04em;">FEED FORWARD</div>
	      <div style="font-size:11px;margin-top:2px;">SMART. FAST. SAFE.</div>
	    </div>

	    <div style="padding:18px 20px;">
	      <div style="font-size:22px;font-weight:700;color:#111827;">%s</div>
	      <div style="font-size:13px;color:#4b5563;margin-top:8px;">%s.</div>
	      <div style="font-size:13px;color:#4b5563;margin-top:8px;line-height:1.6;">%s</div>

	      <table style="width:100%%;margin-top:18px;border-collapse:collapse;">
	        <tr>
	          <td style="width:36%%;padding:8px 0;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.08em;">One-time password</td>
	          <td style="padding:8px 0;font-size:22px;color:#111827;font-weight:800;letter-spacing:.08em;">%s</td>
	        </tr>
	        <tr>
	          <td style="padding:8px 0;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.08em;">Expires</td>
	          <td style="padding:8px 0;font-size:13px;color:#111827;">5 minutes</td>
	        </tr>
	      </table>

	      <div style="margin-top:18px;">
	        <a href="%s" style="display:inline-block;background:#f59e0b;color:#111827;text-decoration:none;font-size:12px;font-weight:700;padding:10px 14px;border-radius:6px;">%s</a>
	      </div>

	      <div style="margin-top:16px;font-size:11px;color:#6b7280;">%s</div>
	      <div style="margin-top:16px;font-size:11px;color:#9ca3af;">Thank you,<br/>FeedForward</div>
	    </div>
	  </div>
	</div>
	`,
		html.EscapeString(title),
		greeting,
		html.EscapeString(intro),
		html.EscapeString(otp),
		html.EscapeString(buttonURL),
		html.EscapeString(buttonText),
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
		return c.Status(404).JSON(response.ResponseModel{
			RetCode: "404",
			Message: "Account not found",
			Data:    errors.ErrorModel{Message: "No registered account found for this email", IsSuccess: false},
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
	otp := normalizeOTP(req.OTP)

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
