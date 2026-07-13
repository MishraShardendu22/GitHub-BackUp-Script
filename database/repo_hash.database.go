package database

import (
	"database/sql"

	"github.com/MishraShardendu22/github-backup/model"
)

/*
Get all the details of the repo whose full name is given
*/ 
const selectRepoSQL = `
	SELECT id, name, full_name, clone_url, latest_commit_hash, last_backed_up_at, created_at, updated_at
	FROM repos WHERE full_name = ?
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

