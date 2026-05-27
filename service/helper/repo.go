package helper

import (
	"fmt"
	"strings"
	"time"
)

func ExtractRepoName(fullName string) string {
	return fullName[strings.Index(fullName, "/")+1:]
}

func BuildCloneURL(fullName string) string {
	return fmt.Sprintf("git@github.com-project:%s.git", fullName)
}

func BuildCommitMessage(repoName string) string {
	return SanitizeCommitMessage(fmt.Sprintf("Backup Added on %s for the repo %s",
		time.Now().Format("2006-01-02 Monday 15:04:05"),
		repoName))
}
