package controller

import (
	"crypto/tls"
	"fmt"
	"html"
	"mime"
	"net/smtp"
	"strconv"
	"strings"
	"time"

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

func sendEmail(to string, subject string, textBody string, htmlBody string) error {
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

	textBody = normalizeBody(textBody)
	htmlBody = normalizeBody(htmlBody)

	message := buildMultipartMessage(fromHeader, to, subjectHeader, textBody, htmlBody)

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
	textBody := buildTrackingEmailTextBody(*user, feedback, label)
	htmlBody := buildTrackingEmailBody(*user, feedback, label)
	return sendEmail(user.Email, subject, textBody, htmlBody)
}

func sendResolvedEmailForFeedback(feedback model.FeedbackModel) error {
	user, err := resolveFeedbackUser(feedback)
	if err != nil || user == nil {
		return err
	}

	label := feedbackTypeLabel(feedback.Type)

	subject := fmt.Sprintf("Resolved: %s Tracking ID %s", label, feedback.ID)
	textBody := buildResolvedEmailTextBody(*user, feedback, label)
	htmlBody := buildResolvedEmailBody(*user, feedback, label)
	return sendEmail(user.Email, subject, textBody, htmlBody)
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

	intro := fmt.Sprintf(
		`<p style="margin:0 0 16px 0;font-size:16px;line-height:24px;">Hello %s,</p>
<p style="margin:0 0 20px 0;font-size:16px;line-height:24px;">We received your %s submission.</p>`,
		esc(name),
		esc(strings.ToLower(label)),
	)

	rows := []string{
		detailRow("Tracking ID", feedback.ID),
		detailRow("Category", feedback.Category),
		detailRow("Subject", feedback.Subject),
		detailRow("Status", "Pending"),
	}

	body := intro +
		detailTable(rows) +
		`<p style="margin:20px 0 12px 0;font-size:14px;line-height:22px;color:#666666;">Please keep this tracking ID to check updates later.</p>`

	cta := ""
	if url := trackingPortalURL(); url != "" {
		cta = primaryButton("Track submission", url)
	}

	return buildEmailShell("Submission received", body+cta)
}

func buildTrackingEmailTextBody(user model.UserModel, feedback model.FeedbackModel, label string) string {
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

	intro := fmt.Sprintf(
		`<p style="margin:0 0 16px 0;font-size:16px;line-height:24px;">Hello %s,</p>
<p style="margin:0 0 20px 0;font-size:16px;line-height:24px;">Your %s has been resolved.</p>`,
		esc(name),
		esc(strings.ToLower(label)),
	)

	rows := []string{
		detailRow("Tracking ID", feedback.ID),
		detailRow("Category", feedback.Category),
		detailRow("Subject", feedback.Subject),
		detailRow("Status", "Resolved"),
	}

	responseBlock := fmt.Sprintf(
		`<div style="margin:20px 0 20px 0;padding:16px;border-radius:12px;background:#f5f5f5;">
<p style="margin:0 0 8px 0;font-size:14px;line-height:20px;color:#666666;">Admin response</p>
<p style="margin:0;font-size:15px;line-height:22px;color:#000000;">%s</p>
</div>`,
		formatMultiline(response),
	)

	body := intro + detailTable(rows) + responseBlock

	cta := ""
	if url := trackingPortalURL(); url != "" {
		cta = primaryButton("View details", url)
	}

	return buildEmailShell("Submission resolved", body+cta)
}

func buildResolvedEmailTextBody(user model.UserModel, feedback model.FeedbackModel, label string) string {
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

const emailAccent = "#FF9500"

func buildMultipartMessage(fromHeader string, to string, subjectHeader string, textBody string, htmlBody string) string {
	boundary := fmt.Sprintf("ff-%d", time.Now().UnixNano())
	headerLines := []string{
		fmt.Sprintf("From: %s", fromHeader),
		fmt.Sprintf("To: %s", to),
		fmt.Sprintf("Subject: %s", subjectHeader),
		"MIME-Version: 1.0",
		fmt.Sprintf("Content-Type: multipart/alternative; boundary=\"%s\"", boundary),
		"",
	}

	parts := []string{
		fmt.Sprintf("--%s", boundary),
		"Content-Type: text/plain; charset=UTF-8",
		"Content-Transfer-Encoding: 8bit",
		"",
		textBody,
		"",
		fmt.Sprintf("--%s", boundary),
		"Content-Type: text/html; charset=UTF-8",
		"Content-Transfer-Encoding: 8bit",
		"",
		htmlBody,
		"",
		fmt.Sprintf("--%s--", boundary),
		"",
	}

	return strings.Join(append(headerLines, parts...), "\r\n")
}

func buildEmailShell(title string, body string) string {
	return fmt.Sprintf(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>%s</title>
  </head>
  <body style="margin:0;padding:0;background:#ffffff;color:#000000;font-family:Arial, Helvetica, sans-serif;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%%" style="background:#ffffff;">
      <tr>
        <td align="center" style="padding:24px 12px;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="width:100%%;max-width:600px;border:1px solid #e6e6e6;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="background:%s;padding:20px 24px;">
                <p style="margin:0;font-size:18px;font-weight:700;letter-spacing:0.5px;color:#000000;">FEED FORWARD</p>
                <p style="margin:4px 0 0 0;font-size:12px;letter-spacing:1px;color:#000000;">SMART. FAST. SAFE.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 24px 8px 24px;">
                <h2 style="margin:0 0 16px 0;font-size:20px;line-height:26px;color:#000000;">%s</h2>
                %s
              </td>
            </tr>
            <tr>
              <td style="padding:16px 24px 24px 24px;">
                <p style="margin:0;font-size:12px;line-height:18px;color:#666666;">Thank you,<br/>FeedForward</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`, esc(title), emailAccent, esc(title), body)
}

func detailTable(rows []string) string {
	return fmt.Sprintf(`<table role="presentation" cellpadding="0" cellspacing="0" width="100%%" style="border-collapse:collapse;border:1px solid #e6e6e6;border-radius:12px;overflow:hidden;">
%s
</table>`, strings.Join(rows, ""))
}

func detailRow(label string, value string) string {
	return fmt.Sprintf(`<tr>
  <td style="padding:10px 14px;font-size:12px;text-transform:uppercase;letter-spacing:0.4px;color:#666666;background:#f5f5f5;width:35%%;">%s</td>
  <td style="padding:10px 14px;font-size:14px;color:#000000;">%s</td>
</tr>`, esc(label), esc(value))
}

func primaryButton(label string, url string) string {
	return fmt.Sprintf(`<div style="margin:20px 0 8px 0;">
  <a href="%s" style="display:inline-block;background:%s;color:#000000;text-decoration:none;font-size:14px;font-weight:600;padding:12px 18px;border-radius:10px;">%s</a>
</div>`, esc(url), emailAccent, esc(label))
}

func formatMultiline(value string) string {
	escaped := esc(value)
	return strings.ReplaceAll(escaped, "\n", "<br/>")
}

func esc(value string) string {
	return html.EscapeString(strings.TrimSpace(value))
}
