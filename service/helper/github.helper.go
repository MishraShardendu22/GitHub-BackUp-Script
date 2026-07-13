// Not needed now, can be deleted
package helper

// import (
// 	"fmt"
// 	"net/http"
// 	"time"

// 	"github.com/go-resty/resty/v2"
// )

// const (
// 	pageSize = 100
// )

/*
Create a resty client with retry logic for GitHub API requests.

FetchGithubJSON is a helper function to make authenticated requests to GitHub API
and unmarshal the JSON response into the target struct.
*/

// var githubClient = resty.New().
// 	SetRetryCount(3).
// 	SetRetryWaitTime(2 * time.Second).
// 	SetRetryMaxWaitTime(10 * time.Second)

// func FetchGitHubJSON(method string, url string, token string, target any) error {
// 	resp, err := githubClient.R().
// 		SetHeader("Accept", "application/vnd.github+json").
// 		SetHeader("User-Agent", "github-backup-script").
// 		SetAuthToken(token).
// 		SetResult(target).
// 		Execute(method, url)
// 	if err != nil {
// 		return err
// 	}

// 	if resp.IsError() {
// 		return fmt.Errorf("github api request failed: %d: %s", resp.StatusCode(), resp.String())
// 	}

// 	return nil
// }

// // CountGitHubItems counts the total number of items (commits, branches, tags) in a GitHub repository
// // by paginating through the API results.
// func CountGitHubItems(endpoint string, token string) (int, error) {
// 	total := 0

// 	for page := 1; ; page++ {
// 		var items []struct{}
// 		err := FetchGitHubJSON(
// 			http.MethodGet,
// 			fmt.Sprintf("%s?page=%d&per_page=%d", endpoint, page, pageSize),
// 			token,
// 			&items,
// 		)
// 		if err != nil {
// 			return 0, err
// 		}

// 		if len(items) == 0 {
// 			break
// 		}

// 		total += len(items)

// 		if len(items) < pageSize {
// 			break
// 		}
// 	}

// 	return total, nil
// }
