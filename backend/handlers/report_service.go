package handlers

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/MishraShardendu22/github-backup/backend/db"
	"github.com/jung-kurt/gofpdf"
)

type ReportMetric struct {
	Label  string `json:"label"`
	Value  string `json:"value"`
	Detail string `json:"detail,omitempty"`
}

type ReportRepository struct {
	Name             string    `json:"name"`
	Status           string    `json:"status"`
	CommitHash       string    `json:"commit_hash"`
	ArchiveSizeBytes int64     `json:"archive_size_bytes"`
	ArchiveSize      string    `json:"archive_size"`
	CreatedAt        time.Time `json:"created_at"`
}

type ReportFailure struct {
	Repository string    `json:"repository"`
	Message    string    `json:"message"`
	CreatedAt  time.Time `json:"created_at"`
}

type ReportRunSnapshot struct {
	ID          int        `json:"id"`
	Status      string     `json:"status"`
	StartedAt   time.Time  `json:"started_at"`
	CompletedAt *time.Time `json:"completed_at,omitempty"`
	TotalRepos  int        `json:"total_repos"`
	Successful  int        `json:"successful"`
	Failed      int        `json:"failed"`
	Skipped     int        `json:"skipped"`
	DurationMs  int64      `json:"duration_ms"`
}

type ReportAnalyticsSnapshot struct {
	CapturedAt              time.Time  `json:"captured_at"`
	HeadCommit              string     `json:"head_commit"`
	HeadCommitMessage       string     `json:"head_commit_message"`
	HeadCommitAt            *time.Time `json:"head_commit_at,omitempty"`
	TotalCommits            int        `json:"total_commits"`
	BranchCount             int        `json:"branch_count"`
	TagCount                int        `json:"tag_count"`
	TrackedFiles            int        `json:"tracked_files"`
	TotalBlobSizeBytes      int64      `json:"total_blob_size_bytes"`
	AvgBlobSizeBytes        int64      `json:"avg_blob_size_bytes"`
	LargestBlobPath         string     `json:"largest_blob_path"`
	LargestBlobSizeBytes    int64      `json:"largest_blob_size_bytes"`
	ArchiveCount            int        `json:"archive_count"`
	TotalArchiveSizeBytes   int64      `json:"total_archive_size_bytes"`
	AvgArchiveSizeBytes     int64      `json:"avg_archive_size_bytes"`
	LargestArchivePath      string     `json:"largest_archive_path"`
	LargestArchiveSizeBytes int64      `json:"largest_archive_size_bytes"`
}

type ReportBundle struct {
	GeneratedAt  time.Time                `json:"generated_at"`
	ReportType   string                   `json:"report_type"`
	Subject      string                   `json:"subject"`
	Headline     string                   `json:"headline"`
	Summary      string                   `json:"summary"`
	AIInsights   []string                 `json:"ai_insights,omitempty"`
	Metrics      []ReportMetric           `json:"metrics"`
	Findings     []string                 `json:"findings"`
	NextSteps    []string                 `json:"next_steps"`
	Risks        []string                 `json:"risks"`
	Questions    []string                 `json:"questions"`
	Repositories []ReportRepository       `json:"repositories"`
	Failures     []ReportFailure          `json:"failures"`
	Run          ReportRunSnapshot        `json:"run"`
	Analytics    *ReportAnalyticsSnapshot `json:"analytics,omitempty"`
}

func BuildReportBundle(ctx context.Context, reportType string) (ReportBundle, error) {
	if reportType == "" {
		reportType = "latest"
	}

	bundle := ReportBundle{
		GeneratedAt: time.Now().UTC(),
		ReportType:  reportType,
	}

	run, err := loadLatestRun(ctx)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			bundle.Subject = "Backup Report"
			bundle.Headline = "No backup data available yet"
			bundle.Summary = "The report could not find any stored backup runs. Once a run completes, the latest data will appear here."
			bundle.Findings = []string{"No backup runs were found in the database."}
			bundle.NextSteps = []string{"Run the backup worker to collect the first stored snapshot."}
			bundle.Risks = []string{"There is no completed backup data to review yet."}
			bundle.Questions = []string{"Has the backup worker been connected to the PostgreSQL database?"}
			bundle.Metrics = []ReportMetric{{Label: "Runs", Value: "0"}, {Label: "Repositories", Value: "0"}, {Label: "Failures", Value: "0"}}
			return bundle, nil
		}
		return bundle, err
	}
	bundle.Run = run

	stats, err := loadReportStats(ctx)
	if err != nil {
		return bundle, err
	}

	analytics, _ := loadLatestAnalyticsSnapshot(ctx)
	bundle.Analytics = analytics

	repositories, _ := loadTopRepositories(ctx, run.ID)
	failures, _ := loadRecentFailures(ctx, reportType, run.ID)

	bundle.Repositories = repositories
	bundle.Failures = failures
	bundle.Subject = reportSubject(reportType, run)
	bundle.Headline = reportHeadline(reportType, run)
	bundle.Summary = reportSummary(run, analytics, repositories, failures)
	bundle.Metrics = reportMetrics(stats, run, analytics, repositories)
	bundle.Findings = reportFindings(run, analytics, repositories, failures)
	bundle.NextSteps = reportNextSteps(run, analytics, repositories, failures)
	bundle.Risks = reportRisks(run, analytics, repositories, failures)
	bundle.Questions = reportQuestions(run, analytics, repositories, failures)
	bundle.AIInsights = buildAIInsights(ctx, bundle)

	return bundle, nil
}

type reportStats struct {
	TotalRuns       int
	TotalRepos      int
	TotalSuccessful int
	TotalFailed     int
	TotalSkipped    int
	DistinctRepos   int
	TotalLogs       int
	TotalSizeBytes  int64
	LargestArchive  int64
	LargestRepo     string
}

func loadReportStats(ctx context.Context) (reportStats, error) {
	var stats reportStats

	if err := db.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM backup_runs`).Scan(&stats.TotalRuns); err != nil {
		return stats, err
	}

	if err := db.Pool.QueryRow(ctx, `SELECT COALESCE(SUM(successful), 0), COALESCE(SUM(failed), 0), COALESCE(SUM(skipped), 0) FROM backup_runs`).Scan(&stats.TotalSuccessful, &stats.TotalFailed, &stats.TotalSkipped); err != nil {
		return stats, err
	}

	if err := db.Pool.QueryRow(ctx, `SELECT COALESCE(COUNT(DISTINCT repo_full_name), 0), COALESCE(COUNT(*), 0), COALESCE(SUM(archive_size_bytes), 0), COALESCE(MAX(archive_size_bytes), 0), COALESCE((SELECT repo_full_name FROM backup_results ORDER BY archive_size_bytes DESC, created_at DESC LIMIT 1), '') FROM backup_results`).Scan(&stats.DistinctRepos, &stats.TotalRepos, &stats.TotalSizeBytes, &stats.LargestArchive, &stats.LargestRepo); err != nil {
		return stats, err
	}

	if err := db.Pool.QueryRow(ctx, `SELECT COALESCE(COUNT(*), 0) FROM execution_logs`).Scan(&stats.TotalLogs); err != nil {
		return stats, err
	}

	return stats, nil
}

func loadLatestRun(ctx context.Context) (ReportRunSnapshot, error) {
	var run ReportRunSnapshot
	err := db.Pool.QueryRow(ctx,
		`SELECT id, status, started_at, completed_at, total_repos, successful, failed, skipped, duration_ms
		 FROM backup_runs ORDER BY started_at DESC LIMIT 1`).Scan(
		&run.ID, &run.Status, &run.StartedAt, &run.CompletedAt, &run.TotalRepos, &run.Successful, &run.Failed, &run.Skipped, &run.DurationMs)
	if err != nil {
		return ReportRunSnapshot{}, err
	}
	return run, nil
}

func loadLatestAnalyticsSnapshot(ctx context.Context) (*ReportAnalyticsSnapshot, error) {
	var snapshot ReportAnalyticsSnapshot
	err := db.Pool.QueryRow(ctx,
		`SELECT captured_at, head_commit, head_commit_message, head_commit_at, total_commits, branch_count, tag_count, tracked_files,
		        total_blob_size_bytes, avg_blob_size_bytes, largest_blob_path, largest_blob_size_bytes,
		        archive_count, total_archive_size_bytes, avg_archive_size_bytes, largest_archive_path, largest_archive_size_bytes
		 FROM analytics_snapshots ORDER BY captured_at DESC LIMIT 1`).Scan(
		&snapshot.CapturedAt, &snapshot.HeadCommit, &snapshot.HeadCommitMessage, &snapshot.HeadCommitAt, &snapshot.TotalCommits, &snapshot.BranchCount, &snapshot.TagCount, &snapshot.TrackedFiles,
		&snapshot.TotalBlobSizeBytes, &snapshot.AvgBlobSizeBytes, &snapshot.LargestBlobPath, &snapshot.LargestBlobSizeBytes,
		&snapshot.ArchiveCount, &snapshot.TotalArchiveSizeBytes, &snapshot.AvgArchiveSizeBytes, &snapshot.LargestArchivePath, &snapshot.LargestArchiveSizeBytes)
	if err != nil {
		return nil, err
	}
	return &snapshot, nil
}

func loadTopRepositories(ctx context.Context, runID int) ([]ReportRepository, error) {
	rows, err := db.Pool.Query(ctx,
		`SELECT repo_full_name, status, commit_hash, archive_size_bytes, created_at
		 FROM backup_results WHERE run_id = $1 ORDER BY archive_size_bytes DESC, created_at DESC LIMIT 5`, runID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	repositories := make([]ReportRepository, 0, 5)
	for rows.Next() {
		var repo ReportRepository
		if err := rows.Scan(&repo.Name, &repo.Status, &repo.CommitHash, &repo.ArchiveSizeBytes, &repo.CreatedAt); err != nil {
			continue
		}
		repo.ArchiveSize = formatBytes(repo.ArchiveSizeBytes)
		repositories = append(repositories, repo)
	}
	return repositories, nil
}

func loadRecentFailures(ctx context.Context, reportType string, runID int) ([]ReportFailure, error) {
	query := `SELECT repo_full_name, error_message, created_at FROM backup_results WHERE status = 'failed'`
	args := []any{}

	if reportType != "failure" {
		query += ` AND run_id = $1`
		args = append(args, runID)
	} else {
		query += ` ORDER BY created_at DESC LIMIT 5`
	}

	if reportType != "failure" {
		query += ` ORDER BY created_at DESC LIMIT 5`
	}

	rows, err := db.Pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	failures := make([]ReportFailure, 0, 5)
	for rows.Next() {
		var failure ReportFailure
		if err := rows.Scan(&failure.Repository, &failure.Message, &failure.CreatedAt); err != nil {
			continue
		}
		failures = append(failures, failure)
	}
	return failures, nil
}

func reportSubject(reportType string, run ReportRunSnapshot) string {
	prefix := "Backup Report"
	if reportType == "failure" {
		prefix = "Backup Failure Report"
	}
	dateText := run.StartedAt.Format("2006-01-02")
	if run.StartedAt.IsZero() {
		dateText = time.Now().Format("2006-01-02")
	}
	return fmt.Sprintf("%s - %s", prefix, dateText)
}

func reportHeadline(reportType string, run ReportRunSnapshot) string {
	if reportType == "failure" {
		return "Latest failure summary"
	}
	return fmt.Sprintf("Latest run: %s", strings.Title(run.Status))
}

func reportSummary(run ReportRunSnapshot, analytics *ReportAnalyticsSnapshot, repositories []ReportRepository, failures []ReportFailure) string {
	parts := []string{
		fmt.Sprintf("The latest stored run started at %s and processed %d repositories with %d successful, %d failed, and %d skipped results.", run.StartedAt.Format("2006-01-02 15:04"), run.TotalRepos, run.Successful, run.Failed, run.Skipped),
	}
	if !run.CompletedAt.IsZero() {
		parts = append(parts, fmt.Sprintf("The run completed at %s after %s.", run.CompletedAt.Format("2006-01-02 15:04"), formatDuration(run.DurationMs)))
	}
	if analytics != nil {
		parts = append(parts, fmt.Sprintf("The latest analytics snapshot captured %d tracked files and %d total commits.", analytics.TrackedFiles, analytics.TotalCommits))
	}
	if len(repositories) > 0 {
		parts = append(parts, fmt.Sprintf("The largest stored repository in this snapshot is %s at %s.", repositories[0].Name, repositories[0].ArchiveSize))
	}
	if len(failures) > 0 {
		parts = append(parts, fmt.Sprintf("The report includes %d recent failure item(s) for review.", len(failures)))
	}
	return strings.Join(parts, " ")
}

func reportMetrics(stats reportStats, run ReportRunSnapshot, analytics *ReportAnalyticsSnapshot, repositories []ReportRepository) []ReportMetric {
	archiveSize := stats.TotalSizeBytes
	largestArchive := stats.LargestArchive
	if analytics != nil {
		archiveSize = analytics.TotalArchiveSizeBytes
		largestArchive = analytics.LargestArchiveSizeBytes
	}

	metrics := []ReportMetric{
		{Label: "Runs", Value: fmt.Sprintf("%d", stats.TotalRuns), Detail: "Stored backup runs"},
		{Label: "Repos", Value: fmt.Sprintf("%d", stats.TotalRepos), Detail: fmt.Sprintf("%d distinct repositories", stats.DistinctRepos)},
		{Label: "Success", Value: fmt.Sprintf("%d", run.Successful), Detail: fmt.Sprintf("%d skipped / %d failed", run.Skipped, run.Failed)},
		{Label: "Archive", Value: formatBytes(archiveSize), Detail: fmt.Sprintf("Largest: %s", formatBytes(largestArchive))},
	}

	if analytics != nil {
		metrics = append(metrics,
			ReportMetric{Label: "Tracked files", Value: fmt.Sprintf("%d", analytics.TrackedFiles), Detail: fmt.Sprintf("%d commits / %d branches", analytics.TotalCommits, analytics.BranchCount)},
		)
	}
	if len(repositories) > 0 {
		metrics = append(metrics, ReportMetric{Label: "Largest repo", Value: repositories[0].Name, Detail: repositories[0].ArchiveSize})
	}
	return metrics
}

func reportFindings(run ReportRunSnapshot, analytics *ReportAnalyticsSnapshot, repositories []ReportRepository, failures []ReportFailure) []string {
	findings := []string{
		fmt.Sprintf("The latest run processed %d repositories and completed with %d successful backups.", run.TotalRepos, run.Successful),
	}
	if len(repositories) > 0 {
		findings = append(findings, fmt.Sprintf("%s is the largest repository in the current snapshot at %s.", repositories[0].Name, repositories[0].ArchiveSize))
	}
	if analytics != nil {
		findings = append(findings, fmt.Sprintf("The snapshot contains %d tracked files and %d archive entries.", analytics.TrackedFiles, analytics.ArchiveCount))
	}
	if len(failures) > 0 {
		findings = append(findings, fmt.Sprintf("There are %d recent failure record(s) in the stored results.", len(failures)))
	} else if run.Failed == 0 {
		findings = append(findings, "No failures were recorded for the latest run.")
	}
	return findings
}

func reportNextSteps(run ReportRunSnapshot, analytics *ReportAnalyticsSnapshot, repositories []ReportRepository, failures []ReportFailure) []string {
	nextSteps := []string{}
	if len(failures) > 0 || run.Failed > 0 {
		nextSteps = append(nextSteps, "Review the failure logs for the repositories that failed in the latest snapshot.")
	}
	if len(repositories) > 0 {
		nextSteps = append(nextSteps, fmt.Sprintf("Inspect %s before the next backup window to confirm the archive size is expected.", repositories[0].Name))
	}
	if analytics != nil && analytics.LargestArchiveSizeBytes > 0 {
		nextSteps = append(nextSteps, fmt.Sprintf("Check the largest archive path, %s, for any growth that needs cleanup.", analytics.LargestArchivePath))
	}
	if len(nextSteps) == 0 {
		nextSteps = append(nextSteps, "Capture another run so the report can compare the next stored snapshot.")
	}
	return nextSteps
}

func reportRisks(run ReportRunSnapshot, analytics *ReportAnalyticsSnapshot, repositories []ReportRepository, failures []ReportFailure) []string {
	risks := []string{}
	if len(repositories) > 0 && repositories[0].ArchiveSizeBytes > 1_000_000_000 {
		risks = append(risks, "Large repositories may increase backup duration and storage costs.")
	}
	if run.Failed > 0 || len(failures) > 0 {
		risks = append(risks, "Recurring failures could reduce coverage if they are not triaged quickly.")
	}
	if analytics != nil && analytics.TotalArchiveSizeBytes > 0 {
		risks = append(risks, "Archive growth should be monitored to avoid storage pressure on future runs.")
	}
	if len(risks) == 0 {
		risks = append(risks, "The stored data does not show an immediate backup risk.")
	}
	return risks
}

func reportQuestions(run ReportRunSnapshot, analytics *ReportAnalyticsSnapshot, repositories []ReportRepository, failures []ReportFailure) []string {
	questions := []string{}
	if len(repositories) > 0 {
		questions = append(questions, fmt.Sprintf("Should %s be moved to a size-based cleanup policy?", repositories[0].Name))
	}
	if run.Failed > 0 {
		questions = append(questions, "Do we want to alert on repeated failures in the latest run?")
	}
	if analytics != nil && analytics.LargestArchivePath != "" {
		questions = append(questions, fmt.Sprintf("Do we want to track %s as a retention hotspot?", analytics.LargestArchivePath))
	}
	if len(failures) > 0 {
		questions = append(questions, "Should the failure list be surfaced automatically in the next scheduled email?")
	}
	if len(questions) == 0 {
		questions = append(questions, "Do we want to compare the next run against this baseline automatically?")
	}
	return questions
}

func buildAIInsights(ctx context.Context, bundle ReportBundle) []string {
	apiKey := os.Getenv("MODEL_KEY")
	if apiKey == "" {
		return fallbackAIInsights(bundle)
	}

	model := os.Getenv("MODEL_NAME")
	if model == "" {
		model = "google/gemini-2.5-flash"
	}
	if !strings.Contains(model, ":online") {
		model += ":online"
	}

	payload := map[string]any{
		"run":          bundle.Run,
		"summary":      bundle.Summary,
		"metrics":      bundle.Metrics,
		"findings":     bundle.Findings,
		"next_steps":   bundle.NextSteps,
		"risks":        bundle.Risks,
		"questions":    bundle.Questions,
		"insights":     bundle.AIInsights,
		"repositories": bundle.Repositories,
		"failures":     bundle.Failures,
	}
	if bundle.Analytics != nil {
		payload["analytics"] = bundle.Analytics
	}

	requestBody := map[string]any{
		"model": model,
		"messages": []map[string]string{
			{"role": "system", "content": "You write structured report addenda for a GitHub backup monitoring system. Return only JSON."},
			{"role": "user", "content": fmt.Sprintf("Use the following report bundle data to produce a richer, factual report addendum. Return JSON with keys summary_detail, insights, and common_questions. summary_detail must be one paragraph. insights must be 4-6 concise bullets. common_questions must be 3-5 question-and-answer strings using the form 'Q: ... A: ...'. Keep the response grounded in the supplied data and suitable for inclusion in a PDF report.\n\n%s", mustJSON(payload))},
		},
		"response_format": map[string]string{"type": "json_object"},
	}

	bodyJSON, _ := json.Marshal(requestBody)
	httpReq, _ := http.NewRequestWithContext(ctx, "POST", "https://openrouter.ai/api/v1/chat/completions", bytes.NewReader(bodyJSON))
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+apiKey)
	httpReq.Header.Set("HTTP-Referer", os.Getenv("OPENROUTER_SITE_URL"))
	httpReq.Header.Set("X-Title", "GitHub Backup Monitor")

	client := &http.Client{Timeout: 60 * time.Second}
	resp, err := client.Do(httpReq)
	if err != nil {
		return fallbackAIInsights(bundle)
	}
	defer resp.Body.Close()

	respBytes, _ := io.ReadAll(resp.Body)
	var result struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.Unmarshal(respBytes, &result); err != nil || len(result.Choices) == 0 {
		return fallbackAIInsights(bundle)
	}

	content := strings.TrimSpace(result.Choices[0].Message.Content)
	content = strings.Trim(content, "`")

	var parsed struct {
		SummaryDetail   string   `json:"summary_detail"`
		Insights        []string `json:"insights"`
		CommonQuestions []string `json:"common_questions"`
	}
	if err := json.Unmarshal([]byte(content), &parsed); err != nil {
		return fallbackAIInsights(bundle)
	}

	insights := make([]string, 0, 1+len(parsed.Insights)+len(parsed.CommonQuestions))
	if parsed.SummaryDetail != "" {
		insights = append(insights, parsed.SummaryDetail)
	}
	insights = append(insights, parsed.Insights...)
	insights = append(insights, parsed.CommonQuestions...)
	if len(insights) == 0 {
		return fallbackAIInsights(bundle)
	}
	return insights
}

func fallbackAIInsights(bundle ReportBundle) []string {
	insights := []string{fmt.Sprintf("The latest run processed %d repositories with %d successes and %d failures.", bundle.Run.TotalRepos, bundle.Run.Successful, bundle.Run.Failed)}
	if len(bundle.Repositories) > 0 {
		insights = append(insights, fmt.Sprintf("The largest repository in the current snapshot is %s at %s.", bundle.Repositories[0].Name, bundle.Repositories[0].ArchiveSize))
	}
	if bundle.Analytics != nil {
		insights = append(insights, fmt.Sprintf("The latest snapshot recorded %d tracked files and %d archive entries.", bundle.Analytics.TrackedFiles, bundle.Analytics.ArchiveCount))
		if bundle.Analytics.LargestArchivePath != "" {
			insights = append(insights, fmt.Sprintf("Review %s for growth pressure before the next retention window.", bundle.Analytics.LargestArchivePath))
		}
	}
	if len(bundle.Questions) > 0 {
		insights = append(insights, fmt.Sprintf("Common review questions: %s", strings.Join(bundle.Questions, " ")))
	}
	return insights
}

func mustJSON(value any) string {
	data, err := json.MarshalIndent(value, "", "  ")
	if err != nil {
		return "{}"
	}
	return string(data)
}

func RenderReportHTML(bundle ReportBundle) string {
	var b strings.Builder
	b.WriteString(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>`)
	b.WriteString(htmlEscape(bundle.Subject))
	b.WriteString(`</title></head><body style="margin:0;background:#f7f5f0;color:#1a1a1a;font-family:Arial,Helvetica,sans-serif;padding:24px;">`)
	b.WriteString(`<div style="max-width:840px;margin:0 auto;background:#fff;border:1px solid #e2ddd5;border-radius:18px;padding:28px;box-shadow:0 14px 44px rgba(26,26,26,0.05);">`)
	b.WriteString(`<div style="display:flex;justify-content:space-between;gap:16px;align-items:flex-start;flex-wrap:wrap;margin-bottom:18px;">`)
	b.WriteString(`<div><div style="font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#9b9590;margin-bottom:8px;">Backup report</div>`)
	b.WriteString(`<h1 style="margin:0 0 8px;font-size:28px;line-height:1.1;">` + htmlEscape(bundle.Headline) + `</h1>`)
	b.WriteString(`<p style="margin:0;color:#6b6560;line-height:1.7;max-width:720px;">` + htmlEscape(bundle.Summary) + `</p></div>`)
	b.WriteString(`<div style="padding:10px 14px;border:1px solid #e2ddd5;border-radius:999px;font-size:12px;color:#6b6560;white-space:nowrap;">` + htmlEscape(bundle.GeneratedAt.Format("2006-01-02 15:04 UTC")) + `</div>`)
	b.WriteString(`</div>`)
	b.WriteString(reportMetricGridHTML(bundle.Metrics))
	b.WriteString(reportSectionHTML("Findings", bundle.Findings))
	b.WriteString(reportSectionHTML("Next steps", bundle.NextSteps))
	b.WriteString(reportSectionHTML("Risks", bundle.Risks))
	b.WriteString(reportSectionHTML("Questions", bundle.Questions))
	if len(bundle.Repositories) > 0 {
		b.WriteString(`<div style="margin-top:18px;"><div style="font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#9b9590;margin-bottom:8px;">Top repositories</div><table style="width:100%;border-collapse:collapse;">`)
		b.WriteString(`<tr><th style="text-align:left;padding:10px 0;border-bottom:1px solid #eae6df;font-size:12px;color:#6b6560;">Repository</th><th style="text-align:left;padding:10px 0;border-bottom:1px solid #eae6df;font-size:12px;color:#6b6560;">Archive size</th><th style="text-align:left;padding:10px 0;border-bottom:1px solid #eae6df;font-size:12px;color:#6b6560;">Status</th></tr>`)
		for _, repo := range bundle.Repositories {
			b.WriteString(`<tr><td style="padding:10px 0;border-bottom:1px solid #f0ede6;">` + htmlEscape(repo.Name) + `</td><td style="padding:10px 0;border-bottom:1px solid #f0ede6;">` + htmlEscape(repo.ArchiveSize) + `</td><td style="padding:10px 0;border-bottom:1px solid #f0ede6;">` + htmlEscape(repo.Status) + `</td></tr>`)
		}
		b.WriteString(`</table></div>`)
	}
	if len(bundle.Failures) > 0 {
		b.WriteString(`<div style="margin-top:18px;"><div style="font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#9b9590;margin-bottom:8px;">Recent failures</div><table style="width:100%;border-collapse:collapse;">`)
		b.WriteString(`<tr><th style="text-align:left;padding:10px 0;border-bottom:1px solid #eae6df;font-size:12px;color:#6b6560;">Repository</th><th style="text-align:left;padding:10px 0;border-bottom:1px solid #eae6df;font-size:12px;color:#6b6560;">Error</th><th style="text-align:left;padding:10px 0;border-bottom:1px solid #eae6df;font-size:12px;color:#6b6560;">Time</th></tr>`)
		for _, failure := range bundle.Failures {
			b.WriteString(`<tr><td style="padding:10px 0;border-bottom:1px solid #f0ede6;">` + htmlEscape(failure.Repository) + `</td><td style="padding:10px 0;border-bottom:1px solid #f0ede6;">` + htmlEscape(failure.Message) + `</td><td style="padding:10px 0;border-bottom:1px solid #f0ede6;">` + htmlEscape(failure.CreatedAt.Format("01-02 15:04")) + `</td></tr>`)
		}
		b.WriteString(`</table></div>`)
	}
	b.WriteString(`<p style="margin:20px 0 0;color:#9b9590;font-size:12px;">Generated from stored backup, result, and analytics data.</p></div></body></html>`)
	return b.String()
}

func reportMetricGridHTML(metrics []ReportMetric) string {
	var b strings.Builder
	b.WriteString(`<div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:18px 0;">`)
	for _, metric := range metrics {
		b.WriteString(`<div style="background:#fff;border:1px solid #e2ddd5;border-radius:14px;padding:14px 16px;">`)
		b.WriteString(`<div style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#9b9590;margin-bottom:8px;">` + htmlEscape(metric.Label) + `</div>`)
		b.WriteString(`<div style="font-size:22px;font-weight:700;line-height:1.1;margin-bottom:6px;">` + htmlEscape(metric.Value) + `</div>`)
		if metric.Detail != "" {
			b.WriteString(`<div style="font-size:12px;color:#6b6560;line-height:1.5;">` + htmlEscape(metric.Detail) + `</div>`)
		}
		b.WriteString(`</div>`)
	}
	b.WriteString(`</div>`)
	return b.String()
}

func reportSectionHTML(title string, items []string) string {
	var b strings.Builder
	b.WriteString(`<div style="display:grid;grid-template-columns:1fr;gap:8px;margin-top:14px;">`)
	b.WriteString(`<div style="font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#9b9590;">` + htmlEscape(title) + `</div>`)
	b.WriteString(`<div style="display:grid;gap:8px;">`)
	for _, item := range items {
		b.WriteString(`<div style="padding:14px 16px;border:1px solid #eae6df;border-radius:12px;background:#fff;color:#1a1a1a;line-height:1.7;">` + htmlEscape(item) + `</div>`)
	}
	b.WriteString(`</div></div>`)
	return b.String()
}

func RenderReportLaTeX(bundle ReportBundle) string {
	var b strings.Builder
	b.WriteString(`\documentclass[conference]{IEEEtran}
\IEEEoverridecommandlockouts
\usepackage{cite}
\usepackage{amsmath,amssymb,amsfonts}
\usepackage{graphicx}
\usepackage{textcomp}
\usepackage{xcolor}
\usepackage{array}
\usepackage{booktabs}
\begin{document}
`)
	b.WriteString(`\title{` + latexEscape(bundle.Subject) + `}
`)
	b.WriteString(`\author{\IEEEauthorblockN{GitHub Backup Monitor}}
`)
	b.WriteString(`\maketitle
`)
	b.WriteString(`\begin{abstract}
` + latexEscape(bundle.Summary) + `
\end{abstract}
`)
	b.WriteString(`\section{Overview}
` + latexParagraph(bundle.Summary) + `
`)
	if len(bundle.AIInsights) > 0 {
		b.WriteString(latexItemSection("AI Addendum", bundle.AIInsights))
	}
	b.WriteString(`\section{Key Metrics}
\begin{tabular}{p{0.28\linewidth}p{0.18\linewidth}p{0.42\linewidth}}
\toprule
Metric & Value & Detail \\
\midrule
`)
	for _, metric := range bundle.Metrics {
		b.WriteString(latexEscape(metric.Label) + ` & ` + latexEscape(metric.Value) + ` & ` + latexEscape(metric.Detail) + ` \\
`)
	}
	b.WriteString(`\bottomrule
\end{tabular}
`)
	b.WriteString(latexItemSection("Findings", bundle.Findings))
	b.WriteString(latexItemSection("Next steps", bundle.NextSteps))
	b.WriteString(latexItemSection("Risks", bundle.Risks))
	b.WriteString(latexItemSection("Questions", bundle.Questions))
	if len(bundle.Repositories) > 0 {
		b.WriteString(`\section{Top Repositories}
\begin{tabular}{p{0.44\linewidth}p{0.18\linewidth}p{0.14\linewidth}}
\toprule
Repository & Size & Status \\
\midrule
`)
		for _, repo := range bundle.Repositories {
			b.WriteString(latexEscape(repo.Name) + ` & ` + latexEscape(repo.ArchiveSize) + ` & ` + latexEscape(repo.Status) + ` \\
`)
		}
		b.WriteString(`\bottomrule
\end{tabular}
`)
	}
	if len(bundle.Failures) > 0 {
		b.WriteString(`\section{Recent Failures}
\begin{itemize}
`)
		for _, failure := range bundle.Failures {
			b.WriteString(`\item ` + latexEscape(fmt.Sprintf("%s: %s (%s)", failure.Repository, failure.Message, failure.CreatedAt.Format("01-02 15:04"))) + `
`)
		}
		b.WriteString(`\end{itemize}
`)
	}
	b.WriteString(`\end{document}
`)
	return b.String()
}

func latexItemSection(title string, items []string) string {
	var b strings.Builder
	b.WriteString(`\section{` + latexEscape(title) + `}
\begin{itemize}
`)
	if len(items) == 0 {
		b.WriteString(`\item No data available.
`)
	} else {
		for _, item := range items {
			b.WriteString(`\item ` + latexEscape(item) + `
`)
		}
	}
	b.WriteString(`\end{itemize}
`)
	return b.String()
}

func latexParagraph(text string) string {
	return latexEscape(text) + "\\par"
}

func GenerateReportPDF(ctx context.Context, bundle ReportBundle) (string, error) {
	tempDir, err := os.MkdirTemp("", "github-backup-report-*")
	if err != nil {
		return "", err
	}

	pdfPath := filepath.Join(tempDir, "report.pdf")
	texPath := filepath.Join(tempDir, "report.tex")
	if err := os.WriteFile(texPath, []byte(RenderReportLaTeX(bundle)), 0o600); err != nil {
		_ = os.RemoveAll(tempDir)
		return "", err
	}

	compiler, err := exec.LookPath("pdflatex")
	if err != nil {
		compiler, err = findLatexCommand()
		if err != nil {
			// LaTeX not available; fall back to a simple PDF renderer using gofpdf
			if pdfErr := generateSimplePDF(bundle, pdfPath); pdfErr != nil {
				_ = os.RemoveAll(tempDir)
				return "", fmt.Errorf("latex not found and fallback pdf generation failed: %w", pdfErr)
			}
			return pdfPath, nil
		}
	}

	if err := runLatexCompile(ctx, compiler, tempDir); err != nil {
		_ = os.RemoveAll(tempDir)
		return "", err
	}
	if err := runLatexCompile(ctx, compiler, tempDir); err != nil {
		_ = os.RemoveAll(tempDir)
		return "", err
	}

	return pdfPath, nil
}

func runLatexCompile(ctx context.Context, compiler string, dir string) error {
	args := []string{"-interaction=nonstopmode", "-halt-on-error", "report.tex"}
	if strings.HasSuffix(filepath.Base(compiler), "latexmk") {
		args = []string{"-pdf", "-interaction=nonstopmode", "-halt-on-error", "report.tex"}
	}
	cmd := exec.CommandContext(ctx, compiler, args...)
	cmd.Dir = dir
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("latex compile failed: %w: %s", err, strings.TrimSpace(string(output)))
	}
	return nil
}

func findLatexCommand() (string, error) {
	for _, command := range []string{"pdflatex", "xelatex", "latexmk"} {
		if path, err := exec.LookPath(command); err == nil {
			return path, nil
		}
	}
	return "", errors.New("latex compiler not found")
}

func htmlEscape(text string) string {
	replacer := strings.NewReplacer("&", "&amp;", "<", "&lt;", ">", "&gt;", "\"", "&quot;")
	return replacer.Replace(text)
}

func latexEscape(text string) string {
	replacer := strings.NewReplacer(
		"\\", `\textbackslash{}`,
		"{", `\{`,
		"}", `\}`,
		"$", `\$`,
		"&", `\&`,
		"#", `\#`,
		"_", `\_`,
		"%", `\%`,
		"^", `\^{}`,
		"~", `\~{}`,
	)
	return replacer.Replace(text)
}

func formatDuration(ms int64) string {
	d := time.Duration(ms) * time.Millisecond
	if d < time.Minute {
		return fmt.Sprintf("%.1fs", d.Seconds())
	}
	return fmt.Sprintf("%.1fm", d.Minutes())
}

func formatBytes(bytesValue int64) string {
	if bytesValue < 1024 {
		return fmt.Sprintf("%d B", bytesValue)
	}
	if bytesValue < 1024*1024 {
		return fmt.Sprintf("%.1f KB", float64(bytesValue)/1024)
	}
	if bytesValue < 1024*1024*1024 {
		return fmt.Sprintf("%.1f MB", float64(bytesValue)/(1024*1024))
	}
	return fmt.Sprintf("%.1f GB", float64(bytesValue)/(1024*1024*1024))
}

func truncateForPDF(text string, maxRunes int) string {
	runes := []rune(text)
	if len(runes) <= maxRunes {
		return text
	}
	if maxRunes <= 3 {
		return string(runes[:maxRunes])
	}
	return string(runes[:maxRunes-3]) + "..."
}

func generateSimplePDF(bundle ReportBundle, outPath string) error {
	pdf := gofpdf.New("P", "mm", "A4", "")
	pdf.SetMargins(20, 20, 20)
	pdf.AddPage()
	pdf.SetFont("Arial", "B", 16)
	pdf.CellFormat(0, 8, bundle.Headline, "", 1, "", false, 0, "")
	pdf.Ln(2)
	pdf.SetFont("Arial", "", 11)
	pdf.MultiCell(0, 6, bundle.Summary, "", "L", false)
	pdf.Ln(4)

	// Metrics
	pdf.SetFont("Arial", "B", 12)
	pdf.CellFormat(0, 7, "Key metrics", "", 1, "", false, 0, "")
	pdf.SetFont("Arial", "", 10)
	for _, m := range bundle.Metrics {
		line := fmt.Sprintf("%s: %s", m.Label, m.Value)
		pdf.MultiCell(0, 6, line, "", "L", false)
	}
	pdf.Ln(3)

	// Sections helper
	writeSection := func(title string, items []string) {
		pdf.SetFont("Arial", "B", 12)
		pdf.CellFormat(0, 7, title, "", 1, "", false, 0, "")
		pdf.SetFont("Arial", "", 10)
		if len(items) == 0 {
			pdf.MultiCell(0, 6, "No items available.", "", "L", false)
			pdf.Ln(2)
			return
		}
		for _, it := range items {
			// bullet
			pdf.MultiCell(0, 6, "- "+it, "", "L", false)
		}
		pdf.Ln(2)
	}

	writeSection("Findings", bundle.Findings)
	writeSection("Next steps", bundle.NextSteps)
	writeSection("Risks", bundle.Risks)
	writeSection("Questions", bundle.Questions)

	if err := pdf.OutputFileAndClose(outPath); err != nil {
		return err
	}
	return nil
}
