package controller

import (
	"intern_template_v1/middleware"
	"intern_template_v1/model"
	"strings"

	"github.com/gofiber/fiber/v2"
)

type feedbackMessagePayload struct {
	Message string `json:"message"`
}

func ListFeedbackMessages(c *fiber.Ctx) error {
	feedbackID := strings.TrimSpace(c.Params("id"))
	if feedbackID == "" {
		return invalidRequest(c, "feedback id is required")
	}

	feedback, err := fetchFeedbackByID(feedbackID)
	if err != nil {
		return serverError(c, "failed to load feedback", err)
	}
	if feedback.ID == "" {
		return notFound(c, "feedback not found", nil)
	}

	var messages []model.FeedbackMessageModel
	if err := middleware.DBConn.Raw(
		`SELECT id, feedback_id, sender_role, sender_id, sender_name, message, created_at
         FROM public.feedback_messages
         WHERE feedback_id = ?
         ORDER BY created_at ASC`,
		feedbackID,
	).Scan(&messages).Error; err != nil {
		return serverError(c, "failed to load feedback messages", err)
	}

	return success(c, fiber.StatusOK, messages)
}

func CreateFeedbackMessage(c *fiber.Ctx) error {
	feedbackID := strings.TrimSpace(c.Params("id"))
	if feedbackID == "" {
		return invalidRequest(c, "feedback id is required")
	}

	feedback, err := fetchFeedbackByID(feedbackID)
	if err != nil {
		return serverError(c, "failed to load feedback", err)
	}
	if feedback.ID == "" {
		return notFound(c, "feedback not found", nil)
	}

	var payload feedbackMessagePayload
	if err := parseBody(c, &payload); err != nil {
		return parseError(c, "failed to parse message", err)
	}

	message := strings.TrimSpace(payload.Message)
	if message == "" {
		return invalidRequest(c, "message is required")
	}

	sessionID := strings.TrimSpace(c.Cookies(sessionCookieName))
	senderRole := sessionRoleUser
	var senderID *string
	senderName := ""

	if sessionID == "" {
		if feedback.UserID != nil && strings.TrimSpace(*feedback.UserID) != "" && !feedback.IsAnonymous {
			return unauthorized(c, "session is required to reply to this feedback")
		}
		senderName = "Anonymous"
	} else {
		session, err := loadMessageSession(c)
		if err != nil {
			return err
		}
		senderRole = session.Role

		switch session.Role {
		case sessionRoleUser:
			if feedback.UserID == nil || strings.TrimSpace(*feedback.UserID) == "" {
				return unauthorized(c, "feedback ownership is required")
			}
			if session.UserID == nil || strings.TrimSpace(*session.UserID) != strings.TrimSpace(*feedback.UserID) {
				return unauthorized(c, "you can only reply to your own feedback")
			}
			senderID = session.UserID
			user, err := fetchUserByID(strings.TrimSpace(*session.UserID))
			if err != nil {
				return serverError(c, "failed to load user", err)
			}
			senderName = strings.TrimSpace(user.FirstName)
			if senderName == "" {
				senderName = strings.TrimSpace(user.Name)
			}
			if senderName == "" {
				senderName = "User"
			}
		case sessionRoleAdmin:
			if session.AdminID == nil || strings.TrimSpace(*session.AdminID) == "" {
				return unauthorized(c, "invalid admin session")
			}
			senderID = session.AdminID
			admin, err := fetchAdminByID(strings.TrimSpace(*session.AdminID))
			if err != nil {
				return serverError(c, "failed to load admin", err)
			}
			if admin.ID == "" {
				return unauthorized(c, "invalid admin session")
			}
			if admin.IsDisabled {
				return unauthorized(c, "admin account is disabled")
			}
			if !strings.EqualFold(strings.TrimSpace(admin.Unit), strings.TrimSpace(feedback.Category)) {
				return unauthorized(c, "admin is not assigned to this feedback category")
			}
			senderName = strings.TrimSpace(admin.FirstName)
			if senderName == "" {
				senderName = strings.TrimSpace(admin.Name)
			}
			if senderName == "" {
				senderName = "Admin"
			}
		case sessionRoleSuperAdmin:
			senderID = session.AdminID
			if session.AdminID != nil && strings.TrimSpace(*session.AdminID) != "" {
				admin, err := fetchAdminByID(strings.TrimSpace(*session.AdminID))
				if err != nil {
					return serverError(c, "failed to load superadmin", err)
				}
				if admin.ID != "" {
					senderName = strings.TrimSpace(admin.FirstName)
					if senderName == "" {
						senderName = strings.TrimSpace(admin.Name)
					}
				}
			}
			if senderName == "" && session.SuperAdminUsername != nil {
				senderName = strings.TrimSpace(*session.SuperAdminUsername)
			}
			if senderName == "" {
				senderName = "Superadmin"
			}
		default:
			return unauthorized(c, "invalid session")
		}
	}

	messageID, err := newSessionID()
	if err != nil {
		return serverError(c, "failed to create message", err)
	}

	now := utcNow()
	record := model.FeedbackMessageModel{
		ID:         messageID,
		FeedbackID: feedbackID,
		SenderRole: senderRole,
		SenderID:   senderID,
		SenderName: senderName,
		Message:    message,
		CreatedAt:  now,
	}

	if err := middleware.DBConn.Exec(
		`INSERT INTO public.feedback_messages (id, feedback_id, sender_role, sender_id, sender_name, message, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
		record.ID,
		record.FeedbackID,
		record.SenderRole,
		record.SenderID,
		record.SenderName,
		record.Message,
		record.CreatedAt,
	).Error; err != nil {
		return serverError(c, "failed to save message", err)
	}

	_ = middleware.DBConn.Exec(
		`UPDATE `+feedbackTable+` SET updated_at = ? WHERE id = ?`,
		now, feedbackID,
	).Error

	return success(c, fiber.StatusCreated, record)
}

func loadMessageSession(c *fiber.Ctx) (sessionRecord, error) {
	sessionID := strings.TrimSpace(c.Cookies(sessionCookieName))
	if sessionID == "" {
		return sessionRecord{}, unauthorized(c, "session is required")
	}

	session, err := fetchSessionByID(sessionID)
	if err != nil {
		return sessionRecord{}, serverError(c, "failed to load session", err)
	}
	if session.ID == "" {
		return sessionRecord{}, unauthorized(c, "invalid session")
	}

	now := utcNow()
	if now.After(session.ExpiresAt) {
		deleteSessionByID(session.ID)
		clearSessionCookie(c)
		return sessionRecord{}, unauthorized(c, "session expired")
	}
	if session.Role == sessionRoleSuperAdmin && now.Sub(session.LastActivityAt) >= superAdminIdleTimeout {
		deleteSessionByID(session.ID)
		clearSessionCookie(c)
		return sessionRecord{}, unauthorized(c, "session expired")
	}

	switch session.Role {
	case sessionRoleAdmin:
		return requireAdminSession(c)
	case sessionRoleSuperAdmin:
		return requireSuperAdminSession(c)
	case sessionRoleUser:
		return requireUserSession(c)
	default:
		return sessionRecord{}, unauthorized(c, "invalid session")
	}
}
