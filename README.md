# GitHub Backup Script

A Go utility that discovers GitHub repositories via the API, clones each repo, removes its git history, and commits the working tree into a single backup repository. It also creates a local snapshot in a `backup/` folder before cleaning up temporary files.

Use this README as a tour of how the application works. Code examples below are taken directly from the implementation.

**High-level flow**
- Load configuration from environment variables.
- Build GitHub API endpoints for org, public, and private repos.
- Fetch all repo full names.
- Initialize a backup git repo in `_Repos`.
- For each repo: clone, strip `.git`, stage, commit, push.
- Copy `_Repos` to `backup/`, then remove `_Repos`.

**Entry point**
The entry point lives in [main.go](main.go). The application flow is routed through `runBackupFlow()`.

```go
func main() {
	fmt.Println("Hello from GitHub Backup Script")
	runBackupFlow()
}

func runBackupFlow() {
	config := loadConfig()
	urls := ImportantURL(config)

	allRepos := GetAllRepos(config, urls)
	fmt.Println("The Amount of repos is:", len(allRepos))

	printRepoList(allRepos)
	CloneRepos(allRepos, config)
}
```

**Configuration (.env)**
Environment variables are read via `util.GetEnv` and optionally loaded from a local `.env` during development. See [.env.sample](.env.sample) for the full list.

```env
ORG_ACCOUNT=
MAIN_ACCOUNT=
PROJECT_ACCOUNT=
BACKUP_REPO_PATH=
GITHUB_TOKEN_PRIVATE=
GITHUB_TOKEN_PERSONAL=
```

`loadConfig()` wires these values into `model.ConfigModel` in [model/config.model.go](model/config.model.go):

```go
func loadConfig() *model.ConfigModel {
	return &model.ConfigModel{
		OrgAccount:          util.GetEnv("ORG_ACCOUNT", ""),
		MainAccount:         util.GetEnv("MAIN_ACCOUNT", ""),
		ProjectAccount:      util.GetEnv("PROJECT_ACCOUNT", ""),
		BackupRepoPath:      util.GetEnv("BACKUP_REPO_PATH", ""),
		GitHubTokenPrivate:  util.GetEnv("GITHUB_TOKEN_PERSONAL", ""),
		GitHubTokenPersonal: util.GetEnv("GITHUB_TOKEN_PERSONAL", ""),
	}
}
```

**Repo discovery**
Repo discovery is coordinated by `GetAllRepos()` in [main.go](main.go). It combines org, public, and private lists into a single slice.

```go
func GetAllRepos(config *model.ConfigModel, urls *model.URL) []string {
	orgReposPersonal := controller.RepoController(urls.GetAllOrgRepos, *config)
	publicReposPersonal := controller.RepoController(urls.GetAllPublicRepos, *config)
	privatePersonalAndOrgReops := controller.RepoControllerPrivate(urls.GetAllPrivateRepos, *config)

	var allRepos []string
	allRepos = append(allRepos, orgReposPersonal...)
	allRepos = append(allRepos, publicReposPersonal...)
	allRepos = append(allRepos, privatePersonalAndOrgReops...)

	return allRepos
}
```

The controllers are implemented in [controller/repo.controller.go](controller/repo.controller.go). The public/org controller paginates until an empty page is returned:

```go
for {
	paginatedUrl := RepoURL + strconv.Itoa(page)
	req := client.R().EnableTrace().SetHeader("Content-Type", "application/json")

	if config.GitHubTokenPersonal != "" {
		req.SetAuthToken(config.GitHubTokenPersonal)
	}

	res, err := req.Get(paginatedUrl)
	if err != nil {
		util.ErrorHandler(err)
	}

	var repos []model.Repo
	if err := json.Unmarshal(res.Body(), &repos); err != nil {
		util.ErrorHandler(err)
	}

	if len(repos) == 0 {
		break
	}

	for _, repo := range repos {
		repoNames = append(repoNames, repo.FullName)
	}

	page++
}
```

**Backup pipeline**
`CloneRepos()` performs the backup in [main.go](main.go). The flow is:
1) Prepare a clean `_Repos` directory.
2) Initialize a backup git repository and push an initial commit.
3) For each repo: clone, remove its `.git`, stage and commit, push.
4) Create a local snapshot `backup/` and clean `_Repos`.

```go
if err := prepareReposDir(); err != nil {
	util.ErrorHandler(err)
	return
}

defer backupAndCleanup()

if err := setupInitialBackupRepo(); err != nil {
	util.ErrorHandler(err)
	return
}

for idx, fullName := range repoNames {
	repoName := extractRepoName(fullName)
	repoPath := buildRepoPath(repoName)
	url := buildCloneURL(fullName)

	cleanupExistingRepo(repoName)
	if err := cloneRepo(url, repoName); err != nil {
		failedRepos = append(failedRepos, fullName)
		continue
	}

	removeGitMetadata(repoPath)
	commitMsg := buildCommitMessage(repoName)
	stageAndCommitRepo(repoName, commitMsg)

	if err := pushBackupRepo(repoName); err != nil {
		failedRepos = append(failedRepos, fullName)
		continue
	}
}
```

`setupInitialBackupRepo()` runs a shell script that initializes `_Repos` as a git repo and pushes to a preconfigured remote. You can adjust the remote or other git settings in `buildInitScript()`.

**Retries and error handling**
Shell operations that can fail (clone, push, initial setup) are wrapped in `retryCommand()`, which retries transient errors with exponential backoff.

```go
func retryCommand(cmdFunc func() *exec.Cmd, operation string, timeout time.Duration) error {
	for attempt := 1; attempt <= maxRetries; attempt++ {
		ctx, cancel := context.WithTimeout(context.Background(), timeout)
		cmd := cmdFunc()
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr

		err := cmd.Start()
		if err != nil {
			cancel()
			return fmt.Errorf("%s: failed to start command: %v", operation, err)
		}

		done := make(chan error, 1)
		go func() { done <- cmd.Wait() }()

		select {
		case <-ctx.Done():
			cmd.Process.Kill()
			cancel()
		case err := <-done:
			cancel()
			if err == nil {
				return nil
			}
		}
	}

	return fmt.Errorf("%s failed after %d attempts", operation, maxRetries)
}
```

Fatal errors are handled by `util.ErrorHandler` in [util/error.util.go](util/error.util.go):

```go
func ErrorHandler(err error) {
	if err == nil {
		return
	}

	log.Printf("fatal error: %v\n", err)
	os.Exit(1)
}
```

**Notes and assumptions**
- The script uses SSH aliases in clone and remote URLs (for example `github.com-project` and `github.com-learning`). Make sure your SSH config defines these aliases.
- Backups use `_Repos` and `backup` directories by default; `BACKUP_REPO_PATH` is read but not used in the current flow.
- `loadConfig()` currently reads `GITHUB_TOKEN_PERSONAL` for both personal and private token fields. If you want separate tokens, adjust the mapping in code.

