package database

import (
	"database/sql"

	"github.com/MishraShardendu22/github-backup/model"
	"github.com/MishraShardendu22/github-backup/util"
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

