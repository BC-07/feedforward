package middleware

import (
	"fmt"

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
	dns := fmt.Sprintf("host=%s port=%s dbname=%s user=%s password=%s sslmode=%s TimeZone=%s",
		GetEnv("DB_HOST"), GetEnv("DB_PORT"), GetEnv("DB_NAME"),
		GetEnv("DB_UNME"), GetEnv("DB_PWRD"), GetEnv("DB_SSLM"),
		GetEnv("DB_TMEZ"))

	DBConn, DBErr = gorm.Open(postgres.Open(dns), &gorm.Config{})
	if DBErr != nil {
		return true
	}

	DBErr = DBConn.Exec(`ALTER TABLE public.admins ADD COLUMN IF NOT EXISTS is_disabled BOOLEAN NOT NULL DEFAULT FALSE;`).Error
	if DBErr != nil {
		return true
	}

	DBErr = DBConn.Exec(`
		CREATE TABLE IF NOT EXISTS public.sessions
		(
			id character varying(64) NOT NULL,
			role character varying(20) NOT NULL,
			user_id character varying(64),
			admin_id character varying(64),
			superadmin_username character varying(120),
			created_at timestamp with time zone NOT NULL DEFAULT now(),
			last_activity_at timestamp with time zone NOT NULL,
			expires_at timestamp with time zone NOT NULL,
			reauth_expires_at timestamp with time zone,
			CONSTRAINT sessions_pkey PRIMARY KEY (id)
		);
	`).Error
	if DBErr != nil {
		return true
	}

	DBErr = DBConn.Exec(`
		CREATE INDEX IF NOT EXISTS idx_sessions_expires_at
		ON public.sessions (expires_at);
	`).Error
	if DBErr != nil {
		return true
	}

	return false
}
