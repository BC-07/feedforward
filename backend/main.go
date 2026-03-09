package main

import (
	"fmt"

	"FeedForward/backend/middleware"
	"FeedForward/backend/routes"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
)

func init() {
	fmt.Println("STARTING SERVER...")
	fmt.Println("INITIALIZE DB CONNECTION...")
	if middleware.ConnectDB() {
		fmt.Println("DB CONNECTION FAILED!")
	} else {
		fmt.Println("DB CONNECTION SUCCESSFUL!")
	}
}

func main() {
	app := fiber.New(fiber.Config{
		AppName: middleware.GetEnv("PROJ_NAME"),
	})

	// CORS must be registered BEFORE routes
	app.Use(cors.New(cors.Config{
		AllowOrigins: "*",
		AllowHeaders: "Origin, Content-Type, Accept",
		AllowMethods: "GET, POST, PUT, DELETE, OPTIONS",
	}))

	// LOGGER
	app.Use(logger.New())

	// Do not remove this endpoint
	app.Get("/favicon.ico", func(c *fiber.Ctx) error {
		return c.SendStatus(204) // No Content
	})

	routes.AppRoutes(app)

	// Start Server
	app.Listen(fmt.Sprintf(":%s", middleware.GetEnv("PROJ_PORT")))
}
