package database

import (
	"database/sql"

	"github.com/MishraShardendu22/github-backup/model"
)

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

const upsertRepoSQL = `
	INSERT INTO repos (name, full_name, clone_url, latest_commit_hash, last_backed_up_at, updated_at)
	VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
	ON CONFLICT(full_name) DO UPDATE SET
		name = excluded.name,
		clone_url = excluded.clone_url,
		latest_commit_hash = excluded.latest_commit_hash,
		last_backed_up_at = CURRENT_TIMESTAMP,
		updated_at = CURRENT_TIMESTAMP;
`

const selectRepoSQL = `
	SELECT id, name, full_name, clone_url, latest_commit_hash, last_backed_up_at, created_at, updated_at
	FROM repos WHERE full_name = ?
`

const selectAllReposSQL = `
	SELECT id, name, full_name, clone_url, latest_commit_hash, last_backed_up_at, created_at, updated_at
	FROM repos ORDER BY id
`

const deleteRepoSQL = `
	DELETE FROM repos WHERE full_name = ?
`

const repoStatsSQL = `
	SELECT
		COUNT(1),
		COUNT(CASE WHEN last_backed_up_at IS NOT NULL THEN 1 END),
		(SELECT COUNT(DISTINCT repository_name) FROM failed_logs),
		MAX(updated_at)
	FROM repos
`

func GetRepo(db *sql.DB, fullName string) (model.RepoRecord, bool, error) {
	var r model.RepoRecord
	err := db.QueryRow(selectRepoSQL, fullName).Scan(
		&r.ID, &r.Name, &r.FullName, &r.CloneURL,
		&r.LatestCommitHash, &r.LastBackedUpAt,
		&r.CreatedAt, &r.UpdatedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return r, false, nil
		}
		return r, false, err
	}

	return r, true, nil
}

func UpsertRepo(db *sql.DB, name, fullName, cloneURL, hash string) error {
	if fullName == "" || hash == "" {
		return nil
	}

	_, err := db.Exec(upsertRepoSQL, name, fullName, cloneURL, hash)
	return err
}

func GetAllReposFromDB(db *sql.DB) ([]model.RepoRecord, error) {
	rows, err := db.Query(selectAllReposSQL)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var repos []model.RepoRecord
	for rows.Next() {
		var r model.RepoRecord
		if err := rows.Scan(
			&r.ID, &r.Name, &r.FullName, &r.CloneURL,
			&r.LatestCommitHash, &r.LastBackedUpAt,
			&r.CreatedAt, &r.UpdatedAt,
		); err != nil {
			return nil, err
		}
		repos = append(repos, r)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return repos, nil
}

func DeleteRepo(db *sql.DB, fullName string) error {
	_, err := db.Exec(deleteRepoSQL, fullName)
	return err
}

func GetRepoStats(db *sql.DB) (model.RepoStats, error) {
	var s model.RepoStats
	err := db.QueryRow(repoStatsSQL).Scan(
		&s.TotalRepos, &s.BackedUpRepos, &s.FailedRepos, &s.LastRunAt,
	)
	return s, err
}
