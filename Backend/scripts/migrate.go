package main

import (
    "bufio"
    "fmt"
    "os"
    "path/filepath"
    "sort"
    "strings"

    "intern_template_v1/middleware"
)

func main() {
    envErr := os.Setenv("DB_TMEZ", strings.TrimSpace(middleware.GetEnv("DB_TMEZ")))
    if envErr != nil {
        fmt.Printf("failed to load env: %v\n", envErr)
    }

    if middleware.ConnectDB() {
        fmt.Println("DB CONNECTION FAILED!")
        os.Exit(1)
    }

    migrationPaths, err := filepath.Glob(filepath.Join("migrations", "*.sql"))
    if err != nil {
        fmt.Printf("failed to list migrations: %v\n", err)
        os.Exit(1)
    }
    if len(migrationPaths) == 0 {
        fmt.Println("no migration files found")
        return
    }
    sort.Strings(migrationPaths)

    for _, sqlPath := range migrationPaths {
        sqlBytes, err := os.ReadFile(sqlPath)
        if err != nil {
            fmt.Printf("failed to read %s: %v\n", sqlPath, err)
            os.Exit(1)
        }
        sqlText := string(sqlBytes)
        statements := splitSQLStatements(sqlText)
        for _, stmt := range statements {
            if strings.TrimSpace(stmt) == "" {
                continue
            }
            if err := middleware.DBConn.Exec(stmt).Error; err != nil {
                fmt.Printf("migration failed (%s): %v\n", sqlPath, err)
                os.Exit(1)
            }
        }
    }

    fmt.Println("Migration completed successfully.")
}

func splitSQLStatements(sqlText string) []string {
    var statements []string
    var builder strings.Builder
    scanner := bufio.NewScanner(strings.NewReader(sqlText))

    for scanner.Scan() {
        line := scanner.Text()
        trimmed := strings.TrimSpace(line)
        if strings.HasPrefix(trimmed, "--") || trimmed == "" {
            continue
        }
        builder.WriteString(line)
        builder.WriteString("\n")
        if strings.Contains(line, ";") {
            statements = append(statements, builder.String())
            builder.Reset()
        }
    }

    if builder.Len() > 0 {
        statements = append(statements, builder.String())
    }

    return statements
}
