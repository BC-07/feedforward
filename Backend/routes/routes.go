package routes

import (
	"intern_template_v1/controller"

	"github.com/gofiber/fiber/v2"
)

func AppRoutes(app *fiber.App) {
	// SAMPLE ENDPOINT
	// app.Get("/", func(c *fiber.Ctx) error {
	// 	return c.SendString("Hello Golang World!")
	// })
	

	// CREATE YOUR ENDPOINTS HERE

	// Auth - Users
	app.Post("/auth/users/register", controller.RegisterUser)
	app.Post("/auth/users/login", controller.LoginUser)
	app.Post("/auth/users/forgot-password", controller.ForgotPassword)
	app.Post("/auth/users/verify-reset-otp", controller.VerifyResetOTP)
	app.Post("/auth/users/reset-password", controller.ResetPassword)
	app.Put("/auth/users/:id/profile", controller.UpdateUserProfile)
	app.Put("/auth/users/:id/password", controller.UpdateUserPassword)
	app.Delete("/auth/users/:id", controller.DeleteUserAccount)

	// Auth - Admins
	app.Post("/auth/admins/register", controller.RegisterAdmin)
	app.Post("/auth/admins/login", controller.LoginAdmin)
	app.Post("/auth/admins/set-password", controller.SetAdminPassword)
	app.Post("/auth/admins/reverify", controller.ReverifyAdmin)
	app.Put("/auth/admins/:id/profile", controller.UpdateAdminProfile)
	app.Put("/auth/admins/:id/password", controller.UpdateAdminPassword)
	app.Delete("/auth/admins/:id", controller.DeleteAdminAccount)

	// Auth - Superadmin
	app.Post("/auth/superadmin/login", controller.LoginSuperAdmin)
	app.Post("/auth/superadmin/reverify", controller.ReverifySuperAdmin)
	app.Post("/auth/superadmin/ping", controller.PingSuperAdminSession)

	// Auth - Session
	app.Get("/auth/session", controller.GetSessionInfo)
	app.Post("/auth/logout", controller.Logout)

	// Superadmin - Admins
	app.Get("/superadmin/admins", controller.ListAdmins)
	app.Post("/superadmin/admins", controller.CreateAdminBySuperAdmin)
	app.Put("/superadmin/admins/:id", controller.UpdateAdminBySuperAdmin)
	app.Put("/superadmin/admins/:id/disable", controller.DisableAdminBySuperAdmin)
	app.Put("/superadmin/admins/:id/enable", controller.EnableAdminBySuperAdmin)

	// Superadmin - Categories
	app.Get("/categories", controller.ListCategories)
	app.Post("/superadmin/categories", controller.CreateCategoryBySuperAdmin)
	app.Put("/superadmin/categories/:id", controller.UpdateCategoryBySuperAdmin)
	app.Delete("/superadmin/categories/:id", controller.DeleteCategoryBySuperAdmin)

	// Superadmin - Stats
	app.Get("/superadmin/stats/resolved-admins", controller.GetResolvedAdminsStats)
	app.Get("/superadmin/stats/submissions-categories", controller.GetCategorySubmissionsStats)

	// Feedbacks
	app.Get("/feedbacks", controller.GetFeedbacks)
	app.Get("/feedbacks/:id", controller.GetFeedbackByID)
	app.Get("/feedbacks/:id/messages", controller.ListFeedbackMessages)
	app.Post("/feedbacks/moderate", controller.ModerateFeedback)
	app.Post("/feedbacks", controller.CreateFeedback)
	app.Put("/feedbacks/:id", controller.UpdateFeedback)
	app.Post("/feedbacks/:id/messages", controller.CreateFeedbackMessage)
	app.Delete("/feedbacks/:id", controller.DeleteFeedback)
	// --------------------------
}
