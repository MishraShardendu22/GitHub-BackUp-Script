package config

import (
	"os"
	"testing"
)

func TestConfigLoading(t *testing.T) {
	os.Setenv("ORG_ACCOUNT", "test-org")
	os.Setenv("PROJECT_ACCOUNT", "test-project")
	os.Setenv("POSTGRES_URL", "postgresql://user:pass@localhost:5432/db")

	cfg := LoadConfig()
	if cfg.OrgAccount != "test-org" {
		t.Errorf("expected test-org, got %s", cfg.OrgAccount)
	}
	if cfg.ProjectAccount != "test-project" {
		t.Errorf("expected test-project, got %s", cfg.ProjectAccount)
	}
	if cfg.DBPath != "./app.db" {
		t.Errorf("expected default ./app.db, got %s", cfg.DBPath)
	}

	urls := ImportantURL(cfg)
	expectedOrg := "https://api.github.com/orgs/test-org/repos?type=all&per_page=50&page="
	if urls.GetAllOrgRepos != expectedOrg {
		t.Errorf("expected %s, got %s", expectedOrg, urls.GetAllOrgRepos)
	}

	expectedPub := "https://api.github.com/users/test-project/repos?type=public&per_page=50&page="
	if urls.GetAllPublicRepos != expectedPub {
		t.Errorf("expected %s, got %s", expectedPub, urls.GetAllPublicRepos)
	}
}
