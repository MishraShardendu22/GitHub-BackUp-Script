# GitHub Backup Script (detailed)

This repository contains a small Go utility that helps back up GitHub repositories into a single local backup repository (located at `_Repos/` by default). The tool enumerates repositories using the GitHub API (organization repos, public user repos, and private repos when a token is provided), optionally clones them, strips their `.git` directories, and commits the repository contents into a centralized backup repository.

This README explains configuration, internals, behavior, and safety considerations in detail so you can run the tool safely and adapt it to your needs.

## Table of contents

- Overview
- Quick start
- Configuration (env & .env)
- Internals
   - models
   - controller behavior and pagination
   - clone & backup flow
   - error handling
- Examples and common workflows
- Troubleshooting
- Security and safety
- Contributing
- License

## Quick start

1. Install prerequisites:

```bash
sudo apt-get install -y git
# install Go (follow official instructions for your OS/version)
```

2. Create a `.env` at the project root (optional for development). Example below.

3. Build and run:

```bash
go build -o github-backup ./...
# or run directly
go run main.go
```

By default the program prints discovered repositories and counts. To perform an actual backup (clone, remove `.git`, commit and push), uncomment the `CloneRepos(allRepos, config)` line in `main.go`.

## Configuration

The application reads configuration from environment variables. In development the repository loads a `.env` file (via `github.com/joho/godotenv`) if present. Do NOT commit your `.env` to version control.

Important environment variables (names used in `main.go` and `model.ConfigModel`):

- `ORG_ACCOUNT` — Organization name to list organization repositories for the org endpoint.
- `PROJECT_ACCOUNT` — User account whose public repositories will be listed.
- `MAIN_ACCOUNT` — Present in the config model but unused by current code (reserved for future features).
- `BACKUP_REPO_PATH` — Target path for the local backup repository (the code uses a default `_Repos` in many places; set this if you change the location).
- `GITHUB_TOKEN_PERSONAL` — Personal access token used for authenticated calls to GitHub API and to increase rate limits. Required for listing private repos via the private endpoint.
- `GITHUB_TOKEN_PRIVATE` — (Note: code uses `GithubTokenPrivate` field when calling the private repo endpoint). Provide a token if you want to list private repos from the account that owns the token.

Example `.env` (DO NOT COMMIT):

```env
ORG_ACCOUNT=MyOrg
PROJECT_ACCOUNT=MyProjectUser
BACKUP_REPO_PATH=_Repos
GITHUB_TOKEN_PERSONAL=ghp_XXXXXXXXXXXXXXXXXXXXXXXX
GITHUB_TOKEN_PRIVATE=ghp_YYYYYYYYYYYYYYYYYYYYYYYY
```

## Internals (detailed)

This section outlines the key code paths and data models so you understand what the program does and how it behaves under edge conditions.

Files to inspect:

- `main.go` — orchestration and the user-visible flow.
- `controller/repo.controller.go` — GitHub API request logic (pagination, retries, unauthenticated fallback).
- `model/*.go` — data models for configuration and GitHub responses.
- `util/*` — helper utilities (environment reads and fatal error handler).

### Models

`model.ConfigModel` fields:

- `OrgAccount` (string)
- `MainAccount` (string)
- `BackupRepoPath` (string)
- `ProjectAccount` (string)
- `GitHubTokenPersonal` (string) — used by controller when present
- `GithubTokenPrivate` (string) — used specifically by the private repo controller

`model.Repo` mirrors the minimal fields returned by GitHub's repository API JSON and includes fields like `FullName`, `CloneURL`, `SSHURL`, `Private`, `DefaultBranch`, `PushedAt`, and metadata like `Description` and `Language`.

### Controller behavior and pagination

`controller.RepoController(RepoURL string, config model.ConfigModel) []string`:

- Uses `resty` HTTP client to GET paginated endpoints. It expects the `RepoURL` to be a base URL that accepts a page number appended (the code appends page numbers via `strconv.Itoa(page)`).
- It sets `Content-Type: application/json` header and uses `config.GitHubTokenPersonal` as a bearer token when present.
- Pagination loop: starts at `page=1`, fetches results, unmarshals into `[]model.Repo`, appends `FullName` to the return list, increments `page`, and stops when receiving an empty array.
- Error handling and retries:
   - If the request returns 401 (unauthorized) and a token was supplied, it logs a warning and retries the same request unauthenticated once — this helps continue when token lacks proper scope but public endpoints are available.
   - If the response is 403, the controller treats it as forbidden or rate-limited and calls `util.ErrorHandler` with an explanatory message. That function logs and exits the program with code 1.
   - Any unexpected status codes or JSON unmarshal errors are passed to `util.ErrorHandler` and terminate the program.

`controller.RepoControllerPrivate(RepoURL string, config model.ConfigModel) []string`:

- Calls the provided `RepoURL` once with `config.GithubTokenPrivate` as the auth token. If it gets a 401, it calls `util.ErrorHandler` and exits. It expects a 200 and unmarshals the response into `[]model.Repo` and returns `FullName` values.

Implications:

- The controllers terminate the program on many non-200 responses — this is intentional to avoid proceeding with partial or invalid data.
- Use valid tokens to avoid 401/403 errors and rate limits. For public-only operations you can omit tokens but may be rate-limited by GitHub's unauthenticated limits.

### Clone & backup flow (CloneRepos)

The `CloneRepos` function (in `main.go`) is currently commented out from the default run. When enabled it:

1. Runs an initial shell command that:
    - `cd _Repos && git init && (git checkout -b main || git checkout main || true)` — ensures there is a git repo and a `main` branch.
    - Creates a `README.md` and initial commit if the repo has no commits.
    - Attempts to set or add a remote `origin` (the code uses a sample remote URL in the command; you should change this to your backup repository remote URL).
    - Pushes force to `origin main` to ensure the remote has the initial commit.

2. For each `owner/repo` in the list:
    - Clones `git@github.com:owner/repo.git` into `_Repos/<repo>`.
    - Removes the cloned repo's `.git` (`rm -rf _Repos/<repo>/.git`) — this strips commit history and metadata, leaving only files.
    - Adds the repo folder to the `_Repos` repo, commits with a message that includes the timestamp and repo name (skips commit if no staged changes), and pushes to `origin main`.

Important notes:

- The cloning/pushing flow executes shell commands using `sh -c` and interpolates repo names into shell strings. Be cautious about repo names that contain unexpected characters, though GitHub repo names are generally safe.
- The code uses SSH clone URLs (`git@github.com:owner/repo.git`). Ensure the machine running this has SSH keys and access to clone the repositories and push to your backup remote. If you prefer HTTPS, modify the URL construction.

### Error handling

- `util.ErrorHandler(err)` is used across the code. It logs the error and calls `os.Exit(1)`. The program therefore fails fast on many error conditions (network failures, unexpected statuses, unmarshal errors).
- The controller implements a small retry/fallback for 401 when a token is present (it retries unauthenticated once). For 403 (rate-limited) it exits with a helpful message advising to set `GITHUB_TOKEN_PERSONAL` to increase rate limits.

## Examples and common workflows

1) Run discovery only (safe):

```bash
# set envs or create .env
go run main.go
```

This prints counts and repository full names discovered. It does not clone or push anything with the default `main.go` as shipped here.

2) Perform a full backup (be careful):

- Edit `main.go` and uncomment the `CloneRepos(allRepos, config)` line. Also double-check the initial git remote URL that the script sets in `_Repos` and change it to your backup repo remote.
- Ensure your SSH agent has keys that can read the repos to clone and push to the backup remote.
- Run:

```bash
go run main.go
```

This will:

- Initialize `_Repos` as a git repository and ensure `main` exists.
- Clone each discovered repository into `_Repos/<repo>`.
- Remove `.git` inside each cloned repo.
- Stage and commit each repo contents into `_Repos` and push to the configured remote.

## Troubleshooting

- If you see `unauthorized (401)` errors:
   - Check that `GITHUB_TOKEN_PERSONAL` and `GITHUB_TOKEN_PRIVATE` are set correctly and have the necessary scopes.

- If you see `forbidden or rate limited (403)`:
   - You likely hit unauthenticated rate limits. Set `GITHUB_TOKEN_PERSONAL` to a token with the appropriate scopes.

- If git clone or git push commands fail:
   - Verify SSH keys and access rights. Test cloning manually: `git clone git@github.com:owner/repo.git`.
   - Check the initial `_Repos` remote URL. The script uses a hard-coded sample remote; update it to your real backup remote.

- If the program exits with a fatal error but you expected it to continue:
   - The project uses `util.ErrorHandler` to exit on many errors by design. Wrap or modify error handling if you prefer a tolerant approach.

## Security and safety

- Never commit `.env` with tokens to source control. Store tokens in a secrets manager for production use.
- The backup flow strips `.git` directories from cloned repositories. If you want to preserve commit history, do not remove `.git` — instead modify the code to preserve it and use a different backup strategy (e.g., mirror clones).
- Avoid running this script on machines with untrusted network access or compromised SSH keys.

## Contributing

Contributions are welcome. A few guidelines:

- Open an issue to discuss larger changes.
- Keep changes small and well-tested. Add tests for controller logic using mocked HTTP responses when possible.
- Be explicit in PR descriptions about behavior that modifies or deletes `.git` directories or pushes to remotes.

## License

This repository does not include an explicit LICENSE file. If you want an open-source license, add a `LICENSE` at the repo root (MIT is suggested for small projects).

