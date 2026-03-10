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

var categoryTableInit sync.Once
var categoryTableInitErr error
var adminDisableColumnInit sync.Once
var adminDisableColumnErr error

// // This handler returns all student rows from the database as JSON.
// // It reads input from the request, talks to the database if needed, and then returns JSON or an error.
// func Getnames(c *fiber.Ctx) error {
// 	// We take the shared database connection that middleware already opened for us.
// 	// Think of this as the phone line to Postgres; without it, this handler cannot read or change any data.
// 	db := middleware.DBConn

// 	// This slice will hold the rows we read from the database.
// 	var data []map[string]any
// 	// We load all rows from public.students and scan them into data.
// 	if err := db.Raw("SELECT * FROM public.students").Scan(&data).Error; err != nil {
// 		// We return a server error because Getnames hit an internal failure (example: the database query for this handler failed).
// 		return serverError(c, "Server Failed", err)
// 	}

// 	// We return a success response with the data from Getnames so the client can update its view (example: Getnames returns the requested or updated resource).
// 	return success(c, fiber.StatusOK, data)
// }

// // This handler reads a list of items from the request body and inserts them into the database.
// // It reads input from the request, talks to the database if needed, and then returns JSON or an error.
// func InsertData(c *fiber.Ctx) error {
// 	// We take the shared database connection that middleware already opened for us.
// 	// Think of this as the phone line to Postgres; without it, this handler cannot read or change any data.
// 	db := middleware.DBConn

// 	// This slice will hold the list of items from the request body.
// 	var insertData []map[string]any
// 	// The HTTP request body arrives as raw bytes; parseBody turns that JSON into the Go value we pass in.
// 	// After this, we can read fields like email or password as normal Go variables instead of manually parsing JSON.
// 	if err := parseBody(c, &insertData); err != nil {
// 		// We return a parse error because InsertData could not decode the request body into the expected fields (example: invalid JSON or wrong field names/types).
// 		return parseError(c, "failed to parse data", err)
// 	}

// 	// We attempt to insert the provided list of rows using GORM's Create.
// 	if err := db.Exec("").Create(&insertData).Error; err != nil {
// 		// We return a server error because InsertData hit an internal failure (example: the database query for this handler failed).
// 		return serverError(c, "failed to insert data", err)
// 	}

// 	// We return a success response with the data from InsertData so the client can update its view (example: InsertData returns the requested or updated resource).
// 	return success(c, fiber.StatusOK, insertData)
// }

// // This handler updates a student record using the id and name provided in the request.
// // It reads input from the request, talks to the database if needed, and then returns JSON or an error.
// func UpdateExec(c *fiber.Ctx) error {
// 	// We take the shared database connection that middleware already opened for us.
// 	// Think of this as the phone line to Postgres; without it, this handler cannot read or change any data.
// 	db := middleware.DBConn

// 	// We decode the request body into a map so we can read "id" and "name" fields.
// 	var updateExec map[string]any
// 	// The HTTP request body arrives as raw bytes; parseBody turns that JSON into the Go value we pass in.
// 	// After this, we can read fields like email or password as normal Go variables instead of manually parsing JSON.
// 	if err := parseBody(c, &updateExec); err != nil {
// 		// We return a parse error because UpdateExec could not decode the request body into the expected fields (example: invalid JSON or wrong field names/types).
// 		return parseError(c, "Invalid parse request", err)
// 	}

// 	// We update the student's name for the given id.
// 	if err := db.Exec("UPDATE public.students SET name = ? WHERE students.id = ?", updateExec["name"], updateExec["id"]).Error; err != nil {
// 		// We return a server error because UpdateExec hit an internal failure (example: the database query for this handler failed).
// 		return serverError(c, "Internal Server error", err)
// 	}

// 	// We return a success response with the data from UpdateExec so the client can update its view (example: UpdateExec returns the requested or updated resource).
// 	return success(c, fiber.StatusCreated, updateExec)
// }

// // This handler inserts one student name into the database.
// // It reads input from the request, talks to the database if needed, and then returns JSON or an error.
// func InsertExec(c *fiber.Ctx) error {
// 	// We take the shared database connection that middleware already opened for us.
// 	// Think of this as the phone line to Postgres; without it, this handler cannot read or change any data.
// 	db := middleware.DBConn

// 	// We decode the request body into a map so we can read the "name" field.
// 	var insertExec map[string]any
// 	// The HTTP request body arrives as raw bytes; parseBody turns that JSON into the Go value we pass in.
// 	// After this, we can read fields like email or password as normal Go variables instead of manually parsing JSON.
// 	if err := parseBody(c, &insertExec); err != nil {
// 		// We return a parse error because InsertExec could not decode the request body into the expected fields (example: invalid JSON or wrong field names/types).
// 		return parseError(c, "Invalid parse request", err)
// 	}

// 	// We insert a single student row using the provided name.
// 	if err := db.Exec("INSERT INTO public.students (name) VALUES (?)", insertExec["name"]).Error; err != nil {
// 		// We return a server error because InsertExec hit an internal failure (example: the database query for this handler failed).
// 		return serverError(c, "Internal Server error", err)
// 	}

// 	// We return a success response with the data from InsertExec so the client can update its view (example: InsertExec returns the requested or updated resource).
// 	return success(c, fiber.StatusCreated, insertExec)
// }



// This handler returns feedback records and can filter them by category or by user id.
// It reads input from the request, talks to the database if needed, and then returns JSON or an error.
func GetFeedbacks(c *fiber.Ctx) error {
	// We take the shared database connection that middleware already opened for us.
	// Think of this as the phone line to Postgres; without it, this handler cannot read or change any data.
	db := middleware.DBConn

	// We build the SQL query in pieces so we can optionally filter by category or user.
	// This single handler can serve both admin views (filter by category) and user views (filter by user id).
	query := `SELECT id, type, category, subject, message, status, priority, user_id, user_name, is_anonymous, response, created_at, updated_at
		FROM ` + feedbackTable
	var args []any
	var conditions []string

	// We read the category filter from the query string and trim it.
	// If the caller did not provide a category, we skip this filter entirely.
	if category := strings.TrimSpace(c.Query("category")); category != "" {
		conditions = append(conditions, "LOWER(category) = LOWER(?)")
		args = append(args, category)
	}
	// We read the userId filter from the query string and trim it.
	// This lets a user see only their own feedback when they pass their user id.
	if userID := strings.TrimSpace(c.Query("userId")); userID != "" {
		conditions = append(conditions, "user_id = ?")
		args = append(args, userID)
	}
	// If we collected any filters, we join them with AND to form the WHERE clause.
	// This means all provided filters must match for a row to be returned.
	if len(conditions) > 0 {
		// We append the WHERE clause to the base query.
		// Doing it this way avoids writing many separate queries for each combination of filters.
		query += " WHERE " + strings.Join(conditions, " AND ")
	}
	// We sort by newest first so the UI shows the latest feedback at the top.
	query += " ORDER BY created_at DESC"

	var feedbacks []model.FeedbackModel
	// We run the assembled SELECT and scan the results into feedbacks.
	if err := db.Raw(query, args...).Scan(&feedbacks).Error; err != nil {
		// We return a server error because GetFeedbacks hit an internal failure (example: the database query for this handler failed).
		return serverError(c, "failed to fetch feedbacks", err)
	}

	// We return a success response with the data from GetFeedbacks so the client can update its view (example: GetFeedbacks returns the requested or updated resource).
	return success(c, fiber.StatusOK, feedbacks)
}

// This handler returns one feedback entry based on its id.
// It reads input from the request, talks to the database if needed, and then returns JSON or an error.
func GetFeedbackByID(c *fiber.Ctx) error {
	// We read the id from the URL path (for example, /feedbacks/{id}).
	// Then we fetch that specific feedback row from the database.
	feedback, err := fetchFeedbackByID(c.Params("id"))
	if err != nil {
		// We return not found because GetFeedbackByID could not find the requested record (example: no row matches the given id).
		return notFound(c, "feedback not found", err)
	}

	// We return a success response with the data from GetFeedbackByID so the client can update its view (example: GetFeedbackByID returns the requested or updated resource).
	return success(c, fiber.StatusOK, feedback)
}

// This handler validates a feedback payload, fills in defaults, stores it, and returns the saved row.
// It reads input from the request, talks to the database if needed, and then returns JSON or an error.
func CreateFeedback(c *fiber.Ctx) error {
	// We take the shared database connection that middleware already opened for us.
	// Think of this as the phone line to Postgres; without it, this handler cannot read or change any data.
	db := middleware.DBConn

	var feedback model.FeedbackModel

	if err := parseBody(c, &feedback); err != nil {
		// We return a parse error because CreateFeedback could not decode the request body into the expected fields (example: invalid JSON or wrong field names/types).
		return parseError(c, "failed to parse feedback", err)
	}

	// We normalize and validate the feedback so bad or incomplete data is rejected early.
	// This includes trimming text, checking required fields, and verifying allowed categories/statuses.
	if err := normalizeFeedback(&feedback); err != nil {
		// We return a validation error because CreateFeedback received input that failed required checks (example: missing fields or a value that is not allowed for this endpoint).
		return invalidRequest(c, err.Error())
	}

	// We read the current time once so all timestamps in this operation match exactly.
	// This prevents tiny differences between created_at and updated_at within the same request.
	now := time.Now()
	// If the request did not provide a timestamp, we set one ourselves using the current time.
	// This ensures the database row always has a valid created_at value.
	if feedback.CreatedAt.IsZero() {
		feedback.CreatedAt = now
	}
	// We always set updated_at to "now" because this is the moment we are saving the row.
	feedback.UpdatedAt = now

	// We insert the new feedback into the database using placeholders to avoid SQL injection.
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
		// We return a server error because CreateFeedback hit an internal failure (example: the database query for this handler failed).
		return serverError(c, "failed to create feedback", err)
	}

	created, err := fetchFeedbackByID(feedback.ID)
	if err != nil {
		// We return a server error because CreateFeedback hit an internal failure (example: the database query for this handler failed).
		return serverError(c, "failed to fetch feedback", err)
	}

	// We return a success response with the data from CreateFeedback so the client can update its view (example: CreateFeedback returns the requested or updated resource).
	return success(c, fiber.StatusCreated, created)
}

// This handler updates only the feedback fields provided by the client and returns the updated row.
// It reads input from the request, talks to the database if needed, and then returns JSON or an error.
func UpdateFeedback(c *fiber.Ctx) error {
	// We take the shared database connection that middleware already opened for us.
	// Think of this as the phone line to Postgres; without it, this handler cannot read or change any data.
	db := middleware.DBConn

	var payload map[string]any
	// The HTTP request body arrives as raw bytes; parseBody turns that JSON into the Go value we pass in.
	// After this, we can read fields like email or password as normal Go variables instead of manually parsing JSON.
	if err := parseBody(c, &payload); err != nil {
		// We return a parse error because UpdateFeedback could not decode the request body into the expected fields (example: invalid JSON or wrong field names/types).
		return parseError(c, "failed to parse feedback update", err)
	}

	var sets []string
	var args []any

	if raw, ok := payload["type"].(string); ok {
		// We add a SET clause for type because the client asked to update it.
		// The question mark is a placeholder so the database driver can safely insert the real value from args.
		sets = append(sets, "type = ?")
		// We trim spaces so " complaint " becomes "complaint" before saving.
		// This keeps the stored data clean and makes comparisons reliable later.
		args = append(args, strings.TrimSpace(raw))
	}
	// We look for the "category" key and make sure it is a string too.
	// If it is present, we also check that the category is valid before writing it to the database.
	if raw, ok := payload["category"].(string); ok {
		// We trim spaces so the category name is clean and predictable.
		// This avoids storing a category with accidental spaces that would not match later.
		value := strings.TrimSpace(raw)
		// We run a lookup against the categories table to confirm the name is valid before saving it.
		ok, err := categoryExists(value)
		if err != nil {
			// We stop here because the category check failed, which means we cannot be sure the data is valid.
			// We return a server error because UpdateFeedback could not complete an internal lookup (example: category lookup failed due to a database error).
			return serverError(c, "failed to validate feedback category", err)
		}
		if !ok {
			// We stop here because the client sent a category name we do not allow.
			// We return a clear validation error so the frontend can show a helpful message.
			return invalidRequest(c, "invalid feedback category")
		}
		// Now that the category is valid, we add it to the SQL update list and to the args list.
		sets = append(sets, "category = ?")
		args = append(args, value)
	}
	// We look for a "subject" field and update it only if the client sent it as a string.
	// This keeps us from overwriting existing data when the client did not intend to change it.
	if raw, ok := payload["subject"].(string); ok {
		// We add the SQL assignment for subject and store the cleaned value next to it in args.
		sets = append(sets, "subject = ?")
		args = append(args, strings.TrimSpace(raw))
	}
	// We look for a "message" field and update it only if the client sent it as a string.
	// Like the subject, this protects existing data from being overwritten by accident.
	if raw, ok := payload["message"].(string); ok {
		// We add the SQL assignment for message and store the cleaned value next to it in args.
		sets = append(sets, "message = ?")
		args = append(args, strings.TrimSpace(raw))
	}
	// We look for a "status" field and check it against the list of allowed values.
	// This stops us from saving a status that the system does not recognize.
	if raw, ok := payload["status"].(string); ok {
		// We trim spaces before validation so " Pending " becomes "Pending".
		value := strings.TrimSpace(raw)
		if !validStatuses[value] {
			// We stop here because the requested status is not in our approved list.
			// We return a validation error because UpdateFeedback only accepts specific status values (example: Pending, In Progress, or Resolved).
			return invalidRequest(c, "invalid feedback status")
		}
		// The status is valid, so we add it to the SQL update list and the args list.
		sets = append(sets, "status = ?")
		args = append(args, value)
	}
	// We look for a "priority" field and check it against the list of allowed values.
	// This prevents values like "Urgent" from being stored when only Low/Medium/High are allowed.
	if raw, ok := payload["priority"].(string); ok {
		// We trim spaces before validation to avoid false mismatches.
		value := strings.TrimSpace(raw)
		if !validPriorities[value] {
			// We stop here because the requested priority is not in our approved list.
			// We return a validation error because UpdateFeedback only accepts specific priority values (example: Low, Medium, or High).
			return invalidRequest(c, "invalid feedback priority")
		}
		// The priority is valid, so we add it to the SQL update list and the args list.
		sets = append(sets, "priority = ?")
		args = append(args, value)
	}
	// We check if the client included the "response" field, even if the value is empty.
	// This lets admins clear a response on purpose instead of being forced to keep the old one.
	if raw, exists := payload["response"]; exists {
		if raw == nil {
			// If the JSON explicitly sent null, we store an empty string to satisfy the NOT NULL rule.
			sets = append(sets, "response = ?")
			args = append(args, "")
		} else if value, ok := raw.(string); ok {
			// If the value is a string, we trim it and store it as the new response text.
			trimmed := strings.TrimSpace(value)
			sets = append(sets, "response = ?")
			args = append(args, trimmed)
		}
	}
	// We check for an "isAnonymous" boolean and update it only if the client provided a true/false value.
	// This ensures we do not accidentally change anonymity when the field was not sent.
	if raw, ok := payload["isAnonymous"].(bool); ok {
		sets = append(sets, "is_anonymous = ?")
		args = append(args, raw)
	}

	if len(sets) == 0 {
		// If the client did not send any updatable fields, we have nothing meaningful to write.
		// We return a validation error because UpdateFeedback requires at least one field to update (example: update request sent with no editable fields).
		return invalidRequest(c, "no fields provided for update")
	}

	// We always record the latest update time so the database knows when this row was last modified.
	// We add it here so it gets saved in the same UPDATE statement as the other fields.
	sets = append(sets, "updated_at = ?")
	// The last argument is the feedback id, which matches the final "WHERE id = ?" in the SQL below.
	args = append(args, time.Now(), c.Params("id"))

	// We build the full UPDATE SQL using the collected SET clauses, then pass all values in args.
	// Using placeholders keeps the SQL safe and lets the driver handle proper escaping.
	result := db.Exec(
		fmt.Sprintf("UPDATE %s SET %s WHERE id = ?", feedbackTable, strings.Join(sets, ", ")),
		args...,
	)
	if result.Error != nil {
		// We return a server error because UpdateFeedback hit an internal failure (example: the database query for this handler failed).
		return serverError(c, "failed to update feedback", result.Error)
	}
	// If no rows were changed, it means the id did not match any row in the database.
	// In that case, we return a not found response instead of pretending it worked.
	if result.RowsAffected == 0 {
		// We return not found because UpdateFeedback could not find the requested record (example: no row matches the given id).
		return notFound(c, "feedback not found", nil)
	}

	updated, err := fetchFeedbackByID(c.Params("id"))
	if err != nil {
		// We return a server error because UpdateFeedback hit an internal failure (example: the database query for this handler failed).
		return serverError(c, "failed to fetch feedback", err)
	}

	// We return a success response with the data from UpdateFeedback so the client can update its view (example: UpdateFeedback returns the requested or updated resource).
	return success(c, fiber.StatusOK, updated)
}

// This handler deletes a feedback entry by id.
// It reads input from the request, talks to the database if needed, and then returns JSON or an error.
func DeleteFeedback(c *fiber.Ctx) error {
	// We delegate to a shared delete helper so delete behavior stays consistent.
	// The helper will return a 404 if the id does not exist and 200 if the delete succeeds.
	return deleteByID(c, feedbackTable, "feedback", c.Params("id"))
}

// This handler creates a new user after validating required fields and email uniqueness.
// It reads input from the request, talks to the database if needed, and then returns JSON or an error.
func RegisterUser(c *fiber.Ctx) error {
	// We take the shared database connection that middleware already opened for us.
	// Think of this as the phone line to Postgres; without it, this handler cannot read or change any data.
	db := middleware.DBConn

	var payload model.UserModel

	if err := parseBody(c, &payload); err != nil {
		// We return a parse error because RegisterUser could not decode the request body into the expected fields (example: invalid JSON or wrong field names/types).
		return parseError(c, "failed to parse user", err)
	}

	// We trim each text field so validation is accurate and data stays clean.
	// This avoids storing accidental spaces and makes empty fields truly empty.
	payload.FirstName = strings.TrimSpace(payload.FirstName)
	payload.LastName = strings.TrimSpace(payload.LastName)
	payload.Email = strings.TrimSpace(payload.Email)
	payload.Password = strings.TrimSpace(payload.Password)
	// If any required field is missing, we stop early and tell the client.
	if payload.FirstName == "" || payload.LastName == "" || payload.Email == "" || payload.Password == "" {
		// We return a validation error because RegisterUser received input that failed required checks (example: missing fields or a value that is not allowed for this endpoint).
		return invalidRequest(c, "missing required user fields")
	}

	// We make sure the email is not already used by another user or admin.
	inUse, err := emailInUse(payload.Email, "", "")
	if err != nil {
		// We return a server error because RegisterUser hit an internal failure (example: the database query for this handler failed).
		return serverError(c, "failed to validate email", err)
	}
	if inUse {
		// We return a validation error because RegisterUser received input that failed required checks (example: missing fields or a value that is not allowed for this endpoint).
		return invalidRequest(c, "email is already in use")
	}

	// We generate a simple unique id using the current time in milliseconds.
	// This keeps ids readable and consistent with the existing format.
	payload.ID = "USER-" + fmt.Sprintf("%d", time.Now().UnixMilli())
	// We read the current time once so all timestamps in this operation match exactly.
	// This prevents tiny differences between created_at and updated_at within the same request.
	now := time.Now()
	// We insert the new user into the database using placeholders for safety.
	if err := db.Exec(
		`INSERT INTO `+userTable+` (id, first_name, last_name, email, password, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?)`,
		payload.ID, payload.FirstName, payload.LastName, payload.Email, payload.Password, now, now,
	).Error; err != nil {
		// We return a server error because RegisterUser hit an internal failure (example: the database query for this handler failed).
		return serverError(c, "failed to register user", err)
	}

	user, err := fetchUserByID(payload.ID)
	if err != nil {
		// We return a server error because RegisterUser hit an internal failure (example: the database query for this handler failed).
		return serverError(c, "failed to fetch user", err)
	}
	// We return a success response with the data from RegisterUser so the client can update its view (example: RegisterUser returns the requested or updated resource).
	return success(c, fiber.StatusCreated, user)
}

// This handler creates a new admin after validating fields, email, and unit.
// It reads input from the request, talks to the database if needed, and then returns JSON or an error.
func RegisterAdmin(c *fiber.Ctx) error {
	// We take the shared database connection that middleware already opened for us.
	// Think of this as the phone line to Postgres; without it, this handler cannot read or change any data.
	db := middleware.DBConn
	// We make sure the admins table has the is_disabled column before we insert a new admin.
	if err := ensureAdminDisableColumn(); err != nil {
		// We return a server error because RegisterAdmin hit an internal failure (example: the database query for this handler failed).
		return serverError(c, "failed to initialize admin access state", err)
	}

	var payload model.AdminModel

	if err := parseBody(c, &payload); err != nil {
		// We return a parse error because RegisterAdmin could not decode the request body into the expected fields (example: invalid JSON or wrong field names/types).
		return parseError(c, "failed to parse admin", err)
	}

	// We trim each text field so validation is accurate and data stays clean.
	payload.FirstName = strings.TrimSpace(payload.FirstName)
	payload.LastName = strings.TrimSpace(payload.LastName)
	payload.Email = strings.TrimSpace(payload.Email)
	payload.Password = strings.TrimSpace(payload.Password)
	payload.Unit = strings.TrimSpace(payload.Unit)
	// If any required field is missing, we stop early and tell the client.
	if payload.FirstName == "" || payload.LastName == "" || payload.Email == "" || payload.Password == "" || payload.Unit == "" {
		// We return a validation error because RegisterAdmin received input that failed required checks (example: missing fields or a value that is not allowed for this endpoint).
		return invalidRequest(c, "missing required admin fields")
	}

	// We make sure the email is not already used by another user or admin.
	inUse, err := emailInUse(payload.Email, "", "")
	if err != nil {
		// We return a server error because RegisterAdmin hit an internal failure (example: the database query for this handler failed).
		return serverError(c, "failed to validate email", err)
	}
	if inUse {
		// We return a validation error because RegisterAdmin received input that failed required checks (example: missing fields or a value that is not allowed for this endpoint).
		return invalidRequest(c, "email is already in use")
	}

	// We check that the unit/category exists in the categories table.
	unitExists, err := categoryExists(payload.Unit)
	if err != nil {
		// We return a server error because RegisterAdmin hit an internal failure (example: the database query for this handler failed).
		return serverError(c, "failed to validate admin unit", err)
	}
	if !unitExists {
		// We return a validation error because RegisterAdmin received input that failed required checks (example: missing fields or a value that is not allowed for this endpoint).
		return invalidRequest(c, "invalid admin unit")
	}

	// We generate a new admin id using the current time in milliseconds.
	payload.ID = "ADMIN-" + fmt.Sprintf("%d", time.Now().UnixMilli())
	// We read the current time once so all timestamps in this operation match exactly.
	// This prevents tiny differences between created_at and updated_at within the same request.
	now := time.Now()
	// We insert the new admin into the database using placeholders for safety.
	if err := db.Exec(
		`INSERT INTO `+adminTable+` (id, first_name, last_name, email, password, unit, is_disabled, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		payload.ID, payload.FirstName, payload.LastName, payload.Email, payload.Password, payload.Unit, false, now, now,
	).Error; err != nil {
		// We return a server error because RegisterAdmin hit an internal failure (example: the database query for this handler failed).
		return serverError(c, "failed to register admin", err)
	}

	admin, err := fetchAdminByID(payload.ID)
	if err != nil {
		// We return a server error because RegisterAdmin hit an internal failure (example: the database query for this handler failed).
		return serverError(c, "failed to fetch admin", err)
	}
	// We return a success response with the data from RegisterAdmin so the client can update its view (example: RegisterAdmin returns the requested or updated resource).
	return success(c, fiber.StatusCreated, admin)
}

// This handler checks a user email and password and returns the user if they match.
// It reads input from the request, talks to the database if needed, and then returns JSON or an error.
func LoginUser(c *fiber.Ctx) error {
	var payload struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}

	// We parse the login JSON so we can read the email and password fields.
	if err := parseBody(c, &payload); err != nil {
		// We return a parse error because LoginUser could not decode the request body into the expected fields (example: invalid JSON or wrong field names/types).
		return parseError(c, "failed to parse login", err)
	}

	var user model.UserModel
	// We query the users table for a row that matches this email and password.
	// If no row matches, the credentials are invalid.
	if err := middleware.DBConn.Raw(
		`SELECT id, first_name, last_name, first_name || ' ' || last_name AS name, email, created_at, updated_at
		FROM `+userTable+` WHERE email = ? AND password = ?`,
		// We remove spaces from the beginning and end of the text.
		// This treats inputs like "  name  " the same as "name" and prevents accidental whitespace from being stored.
		strings.TrimSpace(payload.Email),
		// We remove spaces from the beginning and end of the text.
		// This treats inputs like "  name  " the same as "name" and prevents accidental whitespace from being stored.
		strings.TrimSpace(payload.Password),
	).Scan(&user).Error; err != nil {
		// We return a server error because LoginUser hit an internal failure (example: the database query for this handler failed).
		return serverError(c, "failed to login user", err)
	}
	if user.ID == "" {
		// If the database returned no row, the email/password pair is wrong.
		// We return unauthorized because LoginUser could not validate credentials or access state (example: wrong password or disabled account).
		return unauthorized(c, "invalid email or password")
	}

	// We return a success response with the data from LoginUser so the client can update its view (example: LoginUser returns the requested or updated resource).
	return success(c, fiber.StatusOK, user)
}

// This handler checks an admin email and password and blocks disabled admins.
// It reads input from the request, talks to the database if needed, and then returns JSON or an error.
func LoginAdmin(c *fiber.Ctx) error {
	// We ensure the is_disabled column exists because we need it to block disabled admins.
	if err := ensureAdminDisableColumn(); err != nil {
		// We return a server error because LoginAdmin hit an internal failure (example: the database query for this handler failed).
		return serverError(c, "failed to initialize admin access state", err)
	}

	var payload struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}

	// We parse the login JSON so we can read the email and password fields.
	if err := parseBody(c, &payload); err != nil {
		// We return a parse error because LoginAdmin could not decode the request body into the expected fields (example: invalid JSON or wrong field names/types).
		return parseError(c, "failed to parse login", err)
	}

	var admin model.AdminModel
	// We query the admins table for a row that matches this email and password.
	// We also read the is_disabled flag so we can block disabled accounts.
	if err := middleware.DBConn.Raw(
		`SELECT id, first_name, last_name, first_name || ' ' || last_name AS name, email, unit, COALESCE(is_disabled, FALSE) AS is_disabled, created_at, updated_at
		FROM `+adminTable+` WHERE email = ? AND password = ?`,
		// We remove spaces from the beginning and end of the text.
		// This treats inputs like "  name  " the same as "name" and prevents accidental whitespace from being stored.
		strings.TrimSpace(payload.Email),
		// We remove spaces from the beginning and end of the text.
		// This treats inputs like "  name  " the same as "name" and prevents accidental whitespace from being stored.
		strings.TrimSpace(payload.Password),
	).Scan(&admin).Error; err != nil {
		// We return a server error because LoginAdmin hit an internal failure (example: the database query for this handler failed).
		return serverError(c, "failed to login admin", err)
	}
	if admin.ID == "" {
		// If the database returned no row, the email/password pair is wrong.
		// We return unauthorized because LoginAdmin could not validate credentials or access state (example: wrong password or disabled account).
		return unauthorized(c, "invalid email or password")
	}
	if admin.IsDisabled {
		// Disabled admins are not allowed to log in even if their password is correct.
		// We return unauthorized because LoginAdmin could not validate credentials or access state (example: wrong password or disabled account).
		return unauthorized(c, "admin account is disabled")
	}

	// We return a success response with the data from LoginAdmin so the client can update its view (example: LoginAdmin returns the requested or updated resource).
	return success(c, fiber.StatusOK, admin)
}

// This handler checks superadmin credentials and issues a short-lived token.
// It reads input from the request, talks to the database if needed, and then returns JSON or an error.
func LoginSuperAdmin(c *fiber.Ctx) error {
	var payload struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}

	// The HTTP request body arrives as raw bytes; parseBody turns that JSON into the Go value we pass in.
	// After this, we can read fields like email or password as normal Go variables instead of manually parsing JSON.
	if err := parseBody(c, &payload); err != nil {
		// We return a parse error because LoginSuperAdmin could not decode the request body into the expected fields (example: invalid JSON or wrong field names/types).
		return parseError(c, "failed to parse superadmin login", err)
	}

	// We remove spaces from the beginning and end of the text.
	// This treats inputs like "  name  " the same as "name" and prevents accidental whitespace from being stored.
	// We compare the trimmed input to the configured superadmin credentials.
	if strings.TrimSpace(payload.Username) != superAdminUsername() || strings.TrimSpace(payload.Password) != superAdminPassword() {
		// We return unauthorized because LoginSuperAdmin could not validate credentials or access state (example: wrong password or disabled account).
		return unauthorized(c, "invalid superadmin credentials")
	}

	// We create a short-lived token so the superadmin can access protected endpoints.
	expiresAt := time.Now().Add(superAdminTTL)
	// We return a success response with the data from LoginSuperAdmin so the client can update its view (example: LoginSuperAdmin returns the requested or updated resource).
	return success(c, fiber.StatusOK, superAdminSession{
		Token:     issueSuperAdminToken(expiresAt),
		Username:  superAdminUsername(),
		ExpiresAt: expiresAt,
	})
}

// This handler returns the list of categories.
// It reads input from the request, talks to the database if needed, and then returns JSON or an error.
func ListCategories(c *fiber.Ctx) error {
	// We read the categories from the database using the shared helper.
	categories, err := listCategories()
	if err != nil {
		// We return a server error because ListCategories hit an internal failure (example: the database query for this handler failed).
		return serverError(c, "failed to fetch categories", err)
	}

	// We return a success response with the data from ListCategories so the client can update its view (example: ListCategories returns the requested or updated resource).
	return success(c, fiber.StatusOK, categories)
}

// This handler allows the superadmin to create a new category and sync constraints.
// It reads input from the request, talks to the database if needed, and then returns JSON or an error.
func CreateCategoryBySuperAdmin(c *fiber.Ctx) error {
	// Only superadmin is allowed to create categories, so we verify the token first.
	if err := requireSuperAdmin(c); err != nil {
		return err
	}

	// Make sure the category table exists before we try to insert into it.
	if err := ensureCategoryStore(); err != nil {
		// We return a server error because CreateCategoryBySuperAdmin hit an internal failure (example: the database query for this handler failed).
		return serverError(c, "failed to initialize categories", err)
	}

	var payload struct {
		Name string `json:"name"`
	}
	// The HTTP request body arrives as raw bytes; parseBody turns that JSON into the Go value we pass in.
	// After this, we can read fields like email or password as normal Go variables instead of manually parsing JSON.
	if err := parseBody(c, &payload); err != nil {
		// We return a parse error because CreateCategoryBySuperAdmin could not decode the request body into the expected fields (example: invalid JSON or wrong field names/types).
		return parseError(c, "failed to parse category", err)
	}

	// We trim the category name so we do not store accidental spaces.
	name := strings.TrimSpace(payload.Name)
	// If the name is empty after trimming, we cannot create a category.
	if name == "" {
		// We return a validation error because CreateCategoryBySuperAdmin received input that failed required checks (example: missing fields or a value that is not allowed for this endpoint).
		return invalidRequest(c, "category name is required")
	}

	// We check if the category already exists so we do not create duplicates.
	exists, err := categoryExists(name)
	if err != nil {
		// We return a server error because CreateCategoryBySuperAdmin hit an internal failure (example: the database query for this handler failed).
		return serverError(c, "failed to validate category", err)
	}
	if exists {
		// We return a validation error because CreateCategoryBySuperAdmin received input that failed required checks (example: missing fields or a value that is not allowed for this endpoint).
		return invalidRequest(c, "category already exists")
	}

	// We insert the new category row with timestamps.
	if err := middleware.DBConn.Exec(
		`INSERT INTO `+categoryTable+` (name, created_at, updated_at) VALUES (?, ?, ?)`,
		name, time.Now(), time.Now(),
	).Error; err != nil {
		// We return a server error because CreateCategoryBySuperAdmin hit an internal failure (example: the database query for this handler failed).
		return serverError(c, "failed to create category", err)
	}

	// We rebuild the database CHECK constraints so the new category is considered valid.
	if err := syncCategoryConstraints(); err != nil {
		// We return a server error because CreateCategoryBySuperAdmin hit an internal failure (example: the database query for this handler failed).
		return serverError(c, "failed to sync category constraints", err)
	}

	// We return the full refreshed list so the UI can update immediately.
	categories, err := listCategories()
	if err != nil {
		// We return a server error because CreateCategoryBySuperAdmin hit an internal failure (example: the database query for this handler failed).
		return serverError(c, "failed to fetch categories", err)
	}

	// We return a success response with the data from CreateCategoryBySuperAdmin so the client can update its view (example: CreateCategoryBySuperAdmin returns the requested or updated resource).
	return success(c, fiber.StatusCreated, categories)
}

// This handler allows the superadmin to rename a category and sync related data.
// It reads input from the request, talks to the database if needed, and then returns JSON or an error.
func UpdateCategoryBySuperAdmin(c *fiber.Ctx) error {
	// Only superadmin is allowed to rename categories, so we check the token first.
	if err := requireSuperAdmin(c); err != nil {
		return err
	}

	// Make sure the category table exists before we try to read or update it.
	if err := ensureCategoryStore(); err != nil {
		// We return a server error because UpdateCategoryBySuperAdmin hit an internal failure (example: the database query for this handler failed).
		return serverError(c, "failed to initialize categories", err)
	}

	// We read the category id from the URL and convert it to a number.
	categoryID, err := strconv.Atoi(strings.TrimSpace(c.Params("id")))
	if err != nil || categoryID <= 0 {
		// We return a validation error because UpdateCategoryBySuperAdmin received input that failed required checks (example: missing fields or a value that is not allowed for this endpoint).
		return invalidRequest(c, "invalid category id")
	}

	var payload struct {
		Name string `json:"name"`
	}
	// The HTTP request body arrives as raw bytes; parseBody turns that JSON into the Go value we pass in.
	// After this, we can read fields like email or password as normal Go variables instead of manually parsing JSON.
	if err := parseBody(c, &payload); err != nil {
		// We return a parse error because UpdateCategoryBySuperAdmin could not decode the request body into the expected fields (example: invalid JSON or wrong field names/types).
		return parseError(c, "failed to parse category update", err)
	}

	// We trim the new name so we do not store accidental spaces.
	newName := strings.TrimSpace(payload.Name)
	if newName == "" {
		// We return a validation error because UpdateCategoryBySuperAdmin received input that failed required checks (example: missing fields or a value that is not allowed for this endpoint).
		return invalidRequest(c, "category name is required")
	}

	var existing model.CategoryModel
	// We fetch the existing category so we can check if it exists and compare the name.
	if err := middleware.DBConn.Raw(
		`SELECT id, name, created_at, updated_at FROM `+categoryTable+` WHERE id = ?`,
		categoryID,
	).Scan(&existing).Error; err != nil {
		// We return a server error because UpdateCategoryBySuperAdmin hit an internal failure (example: the database query for this handler failed).
		return serverError(c, "failed to fetch category", err)
	}
	if existing.ID == 0 {
		// We return not found because UpdateCategoryBySuperAdmin could not find the requested record (example: no row matches the given id).
		return notFound(c, "category not found", nil)
	}

	// If the new name is the same as the old name (case-insensitive), we can return early.
	if strings.EqualFold(existing.Name, newName) {
		categories, listErr := listCategories()
		if listErr != nil {
			// We return a server error because UpdateCategoryBySuperAdmin hit an internal failure (example: the database query for this handler failed).
			return serverError(c, "failed to fetch categories", listErr)
		}
		// We return a success response with the data from UpdateCategoryBySuperAdmin so the client can update its view (example: UpdateCategoryBySuperAdmin returns the requested or updated resource).
		return success(c, fiber.StatusOK, categories)
	}

	// We check that the new name is not already used by another category.
	exists, err := categoryExists(newName)
	if err != nil {
		// We return a server error because UpdateCategoryBySuperAdmin hit an internal failure (example: the database query for this handler failed).
		return serverError(c, "failed to validate category", err)
	}
	if exists {
		// We return a validation error because UpdateCategoryBySuperAdmin received input that failed required checks (example: missing fields or a value that is not allowed for this endpoint).
		return invalidRequest(c, "category already exists")
	}

	// We use a transaction so the category, admin units, and feedback categories change together.
	tx := middleware.DBConn.Begin()
	if tx.Error != nil {
		// We return a server error because UpdateCategoryBySuperAdmin hit an internal failure (example: the database query for this handler failed).
		return serverError(c, "failed to start category update", tx.Error)
	}

	// First we rename the category row itself.
	if err := tx.Exec(
		`UPDATE `+categoryTable+` SET name = ?, updated_at = ? WHERE id = ?`,
		newName, time.Now(), categoryID,
	).Error; err != nil {
		tx.Rollback()
		// We return a server error because UpdateCategoryBySuperAdmin hit an internal failure (example: the database query for this handler failed).
		return serverError(c, "failed to update category", err)
	}

	// Then we update any admins that reference the old category name.
	if err := tx.Exec(
		`UPDATE `+adminTable+` SET unit = ?, updated_at = ? WHERE unit = ?`,
		newName, time.Now(), existing.Name,
	).Error; err != nil {
		tx.Rollback()
		// We return a server error because UpdateCategoryBySuperAdmin hit an internal failure (example: the database query for this handler failed).
		return serverError(c, "failed to sync admin units", err)
	}

	// Finally we update any feedback rows that reference the old category name.
	if err := tx.Exec(
		`UPDATE `+feedbackTable+` SET category = ?, updated_at = ? WHERE category = ?`,
		newName, time.Now(), existing.Name,
	).Error; err != nil {
		tx.Rollback()
		// We return a server error because UpdateCategoryBySuperAdmin hit an internal failure (example: the database query for this handler failed).
		return serverError(c, "failed to sync feedback categories", err)
	}

	// We commit the transaction so all changes become permanent.
	if err := tx.Commit().Error; err != nil {
		// We return a server error because UpdateCategoryBySuperAdmin hit an internal failure (example: the database query for this handler failed).
		return serverError(c, "failed to finalize category update", err)
	}

	// We rebuild the database CHECK constraints to include the new category name.
	if err := syncCategoryConstraints(); err != nil {
		// We return a server error because UpdateCategoryBySuperAdmin hit an internal failure (example: the database query for this handler failed).
		return serverError(c, "failed to sync category constraints", err)
	}

	// Return the refreshed list so the UI can update immediately.
	categories, listErr := listCategories()
	if listErr != nil {
		// We return a server error because UpdateCategoryBySuperAdmin hit an internal failure (example: the database query for this handler failed).
		return serverError(c, "failed to fetch categories", listErr)
	}

	// We return a success response with the data from UpdateCategoryBySuperAdmin so the client can update its view (example: UpdateCategoryBySuperAdmin returns the requested or updated resource).
	return success(c, fiber.StatusOK, categories)
}

// This handler allows the superadmin to delete a category if it is safe to do so.
// It reads input from the request, talks to the database if needed, and then returns JSON or an error.
func DeleteCategoryBySuperAdmin(c *fiber.Ctx) error {
	// Only superadmin can delete categories, so we validate the token first.
	if err := requireSuperAdmin(c); err != nil {
		return err
	}

	// Make sure the category table exists before we try to delete from it.
	if err := ensureCategoryStore(); err != nil {
		// We return a server error because DeleteCategoryBySuperAdmin hit an internal failure (example: the database query for this handler failed).
		return serverError(c, "failed to initialize categories", err)
	}

	// We parse the category id from the URL so we know which row to delete.
	categoryID, err := strconv.Atoi(strings.TrimSpace(c.Params("id")))
	if err != nil || categoryID <= 0 {
		// We return a validation error because DeleteCategoryBySuperAdmin received input that failed required checks (example: missing fields or a value that is not allowed for this endpoint).
		return invalidRequest(c, "invalid category id")
	}

	var existing model.CategoryModel
	// We load the category to make sure it exists before attempting deletion.
	if err := middleware.DBConn.Raw(
		`SELECT id, name, created_at, updated_at FROM `+categoryTable+` WHERE id = ?`,
		categoryID,
	).Scan(&existing).Error; err != nil {
		// We return a server error because DeleteCategoryBySuperAdmin hit an internal failure (example: the database query for this handler failed).
		return serverError(c, "failed to fetch category", err)
	}
	if existing.ID == 0 {
		// We return not found because DeleteCategoryBySuperAdmin could not find the requested record (example: no row matches the given id).
		return notFound(c, "category not found", nil)
	}

	// We check if the category is still used by any admins or feedbacks.
	// If it is in use, we refuse to delete to avoid breaking references.
	inUse, err := categoryInUse(existing.Name)
	if err != nil {
		// We return a server error because DeleteCategoryBySuperAdmin hit an internal failure (example: the database query for this handler failed).
		return serverError(c, "failed to validate category usage", err)
	}
	if inUse {
		// We return a validation error because DeleteCategoryBySuperAdmin received input that failed required checks (example: missing fields or a value that is not allowed for this endpoint).
		return invalidRequest(c, "category is in use by admin accounts or feedbacks")
	}

	var categoryCount int64
	// We count how many categories exist so we don't delete the last remaining one.
	if err := middleware.DBConn.Raw(`SELECT COUNT(*) FROM ` + categoryTable).Scan(&categoryCount).Error; err != nil {
		// We return a server error because DeleteCategoryBySuperAdmin hit an internal failure (example: the database query for this handler failed).
		return serverError(c, "failed to validate category count", err)
	}
	if categoryCount <= 1 {
		// We return a validation error because DeleteCategoryBySuperAdmin received input that failed required checks (example: missing fields or a value that is not allowed for this endpoint).
		return invalidRequest(c, "at least one category is required")
	}

	// We delete the category row now that we know it is safe.
	if err := middleware.DBConn.Exec(
		`DELETE FROM `+categoryTable+` WHERE id = ?`,
		categoryID,
	).Error; err != nil {
		// We return a server error because DeleteCategoryBySuperAdmin hit an internal failure (example: the database query for this handler failed).
		return serverError(c, "failed to delete category", err)
	}

	if err := syncCategoryConstraints(); err != nil {
		// We return a server error because DeleteCategoryBySuperAdmin hit an internal failure (example: the database query for this handler failed).
		return serverError(c, "failed to sync category constraints", err)
	}

	categories, err := listCategories()
	if err != nil {
		// We return a server error because DeleteCategoryBySuperAdmin hit an internal failure (example: the database query for this handler failed).
		return serverError(c, "failed to fetch categories", err)
	}

	// We return a success response with the data from DeleteCategoryBySuperAdmin so the client can update its view (example: DeleteCategoryBySuperAdmin returns the requested or updated resource).
	return success(c, fiber.StatusOK, categories)
}

// This handler returns all admin accounts for the superadmin.
// It reads input from the request, talks to the database if needed, and then returns JSON or an error.
func ListAdmins(c *fiber.Ctx) error {
	// Only superadmin can see the full admin list, so we check the token first.
	if err := requireSuperAdmin(c); err != nil {
		return err
	}
	// Ensure the is_disabled column exists because we read it in the SELECT.
	if err := ensureAdminDisableColumn(); err != nil {
		// We return a server error because ListAdmins hit an internal failure (example: the database query for this handler failed).
		return serverError(c, "failed to initialize admin access state", err)
	}

	var admins []model.AdminModel
	// We select all admin accounts, ordering by unit and name so the list is stable.
	if err := middleware.DBConn.Raw(
		`SELECT id, first_name, last_name, first_name || ' ' || last_name AS name, email, unit, COALESCE(is_disabled, FALSE) AS is_disabled, created_at, updated_at
		FROM ` + adminTable + ` ORDER BY unit ASC, first_name ASC, last_name ASC`,
	).Scan(&admins).Error; err != nil {
		// We return a server error because ListAdmins hit an internal failure (example: the database query for this handler failed).
		return serverError(c, "failed to fetch admins", err)
	}

	// We return a success response with the data from ListAdmins so the client can update its view (example: ListAdmins returns the requested or updated resource).
	return success(c, fiber.StatusOK, admins)
}

// This handler allows the superadmin to create a new admin account.
// It reads input from the request, talks to the database if needed, and then returns JSON or an error.
func CreateAdminBySuperAdmin(c *fiber.Ctx) error {
	// Only superadmin can create admin accounts, so we verify the token first.
	if err := requireSuperAdmin(c); err != nil {
		return err
	}
	// Ensure the is_disabled column exists because we will set it on insert.
	if err := ensureAdminDisableColumn(); err != nil {
		// We return a server error because CreateAdminBySuperAdmin hit an internal failure (example: the database query for this handler failed).
		return serverError(c, "failed to initialize admin access state", err)
	}

	var payload model.AdminModel
	// The HTTP request body arrives as raw bytes; parseBody turns that JSON into the Go value we pass in.
	// After this, we can read fields like email or password as normal Go variables instead of manually parsing JSON.
	if err := parseBody(c, &payload); err != nil {
		// We return a parse error because CreateAdminBySuperAdmin could not decode the request body into the expected fields (example: invalid JSON or wrong field names/types).
		return parseError(c, "failed to parse admin", err)
	}

	// We trim each text field so validation is accurate and data stays clean.
	payload.FirstName = strings.TrimSpace(payload.FirstName)
	payload.LastName = strings.TrimSpace(payload.LastName)
	payload.Email = strings.TrimSpace(payload.Email)
	payload.Password = strings.TrimSpace(payload.Password)
	payload.Unit = strings.TrimSpace(payload.Unit)

	// If any required field is missing, we stop early and tell the client.
	if payload.FirstName == "" || payload.LastName == "" || payload.Email == "" || payload.Password == "" || payload.Unit == "" {
		// We return a validation error because CreateAdminBySuperAdmin received input that failed required checks (example: missing fields or a value that is not allowed for this endpoint).
		return invalidRequest(c, "missing required admin fields")
	}

	// We make sure the email is not already used by another user or admin.
	inUse, err := emailInUse(payload.Email, "", "")
	if err != nil {
		// We return a server error because CreateAdminBySuperAdmin hit an internal failure (example: the database query for this handler failed).
		return serverError(c, "failed to validate email", err)
	}
	if inUse {
		// We return a validation error because CreateAdminBySuperAdmin received input that failed required checks (example: missing fields or a value that is not allowed for this endpoint).
		return invalidRequest(c, "email is already in use")
	}

	// We check that the unit/category exists in the categories table.
	unitExists, err := categoryExists(payload.Unit)
	if err != nil {
		// We return a server error because CreateAdminBySuperAdmin hit an internal failure (example: the database query for this handler failed).
		return serverError(c, "failed to validate admin unit", err)
	}
	if !unitExists {
		// We return a validation error because CreateAdminBySuperAdmin received input that failed required checks (example: missing fields or a value that is not allowed for this endpoint).
		return invalidRequest(c, "invalid admin unit")
	}

	// We check that no other admin already owns this unit.
	taken, err := adminUnitTaken(payload.Unit, "")
	if err != nil {
		// We return a server error because CreateAdminBySuperAdmin hit an internal failure (example: the database query for this handler failed).
		return serverError(c, "failed to validate admin unit", err)
	}
	if taken {
		// We return a validation error because CreateAdminBySuperAdmin received input that failed required checks (example: missing fields or a value that is not allowed for this endpoint).
		return invalidRequest(c, "selected unit already has an admin")
	}

	// We generate a new admin id using the current time in milliseconds.
	payload.ID = "ADMIN-" + fmt.Sprintf("%d", time.Now().UnixMilli())
	// We read the current time once so all timestamps in this operation match exactly.
	// This prevents tiny differences between created_at and updated_at within the same request.
	now := time.Now()
	// We insert the new admin into the database with is_disabled set to false.
	if err := middleware.DBConn.Exec(
		`INSERT INTO `+adminTable+` (id, first_name, last_name, email, password, unit, is_disabled, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		payload.ID, payload.FirstName, payload.LastName, payload.Email, payload.Password, payload.Unit, false, now, now,
	).Error; err != nil {
		// We return a server error because CreateAdminBySuperAdmin hit an internal failure (example: the database query for this handler failed).
		return serverError(c, "failed to create admin", err)
	}

	admin, err := fetchAdminByID(payload.ID)
	if err != nil {
		// We return a server error because CreateAdminBySuperAdmin hit an internal failure (example: the database query for this handler failed).
		return serverError(c, "failed to fetch admin", err)
	}
	// We return a success response with the data from CreateAdminBySuperAdmin so the client can update its view (example: CreateAdminBySuperAdmin returns the requested or updated resource).
	return success(c, fiber.StatusCreated, admin)
}

// This handler allows the superadmin to update an existing admin account.
// It reads input from the request, talks to the database if needed, and then returns JSON or an error.
func UpdateAdminBySuperAdmin(c *fiber.Ctx) error {
	// Only superadmin can update admin accounts, so we verify the token first.
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
	// The HTTP request body arrives as raw bytes; parseBody turns that JSON into the Go value we pass in.
	// After this, we can read fields like email or password as normal Go variables instead of manually parsing JSON.
	if err := parseBody(c, &payload); err != nil {
		// We return a parse error because UpdateAdminBySuperAdmin could not decode the request body into the expected fields (example: invalid JSON or wrong field names/types).
		return parseError(c, "failed to parse admin update", err)
	}

	// We build the UPDATE statement in pieces so we only change fields that were provided.
	// The sets slice holds "column = ?" strings, and args holds the matching values.
	var sets []string
	var args []any

	// We remove spaces from the beginning and end of the text.
	// This treats inputs like "  name  " the same as "name" and prevents accidental whitespace from being stored.
	if value := strings.TrimSpace(payload.FirstName); value != "" {
		// If first name is provided, add it to the update.
		sets = append(sets, "first_name = ?")
		args = append(args, value)
	}
	// We remove spaces from the beginning and end of the text.
	// This treats inputs like "  name  " the same as "name" and prevents accidental whitespace from being stored.
	if value := strings.TrimSpace(payload.LastName); value != "" {
		// If last name is provided, add it to the update.
		sets = append(sets, "last_name = ?")
		args = append(args, value)
	}
	// We remove spaces from the beginning and end of the text.
	// This treats inputs like "  name  " the same as "name" and prevents accidental whitespace from being stored.
	if value := strings.TrimSpace(payload.Email); value != "" {
		// We check if the new email is already used before saving it.
		inUse, err := emailInUse(value, "", c.Params("id"))
		if err != nil {
			// We return a server error because UpdateAdminBySuperAdmin hit an internal failure (example: the database query for this handler failed).
			return serverError(c, "failed to validate email", err)
		}
		if inUse {
			// We return a validation error because UpdateAdminBySuperAdmin received input that failed required checks (example: missing fields or a value that is not allowed for this endpoint).
			return invalidRequest(c, "email is already in use")
		}
		// Email is valid and unique, so include it in the update.
		sets = append(sets, "email = ?")
		args = append(args, value)
	}
	// We remove spaces from the beginning and end of the text.
	// This treats inputs like "  name  " the same as "name" and prevents accidental whitespace from being stored.
	if value := strings.TrimSpace(payload.Unit); value != "" {
		// We check that the unit exists and is not already taken by another admin.
		unitExists, err := categoryExists(value)
		if err != nil {
			// We return a server error because UpdateAdminBySuperAdmin hit an internal failure (example: the database query for this handler failed).
			return serverError(c, "failed to validate admin unit", err)
		}
		if !unitExists {
			// We return a validation error because UpdateAdminBySuperAdmin received input that failed required checks (example: missing fields or a value that is not allowed for this endpoint).
			return invalidRequest(c, "invalid admin unit")
		}
		taken, err := adminUnitTaken(value, c.Params("id"))
		if err != nil {
			// We return a server error because UpdateAdminBySuperAdmin hit an internal failure (example: the database query for this handler failed).
			return serverError(c, "failed to validate admin unit", err)
		}
		if taken {
			// We return a validation error because UpdateAdminBySuperAdmin received input that failed required checks (example: missing fields or a value that is not allowed for this endpoint).
			return invalidRequest(c, "selected unit already has an admin")
		}
		// Unit is valid and free, so include it in the update.
		sets = append(sets, "unit = ?")
		args = append(args, value)
	}
	// We remove spaces from the beginning and end of the text.
	// This treats inputs like "  name  " the same as "name" and prevents accidental whitespace from being stored.
	if value := strings.TrimSpace(payload.Password); value != "" {
		// If a new password was provided, include it in the update.
		sets = append(sets, "password = ?")
		args = append(args, value)
	}

	if len(sets) == 0 {
		// If no fields were provided, there is nothing to update.
		// We return a validation error because UpdateAdminBySuperAdmin received input that failed required checks (example: missing fields or a value that is not allowed for this endpoint).
		return invalidRequest(c, "no fields provided for admin update")
	}

	// Always update the timestamp so we can see when the record last changed.
	sets = append(sets, "updated_at = ?")
	args = append(args, time.Now())
	// We execute the update using the shared helper so error handling is consistent.
	if err := execUpdateByID(adminTable, c.Params("id"), "failed to update admin", "admin not found", sets, args...); err != nil {
		return respondDBResult(c, err)
	}

	admin, err := fetchAdminByID(c.Params("id"))
	if err != nil {
		// We return a server error because UpdateAdminBySuperAdmin hit an internal failure (example: the database query for this handler failed).
		return serverError(c, "failed to fetch admin", err)
	}
	// We return a success response with the data from UpdateAdminBySuperAdmin so the client can update its view (example: UpdateAdminBySuperAdmin returns the requested or updated resource).
	return success(c, fiber.StatusOK, admin)
}

// This handler disables an admin account without deleting it.
// It reads input from the request, talks to the database if needed, and then returns JSON or an error.
func DisableAdminBySuperAdmin(c *fiber.Ctx) error {
	// Only superadmin can disable admin accounts, so we verify the token first.
	if err := requireSuperAdmin(c); err != nil {
		return err
	}
	// Ensure the is_disabled column exists because we are about to update it.
	if err := ensureAdminDisableColumn(); err != nil {
		// We return a server error because DisableAdminBySuperAdmin hit an internal failure (example: the database query for this handler failed).
		return serverError(c, "failed to initialize admin access state", err)
	}

	// We mark the admin as disabled instead of deleting the row.
	// This preserves history while preventing future logins.
	result := middleware.DBConn.Exec(
		`UPDATE `+adminTable+` SET is_disabled = TRUE, updated_at = ? WHERE id = ?`,
		time.Now(),
		c.Params("id"),
	)
	if result.Error != nil {
		// We return a server error because DisableAdminBySuperAdmin hit an internal failure (example: the database query for this handler failed).
		return serverError(c, "failed to disable admin account", result.Error)
	}
	// If no rows were changed, it means the id did not match any row in the database.
	// In that case, we return a not found response instead of pretending it worked.
	if result.RowsAffected == 0 {
		// We return not found because DisableAdminBySuperAdmin could not find the requested record (example: no row matches the given id).
		return notFound(c, "admin not found", nil)
	}

	admin, err := fetchAdminByID(c.Params("id"))
	if err != nil {
		// We return a server error because DisableAdminBySuperAdmin hit an internal failure (example: the database query for this handler failed).
		return serverError(c, "failed to fetch admin", err)
	}

	// We return a success response with the data from DisableAdminBySuperAdmin so the client can update its view (example: DisableAdminBySuperAdmin returns the requested or updated resource).
	return success(c, fiber.StatusOK, admin)
}

// This handler updates a user's first and last name.
// It reads input from the request, talks to the database if needed, and then returns JSON or an error.
func UpdateUserProfile(c *fiber.Ctx) error {
	var payload struct {
		FirstName string `json:"firstName"`
		LastName  string `json:"lastName"`
	}

	// We parse the JSON body so we can read the new first and last name.
	if err := parseBody(c, &payload); err != nil {
		// We return a parse error because UpdateUserProfile could not decode the request body into the expected fields (example: invalid JSON or wrong field names/types).
		return parseError(c, "failed to parse user profile", err)
	}

	// We trim both names so validation is accurate and the stored values are clean.
	payload.FirstName = strings.TrimSpace(payload.FirstName)
	payload.LastName = strings.TrimSpace(payload.LastName)
	// Both names are required; if either is empty we return a validation error.
	if payload.FirstName == "" || payload.LastName == "" {
		// We return a validation error because UpdateUserProfile received input that failed required checks (example: missing fields or a value that is not allowed for this endpoint).
		return invalidRequest(c, "first name and last name are required")
	}

	// We update the user row by id using the shared helper for consistent error handling.
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

	// We fetch the updated user so the client receives the new values.
	user, err := fetchUserByID(c.Params("id"))
	if err != nil {
		// We return a server error because UpdateUserProfile hit an internal failure (example: the database query for this handler failed).
		return serverError(c, "failed to fetch user", err)
	}
	// We return a success response with the data from UpdateUserProfile so the client can update its view (example: UpdateUserProfile returns the requested or updated resource).
	return success(c, fiber.StatusOK, user)
}

// This handler updates an admin's first and last name.
// It reads input from the request, talks to the database if needed, and then returns JSON or an error.
func UpdateAdminProfile(c *fiber.Ctx) error {
	var payload struct {
		FirstName string `json:"firstName"`
		LastName  string `json:"lastName"`
	}

	// We parse the JSON body so we can read the new first and last name.
	if err := parseBody(c, &payload); err != nil {
		// We return a parse error because UpdateAdminProfile could not decode the request body into the expected fields (example: invalid JSON or wrong field names/types).
		return parseError(c, "failed to parse admin profile", err)
	}

	// We trim both names so validation is accurate and the stored values are clean.
	payload.FirstName = strings.TrimSpace(payload.FirstName)
	payload.LastName = strings.TrimSpace(payload.LastName)
	// Both names are required; if either is empty we return a validation error.
	if payload.FirstName == "" || payload.LastName == "" {
		// We return a validation error because UpdateAdminProfile received input that failed required checks (example: missing fields or a value that is not allowed for this endpoint).
		return invalidRequest(c, "first name and last name are required")
	}

	// We update the admin row by id using the shared helper for consistent error handling.
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

	// We fetch the updated admin so the client receives the new values.
	admin, err := fetchAdminByID(c.Params("id"))
	if err != nil || admin.ID == "" {
		// We return not found because UpdateAdminProfile could not find the requested record (example: no row matches the given id).
		return notFound(c, "admin not found", err)
	}

	// We return a success response with the data from UpdateAdminProfile so the client can update its view (example: UpdateAdminProfile returns the requested or updated resource).
	return success(c, fiber.StatusOK, admin)
}

// This handler updates a user password using the shared helper.
// It reads input from the request, talks to the database if needed, and then returns JSON or an error.
func UpdateUserPassword(c *fiber.Ctx) error {
	// We reuse the shared password update helper for users.
	return updatePassword(c, userTable, "user")
}

// This handler deletes a user account by id.
// It reads input from the request, talks to the database if needed, and then returns JSON or an error.
func DeleteUserAccount(c *fiber.Ctx) error {
	// We delegate to the shared delete helper so error handling stays consistent.
	return deleteByID(c, userTable, "user", c.Params("id"))
}

// This handler updates an admin password using the shared helper.
// It reads input from the request, talks to the database if needed, and then returns JSON or an error.
func UpdateAdminPassword(c *fiber.Ctx) error {
	// We reuse the shared password update helper for admins.
	return updatePassword(c, adminTable, "admin")
}

// This handler deletes an admin account by id.
// It reads input from the request, talks to the database if needed, and then returns JSON or an error.
func DeleteAdminAccount(c *fiber.Ctx) error {
	// We delegate to the shared delete helper so error handling stays consistent.
	return deleteByID(c, adminTable, "admin", c.Params("id"))
}

// This helper checks the current password and writes a new password for a user or admin.
// It is a small reusable piece so we do not repeat the same logic in many handlers.
func updatePassword(c *fiber.Ctx, table string, entity string) error {
	var payload struct {
		CurrentPassword string `json:"currentPassword"`
		NewPassword     string `json:"newPassword"`
	}

	// We parse the JSON body so we can read the current and new passwords.
	if err := parseBody(c, &payload); err != nil {
		// We return a parse error because updatePassword could not decode the request body into the expected fields (example: invalid JSON or wrong field names/types).
		return parseError(c, "failed to parse password update", err)
	}

	// We trim both passwords to avoid accidental spaces.
	payload.CurrentPassword = strings.TrimSpace(payload.CurrentPassword)
	payload.NewPassword = strings.TrimSpace(payload.NewPassword)
	// Both fields are required to change a password.
	if payload.CurrentPassword == "" || payload.NewPassword == "" {
		// We return a validation error because updatePassword received input that failed required checks (example: missing fields or a value that is not allowed for this endpoint).
		return invalidRequest(c, "current password and new password are required")
	}
	if len(payload.NewPassword) < 6 {
		// We return a validation error because updatePassword received input that failed required checks (example: missing fields or a value that is not allowed for this endpoint).
		return invalidRequest(c, "new password must be at least 6 characters")
	}

	// We update the password only if the current password matches the stored one.
	// The WHERE clause includes the current password, so no rows change if it is wrong.
	result := middleware.DBConn.Exec(
		fmt.Sprintf("UPDATE %s SET password = ?, updated_at = ? WHERE id = ? AND password = ?", table),
		payload.NewPassword, time.Now(), c.Params("id"), payload.CurrentPassword,
	)
	if result.Error != nil {
		// We return a server error because updatePassword hit an internal failure (example: the database query for this handler failed).
		return serverError(c, "failed to update password", result.Error)
	}
	// If no rows were changed, it means the id did not match any row in the database.
	// In that case, we return a not found response instead of pretending it worked.
	if result.RowsAffected == 0 {
		// If no row was updated, the current password did not match.
		// We return unauthorized because updatePassword could not validate credentials or access state (example: wrong password or disabled account).
		return unauthorized(c, fmt.Sprintf("%s current password is incorrect", entity))
	}

	// We return a success response with the data from updatePassword so the client can update its view (example: updatePassword returns the requested or updated resource).
	return success(c, fiber.StatusOK, map[string]string{"id": c.Params("id")})
}

// This helper reads one feedback row from the database.
// It is a small reusable piece so we do not repeat the same logic in many handlers.
func fetchFeedbackByID(id string) (model.FeedbackModel, error) {
	var feedback model.FeedbackModel
	// We select only the columns the frontend needs so the API stays stable and predictable.
	// The id parameter tells us which feedback row to fetch.
	err := middleware.DBConn.Raw(
		`SELECT id, type, category, subject, message, status, priority, user_id, user_name, is_anonymous, response, created_at, updated_at
		FROM `+feedbackTable+` WHERE id = ?`,
		id,
	).Scan(&feedback).Error
	return feedback, err
}

// This helper reads one user row from the database.
// It is a small reusable piece so we do not repeat the same logic in many handlers.
func fetchUserByID(id string) (model.UserModel, error) {
	var user model.UserModel
	// We compose the display name in SQL because the table stores first and last names separately.
	// This lets the caller use a ready-made "name" field without extra string work.
	err := middleware.DBConn.Raw(
		`SELECT id, first_name, last_name, first_name || ' ' || last_name AS name, email, created_at, updated_at
		FROM `+userTable+` WHERE id = ?`,
		id,
	).Scan(&user).Error
	return user, err
}

// This helper reads one admin row from the database.
// It is a small reusable piece so we do not repeat the same logic in many handlers.
func fetchAdminByID(id string) (model.AdminModel, error) {
	if err := ensureAdminDisableColumn(); err != nil {
		return model.AdminModel{}, err
	}

	var admin model.AdminModel
	// We compose the display name in SQL because the table stores first and last names separately.
	// We also read the is_disabled flag so callers can see whether the admin is active.
	err := middleware.DBConn.Raw(
		`SELECT id, first_name, last_name, first_name || ' ' || last_name AS name, email, unit, COALESCE(is_disabled, FALSE) AS is_disabled, created_at, updated_at
		FROM `+adminTable+` WHERE id = ?`,
		id,
	).Scan(&admin).Error
	return admin, err
}

// This helper trims fields, fills defaults, and validates feedback values.
// It is a small reusable piece so we do not repeat the same logic in many handlers.
func normalizeFeedback(feedback *model.FeedbackModel) error {
	// First we clean every text field so later checks are fair and consistent.
	// This means "  abc  " becomes "abc" and we do not store accidental spaces.
	feedback.ID = strings.TrimSpace(feedback.ID)
	// We trim the type for the same reason: we want a clean value before validation.
	feedback.Type = strings.TrimSpace(feedback.Type)
	// We trim the category so it matches the allowed category list exactly.
	feedback.Category = strings.TrimSpace(feedback.Category)
	// We trim the subject so the saved text is tidy and does not include extra spaces.
	feedback.Subject = strings.TrimSpace(feedback.Subject)
	// We trim the message for the same reason as the subject.
	feedback.Message = strings.TrimSpace(feedback.Message)

	// These five fields are required for every feedback record.
	// If any of them are empty after trimming, we stop and return an error.
	if feedback.ID == "" || feedback.Type == "" || feedback.Category == "" || feedback.Subject == "" || feedback.Message == "" {
		return fmt.Errorf("missing required fields")
	}
	// If the caller did not provide a status, we choose a safe default.
	// This keeps the data consistent and avoids a blank status in the database.
	if feedback.Status == "" {
		feedback.Status = "Pending"
	}
	// If the caller did not provide a priority, we choose a safe default.
	// This ensures every feedback row always has a priority value.
	if feedback.Priority == "" {
		feedback.Priority = "Medium"
	}
	// We check that the category actually exists in our categories table.
	// This prevents typos from becoming new, invalid categories.
	categoryOk, err := categoryExists(feedback.Category)
	if err != nil {
		return fmt.Errorf("failed to validate feedback category")
	}
	if !categoryOk {
		return fmt.Errorf("invalid feedback category")
	}
	// We verify that the status is one of the approved values.
	// If it is not, we return an error so bad data never reaches the database.
	if !validStatuses[feedback.Status] {
		return fmt.Errorf("invalid feedback status")
	}
	// We verify that the priority is one of the approved values.
	// This keeps priorities consistent across the system.
	if !validPriorities[feedback.Priority] {
		return fmt.Errorf("invalid feedback priority")
	}
	// UserID is optional, so we only validate it when it is provided.
	// If it is present, we confirm that the user actually exists.
	if feedback.UserID != nil {
		// We trim the provided user ID so extra spaces do not break the lookup.
		trimmed := strings.TrimSpace(*feedback.UserID)
		if trimmed == "" {
			// An empty string means the caller did not really provide a user ID.
			// We clear it so it behaves like a missing value.
			feedback.UserID = nil
		} else {
			// We fetch the user to make sure the ID is real before saving.
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
	// UserName is optional and usually used for anonymous submissions.
	// If it is provided, we trim it and drop it if it becomes empty.
	if feedback.UserName != nil {
		trimmed := strings.TrimSpace(*feedback.UserName)
		if trimmed == "" {
			feedback.UserName = nil
		} else {
			feedback.UserName = &trimmed
		}
	}
	// Response is optional in the input, but the database requires a non-null value.
	// We either trim the provided response or set it to an empty string.
	if feedback.Response != nil {
		trimmed := strings.TrimSpace(*feedback.Response)
		feedback.Response = &trimmed
	} else {
		empty := ""
		feedback.Response = &empty
	}

	return nil
}

// This helper ensures the categories table exists and is populated.
// It is a small reusable piece so we do not repeat the same logic in many handlers.
func ensureCategoryStore() error {
	// We use sync.Once so this initialization runs only one time, even if many requests call it.
	// This avoids racing to create the same table or insert the same seed rows more than once.
	categoryTableInit.Do(func() {
		// We take the shared database connection that middleware already opened for us.
		// Think of this as the phone line to Postgres; without it, this handler cannot read or change any data.
		db := middleware.DBConn

		// We create the categories table if it does not exist.
		// Using IF NOT EXISTS means this is safe to run multiple times without crashing.
		categoryTableInitErr = db.Exec(
			`CREATE TABLE IF NOT EXISTS ` + categoryTable + ` (
				id BIGSERIAL PRIMARY KEY,
				name VARCHAR(100) NOT NULL UNIQUE,
				created_at TIMESTAMP NOT NULL DEFAULT NOW(),
				updated_at TIMESTAMP NOT NULL DEFAULT NOW()
			)`,
		).Error
		// If table creation failed, we store the error and stop; the caller will see it.
		if categoryTableInitErr != nil {
			return
		}

		// We insert the default category names so a fresh database starts with the standard list.
		// ON CONFLICT DO NOTHING means we do not create duplicates if a name already exists.
		for _, name := range defaultCategoryNames {
			// Insert this one default name if it is missing.
			if err := db.Exec(
				`INSERT INTO `+categoryTable+` (name) VALUES (?) ON CONFLICT (name) DO NOTHING`,
				name,
			).Error; err != nil {
				categoryTableInitErr = err
				return
			}
		}

		// We also seed categories from existing admin units so we do not lose older data.
		// The DISTINCT TRIM(unit) part gathers unique, cleaned unit names that already exist.
		if err := db.Exec(
			`INSERT INTO ` + categoryTable + ` (name)
			 SELECT DISTINCT TRIM(unit) FROM ` + adminTable + `
			 WHERE unit IS NOT NULL AND TRIM(unit) <> ''
			 ON CONFLICT (name) DO NOTHING`,
		).Error; err != nil {
			categoryTableInitErr = err
			return
		}

		// We also seed categories from existing feedback rows for the same reason.
		// This keeps categories aligned with any historical feedback already stored.
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

// This helper ensures the admins table has an is_disabled column.
// It is a small reusable piece so we do not repeat the same logic in many handlers.
func ensureAdminDisableColumn() error {
	// We guard this with sync.Once so the ALTER TABLE runs only once.
	// That keeps startup fast and prevents repeated ALTER TABLE calls on every request.
	adminDisableColumnInit.Do(func() {
		// We add the is_disabled column if it is missing.
		// IF NOT EXISTS makes it safe to run even if the column already exists.
		adminDisableColumnErr = middleware.DBConn.Exec(
			`ALTER TABLE ` + adminTable + ` ADD COLUMN IF NOT EXISTS is_disabled BOOLEAN NOT NULL DEFAULT FALSE`,
		).Error
	})
	return adminDisableColumnErr
}

// This helper returns all categories sorted by name.
// It is a small reusable piece so we do not repeat the same logic in many handlers.
func listCategories() ([]model.CategoryModel, error) {
	// We make sure the category table exists and is seeded before we try to read from it.
	if err := ensureCategoryStore(); err != nil {
		return nil, err
	}

	var categories []model.CategoryModel
	// We read all category rows and sort them by name so the UI gets a stable, predictable order.
	if err := middleware.DBConn.Raw(
		`SELECT id, name, created_at, updated_at FROM ` + categoryTable + ` ORDER BY name ASC`,
	).Scan(&categories).Error; err != nil {
		return nil, err
	}

	return categories, nil
}

// This helper returns only the category names.
// It is a small reusable piece so we do not repeat the same logic in many handlers.
func listCategoryNames() ([]string, error) {
	// We fetch full category records first, then extract only the names.
	// This keeps the rest of the code simple because it can reuse listCategories.
	categories, err := listCategories()
	if err != nil {
		return nil, err
	}

	// We pre-allocate the slice so we do not grow it repeatedly in the loop.
	names := make([]string, 0, len(categories))
	for _, category := range categories {
		// We append just the name field because that is all the caller needs.
		names = append(names, category.Name)
	}
	return names, nil
}

// This helper checks whether a category name exists.
// It is a small reusable piece so we do not repeat the same logic in many handlers.
func categoryExists(name string) (bool, error) {
	// We need the categories table to exist before we can check it.
	if err := ensureCategoryStore(); err != nil {
		return false, err
	}

	// We remove spaces from the beginning and end of the text.
	// This treats inputs like "  name  " the same as "name" and prevents accidental whitespace from being stored.
	trimmed := strings.TrimSpace(name)
	// If trimming leaves nothing, there is no real category to check.
	if trimmed == "" {
		return false, nil
	}

	var count int64
	// We run a COUNT query to see if any category rows match this name (case-insensitive).
	// If the count is greater than zero, the category exists.
	if err := middleware.DBConn.Raw(
		`SELECT COUNT(*) FROM `+categoryTable+` WHERE LOWER(name) = LOWER(?)`,
		trimmed,
	).Scan(&count).Error; err != nil {
		return false, err
	}

	return count > 0, nil
}

// This helper checks whether a category is used by admins or feedbacks.
// It is a small reusable piece so we do not repeat the same logic in many handlers.
func categoryInUse(name string) (bool, error) {
	// We remove spaces from the beginning and end of the text.
	// This treats inputs like "  name  " the same as "name" and prevents accidental whitespace from being stored.
	trimmed := strings.TrimSpace(name)
	// If there is no real name after trimming, it cannot be "in use".
	if trimmed == "" {
		return false, nil
	}

	var adminCount int64
	// We count how many admins are currently assigned to this category/unit.
	if err := middleware.DBConn.Raw(
		`SELECT COUNT(*) FROM `+adminTable+` WHERE unit = ?`,
		trimmed,
	).Scan(&adminCount).Error; err != nil {
		return false, err
	}

	var feedbackCount int64
	// We count how many feedback rows already use this category.
	if err := middleware.DBConn.Raw(
		`SELECT COUNT(*) FROM `+feedbackTable+` WHERE category = ?`,
		trimmed,
	).Scan(&feedbackCount).Error; err != nil {
		return false, err
	}

	// If either admins or feedbacks use the category, we say it is in use.
	return adminCount+feedbackCount > 0, nil
}

// This helper rebuilds the database check constraints for categories.
// It is a small reusable piece so we do not repeat the same logic in many handlers.
func syncCategoryConstraints() error {
	// We read the current category names so the database constraints match the real list.
	names, err := listCategoryNames()
	if err != nil {
		return err
	}

	// We must have at least one category, otherwise the CHECK constraint would be empty.
	if len(names) == 0 {
		return fmt.Errorf("at least one category is required")
	}

	// We build a list of SQL string literals like 'IT Unit', properly escaped.
	literals := make([]string, 0, len(names))
	for _, name := range names {
		// We escape the name before inserting it into the SQL string to avoid syntax errors.
		literals = append(literals, "'"+escapeSQLLiteral(name)+"'")
	}
	// We join the literals with commas so they fit inside the IN (...) clause.
	valueList := strings.Join(literals, ", ")

	// We take the shared database connection that middleware already opened for us.
	// Think of this as the phone line to Postgres; without it, this handler cannot read or change any data.
	db := middleware.DBConn
	// We drop the old constraints first, because we are about to rebuild them with the latest categories.
	if err := db.Exec(`ALTER TABLE ` + feedbackTable + ` DROP CONSTRAINT IF EXISTS chk_feedback_category`).Error; err != nil {
		return err
	}
	// We do the same for the admin unit constraint.
	if err := db.Exec(`ALTER TABLE ` + adminTable + ` DROP CONSTRAINT IF EXISTS chk_admin_unit`).Error; err != nil {
		return err
	}
	// We create a new constraint for feedback categories using the current list.
	if err := db.Exec(
		`ALTER TABLE ` + feedbackTable + `
		 ADD CONSTRAINT chk_feedback_category CHECK (category IN (` + valueList + `))`,
	).Error; err != nil {
		return err
	}
	// We create a new constraint for admin units using the same list.
	if err := db.Exec(
		`ALTER TABLE ` + adminTable + `
		 ADD CONSTRAINT chk_admin_unit CHECK (unit IN (` + valueList + `))`,
	).Error; err != nil {
		return err
	}

	return nil
}

// This helper escapes a string so it can be safely put into a SQL literal.
// It is a small reusable piece so we do not repeat the same logic in many handlers.
func escapeSQLLiteral(value string) string {
	// SQL string literals use a single quote to start and end, so a quote inside must be doubled.
	// Replacing `'` with `''` keeps the literal valid and avoids SQL syntax errors.
	return strings.ReplaceAll(value, "'", "''")
}

// This helper checks if an email is already used by any user or admin.
// It is a small reusable piece so we do not repeat the same logic in many handlers.
func emailInUse(email string, excludeUserID string, excludeAdminID string) (bool, error) {
	// We remove spaces from the beginning and end of the text.
	// This treats inputs like "  name  " the same as "name" and prevents accidental whitespace from being stored.
	normalized := strings.TrimSpace(email)
	// If there is no email after trimming, there is nothing to check.
	if normalized == "" {
		return false, nil
	}

	var userCount int64
	// We build a query that counts users with this email.
	// LOWER(...) makes the check case-insensitive so "A@x.com" equals "a@x.com".
	userQuery := `SELECT COUNT(*) FROM ` + userTable + ` WHERE LOWER(email) = LOWER(?)`
	userArgs := []any{normalized}
	if excludeUserID != "" {
		// When updating a user, we exclude their own id so we don't count it as a conflict.
		userQuery += ` AND id <> ?`
		userArgs = append(userArgs, excludeUserID)
	}
	// We run the user query to see if any user row already uses this email.
	if err := middleware.DBConn.Raw(userQuery, userArgs...).Scan(&userCount).Error; err != nil {
		return false, err
	}

	var adminCount int64
	// We build a second query that counts admins with this email.
	adminQuery := `SELECT COUNT(*) FROM ` + adminTable + ` WHERE LOWER(email) = LOWER(?)`
	adminArgs := []any{normalized}
	if excludeAdminID != "" {
		// When updating an admin, we exclude their own id so we don't count it as a conflict.
		adminQuery += ` AND id <> ?`
		adminArgs = append(adminArgs, excludeAdminID)
	}
	// We run the admin query to see if any admin row already uses this email.
	if err := middleware.DBConn.Raw(adminQuery, adminArgs...).Scan(&adminCount).Error; err != nil {
		return false, err
	}

	return userCount+adminCount > 0, nil
}

// This helper parses JSON from the request body into a Go value.
// It is a small reusable piece so we do not repeat the same logic in many handlers.
func parseBody(c *fiber.Ctx, dest any) error {
	// Fiber's BodyParser reads the request body and tries to decode JSON into dest.
	// If the JSON is invalid or does not match the expected shape, it returns an error.
	return c.BodyParser(dest)
}

// This helper returns a success response payload.
// It is a small reusable piece so we do not repeat the same logic in many handlers.
func success(c *fiber.Ctx, code int, data any) error {
	// We set the HTTP status code and wrap the payload in our ResponseModel format.
	// This keeps every successful response consistent for the frontend.
	return c.Status(code).JSON(response.ResponseModel{
		RetCode: fmt.Sprintf("%d", code),
		Message: "Success!!",
		Data:    data,
	})
}

// This helper returns a JSON parse error response.
// It is a small reusable piece so we do not repeat the same logic in many handlers.
func parseError(c *fiber.Ctx, message string, err error) error {
	// We return a 401-style response when the JSON body cannot be parsed.
	// The error detail is included so the frontend (or logs) can see what went wrong.
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

// This helper returns an invalid input response.
// It is a small reusable piece so we do not repeat the same logic in many handlers.
func invalidRequest(c *fiber.Ctx, message string) error {
	// We return a 400-style response when the user input fails validation.
	// We include a simple message the frontend can display to the user.
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

// This helper returns an unauthorized response.
// It is a small reusable piece so we do not repeat the same logic in many handlers.
func unauthorized(c *fiber.Ctx, message string) error {
	// We return a 401-style response when the user is not allowed to access this action.
	// This is used for bad credentials or disabled accounts.
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

// This helper returns a not found response.
// It is a small reusable piece so we do not repeat the same logic in many handlers.
func notFound(c *fiber.Ctx, message string, err error) error {
	// We return a 404-style response when a requested record does not exist.
	// The optional error can carry extra detail for logs or debugging.
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

// This helper returns a server error response.
// It is a small reusable piece so we do not repeat the same logic in many handlers.
func serverError(c *fiber.Ctx, message string, err error) error {
	// We return a 500-style response when something unexpected fails on the server.
	// This tells the frontend that the problem is not caused by user input.
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
	// statusCode is the HTTP status we want to return for this error.
	statusCode int
	// message is a short human-readable explanation for the client.
	message string
	// err keeps the original error so we don't lose the root cause.
	err error
}

// This method lets dbActionError behave like a normal error.
// It exists so this custom type can be used like a normal Go error elsewhere.
func (e *dbActionError) Error() string {
	return e.message
}

// This helper builds and runs an UPDATE query and normalizes any errors.
// It is a small reusable piece so we do not repeat the same logic in many handlers.
func execUpdateByID(table string, id string, failMessage string, notFoundMessage string, sets []string, args ...any) error {
	// We reuse the same update flow for profile changes and similar single-row updates.
	// This keeps one consistent pattern for "update by id" across the codebase.
	queryArgs := append(args, id)
	// The SQL uses placeholders, so we pass all values in order, with the id last for "WHERE id = ?".
	result := middleware.DBConn.Exec(
		fmt.Sprintf("UPDATE %s SET %s WHERE id = ?", table, strings.Join(sets, ", ")),
		queryArgs...,
	)
	if result.Error != nil {
		// We wrap the database error with our own message and status so callers can respond consistently.
		return &dbActionError{statusCode: fiber.StatusInternalServerError, message: failMessage, err: result.Error}
	}
	// If no rows were changed, it means the id did not match any row in the database.
	// In that case, we return a not found response instead of pretending it worked.
	if result.RowsAffected == 0 {
		return &dbActionError{statusCode: fiber.StatusNotFound, message: notFoundMessage}
	}
	return nil
}

// This helper converts a dbActionError into an HTTP response.
// It is a small reusable piece so we do not repeat the same logic in many handlers.
func respondDBResult(c *fiber.Ctx, err error) error {
	// If there is no error, there is nothing to respond with.
	if err == nil {
		return nil
	}
	// We only know how to unpack dbActionError; everything else is treated as an unexpected server error.
	actionErr, ok := err.(*dbActionError)
	if !ok {
		// We return a generic server error so the frontend sees a consistent failure response.
		return serverError(c, "database operation failed", err)
	}
	// If the error says "not found", we return a 404 response.
	if actionErr.statusCode == fiber.StatusNotFound {
		return notFound(c, actionErr.message, actionErr.err)
	}
	// For any other status, we return a server error with the stored message.
	return serverError(c, actionErr.message, actionErr.err)
}

// This helper deletes a row by id and returns a standard response.
// It is a small reusable piece so we do not repeat the same logic in many handlers.
func deleteByID(c *fiber.Ctx, table string, entity string, id string) error {
	// We reuse the same delete response pattern for user, admin, and feedback records.
	// This keeps error handling and messaging consistent across delete endpoints.
	result := middleware.DBConn.Exec("DELETE FROM "+table+" WHERE id = ?", id)
	if result.Error != nil {
		// We return a server error because deleteByID hit an internal failure (example: the database query for this handler failed).
		return serverError(c, fmt.Sprintf("failed to delete %s", entity), result.Error)
	}
	// If no rows were changed, it means the id did not match any row in the database.
	// In that case, we return a not found response instead of pretending it worked.
	if result.RowsAffected == 0 {
		// We return not found because deleteByID could not find the requested record (example: no row matches the given id).
		return notFound(c, fmt.Sprintf("%s not found", entity), nil)
	}
	// We return a success response with the data from deleteByID so the client can update its view (example: deleteByID returns the requested or updated resource).
	return success(c, fiber.StatusOK, map[string]string{"id": id})
}

// This helper checks if another admin already owns the unit.
// It is a small reusable piece so we do not repeat the same logic in many handlers.
func adminUnitTaken(unit string, excludeID string) (bool, error) {
	var count int64
	// We count admins with this unit to detect if the unit is already owned.
	query := `SELECT COUNT(*) FROM ` + adminTable + ` WHERE unit = ?`
	args := []any{unit}
	if excludeID != "" {
		// When updating an admin, we ignore their own id so they do not block themselves.
		// This lets an admin keep the same unit without triggering a false conflict.
		query += ` AND id <> ?`
		args = append(args, excludeID)
	}

	// We run the SQL and read the count result.
	if err := middleware.DBConn.Raw(query, args...).Scan(&count).Error; err != nil {
		return false, err
	}
	// If count is greater than zero, another admin already uses the unit.
	return count > 0, nil
}

// This helper checks the bearer token so only superadmin can proceed.
// It is a small reusable piece so we do not repeat the same logic in many handlers.
func requireSuperAdmin(c *fiber.Ctx) error {
	// We remove spaces from the beginning and end of the text.
	// This treats inputs like "  name  " the same as "name" and prevents accidental whitespace from being stored.
	header := strings.TrimSpace(c.Get("Authorization"))
	// We expect a header that starts with "Bearer " followed by the token.
	// If that header is missing or malformed, we deny the request.
	if header == "" || !strings.HasPrefix(header, "Bearer ") {
		// We return unauthorized because requireSuperAdmin could not validate credentials or access state (example: wrong password or disabled account).
		return unauthorized(c, "superadmin authorization is required")
	}

	// We remove spaces from the beginning and end of the text.
	// This treats inputs like "  name  " the same as "name" and prevents accidental whitespace from being stored.
	token := strings.TrimSpace(strings.TrimPrefix(header, "Bearer "))
	// We verify that the token is real and not expired before allowing superadmin actions.
	if !validateSuperAdminToken(token) {
		// We return unauthorized because requireSuperAdmin could not validate credentials or access state (example: wrong password or disabled account).
		return unauthorized(c, "invalid or expired superadmin session")
	}

	return nil
}

// This helper creates a signed token that contains the expiry time.
// It is a small reusable piece so we do not repeat the same logic in many handlers.
func issueSuperAdminToken(expiresAt time.Time) string {
	// We put the expiry time into the payload so the token can expire automatically.
	payload := fmt.Sprintf("%d", expiresAt.Unix())
	// We sign the payload using HMAC so the token cannot be forged without the secret.
	mac := hmac.New(sha256.New, []byte(superAdminSecret()))
	mac.Write([]byte(payload))
	signature := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
	// We join payload and signature and then base64-encode the whole thing for safe transport.
	token := payload + "." + signature
	return base64.RawURLEncoding.EncodeToString([]byte(token))
}

// This helper verifies a token's signature and expiry.
// It is a small reusable piece so we do not repeat the same logic in many handlers.
func validateSuperAdminToken(token string) bool {
	// The token is base64-encoded, so we decode it first.
	decoded, err := base64.RawURLEncoding.DecodeString(token)
	if err != nil {
		return false
	}

	// The decoded token should have exactly two parts: payload and signature.
	parts := strings.Split(string(decoded), ".")
	if len(parts) != 2 {
		return false
	}

	// We recompute the signature from the payload using the shared secret.
	mac := hmac.New(sha256.New, []byte(superAdminSecret()))
	mac.Write([]byte(parts[0]))
	expectedSignature := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
	// If the signatures do not match, the token has been tampered with or is invalid.
	if !hmac.Equal([]byte(parts[1]), []byte(expectedSignature)) {
		return false
	}

	// The payload is the expiry time; we parse it into an integer.
	expiresAtUnix, err := strconv.ParseInt(parts[0], 10, 64)
	if err != nil {
		return false
	}

	// The token is valid only if the current time is before the expiry time.
	return time.Now().Unix() <= expiresAtUnix
}

// This helper reads the superadmin username from env or uses the default.
// It is a small reusable piece so we do not repeat the same logic in many handlers.
func superAdminUsername() string {
	// We remove spaces from the beginning and end of the text.
	// This treats inputs like "  name  " the same as "name" and prevents accidental whitespace from being stored.
	// If the environment variable is set, we use it; otherwise we fall back to the default.
	if value := strings.TrimSpace(os.Getenv("SUPERADMIN_USERNAME")); value != "" {
		return value
	}
	return defaultSuperAdminUsername
}

// This helper reads the superadmin password from env or uses the default.
// It is a small reusable piece so we do not repeat the same logic in many handlers.
func superAdminPassword() string {
	// We remove spaces from the beginning and end of the text.
	// This treats inputs like "  name  " the same as "name" and prevents accidental whitespace from being stored.
	// If the environment variable is set, we use it; otherwise we fall back to the default.
	if value := strings.TrimSpace(os.Getenv("SUPERADMIN_PASSWORD")); value != "" {
		return value
	}
	return defaultSuperAdminPassword
}

// This helper reads the superadmin token secret from env or uses the default.
// It is a small reusable piece so we do not repeat the same logic in many handlers.
func superAdminSecret() string {
	// We remove spaces from the beginning and end of the text.
	// This treats inputs like "  name  " the same as "name" and prevents accidental whitespace from being stored.
	// If the environment variable is set, we use it; otherwise we fall back to the default.
	if value := strings.TrimSpace(os.Getenv("SUPERADMIN_SECRET")); value != "" {
		return value
	}
	return defaultSuperAdminSecret
}
