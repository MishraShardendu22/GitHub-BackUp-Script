package controller

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"

	"github.com/MishraShardendu22/github-backup/backup-worker/model"
)

func TestRepoController(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		pageStr := r.URL.Query().Get("page")
		page, _ := strconv.Atoi(pageStr)

		if page == 1 {
			repos := []model.Repo{
				{FullName: "test-org/repo1"},
				{FullName: "test-org/repo2"},
			}
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(repos)
		} else {
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode([]model.Repo{})
		}
	}))
	defer ts.Close()

	cfg := model.ConfigModel{
		GitHubTokenPersonal: "mock-token",
	}

	repoNames := RepoController(ts.URL+"?page=", cfg)
	if len(repoNames) != 2 {
		t.Fatalf("expected 2 repos, got %d", len(repoNames))
	}
	if repoNames[0] != "test-org/repo1" || repoNames[1] != "test-org/repo2" {
		t.Errorf("unexpected repo names: %v", repoNames)
	}
}

func TestRepoControllerPrivate(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		pageStr := r.URL.Query().Get("page")
		page, _ := strconv.Atoi(pageStr)

		if page == 1 {
			repos := []model.Repo{
				{FullName: "private-user/secret-repo"},
			}
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(repos)
		} else {
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode([]model.Repo{})
		}
	}))
	defer ts.Close()

	cfg := model.ConfigModel{
		GitHubTokenPrivate: "secret-token",
	}

	repoNames := RepoControllerPrivate(ts.URL+"?page=", cfg)
	if len(repoNames) != 1 {
		t.Fatalf("expected 1 repo, got %d", len(repoNames))
	}
	if repoNames[0] != "private-user/secret-repo" {
		t.Errorf("unexpected repo name: %v", repoNames[0])
	}
}
