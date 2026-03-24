package middleware

import (
	"fmt"
	"strings"
	"time"

	"FeedForward/backend/model"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

const (
	SessionRoleUser       = "user"
	SessionRoleAdmin      = "admin"
	SessionRoleSuperAdmin = "superadmin"
)

func sessionCookieName(role string) string {
	switch strings.ToLower(strings.TrimSpace(role)) {
	case SessionRoleUser:
		return "ff_user_session"
	case SessionRoleAdmin:
		return "ff_admin_session"
	case SessionRoleSuperAdmin:
		return "ff_superadmin_session"
	default:
		return "ff_user_session"
	}
}

func clearSessionCookies(c *fiber.Ctx) {
	cookieNames := []string{"ff_user_session", "ff_admin_session", "ff_superadmin_session"}
	for _, cookieName := range cookieNames {
		c.Cookie(&fiber.Cookie{
			Name:     cookieName,
			Value:    "",
			Path:     "/",
			HTTPOnly: true,
			SameSite: "Lax",
			Secure:   false,
			MaxAge:   -1,
		})
	}
}

func CleanupExpiredSessions() {
	now := time.Now().UTC()
	_ = DBConn.Table("public.sessions").Where("expires_at <= ?", now).Delete(&model.Session{}).Error
}

func CreateSession(c *fiber.Ctx, role string, userID, adminID, superadminUsername *string, ttl time.Duration, reauthTTL *time.Duration) (*model.Session, error) {
	if ttl <= 0 {
		ttl = 7 * 24 * time.Hour
	}

	CleanupExpiredSessions()

	now := time.Now().UTC()
	expiresAt := now.Add(ttl)
	sessionID := strings.ReplaceAll(fmt.Sprintf("SESS-%s", uuid.NewString()), "-", "")
	if len(sessionID) > 64 {
		sessionID = sessionID[:64]
	}

	var reauthExpiresAt *time.Time
	if reauthTTL != nil {
		candidate := now.Add(*reauthTTL)
		reauthExpiresAt = &candidate
	}

	session := model.Session{
		ID:             sessionID,
		Role:           strings.ToLower(strings.TrimSpace(role)),
		UserID:         userID,
		AdminID:        adminID,
		CreatedAt:      now.Format(time.RFC3339),
		LastActivityAt: now.Format(time.RFC3339),
		ExpiresAt:      expiresAt.Format(time.RFC3339),
	}
	if superadminUsername != nil {
		session.SuperadminUsername = superadminUsername
	}
	if reauthExpiresAt != nil {
		reauth := reauthExpiresAt.Format(time.RFC3339)
		session.ReauthExpiresAt = &reauth
	}

	if err := DBConn.Table("public.sessions").Create(&session).Error; err != nil {
		return nil, err
	}

	clearSessionCookies(c)
	c.Cookie(&fiber.Cookie{
		Name:     sessionCookieName(role),
		Value:    sessionID,
		Path:     "/",
		HTTPOnly: true,
		SameSite: "Lax",
		Secure:   false,
		MaxAge:   int(ttl.Seconds()),
	})

	return &session, nil
}

func GetSessionIDFromCookies(c *fiber.Ctx, role string) string {
	return strings.TrimSpace(c.Cookies(sessionCookieName(role)))
}

func GetActiveSessionByID(sessionID string) (*model.Session, error) {
	now := time.Now().UTC()
	var session model.Session
	result := DBConn.Table("public.sessions").Where("id = ? AND expires_at > ?", sessionID, now).Limit(1).Find(&session)
	if result.Error != nil {
		return nil, result.Error
	}
	if result.RowsAffected == 0 {
		return nil, nil
	}
	return &session, nil
}

func GetActiveSessionByIDAndRole(sessionID string, role string) (*model.Session, error) {
	now := time.Now().UTC()
	var session model.Session
	result := DBConn.Table("public.sessions").Where("id = ? AND role = ? AND expires_at > ?", sessionID, strings.ToLower(strings.TrimSpace(role)), now).Limit(1).Find(&session)
	if result.Error != nil {
		return nil, result.Error
	}
	if result.RowsAffected == 0 {
		return nil, nil
	}
	return &session, nil
}

func TouchSession(sessionID string) {
	if strings.TrimSpace(sessionID) == "" {
		return
	}
	now := time.Now().UTC()
	_ = DBConn.Table("public.sessions").Where("id = ?", sessionID).Update("last_activity_at", now).Error
}

func DeleteSessionByID(c *fiber.Ctx, role string, sessionID string) {
	if strings.TrimSpace(sessionID) != "" {
		_ = DBConn.Table("public.sessions").Where("id = ?", sessionID).Delete(&model.Session{}).Error
	}

	c.Cookie(&fiber.Cookie{
		Name:     sessionCookieName(role),
		Value:    "",
		Path:     "/",
		HTTPOnly: true,
		SameSite: "Lax",
		Secure:   false,
		MaxAge:   -1,
	})
}
