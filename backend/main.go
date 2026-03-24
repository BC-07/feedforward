package main

import (
	"fmt"
	"log"
	"strings"

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
	appName := strings.TrimSpace(middleware.GetEnv("PROJ_NAME"))
	if appName == "" {
		appName = "FeedForward"
	}

	app := fiber.New(fiber.Config{
		AppName: appName,
	})

	// CORS must be registered BEFORE routes
	app.Use(cors.New(cors.Config{
		AllowOrigins: "*",
		AllowHeaders: "Origin, Content-Type, Accept",
		AllowMethods: "GET, POST, PUT, PATCH, DELETE, OPTIONS",
	}))

	// LOGGER
	app.Use(logger.New())

	// Do not remove this endpoint
	app.Get("/favicon.ico", func(c *fiber.Ctx) error {
		return c.SendStatus(204) // No Content
	})

	routes.AppRoutes(app)

	// Start Server
	port := strings.TrimSpace(middleware.GetEnv("PROJ_PORT"))
	if port == "" {
		port = "5566"
	}

	listenAddr := fmt.Sprintf(":%s", port)
	if err := app.Listen(listenAddr); err != nil {
		log.Fatalf("failed to start server on %s: %v", listenAddr, err)
	}
}
