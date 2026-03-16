package routes

import (
	"FeedForward/backend/controller"

	"github.com/gofiber/fiber/v2"
)

func AppRoutes(app *fiber.App) {
	// Health check
	app.Get("/", func(c *fiber.Ctx) error {
		return c.SendString("FeedForward API is running!")
	})

	api := app.Group("/api")

	// User routes
	api.Post("/users/register", controller.RegisterUser)
	api.Post("/users/login", controller.LoginUser)
	api.Post("/users/forgot-password", controller.ForgotPassword)
	api.Post("/users/reset-password", controller.ResetPassword)

	// Admin routes
	api.Post("/admins/register", controller.RegisterAdmin)
	api.Post("/admins/login", controller.LoginAdmin)
	api.Put("/admins/:id/unit", controller.UpdateAdminUnit)

	// Feedback routes — specific paths must be before /:id
	api.Post("/feedbacks", controller.SubmitFeedback)
	api.Get("/feedbacks/user/:userId", controller.GetFeedbacksByUser)
	api.Get("/feedbacks/unit/:unit", controller.GetFeedbacksByUnit)
	api.Get("/feedbacks/:id", controller.GetFeedbackByID)
	api.Put("/feedbacks/:id", controller.UpdateFeedback)
	api.Delete("/feedbacks/:id", controller.DeleteFeedback)

	// Superadmin routes
	api.Post("/superadmin/login", controller.SuperAdminLogin)
	api.Get("/superadmin/admins", controller.SuperAdminListAdmins)
	api.Post("/superadmin/admins", controller.SuperAdminCreateAdmin)
	api.Put("/superadmin/admins/:id", controller.SuperAdminUpdateAdmin)
	api.Delete("/superadmin/admins/:id", controller.SuperAdminDeleteAdmin)
	api.Patch("/superadmin/admins/:id/disable", controller.SuperAdminDisableAdmin)

	// Category routes
	api.Get("/superadmin/categories", controller.SuperAdminListCategories)
	api.Post("/superadmin/categories", controller.SuperAdminCreateCategory)
	api.Put("/superadmin/categories/:id", controller.SuperAdminUpdateCategory)
	api.Delete("/superadmin/categories/:id", controller.SuperAdminDeleteCategory)
}
