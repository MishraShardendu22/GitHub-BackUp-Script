package util

import "os"

func GetEnv(Expected string, Default string) string {
	secret := os.Getenv(Expected)

	if secret == "" {
		return Default
	}

	return secret
}
