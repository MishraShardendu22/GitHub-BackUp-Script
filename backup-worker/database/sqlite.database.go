package database

import (
	"database/sql"

	"github.com/MishraShardendu22/github-backup/backup-worker/model"
	"github.com/MishraShardendu22/github-backup/backup-worker/util"
	_ "github.com/mattn/go-sqlite3"
	"go.uber.org/zap"
)

func ConnectSQLite(config *model.ConfigModel) (*sql.DB, error) {
	dbPath := config.DBPath
	if dbPath == "" {
		dbPath = "./app.db"
	}

	db, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		return nil, err
	}

	if err := db.Ping(); err != nil {
		_ = db.Close()
		return nil, err
	}

	util.Logger().Info("Database connected",
		zap.String("path", dbPath),
	)

	return db, nil
}

/*
Checkpoint forces SQLite to flush all pending transactions from the write-ahead
log (app.db-wal) into the primary app.db file and truncate the WAL file.
This guarantees that app.db contains 100% of latest records before committing to Git.
*/
func Checkpoint(db *sql.DB) error {
	if db == nil {
		return nil
	}
	_, err := db.Exec("PRAGMA wal_checkpoint(TRUNCATE);")
	return err
}
