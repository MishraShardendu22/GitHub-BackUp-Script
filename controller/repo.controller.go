package controller

import (
	"encoding/json"
	"fmt"
	"strconv"

	"github.com/MishraShardendu22/github-backup/model"
	"github.com/MishraShardendu22/github-backup/util"
	"github.com/go-resty/resty/v2"
	"go.uber.org/zap"
)

// resty use karke I am tryna get all the public repos of a user 
// and then i will use that list to backup all the repos of that user
func RepoController(RepoURL string, config model.ConfigModel) []string {
	client := resty.New()
	var page int = 1
	var repoNames []string

	for {
		paginatedUrl := RepoURL + strconv.Itoa(page)
		req := client.R().
			EnableTrace().
			SetHeader("Content-Type", "application/json")

		if config.GitHubTokenPersonal != "" {
			req.SetAuthToken(config.GitHubTokenPersonal)
		}

		res, err := req.Get(paginatedUrl)

		if err != nil {
			util.ErrorHandler(err)
		}

		if res.StatusCode() != 200 {
			body := string(res.Body())
			if res.StatusCode() == 401 {
				util.Logger().Warn("Unauthorized with provided token; retrying unauthenticated",
					zap.Int("status", res.StatusCode()),
					zap.String("response", body),
				)

				retryRes, retryErr := client.R().
					EnableTrace().
					SetHeader("Content-Type", "application/json").
					Get(paginatedUrl)

				if retryErr != nil {
					util.ErrorHandler(retryErr)
				}

				if retryRes.StatusCode() != 200 {
					retryBody := string(retryRes.Body())
					if retryRes.StatusCode() == 403 {
						util.ErrorHandler(fmt.Errorf("forbidden or rate limited (403). No valid auth; set GITHUB_TOKEN_PERSONAL to increase rate limits. Response: %s", retryBody))
					}
					util.ErrorHandler(fmt.Errorf("unexpected status %d after retry: %s", retryRes.StatusCode(), retryBody))
				}

				res = retryRes
			}
			if res.StatusCode() == 403 {
				util.ErrorHandler(fmt.Errorf("forbidden or rate limited (403). If unauthenticated, set GITHUB_TOKEN_PERSONAL to increase rate limits. Response: %s", body))
			}
			if res.StatusCode() != 200 {
				util.ErrorHandler(fmt.Errorf("unexpected status %d: %s", res.StatusCode(), body))
			}
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

	return repoNames
}

// same as above but for private repos
func RepoControllerPrivate(RepoURL string, config model.ConfigModel) []string {
	client := resty.New()
	res, err := client.R().
		EnableTrace().
		SetHeader("Content-Type", "application/json").
		SetAuthToken(config.GitHubTokenPrivate).
		Get(RepoURL)

	if err != nil {
		util.ErrorHandler(err)
	}

	if res.StatusCode() != 200 {
		body := string(res.Body())
		if res.StatusCode() == 401 {
			util.ErrorHandler(fmt.Errorf("unauthorized (401). Check GITHUB_TOKEN_PRIVATE in your environment or .env. Response: %s", body))
		}
		util.ErrorHandler(fmt.Errorf("unexpected status %d: %s", res.StatusCode(), body))
	}

	var repos []model.Repo
	if err := json.Unmarshal(res.Body(), &repos); err != nil {
		util.ErrorHandler(err)
	}

	var repoNames []string
	for _, repo := range repos {
		repoNames = append(repoNames, repo.FullName)
	}

	return repoNames
}
