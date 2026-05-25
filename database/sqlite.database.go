package database

import (
	"database/sql"

	"github.com/MishraShardendu22/github-backup/model"
	"github.com/MishraShardendu22/github-backup/util"
	_ "github.com/mattn/go-sqlite3"
	"go.uber.org/zap"
)

func ConnectSQLite(config *model.ConfigModel) (*sql.DB, error) {
	dbPath := config.DBPath
	if dbPath == "" {
		dbPath = "./app.db"
	}

	db, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		return nil, err
	}

	if err := db.Ping(); err != nil {
		_ = db.Close()
		return nil, err
	}

	util.Logger().Info("Database connected",
		zap.String("path", dbPath),
	)

	return db, nil
}

var createLogsTableSQL = `
	CREATE TABLE IF NOT EXISTS failed_logs (
		ID PRIMARY KEY AUTOINCREMENT,
		RepositoryName TEXT NOT NULL,
		ErrorMessage TEXT NOT NULL,
		Timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
		expires_at DATETIME DEFAULT (datetime('now', '+7 days'))
	);
`

var insertLogsSQL = `
	INSERT INTO failed_logs (RepositoryName, ErrorMessage, Timestamp) VALUES (?, ?, ?);
	expires_at DATETIME DEFAULT (datetime('now', '+7 days'))
	`

var cleanUp = `
	DELETE FROM failed_logs
	WHERE expires_at <= datetime('now')
`
var repoListSQL = `
	CREATE TABLE IF NOT EXISTS repo_list (
		ID PRIMARY KEY AUTOINCREMENT,
		RepositoryName TEXT NOT NULL,
		Timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
		expires_at DATETIME DEFAULT (datetime('now', '+7 days'))
	);
`

var insertRepoListSQL = `
	INSERT INTO repo_list (RepositoryName, Timestamp) VALUES (?, ?, ?);
	expires_at DATETIME DEFAULT (datetime('now', '+7 days'))
`

var completedRepoListSQL = `
	CREATE TABLE IF NOT EXISTS completed_repo_list (
		ID PRIMARY KEY AUTOINCREMENT,
		RepositoryName TEXT NOT NULL,
		Timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
		expires_at DATETIME DEFAULT (datetime('now', '+7 days'))
	);
`

var insertCompletedRepoListSQL = `
	INSERT INTO completed_repo_list (RepositoryName, Timestamp) VALUES (?, ?, ?);
	expires_at DATETIME DEFAULT (datetime('now', '+7 days'))
`

