package database

import "database/sql"

const createLogsTableSQL = `
	CREATE TABLE IF NOT EXISTS failed_logs (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		repository_name TEXT NOT NULL,
		error_message TEXT NOT NULL,
		timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
		expires_at DATETIME DEFAULT (datetime('now', '+7 days'))
	);
`

const insertLogsSQL = `
	INSERT INTO failed_logs (repository_name, error_message) VALUES (?, ?);
`

const cleanupFailedLogsSQL = `
	DELETE FROM failed_logs
	WHERE expires_at <= datetime('now')
`

func LogFailure(db *sql.DB, repo string, failure error) error {
	if failure == nil {
		return nil
	}

	_, err := db.Exec(insertLogsSQL, repo, failure.Error())
	return err
}
