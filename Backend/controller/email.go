package controller

import (
	"crypto/tls"
	"fmt"
	"mime"
	"net/smtp"
	"strconv"
	"strings"

	"intern_template_v1/middleware"
	"intern_template_v1/model"
)

type smtpConfig struct {
	Enabled  bool
	Host     string
	Port     int
	Username string
	Password string
	From     string
	FromName string
}

func loadSMTPConfig() (smtpConfig, error) {
	enabled := parseBool(middleware.GetEnv("SMTP_ENABLED"))
	host := strings.TrimSpace(middleware.GetEnv("SMTP_HOST"))
	portValue := strings.TrimSpace(middleware.GetEnv("SMTP_PORT"))
	username := strings.TrimSpace(middleware.GetEnv("SMTP_USER"))
	password := strings.TrimSpace(middleware.GetEnv("SMTP_PASS"))
	from := strings.TrimSpace(middleware.GetEnv("SMTP_FROM"))
	fromName := strings.TrimSpace(middleware.GetEnv("SMTP_FROM_NAME"))

	port := 587
	if portValue != "" {
		if parsed, err := strconv.Atoi(portValue); err == nil && parsed > 0 {
			port = parsed
		}
	}

	if from == "" {
		from = username
	}

	cfg := smtpConfig{
		Enabled:  enabled,
		Host:     host,
		Port:     port,
		Username: username,
		Password: password,
		From:     from,
		FromName: fromName,
	}

	if !cfg.Enabled {
		return cfg, nil
	}
	if cfg.Host == "" || cfg.Username == "" || cfg.Password == "" || cfg.From == "" {
		return cfg, fmt.Errorf("missing SMTP configuration")
	}

	return cfg, nil
}

func parseBool(value string) bool {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "1", "true", "yes", "on":
		return true
	default:
		return false
	}
}

func formatAddress(name string, email string) string {
	if strings.TrimSpace(name) == "" {
		return email
	}
	encodedName := mime.QEncoding.Encode("utf-8", name)
	return fmt.Sprintf("%s <%s>", encodedName, email)
}

func normalizeBody(body string) string {
	lines := strings.Split(body, "\n")
	return strings.Join(lines, "\r\n")
}

func sendEmail(to string, subject string, body string) error {
	cfg, err := loadSMTPConfig()
	if err != nil {
		return err
	}
	if !cfg.Enabled {
		return fmt.Errorf("SMTP is disabled")
	}
	if strings.TrimSpace(to) == "" {
		return fmt.Errorf("missing recipient address")
	}

	fromHeader := formatAddress(cfg.FromName, cfg.From)
	subjectHeader := mime.QEncoding.Encode("utf-8", subject)

	message := strings.Join([]string{
		fmt.Sprintf("From: %s", fromHeader),
		fmt.Sprintf("To: %s", to),
		fmt.Sprintf("Subject: %s", subjectHeader),
		"MIME-Version: 1.0",
		"Content-Type: text/plain; charset=UTF-8",
		"Content-Transfer-Encoding: 8bit",
		"",
		normalizeBody(body),
	}, "\r\n")

	addr := fmt.Sprintf("%s:%d", cfg.Host, cfg.Port)
	return sendSMTP(cfg, addr, to, message)
}

func sendSMTP(cfg smtpConfig, addr string, to string, message string) error {
	auth := smtp.PlainAuth("", cfg.Username, cfg.Password, cfg.Host)

	if cfg.Port == 465 {
		tlsConfig := &tls.Config{ServerName: cfg.Host}
		conn, err := tls.Dial("tcp", addr, tlsConfig)
		if err != nil {
			return err
		}
		client, err := smtp.NewClient(conn, cfg.Host)
		if err != nil {
			return err
		}
		defer client.Close()

		if err := client.Auth(auth); err != nil {
			return err
		}
		if err := client.Mail(cfg.From); err != nil {
			return err
		}
		if err := client.Rcpt(to); err != nil {
			return err
		}

		writer, err := client.Data()
		if err != nil {
			return err
		}
		if _, err := writer.Write([]byte(message)); err != nil {
			return err
		}
		if err := writer.Close(); err != nil {
			return err
		}
		return client.Quit()
	}

	client, err := smtp.Dial(addr)
	if err != nil {
		return err
	}
	defer client.Close()

	if ok, _ := client.Extension("STARTTLS"); ok {
		if err := client.StartTLS(&tls.Config{ServerName: cfg.Host}); err != nil {
			return err
		}
	}
	if ok, _ := client.Extension("AUTH"); ok {
		if err := client.Auth(auth); err != nil {
			return err
		}
	}
	if err := client.Mail(cfg.From); err != nil {
		return err
	}
	if err := client.Rcpt(to); err != nil {
		return err
	}

	writer, err := client.Data()
	if err != nil {
		return err
	}
	if _, err := writer.Write([]byte(message)); err != nil {
		return err
	}
	if err := writer.Close(); err != nil {
		return err
	}
	return client.Quit()
}

func sendTrackingEmailForFeedback(feedback model.FeedbackModel) error {
	user, err := resolveFeedbackUser(feedback)
	if err != nil || user == nil {
		return err
	}

	label := feedbackTypeLabel(feedback.Type)

	subject := fmt.Sprintf("FeedForward %s Tracking ID: %s", label, feedback.ID)
	body := buildTrackingEmailBody(*user, feedback, label)
	return sendEmail(user.Email, subject, body)
}

func sendResolvedEmailForFeedback(feedback model.FeedbackModel) error {
	user, err := resolveFeedbackUser(feedback)
	if err != nil || user == nil {
		return err
	}

	label := feedbackTypeLabel(feedback.Type)

	subject := fmt.Sprintf("Resolved: %s Tracking ID %s", label, feedback.ID)
	body := buildResolvedEmailBody(*user, feedback, label)
	return sendEmail(user.Email, subject, body)
}

func notifyResolvedIfNeeded(previous model.FeedbackModel, updated model.FeedbackModel) error {
	if strings.EqualFold(previous.Status, "Resolved") {
		return nil
	}
	if !strings.EqualFold(updated.Status, "Resolved") {
		return nil
	}
	return sendResolvedEmailForFeedback(updated)
}

func resolveFeedbackUser(feedback model.FeedbackModel) (*model.UserModel, error) {
	if feedback.UserEmail != nil && strings.TrimSpace(*feedback.UserEmail) != "" {
		return &model.UserModel{Email: strings.TrimSpace(*feedback.UserEmail)}, nil
	}
	if feedback.UserID == nil || strings.TrimSpace(*feedback.UserID) == "" {
		return nil, nil
	}

	user, err := fetchUserByID(strings.TrimSpace(*feedback.UserID))
	if err != nil || user.ID == "" {
		return nil, err
	}
	if strings.TrimSpace(user.Email) == "" {
		return nil, nil
	}

	return &user, nil
}

func buildTrackingEmailBody(user model.UserModel, feedback model.FeedbackModel, label string) string {
	name := strings.TrimSpace(user.FirstName)
	if name == "" {
		name = strings.TrimSpace(user.Name)
	}
	if name == "" {
		name = "there"
	}

	builder := strings.Builder{}
	builder.WriteString(fmt.Sprintf("Hello %s,\n\n", name))
	builder.WriteString(fmt.Sprintf("We received your %s submission.\n", strings.ToLower(label)))
	builder.WriteString(fmt.Sprintf("Tracking ID: %s\n", feedback.ID))
	builder.WriteString(fmt.Sprintf("Category: %s\n", feedback.Category))
	builder.WriteString(fmt.Sprintf("Subject: %s\n", feedback.Subject))
	builder.WriteString("Status: Pending\n\n")
	builder.WriteString("Please keep this tracking ID to check updates later.\n")
	if url := trackingPortalURL(); url != "" {
		builder.WriteString(fmt.Sprintf("Track here: %s\n", url))
	}
	builder.WriteString("\nThank you,\nFeedForward")
	return builder.String()
}

func buildResolvedEmailBody(user model.UserModel, feedback model.FeedbackModel, label string) string {
	name := strings.TrimSpace(user.FirstName)
	if name == "" {
		name = strings.TrimSpace(user.Name)
	}
	if name == "" {
		name = "there"
	}

	response := "(No response provided.)"
	if feedback.Response != nil && strings.TrimSpace(*feedback.Response) != "" {
		response = strings.TrimSpace(*feedback.Response)
	}

	builder := strings.Builder{}
	builder.WriteString(fmt.Sprintf("Hello %s,\n\n", name))
	builder.WriteString(fmt.Sprintf("Your %s has been resolved.\n", strings.ToLower(label)))
	builder.WriteString(fmt.Sprintf("Tracking ID: %s\n", feedback.ID))
	builder.WriteString(fmt.Sprintf("Category: %s\n", feedback.Category))
	builder.WriteString(fmt.Sprintf("Subject: %s\n\n", feedback.Subject))
	builder.WriteString("Admin response:\n")
	builder.WriteString(response)
	builder.WriteString("\n\n")
	if url := trackingPortalURL(); url != "" {
		builder.WriteString(fmt.Sprintf("View details: %s\n", url))
	}
	builder.WriteString("\nThank you,\nFeedForward")
	return builder.String()
}

func feedbackTypeLabel(feedbackType string) string {
	switch strings.ToLower(strings.TrimSpace(feedbackType)) {
	case "complaint":
		return "Complaint"
	case "suggestion":
		return "Suggestion"
	case "inquiry":
		return "Inquiry"
	default:
		return "Feedback"
	}
}

func trackingPortalURL() string {
	base := strings.TrimSpace(middleware.GetEnv("FRONTEND_BASE_URL"))
	if base == "" {
		return ""
	}
	trimmed := strings.TrimRight(base, "/")
	return trimmed + "/track"
}
