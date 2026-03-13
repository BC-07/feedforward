package controller

import (
	"errors"
	"fmt"
	"net/smtp"
	"strings"

	"FeedForward/backend/middleware"
)

type mailConfig struct {
	host     string
	port     string
	username string
	password string
	from     string
}

func loadMailConfig() mailConfig {
	host := strings.TrimSpace(middleware.GetEnv("MAIL_HOST"))
	port := strings.TrimSpace(middleware.GetEnv("MAIL_PORT"))
	username := strings.TrimSpace(middleware.GetEnv("MAIL_USERNAME"))
	password := strings.TrimSpace(middleware.GetEnv("MAIL_PASSWORD"))
	from := strings.TrimSpace(middleware.GetEnv("MAIL_FROM"))

	if host == "" {
		host = "smtp.gmail.com"
	}
	if port == "" {
		port = "587"
	}
	if username == "" {
		username = "systemfeedforward@gmail.com"
	}
	if from == "" {
		from = username
	}

	return mailConfig{
		host:     host,
		port:     port,
		username: username,
		password: password,
		from:     from,
	}
}

func SendHTMLEmail(to string, subject string, htmlBody string) error {
	if strings.TrimSpace(to) == "" {
		return errors.New("email recipient is empty")
	}

	config := loadMailConfig()
	if config.password == "" {
		return errors.New("MAIL_PASSWORD is not configured")
	}

	addr := fmt.Sprintf("%s:%s", config.host, config.port)

	headers := []string{
		fmt.Sprintf("From: %s", config.from),
		fmt.Sprintf("To: %s", to),
		fmt.Sprintf("Subject: %s", subject),
		"MIME-Version: 1.0",
		"Content-Type: text/html; charset=\"UTF-8\"",
	}

	msg := strings.Join(headers, "\r\n") + "\r\n\r\n" + htmlBody
	auth := smtp.PlainAuth("", config.username, config.password, config.host)
	return smtp.SendMail(addr, auth, config.from, []string{to}, []byte(msg))
}
