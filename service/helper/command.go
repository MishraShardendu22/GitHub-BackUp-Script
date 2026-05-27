package helper

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"strings"
	"time"

	"github.com/MishraShardendu22/github-backup/util"
	"go.uber.org/zap"
)

const (
	maxRetries = 3
	baseDelay  = 2 * time.Second
)

func retryCommand(cmdFunc func() *exec.Cmd, operation string, timeout time.Duration) error {
	var lastErr error

	for attempt := 1; attempt <= maxRetries; attempt++ {
		ctx, cancel := context.WithTimeout(context.Background(), timeout)
		cmd := cmdFunc()
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr

		err := cmd.Start()
		if err != nil {
			cancel()
			return fmt.Errorf("%s: failed to start command: %v", operation, err)
		}

		done := make(chan error, 1)
		go func() {
			done <- cmd.Wait()
		}()

		select {
		case <-ctx.Done():
			cmd.Process.Kill()
			cancel()
			lastErr = fmt.Errorf("%s: timeout after %v", operation, timeout)

			if attempt < maxRetries {
				delay := baseDelay * time.Duration(1<<uint(attempt-1))
				util.Logger().Warn("Command timed out; retrying",
					zap.Int("attempt", attempt),
					zap.Int("max_retries", maxRetries),
					zap.String("operation", operation),
					zap.Duration("retry_in", delay),
				)
				time.Sleep(delay)
				continue
			}
		case err := <-done:
			cancel()
			if err == nil {
				return nil
			}
			lastErr = fmt.Errorf("%s: %v", operation, err)

			errorStr := err.Error()
			isTransient := strings.Contains(errorStr, "Could not resolve hostname") ||
				strings.Contains(errorStr, "Connection reset") ||
				strings.Contains(errorStr, "Connection timed out") ||
				strings.Contains(errorStr, "temporary failure") ||
				strings.Contains(errorStr, "early EOF")

			if !isTransient {
				return lastErr
			}

			if attempt < maxRetries {
				delay := baseDelay * time.Duration(1<<uint(attempt-1))
				util.Logger().Warn("Command failed with transient error; retrying",
					zap.Int("attempt", attempt),
					zap.Int("max_retries", maxRetries),
					zap.String("operation", operation),
					zap.Duration("retry_in", delay),
					zap.Error(err),
				)
				time.Sleep(delay)
			}
		}
	}

	return fmt.Errorf("%s failed after %d attempts: %v", operation, maxRetries, lastErr)
}

func SanitizeCommitMessage(msg string) string {
	msg = strings.ReplaceAll(msg, "'", "'\\''")
	msg = strings.ReplaceAll(msg, "\"", "\\\"")
	msg = strings.ReplaceAll(msg, "`", "\\`")
	msg = strings.ReplaceAll(msg, "$", "\\$")
	return msg
}
