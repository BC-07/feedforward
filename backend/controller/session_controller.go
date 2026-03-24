package controller

import (
	"FeedForward/backend/middleware"
	"FeedForward/backend/model/errors"
	"FeedForward/backend/model/response"

	"github.com/gofiber/fiber/v2"
)

func logoutByRole(c *fiber.Ctx, role string) error {
	sessionID := middleware.GetSessionIDFromCookies(c, role)
	middleware.DeleteSessionByID(c, role, sessionID)

	return c.Status(200).JSON(response.ResponseModel{
		RetCode: "200",
		Message: "Logout successful",
		Data:    map[string]any{"success": true},
	})
}

func LogoutUser(c *fiber.Ctx) error {
	return logoutByRole(c, middleware.SessionRoleUser)
}

func LogoutAdmin(c *fiber.Ctx) error {
	return logoutByRole(c, middleware.SessionRoleAdmin)
}

func LogoutSuperAdmin(c *fiber.Ctx) error {
	return logoutByRole(c, middleware.SessionRoleSuperAdmin)
}

func CurrentSession(c *fiber.Ctx) error {
	roles := []string{middleware.SessionRoleSuperAdmin, middleware.SessionRoleAdmin, middleware.SessionRoleUser}
	for _, role := range roles {
		sessionID := middleware.GetSessionIDFromCookies(c, role)
		if sessionID == "" {
			continue
		}

		session, err := middleware.GetActiveSessionByIDAndRole(sessionID, role)
		if err != nil {
			return c.Status(500).JSON(response.ResponseModel{
				RetCode: "500",
				Message: "Failed to fetch session",
				Data:    errors.ErrorModel{Message: "Failed to fetch session", IsSuccess: false, Error: err},
			})
		}
		if session == nil {
			middleware.DeleteSessionByID(c, role, sessionID)
			continue
		}

		middleware.TouchSession(sessionID)
		return c.Status(200).JSON(response.ResponseModel{
			RetCode: "200",
			Message: "Active session",
			Data:    session,
		})
	}

	return c.Status(401).JSON(response.ResponseModel{
		RetCode: "401",
		Message: "No active session",
		Data:    errors.ErrorModel{Message: "No active session", IsSuccess: false},
	})
}
