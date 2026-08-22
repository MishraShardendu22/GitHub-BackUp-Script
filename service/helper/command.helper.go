package helper

import (
	"bytes"
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
	maxRetries = 5
	baseDelay  = 2 * time.Second
)

/*
	    Custom Retry function - generic retry wrapper for shell commands.

		ctx, cancel := context.WithTimeout(context.Background(), timeout)
		- Create timeout context, automatically expires after timeout

		cmdFunc()
		- build the command
		- Eg. retryCommand(
				func() *exec.Cmd {
					return exec.Command(
						"git",
						"push",
						"origin",
						"main",
					)
				},
			)

		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr
		- without these output wont show

		err := cmd.Start()
		- execute that command and returns immediately, it does not wait

		done := make(chan error, 1)
		- make a channel that can at max hold 1 error value
		- can hold one message without blocking.

		go func() {
			done <- cmd.Wait()
		}()
		- Separate thread:
			- wait until command exits
			- send result into channel

		why use channels ?
		they are working on separate threads at the same time
		- command finished OR
		- timeout reached

		select is basically = wait for whichever event happens first.
		1. case <-ctx.Done() = timeout occured
		cmd.Process.Kill() = kill the process and try again

		2. case err := <-done = command completed before timeout
		cancel() = releases the resources associated with the context.

		then we check for transient error (dns problem, github issue, network issue etc)

		This is basically exponential backoff
		exponential backoff is used to prevent repeated retries from making a problem worse.
		1 << k is basically 2 ^ k
			- 1 << 0 = 1
			- 1 << 1 = 2
			- 1 << 2 = 4
			- 1 << 3 = 8

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

		TCP uses a form of exponential backoff for retransmission timeouts (RTO).
		When a packet is lost and the sender does not receive an ACK:
		1st timeout -> RTO
		2nd timeout -> 2 × RTO
		3rd timeout -> 4 × RTO
		4th timeout -> 8 × RTO
*/
func retryCommand(cmdFunc func() *exec.Cmd, operation string, timeout time.Duration) error {
	var lastErr error

	for attempt := 1; attempt <= maxRetries; attempt++ {
		ctx, cancel := context.WithTimeout(context.Background(), timeout)
		cmd := cmdFunc()
		if cmd.Stdout == nil {
			cmd.Stdout = os.Stdout
		}
		if cmd.Stderr == nil {
			cmd.Stderr = os.Stderr
		}

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

// RunGitCommand executes git with retries and returns trimmed stdout.
func RunGitCommand(repoDir string, args ...string) (string, error) {
	var output bytes.Buffer
	commandArgs := append([]string{"-C", repoDir}, args...)
	err := retryCommand(func() *exec.Cmd {
		output.Reset()
		cmd := exec.Command("git", commandArgs...)
		cmd.Stdout = &output
		cmd.Stderr = &output
		return cmd
	}, fmt.Sprintf("git %s", strings.Join(args, " ")), cloneTimeout)
	if err != nil {
		return "", fmt.Errorf("git %s failed: %v: %s", strings.Join(args, " "), err, strings.TrimSpace(output.String()))
	}

	return strings.TrimSpace(output.String()), nil
}
