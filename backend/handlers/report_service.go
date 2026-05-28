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
	addendum := fallbackAIAddendum(bundle)

	apiKey := os.Getenv("MODEL_KEY")
	if apiKey == "" {
		return flattenAIAddendum(addendum)
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
		"repositories": bundle.Repositories,
		"failures":     bundle.Failures,
	}
	if bundle.Analytics != nil {
		payload["analytics"] = bundle.Analytics
	}

	requestBody := map[string]any{
		"model": model,
		"messages": []map[string]string{
			{"role": "system", "content": "You write enterprise DevOps backup reports. Return only valid JSON with factual statements grounded in the input."},
			{"role": "user", "content": fmt.Sprintf("Use the following report bundle data to produce an executive addendum for a GitHub backup analytics report. Return JSON with exactly these keys:\n- executive_summary: string (single concise paragraph)\n- operational_insights: string[] (4-6 bullets)\n- risk_analysis: string[] (3-5 bullets)\n- recommendations: string[] (3-5 bullets)\n- common_review_questions: string[] (3-5 items in 'Q: ... A: ...' format)\n\nConstraints:\n- Keep content factual and anchored to provided numbers.\n- Do not invent unavailable data.\n- Keep each bullet/action concise and practical.\n\nInput:\n%s", mustJSON(payload))},
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
		return flattenAIAddendum(addendum)
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
		return flattenAIAddendum(addendum)
	}

	content := sanitizeJSONContent(result.Choices[0].Message.Content)

	var parsed aiReportAddendum
	if err := json.Unmarshal([]byte(content), &parsed); err != nil {
		return flattenAIAddendum(addendum)
	}

	parsed.ExecutiveSummary = strings.TrimSpace(parsed.ExecutiveSummary)
	parsed.OperationalInsights = cleanInsightList(parsed.OperationalInsights)
	parsed.RiskAnalysis = cleanInsightList(parsed.RiskAnalysis)
	parsed.Recommendations = cleanInsightList(parsed.Recommendations)
	parsed.CommonReviewQuestions = cleanInsightList(parsed.CommonReviewQuestions)

	if parsed.ExecutiveSummary == "" {
		parsed.ExecutiveSummary = addendum.ExecutiveSummary
	}
	if len(parsed.OperationalInsights) == 0 {
		parsed.OperationalInsights = addendum.OperationalInsights
	}
	if len(parsed.RiskAnalysis) == 0 {
		parsed.RiskAnalysis = addendum.RiskAnalysis
	}
	if len(parsed.Recommendations) == 0 {
		parsed.Recommendations = addendum.Recommendations
	}
	if len(parsed.CommonReviewQuestions) == 0 {
		parsed.CommonReviewQuestions = addendum.CommonReviewQuestions
	}

	return flattenAIAddendum(parsed)
}

func fallbackAIInsights(bundle ReportBundle) []string {
	return flattenAIAddendum(fallbackAIAddendum(bundle))
}

func mustJSON(value any) string {
	data, err := json.MarshalIndent(value, "", "  ")
	if err != nil {
		return "{}"
	}
	return string(data)
}

func RenderReportHTML(bundle ReportBundle) string {
	ai := parseAIInsights(bundle.AIInsights)

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
	if ai.hasAny() {
		b.WriteString(`<div style="margin-top:18px;padding:16px;border:1px solid #e2ddd5;border-radius:14px;background:#fbfaf8;">`)
		b.WriteString(`<div style="font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#9b9590;margin-bottom:10px;">AI addendum</div>`)
		if ai.ExecutiveSummary != "" {
			b.WriteString(`<div style="padding:12px 14px;border:1px solid #eae6df;border-radius:10px;background:#fff;margin-bottom:12px;line-height:1.7;">` + htmlEscape(ai.ExecutiveSummary) + `</div>`)
		}
		b.WriteString(reportInlineSectionHTML("Operational insights", ai.OperationalInsights))
		b.WriteString(reportInlineSectionHTML("Risk analysis", ai.RiskAnalysis))
		b.WriteString(reportInlineSectionHTML("Recommendations", ai.Recommendations))
		b.WriteString(reportInlineSectionHTML("Common review questions", ai.CommonReviewQuestions))
		b.WriteString(`</div>`)
	}
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

func reportInlineSectionHTML(title string, items []string) string {
	if len(items) == 0 {
		return ""
	}

	var b strings.Builder
	b.WriteString(`<div style="margin-top:10px;"><div style="font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#6b6560;margin-bottom:6px;">` + htmlEscape(title) + `</div>`)
	b.WriteString(`<ul style="margin:0;padding-left:18px;color:#1a1a1a;line-height:1.65;">`)
	for _, item := range items {
		b.WriteString(`<li style="margin-bottom:6px;">` + htmlEscape(item) + `</li>`)
	}
	b.WriteString(`</ul></div>`)
	return b.String()
}

func RenderReportLaTeX(bundle ReportBundle) string {
	theme := defaultReportTheme()
	ai := parseAIInsights(bundle.AIInsights)

	var b strings.Builder
	b.WriteString(latexPreamble(theme, bundle))
	b.WriteString(latexSummaryBox(bundle, theme))
	b.WriteString(latexMetricsTable(bundle.Metrics, theme))
	b.WriteString(latexItemPanel("Findings", bundle.Findings, "accentLight"))
	b.WriteString(latexItemPanel("Next Steps", bundle.NextSteps, "neutralTint"))
	b.WriteString(latexItemPanel("Risks", bundle.Risks, "riskLight"))
	b.WriteString(latexItemPanel("Questions", bundle.Questions, "surfaceTint"))
	b.WriteString(latexAISection(ai))
	b.WriteString(latexRepositoryTable(bundle.Repositories))
	b.WriteString(latexFailureTable(bundle.Failures))
	b.WriteString("\\end{document}\n")
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
		"\n", " ",
		"\r", " ",
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
	theme := defaultReportTheme()
	ai := parseAIInsights(bundle.AIInsights)

	pdf := gofpdf.New("P", "mm", "A4", "")
	pdf.SetMargins(14, 16, 14)
	pdf.SetAutoPageBreak(true, 16)

	primaryR, primaryG, primaryB := hexToRGB(theme.PrimaryHex)
	accentR, accentG, accentB := hexToRGB(theme.AccentHex)
	mutedR, mutedG, mutedB := hexToRGB(theme.MutedHex)
	tableHeaderR, tableHeaderG, tableHeaderB := hexToRGB(theme.TableHeaderHex)
	cardR, cardG, cardB := hexToRGB(theme.CardHex)

	pdf.SetHeaderFunc(func() {
		left, top, right, _ := pdf.GetMargins()
		pdf.SetY(top - 10)
		pdf.SetX(left)
		pdf.SetFillColor(primaryR, primaryG, primaryB)
		pdf.Rect(left, top-10, 210-left-right, 8, "F")
		pdf.SetTextColor(255, 255, 255)
		pdf.SetFont("Arial", "B", 10)
		pdf.SetXY(left+2, top-8.3)
		pdf.CellFormat(0, 5, "GitHub Backup Observability Report", "", 0, "L", false, 0, "")
		pdf.SetTextColor(20, 20, 20)
	})

	pdf.SetFooterFunc(func() {
		pdf.SetY(-12)
		pdf.SetFont("Arial", "", 8)
		pdf.SetTextColor(mutedR, mutedG, mutedB)
		pageText := fmt.Sprintf("Generated %s  •  Page %d", bundle.GeneratedAt.Format("2006-01-02 15:04 UTC"), pdf.PageNo())
		pdf.CellFormat(0, 5, pageText, "", 0, "C", false, 0, "")
		pdf.SetTextColor(20, 20, 20)
	})

	pdf.AddPage()

	pdf.SetFont("Arial", "B", 17)
	pdf.SetTextColor(primaryR, primaryG, primaryB)
	pdf.CellFormat(0, 8, truncateForPDF(bundle.Headline, 120), "", 1, "L", false, 0, "")
	pdf.SetTextColor(20, 20, 20)
	pdf.SetFont("Arial", "", 10)
	pdf.SetTextColor(mutedR, mutedG, mutedB)
	pdf.CellFormat(0, 6, bundle.Subject, "", 1, "L", false, 0, "")
	pdf.SetTextColor(20, 20, 20)
	pdf.Ln(2)

	writePDFInfoBox(pdf, "Executive Summary", bundle.Summary, cardR, cardG, cardB)
	writePDFMetricCards(pdf, bundle.Metrics, theme)
	writePDFListSection(pdf, "Findings", bundle.Findings, accentR, accentG, accentB)
	writePDFListSection(pdf, "Next Steps", bundle.NextSteps, primaryR, primaryG, primaryB)
	writePDFListSection(pdf, "Risks", bundle.Risks, 178, 46, 46)
	writePDFListSection(pdf, "Questions", bundle.Questions, 74, 74, 74)

	if ai.hasAny() {
		writePDFSectionHeading(pdf, "AI Addendum", primaryR, primaryG, primaryB)
		if ai.ExecutiveSummary != "" {
			writePDFInfoBox(pdf, "Executive Insight", ai.ExecutiveSummary, cardR, cardG, cardB)
		}
		writePDFListSection(pdf, "Operational Insights", ai.OperationalInsights, accentR, accentG, accentB)
		writePDFListSection(pdf, "Risk Analysis", ai.RiskAnalysis, 178, 46, 46)
		writePDFListSection(pdf, "Recommendations", ai.Recommendations, primaryR, primaryG, primaryB)
		writePDFListSection(pdf, "Common Review Questions", ai.CommonReviewQuestions, 74, 74, 74)
	}

	if len(bundle.Repositories) > 0 {
		writePDFSectionHeading(pdf, "Top Repositories", primaryR, primaryG, primaryB)
		headers := []string{"Repository", "Size", "Status", "Captured"}
		widths := []float64{104, 24, 24, 30}
		rows := make([][]string, 0, len(bundle.Repositories))
		for _, repo := range bundle.Repositories {
			rows = append(rows, []string{
				truncateForPDF(repo.Name, 150),
				repo.ArchiveSize,
				strings.ToUpper(repo.Status),
				repo.CreatedAt.Format("2006-01-02 15:04"),
			})
		}
		writePDFTable(pdf, headers, rows, widths, tableHeaderR, tableHeaderG, tableHeaderB)
	}

	if len(bundle.Failures) > 0 {
		writePDFSectionHeading(pdf, "Recent Failures", primaryR, primaryG, primaryB)
		headers := []string{"Repository", "Error", "Time"}
		widths := []float64{58, 102, 22}
		rows := make([][]string, 0, len(bundle.Failures))
		for _, failure := range bundle.Failures {
			rows = append(rows, []string{
				truncateForPDF(failure.Repository, 100),
				truncateForPDF(failure.Message, 260),
				failure.CreatedAt.Format("01-02 15:04"),
			})
		}
		writePDFTable(pdf, headers, rows, widths, tableHeaderR, tableHeaderG, tableHeaderB)
	}

	if err := pdf.OutputFileAndClose(outPath); err != nil {
		return err
	}
	return nil
}

type aiReportAddendum struct {
	ExecutiveSummary      string   `json:"executive_summary"`
	OperationalInsights   []string `json:"operational_insights"`
	RiskAnalysis          []string `json:"risk_analysis"`
	Recommendations       []string `json:"recommendations"`
	CommonReviewQuestions []string `json:"common_review_questions"`
}

func (a aiReportAddendum) hasAny() bool {
	return a.ExecutiveSummary != "" ||
		len(a.OperationalInsights) > 0 ||
		len(a.RiskAnalysis) > 0 ||
		len(a.Recommendations) > 0 ||
		len(a.CommonReviewQuestions) > 0
}

func fallbackAIAddendum(bundle ReportBundle) aiReportAddendum {
	exec := fmt.Sprintf("The latest run processed %d repositories with %d successful, %d failed, and %d skipped results.", bundle.Run.TotalRepos, bundle.Run.Successful, bundle.Run.Failed, bundle.Run.Skipped)

	operational := []string{}
	if len(bundle.Repositories) > 0 {
		operational = append(operational, fmt.Sprintf("Largest repository in this snapshot: %s (%s).", bundle.Repositories[0].Name, bundle.Repositories[0].ArchiveSize))
	}
	if bundle.Analytics != nil {
		operational = append(operational, fmt.Sprintf("Latest analytics snapshot recorded %d tracked files and %d archives.", bundle.Analytics.TrackedFiles, bundle.Analytics.ArchiveCount))
	}
	if len(operational) == 0 {
		operational = append(operational, "Stored metrics are limited; collect another run for richer trend analysis.")
	}

	riskAnalysis := append([]string{}, bundle.Risks...)
	if len(riskAnalysis) == 0 {
		riskAnalysis = []string{"No immediate backup risk is visible from the current stored data."}
	}

	recommendations := append([]string{}, bundle.NextSteps...)
	if len(recommendations) == 0 {
		recommendations = []string{"Schedule the next run and compare it against this baseline."}
	}

	reviewQuestions := append([]string{}, bundle.Questions...)
	if len(reviewQuestions) == 0 {
		reviewQuestions = []string{"Q: Should we alert on run degradation? A: Yes, if failed or skipped counts trend upward across runs."}
	} else {
		for i := range reviewQuestions {
			if !strings.HasPrefix(strings.ToLower(strings.TrimSpace(reviewQuestions[i])), "q:") {
				reviewQuestions[i] = fmt.Sprintf("Q: %s A: Review with repository owners and retention policy owners.", strings.TrimSpace(reviewQuestions[i]))
			}
		}
	}

	return aiReportAddendum{
		ExecutiveSummary:      exec,
		OperationalInsights:   operational,
		RiskAnalysis:          riskAnalysis,
		Recommendations:       recommendations,
		CommonReviewQuestions: reviewQuestions,
	}
}

func flattenAIAddendum(addendum aiReportAddendum) []string {
	insights := make([]string, 0, 1+len(addendum.OperationalInsights)+len(addendum.RiskAnalysis)+len(addendum.Recommendations)+len(addendum.CommonReviewQuestions))
	if addendum.ExecutiveSummary != "" {
		insights = append(insights, "executive_summary|"+strings.TrimSpace(addendum.ExecutiveSummary))
	}
	for _, insight := range addendum.OperationalInsights {
		if t := strings.TrimSpace(insight); t != "" {
			insights = append(insights, "operational_insight|"+t)
		}
	}
	for _, risk := range addendum.RiskAnalysis {
		if t := strings.TrimSpace(risk); t != "" {
			insights = append(insights, "risk_analysis|"+t)
		}
	}
	for _, recommendation := range addendum.Recommendations {
		if t := strings.TrimSpace(recommendation); t != "" {
			insights = append(insights, "recommendation|"+t)
		}
	}
	for _, question := range addendum.CommonReviewQuestions {
		if t := strings.TrimSpace(question); t != "" {
			insights = append(insights, "review_question|"+t)
		}
	}
	return insights
}

func parseAIInsights(insights []string) aiReportAddendum {
	parsed := aiReportAddendum{}
	for _, raw := range insights {
		parts := strings.SplitN(raw, "|", 2)
		if len(parts) == 2 {
			key := strings.TrimSpace(strings.ToLower(parts[0]))
			value := strings.TrimSpace(parts[1])
			if value == "" {
				continue
			}
			switch key {
			case "executive_summary":
				if parsed.ExecutiveSummary == "" {
					parsed.ExecutiveSummary = value
				}
			case "operational_insight":
				parsed.OperationalInsights = append(parsed.OperationalInsights, value)
			case "risk_analysis":
				parsed.RiskAnalysis = append(parsed.RiskAnalysis, value)
			case "recommendation":
				parsed.Recommendations = append(parsed.Recommendations, value)
			case "review_question":
				parsed.CommonReviewQuestions = append(parsed.CommonReviewQuestions, value)
			default:
				parsed.OperationalInsights = append(parsed.OperationalInsights, strings.TrimSpace(raw))
			}
			continue
		}
		if strings.TrimSpace(raw) != "" {
			parsed.OperationalInsights = append(parsed.OperationalInsights, strings.TrimSpace(raw))
		}
	}
	return parsed
}

func cleanInsightList(values []string) []string {
	clean := make([]string, 0, len(values))
	for _, value := range values {
		text := strings.TrimSpace(value)
		if text != "" {
			clean = append(clean, text)
		}
	}
	return clean
}

func sanitizeJSONContent(content string) string {
	trimmed := strings.TrimSpace(content)
	trimmed = strings.TrimPrefix(trimmed, "```json")
	trimmed = strings.TrimPrefix(trimmed, "```")
	trimmed = strings.TrimSuffix(trimmed, "```")
	trimmed = strings.TrimSpace(trimmed)
	return trimmed
}

type reportTheme struct {
	BrandName      string
	PrimaryHex     string
	AccentHex      string
	MutedHex       string
	CardHex        string
	SurfaceHex     string
	TableHeaderHex string
	RiskHex        string
}

func defaultReportTheme() reportTheme {
	return reportTheme{
		BrandName:      "GitHub Backup Observability",
		PrimaryHex:     "1F3558",
		AccentHex:      "2F6FA3",
		MutedHex:       "667085",
		CardHex:        "F8FAFC",
		SurfaceHex:     "EEF2F7",
		TableHeaderHex: "E6ECF5",
		RiskHex:        "C0392B",
	}
}

func latexPreamble(theme reportTheme, bundle ReportBundle) string {
	var b strings.Builder
	b.WriteString("\\documentclass[11pt]{article}\n")
	b.WriteString("\\usepackage[a4paper,margin=0.85in]{geometry}\n")
	b.WriteString("\\usepackage[table]{xcolor}\n")
	b.WriteString("\\usepackage{tcolorbox}\n")
	b.WriteString("\\usepackage{fancyhdr}\n")
	b.WriteString("\\usepackage{tabularx}\n")
	b.WriteString("\\usepackage{longtable}\n")
	b.WriteString("\\usepackage{booktabs}\n")
	b.WriteString("\\usepackage{enumitem}\n")
	b.WriteString("\\usepackage[hidelinks]{hyperref}\n")
	b.WriteString("\\usepackage{array}\n")
	b.WriteString("\\usepackage{lastpage}\n")
	b.WriteString("\\usepackage{setspace}\n")
	b.WriteString("\\setlength{\\parindent}{0pt}\n")
	b.WriteString("\\setlength{\\parskip}{6pt}\n")
	b.WriteString("\\onehalfspacing\n")
	b.WriteString("\\renewcommand{\\familydefault}{\\sfdefault}\n")
	b.WriteString("\\definecolor{brandPrimary}{HTML}{" + theme.PrimaryHex + "}\n")
	b.WriteString("\\definecolor{brandAccent}{HTML}{" + theme.AccentHex + "}\n")
	b.WriteString("\\definecolor{brandMuted}{HTML}{" + theme.MutedHex + "}\n")
	b.WriteString("\\definecolor{surfaceTint}{HTML}{" + theme.SurfaceHex + "}\n")
	b.WriteString("\\definecolor{cardTint}{HTML}{" + theme.CardHex + "}\n")
	b.WriteString("\\definecolor{riskTint}{HTML}{" + theme.RiskHex + "}\n")
	b.WriteString("\\definecolor{tableHead}{HTML}{" + theme.TableHeaderHex + "}\n")
	b.WriteString("\\newtcolorbox{reportbox}[2][]{colback=cardTint,colframe=brandAccent!55!black,boxrule=0.5pt,arc=2.2mm,top=1.6mm,bottom=1.6mm,left=1.6mm,right=1.6mm,title=\\textbf{#2},fonttitle=\\small\\bfseries,coltitle=brandPrimary,#1}\n")
	b.WriteString("\\pagestyle{fancy}\n")
	b.WriteString("\\fancyhf{}\n")
	b.WriteString("\\fancyhead[L]{\\textcolor{brandPrimary}{\\textbf{" + latexEscape(theme.BrandName) + "}}}\n")
	b.WriteString("\\fancyhead[R]{\\textcolor{brandMuted}{" + latexEscape(bundle.GeneratedAt.Format("2006-01-02 15:04 UTC")) + "}}\n")
	b.WriteString("\\fancyfoot[L]{\\textcolor{brandMuted}{Generated by GitHub Backup Monitor}}\n")
	b.WriteString("\\fancyfoot[R]{\\textcolor{brandMuted}{Page \\thepage/\\pageref{LastPage}}}\n")
	b.WriteString("\\renewcommand{\\headrulewidth}{0.4pt}\n")
	b.WriteString("\\renewcommand{\\footrulewidth}{0.4pt}\n")
	b.WriteString("\\begin{document}\n")
	b.WriteString("{\\LARGE\\textbf{" + latexEscape(bundle.Subject) + "}}\\\\[3pt]\n")
	b.WriteString("{\\large\\textcolor{brandPrimary}{" + latexEscape(bundle.Headline) + "}}\\\\[8pt]\n")
	b.WriteString("\\textcolor{brandMuted}{Report Type: " + latexEscape(strings.Title(bundle.ReportType)) + "}\\\\[6pt]\n")
	b.WriteString("\\noindent\\textcolor{brandAccent}{\\rule{\\linewidth}{0.9pt}}\\vspace{6pt}\n")
	return b.String()
}

func latexSummaryBox(bundle ReportBundle, theme reportTheme) string {
	_ = theme
	var b strings.Builder
	b.WriteString("\\begin{reportbox}{Executive Summary}\n")
	b.WriteString(latexParagraph(bundle.Summary) + "\n")
	b.WriteString("\\end{reportbox}\n")
	return b.String()
}

func latexMetricsTable(metrics []ReportMetric, theme reportTheme) string {
	_ = theme
	var b strings.Builder
	b.WriteString("\\begin{reportbox}{Performance Metrics}\n")
	b.WriteString("\\rowcolors{2}{surfaceTint}{white}\n")
	b.WriteString("\\begin{tabularx}{\\linewidth}{>{\\raggedright\\arraybackslash}p{0.22\\linewidth} >{\\raggedright\\arraybackslash}p{0.22\\linewidth} X}\n")
	b.WriteString("\\toprule\n")
	b.WriteString("\\textbf{Metric} & \\textbf{Value} & \\textbf{Detail} \\\\ \n")
	b.WriteString("\\midrule\n")
	if len(metrics) == 0 {
		b.WriteString("No metrics & - & No metric detail available. \\\\ \n")
	} else {
		for _, metric := range metrics {
			detail := metric.Detail
			if detail == "" {
				detail = "-"
			}
			b.WriteString(latexEscape(metric.Label) + " & " + latexEscape(metric.Value) + " & " + latexEscape(detail) + " \\\\ \n")
		}
	}
	b.WriteString("\\bottomrule\n")
	b.WriteString("\\end{tabularx}\n")
	b.WriteString("\\end{reportbox}\n")
	return b.String()
}

func latexItemPanel(title string, items []string, bgColor string) string {
	var b strings.Builder
	b.WriteString("\\begin{reportbox}[colback=" + bgColor + "]{" + latexEscape(title) + "}\n")
	b.WriteString("\\begin{itemize}[leftmargin=*,itemsep=4pt,topsep=3pt,parsep=0pt]\n")
	if len(items) == 0 {
		b.WriteString("\\item No data available.\n")
	} else {
		for _, item := range items {
			b.WriteString("\\item " + latexEscape(item) + "\n")
		}
	}
	b.WriteString("\\end{itemize}\n")
	b.WriteString("\\end{reportbox}\n")
	return b.String()
}

func latexAISection(ai aiReportAddendum) string {
	if !ai.hasAny() {
		return ""
	}

	var b strings.Builder
	b.WriteString("\\begin{reportbox}[colframe=brandPrimary,colback=surfaceTint]{AI Addendum}\n")
	if ai.ExecutiveSummary != "" {
		b.WriteString("\\textbf{Executive Summary}\\\\\n")
		b.WriteString(latexEscape(ai.ExecutiveSummary) + "\\\\[4pt]\n")
	}
	b.WriteString(latexCompactList("Operational Insights", ai.OperationalInsights))
	b.WriteString(latexCompactList("Risk Analysis", ai.RiskAnalysis))
	b.WriteString(latexCompactList("Recommendations", ai.Recommendations))
	b.WriteString(latexCompactList("Common Review Questions", ai.CommonReviewQuestions))
	b.WriteString("\\end{reportbox}\n")
	return b.String()
}

func latexCompactList(title string, items []string) string {
	if len(items) == 0 {
		return ""
	}

	var b strings.Builder
	b.WriteString("\\textbf{" + latexEscape(title) + "}\\\\\n")
	b.WriteString("\\begin{itemize}[leftmargin=*,itemsep=3pt,topsep=2pt,parsep=0pt]\n")
	for _, item := range items {
		b.WriteString("\\item " + latexEscape(item) + "\n")
	}
	b.WriteString("\\end{itemize}\n")
	return b.String()
}

func latexRepositoryTable(repositories []ReportRepository) string {
	if len(repositories) == 0 {
		return ""
	}

	var b strings.Builder
	b.WriteString("\\begin{reportbox}{Top Repositories}\n")
	b.WriteString("\\rowcolors{2}{surfaceTint}{white}\n")
	b.WriteString("\\begin{longtable}{>{\\raggedright\\arraybackslash}p{0.48\\linewidth} >{\\raggedright\\arraybackslash}p{0.15\\linewidth} >{\\raggedright\\arraybackslash}p{0.13\\linewidth} >{\\raggedright\\arraybackslash}p{0.16\\linewidth}}\n")
	b.WriteString("\\toprule\n")
	b.WriteString("\\rowcolor{tableHead}\\textbf{Repository} & \\textbf{Size} & \\textbf{Status} & \\textbf{Captured} \\\\ \n")
	b.WriteString("\\midrule\n")
	b.WriteString("\\endfirsthead\n")
	b.WriteString("\\toprule\n")
	b.WriteString("\\rowcolor{tableHead}\\textbf{Repository} & \\textbf{Size} & \\textbf{Status} & \\textbf{Captured} \\\\ \n")
	b.WriteString("\\midrule\n")
	b.WriteString("\\endhead\n")
	for _, repo := range repositories {
		b.WriteString(latexEscape(repo.Name) + " & " + latexEscape(repo.ArchiveSize) + " & " + latexEscape(strings.ToUpper(repo.Status)) + " & " + latexEscape(repo.CreatedAt.Format("2006-01-02 15:04")) + " \\\\ \n")
	}
	b.WriteString("\\bottomrule\n")
	b.WriteString("\\end{longtable}\n")
	b.WriteString("\\end{reportbox}\n")
	return b.String()
}

func latexFailureTable(failures []ReportFailure) string {
	if len(failures) == 0 {
		return ""
	}

	var b strings.Builder
	b.WriteString("\\begin{reportbox}[colframe=riskTint,colback=riskTint!5]{Recent Failures}\n")
	b.WriteString("\\rowcolors{2}{surfaceTint}{white}\n")
	b.WriteString("\\begin{longtable}{>{\\raggedright\\arraybackslash}p{0.26\\linewidth} X >{\\raggedright\\arraybackslash}p{0.16\\linewidth}}\n")
	b.WriteString("\\toprule\n")
	b.WriteString("\\rowcolor{tableHead}\\textbf{Repository} & \\textbf{Error Message} & \\textbf{Time} \\\\ \n")
	b.WriteString("\\midrule\n")
	b.WriteString("\\endfirsthead\n")
	b.WriteString("\\toprule\n")
	b.WriteString("\\rowcolor{tableHead}\\textbf{Repository} & \\textbf{Error Message} & \\textbf{Time} \\\\ \n")
	b.WriteString("\\midrule\n")
	b.WriteString("\\endhead\n")
	for _, failure := range failures {
		b.WriteString(latexEscape(failure.Repository) + " & " + latexEscape(failure.Message) + " & " + latexEscape(failure.CreatedAt.Format("01-02 15:04")) + " \\\\ \n")
	}
	b.WriteString("\\bottomrule\n")
	b.WriteString("\\end{longtable}\n")
	b.WriteString("\\end{reportbox}\n")
	return b.String()
}

func hexToRGB(hex string) (int, int, int) {
	value := strings.TrimSpace(strings.TrimPrefix(hex, "#"))
	if len(value) != 6 {
		return 34, 34, 34
	}
	var r, g, b int
	_, err := fmt.Sscanf(value, "%02x%02x%02x", &r, &g, &b)
	if err != nil {
		return 34, 34, 34
	}
	return r, g, b
}

func ensurePDFSpace(pdf *gofpdf.Fpdf, requiredHeight float64) {
	_, pageHeight := pdf.GetPageSize()
	_, _, _, bottom := pdf.GetMargins()
	if pdf.GetY()+requiredHeight > pageHeight-bottom {
		pdf.AddPage()
	}
}

func writePDFSectionHeading(pdf *gofpdf.Fpdf, title string, r, g, b int) {
	ensurePDFSpace(pdf, 12)
	pdf.Ln(2)
	pdf.SetFont("Arial", "B", 12)
	pdf.SetTextColor(r, g, b)
	pdf.CellFormat(0, 7, title, "", 1, "L", false, 0, "")
	pdf.SetDrawColor(r, g, b)
	pdf.SetLineWidth(0.4)
	x := pdf.GetX()
	y := pdf.GetY()
	pdf.Line(x, y, 196, y)
	pdf.Ln(2)
	pdf.SetTextColor(20, 20, 20)
}

func writePDFInfoBox(pdf *gofpdf.Fpdf, title, text string, fillR, fillG, fillB int) {
	ensurePDFSpace(pdf, 28)
	pdf.SetFont("Arial", "B", 11)
	pdf.SetFillColor(fillR, fillG, fillB)
	pdf.SetDrawColor(210, 219, 232)
	x := pdf.GetX()
	y := pdf.GetY()
	width := 182.0
	height := 8.0
	pdf.Rect(x, y, width, height, "FD")
	pdf.SetXY(x+2, y+1.4)
	pdf.CellFormat(width-4, 5, title, "", 0, "L", false, 0, "")
	pdf.SetXY(x, y+height)
	pdf.SetFont("Arial", "", 10)
	pdf.MultiCell(width, 5.5, text, "1", "L", false)
	pdf.Ln(2)
}

func writePDFMetricCards(pdf *gofpdf.Fpdf, metrics []ReportMetric, theme reportTheme) {
	if len(metrics) == 0 {
		return
	}

	r, g, b := hexToRGBOrDefault(theme.AccentHex, 47, 111, 163)
	writePDFSectionHeading(pdf, "Key Metrics", r, g, b)

	cardWidth := 88.0
	cardGap := 6.0
	lineHeight := 4.8

	cardR, cardG, cardB := hexToRGB(theme.CardHex)

	for i, metric := range metrics {
		if i%2 == 0 {
			ensurePDFSpace(pdf, 32)
		}

		x := pdf.GetX()
		y := pdf.GetY()
		if i%2 == 1 {
			x = x + cardWidth + cardGap
		}

		pdf.SetFillColor(cardR, cardG, cardB)
		pdf.SetDrawColor(213, 221, 231)
		pdf.Rect(x, y, cardWidth, 30, "FD")

		pdf.SetXY(x+2, y+2)
		pdf.SetFont("Arial", "B", 9)
		pdf.SetTextColor(102, 112, 133)
		pdf.CellFormat(cardWidth-4, 5, strings.ToUpper(metric.Label), "", 1, "L", false, 0, "")

		pdf.SetXY(x+2, y+8)
		pdf.SetFont("Arial", "B", 14)
		pdf.SetTextColor(31, 53, 88)
		pdf.MultiCell(cardWidth-4, lineHeight, truncateForPDF(metric.Value, 72), "", "L", false)

		if metric.Detail != "" {
			pdf.SetXY(x+2, y+20)
			pdf.SetFont("Arial", "", 8.5)
			pdf.SetTextColor(102, 112, 133)
			pdf.MultiCell(cardWidth-4, 4.2, truncateForPDF(metric.Detail, 120), "", "L", false)
		}

		pdf.SetTextColor(20, 20, 20)

		if i%2 == 1 || i == len(metrics)-1 {
			pdf.SetXY(14, y+32)
		}
	}
	if len(metrics)%2 == 0 {
		pdf.Ln(1)
	}
}

func writePDFListSection(pdf *gofpdf.Fpdf, title string, items []string, r, g, b int) {
	writePDFSectionHeading(pdf, title, r, g, b)
	pdf.SetFont("Arial", "", 10)
	if len(items) == 0 {
		ensurePDFSpace(pdf, 8)
		pdf.SetTextColor(102, 112, 133)
		pdf.MultiCell(0, 5.5, "No data available.", "", "L", false)
		pdf.SetTextColor(20, 20, 20)
		return
	}

	for _, item := range items {
		ensurePDFSpace(pdf, 9)
		pdf.SetX(18)
		pdf.CellFormat(4, 5.5, "•", "", 0, "L", false, 0, "")
		pdf.MultiCell(174, 5.5, truncateForPDF(item, 500), "", "L", false)
	}
	if len(items) > 0 {
		pdf.Ln(1)
	}
}

func writePDFTable(pdf *gofpdf.Fpdf, headers []string, rows [][]string, widths []float64, headerR, headerG, headerB int) {
	if len(headers) == 0 || len(widths) != len(headers) {
		return
	}

	lineHeight := 4.8

	ensurePDFSpace(pdf, 10)
	pdf.SetFont("Arial", "B", 9)
	pdf.SetFillColor(headerR, headerG, headerB)
	pdf.SetDrawColor(205, 214, 226)

	startX := 14.0
	pdf.SetX(startX)
	for i, header := range headers {
		pdf.CellFormat(widths[i], 7.2, strings.ToUpper(header), "1", 0, "L", true, 0, "")
	}
	pdf.Ln(-1)

	pdf.SetFont("Arial", "", 9)
	fill := false
	for _, row := range rows {
		ensurePDFSpace(pdf, 10)
		height := pdfRowHeight(pdf, row, widths, lineHeight)
		x := startX
		y := pdf.GetY()

		if fill {
			pdf.SetFillColor(248, 250, 252)
		} else {
			pdf.SetFillColor(255, 255, 255)
		}

		for i, cell := range row {
			pdf.Rect(x, y, widths[i], height, "FD")
			pdf.SetXY(x+1, y+1)
			pdf.MultiCell(widths[i]-2, lineHeight, cell, "", "L", false)
			x += widths[i]
		}
		pdf.SetXY(startX, y+height)
		fill = !fill
	}
	pdf.Ln(1)
}

func pdfRowHeight(pdf *gofpdf.Fpdf, values []string, widths []float64, lineHeight float64) float64 {
	maxLines := 1
	for i, value := range values {
		lines := pdf.SplitLines([]byte(value), widths[i]-2)
		if len(lines) > maxLines {
			maxLines = len(lines)
		}
	}
	return float64(maxLines)*lineHeight + 2
}

func hexToRGBOrDefault(hex string, defaultR, defaultG, defaultB int) (int, int, int) {
	r, g, b := hexToRGB(hex)
	if r == 34 && g == 34 && b == 34 {
		return defaultR, defaultG, defaultB
	}
	return r, g, b
}

func writePDFSectionHeadingWithRGB(pdf *gofpdf.Fpdf, title string, rgb [3]int) {
	writePDFSectionHeading(pdf, title, rgb[0], rgb[1], rgb[2])
}
