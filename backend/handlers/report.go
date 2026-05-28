package handlers

import (
	"context"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/MishraShardendu22/github-backup/backend/db"
	"github.com/gofiber/fiber/v2"
	"gopkg.in/gomail.v2"
)

type ReportRequest struct {
	ReportType string `json:"report_type"`
}

func SendReport(c *fiber.Ctx) error {
	var req ReportRequest
	if err := c.BodyParser(&req); err != nil || req.ReportType == "" {
		req.ReportType = "latest"
	}

	smtpHost := os.Getenv("SMTP_HOST")
	smtpPortStr := os.Getenv("SMTP_PORT")
	smtpUser := os.Getenv("SMTP_USERNAME")
	smtpPass := os.Getenv("SMTP_PASSWORD")
	smtpFrom := os.Getenv("SMTP_FROM")
	smtpTo := os.Getenv("SMTP_TO")

	if smtpHost == "" || smtpUser == "" || smtpPass == "" {
		return c.Status(500).JSON(fiber.Map{"error": "SMTP not configured"})
	}

	smtpPort, _ := strconv.Atoi(smtpPortStr)
	if smtpPort == 0 {
		smtpPort = 587
	}

	bundle, err := BuildReportBundle(context.Background(), req.ReportType)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	pdfPath, err := GenerateReportPDF(context.Background(), bundle)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to generate pdf: " + err.Error()})
	}
	defer os.RemoveAll(filepath.Dir(pdfPath))

	from := smtpFrom
	if from == "" {
		from = smtpUser
	}
	to := smtpTo
	if to == "" {
		to = smtpUser
	}

	m := gomail.NewMessage()
	m.SetHeader("From", from)
	m.SetHeader("To", to)
	m.SetHeader("Subject", bundle.Subject)
	m.SetBody("text/plain", renderReportEmailText(bundle))
	m.Attach(pdfPath, gomail.Rename(bundle.Subject+".pdf"))

	d := gomail.NewDialer(smtpHost, smtpPort, smtpUser, smtpPass)
	if err := d.DialAndSend(m); err != nil {
		db.Pool.Exec(context.Background(),
			`INSERT INTO report_history (report_type, recipients, subject, status, error_message) VALUES ($1, $2, $3, 'failed', $4)`,
			req.ReportType, to, bundle.Subject, err.Error())
		return c.Status(500).JSON(fiber.Map{"error": "failed to send email: " + err.Error()})
	}

	db.Pool.Exec(context.Background(),
		`INSERT INTO report_history (report_type, recipients, subject, status) VALUES ($1, $2, $3, 'sent')`,
		req.ReportType, to, bundle.Subject)

	return c.JSON(fiber.Map{"sent": true, "subject": bundle.Subject, "to": to, "report": bundle})
}

func renderReportEmailText(bundle ReportBundle) string {
	var b strings.Builder
	b.WriteString(bundle.Subject)
	b.WriteString("\n\n")
	b.WriteString(bundle.Summary)
	b.WriteString("\n\nKey metrics:\n")
	for _, metric := range bundle.Metrics {
		b.WriteString("- ")
		b.WriteString(metric.Label)
		b.WriteString(": ")
		b.WriteString(metric.Value)
		if metric.Detail != "" {
			b.WriteString(" (")
			b.WriteString(metric.Detail)
			b.WriteString(")")
		}
		b.WriteString("\n")
	}
	b.WriteString("\nOpen the attached PDF for the full LaTeX report.")
	return b.String()
}

func GetLatestReport(c *fiber.Ctx) error {
	reportType := c.Query("report_type", "latest")
	bundle, err := BuildReportBundle(context.Background(), reportType)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(bundle)
}

func GetReportHistory(c *fiber.Ctx) error {
	rows, err := db.Pool.Query(context.Background(),
		`SELECT id, report_type, recipients, subject, status, error_message, sent_at
		 FROM report_history ORDER BY sent_at DESC LIMIT 50`)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	defer rows.Close()

	type Report struct {
		ID           int       `json:"id"`
		ReportType   string    `json:"report_type"`
		Recipients   string    `json:"recipients"`
		Subject      string    `json:"subject"`
		Status       string    `json:"status"`
		ErrorMessage string    `json:"error_message"`
		SentAt       time.Time `json:"sent_at"`
	}

	var reports []Report
	for rows.Next() {
		var r Report
		if err := rows.Scan(&r.ID, &r.ReportType, &r.Recipients, &r.Subject, &r.Status, &r.ErrorMessage, &r.SentAt); err != nil {
			continue
		}
		reports = append(reports, r)
	}

	if reports == nil {
		reports = []Report{}
	}
	return c.JSON(reports)
}
