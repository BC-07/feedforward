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

	app.Get("Getnames", controller.Getnames)
	app.Post("InsertExec", controller.InsertExec)
	app.Post("/auth/users/register", controller.RegisterUser)
	app.Post("/auth/users/login", controller.LoginUser)
	app.Put("/auth/users/:id/profile", controller.UpdateUserProfile)
	app.Put("/auth/users/:id/password", controller.UpdateUserPassword)
	app.Delete("/auth/users/:id", controller.DeleteUserAccount)
	app.Post("/auth/admins/register", controller.RegisterAdmin)
	app.Post("/auth/admins/login", controller.LoginAdmin)
	app.Put("/auth/admins/:id/profile", controller.UpdateAdminProfile)
	app.Put("/auth/admins/:id/password", controller.UpdateAdminPassword)
	app.Delete("/auth/admins/:id", controller.DeleteAdminAccount)
	app.Get("/feedbacks", controller.GetFeedbacks)
	app.Get("/feedbacks/:id", controller.GetFeedbackByID)
	app.Post("/feedbacks", controller.CreateFeedback)
	app.Put("/feedbacks/:id", controller.UpdateFeedback)
	app.Delete("/feedbacks/:id", controller.DeleteFeedback)
	// --------------------------
}
