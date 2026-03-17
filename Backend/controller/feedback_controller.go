package controller

import (
	"fmt"
	"intern_template_v1/middleware"
	"intern_template_v1/model"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
)

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
		if isDisabledCategory(value) {
			return invalidRequest(c, "invalid feedback category")
		}
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
