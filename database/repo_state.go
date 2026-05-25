package database

import "database/sql"

const repoListSQL = `
	CREATE TABLE IF NOT EXISTS repo_list (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		repository_name TEXT NOT NULL,
		timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
		expires_at DATETIME DEFAULT (datetime('now', '+7 days'))
	);
`

const insertRepoListSQL = `
	INSERT OR IGNORE INTO repo_list (repository_name) VALUES (?);
`

const cleanupRepoListSQL = `
	DELETE FROM repo_list
	WHERE expires_at <= datetime('now')
`

const completedRepoListSQL = `
	CREATE TABLE IF NOT EXISTS completed_repo_list (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		repository_name TEXT NOT NULL,
		timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
		expires_at DATETIME DEFAULT (datetime('now', '+7 days'))
	);
`

const insertCompletedRepoListSQL = `
	INSERT OR IGNORE INTO completed_repo_list (repository_name) VALUES (?);
`

const cleanupCompletedRepoListSQL = `
	DELETE FROM completed_repo_list
	WHERE expires_at <= datetime('now')
`

const selectPendingReposSQL = `
	SELECT repository_name
	FROM repo_list
	WHERE repository_name NOT IN (SELECT repository_name FROM completed_repo_list)
	ORDER BY id
`

const countRepoListSQL = `
	SELECT COUNT(1) FROM repo_list
`

func ResetRepoState(db *sql.DB) error {
	tx, err := db.Begin()
	if err != nil {
		return err
	}

	if _, err := tx.Exec("DELETE FROM repo_list"); err != nil {
		_ = tx.Rollback()
		return err
	}

	if _, err := tx.Exec("DELETE FROM completed_repo_list"); err != nil {
		_ = tx.Rollback()
		return err
	}

	return tx.Commit()
}

func SeedRepoList(db *sql.DB, repos []string) error {
	if len(repos) == 0 {
		return nil
	}

	tx, err := db.Begin()
	if err != nil {
		return err
	}

	stmt, err := tx.Prepare(insertRepoListSQL)
	if err != nil {
		_ = tx.Rollback()
		return err
	}
	defer stmt.Close()

	for _, repo := range repos {
		if _, err := stmt.Exec(repo); err != nil {
			_ = tx.Rollback()
			return err
		}
	}

	return tx.Commit()
}

func GetPendingRepos(db *sql.DB) ([]string, error) {
	rows, err := db.Query(selectPendingReposSQL)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var repos []string
	for rows.Next() {
		var repo string
		if err := rows.Scan(&repo); err != nil {
			return nil, err
		}
		repos = append(repos, repo)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return repos, nil
}

func HasRepoList(db *sql.DB) (bool, error) {
	var count int
	if err := db.QueryRow(countRepoListSQL).Scan(&count); err != nil {
		return false, err
	}

	return count > 0, nil
}

func MarkRepoCompleted(db *sql.DB, repo string) error {
	_, err := db.Exec(insertCompletedRepoListSQL, repo)
	return err
}
