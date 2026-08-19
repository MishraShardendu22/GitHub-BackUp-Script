package collect

import (
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/MishraShardendu22/github-backup/backend/models"
	"github.com/MishraShardendu22/github-backup/model"
	"github.com/MishraShardendu22/github-backup/service/helper"
	"github.com/MishraShardendu22/github-backup/service/monitor"
	"github.com/MishraShardendu22/github-backup/util"
	"go.uber.org/zap"
)

var defaultRepoPath = "_Repos"

// generate one analytics snapshot for the entire backup run
func GenerateAnalytics(mon *monitor.Monitor) error {
	if mon == nil {
		return fmt.Errorf("monitor is nil")
	}

	local, err := GetLocalAnalytics()
	if err != nil {
		return err
	}

	// get backup repo analytics if possible,
	// if not log a warning and continue with just local analytics (this can happen if the backup repo is not initialized yet, or if there is an issue with git commands)
	backupRepo, err := getBackupRepoAnalytics()
	if err != nil {
		util.Logger().Warn("backup repo analytics unavailable; saving local metrics only",
			zap.Error(err),
		)
	}

	runID := mon.RunID()

	snapshot := &models.RepoAnalyticsSnapshot{
		CapturedAt: time.Now().UTC(),
		RunID:      &runID,

		TrackedFiles: local.TrackedFiles,

		TotalBlobSizeBytes:   local.TotalBlobSizeBytes,
		AvgBlobSizeBytes:     local.AvgBlobSizeBytes,
		LargestBlobPath:      local.LargestBlobPath,
		LargestBlobSizeBytes: local.LargestBlobSizeBytes,

		ArchiveCount:            local.ArchiveCount,
		TotalArchiveSizeBytes:   local.TotalArchiveSizeBytes,
		AvgArchiveSizeBytes:     local.AvgArchiveSizeBytes,
		LargestArchivePath:      local.LargestArchivePath,
		LargestArchiveSizeBytes: local.LargestArchiveSizeBytes,
	}

	if backupRepo != nil {
		snapshot.HeadCommit = backupRepo.HeadCommit
		snapshot.HeadCommitMessage = backupRepo.HeadCommitMessage
		snapshot.HeadCommitAt = &backupRepo.HeadCommitAt
		snapshot.TotalCommits = backupRepo.TotalCommits
		snapshot.BranchCount = backupRepo.BranchCount
		snapshot.TagCount = backupRepo.TagCount
	}

	return mon.SaveAnalyticsSnapshot(snapshot)
}

// Add git data to the analytics snapshot for the backup repo, if it is initialized and available
func getBackupRepoAnalytics() (*model.GitHubRepoAnalytics, error) {
	if _, err := os.Stat(filepath.Join(defaultRepoPath, ".git")); err != nil {
		return nil, fmt.Errorf("backup repository not initialized: %w", err)
	}

	headCommit, err := helper.RunGitCommand(defaultRepoPath, "rev-parse", "HEAD")
	if err != nil {
		return nil, err
	}

	headCommitMessage, err := helper.RunGitCommand(defaultRepoPath, "log", "-1", "--format=%s")
	if err != nil {
		return nil, err
	}

	headCommitAtRaw, err := helper.RunGitCommand(defaultRepoPath, "log", "-1", "--format=%cI")
	if err != nil {
		return nil, err
	}

	headCommitAt, err := time.Parse(time.RFC3339, headCommitAtRaw)
	if err != nil {
		return nil, fmt.Errorf("parse backup repo commit time %q: %w", headCommitAtRaw, err)
	}

	totalCommits, err := runGitCount("rev-list", "--count", "HEAD")
	if err != nil {
		return nil, err
	}

	branchCount, err := runGitCount("for-each-ref", "--format=%(refname:short)", "refs/heads")
	if err != nil {
		return nil, err
	}

	tagCount, err := runGitCount("tag", "--list")
	if err != nil {
		return nil, err
	}

	return &model.GitHubRepoAnalytics{
		HeadCommit:        headCommit,
		HeadCommitMessage: headCommitMessage,
		HeadCommitAt:      headCommitAt,
		TotalCommits:      totalCommits,
		BranchCount:       branchCount,
		TagCount:          tagCount,
	}, nil
}

func runGitCount(args ...string) (int, error) {
	out, err := helper.RunGitCommand(defaultRepoPath, args...)
	if err != nil {
		return 0, err
	}

	if out == "" {
		return 0, nil
	}

	count, err := strconv.Atoi(out)
	if err != nil {
		lines := strings.Split(out, "\n")
		count := 0
		for _, line := range lines {
			if strings.TrimSpace(line) != "" {
				count++
			}
		}
		if count == 0 {
			return 0, fmt.Errorf("parse git count %q: %w", out, err)
		}
		return count, nil
	}

	return count, nil
}

// get the local analytics by iterating through the files in the defaultRepoPath directory (_Repos) and collecting stats about the tracked files and archives
func GetLocalAnalytics() (*model.LocalAnalytics, error) {
	stats := &model.LocalAnalytics{}

	// iterate thorugh the files in the defaultRepoPath directory (_Repos) and collect analytics
	err := filepath.Walk(defaultRepoPath, func(path string, info os.FileInfo, err error) error {
		// if there is an error, return it
		if err != nil {
			return err
		}

		// if there is a directory, skip it
		if info.IsDir() {
			return nil
		}

		// skip non-.tar.gz files
		if !strings.HasSuffix(info.Name(), ".tar.gz") {
			return nil
		}

		// if there is a file, collect its analytics
		// size in bytes
		size := info.Size()

		// update the stats
		stats.TrackedFiles++
		stats.TotalBlobSizeBytes += size

		// update the largest blob size and path if this file is larger than the current largest
		if size > stats.LargestBlobSizeBytes {
			stats.LargestBlobSizeBytes = size
			stats.LargestBlobPath = info.Name()
		}

		// if the file is a .tar.gz file, update the archive stats
		stats.ArchiveCount++
		stats.TotalArchiveSizeBytes += size

		// update the largest archive size and path if this file is larger than the current largest
		if size > stats.LargestArchiveSizeBytes {
			stats.LargestArchiveSizeBytes = size
			stats.LargestArchivePath = info.Name()
		}

		return nil
	})

	if err != nil {
		return nil, err
	}

	// calculate the average blob size and average archive size
	if stats.TrackedFiles > 0 {
		stats.AvgBlobSizeBytes = stats.TotalBlobSizeBytes / int64(stats.TrackedFiles)
	}

	// calculate the average archive size
	if stats.ArchiveCount > 0 {
		stats.AvgArchiveSizeBytes = stats.TotalArchiveSizeBytes / int64(stats.ArchiveCount)
	}

	return stats, nil
}
