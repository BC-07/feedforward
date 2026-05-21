package middleware

import (
	"log"
	"os"
	"path/filepath"
	"sync"

	"github.com/joho/godotenv"
)

var envOnce sync.Once
var envLoadErr error

func loadEnvOnce() {
	candidates := []string{
		".env",
		filepath.Join("Backend", ".env"),
	}

	for _, path := range candidates {
		if _, err := os.Stat(path); err == nil {
			if err := godotenv.Load(path); err != nil {
				envLoadErr = err
			}
			return
		}
	}

	// No env file found; allow OS-level env vars.
	envLoadErr = nil
}

func GetEnv(key string) string {
	envOnce.Do(loadEnvOnce)
	if envLoadErr != nil {
		log.Printf("warning: failed to load .env file: %v", envLoadErr)
	}
	return os.Getenv(key)
}
