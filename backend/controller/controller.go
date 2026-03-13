package controller

import (
	"fmt"
	"html"
	"log"
	"net/url"
	"strings"
	"time"

	"FeedForward/backend/middleware"
	"FeedForward/backend/model"
	"FeedForward/backend/model/errors"
	"FeedForward/backend/model/response"
	"FeedForward/backend/model/status"

	"github.com/gofiber/fiber/v2"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

// ===================== USER ENDPOINTS =====================

func RegisterUser(c *fiber.Ctx) error {
	db := middleware.DBConn

	var req model.RegisterUserRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(response.ResponseModel{
			RetCode: "400",
			Message: status.RetCode400,
			Data:    errors.ErrorModel{Message: "Invalid request body", IsSuccess: false, Error: err},
		})
	}

	if req.FirstName == "" || req.LastName == "" || req.Email == "" || req.Password == "" {
		return c.Status(400).JSON(response.ResponseModel{
			RetCode: "400",
			Message: "Missing required fields",
			Data:    errors.ErrorModel{Message: "First name, last name, email, and password are required", IsSuccess: false},
		})
	}

	var existing model.User
	if result := db.Table("public.users").Where("email = ?", req.Email).First(&existing); result.Error == nil {
		return c.Status(409).JSON(response.ResponseModel{
			RetCode: "409",
			Message: "Email already registered",
			Data:    errors.ErrorModel{Message: "A user with this email already exists", IsSuccess: false},
		})
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return c.Status(500).JSON(response.ResponseModel{
			RetCode: "500",
			Message: status.RetCode500,
			Data:    errors.ErrorModel{Message: "Failed to process password", IsSuccess: false, Error: err},
		})
	}

	userId := fmt.Sprintf("USER-%d", time.Now().UnixMilli())
	user := model.User{
		ID:        userId,
		FirstName: req.FirstName,
		LastName:  req.LastName,
		Email:     req.Email,
		Password:  string(hashedPassword),
		CreatedAt: time.Now().Format(time.RFC3339),
	}

	if err := db.Table("public.users").Create(&user).Error; err != nil {
		return c.Status(500).JSON(response.ResponseModel{
			RetCode: "500",
			Message: status.RetCode500,
			Data:    errors.ErrorModel{Message: "Failed to create user", IsSuccess: false, Error: err},
		})
	}

	return c.Status(201).JSON(response.ResponseModel{
		RetCode: "201",
		Message: "User registered successfully",
		Data: map[string]any{
			"id":    user.ID,
			"name":  user.FirstName + " " + user.LastName,
			"email": user.Email,
		},
	})
}

func LoginUser(c *fiber.Ctx) error {
	db := middleware.DBConn

	var req model.LoginRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(response.ResponseModel{
			RetCode: "400",
			Message: status.RetCode400,
			Data:    errors.ErrorModel{Message: "Invalid request body", IsSuccess: false, Error: err},
		})
	}

	var user model.User
	if err := db.Table("public.users").Where("email = ?", req.Email).First(&user).Error; err != nil {
		return c.Status(401).JSON(response.ResponseModel{
			RetCode: "401",
			Message: "Invalid email or password",
			Data:    errors.ErrorModel{Message: "User not found", IsSuccess: false},
		})
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password)); err != nil {
		return c.Status(401).JSON(response.ResponseModel{
			RetCode: "401",
			Message: "Invalid email or password",
			Data:    errors.ErrorModel{Message: "Incorrect password", IsSuccess: false},
		})
	}

	return c.Status(200).JSON(response.ResponseModel{
		RetCode: "200",
		Message: "Login successful",
		Data: map[string]any{
			"id":    user.ID,
			"name":  user.Name,
			"email": user.Email,
		},
	})
}

// ===================== ADMIN ENDPOINTS =====================

const AdminRegistrationKey = "FEEDFORWARD2026"

func RegisterAdmin(c *fiber.Ctx) error {
	db := middleware.DBConn

	var req model.RegisterAdminRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(response.ResponseModel{
			RetCode: "400",
			Message: status.RetCode400,
			Data:    errors.ErrorModel{Message: "Invalid request body", IsSuccess: false, Error: err},
		})
	}

	if req.AdminKey != AdminRegistrationKey {
		return c.Status(401).JSON(response.ResponseModel{
			RetCode: "401",
			Message: "Invalid admin registration key",
			Data:    errors.ErrorModel{Message: "The provided admin key is incorrect", IsSuccess: false},
		})
	}

	var existingEmail model.Admin
	if err := db.Table("public.admins").Where("email = ?", req.Email).First(&existingEmail).Error; err == nil {
		return c.Status(409).JSON(response.ResponseModel{
			RetCode: "409",
			Message: "Email already registered",
			Data:    errors.ErrorModel{Message: "An admin with this email already exists", IsSuccess: false},
		})
	}

	var existingUnit model.Admin
	if err := db.Table("public.admins").Where("LOWER(unit) = LOWER(?)", req.Unit).First(&existingUnit).Error; err == nil {
		return c.Status(409).JSON(response.ResponseModel{
			RetCode: "409",
			Message: "This unit already has an admin",
			Data:    errors.ErrorModel{Message: "Each unit can only have one admin", IsSuccess: false},
		})
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return c.Status(500).JSON(response.ResponseModel{
			RetCode: "500",
			Message: status.RetCode500,
			Data:    errors.ErrorModel{Message: "Failed to process password", IsSuccess: false, Error: err},
		})
	}

	adminId := fmt.Sprintf("ADMIN-%d", time.Now().UnixMilli())
	admin := model.Admin{
		ID:        adminId,
		FirstName: req.FirstName,
		LastName:  req.LastName,
		Email:     req.Email,
		Password:  string(hashedPassword),
		Unit:      req.Unit,
		CreatedAt: time.Now().Format(time.RFC3339),
	}

	if err := db.Table("public.admins").Create(&admin).Error; err != nil {
		return c.Status(500).JSON(response.ResponseModel{
			RetCode: "500",
			Message: status.RetCode500,
			Data:    errors.ErrorModel{Message: "Failed to create admin", IsSuccess: false, Error: err},
		})
	}

	return c.Status(201).JSON(response.ResponseModel{
		RetCode: "201",
		Message: "Admin registered successfully",
		Data: map[string]any{
			"id":    admin.ID,
			"name":  admin.FirstName + " " + admin.LastName,
			"email": admin.Email,
			"unit":  admin.Unit,
		},
	})
}

func LoginAdmin(c *fiber.Ctx) error {
	db := middleware.DBConn

	var req model.LoginRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(response.ResponseModel{
			RetCode: "400",
			Message: status.RetCode400,
			Data:    errors.ErrorModel{Message: "Invalid request body", IsSuccess: false, Error: err},
		})
	}

	var admin model.Admin
	if err := db.Table("public.admins").Where("email = ?", req.Email).First(&admin).Error; err != nil {
		return c.Status(401).JSON(response.ResponseModel{
			RetCode: "401",
			Message: "Invalid email or password",
			Data:    errors.ErrorModel{Message: "Admin not found", IsSuccess: false},
		})
	}

	if err := bcrypt.CompareHashAndPassword([]byte(admin.Password), []byte(req.Password)); err != nil {
		return c.Status(401).JSON(response.ResponseModel{
			RetCode: "401",
			Message: "Invalid email or password",
			Data:    errors.ErrorModel{Message: "Incorrect password", IsSuccess: false},
		})
	}

	return c.Status(200).JSON(response.ResponseModel{
		RetCode: "200",
		Message: "Login successful",
		Data: map[string]any{
			"id":    admin.ID,
			"name":  admin.Name,
			"email": admin.Email,
			"unit":  admin.Unit,
		},
	})
}

func UpdateAdminUnit(c *fiber.Ctx) error {
	db := middleware.DBConn

	adminId := c.Params("id")

	var req struct {
		Unit string `json:"unit"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(response.ResponseModel{
			RetCode: "400",
			Message: status.RetCode400,
			Data:    errors.ErrorModel{Message: "Invalid request body", IsSuccess: false, Error: err},
		})
	}

	var existingUnit model.Admin
	if err := db.Table("public.admins").Where("LOWER(unit) = LOWER(?) AND id != ?", req.Unit, adminId).First(&existingUnit).Error; err == nil {
		return c.Status(409).JSON(response.ResponseModel{
			RetCode: "409",
			Message: "This unit already has an admin",
			Data:    errors.ErrorModel{Message: "Change is not allowed", IsSuccess: false},
		})
	}

	if err := db.Table("public.admins").Where("id = ?", adminId).Updates(map[string]any{
		"unit":       req.Unit,
		"department": req.Unit,
	}).Error; err != nil {
		return c.Status(500).JSON(response.ResponseModel{
			RetCode: "500",
			Message: status.RetCode500,
			Data:    errors.ErrorModel{Message: "Failed to update unit", IsSuccess: false, Error: err},
		})
	}

	return c.Status(200).JSON(response.ResponseModel{
		RetCode: "200",
		Message: "Unit updated successfully",
		Data:    map[string]any{"unit": req.Unit},
	})
}

// ===================== FEEDBACK ENDPOINTS =====================

func getUserEmailByID(db *gorm.DB, userID string) (string, error) {
	trimmedID := strings.TrimSpace(userID)
	if trimmedID == "" {
		return "", nil
	}

	var user model.User
	if err := db.Table("public.users").Select("email").Where("id = ?", trimmedID).First(&user).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return "", nil
		}
		return "", err
	}

	return strings.TrimSpace(user.Email), nil
}

func getTrackBaseURL() string {
	baseURL := strings.TrimSpace(middleware.GetEnv("APP_BASE_URL"))
	if baseURL == "" {
		return "http://localhost:3000"
	}
	return strings.TrimRight(baseURL, "/")
}

func buildTrackURL(trackingID string) string {
	return fmt.Sprintf("%s/track?trackingId=%s", getTrackBaseURL(), url.QueryEscape(trackingID))
}

func buildFeedbackEmailHTML(title string, subtitle string, feedback model.Feedback, ctaText string, ctaURL string, adminResponse string) string {
	responseBlock := ""
	if strings.TrimSpace(adminResponse) != "" {
		responseBlock = fmt.Sprintf(`
		<div style="margin-top:18px;padding:12px;border-radius:8px;background:#f3f4f6;">
			<div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.08em;">Admin response</div>
			<div style="font-size:13px;color:#111827;margin-top:6px;line-height:1.5;">%s</div>
		</div>`, html.EscapeString(adminResponse))
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
	      <div style="font-size:13px;color:#4b5563;margin-top:8px;">%s</div>

	      <table style="width:100%%;margin-top:18px;border-collapse:collapse;">
	        <tr>
	          <td style="width:36%%;padding:8px 0;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.08em;">Tracking ID</td>
	          <td style="padding:8px 0;font-size:13px;color:#111827;font-weight:600;">%s</td>
	        </tr>
	        <tr>
	          <td style="padding:8px 0;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.08em;">Category</td>
	          <td style="padding:8px 0;font-size:13px;color:#111827;">%s</td>
	        </tr>
	        <tr>
	          <td style="padding:8px 0;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.08em;">Subject</td>
	          <td style="padding:8px 0;font-size:13px;color:#111827;">%s</td>
	        </tr>
	        <tr>
	          <td style="padding:8px 0;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.08em;">Status</td>
	          <td style="padding:8px 0;font-size:13px;color:#111827;">%s</td>
	        </tr>
	      </table>

	      %s

	      <div style="margin-top:18px;">
	        <a href="%s" style="display:inline-block;background:#f59e0b;color:#111827;text-decoration:none;font-size:12px;font-weight:700;padding:10px 14px;border-radius:6px;">%s</a>
	      </div>

	      <div style="margin-top:16px;font-size:11px;color:#6b7280;">Please keep this tracking ID to check updates later.</div>
	      <div style="margin-top:16px;font-size:11px;color:#9ca3af;">Thank you,<br/>FeedForward</div>
	    </div>
	  </div>
	</div>`,
		html.EscapeString(title),
		html.EscapeString(subtitle),
		html.EscapeString(feedback.ID),
		html.EscapeString(feedback.Category),
		html.EscapeString(feedback.Subject),
		html.EscapeString(feedback.Status),
		responseBlock,
		html.EscapeString(ctaURL),
		html.EscapeString(ctaText),
	)
}

func SubmitFeedback(c *fiber.Ctx) error {
	db := middleware.DBConn

	var req model.FeedbackRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(response.ResponseModel{
			RetCode: "400",
			Message: status.RetCode400,
			Data:    errors.ErrorModel{Message: "Invalid request body", IsSuccess: false, Error: err},
		})
	}

	now := time.Now().Format(time.RFC3339)
	trackingId := fmt.Sprintf("FF-%s", strings.ToUpper(fmt.Sprintf("%x", time.Now().UnixMilli())))

	var userID *string
	if req.UserID != "" {
		userID = &req.UserID
	}

	feedback := model.Feedback{
		ID:          trackingId,
		Type:        req.Type,
		Category:    strings.TrimSpace(req.Category),
		Subject:     req.Subject,
		Message:     req.Message,
		Status:      "Pending",
		Priority:    "Medium",
		UserID:      userID,
		UserName:    req.UserName,
		IsAnonymous: req.IsAnonymous,
		Response:    "",
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	if err := db.Table("public.feedbacks").Create(&feedback).Error; err != nil {
		return c.Status(500).JSON(response.ResponseModel{
			RetCode: "500",
			Message: status.RetCode500,
			Data:    errors.ErrorModel{Message: "Failed to submit feedback", IsSuccess: false, Error: err},
		})
	}

	recipientEmail, err := getUserEmailByID(db, req.UserID)
	if err != nil {
		log.Printf("submit feedback: failed to lookup user email: %v", err)
	}
	if recipientEmail != "" {
		emailBody := buildFeedbackEmailHTML(
			"Submission received",
			"We received your feedback submission.",
			feedback,
			"Track submission",
			buildTrackURL(feedback.ID),
			"",
		)
		if mailErr := SendHTMLEmail(recipientEmail, "FeedForward: Submission received", emailBody); mailErr != nil {
			log.Printf("submit feedback: failed to send email: %v", mailErr)
		}
	}

	return c.Status(201).JSON(response.ResponseModel{
		RetCode: "201",
		Message: "Feedback submitted successfully",
		Data:    feedback,
	})
}

func GetFeedbackByID(c *fiber.Ctx) error {
	db := middleware.DBConn

	id := c.Params("id")

	var feedback model.Feedback
	if err := db.Table("public.feedbacks").Where("id = ?", id).First(&feedback).Error; err != nil {
		return c.Status(404).JSON(response.ResponseModel{
			RetCode: "404",
			Message: "Feedback not found",
			Data:    errors.ErrorModel{Message: "No feedback found with id: " + id, IsSuccess: false},
		})
	}

	return c.Status(200).JSON(response.ResponseModel{
		RetCode: "200",
		Message: "Success",
		Data:    feedback,
	})
}

func GetFeedbacksByUser(c *fiber.Ctx) error {
	db := middleware.DBConn

	userId := c.Params("userId")

	var feedbacks []model.Feedback
	if err := db.Table("public.feedbacks").Where("user_id = ?", userId).Order("created_at DESC").Find(&feedbacks).Error; err != nil {
		return c.Status(500).JSON(response.ResponseModel{
			RetCode: "500",
			Message: status.RetCode500,
			Data:    errors.ErrorModel{Message: "Failed to fetch feedbacks", IsSuccess: false, Error: err},
		})
	}

	return c.Status(200).JSON(response.ResponseModel{
		RetCode: "200",
		Message: "Success",
		Data:    feedbacks,
	})
}

func GetFeedbacksByUnit(c *fiber.Ctx) error {
	db := middleware.DBConn

	unit := c.Params("unit")

	var feedbacks []model.Feedback
	if err := db.Table("public.feedbacks").Where("LOWER(TRIM(category)) = LOWER(TRIM(?))", unit).Order("created_at DESC").Find(&feedbacks).Error; err != nil {
		return c.Status(500).JSON(response.ResponseModel{
			RetCode: "500",
			Message: status.RetCode500,
			Data:    errors.ErrorModel{Message: "Failed to fetch feedbacks", IsSuccess: false, Error: err},
		})
	}

	return c.Status(200).JSON(response.ResponseModel{
		RetCode: "200",
		Message: "Success",
		Data:    feedbacks,
	})
}

func normalizeFeedbackStatus(rawStatus string) (string, error) {
	switch strings.ToLower(strings.TrimSpace(rawStatus)) {
	case "pending":
		return "Pending", nil
	case "under review", "in progress":
		return "In Progress", nil
	case "resolved", "closed":
		return "Resolved", nil
	default:
		return "", fmt.Errorf("invalid status: %s", rawStatus)
	}
}

func UpdateFeedback(c *fiber.Ctx) error {
	db := middleware.DBConn

	id := c.Params("id")

	var existing model.Feedback
	if err := db.Table("public.feedbacks").Where("id = ?", id).First(&existing).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(response.ResponseModel{
				RetCode: "404",
				Message: "Feedback not found",
				Data:    errors.ErrorModel{Message: "No feedback found with id: " + id, IsSuccess: false},
			})
		}
		return c.Status(500).JSON(response.ResponseModel{
			RetCode: "500",
			Message: status.RetCode500,
			Data:    errors.ErrorModel{Message: "Failed to load feedback", IsSuccess: false, Error: err},
		})
	}

	var req model.UpdateFeedbackRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(response.ResponseModel{
			RetCode: "400",
			Message: status.RetCode400,
			Data:    errors.ErrorModel{Message: "Invalid request body", IsSuccess: false, Error: err},
		})
	}

	updates := map[string]any{
		"updated_at": time.Now().Format(time.RFC3339),
	}
	if req.Status != "" {
		normalizedStatus, statusErr := normalizeFeedbackStatus(req.Status)
		if statusErr != nil {
			return c.Status(400).JSON(response.ResponseModel{
				RetCode: "400",
				Message: status.RetCode400,
				Data:    errors.ErrorModel{Message: "Invalid feedback status", IsSuccess: false},
			})
		}
		updates["status"] = normalizedStatus
	}
	if req.Priority != "" {
		updates["priority"] = req.Priority
	}
	if req.Response != "" {
		updates["response"] = req.Response
	}

	if err := db.Table("public.feedbacks").Where("id = ?", id).Updates(updates).Error; err != nil {
		return c.Status(500).JSON(response.ResponseModel{
			RetCode: "500",
			Message: status.RetCode500,
			Data:    errors.ErrorModel{Message: "Failed to update feedback", IsSuccess: false, Error: err},
		})
	}

	var feedback model.Feedback
	if err := db.Table("public.feedbacks").Where("id = ?", id).First(&feedback).Error; err != nil {
		return c.Status(500).JSON(response.ResponseModel{
			RetCode: "500",
			Message: status.RetCode500,
			Data:    errors.ErrorModel{Message: "Failed to load updated feedback", IsSuccess: false, Error: err},
		})
	}

	if !strings.EqualFold(existing.Status, "Resolved") && strings.EqualFold(feedback.Status, "Resolved") {
		recipientEmail := ""
		if existing.UserID != nil {
			email, lookupErr := getUserEmailByID(db, *existing.UserID)
			recipientEmail = email
			if lookupErr != nil {
				log.Printf("update feedback: failed to lookup user email: %v", lookupErr)
			}
		}

		if recipientEmail != "" {
			emailBody := buildFeedbackEmailHTML(
				"Submission resolved",
				"Your feedback has been resolved.",
				feedback,
				"View details",
				buildTrackURL(feedback.ID),
				feedback.Response,
			)
			if mailErr := SendHTMLEmail(recipientEmail, "FeedForward: Submission resolved", emailBody); mailErr != nil {
				log.Printf("update feedback: failed to send email: %v", mailErr)
			}
		}
	}

	return c.Status(200).JSON(response.ResponseModel{
		RetCode: "200",
		Message: "Feedback updated successfully",
		Data:    feedback,
	})
}

func DeleteFeedback(c *fiber.Ctx) error {
	db := middleware.DBConn

	id := c.Params("id")

	if err := db.Table("public.feedbacks").Where("id = ?", id).Delete(&map[string]any{}).Error; err != nil {
		return c.Status(500).JSON(response.ResponseModel{
			RetCode: "500",
			Message: status.RetCode500,
			Data:    errors.ErrorModel{Message: "Failed to delete feedback", IsSuccess: false, Error: err},
		})
	}

	return c.Status(200).JSON(response.ResponseModel{
		RetCode: "200",
		Message: "Feedback deleted successfully",
		Data:    "Feedback " + id + " deleted",
	})
}

// func GetSampleData(c *fiber.Ctx) error {

// 	return c.SendStatus(200)
// }

func Getall(c *fiber.Ctx) error {
	//initializing database
	db := middleware.DBConn

	//Storage preparation
	var data []map[string]any

	/*
		[
			{
				"keys": string,
				"keys": int
			}

		]
	*/

	//Process to get all values from students table
	// & pointer
	// kung si err ay may laman mangyayari yung nasa loob ng function
	// nil = null
	// retCode need to study based on the response message
	if err := db.Raw("SELECT * FROM public.FeedForward").Scan(&data).Error; err != nil {
		return c.Status(500).JSON(response.ResponseModel{
			RetCode: "500",
			Message: status.RetCode500,
			Data: errors.ErrorModel{
				Message:   "Failed to get all names",
				IsSuccess: false,
				Error:     err,
			},
		})
	}

	//Success response
	return c.Status(200).JSON(response.ResponseModel{
		RetCode: "200",
		Message: "Success!",
		Data:    data,
	})
}

func GetSingleData(c *fiber.Ctx) error {
	//initializing database
	db := middleware.DBConn

	//Storage preparation
	var data []map[string]any

	if err := db.Raw("SELECT name FROM public.user").Scan(&data).Error; err != nil {
		return c.Status(500).JSON(response.ResponseModel{
			RetCode: "500",
			Message: status.RetCode500,
			Data: errors.ErrorModel{
				Message:   "Failed to fetch single name",
				IsSuccess: false,
				Error:     err,
			},
		})
	}

	return c.Status(200).JSON(response.ResponseModel{
		RetCode: "200",
		Message: "Success!!",
		Data:    data,
	})
}

func FeedForward(c *fiber.Ctx) error {
	//initializing database
	db := middleware.DBConn

	//Storage preparation
	var InsertData map[string]any

	//validating user input in json
	if err := c.BodyParser(&InsertData); err != nil {
		return c.Status(401).JSON(response.ResponseModel{
			RetCode: "401",
			Message: status.RetCode401,
			Data: errors.ErrorModel{
				Message:   "Invalid parse request",
				IsSuccess: false,
				Error:     err,
			},
		})
	}

	// Execute INSERT using GORM
	if err := db.Table("public.feedbacks").Create(&InsertData).Error; err != nil {
		return c.Status(500).JSON(response.ResponseModel{
			RetCode: "500",
			Message: status.RetCode500,
			Data: errors.ErrorModel{
				Message:   "Failed to insert feedback",
				IsSuccess: false,
				Error:     err,
			},
		})
	}

	//success response
	return c.Status(200).JSON(response.ResponseModel{
		RetCode: "200",
		Message: "Success!",
		Data:    InsertData,
	})
}

// ========================================================
// STRUCT - Ito yung "blueprint" o template ng ating table
// sa database. Bawat field dito ay kumakatawan sa isang
// column sa ating PostgreSQL table.
//
// IMPORTANTENG ALALAHANIN:
//   - Ang `gorm:"column:name"` ay nagsasabi sa GORM kung anong
//     exact na pangalan ng column sa database.
//   - Make sure na naka-align ang Go field name at column name.
//
// ========================================================
type sample_table_columns struct {
	Name string `gorm:"column:name"` // Column "name" sa database
}

// ========================================================
// UPDATE FUNCTION - Para sa pag-edit/pag-update ng data
//
// Paano ito gumagana:
// 1. Kumuha ng ID mula sa URL (hal: /update/5 -> id = 5)
// 2. Basahin yung bagong data mula sa request body (JSON)
// 3. I-update ang record na may matching ID sa database
// 4. Ibalik ang success o error na mensahe
//
// Halimbawa ng URL:  PUT /update/5
// Halimbawa ng Body: { "name": "Juan Dela Cruz" }
// ========================================================
func Update_sample_data(c *fiber.Ctx) error {

	// Kumonekta sa database gamit ang ating middleware
	db := middleware.DBConn

	// Dito natin ilalagay yung data na gusto ng user i-update
	// Ginagamit natin ang map[string]any para pwedeng mag-update
	// ng kahit anong field nang hindi kailangan ng specific struct
	var updateData map[string]any

	// Kunin ang ID mula sa URL parameter
	// Halimbawa: kung ang URL ay /update/5, ang id = "5"
	id := c.Params("id")

	// I-parse (basahin/i-convert) yung JSON body ng request
	// Para maunawaan ng Go yung data na galing sa user
	if err := c.BodyParser(&updateData); err != nil {
		return c.Status(401).JSON(response.ResponseModel{
			RetCode: "401",
			Message: status.RetCode401,
			Data: errors.ErrorModel{
				Message:   "Invalid parse request",
				IsSuccess: false,
				Error:     err,
			},
		})
	}

	// ACTUAL NA PAG-UPDATE SA DATABASE
	// - db.Table("public.students") -> Sabihin sa GORM kung saang table mag-a-update
	// - Where("id = ?", id)         -> Hanapin ang row na may specific na ID
	// - Updates(updateData)         -> I-update gamit ang bagong data ng user
	if err := db.Table("public.students").
		Where("id = ?", id).
		Updates(updateData).Error; err != nil {
		return c.Status(500).JSON(response.ResponseModel{
			RetCode: "500",
			Message: status.RetCode500,
			Data: errors.ErrorModel{
				Message:   "Failed to update student name",
				IsSuccess: false,
				Error:     err,
			},
		})
	}

	// Kung matagumpay ang update, ibalik ang 200 OK
	// Kasama rin nating ibalik ang updated na data para makita ng user
	return c.Status(200).JSON(response.ResponseModel{
		RetCode: "200",
		Message: "Success!",
		Data:    updateData,
	})
}

// ========================================================
// DELETE FUNCTION - Para sa pag-bura/pag-delete ng data
//
// Paano ito gumagana:
// 1. Kumuha ng ID mula sa URL (hal: /delete/5 -> id = 5)
// 2. Hanapin ang record na may matching ID sa database
// 3. Burahin ang record
// 4. Ibalik ang success o error na mensahe
//
// Halimbawa ng URL: DELETE /delete/5
// ========================================================
func Delete_sample_data(c *fiber.Ctx) error {

	// Kumonekta sa database gamit ang ating middleware
	db := middleware.DBConn

	id := c.Params("id")

	if err := db.Table("public.students").Where("id = ?", id).Delete(&map[string]any{}).Error; err != nil {
		return c.Status(500).JSON(response.ResponseModel{
			RetCode: "500",
			Message: status.RetCode500,
			Data: errors.ErrorModel{
				Message:   "Failed to delete data",
				IsSuccess: false,
				Error:     err,
			},
		})
	}

	return c.Status(200).JSON(response.ResponseModel{
		RetCode: "200",
		Message: "Success!!",
		Data:    "Record with ID " + id + " successfully deleted",
	})
}

// ===================== SUPERADMIN ENDPOINTS =====================

func superAdminAuth(c *fiber.Ctx) bool {
	return c.Get("X-SuperAdmin-Token") == middleware.GetEnv("SUPERADMIN_KEY")
}

func SuperAdminLogin(c *fiber.Ctx) error {
	var req struct {
		Key string `json:"key"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(response.ResponseModel{
			RetCode: "400",
			Message: status.RetCode400,
			Data:    errors.ErrorModel{Message: "Invalid request body", IsSuccess: false, Error: err},
		})
	}
	if req.Key != middleware.GetEnv("SUPERADMIN_KEY") {
		return c.Status(401).JSON(response.ResponseModel{
			RetCode: "401",
			Message: "Invalid superadmin key",
			Data:    errors.ErrorModel{Message: "The provided key is incorrect", IsSuccess: false},
		})
	}
	expiresAt := time.Now().Add(8 * time.Hour).Format(time.RFC3339)
	return c.Status(200).JSON(response.ResponseModel{
		RetCode: "200",
		Message: "Superadmin login successful",
		Data: map[string]any{
			"token":     middleware.GetEnv("SUPERADMIN_KEY"),
			"name":      "Superadmin",
			"expiresAt": expiresAt,
		},
	})
}

func SuperAdminListAdmins(c *fiber.Ctx) error {
	if !superAdminAuth(c) {
		return c.Status(401).JSON(response.ResponseModel{
			RetCode: "401",
			Message: "Unauthorized superadmin access",
			Data:    errors.ErrorModel{Message: "Invalid or missing superadmin token", IsSuccess: false},
		})
	}
	db := middleware.DBConn
	var admins []model.Admin
	if err := db.Table("public.admins").Order("created_at DESC").Find(&admins).Error; err != nil {
		return c.Status(500).JSON(response.ResponseModel{
			RetCode: "500",
			Message: status.RetCode500,
			Data:    errors.ErrorModel{Message: "Failed to fetch admins", IsSuccess: false, Error: err},
		})
	}
	return c.Status(200).JSON(response.ResponseModel{
		RetCode: "200",
		Message: "Success",
		Data:    admins,
	})
}

func SuperAdminCreateAdmin(c *fiber.Ctx) error {
	if !superAdminAuth(c) {
		return c.Status(401).JSON(response.ResponseModel{
			RetCode: "401",
			Message: "Unauthorized superadmin access",
			Data:    errors.ErrorModel{Message: "Invalid or missing superadmin token", IsSuccess: false},
		})
	}
	db := middleware.DBConn

	var req struct {
		FirstName string `json:"firstName"`
		LastName  string `json:"lastName"`
		Email     string `json:"email"`
		Password  string `json:"password"`
		Unit      string `json:"unit"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(response.ResponseModel{
			RetCode: "400",
			Message: status.RetCode400,
			Data:    errors.ErrorModel{Message: "Invalid request body", IsSuccess: false, Error: err},
		})
	}

	var existing model.Admin
	if db.Table("public.admins").Where("email = ?", req.Email).First(&existing).Error == nil {
		return c.Status(409).JSON(response.ResponseModel{
			RetCode: "409",
			Message: "Email already registered",
			Data:    errors.ErrorModel{Message: "An admin with this email already exists", IsSuccess: false},
		})
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return c.Status(500).JSON(response.ResponseModel{
			RetCode: "500",
			Message: status.RetCode500,
			Data:    errors.ErrorModel{Message: "Failed to process password", IsSuccess: false, Error: err},
		})
	}

	now := time.Now().Format(time.RFC3339)
	admin := model.Admin{
		ID:        fmt.Sprintf("ADMIN-%d", time.Now().UnixMilli()),
		FirstName: req.FirstName,
		LastName:  req.LastName,
		Email:     req.Email,
		Password:  string(hashedPassword),
		Unit:      req.Unit,
		CreatedAt: now,
		UpdatedAt: now,
	}

	if err := db.Table("public.admins").Create(&admin).Error; err != nil {
		return c.Status(500).JSON(response.ResponseModel{
			RetCode: "500",
			Message: status.RetCode500,
			Data:    errors.ErrorModel{Message: "Failed to create admin", IsSuccess: false, Error: err},
		})
	}

	return c.Status(201).JSON(response.ResponseModel{
		RetCode: "201",
		Message: "Admin created successfully",
		Data:    admin,
	})
}

func SuperAdminUpdateAdmin(c *fiber.Ctx) error {
	if !superAdminAuth(c) {
		return c.Status(401).JSON(response.ResponseModel{
			RetCode: "401",
			Message: "Unauthorized superadmin access",
			Data:    errors.ErrorModel{Message: "Invalid or missing superadmin token", IsSuccess: false},
		})
	}
	db := middleware.DBConn
	id := c.Params("id")

	var req struct {
		FirstName string `json:"firstName"`
		LastName  string `json:"lastName"`
		Email     string `json:"email"`
		Password  string `json:"password"`
		Unit      string `json:"unit"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(response.ResponseModel{
			RetCode: "400",
			Message: status.RetCode400,
			Data:    errors.ErrorModel{Message: "Invalid request body", IsSuccess: false, Error: err},
		})
	}

	updates := map[string]any{
		"updated_at": time.Now().Format(time.RFC3339),
	}
	if req.FirstName != "" {
		updates["first_name"] = req.FirstName
	}
	if req.LastName != "" {
		updates["last_name"] = req.LastName
	}
	if req.Email != "" {
		updates["email"] = req.Email
	}
	if req.Unit != "" {
		updates["unit"] = req.Unit
	}
	if req.Password != "" {
		hashed, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
		if err != nil {
			return c.Status(500).JSON(response.ResponseModel{
				RetCode: "500",
				Message: status.RetCode500,
				Data:    errors.ErrorModel{Message: "Failed to process password", IsSuccess: false, Error: err},
			})
		}
		updates["password"] = string(hashed)
	}

	if err := db.Table("public.admins").Where("id = ?", id).Updates(updates).Error; err != nil {
		return c.Status(500).JSON(response.ResponseModel{
			RetCode: "500",
			Message: status.RetCode500,
			Data:    errors.ErrorModel{Message: "Failed to update admin", IsSuccess: false, Error: err},
		})
	}

	var admin model.Admin
	db.Table("public.admins").Where("id = ?", id).First(&admin)

	return c.Status(200).JSON(response.ResponseModel{
		RetCode: "200",
		Message: "Admin updated successfully",
		Data:    admin,
	})
}

func SuperAdminDeleteAdmin(c *fiber.Ctx) error {
	if !superAdminAuth(c) {
		return c.Status(401).JSON(response.ResponseModel{
			RetCode: "401",
			Message: "Unauthorized superadmin access",
			Data:    errors.ErrorModel{Message: "Invalid or missing superadmin token", IsSuccess: false},
		})
	}
	db := middleware.DBConn
	id := c.Params("id")

	if err := db.Table("public.admins").Where("id = ?", id).Delete(&map[string]any{}).Error; err != nil {
		return c.Status(500).JSON(response.ResponseModel{
			RetCode: "500",
			Message: status.RetCode500,
			Data:    errors.ErrorModel{Message: "Failed to delete admin", IsSuccess: false, Error: err},
		})
	}

	return c.Status(200).JSON(response.ResponseModel{
		RetCode: "200",
		Message: "Admin deleted successfully",
		Data:    "Admin " + id + " deleted",
	})
}

// ===================== CATEGORY MANAGEMENT =====================

func listAllCategories(db *gorm.DB) ([]model.Category, error) {
	var categories []model.Category
	err := db.Table("public.categories").Order("id ASC").Find(&categories).Error
	return categories, err
}

func SuperAdminListCategories(c *fiber.Ctx) error {
	db := middleware.DBConn
	categories, err := listAllCategories(db)
	if err != nil {
		return c.Status(500).JSON(response.ResponseModel{
			RetCode: "500",
			Message: status.RetCode500,
			Data:    errors.ErrorModel{Message: "Failed to fetch categories", IsSuccess: false, Error: err},
		})
	}
	return c.Status(200).JSON(response.ResponseModel{
		RetCode: "200",
		Message: "Success",
		Data:    categories,
	})
}

func SuperAdminCreateCategory(c *fiber.Ctx) error {
	if !superAdminAuth(c) {
		return c.Status(401).JSON(response.ResponseModel{
			RetCode: "401",
			Message: "Unauthorized superadmin access",
			Data:    errors.ErrorModel{Message: "Invalid or missing superadmin token", IsSuccess: false},
		})
	}
	db := middleware.DBConn

	var req struct {
		Name string `json:"name"`
	}
	if err := c.BodyParser(&req); err != nil || strings.TrimSpace(req.Name) == "" {
		return c.Status(400).JSON(response.ResponseModel{
			RetCode: "400",
			Message: status.RetCode400,
			Data:    errors.ErrorModel{Message: "Category name is required", IsSuccess: false},
		})
	}

	category := model.Category{Name: strings.TrimSpace(req.Name)}
	if err := db.Table("public.categories").Create(&category).Error; err != nil {
		return c.Status(500).JSON(response.ResponseModel{
			RetCode: "500",
			Message: status.RetCode500,
			Data:    errors.ErrorModel{Message: "Failed to create category", IsSuccess: false, Error: err},
		})
	}

	categories, err := listAllCategories(db)
	if err != nil {
		return c.Status(500).JSON(response.ResponseModel{
			RetCode: "500",
			Message: status.RetCode500,
			Data:    errors.ErrorModel{Message: "Failed to fetch updated categories", IsSuccess: false, Error: err},
		})
	}
	return c.Status(201).JSON(response.ResponseModel{
		RetCode: "201",
		Message: "Category created successfully",
		Data:    categories,
	})
}

func SuperAdminUpdateCategory(c *fiber.Ctx) error {
	if !superAdminAuth(c) {
		return c.Status(401).JSON(response.ResponseModel{
			RetCode: "401",
			Message: "Unauthorized superadmin access",
			Data:    errors.ErrorModel{Message: "Invalid or missing superadmin token", IsSuccess: false},
		})
	}
	db := middleware.DBConn
	id := c.Params("id")

	var req struct {
		Name string `json:"name"`
	}
	if err := c.BodyParser(&req); err != nil || strings.TrimSpace(req.Name) == "" {
		return c.Status(400).JSON(response.ResponseModel{
			RetCode: "400",
			Message: status.RetCode400,
			Data:    errors.ErrorModel{Message: "Category name is required", IsSuccess: false},
		})
	}

	if err := db.Table("public.categories").Where("id = ?", id).Update("name", strings.TrimSpace(req.Name)).Error; err != nil {
		return c.Status(500).JSON(response.ResponseModel{
			RetCode: "500",
			Message: status.RetCode500,
			Data:    errors.ErrorModel{Message: "Failed to update category", IsSuccess: false, Error: err},
		})
	}

	categories, err := listAllCategories(db)
	if err != nil {
		return c.Status(500).JSON(response.ResponseModel{
			RetCode: "500",
			Message: status.RetCode500,
			Data:    errors.ErrorModel{Message: "Failed to fetch updated categories", IsSuccess: false, Error: err},
		})
	}
	return c.Status(200).JSON(response.ResponseModel{
		RetCode: "200",
		Message: "Category updated successfully",
		Data:    categories,
	})
}

func SuperAdminDeleteCategory(c *fiber.Ctx) error {
	if !superAdminAuth(c) {
		return c.Status(401).JSON(response.ResponseModel{
			RetCode: "401",
			Message: "Unauthorized superadmin access",
			Data:    errors.ErrorModel{Message: "Invalid or missing superadmin token", IsSuccess: false},
		})
	}
	db := middleware.DBConn
	id := c.Params("id")

	if err := db.Table("public.categories").Where("id = ?", id).Delete(&model.Category{}).Error; err != nil {
		return c.Status(500).JSON(response.ResponseModel{
			RetCode: "500",
			Message: status.RetCode500,
			Data:    errors.ErrorModel{Message: "Failed to delete category", IsSuccess: false, Error: err},
		})
	}

	categories, err := listAllCategories(db)
	if err != nil {
		return c.Status(500).JSON(response.ResponseModel{
			RetCode: "500",
			Message: status.RetCode500,
			Data:    errors.ErrorModel{Message: "Failed to fetch updated categories", IsSuccess: false, Error: err},
		})
	}
	return c.Status(200).JSON(response.ResponseModel{
		RetCode: "200",
		Message: "Category deleted successfully",
		Data:    categories,
	})
}
