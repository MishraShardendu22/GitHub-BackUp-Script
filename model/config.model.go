package model

type ConfigModel struct {
	OrgAccount          string
	MainAccount         string
	BackupRepoPath      string
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
	ID              int      `json:"id"`
	Fork            bool     `json:"fork"`
	Name            string   `json:"name"`
	Owner           Owner    `json:"owner"`
	Topics          []string `json:"topics"`
	Private         bool     `json:"private"`
	SSHURL          string   `json:"ssh_url"`
	GitURL          string   `json:"git_url"`
	Language        string   `json:"language"`
	HTMLURL         string   `json:"html_url"`
	Archived        bool     `json:"archived"`
	Disabled        bool     `json:"disabled"`
	FullName        string   `json:"full_name"`
	CloneURL        string   `json:"clone_url"`
	PushedAt        string   `json:"pushed_at"`
	Visibility      string   `json:"visibility"`
	CreatedAt       string   `json:"created_at"`
	UpdatedAt       string   `json:"updated_at"`
	Description     string   `json:"description"`
	ForksCount      int      `json:"forks_count"`
	WatchersCount   int      `json:"watchers_count"`
	DefaultBranch   string   `json:"default_branch"`
	StargazersCount int      `json:"stargazers_count"`
	OpenIssuesCount int      `json:"open_issues_count"`
}
