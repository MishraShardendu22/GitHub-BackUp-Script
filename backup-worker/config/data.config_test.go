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
	if cfg.PostgreSql != "postgresql://user:pass@localhost:5432/db" {
		t.Errorf("expected postgre url to be populated, got %s", cfg.PostgreSql)
	}
	if cfg.DatabaseURL != "postgresql://user:pass@localhost:5432/db" {
		t.Errorf("expected database url to be populated, got %s", cfg.DatabaseURL)
	}

	// Test DATABASE_URL precedence over POSTGRES_URL
	os.Setenv("DATABASE_URL", "postgresql://preferred:pass@localhost:5432/preferred_db")
	defer os.Unsetenv("DATABASE_URL")
	cfgPrecedence := LoadConfig()
	if cfgPrecedence.DatabaseURL != "postgresql://preferred:pass@localhost:5432/preferred_db" {
		t.Errorf("expected DATABASE_URL precedence, got %s", cfgPrecedence.DatabaseURL)
	}
	if cfgPrecedence.PostgreSql != "postgresql://preferred:pass@localhost:5432/preferred_db" {
		t.Errorf("expected PostgreSql to match DATABASE_URL precedence, got %s", cfgPrecedence.PostgreSql)
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
