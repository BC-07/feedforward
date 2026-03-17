package controller

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"intern_template_v1/middleware"
	"intern_template_v1/model"
	"intern_template_v1/model/errors"
	"intern_template_v1/model/response"
	"intern_template_v1/model/status"
	"os"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gofiber/fiber/v2"
)

var defaultCategoryNames = []string{
	"IT Unit",
	"Finance & Registrar Office",
	"Student Affair Office",
	"Guidance Office",
	"Faculty Office",
}

var validStatuses = map[string]bool{
	"Pending":     true,
	"In Progress": true,
	"Resolved":    true,
}

var validPriorities = map[string]bool{
	"Low":    true,
	"Medium": true,
	"High":   true,
}

const disabledCategoryName = "Disabled"

// Keep table names centralized so SQL changes stay in one place.
const (
	feedbackTable = "public.feedbacks"
	userTable     = "public.users"
	adminTable    = "public.admins"
	categoryTable = "public.categories"
	sessionTable  = "public.sessions"
	superAdminTTL = 8 * time.Hour
)

const (
	sessionCookieName        = "ff_session"
	userSessionTTL           = 7 * 24 * time.Hour
	adminSessionTTL          = 8 * time.Hour
	adminSessionIdleRotation = 5 * time.Minute
	reauthTTL                = 5 * time.Minute
	sessionRoleUser          = "user"
	sessionRoleAdmin         = "admin"
	sessionRoleSuperAdmin    = "superadmin"
)

const (
	defaultSuperAdminUsername = "superadmin"
	defaultSuperAdminPassword = "FeedForward-SuperAdmin"
	defaultSuperAdminSecret   = "feedforward-superadmin-secret"
)

type superAdminSession struct {
	Username  string    `json:"username"`
	ExpiresAt time.Time `json:"expiresAt"`
}

type sessionRecord struct {
	ID                 string     `json:"id"`
	Role               string     `json:"role"`
	UserID             *string    `json:"userId"`
	AdminID            *string    `json:"adminId"`
	SuperAdminUsername *string    `json:"superAdminUsername"`
	CreatedAt          time.Time  `json:"createdAt"`
	LastActivityAt     time.Time  `json:"lastActivityAt"`
	ExpiresAt          time.Time  `json:"expiresAt"`
	ReauthExpiresAt    *time.Time `json:"reauthExpiresAt"`
}

var categoryTableInit sync.Once
var categoryTableInitErr error
var adminDisableColumnInit sync.Once
var adminDisableColumnErr error
var adminSuperAdminColumnInit sync.Once
var adminSuperAdminColumnErr error
var feedbackEmailColumnInit sync.Once
var feedbackEmailColumnErr error
var sessionTableInit sync.Once
var sessionTableErr error

func fetchFeedbackByID(id string) (model.FeedbackModel, error) {
	if err := ensureFeedbackEmailColumn(); err != nil {
		return model.FeedbackModel{}, err
	}
	var feedback model.FeedbackModel
	// Select explicit columns so the API only depends on fields the frontend uses.
	err := middleware.DBConn.Raw(
		`SELECT id, type, category, subject, message, status, priority, user_id, user_name, user_email, is_anonymous, response, created_at, updated_at
		FROM `+feedbackTable+` WHERE id = ?`,
		id,
	).Scan(&feedback).Error
	return feedback, err
}

func fetchUserByID(id string) (model.UserModel, error) {
	var user model.UserModel
	// Compose the display name in SQL because the table stores first and last names separately.
	err := middleware.DBConn.Raw(
		`SELECT id, first_name, last_name, first_name || ' ' || last_name AS name, email, created_at, updated_at
		FROM `+userTable+` WHERE id = ?`,
		id,
	).Scan(&user).Error
	return user, err
}

func fetchUserByEmail(email string) (model.UserModel, error) {
	var user model.UserModel
	trimmed := strings.TrimSpace(email)
	if trimmed == "" {
		return user, nil
	}
	err := middleware.DBConn.Raw(
		`SELECT id, first_name, last_name, first_name || ' ' || last_name AS name, email, created_at, updated_at
		FROM `+userTable+` WHERE LOWER(email) = LOWER(?)`,
		trimmed,
	).Scan(&user).Error
	return user, err
}

func fetchAdminByID(id string) (model.AdminModel, error) {
	if err := ensureAdminDisableColumn(); err != nil {
		return model.AdminModel{}, err
	}
	if err := ensureAdminSuperAdminColumn(); err != nil {
		return model.AdminModel{}, err
	}

	var admin model.AdminModel
	// Compose the display name in SQL because the table stores first and last names separately.
	err := middleware.DBConn.Raw(
		`SELECT id, first_name, last_name, first_name || ' ' || last_name AS name, email, unit, COALESCE(is_disabled, FALSE) AS is_disabled, COALESCE(is_superadmin, FALSE) AS is_superadmin, created_at, updated_at
		FROM `+adminTable+` WHERE id = ?`,
		id,
	).Scan(&admin).Error
	return admin, err
}

func normalizeFeedback(feedback *model.FeedbackModel) error {
	// Normalize whitespace first so validation and inserts behave consistently.
	feedback.ID = strings.TrimSpace(feedback.ID)
	feedback.Type = strings.TrimSpace(feedback.Type)
	feedback.Category = strings.TrimSpace(feedback.Category)
	feedback.Subject = strings.TrimSpace(feedback.Subject)
	feedback.Message = strings.TrimSpace(feedback.Message)

	if feedback.ID == "" || feedback.Type == "" || feedback.Category == "" || feedback.Subject == "" || feedback.Message == "" {
		return fmt.Errorf("missing required fields")
	}
	if isDisabledCategory(feedback.Category) {
		return fmt.Errorf("invalid feedback category")
	}
	if feedback.Status == "" {
		feedback.Status = "Pending"
	}
	if feedback.Priority == "" {
		feedback.Priority = "Medium"
	}
	categoryOk, err := categoryExists(feedback.Category)
	if err != nil {
		return fmt.Errorf("failed to validate feedback category")
	}
	if !categoryOk {
		return fmt.Errorf("invalid feedback category")
	}
	if !validStatuses[feedback.Status] {
		return fmt.Errorf("invalid feedback status")
	}
	if !validPriorities[feedback.Priority] {
		return fmt.Errorf("invalid feedback priority")
	}
	if feedback.UserID != nil {
		// Validate the foreign key in the app layer to return a clearer message than Postgres would.
		trimmed := strings.TrimSpace(*feedback.UserID)
		if trimmed == "" {
			feedback.UserID = nil
		} else {
			user, err := fetchUserByID(trimmed)
			if err != nil {
				return fmt.Errorf("failed to validate feedback user")
			}
			if user.ID == "" {
				return fmt.Errorf("user account not found; please log in again")
			}
			feedback.UserID = &trimmed
		}
	}
	if feedback.UserName != nil {
		trimmed := strings.TrimSpace(*feedback.UserName)
		if trimmed == "" {
			feedback.UserName = nil
		} else {
			feedback.UserName = &trimmed
		}
	}
	if feedback.UserEmail != nil {
		trimmed := strings.TrimSpace(*feedback.UserEmail)
		if trimmed == "" {
			feedback.UserEmail = nil
		} else {
			feedback.UserEmail = &trimmed
		}
	}
	if feedback.Response != nil {
		trimmed := strings.TrimSpace(*feedback.Response)
		feedback.Response = &trimmed
	} else {
		// The live schema requires a non-null response value.
		empty := ""
		feedback.Response = &empty
	}

	return nil
}

func ensureCategoryStore() error {
	categoryTableInit.Do(func() {
		db := middleware.DBConn
		if err := ensureAdminSuperAdminColumn(); err != nil {
			categoryTableInitErr = err
			return
		}

		categoryTableInitErr = db.Exec(
			`CREATE TABLE IF NOT EXISTS ` + categoryTable + ` (
				id BIGSERIAL PRIMARY KEY,
				name VARCHAR(100) NOT NULL UNIQUE,
				created_at TIMESTAMP NOT NULL DEFAULT NOW(),
				updated_at TIMESTAMP NOT NULL DEFAULT NOW()
			)`,
		).Error
		if categoryTableInitErr != nil {
			return
		}

		for _, name := range defaultCategoryNames {
			if err := db.Exec(
				`INSERT INTO `+categoryTable+` (name) VALUES (?) ON CONFLICT (name) DO NOTHING`,
				name,
			).Error; err != nil {
				categoryTableInitErr = err
				return
			}
		}

		if err := db.Exec(
			`INSERT INTO ` + categoryTable + ` (name)
			 SELECT DISTINCT TRIM(unit) FROM ` + adminTable + `
			 WHERE unit IS NOT NULL AND TRIM(unit) <> '' AND COALESCE(is_superadmin, FALSE) = FALSE
			 ON CONFLICT (name) DO NOTHING`,
		).Error; err != nil {
			categoryTableInitErr = err
			return
		}

		if err := db.Exec(
			`INSERT INTO ` + categoryTable + ` (name)
			 SELECT DISTINCT TRIM(category) FROM ` + feedbackTable + `
			 WHERE category IS NOT NULL AND TRIM(category) <> ''
			 ON CONFLICT (name) DO NOTHING`,
		).Error; err != nil {
			categoryTableInitErr = err
		}
	})

	return categoryTableInitErr
}

func ensureDisabledCategory() error {
	if err := ensureCategoryStore(); err != nil {
		return err
	}
	return middleware.DBConn.Exec(
		`INSERT INTO `+categoryTable+` (name) VALUES (?) ON CONFLICT (name) DO NOTHING`,
		disabledCategoryName,
	).Error
}

func ensureAdminDisableColumn() error {
	adminDisableColumnInit.Do(func() {
		adminDisableColumnErr = middleware.DBConn.Exec(
			`ALTER TABLE ` + adminTable + ` ADD COLUMN IF NOT EXISTS is_disabled BOOLEAN NOT NULL DEFAULT FALSE`,
		).Error
	})
	return adminDisableColumnErr
}

func ensureAdminSuperAdminColumn() error {
	adminSuperAdminColumnInit.Do(func() {
		adminSuperAdminColumnErr = middleware.DBConn.Exec(
			`ALTER TABLE ` + adminTable + ` ADD COLUMN IF NOT EXISTS is_superadmin BOOLEAN NOT NULL DEFAULT FALSE`,
		).Error
	})
	return adminSuperAdminColumnErr
}

func ensureFeedbackEmailColumn() error {
	feedbackEmailColumnInit.Do(func() {
		db := middleware.DBConn
		if err := db.Exec(
			`ALTER TABLE ` + feedbackTable + ` ADD COLUMN IF NOT EXISTS user_email VARCHAR(255)`,
		).Error; err != nil {
			feedbackEmailColumnErr = err
			return
		}

		feedbackEmailColumnErr = db.Exec(
			`UPDATE `+feedbackTable+` f
			 SET user_email = u.email
			 FROM `+userTable+` u
			 WHERE f.user_id = u.id AND (f.user_email IS NULL OR f.user_email = '')`,
		).Error
	})
	return feedbackEmailColumnErr
}

func ensureSessionStore() error {
	sessionTableInit.Do(func() {
		db := middleware.DBConn
		sessionTableErr = db.Exec(
			`CREATE TABLE IF NOT EXISTS ` + sessionTable + ` (
				id VARCHAR(64) PRIMARY KEY,
				role VARCHAR(20) NOT NULL,
				user_id VARCHAR(64),
				admin_id VARCHAR(64),
				superadmin_username VARCHAR(120),
				created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
				last_activity_at TIMESTAMPTZ NOT NULL,
				expires_at TIMESTAMPTZ NOT NULL,
				reauth_expires_at TIMESTAMPTZ
			)`,
		).Error
		if sessionTableErr != nil {
			return
		}
		sessionTableErr = db.Exec(
			`CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON ` + sessionTable + ` (expires_at)`,
		).Error
	})
	return sessionTableErr
}

func newSessionID() (string, error) {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(bytes), nil
}

func createSession(role string, userID *string, adminID *string, superadminUsername *string, ttl time.Duration) (sessionRecord, error) {
	if err := ensureSessionStore(); err != nil {
		return sessionRecord{}, err
	}
	id, err := newSessionID()
	if err != nil {
		return sessionRecord{}, err
	}
	now := utcNow()
	expiresAt := now.Add(ttl)
	session := sessionRecord{
		ID:                 id,
		Role:               role,
		UserID:             userID,
		AdminID:            adminID,
		SuperAdminUsername: superadminUsername,
		CreatedAt:          now,
		LastActivityAt:     now,
		ExpiresAt:          expiresAt,
	}

	if err := middleware.DBConn.Exec(
		`INSERT INTO `+sessionTable+` (id, role, user_id, admin_id, superadmin_username, created_at, last_activity_at, expires_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		session.ID,
		session.Role,
		session.UserID,
		session.AdminID,
		session.SuperAdminUsername,
		session.CreatedAt,
		session.LastActivityAt,
		session.ExpiresAt,
	).Error; err != nil {
		return sessionRecord{}, err
	}

	return session, nil
}

func fetchSessionByID(id string) (sessionRecord, error) {
	if err := ensureSessionStore(); err != nil {
		return sessionRecord{}, err
	}
	var session sessionRecord
	err := middleware.DBConn.Raw(
		`SELECT id, role, user_id, admin_id, superadmin_username, created_at, last_activity_at, expires_at, reauth_expires_at
		 FROM `+sessionTable+` WHERE id = ?`,
		id,
	).Scan(&session).Error
	return session, err
}

func deleteSessionByID(id string) {
	if strings.TrimSpace(id) == "" {
		return
	}
	_ = middleware.DBConn.Exec(`DELETE FROM `+sessionTable+` WHERE id = ?`, id).Error
}

func setSessionCookie(c *fiber.Ctx, session sessionRecord) {
	c.Cookie(&fiber.Cookie{
		Name:     sessionCookieName,
		Value:    session.ID,
		HTTPOnly: true,
		Secure:   cookieSecure(),
		SameSite: "Lax",
		Expires:  session.ExpiresAt,
		Path:     "/",
	})
}

func clearSessionCookie(c *fiber.Ctx) {
	c.Cookie(&fiber.Cookie{
		Name:     sessionCookieName,
		Value:    "",
		HTTPOnly: true,
		Secure:   cookieSecure(),
		SameSite: "Lax",
		Expires:  time.Unix(0, 0),
		Path:     "/",
	})
}

func cookieSecure() bool {
	value := strings.ToLower(strings.TrimSpace(middleware.GetEnv("COOKIE_SECURE")))
	return value == "1" || value == "true" || value == "yes" || value == "on"
}

func requireSession(c *fiber.Ctx, role string, rotateOnIdle bool) (sessionRecord, error) {
	sessionID := strings.TrimSpace(c.Cookies(sessionCookieName))
	if sessionID == "" {
		return sessionRecord{}, unauthorized(c, "session is required")
	}

	session, err := fetchSessionByID(sessionID)
	if err != nil {
		return sessionRecord{}, serverError(c, "failed to load session", err)
	}
	if session.ID == "" || session.Role != role {
		return sessionRecord{}, unauthorized(c, "invalid session")
	}

	now := utcNow()
	if now.After(session.ExpiresAt) {
		deleteSessionByID(session.ID)
		clearSessionCookie(c)
		return sessionRecord{}, unauthorized(c, "session expired")
	}

	if rotateOnIdle && now.Sub(session.LastActivityAt) >= adminSessionIdleRotation {
		newSession, err := createSession(session.Role, session.UserID, session.AdminID, session.SuperAdminUsername, time.Until(session.ExpiresAt))
		if err != nil {
			return sessionRecord{}, serverError(c, "failed to rotate session", err)
		}
		if session.ReauthExpiresAt != nil && now.Before(*session.ReauthExpiresAt) {
			_ = middleware.DBConn.Exec(
				`UPDATE `+sessionTable+` SET reauth_expires_at = ? WHERE id = ?`,
				session.ReauthExpiresAt, newSession.ID,
			).Error
			newSession.ReauthExpiresAt = session.ReauthExpiresAt
		}
		deleteSessionByID(session.ID)
		setSessionCookie(c, newSession)
		return newSession, nil
	}

	_ = middleware.DBConn.Exec(
		`UPDATE `+sessionTable+` SET last_activity_at = ? WHERE id = ?`,
		now, session.ID,
	).Error

	return session, nil
}

func requireUserSession(c *fiber.Ctx) (sessionRecord, error) {
	return requireSession(c, sessionRoleUser, false)
}

func requireAdminSession(c *fiber.Ctx) (sessionRecord, error) {
	return requireSession(c, sessionRoleAdmin, true)
}

func requireSuperAdminSession(c *fiber.Ctx) (sessionRecord, error) {
	return requireSession(c, sessionRoleSuperAdmin, true)
}

func requireUserSessionForID(c *fiber.Ctx, userID string) error {
	session, err := requireUserSession(c)
	if err != nil {
		return err
	}
	if session.UserID == nil || strings.TrimSpace(*session.UserID) != strings.TrimSpace(userID) {
		return unauthorized(c, "invalid user session")
	}
	return nil
}

func requireAdminSessionForID(c *fiber.Ctx, adminID string) error {
	session, err := requireAdminSession(c)
	if err != nil {
		return err
	}
	if session.AdminID == nil || strings.TrimSpace(*session.AdminID) != strings.TrimSpace(adminID) {
		return unauthorized(c, "invalid admin session")
	}
	return nil
}

func requireReauth(c *fiber.Ctx, session sessionRecord) error {
	if session.ReauthExpiresAt == nil || utcNow().After(*session.ReauthExpiresAt) {
		return unauthorized(c, "reauthentication required")
	}
	return nil
}

func listCategories() ([]model.CategoryModel, error) {
	if err := ensureCategoryStore(); err != nil {
		return nil, err
	}

	var categories []model.CategoryModel
	if err := middleware.DBConn.Raw(
		`SELECT id, name, created_at, updated_at FROM ` + categoryTable + ` ORDER BY name ASC`,
	).Scan(&categories).Error; err != nil {
		return nil, err
	}

	return categories, nil
}

func listCategoryNames() ([]string, error) {
	categories, err := listCategories()
	if err != nil {
		return nil, err
	}

	names := make([]string, 0, len(categories))
	for _, category := range categories {
		names = append(names, category.Name)
	}
	return names, nil
}

func categoryExists(name string) (bool, error) {
	if err := ensureCategoryStore(); err != nil {
		return false, err
	}

	trimmed := strings.TrimSpace(name)
	if trimmed == "" {
		return false, nil
	}

	var count int64
	if err := middleware.DBConn.Raw(
		`SELECT COUNT(*) FROM `+categoryTable+` WHERE LOWER(name) = LOWER(?)`,
		trimmed,
	).Scan(&count).Error; err != nil {
		return false, err
	}

	return count > 0, nil
}

func isDisabledCategory(name string) bool {
	return strings.EqualFold(strings.TrimSpace(name), disabledCategoryName)
}

func categoryInUse(name string) (bool, error) {
	trimmed := strings.TrimSpace(name)
	if trimmed == "" {
		return false, nil
	}

	var adminCount int64
	if err := middleware.DBConn.Raw(
		`SELECT COUNT(*) FROM `+adminTable+` WHERE unit = ?`,
		trimmed,
	).Scan(&adminCount).Error; err != nil {
		return false, err
	}

	var feedbackCount int64
	if err := middleware.DBConn.Raw(
		`SELECT COUNT(*) FROM `+feedbackTable+` WHERE category = ?`,
		trimmed,
	).Scan(&feedbackCount).Error; err != nil {
		return false, err
	}

	return adminCount+feedbackCount > 0, nil
}

func syncCategoryConstraints() error {
	names, err := listCategoryNames()
	if err != nil {
		return err
	}

	if len(names) == 0 {
		return fmt.Errorf("at least one category is required")
	}

	literals := make([]string, 0, len(names))
	for _, name := range names {
		literals = append(literals, "'"+escapeSQLLiteral(name)+"'")
	}
	valueList := strings.Join(literals, ", ")

	db := middleware.DBConn
	if err := db.Exec(`ALTER TABLE ` + feedbackTable + ` DROP CONSTRAINT IF EXISTS chk_feedback_category`).Error; err != nil {
		return err
	}
	if err := db.Exec(`ALTER TABLE ` + adminTable + ` DROP CONSTRAINT IF EXISTS chk_admin_unit`).Error; err != nil {
		return err
	}
	if err := db.Exec(
		`ALTER TABLE ` + feedbackTable + `
		 ADD CONSTRAINT chk_feedback_category CHECK (category IN (` + valueList + `))`,
	).Error; err != nil {
		return err
	}
	if err := db.Exec(
		`ALTER TABLE ` + adminTable + `
		 ADD CONSTRAINT chk_admin_unit CHECK (unit IN (` + valueList + `))`,
	).Error; err != nil {
		return err
	}

	return nil
}

func escapeSQLLiteral(value string) string {
	return strings.ReplaceAll(value, "'", "''")
}

func emailInUse(email string, excludeUserID string, excludeAdminID string) (bool, error) {
	normalized := strings.TrimSpace(email)
	if normalized == "" {
		return false, nil
	}

	var userCount int64
	userQuery := `SELECT COUNT(*) FROM ` + userTable + ` WHERE LOWER(email) = LOWER(?)`
	userArgs := []any{normalized}
	if excludeUserID != "" {
		userQuery += ` AND id <> ?`
		userArgs = append(userArgs, excludeUserID)
	}
	if err := middleware.DBConn.Raw(userQuery, userArgs...).Scan(&userCount).Error; err != nil {
		return false, err
	}

	var adminCount int64
	adminQuery := `SELECT COUNT(*) FROM ` + adminTable + ` WHERE LOWER(email) = LOWER(?)`
	adminArgs := []any{normalized}
	if excludeAdminID != "" {
		adminQuery += ` AND id <> ?`
		adminArgs = append(adminArgs, excludeAdminID)
	}
	if err := middleware.DBConn.Raw(adminQuery, adminArgs...).Scan(&adminCount).Error; err != nil {
		return false, err
	}

	return userCount+adminCount > 0, nil
}

var emailLikePattern = regexp.MustCompile(`(?i)[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}`)

func containsEmailLike(value string) bool {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return false
	}
	if strings.Contains(trimmed, "@") {
		return true
	}
	return emailLikePattern.MatchString(trimmed)
}

func parseBody(c *fiber.Ctx, dest any) error {
	return c.BodyParser(dest)
}

// success keeps the response shape consistent across all handlers.
func success(c *fiber.Ctx, code int, data any) error {
	return c.Status(code).JSON(response.ResponseModel{
		RetCode: fmt.Sprintf("%d", code),
		Message: "Success!!",
		Data:    data,
	})
}

func parseError(c *fiber.Ctx, message string, err error) error {
	return c.Status(401).JSON(response.ResponseModel{
		RetCode: "401",
		Message: status.Retcode401,
		Data: errors.ErrorModel{
			Message:   message,
			IsSuccess: false,
			Error:     err,
		},
	})
}

func invalidRequest(c *fiber.Ctx, message string) error {
	return c.Status(400).JSON(response.ResponseModel{
		RetCode: "400",
		Message: status.Retcode404,
		Data: errors.ErrorModel{
			Message:   message,
			IsSuccess: false,
			Error:     nil,
		},
	})
}

func unauthorized(c *fiber.Ctx, message string) error {
	return c.Status(401).JSON(response.ResponseModel{
		RetCode: "401",
		Message: status.Retcode401,
		Data: errors.ErrorModel{
			Message:   message,
			IsSuccess: false,
			Error:     nil,
		},
	})
}

func notFound(c *fiber.Ctx, message string, err error) error {
	return c.Status(404).JSON(response.ResponseModel{
		RetCode: "404",
		Message: status.Retcode404,
		Data: errors.ErrorModel{
			Message:   message,
			IsSuccess: false,
			Error:     err,
		},
	})
}

func serverError(c *fiber.Ctx, message string, err error) error {
	return c.Status(500).JSON(response.ResponseModel{
		RetCode: "500",
		Message: status.Retcode500,
		Data: errors.ErrorModel{
			Message:   message,
			IsSuccess: false,
			Error:     err,
		},
	})
}

type dbActionError struct {
	statusCode int
	message    string
	err        error
}

func (e *dbActionError) Error() string {
	return e.message
}

func execUpdateByID(table string, id string, failMessage string, notFoundMessage string, sets []string, args ...any) error {
	// Reuse the same update flow for profile changes and similar single-row updates.
	queryArgs := append(args, id)
	result := middleware.DBConn.Exec(
		fmt.Sprintf("UPDATE %s SET %s WHERE id = ?", table, strings.Join(sets, ", ")),
		queryArgs...,
	)
	if result.Error != nil {
		return &dbActionError{statusCode: fiber.StatusInternalServerError, message: failMessage, err: result.Error}
	}
	if result.RowsAffected == 0 {
		return &dbActionError{statusCode: fiber.StatusNotFound, message: notFoundMessage}
	}
	return nil
}

func respondDBResult(c *fiber.Ctx, err error) error {
	if err == nil {
		return nil
	}
	actionErr, ok := err.(*dbActionError)
	if !ok {
		return serverError(c, "database operation failed", err)
	}
	if actionErr.statusCode == fiber.StatusNotFound {
		return notFound(c, actionErr.message, actionErr.err)
	}
	return serverError(c, actionErr.message, actionErr.err)
}

func deleteByID(c *fiber.Ctx, table string, entity string, id string) error {
	// Reuse the same delete response pattern for user, admin, and feedback records.
	result := middleware.DBConn.Exec("DELETE FROM "+table+" WHERE id = ?", id)
	if result.Error != nil {
		return serverError(c, fmt.Sprintf("failed to delete %s", entity), result.Error)
	}
	if result.RowsAffected == 0 {
		return notFound(c, fmt.Sprintf("%s not found", entity), nil)
	}
	return success(c, fiber.StatusOK, map[string]string{"id": id})
}

// Enforce one admin per unit in application logic because the live schema does not.
func adminUnitTaken(unit string, excludeID string) (bool, error) {
	if isDisabledCategory(unit) {
		return false, nil
	}
	var count int64
	query := `SELECT COUNT(*) FROM ` + adminTable + ` WHERE unit = ? AND COALESCE(is_superadmin, FALSE) = FALSE`
	args := []any{unit}
	if excludeID != "" {
		query += ` AND id <> ?`
		args = append(args, excludeID)
	}

	if err := middleware.DBConn.Raw(query, args...).Scan(&count).Error; err != nil {
		return false, err
	}
	return count > 0, nil
}

// Superadmin routes use a short-lived signed bearer token instead of normal admin login state.
func requireSuperAdmin(c *fiber.Ctx) error {
	header := strings.TrimSpace(c.Get("Authorization"))
	if header == "" || !strings.HasPrefix(header, "Bearer ") {
		return unauthorized(c, "superadmin authorization is required")
	}

	token := strings.TrimSpace(strings.TrimPrefix(header, "Bearer "))
	if !validateSuperAdminToken(token) {
		return unauthorized(c, "invalid or expired superadmin session")
	}

	return nil
}

// The token is stateless: it only carries the expiry and an HMAC signature.
func issueSuperAdminToken(expiresAt time.Time) string {
	payload := fmt.Sprintf("%d", expiresAt.Unix())
	mac := hmac.New(sha256.New, []byte(superAdminSecret()))
	mac.Write([]byte(payload))
	signature := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
	token := payload + "." + signature
	return base64.RawURLEncoding.EncodeToString([]byte(token))
}

func validateSuperAdminToken(token string) bool {
	decoded, err := base64.RawURLEncoding.DecodeString(token)
	if err != nil {
		return false
	}

	parts := strings.Split(string(decoded), ".")
	if len(parts) != 2 {
		return false
	}

	mac := hmac.New(sha256.New, []byte(superAdminSecret()))
	mac.Write([]byte(parts[0]))
	expectedSignature := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
	if !hmac.Equal([]byte(parts[1]), []byte(expectedSignature)) {
		return false
	}

	expiresAtUnix, err := strconv.ParseInt(parts[0], 10, 64)
	if err != nil {
		return false
	}

	return time.Now().Unix() <= expiresAtUnix
}

func superAdminUsername() string {
	if value := strings.TrimSpace(os.Getenv("SUPERADMIN_USERNAME")); value != "" {
		return value
	}
	return defaultSuperAdminUsername
}

func superAdminPassword() string {
	if value := strings.TrimSpace(os.Getenv("SUPERADMIN_PASSWORD")); value != "" {
		return value
	}
	return defaultSuperAdminPassword
}

func superAdminSecret() string {
	if value := strings.TrimSpace(os.Getenv("SUPERADMIN_SECRET")); value != "" {
		return value
	}
	return defaultSuperAdminSecret
}

func shouldSendResolvedEmail(previous model.FeedbackModel, updated model.FeedbackModel) bool {
	if strings.EqualFold(previous.Status, "Resolved") {
		return false
	}
	return strings.EqualFold(updated.Status, "Resolved")
}

func utcNow() time.Time {
	return time.Now().UTC()
}

