package routes

import (
	"intern_template_v1/controller"

	"github.com/gofiber/fiber/v2"
)

func AppRoutes(app *fiber.App) {
	// SAMPLE ENDPOINT
	app.Get("/", func(c *fiber.Ctx) error {
		return c.SendString("Hello Golang World!")
	})

	// CREATE YOUR ENDPOINTS HERE

	app.Post("/auth/users/register", controller.RegisterUser)
	app.Post("/auth/users/login", controller.LoginUser)
	app.Get("/auth/me", controller.Me)
	app.Post("/auth/logout", controller.Logout)
	app.Put("/auth/users/:id/profile", controller.UpdateUserProfile)
	app.Put("/auth/users/:id/password", controller.UpdateUserPassword)
	app.Delete("/auth/users/:id", controller.DeleteUserAccount)
	app.Post("/auth/admins/register", controller.RegisterAdmin)
	app.Post("/auth/admins/login", controller.LoginAdmin)
	app.Post("/auth/admins/reverify", controller.ReverifyAdmin)
	app.Put("/auth/admins/:id/profile", controller.UpdateAdminProfile)
	app.Put("/auth/admins/:id/password", controller.UpdateAdminPassword)
	app.Delete("/auth/admins/:id", controller.DeleteAdminAccount)
	app.Post("/auth/superadmin/login", controller.LoginSuperAdmin)
	app.Post("/auth/superadmin/reverify", controller.ReverifySuperAdmin)
	app.Get("/superadmin/admins", controller.ListAdmins)
	app.Post("/superadmin/admins", controller.CreateAdminBySuperAdmin)
	app.Put("/superadmin/admins/:id", controller.UpdateAdminBySuperAdmin)
	app.Put("/superadmin/admins/:id/disable", controller.DisableAdminBySuperAdmin)
	app.Put("/superadmin/admins/:id/enable", controller.EnableAdminBySuperAdmin)
	app.Get("/categories", controller.ListCategories)
	app.Post("/superadmin/categories", controller.CreateCategoryBySuperAdmin)
	app.Put("/superadmin/categories/:id", controller.UpdateCategoryBySuperAdmin)
	app.Delete("/superadmin/categories/:id", controller.DeleteCategoryBySuperAdmin)
	app.Get("/feedbacks", controller.GetFeedbacks)
	app.Get("/feedbacks/:id", controller.GetFeedbackByID)
	app.Post("/feedbacks", controller.CreateFeedback)
	app.Put("/feedbacks/:id", controller.UpdateFeedback)
	// --------------------------
}
