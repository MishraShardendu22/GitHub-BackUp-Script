package database

import "database/sql"

/*
this is basically which repo was running when failed and what was hte error message.
*/
const insertLogsSQL = `
	INSERT INTO failed_logs (repository_name, error_message) VALUES (?, ?);
`

func LogFailure(db *sql.DB, repo string, failure error) error {
	if failure == nil {
		return nil
	}

	_, err := db.Exec(insertLogsSQL, repo, failure.Error())
	return err
}
