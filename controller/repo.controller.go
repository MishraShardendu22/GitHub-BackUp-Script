package controller

import (
	"encoding/json"
	"fmt"
	"log"
	"strconv"

	"github.com/MishraShardendu22/github-backup/model"
	"github.com/MishraShardendu22/github-backup/util"
	"github.com/go-resty/resty/v2"
)

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

		// if the request itself failed, bail out
		if err != nil {
			util.ErrorHandler(err)
		}

		// if GitHub returned a non-200 status, include the body in the error
		if res.StatusCode() != 200 {
			body := string(res.Body())
			if res.StatusCode() == 401 {
				// bad credentials - likely the personal token is invalid
				// Retry unauthenticated once for public endpoints to allow continuing (may be rate limited)
				log.Printf("warning: unauthorized (401) with provided token; retrying unauthenticated. Response: %s", body)

				// retry without token
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

				// replace res with retryRes for unmarshalling below
				res = retryRes
			}
			if res.StatusCode() == 403 {
				// rate limited or forbidden
				util.ErrorHandler(fmt.Errorf("forbidden or rate limited (403). If unauthenticated, set GITHUB_TOKEN_PERSONAL to increase rate limits. Response: %s", body))
			}
			// if we reached here and status isn't 200, bail with response body
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
