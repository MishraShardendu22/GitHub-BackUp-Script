package database

import "database/sql"

func InitSchema(db *sql.DB) error {
	statements := []string{createLogsTableSQL, repoListSQL, completedRepoListSQL, repoHashSQL}
	for _, statement := range statements {
		if _, err := db.Exec(statement); err != nil {
			return err
		}
	}

	return nil
}

func CleanupExpired(db *sql.DB) error {
	statements := []string{cleanupFailedLogsSQL, cleanupRepoListSQL, cleanupCompletedRepoListSQL, cleanupRepoHashSQL}
	for _, statement := range statements {
		if _, err := db.Exec(statement); err != nil {
			return err
		}
	}

	return nil
}
