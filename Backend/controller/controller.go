package controller

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"intern_template_v1/middleware"
	"intern_template_v1/model"
	"intern_template_v1/model/errors"
	"intern_template_v1/model/response"
	"intern_template_v1/model/status"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
)

var validUnits = map[string]bool{
	"IT Unit":                    true,
	"Finance & Registrar Office": true,
	"Student Affair Office":      true,
	"Guidance Office":            true,
	"Faculty Office":             true,
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
	feedbackTable = "public.feedforward_feedback"
	userTable     = "public.feedforward_users"
	adminTable    = "public.feedforward_admins"
	superAdminTTL = 8 * time.Hour
)

const (
	defaultSuperAdminUsername = "superadmin"
	defaultSuperAdminPassword = "FeedForward-SuperAdmin"
	defaultSuperAdminSecret   = "feedforward-superadmin-secret"
)

type superAdminSession struct {
	Token     string    `json:"token"`
	Username  string    `json:"username"`
	ExpiresAt time.Time `json:"expiresAt"`
}

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

	// Build the filter dynamically so the same handler supports admin and user views.
	query := `SELECT id, type, category, subject, message, status, priority, user_id, user_name, is_anonymous, response, created_at, updated_at
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
	db := middleware.DBConn

	//Storage preparation
	var feedback model.FeedbackModel

	//validating user input in json
	if err := parseBody(c, &feedback); err != nil {
		return parseError(c, "failed to parse feedback", err)
	}

	if err := normalizeFeedback(&feedback); err != nil {
		return invalidRequest(c, err.Error())
	}

	now := time.Now()
	if feedback.CreatedAt.IsZero() {
		feedback.CreatedAt = now
	}
	feedback.UpdatedAt = now

	if err := db.Exec(
		`INSERT INTO `+feedbackTable+`
			(id, type, category, subject, message, status, priority, user_id, user_name, is_anonymous, response, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		feedback.ID,
		feedback.Type,
		feedback.Category,
		feedback.Subject,
		feedback.Message,
		feedback.Status,
		feedback.Priority,
		feedback.UserID,
		feedback.UserName,
		feedback.IsAnonymous,
		feedback.Response,
		feedback.CreatedAt,
		feedback.UpdatedAt,
	).Error; err != nil {
		return serverError(c, "failed to create feedback", err)
	}

	created, err := fetchFeedbackByID(feedback.ID)
	if err != nil {
		return serverError(c, "failed to fetch feedback", err)
	}

	return success(c, fiber.StatusCreated, created)
}

func UpdateFeedback(c *fiber.Ctx) error {
	db := middleware.DBConn

	var payload map[string]any
	if err := parseBody(c, &payload); err != nil {
		return parseError(c, "failed to parse feedback update", err)
	}

	// Only update fields that were actually sent by the client.
	var sets []string
	var args []any

	if raw, ok := payload["type"].(string); ok {
		sets = append(sets, "type = ?")
		args = append(args, strings.TrimSpace(raw))
	}
	if raw, ok := payload["category"].(string); ok {
		value := strings.TrimSpace(raw)
		if !validUnits[value] {
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
	args = append(args, time.Now(), c.Params("id"))

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

	updated, err := fetchFeedbackByID(c.Params("id"))
	if err != nil {
		return serverError(c, "failed to fetch feedback", err)
	}

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

	payload.ID = "USER-" + fmt.Sprintf("%d", time.Now().UnixMilli())
	now := time.Now()
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
	if !validUnits[payload.Unit] {
		return invalidRequest(c, "invalid admin unit")
	}

	payload.ID = "ADMIN-" + fmt.Sprintf("%d", time.Now().UnixMilli())
	now := time.Now()
	if err := db.Exec(
		`INSERT INTO `+adminTable+` (id, first_name, last_name, email, password, unit, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		payload.ID, payload.FirstName, payload.LastName, payload.Email, payload.Password, payload.Unit, now, now,
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

	return success(c, fiber.StatusOK, user)
}

func LoginAdmin(c *fiber.Ctx) error {
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
		`SELECT id, first_name, last_name, first_name || ' ' || last_name AS name, email, unit, created_at, updated_at
		FROM `+adminTable+` WHERE email = ? AND password = ?`,
		strings.TrimSpace(payload.Email),
		strings.TrimSpace(payload.Password),
	).Scan(&admin).Error; err != nil {
		return serverError(c, "failed to login admin", err)
	}
	if admin.ID == "" {
		return unauthorized(c, "invalid email or password")
	}

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

	expiresAt := time.Now().Add(superAdminTTL)
	return success(c, fiber.StatusOK, superAdminSession{
		Token:     issueSuperAdminToken(expiresAt),
		Username:  superAdminUsername(),
		ExpiresAt: expiresAt,
	})
}

func ListAdmins(c *fiber.Ctx) error {
	if err := requireSuperAdmin(c); err != nil {
		return err
	}

	var admins []model.AdminModel
	if err := middleware.DBConn.Raw(
		`SELECT id, first_name, last_name, first_name || ' ' || last_name AS name, email, unit, created_at, updated_at
		FROM ` + adminTable + ` ORDER BY unit ASC, first_name ASC, last_name ASC`,
	).Scan(&admins).Error; err != nil {
		return serverError(c, "failed to fetch admins", err)
	}

	return success(c, fiber.StatusOK, admins)
}

func CreateAdminBySuperAdmin(c *fiber.Ctx) error {
	if err := requireSuperAdmin(c); err != nil {
		return err
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
	if !validUnits[payload.Unit] {
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
	now := time.Now()
	if err := middleware.DBConn.Exec(
		`INSERT INTO `+adminTable+` (id, first_name, last_name, email, password, unit, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		payload.ID, payload.FirstName, payload.LastName, payload.Email, payload.Password, payload.Unit, now, now,
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
	if err := requireSuperAdmin(c); err != nil {
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
		sets = append(sets, "email = ?")
		args = append(args, value)
	}
	if value := strings.TrimSpace(payload.Unit); value != "" {
		if !validUnits[value] {
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
	args = append(args, time.Now())
	if err := execUpdateByID(adminTable, c.Params("id"), "failed to update admin", "admin not found", sets, args...); err != nil {
		return respondDBResult(c, err)
	}

	admin, err := fetchAdminByID(c.Params("id"))
	if err != nil {
		return serverError(c, "failed to fetch admin", err)
	}
	return success(c, fiber.StatusOK, admin)
}

func DeleteAdminBySuperAdmin(c *fiber.Ctx) error {
	if err := requireSuperAdmin(c); err != nil {
		return err
	}

	return deleteByID(c, adminTable, "admin", c.Params("id"))
}

func UpdateUserProfile(c *fiber.Ctx) error {
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

	if err := execUpdateByID(
		userTable,
		c.Params("id"),
		"failed to update user profile",
		"user not found",
		[]string{"first_name = ?", "last_name = ?", "updated_at = ?"},
		payload.FirstName, payload.LastName, time.Now(),
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

	if err := execUpdateByID(
		adminTable,
		c.Params("id"),
		"failed to update admin profile",
		"admin not found",
		[]string{"first_name = ?", "last_name = ?", "updated_at = ?"},
		payload.FirstName, payload.LastName, time.Now(),
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
	return updatePassword(c, userTable, "user")
}

func DeleteUserAccount(c *fiber.Ctx) error {
	return deleteByID(c, userTable, "user", c.Params("id"))
}

func UpdateAdminPassword(c *fiber.Ctx) error {
	return updatePassword(c, adminTable, "admin")
}

func DeleteAdminAccount(c *fiber.Ctx) error {
	return deleteByID(c, adminTable, "admin", c.Params("id"))
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
		payload.NewPassword, time.Now(), c.Params("id"), payload.CurrentPassword,
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
	var feedback model.FeedbackModel
	// Select explicit columns so the API only depends on fields the frontend uses.
	err := middleware.DBConn.Raw(
		`SELECT id, type, category, subject, message, status, priority, user_id, user_name, is_anonymous, response, created_at, updated_at
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

func fetchAdminByID(id string) (model.AdminModel, error) {
	var admin model.AdminModel
	// Compose the display name in SQL because the table stores first and last names separately.
	err := middleware.DBConn.Raw(
		`SELECT id, first_name, last_name, first_name || ' ' || last_name AS name, email, unit, created_at, updated_at
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
	if !validUnits[feedback.Category] {
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
