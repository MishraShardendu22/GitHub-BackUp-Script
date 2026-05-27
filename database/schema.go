package database

import "database/sql"

func InitSchema(db *sql.DB) error {
	statements := []string{createLogsTableSQL, reposTableSQL}
	for _, statement := range statements {
		if _, err := db.Exec(statement); err != nil {
			return err
		}
	}

	return nil
}

func CleanupExpired(db *sql.DB) error {
	statements := []string{cleanupFailedLogsSQL}
	for _, statement := range statements {
		if _, err := db.Exec(statement); err != nil {
			return err
		}
	}

	return nil
}

func MigrateSchema(db *sql.DB) error {
	oldTables := []string{"repo_list", "completed_repo_list", "repo_hashes"}
	for _, table := range oldTables {
		if _, err := db.Exec("DROP TABLE IF EXISTS " + table); err != nil {
			return err
		}
	}
	return nil
}
