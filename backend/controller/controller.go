package controller

import (
	"fmt"
	"strings"
	"time"

	"FeedForward/backend/middleware"
	"FeedForward/backend/model"
	"FeedForward/backend/model/errors"
	"FeedForward/backend/model/response"
	"FeedForward/backend/model/status"

	"github.com/gofiber/fiber/v2"
	"golang.org/x/crypto/bcrypt"
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
	if req.UserID != "" && !req.IsAnonymous {
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

func UpdateFeedback(c *fiber.Ctx) error {
	db := middleware.DBConn

	id := c.Params("id")

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
		updates["status"] = req.Status
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
	db.Table("public.feedbacks").Where("id = ?", id).First(&feedback)

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

	// Kunin ang ID mula sa URL parameter
	// Halimbawa: kung ang URL ay /delete/5, ang id = "5"
	id := c.Params("id")

	// ACTUAL NA PAG-DELETE SA DATABASE
	// - db.Table("public.sample_table") -> Sabihin sa GORM kung saang table magde-delete
	// - Where("uid = ?", id)            -> Hanapin ang row na may specific na ID
	// - Delete(&map[string]any{})       -> Burahin ang nahanap na row
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

	// Kung matagumpay ang delete, ibalik ang 200 OK
	// Kasama rin nating ibalik kung anong ID ang nabura para
	// malaman ng user na tama ang na-delete
	return c.Status(200).JSON(response.ResponseModel{
		RetCode: "200",
		Message: "Success!!",
		Data:    "Record with ID " + id + " successfully deleted",
	})
}

// ===================== SUPERADMIN ENDPOINTS =====================

const SuperAdminKey = "SUPERADMIN-FEEDFORWARD-2026"

func superAdminAuth(c *fiber.Ctx) bool {
	return c.Get("X-SuperAdmin-Token") == SuperAdminKey
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
	if req.Key != SuperAdminKey {
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
			"token":     SuperAdminKey,
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
