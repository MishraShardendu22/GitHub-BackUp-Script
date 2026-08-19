package helper

import (
	"strings"
	"testing"
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
}
