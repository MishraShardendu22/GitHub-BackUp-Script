package helper

import (
	"strings"
	"testing"
	"time"
)

func TestRepoHelpers(t *testing.T) {
	t.Run("ExtractRepoName", func(t *testing.T) {
		tests := []struct {
			input    string
			expected string
		}{
			{"org/my-repo", "my-repo"},
			{"user/deep/nested/repo", "deep/nested/repo"},
			{"single-name", "single-name"},
			{"", ""},
		}

		for _, tt := range tests {
			res := ExtractRepoName(tt.input)
			if res != tt.expected {
				t.Errorf("ExtractRepoName(%q) = %q; want %q", tt.input, res, tt.expected)
			}
		}
	})

	t.Run("BuildCloneURL", func(t *testing.T) {
		url := BuildCloneURL("my-org/my-repo")
		expected := "git@github.com-project:my-org/my-repo.git"
		if url != expected {
			t.Errorf("BuildCloneURL = %q; want %q", url, expected)
		}
	})

	t.Run("SanitizeCommitMessage", func(t *testing.T) {
		raw := `Testing commit with 'quotes', "double", ` + "`backticks`" + ` and $vars`
		sanitized := SanitizeCommitMessage(raw)
		if !strings.Contains(sanitized, `\$vars`) {
			t.Errorf("expected \\$vars to be in %q", sanitized)
		}
	})

	t.Run("BuildDBCommitMessage", func(t *testing.T) {
		fixedTime := time.Date(2026, 8, 23, 1, 30, 0, 0, time.UTC)
		msg := BuildDBCommitMessage(fixedTime)
		if !strings.Contains(msg, "chore(db): update database with run on") {
			t.Errorf("expected chore(db) prefix in %q", msg)
		}
		if !strings.Contains(msg, "2026-08-23") {
			t.Errorf("expected date 2026-08-23 in %q", msg)
		}
	})
}
