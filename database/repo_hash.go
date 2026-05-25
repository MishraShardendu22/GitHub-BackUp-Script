package database

import "database/sql"

const repoHashSQL = `
	CREATE TABLE IF NOT EXISTS repo_hashes (
		repository_name TEXT PRIMARY KEY,
		last_commit_hash TEXT NOT NULL,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		expires_at DATETIME DEFAULT (datetime('now', '+7 days'))
	);
`

const upsertRepoHashSQL = `
	INSERT INTO repo_hashes (repository_name, last_commit_hash, expires_at)
	VALUES (?, ?, datetime('now', '+7 days'))
	ON CONFLICT(repository_name) DO UPDATE SET
		last_commit_hash = excluded.last_commit_hash,
		updated_at = CURRENT_TIMESTAMP,
		expires_at = datetime('now', '+7 days');
`

const selectRepoHashSQL = `
	SELECT last_commit_hash FROM repo_hashes WHERE repository_name = ?
`

const cleanupRepoHashSQL = `
	DELETE FROM repo_hashes
	WHERE expires_at <= datetime('now')
`

func GetRepoHash(db *sql.DB, repo string) (string, bool, error) {
	var hash string
	if err := db.QueryRow(selectRepoHashSQL, repo).Scan(&hash); err != nil {
		if err == sql.ErrNoRows {
			return "", false, nil
		}
		return "", false, err
	}

	return hash, true, nil
}

func UpsertRepoHash(db *sql.DB, repo string, hash string) error {
	if repo == "" || hash == "" {
		return nil
	}

	_, err := db.Exec(upsertRepoHashSQL, repo, hash)
	return err
}
