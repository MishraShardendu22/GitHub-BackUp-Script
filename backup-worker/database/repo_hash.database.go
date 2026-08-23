package database

import (
	"database/sql"
	"time"

	"github.com/MishraShardendu22/github-backup/backup-worker/model"
)

/*
Get all the details of the repo whose full name is given
*/
const selectRepoSQL = `
	SELECT id, name, full_name, clone_url, latest_commit_hash, last_backed_up_at, created_at, updated_at
	FROM repos WHERE full_name = ?
`

func parseSQLiteTime(val string) (time.Time, bool) {
	if val == "" {
		return time.Time{}, false
	}
	formats := []string{
		"2006-01-02 15:04:05",
		"2006-01-02T15:04:05Z07:00",
		time.RFC3339,
		time.RFC3339Nano,
	}
	for _, f := range formats {
		if t, err := time.Parse(f, val); err == nil {
			return t, true
		}
	}
	return time.Time{}, false
}

func GetRepo(db *sql.DB, fullName string) (model.RepoRecord, bool, error) {
	var r model.RepoRecord
	var lastBackedUpStr, createdAtStr, updatedAtStr sql.NullString
	err := db.QueryRow(selectRepoSQL, fullName).Scan(
		&r.ID, &r.Name, &r.FullName, &r.CloneURL,
		&r.LatestCommitHash, &lastBackedUpStr,
		&createdAtStr, &updatedAtStr,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return r, false, nil
		}
		return r, false, err
	}

	if lastBackedUpStr.Valid {
		if t, ok := parseSQLiteTime(lastBackedUpStr.String); ok {
			r.LastBackedUpAt = sql.NullTime{Time: t, Valid: true}
		}
	}
	if createdAtStr.Valid {
		if t, ok := parseSQLiteTime(createdAtStr.String); ok {
			r.CreatedAt = t
		}
	}
	if updatedAtStr.Valid {
		if t, ok := parseSQLiteTime(updatedAtStr.String); ok {
			r.UpdatedAt = t
		}
	}

	return r, true, nil
}

/*
Upsert basically, Insert if does not exist, update if exist.
exluded is a special SQL keyword available inside "ON CONFLICT ... DO UPDATE"
*/
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

func UpsertRepo(db *sql.DB, name, fullName, cloneURL, hash string) error {
	if fullName == "" || hash == "" {
		return nil
	}

	_, err := db.Exec(upsertRepoSQL, name, fullName, cloneURL, hash)
	return err
}

/*
get all repos quite straight forward
*/
const selectAllReposSQL = `
	SELECT id, name, full_name, clone_url, latest_commit_hash, last_backed_up_at, created_at, updated_at
	FROM repos ORDER BY id
`

func GetAllReposFromDB(db *sql.DB) ([]model.RepoRecord, error) {
	rows, err := db.Query(selectAllReposSQL)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var repos []model.RepoRecord
	for rows.Next() {
		var r model.RepoRecord
		var lastBackedUpStr, createdAtStr, updatedAtStr sql.NullString
		if err := rows.Scan(
			&r.ID, &r.Name, &r.FullName, &r.CloneURL,
			&r.LatestCommitHash, &lastBackedUpStr,
			&createdAtStr, &updatedAtStr,
		); err != nil {
			return nil, err
		}

		if lastBackedUpStr.Valid {
			if t, ok := parseSQLiteTime(lastBackedUpStr.String); ok {
				r.LastBackedUpAt = sql.NullTime{Time: t, Valid: true}
			}
		}
		if createdAtStr.Valid {
			if t, ok := parseSQLiteTime(createdAtStr.String); ok {
				r.CreatedAt = t
			}
		}
		if updatedAtStr.Valid {
			if t, ok := parseSQLiteTime(updatedAtStr.String); ok {
				r.UpdatedAt = t
			}
		}

		repos = append(repos, r)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return repos, nil
}

/*
delete repos whose name is given
*/
const deleteRepoSQL = `
	DELETE FROM repos WHERE full_name = ?
`

func DeleteRepo(db *sql.DB, fullName string) error {
	_, err := db.Exec(deleteRepoSQL, fullName)
	return err
}

/*
Get repo stats
1. COUNT(1) = Count all rows in the repos table (basically totall discovered repos)
2. COUNT(CASE WHEN last_backed_up_at IS NOT NULL THEN 1 END) = Count the repos successfully backed up
3. (SELECT COUNT(DISTINCT repository_name) FROM failed_logs) = Count the repos that failed
4. MAX(updated_at) = Last updated time basically
*/
const repoStatsSQL = `
	SELECT
		COUNT(1),
		COUNT(CASE WHEN last_backed_up_at IS NOT NULL THEN 1 END),
		(SELECT COUNT(DISTINCT repository_name) FROM failed_logs),
		COALESCE(MAX(updated_at), '')
	FROM repos
`

func GetRepoStats(db *sql.DB) (model.RepoStats, error) {
	var s model.RepoStats
	var lastRunStr sql.NullString
	err := db.QueryRow(repoStatsSQL).Scan(
		&s.TotalRepos, &s.BackedUpRepos, &s.FailedRepos, &lastRunStr,
	)
	if err != nil {
		return s, err
	}
	if lastRunStr.Valid && lastRunStr.String != "" {
		if t, ok := parseSQLiteTime(lastRunStr.String); ok {
			s.LastRunAt = sql.NullTime{Time: t, Valid: true}
		}
	}
	return s, nil
}
