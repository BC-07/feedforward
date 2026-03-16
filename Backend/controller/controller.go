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
	"log"
	"os"
	"path/filepath"
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
var feedbackEmailColumnInit sync.Once
var feedbackEmailColumnErr error
var sessionTableInit sync.Once
var sessionTableErr error
var feedbackTimingLoggerOnce sync.Once
var feedbackTimingLogger *log.Logger
var feedbackTimingLoggerErr error
var feedbackTimingFile *os.File
var feedbackTimingMu sync.Mutex
var feedbackTimingEntries int

const feedbackTimingMaxEntries = 3

func Getnames(c *fiber.Ctx) error {
	db := middleware.DBConn

	var data []map[string]any
	if err := db.Raw("SELECT * FROM public.students").Scan(&data).Error; err != nil {
		return serverError(c, "Server Failed", err)
	}

	return success(c, fiber.StatusOK, data)
}

func InsertData(c *fiber.Ctx) error {
	db := middleware.DBConn

	var insertData []map[string]any
	if err := parseBody(c, &insertData); err != nil {
		return parseError(c, "failed to parse data", err)
	}

	if err := db.Exec("").Create(&insertData).Error; err != nil {
		return serverError(c, "failed to insert data", err)
	}

	return success(c, fiber.StatusOK, insertData)
}

func UpdateExec(c *fiber.Ctx) error {
	db := middleware.DBConn

	var updateExec map[string]any
	if err := parseBody(c, &updateExec); err != nil {
		return parseError(c, "Invalid parse request", err)
	}

	if err := db.Exec("UPDATE public.students SET name = ? WHERE students.id = ?", updateExec["name"], updateExec["id"]).Error; err != nil {
		return serverError(c, "Internal Server error", err)
	}

	return success(c, fiber.StatusCreated, updateExec)
}

func InsertExec(c *fiber.Ctx) error {
	db := middleware.DBConn

	var insertExec map[string]any
	if err := parseBody(c, &insertExec); err != nil {
		return parseError(c, "Invalid parse request", err)
	}

	if err := db.Exec("INSERT INTO public.students (name) VALUES (?)", insertExec["name"]).Error; err != nil {
		return serverError(c, "Internal Server error", err)
	}

	return success(c, fiber.StatusCreated, insertExec)
}

func GetFeedbacks(c *fiber.Ctx) error {
	db := middleware.DBConn
	if err := ensureFeedbackEmailColumn(); err != nil {
		return serverError(c, "failed to initialize feedback email storage", err)
	}

	// Build the filter dynamically so the same handler supports admin and user views.
	query := `SELECT id, type, category, subject, message, status, priority, user_id, user_name, user_email, is_anonymous, response, created_at, updated_at
		FROM ` + feedbackTable
	var args []any
	var conditions []string

	if category := strings.TrimSpace(c.Query("category")); category != "" {
		conditions = append(conditions, "LOWER(category) = LOWER(?)")
		args = append(args, category)
	}
	if userID := strings.TrimSpace(c.Query("userId")); userID != "" {
		conditions = append(conditions, "user_id = ?")
		args = append(args, userID)
	}
	if len(conditions) > 0 {
		query += " WHERE " + strings.Join(conditions, " AND ")
	}
	query += " ORDER BY created_at DESC"

	var feedbacks []model.FeedbackModel
	if err := db.Raw(query, args...).Scan(&feedbacks).Error; err != nil {
		return serverError(c, "failed to fetch feedbacks", err)
	}

	return success(c, fiber.StatusOK, feedbacks)
}

func GetFeedbackByID(c *fiber.Ctx) error {
	feedback, err := fetchFeedbackByID(c.Params("id"))
	if err != nil {
		return notFound(c, "feedback not found", err)
	}

	return success(c, fiber.StatusOK, feedback)
}

func CreateFeedback(c *fiber.Ctx) error {
	started := time.Now()
	stepStart := started
	logPrefix := fmt.Sprintf("CreateFeedback %s", c.IP())
	logTimingStart(logPrefix, "")
	db := middleware.DBConn
	if err := ensureFeedbackEmailColumn(); err != nil {
		return serverError(c, "failed to initialize feedback email storage", err)
	}
	logTimingf("%s ensureFeedbackEmailColumn=%s", logPrefix, time.Since(stepStart))
	stepStart = time.Now()

	//Storage preparation
	var feedback model.FeedbackModel

	//validating user input in json
	if err := parseBody(c, &feedback); err != nil {
		return parseError(c, "failed to parse feedback", err)
	}

	if err := normalizeFeedback(&feedback); err != nil {
		return invalidRequest(c, err.Error())
	}
	logTimingf("%s trackingId=%s", logPrefix, feedback.ID)
	logTimingf("%s parse+normalize=%s", logPrefix, time.Since(stepStart))
	stepStart = time.Now()

	if feedback.UserID == nil && feedback.UserEmail != nil {
		user, err := fetchUserByEmail(*feedback.UserEmail)
		if err != nil {
			return serverError(c, "failed to validate feedback user email", err)
		}
		if user.ID == "" {
			return invalidRequest(c, "user account not found; please log in again")
		}
		feedback.UserID = &user.ID
		if feedback.UserName == nil || strings.TrimSpace(*feedback.UserName) == "" {
			name := user.Name
			feedback.UserName = &name
		}
		if feedback.UserEmail == nil || strings.TrimSpace(*feedback.UserEmail) == "" {
			email := user.Email
			feedback.UserEmail = &email
		}
	}
	logTimingf("%s resolveUserByEmail=%s", logPrefix, time.Since(stepStart))
	stepStart = time.Now()

	if feedback.UserID != nil && (feedback.UserEmail == nil || strings.TrimSpace(*feedback.UserEmail) == "") {
		user, err := fetchUserByID(strings.TrimSpace(*feedback.UserID))
		if err != nil {
			return serverError(c, "failed to load feedback user", err)
		}
		if user.Email != "" {
			email := user.Email
			feedback.UserEmail = &email
		}
	}
	if feedback.UserID != nil && strings.TrimSpace(*feedback.UserID) != "" {
		user, err := fetchUserByID(strings.TrimSpace(*feedback.UserID))
		if err != nil {
			return serverError(c, "failed to load feedback user", err)
		}
		if user.ID == "" {
			return invalidRequest(c, "user account not found; please log in again")
		}
		if user.Name != "" {
			name := user.Name
			feedback.UserName = &name
		}
		if user.Email != "" {
			email := user.Email
			feedback.UserEmail = &email
		}
	}
	logTimingf("%s resolveUserByID=%s", logPrefix, time.Since(stepStart))
	stepStart = time.Now()

	now := utcNow()
	if feedback.CreatedAt.IsZero() {
		feedback.CreatedAt = now
	}
	feedback.UpdatedAt = now

	if err := db.Exec(
		`INSERT INTO `+feedbackTable+`
			(id, type, category, subject, message, status, priority, user_id, user_name, user_email, is_anonymous, response, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		feedback.ID,
		feedback.Type,
		feedback.Category,
		feedback.Subject,
		feedback.Message,
		feedback.Status,
		feedback.Priority,
		feedback.UserID,
		feedback.UserName,
		feedback.UserEmail,
		feedback.IsAnonymous,
		feedback.Response,
		feedback.CreatedAt,
		feedback.UpdatedAt,
	).Error; err != nil {
		return serverError(c, "failed to create feedback", err)
	}
	logTimingf("%s insertFeedback=%s", logPrefix, time.Since(stepStart))
	stepStart = time.Now()

	created, err := fetchFeedbackByID(feedback.ID)
	if err != nil {
		return serverError(c, "failed to fetch feedback", err)
	}
	logTimingf("%s fetchFeedbackByID=%s", logPrefix, time.Since(stepStart))
	stepStart = time.Now()

	queuedAt := time.Now()
	createdCopy := created
	go func(feedback model.FeedbackModel, queued time.Time) {
		emailStart := time.Now()
		if err := sendTrackingEmailForFeedback(feedback); err != nil {
			fmt.Printf("email: failed to send tracking notification for %s: %v\n", feedback.ID, err)
			return
		}
		logTimingf("%s sendTrackingEmail async duration=%s queuedDelay=%s", logPrefix, time.Since(emailStart), emailStart.Sub(queued))
	}(createdCopy, queuedAt)
	logTimingf("%s sendTrackingEmail queued=%s", logPrefix, time.Since(stepStart))
	logTimingf("%s total=%s", logPrefix, time.Since(started))

	return success(c, fiber.StatusCreated, created)
}

func UpdateFeedback(c *fiber.Ctx) error {
	started := time.Now()
	stepStart := started
	logPrefix := fmt.Sprintf("UpdateFeedback %s", c.IP())
	logTimingStart(logPrefix, c.Params("id"))
	db := middleware.DBConn
	if err := ensureFeedbackEmailColumn(); err != nil {
		return serverError(c, "failed to initialize feedback email storage", err)
	}
	logTimingf("%s ensureFeedbackEmailColumn=%s", logPrefix, time.Since(stepStart))
	stepStart = time.Now()

	existing, err := fetchFeedbackByID(c.Params("id"))
	if err != nil {
		return serverError(c, "failed to fetch feedback", err)
	}
	if existing.ID == "" {
		return notFound(c, "feedback not found", nil)
	}
	logTimingf("%s fetchExisting=%s", logPrefix, time.Since(stepStart))
	stepStart = time.Now()

	var payload map[string]any
	if err := parseBody(c, &payload); err != nil {
		return parseError(c, "failed to parse feedback update", err)
	}
	logTimingf("%s parsePayload=%s", logPrefix, time.Since(stepStart))
	stepStart = time.Now()

	// Only update fields that were actually sent by the client.
	var sets []string
	var args []any

	if raw, ok := payload["type"].(string); ok {
		sets = append(sets, "type = ?")
		args = append(args, strings.TrimSpace(raw))
	}
	if raw, ok := payload["category"].(string); ok {
		value := strings.TrimSpace(raw)
		ok, err := categoryExists(value)
		if err != nil {
			return serverError(c, "failed to validate feedback category", err)
		}
		if !ok {
			return invalidRequest(c, "invalid feedback category")
		}
		sets = append(sets, "category = ?")
		args = append(args, value)
	}
	if raw, ok := payload["subject"].(string); ok {
		sets = append(sets, "subject = ?")
		args = append(args, strings.TrimSpace(raw))
	}
	if raw, ok := payload["message"].(string); ok {
		sets = append(sets, "message = ?")
		args = append(args, strings.TrimSpace(raw))
	}
	if raw, ok := payload["status"].(string); ok {
		value := strings.TrimSpace(raw)
		if !validStatuses[value] {
			return invalidRequest(c, "invalid feedback status")
		}
		sets = append(sets, "status = ?")
		args = append(args, value)
	}
	if raw, ok := payload["priority"].(string); ok {
		value := strings.TrimSpace(raw)
		if !validPriorities[value] {
			return invalidRequest(c, "invalid feedback priority")
		}
		sets = append(sets, "priority = ?")
		args = append(args, value)
	}
	if raw, exists := payload["response"]; exists {
		if raw == nil {
			sets = append(sets, "response = ?")
			args = append(args, "")
		} else if value, ok := raw.(string); ok {
			trimmed := strings.TrimSpace(value)
			sets = append(sets, "response = ?")
			args = append(args, trimmed)
		}
	}
	if raw, ok := payload["isAnonymous"].(bool); ok {
		sets = append(sets, "is_anonymous = ?")
		args = append(args, raw)
	}

	if len(sets) == 0 {
		return invalidRequest(c, "no fields provided for update")
	}

	// Always stamp the latest write time on any feedback update.
	sets = append(sets, "updated_at = ?")
	args = append(args, utcNow(), c.Params("id"))

	result := db.Exec(
		fmt.Sprintf("UPDATE %s SET %s WHERE id = ?", feedbackTable, strings.Join(sets, ", ")),
		args...,
	)
	if result.Error != nil {
		return serverError(c, "failed to update feedback", result.Error)
	}
	if result.RowsAffected == 0 {
		return notFound(c, "feedback not found", nil)
	}
	logTimingf("%s updateFeedback=%s", logPrefix, time.Since(stepStart))
	stepStart = time.Now()

	updated, err := fetchFeedbackByID(c.Params("id"))
	if err != nil {
		return serverError(c, "failed to fetch feedback", err)
	}
	logTimingf("%s fetchUpdated=%s", logPrefix, time.Since(stepStart))
	stepStart = time.Now()

	if shouldSendResolvedEmail(existing, updated) {
		queuedAt := time.Now()
		updatedCopy := updated
		go func(feedback model.FeedbackModel, queued time.Time) {
			emailStart := time.Now()
			if err := sendResolvedEmailForFeedback(feedback); err != nil {
				fmt.Printf("email: failed to send resolved notification for %s: %v\n", feedback.ID, err)
				return
			}
			logTimingf("%s sendResolvedEmail async duration=%s queuedDelay=%s", logPrefix, time.Since(emailStart), emailStart.Sub(queued))
		}(updatedCopy, queuedAt)
		logTimingf("%s sendResolvedEmail queued=%s", logPrefix, time.Since(stepStart))
		stepStart = time.Now()
	}

	logTimingf("%s total=%s", logPrefix, time.Since(started))

	return success(c, fiber.StatusOK, updated)
}

func DeleteFeedback(c *fiber.Ctx) error {
	return deleteByID(c, feedbackTable, "feedback", c.Params("id"))
}

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
}//

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

func ListCategories(c *fiber.Ctx) error {
	categories, err := listCategories()
	if err != nil {
		return serverError(c, "failed to fetch categories", err)
	}

	return success(c, fiber.StatusOK, categories)
}

func CreateCategoryBySuperAdmin(c *fiber.Ctx) error {
	if _, err := requireSuperAdminSession(c); err != nil {
		return err
	}

	if err := ensureCategoryStore(); err != nil {
		return serverError(c, "failed to initialize categories", err)
	}

	var payload struct {
		Name string `json:"name"`
	}
	if err := parseBody(c, &payload); err != nil {
		return parseError(c, "failed to parse category", err)
	}

	name := strings.TrimSpace(payload.Name)
	if name == "" {
		return invalidRequest(c, "category name is required")
	}

	exists, err := categoryExists(name)
	if err != nil {
		return serverError(c, "failed to validate category", err)
	}
	if exists {
		return invalidRequest(c, "category already exists")
	}

	if err := middleware.DBConn.Exec(
		`INSERT INTO `+categoryTable+` (name, created_at, updated_at) VALUES (?, ?, ?)`,
		name, utcNow(), utcNow(),
	).Error; err != nil {
		return serverError(c, "failed to create category", err)
	}

	if err := syncCategoryConstraints(); err != nil {
		return serverError(c, "failed to sync category constraints", err)
	}

	categories, err := listCategories()
	if err != nil {
		return serverError(c, "failed to fetch categories", err)
	}

	return success(c, fiber.StatusCreated, categories)
}

func UpdateCategoryBySuperAdmin(c *fiber.Ctx) error {
	if _, err := requireSuperAdminSession(c); err != nil {
		return err
	}

	if err := ensureCategoryStore(); err != nil {
		return serverError(c, "failed to initialize categories", err)
	}

	categoryID, err := strconv.Atoi(strings.TrimSpace(c.Params("id")))
	if err != nil || categoryID <= 0 {
		return invalidRequest(c, "invalid category id")
	}

	var payload struct {
		Name string `json:"name"`
	}
	if err := parseBody(c, &payload); err != nil {
		return parseError(c, "failed to parse category update", err)
	}

	newName := strings.TrimSpace(payload.Name)
	if newName == "" {
		return invalidRequest(c, "category name is required")
	}

	var existing model.CategoryModel
	if err := middleware.DBConn.Raw(
		`SELECT id, name, created_at, updated_at FROM `+categoryTable+` WHERE id = ?`,
		categoryID,
	).Scan(&existing).Error; err != nil {
		return serverError(c, "failed to fetch category", err)
	}
	if existing.ID == 0 {
		return notFound(c, "category not found", nil)
	}

	if strings.EqualFold(existing.Name, newName) {
		categories, listErr := listCategories()
		if listErr != nil {
			return serverError(c, "failed to fetch categories", listErr)
		}
		return success(c, fiber.StatusOK, categories)
	}

	exists, err := categoryExists(newName)
	if err != nil {
		return serverError(c, "failed to validate category", err)
	}
	if exists {
		return invalidRequest(c, "category already exists")
	}

	tx := middleware.DBConn.Begin()
	if tx.Error != nil {
		return serverError(c, "failed to start category update", tx.Error)
	}

	if err := tx.Exec(
		`UPDATE `+categoryTable+` SET name = ?, updated_at = ? WHERE id = ?`,
		newName, utcNow(), categoryID,
	).Error; err != nil {
		tx.Rollback()
		return serverError(c, "failed to update category", err)
	}

	if err := tx.Exec(
		`UPDATE `+adminTable+` SET unit = ?, updated_at = ? WHERE unit = ?`,
		newName, utcNow(), existing.Name,
	).Error; err != nil {
		tx.Rollback()
		return serverError(c, "failed to sync admin units", err)
	}

	if err := tx.Exec(
		`UPDATE `+feedbackTable+` SET category = ?, updated_at = ? WHERE category = ?`,
		newName, utcNow(), existing.Name,
	).Error; err != nil {
		tx.Rollback()
		return serverError(c, "failed to sync feedback categories", err)
	}

	if err := tx.Commit().Error; err != nil {
		return serverError(c, "failed to finalize category update", err)
	}

	if err := syncCategoryConstraints(); err != nil {
		return serverError(c, "failed to sync category constraints", err)
	}

	categories, listErr := listCategories()
	if listErr != nil {
		return serverError(c, "failed to fetch categories", listErr)
	}

	return success(c, fiber.StatusOK, categories)
}

func DeleteCategoryBySuperAdmin(c *fiber.Ctx) error {
	if _, err := requireSuperAdminSession(c); err != nil {
		return err
	}

	if err := ensureCategoryStore(); err != nil {
		return serverError(c, "failed to initialize categories", err)
	}

	categoryID, err := strconv.Atoi(strings.TrimSpace(c.Params("id")))
	if err != nil || categoryID <= 0 {
		return invalidRequest(c, "invalid category id")
	}

	var existing model.CategoryModel
	if err := middleware.DBConn.Raw(
		`SELECT id, name, created_at, updated_at FROM `+categoryTable+` WHERE id = ?`,
		categoryID,
	).Scan(&existing).Error; err != nil {
		return serverError(c, "failed to fetch category", err)
	}
	if existing.ID == 0 {
		return notFound(c, "category not found", nil)
	}

	inUse, err := categoryInUse(existing.Name)
	if err != nil {
		return serverError(c, "failed to validate category usage", err)
	}
	if inUse {
		return invalidRequest(c, "category is in use by admin accounts or feedbacks")
	}

	var categoryCount int64
	if err := middleware.DBConn.Raw(`SELECT COUNT(*) FROM ` + categoryTable).Scan(&categoryCount).Error; err != nil {
		return serverError(c, "failed to validate category count", err)
	}
	if categoryCount <= 1 {
		return invalidRequest(c, "at least one category is required")
	}

	if err := middleware.DBConn.Exec(
		`DELETE FROM `+categoryTable+` WHERE id = ?`,
		categoryID,
	).Error; err != nil {
		return serverError(c, "failed to delete category", err)
	}

	if err := syncCategoryConstraints(); err != nil {
		return serverError(c, "failed to sync category constraints", err)
	}

	categories, err := listCategories()
	if err != nil {
		return serverError(c, "failed to fetch categories", err)
	}

	return success(c, fiber.StatusOK, categories)
}

func ListAdmins(c *fiber.Ctx) error {
	if _, err := requireSuperAdminSession(c); err != nil {
		return err
	}
	if err := ensureAdminDisableColumn(); err != nil {
		return serverError(c, "failed to initialize admin access state", err)
	}

	var admins []model.AdminModel
	if err := middleware.DBConn.Raw(
		`SELECT id, first_name, last_name, first_name || ' ' || last_name AS name, email, unit, COALESCE(is_disabled, FALSE) AS is_disabled, created_at, updated_at
		FROM ` + adminTable + ` ORDER BY unit ASC, first_name ASC, last_name ASC`,
	).Scan(&admins).Error; err != nil {
		return serverError(c, "failed to fetch admins", err)
	}

	return success(c, fiber.StatusOK, admins)
}

func CreateAdminBySuperAdmin(c *fiber.Ctx) error {
	if _, err := requireSuperAdminSession(c); err != nil {
		return err
	}
	if err := ensureAdminDisableColumn(); err != nil {
		return serverError(c, "failed to initialize admin access state", err)
	}

	var payload model.AdminModel
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

	taken, err := adminUnitTaken(payload.Unit, "")
	if err != nil {
		return serverError(c, "failed to validate admin unit", err)
	}
	if taken {
		return invalidRequest(c, "selected unit already has an admin")
	}

	payload.ID = "ADMIN-" + fmt.Sprintf("%d", time.Now().UnixMilli())
	now := utcNow()
	if err := middleware.DBConn.Exec(
		`INSERT INTO `+adminTable+` (id, first_name, last_name, email, password, unit, is_disabled, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		payload.ID, payload.FirstName, payload.LastName, payload.Email, payload.Password, payload.Unit, false, now, now,
	).Error; err != nil {
		return serverError(c, "failed to create admin", err)
	}

	admin, err := fetchAdminByID(payload.ID)
	if err != nil {
		return serverError(c, "failed to fetch admin", err)
	}
	return success(c, fiber.StatusCreated, admin)
}

func UpdateAdminBySuperAdmin(c *fiber.Ctx) error {
	session, err := requireSuperAdminSession(c)
	if err != nil {
		return err
	}
	if err := requireReauth(c, session); err != nil {
		return err
	}

	var payload struct {
		FirstName string `json:"firstName"`
		LastName  string `json:"lastName"`
		Email     string `json:"email"`
		Unit      string `json:"unit"`
		Password  string `json:"password"`
	}
	if err := parseBody(c, &payload); err != nil {
		return parseError(c, "failed to parse admin update", err)
	}

	var sets []string
	var args []any

	if value := strings.TrimSpace(payload.FirstName); value != "" {
		sets = append(sets, "first_name = ?")
		args = append(args, value)
	}
	if value := strings.TrimSpace(payload.LastName); value != "" {
		sets = append(sets, "last_name = ?")
		args = append(args, value)
	}
	if value := strings.TrimSpace(payload.Email); value != "" {
		inUse, err := emailInUse(value, "", c.Params("id"))
		if err != nil {
			return serverError(c, "failed to validate email", err)
		}
		if inUse {
			return invalidRequest(c, "email is already in use")
		}
		sets = append(sets, "email = ?")
		args = append(args, value)
	}
	if value := strings.TrimSpace(payload.Unit); value != "" {
		unitExists, err := categoryExists(value)
		if err != nil {
			return serverError(c, "failed to validate admin unit", err)
		}
		if !unitExists {
			return invalidRequest(c, "invalid admin unit")
		}
		taken, err := adminUnitTaken(value, c.Params("id"))
		if err != nil {
			return serverError(c, "failed to validate admin unit", err)
		}
		if taken {
			return invalidRequest(c, "selected unit already has an admin")
		}
		sets = append(sets, "unit = ?")
		args = append(args, value)
	}
	if value := strings.TrimSpace(payload.Password); value != "" {
		sets = append(sets, "password = ?")
		args = append(args, value)
	}

	if len(sets) == 0 {
		return invalidRequest(c, "no fields provided for admin update")
	}

	sets = append(sets, "updated_at = ?")
	args = append(args, utcNow())
	if err := execUpdateByID(adminTable, c.Params("id"), "failed to update admin", "admin not found", sets, args...); err != nil {
		return respondDBResult(c, err)
	}

	admin, err := fetchAdminByID(c.Params("id"))
	if err != nil {
		return serverError(c, "failed to fetch admin", err)
	}
	return success(c, fiber.StatusOK, admin)
}

func DisableAdminBySuperAdmin(c *fiber.Ctx) error {
	session, err := requireSuperAdminSession(c)
	if err != nil {
		return err
	}
	if err := requireReauth(c, session); err != nil {
		return err
	}
	if err := ensureAdminDisableColumn(); err != nil {
		return serverError(c, "failed to initialize admin access state", err)
	}

	result := middleware.DBConn.Exec(
		`UPDATE `+adminTable+` SET is_disabled = TRUE, updated_at = ? WHERE id = ?`,
		utcNow(),
		c.Params("id"),
	)
	if result.Error != nil {
		return serverError(c, "failed to disable admin account", result.Error)
	}
	if result.RowsAffected == 0 {
		return notFound(c, "admin not found", nil)
	}

	admin, err := fetchAdminByID(c.Params("id"))
	if err != nil {
		return serverError(c, "failed to fetch admin", err)
	}

	return success(c, fiber.StatusOK, admin)
}

func EnableAdminBySuperAdmin(c *fiber.Ctx) error {
	session, err := requireSuperAdminSession(c)
	if err != nil {
		return err
	}
	if err := requireReauth(c, session); err != nil {
		return err
	}
	if err := ensureAdminDisableColumn(); err != nil {
		return serverError(c, "failed to initialize admin access state", err)
	}

	result := middleware.DBConn.Exec(
		`UPDATE `+adminTable+` SET is_disabled = FALSE, updated_at = ? WHERE id = ?`,
		utcNow(),
		c.Params("id"),
	)
	if result.Error != nil {
		return serverError(c, "failed to enable admin account", result.Error)
	}
	if result.RowsAffected == 0 {
		return notFound(c, "admin not found", nil)
	}

	admin, err := fetchAdminByID(c.Params("id"))
	if err != nil {
		return serverError(c, "failed to fetch admin", err)
	}

	return success(c, fiber.StatusOK, admin)
}

func UpdateUserProfile(c *fiber.Ctx) error {
	if err := requireUserSessionForID(c, c.Params("id")); err != nil {
		return err
	}
	//Storage preparation
	var payload struct {
		FirstName string `json:"firstName"`
		LastName  string `json:"lastName"`
	}

	//validating user input in json
	if err := parseBody(c, &payload); err != nil {
		return parseError(c, "failed to parse user profile", err)
	}

	payload.FirstName = strings.TrimSpace(payload.FirstName)
	payload.LastName = strings.TrimSpace(payload.LastName)
	if payload.FirstName == "" || payload.LastName == "" {
		return invalidRequest(c, "first name and last name are required")
	}
	if containsEmailLike(payload.LastName) {
		return invalidRequest(c, "last name must not contain an email")
	}

	if err := execUpdateByID(
		userTable,
		c.Params("id"),
		"failed to update user profile",
		"user not found",
		[]string{"first_name = ?", "last_name = ?", "updated_at = ?"},
		payload.FirstName, payload.LastName, utcNow(),
	); err != nil {
		return respondDBResult(c, err)
	}

	user, err := fetchUserByID(c.Params("id"))
	if err != nil {
		return serverError(c, "failed to fetch user", err)
	}
	return success(c, fiber.StatusOK, user)
}

func UpdateAdminProfile(c *fiber.Ctx) error {
	if err := requireAdminSessionForID(c, c.Params("id")); err != nil {
		return err
	}
	//Storage preparation
	var payload struct {
		FirstName string `json:"firstName"`
		LastName  string `json:"lastName"`
	}

	//validating user input in json
	if err := parseBody(c, &payload); err != nil {
		return parseError(c, "failed to parse admin profile", err)
	}

	payload.FirstName = strings.TrimSpace(payload.FirstName)
	payload.LastName = strings.TrimSpace(payload.LastName)
	if payload.FirstName == "" || payload.LastName == "" {
		return invalidRequest(c, "first name and last name are required")
	}
	if containsEmailLike(payload.LastName) {
		return invalidRequest(c, "last name must not contain an email")
	}

	if err := execUpdateByID(
		adminTable,
		c.Params("id"),
		"failed to update admin profile",
		"admin not found",
		[]string{"first_name = ?", "last_name = ?", "updated_at = ?"},
		payload.FirstName, payload.LastName, utcNow(),
	); err != nil {
		return respondDBResult(c, err)
	}

	admin, err := fetchAdminByID(c.Params("id"))
	if err != nil || admin.ID == "" {
		return notFound(c, "admin not found", err)
	}

	return success(c, fiber.StatusOK, admin)
}

func UpdateUserPassword(c *fiber.Ctx) error {
	if err := requireUserSessionForID(c, c.Params("id")); err != nil {
		return err
	}
	return updatePassword(c, userTable, "user")
}

func DeleteUserAccount(c *fiber.Ctx) error {
	if err := requireUserSessionForID(c, c.Params("id")); err != nil {
		return err
	}
	return deleteByID(c, userTable, "user", c.Params("id"))
}

func UpdateAdminPassword(c *fiber.Ctx) error {
	if err := requireAdminSessionForID(c, c.Params("id")); err != nil {
		return err
	}
	return updatePassword(c, adminTable, "admin")
}

func DeleteAdminAccount(c *fiber.Ctx) error {
	return unauthorized(c, "admin self-deletion is not allowed")
}

func updatePassword(c *fiber.Ctx, table string, entity string) error {
	//Storage preparation
	var payload struct {
		CurrentPassword string `json:"currentPassword"`
		NewPassword     string `json:"newPassword"`
	}

	//validating user input in json
	if err := parseBody(c, &payload); err != nil {
		return parseError(c, "failed to parse password update", err)
	}

	payload.CurrentPassword = strings.TrimSpace(payload.CurrentPassword)
	payload.NewPassword = strings.TrimSpace(payload.NewPassword)
	if payload.CurrentPassword == "" || payload.NewPassword == "" {
		return invalidRequest(c, "current password and new password are required")
	}
	if len(payload.NewPassword) < 6 {
		return invalidRequest(c, "new password must be at least 6 characters")
	}

	result := middleware.DBConn.Exec(
		fmt.Sprintf("UPDATE %s SET password = ?, updated_at = ? WHERE id = ? AND password = ?", table),
		payload.NewPassword, utcNow(), c.Params("id"), payload.CurrentPassword,
	)
	if result.Error != nil {
		return serverError(c, "failed to update password", result.Error)
	}
	if result.RowsAffected == 0 {
		return unauthorized(c, fmt.Sprintf("%s current password is incorrect", entity))
	}

	return success(c, fiber.StatusOK, map[string]string{"id": c.Params("id")})
}

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

	var admin model.AdminModel
	// Compose the display name in SQL because the table stores first and last names separately.
	err := middleware.DBConn.Raw(
		`SELECT id, first_name, last_name, first_name || ' ' || last_name AS name, email, unit, COALESCE(is_disabled, FALSE) AS is_disabled, created_at, updated_at
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
			 WHERE unit IS NOT NULL AND TRIM(unit) <> ''
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

func ensureAdminDisableColumn() error {
	adminDisableColumnInit.Do(func() {
		adminDisableColumnErr = middleware.DBConn.Exec(
			`ALTER TABLE ` + adminTable + ` ADD COLUMN IF NOT EXISTS is_disabled BOOLEAN NOT NULL DEFAULT FALSE`,
		).Error
	})
	return adminDisableColumnErr
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
	var count int64
	query := `SELECT COUNT(*) FROM ` + adminTable + ` WHERE unit = ?`
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

func logTimingf(format string, args ...any) {
	logger, err := feedbackTimingLoggerHandle()
	if err != nil || logger == nil {
		return
	}
	logger.Printf(format, args...)
}

func feedbackTimingLoggerHandle() (*log.Logger, error) {
	feedbackTimingLoggerOnce.Do(func() {
		if err := feedbackTimingOpenLogger(false); err != nil {
			feedbackTimingLoggerErr = err
			return
		}
	})
	return feedbackTimingLogger, feedbackTimingLoggerErr
}

func feedbackTimingLogPath() string {
	cwd, err := os.Getwd()
	if err != nil {
		return "feedback-timing.log"
	}
	if strings.EqualFold(filepath.Base(cwd), "Backend") {
		parent := filepath.Dir(cwd)
		return filepath.Join(parent, "feedback-timing.log")
	}
	return filepath.Join(cwd, "feedback-timing.log")
}

func logTimingStart(prefix string, id string) {
	feedbackTimingMu.Lock()
	defer feedbackTimingMu.Unlock()

	if feedbackTimingEntries >= feedbackTimingMaxEntries {
		_ = feedbackTimingOpenLogger(true)
		feedbackTimingEntries = 0
	}
	feedbackTimingEntries++

	logger, err := feedbackTimingLoggerHandle()
	if err != nil || logger == nil {
		return
	}

	divider := strings.Repeat("-", 72)
	meta := prefix
	if strings.TrimSpace(id) != "" {
		meta = fmt.Sprintf("%s id=%s", prefix, strings.TrimSpace(id))
	}
	logger.Printf("%s", divider)
	logger.Printf("%s", meta)
	logger.Printf("%s", divider)
}

func feedbackTimingOpenLogger(truncate bool) error {
	path := feedbackTimingLogPath()
	flags := os.O_CREATE | os.O_APPEND | os.O_WRONLY
	if truncate {
		flags = os.O_CREATE | os.O_TRUNC | os.O_WRONLY
	}
	file, err := os.OpenFile(path, flags, 0644)
	if err != nil {
		return err
	}
	if feedbackTimingFile != nil {
		_ = feedbackTimingFile.Close()
	}
	feedbackTimingFile = file
	feedbackTimingLogger = log.New(file, "", log.LstdFlags)
	return nil
}
