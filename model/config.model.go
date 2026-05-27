package model

import (
	"database/sql"
	"time"
)

type ConfigModel struct {
	OrgAccount          string
	MainAccount         string
	BackupRepoPath      string
	DBPath              string
	ProjectAccount      string
	GitHubTokenPrivate  string
	GitHubTokenPersonal string
}

type Repos struct {
	Repos []string `json:"repos"`
}

type Owner struct {
	ID        int    `json:"id"`
	URL       string `json:"url"`
	Type      string `json:"type"`
	Login     string `json:"login"`
	AvatarURL string `json:"avatar_url"`
}

type Repo struct {
	Fork            bool     `json:"fork"`
	Private         bool     `json:"private"`
	Archived        bool     `json:"archived"`
	Disabled        bool     `json:"disabled"`
	ID              int      `json:"id"`
	ForksCount      int      `json:"forks_count"`
	WatchersCount   int      `json:"watchers_count"`
	StargazersCount int      `json:"stargazers_count"`
	OpenIssuesCount int      `json:"open_issues_count"`
	Owner           Owner    `json:"owner"`
	Name            string   `json:"name"`
	SSHURL          string   `json:"ssh_url"`
	GitURL          string   `json:"git_url"`
	Language        string   `json:"language"`
	HTMLURL         string   `json:"html_url"`
	FullName        string   `json:"full_name"`
	CloneURL        string   `json:"clone_url"`
	PushedAt        string   `json:"pushed_at"`
	Visibility      string   `json:"visibility"`
	CreatedAt       string   `json:"created_at"`
	UpdatedAt       string   `json:"updated_at"`
	Description     string   `json:"description"`
	DefaultBranch   string   `json:"default_branch"`
	Topics          []string `json:"topics"`
}

type RepoRecord struct {
	ID               int
	Name             string
	FullName         string
	CloneURL         string
	LatestCommitHash string
	LastBackedUpAt   sql.NullTime
	CreatedAt        time.Time
	UpdatedAt        time.Time
}

type RepoStats struct {
	TotalRepos    int
	BackedUpRepos int
	FailedRepos   int
	LastRunAt     sql.NullTime
}
