package middleware

import (
	"fmt"
	"strings"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

var (
	DBConn *gorm.DB
	DBErr  error
)

// ConnectDB initializes the connection to the PostgreSQL database using
// environment variables for configuration and assigns the connection
// to the global variable DBConn. It returns true if there was an error
// establishing the connection, otherwise false.
func ConnectDB() bool {
	// Database Confg
	tz := strings.TrimSpace(GetEnv("DB_TMEZ"))
	if tz == "" {
		tz = "UTC"
	}
	dns := fmt.Sprintf("host=%s port=%s dbname=%s user=%s password=%s sslmode=%s TimeZone=%s",
		GetEnv("DB_HOST"), GetEnv("DB_PORT"), GetEnv("DB_NAME"),
		GetEnv("DB_USER"), GetEnv("DB_PASS"), GetEnv("DB_SSLM"),
		tz)

	DBConn, DBErr = gorm.Open(postgres.Open(dns), &gorm.Config{})

	return DBErr != nil
}
