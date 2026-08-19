package model

import (
	"database/sql"
	"time"
)

type ConfigModel struct {
	OrgAccount          string
	BackupRepoPath      string
	DBPath              string
	ProjectAccount      string
	GitHubTokenPrivate  string
	GitHubTokenPersonal string
	PostgreSql          string
}

type Repos struct {
	Repos []string `json:"repos"`
}

type Owner struct {
	URL       string `json:"url"`
	Type      string `json:"type"`
	Login     string `json:"login"`
	AvatarURL string `json:"avatar_url"`
	ID        int    `json:"id"`
}

type Repo struct {
	Owner Owner `json:"owner"`

	Name          string `json:"name"`
	SSHURL        string `json:"ssh_url"`
	GitURL        string `json:"git_url"`
	Language      string `json:"language"`
	HTMLURL       string `json:"html_url"`
	FullName      string `json:"full_name"`
	CloneURL      string `json:"clone_url"`
	PushedAt      string `json:"pushed_at"`
	Visibility    string `json:"visibility"`
	CreatedAt     string `json:"created_at"`
	UpdatedAt     string `json:"updated_at"`
	Description   string `json:"description"`
	DefaultBranch string `json:"default_branch"`

	Topics []string `json:"topics"`

	ID              int `json:"id"`
	ForksCount      int `json:"forks_count"`
	WatchersCount   int `json:"watchers_count"`
	StargazersCount int `json:"stargazers_count"`
	OpenIssuesCount int `json:"open_issues_count"`

	Fork     bool `json:"fork"`
	Private  bool `json:"private"`
	Archived bool `json:"archived"`
	Disabled bool `json:"disabled"`
}

type RepoRecord struct {
	CreatedAt time.Time
	UpdatedAt time.Time

	Name             string
	FullName         string
	CloneURL         string
	LatestCommitHash string

	LastBackedUpAt sql.NullTime

	ID int
}

type RepoStats struct {
	LastRunAt sql.NullTime

	TotalRepos    int
	BackedUpRepos int
	FailedRepos   int
}

type RepoResult struct {
	FullName    string
	RepoName    string
	URL         string
	CurrentHash string
	StartedAt   time.Time
	ArchiveSize int64

	Err error
}

type RepoHashResult struct {
	FullName    string
	RepoName    string
	URL         string
	CurrentHash string

	HashErr error

	Skipped bool
}
