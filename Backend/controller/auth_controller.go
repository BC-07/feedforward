package controller

import (
	"fmt"
	"intern_template_v1/middleware"
	"intern_template_v1/model"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
)

func RegisterUser(c *fiber.Ctx) error {
	db := middleware.DBConn

	//Storage preparation
	var payload model.UserModel

	//validating user input in json
	if err := parseBody(c, &payload); err != nil {
		return parseError(c, "failed to parse user", err)
	}

	payload.FirstName = strings.TrimSpace(payload.FirstName)
	payload.LastName = strings.TrimSpace(payload.LastName)
	payload.Email = strings.TrimSpace(payload.Email)
	payload.Password = strings.TrimSpace(payload.Password)
	if payload.FirstName == "" || payload.LastName == "" || payload.Email == "" || payload.Password == "" {
		return invalidRequest(c, "missing required user fields")
	}

	inUse, err := emailInUse(payload.Email, "", "")
	if err != nil {
		return serverError(c, "failed to validate email", err)
	}
	if inUse {
		return invalidRequest(c, "email is already in use")
	}

	payload.ID = "USER-" + fmt.Sprintf("%d", time.Now().UnixMilli())
	now := utcNow()
	if err := db.Exec(
		`INSERT INTO `+userTable+` (id, first_name, last_name, email, password, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?)`,
		payload.ID, payload.FirstName, payload.LastName, payload.Email, payload.Password, now, now,
	).Error; err != nil {
		return serverError(c, "failed to register user", err)
	}

	user, err := fetchUserByID(payload.ID)
	if err != nil {
		return serverError(c, "failed to fetch user", err)
	}
	return success(c, fiber.StatusCreated, user)
}

func RegisterAdmin(c *fiber.Ctx) error {
	db := middleware.DBConn
	if err := ensureAdminDisableColumn(); err != nil {
		return serverError(c, "failed to initialize admin access state", err)
	}

	//Storage preparation
	var payload model.AdminModel

	//validating user input in json
	if err := parseBody(c, &payload); err != nil {
		return parseError(c, "failed to parse admin", err)
	}

	payload.FirstName = strings.TrimSpace(payload.FirstName)
	payload.LastName = strings.TrimSpace(payload.LastName)
	payload.Email = strings.TrimSpace(payload.Email)
	payload.Password = strings.TrimSpace(payload.Password)
	payload.Unit = strings.TrimSpace(payload.Unit)
	if payload.FirstName == "" || payload.LastName == "" || payload.Email == "" || payload.Password == "" || payload.Unit == "" {
		return invalidRequest(c, "missing required admin fields")
	}

	inUse, err := emailInUse(payload.Email, "", "")
	if err != nil {
		return serverError(c, "failed to validate email", err)
	}
	if inUse {
		return invalidRequest(c, "email is already in use")
	}

	unitExists, err := categoryExists(payload.Unit)
	if err != nil {
		return serverError(c, "failed to validate admin unit", err)
	}
	if !unitExists {
		return invalidRequest(c, "invalid admin unit")
	}

	payload.ID = "ADMIN-" + fmt.Sprintf("%d", time.Now().UnixMilli())
	now := utcNow()
	if err := db.Exec(
		`INSERT INTO `+adminTable+` (id, first_name, last_name, email, password, unit, is_disabled, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		payload.ID, payload.FirstName, payload.LastName, payload.Email, payload.Password, payload.Unit, false, now, now,
	).Error; err != nil {
		return serverError(c, "failed to register admin", err)
	}

	admin, err := fetchAdminByID(payload.ID)
	if err != nil {
		return serverError(c, "failed to fetch admin", err)
	}
	return success(c, fiber.StatusCreated, admin)
}

func LoginUser(c *fiber.Ctx) error {
	//Storage preparation
	var payload struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}

	//validating user input in json
	if err := parseBody(c, &payload); err != nil {
		return parseError(c, "failed to parse login", err)
	}

	var user model.UserModel
	if err := middleware.DBConn.Raw(
		`SELECT id, first_name, last_name, first_name || ' ' || last_name AS name, email, created_at, updated_at
		FROM `+userTable+` WHERE email = ? AND password = ?`,
		strings.TrimSpace(payload.Email),
		strings.TrimSpace(payload.Password),
	).Scan(&user).Error; err != nil {
		return serverError(c, "failed to login user", err)
	}
	if user.ID == "" {
		return unauthorized(c, "invalid email or password")
	}

	session, err := createSession(sessionRoleUser, &user.ID, nil, nil, userSessionTTL)
	if err != nil {
		return serverError(c, "failed to create user session", err)
	}
	setSessionCookie(c, session)

	return success(c, fiber.StatusOK, user)
}

func LoginAdmin(c *fiber.Ctx) error {
	if err := ensureAdminDisableColumn(); err != nil {
		return serverError(c, "failed to initialize admin access state", err)
	}

	//Storage preparation
	var payload struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}

	//validating user input in json
	if err := parseBody(c, &payload); err != nil {
		return parseError(c, "failed to parse login", err)
	}

	var admin model.AdminModel
	if err := middleware.DBConn.Raw(
		`SELECT id, first_name, last_name, first_name || ' ' || last_name AS name, email, unit, COALESCE(is_disabled, FALSE) AS is_disabled, created_at, updated_at
		FROM `+adminTable+` WHERE email = ? AND password = ?`,
		strings.TrimSpace(payload.Email),
		strings.TrimSpace(payload.Password),
	).Scan(&admin).Error; err != nil {
		return serverError(c, "failed to login admin", err)
	}
	if admin.ID == "" {
		return unauthorized(c, "invalid email or password")
	}
	if admin.IsDisabled {
		return unauthorized(c, "admin account is disabled")
	}

	session, err := createSession(sessionRoleAdmin, nil, &admin.ID, nil, adminSessionTTL)
	if err != nil {
		return serverError(c, "failed to create admin session", err)
	}
	setSessionCookie(c, session)

	return success(c, fiber.StatusOK, admin)
}

func LoginSuperAdmin(c *fiber.Ctx) error {
	var payload struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}

	if err := parseBody(c, &payload); err != nil {
		return parseError(c, "failed to parse superadmin login", err)
	}

	if strings.TrimSpace(payload.Username) != superAdminUsername() || strings.TrimSpace(payload.Password) != superAdminPassword() {
		return unauthorized(c, "invalid superadmin credentials")
	}

	username := superAdminUsername()
	session, err := createSession(sessionRoleSuperAdmin, nil, nil, &username, superAdminTTL)
	if err != nil {
		return serverError(c, "failed to create superadmin session", err)
	}
	setSessionCookie(c, session)

	return success(c, fiber.StatusOK, superAdminSession{
		Username:  username,
		ExpiresAt: session.ExpiresAt,
	})
}

func Logout(c *fiber.Ctx) error {
	sessionID := strings.TrimSpace(c.Cookies(sessionCookieName))
	if sessionID != "" {
		deleteSessionByID(sessionID)
	}
	clearSessionCookie(c)
	return success(c, fiber.StatusOK, map[string]string{"message": "logged out"})
}

func ReverifyAdmin(c *fiber.Ctx) error {
	session, err := requireAdminSession(c)
	if err != nil {
		return err
	}
	var payload struct {
		Password string `json:"password"`
	}
	if err := parseBody(c, &payload); err != nil {
		return parseError(c, "failed to parse reverify request", err)
	}
	password := strings.TrimSpace(payload.Password)
	if password == "" {
		return invalidRequest(c, "password is required")
	}

	adminID := ""
	if session.AdminID != nil {
		adminID = strings.TrimSpace(*session.AdminID)
	}
	var credential struct {
		Password string `json:"password"`
	}
	if err := middleware.DBConn.Raw(
		`SELECT password FROM `+adminTable+` WHERE id = ?`,
		adminID,
	).Scan(&credential).Error; err != nil {
		return serverError(c, "failed to load admin credentials", err)
	}
	if strings.TrimSpace(credential.Password) == "" {
		return unauthorized(c, "invalid admin session")
	}
	if strings.TrimSpace(credential.Password) != password {
		return unauthorized(c, "invalid credentials")
	}

	expiresAt := utcNow().Add(reauthTTL)
	if err := middleware.DBConn.Exec(
		`UPDATE `+sessionTable+` SET reauth_expires_at = ? WHERE id = ?`,
		expiresAt, session.ID,
	).Error; err != nil {
		return serverError(c, "failed to update reauth session", err)
	}

	return success(c, fiber.StatusOK, map[string]string{"expiresAt": expiresAt.Format(time.RFC3339)})
}

func ReverifySuperAdmin(c *fiber.Ctx) error {
	session, err := requireSuperAdminSession(c)
	if err != nil {
		return err
	}
	var payload struct {
		Password string `json:"password"`
	}
	if err := parseBody(c, &payload); err != nil {
		return parseError(c, "failed to parse reverify request", err)
	}
	if strings.TrimSpace(payload.Password) != superAdminPassword() {
		return unauthorized(c, "invalid credentials")
	}

	expiresAt := utcNow().Add(reauthTTL)
	if err := middleware.DBConn.Exec(
		`UPDATE `+sessionTable+` SET reauth_expires_at = ? WHERE id = ?`,
		expiresAt, session.ID,
	).Error; err != nil {
		return serverError(c, "failed to update reauth session", err)
	}

	return success(c, fiber.StatusOK, map[string]string{"expiresAt": expiresAt.Format(time.RFC3339)})
}

func GetSessionInfo(c *fiber.Ctx) error {
	sessionID := strings.TrimSpace(c.Cookies(sessionCookieName))
	if sessionID == "" {
		return unauthorized(c, "session is required")
	}

	session, err := fetchSessionByID(sessionID)
	if err != nil {
		return serverError(c, "failed to load session", err)
	}
	if session.ID == "" {
		return unauthorized(c, "invalid session")
	}
	if utcNow().After(session.ExpiresAt) {
		deleteSessionByID(session.ID)
		clearSessionCookie(c)
		return unauthorized(c, "session expired")
	}

	return success(c, fiber.StatusOK, map[string]any{
		"role":    session.Role,
		"userId":  session.UserID,
		"adminId": session.AdminID,
	})
}
