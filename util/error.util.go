package util

import (
	"log"

	"os"
)

func ErrorHandler(err error) {
	if err == nil {
		return
	}

	log.Printf("fatal error: %v\n", err)
	os.Exit(1)

}
