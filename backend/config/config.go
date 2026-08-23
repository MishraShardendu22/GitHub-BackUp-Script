package config

import (
	"fmt"
	"net/url"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"
)

// Hardcoded System Constants
const (
	DefaultServerPort  = "8080"
	DefaultDBMaxConns  = int32(10)
	DefaultDBMinConns  = int32(2)
	DefaultLogLevel    = "info"
	MaxBodyLimitBytes  = 10 * 1024 * 1024 // 10MB
	DBConnectTimeout   = 10 * time.Second
	DBMigrationTimeout = 60 * time.Second
	DBMaxConnLifetime  = 1 * time.Hour
	DBMaxConnIdleTime  = 30 * time.Minute
)

// Config holds all validated configuration extracted from environment.
type Config struct {
	PostgresURL      string
	DatabaseURL      string
	ServerPort       string
	InternalSecret   string
	OpenRouterAPIKey string
	DBMaxConns       int32
	DBMinConns       int32
	LogLevel         string
}

var (
	instance *Config
	mu       sync.RWMutex
)

// Get returns the globally loaded configuration singleton.
func Get() *Config {
	mu.RLock()
	cfg := instance
	mu.RUnlock()

	if cfg == nil {
		// Fallback auto-load (LoadAndValidate calls Set(cfg) which acquires write lock cleanly)
		cfg, _ = LoadAndValidate()
	}
	return cfg
}

// GetInternalSecret returns the configured internal secret from singleton or env.
func GetInternalSecret() string {
	if cfg := Get(); cfg != nil && cfg.InternalSecret != "" {
		return cfg.InternalSecret
	}
	return os.Getenv("INTERNAL_SECRET")
}

// GetOpenRouterAPIKey returns the configured OpenRouter API key from singleton or env.
func GetOpenRouterAPIKey() string {
	if cfg := Get(); cfg != nil && cfg.OpenRouterAPIKey != "" {
		return cfg.OpenRouterAPIKey
	}
	return os.Getenv("OPENROUTER_API_KEY")
}

// Set explicitly sets the global configuration instance (useful in tests).
func Set(cfg *Config) {
	mu.Lock()
	defer mu.Unlock()
	instance = cfg
}

// LoadAndValidate extracts and strictly validates all environment configuration.
// It stores the validated instance as the global singleton.
func LoadAndValidate() (*Config, error) {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		dbURL = os.Getenv("POSTGRES_URL")
	}
	if dbURL == "" {
		return nil, fmt.Errorf("DATABASE_URL must be set")
	}

	// Validate database URL format
	parsedURL, err := url.Parse(dbURL)
	if err != nil || (!strings.HasPrefix(parsedURL.Scheme, "postgres") && !strings.HasPrefix(parsedURL.Scheme, "postgresql")) {
		return nil, fmt.Errorf("invalid DATABASE_URL scheme: must start with postgres:// or postgresql://")
	}

	portStr := os.Getenv("SERVER_PORT")
	if portStr == "" {
		portStr = DefaultServerPort
	}
	portNum, err := strconv.Atoi(portStr)
	if err != nil || portNum < 1 || portNum > 65535 {
		return nil, fmt.Errorf("invalid SERVER_PORT '%s': must be between 1 and 65535", portStr)
	}

	internalSecret := os.Getenv("INTERNAL_SECRET")

	// Pool limits
	maxConns := DefaultDBMaxConns
	if maxStr := os.Getenv("DB_MAX_CONNS"); maxStr != "" {
		if val, err := strconv.ParseInt(maxStr, 10, 32); err == nil && val >= 1 && val <= 100 {
			maxConns = int32(val)
		} else {
			return nil, fmt.Errorf("invalid DB_MAX_CONNS '%s': must be between 1 and 100", maxStr)
		}
	}

	minConns := DefaultDBMinConns
	if minStr := os.Getenv("DB_MIN_CONNS"); minStr != "" {
		if val, err := strconv.ParseInt(minStr, 10, 32); err == nil && val >= 1 && val <= int64(maxConns) {
			minConns = int32(val)
		} else {
			return nil, fmt.Errorf("invalid DB_MIN_CONNS '%s': must be between 1 and %d", minStr, maxConns)
		}
	}

	logLevel := strings.ToLower(os.Getenv("LOG_LEVEL"))
	if logLevel == "" {
		logLevel = DefaultLogLevel
	}

	openrouterKey := os.Getenv("OPENROUTER_API_KEY")

	cfg := &Config{
		PostgresURL:      dbURL,
		DatabaseURL:      dbURL,
		ServerPort:       portStr,
		InternalSecret:   internalSecret,
		OpenRouterAPIKey: openrouterKey,
		DBMaxConns:       maxConns,
		DBMinConns:       minConns,
		LogLevel:         logLevel,
	}

	Set(cfg)
	return cfg, nil
}
