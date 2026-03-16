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
	"gorm.io/gorm"
)

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
