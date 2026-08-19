package database

import "database/sql"

/*
	Create failure logs table
	Simply to show failure what happened
	Expires after 7 days because there will be a new run so old logs would be irrelevant in my use case.
	Store hash during clone, if same latest hash, don't clone nothing changed, else clone the new one remove old, update hash.
*/

const createLogsTableSQL = `
CREATE TABLE IF NOT EXISTS failed_logs (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	repository_name TEXT NOT NULL,
	error_message TEXT NOT NULL,
	timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
	expires_at DATETIME DEFAULT (datetime('now', '+7 days'))
	);
`
const reposTableSQL = `
	CREATE TABLE IF NOT EXISTS repos (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		name TEXT NOT NULL,
		full_name TEXT NOT NULL UNIQUE,
		clone_url TEXT NOT NULL,
		latest_commit_hash TEXT NOT NULL,
		last_backed_up_at DATETIME,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);
`

func InitSchema(db *sql.DB) error {
	statements := []string{createLogsTableSQL, reposTableSQL}
	for _, statement := range statements {
		if _, err := db.Exec(statement); err != nil {
			return err
		}
	}

	return nil
}

// Clean expired logs
const cleanupFailedLogsSQL = `
	DELETE FROM failed_logs
	WHERE expires_at <= datetime('now')
`

func CleanupExpired(db *sql.DB) error {
	statements := []string{cleanupFailedLogsSQL}
	for _, statement := range statements {
		if _, err := db.Exec(statement); err != nil {
			return err
		}
	}

	return nil
}
