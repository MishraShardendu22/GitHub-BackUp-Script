package model

import "time"

type URL struct {
	GetAllOrgRepos     string
	GetAllPublicRepos  string
	GetAllPrivateRepos string
}
type GitHubRepoAnalytics struct {
	HeadCommit        string
	HeadCommitMessage string
	HeadCommitAt      time.Time
	TotalCommits      int
	BranchCount       int
	TagCount          int
}

type LocalAnalytics struct {
	TrackedFiles int

	TotalBlobSizeBytes   int64
	AvgBlobSizeBytes     int64
	LargestBlobPath      string
	LargestBlobSizeBytes int64

	ArchiveCount            int
	TotalArchiveSizeBytes   int64
	AvgArchiveSizeBytes     int64
	LargestArchivePath      string
	LargestArchiveSizeBytes int64
}
