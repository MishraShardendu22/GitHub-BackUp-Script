package service

import (
	"reflect"
	"testing"
)

func TestDeduplicateRepos(t *testing.T) {
	tests := []struct {
		name     string
		input    []string
		expected []string
	}{
		{
			name:     "empty input",
			input:    []string{},
			expected: []string{},
		},
		{
			name:     "no duplicates",
			input:    []string{"org/repo1", "org/repo2", "org/repo3"},
			expected: []string{"org/repo1", "org/repo2", "org/repo3"},
		},
		{
			name:     "with duplicates",
			input:    []string{"org/repo1", "org/repo2", "org/repo1", "org/repo3", "org/repo2"},
			expected: []string{"org/repo1", "org/repo2", "org/repo3"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := deduplicateRepos(tt.input)
			if !reflect.DeepEqual(result, tt.expected) {
				t.Errorf("deduplicateRepos(%v) = %v; want %v", tt.input, result, tt.expected)
			}
		})
	}
}
