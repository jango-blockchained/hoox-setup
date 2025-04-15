#!/bin/bash

# Define colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
RESET='\033[0m'

DB_NAME="hoox-trading-db"
D1_WORKER_DIR="workers/d1-worker"
SCHEMA_FILE="${D1_WORKER_DIR}/schema.sql"
MIGRATIONS_DIR="${D1_WORKER_DIR}/migrations"

echo -e "${BLUE}=== Setting up local D1 database: ${DB_NAME} ===${RESET}\n"

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo -e "${RED}Wrangler CLI is not installed. Please install it first.${RESET}"
    echo "Install using: npm install -g wrangler" # Or bun install -g wrangler
    exit 1
fi

# Prompt user for setup method
echo -e "${YELLOW}Choose a setup method:${RESET}"
echo "  1) Execute Schema File (${SCHEMA_FILE})"
echo "  2) Create Placeholder Table (Fallback)"
echo "  3) Apply Migrations (${MIGRATIONS_DIR})"
read -p "Enter your choice (1-3): " SETUP_CHOICE

echo

case $SETUP_CHOICE in
    1)
        # --- Option 1: Execute a single schema file ---
        echo -e "${YELLOW}Executing Schema File: ${SCHEMA_FILE}...${RESET}"
        if [ ! -f "${SCHEMA_FILE}" ]; then
            echo -e "${RED}Schema file not found at ${SCHEMA_FILE}${RESET}"
            exit 1
        fi
        wrangler d1 execute ${DB_NAME} --local --file=${SCHEMA_FILE}
        if [ $? -ne 0 ]; then
            echo -e "${RED}Failed to execute schema file.${RESET}"
            exit 1
        else
            echo -e "${GREEN}Schema file executed successfully.${RESET}"
        fi
        ;;
    2)
        # --- Option 2: Create a placeholder table ---
        echo -e "${YELLOW}Creating Placeholder Table...${RESET}"
        echo "CREATE TABLE IF NOT EXISTS placeholder (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT);" | wrangler d1 execute ${DB_NAME} --local
        if [ $? -ne 0 ]; then
            echo -e "${RED}Failed to create placeholder table.${RESET}"
            exit 1
        else
            echo -e "${GREEN}Placeholder table check/creation successful.${RESET}"
        fi
        ;;
    3)
        # --- Option 3: Apply Migrations ---
        echo -e "${YELLOW}Applying D1 migrations from ${MIGRATIONS_DIR}...${RESET}"
        if [ ! -d "${MIGRATIONS_DIR}" ]; then
            echo -e "${RED}Migrations directory not found at ${MIGRATIONS_DIR}${RESET}"
            exit 1
        fi
        wrangler d1 migrations apply ${DB_NAME} --local
        if [ $? -ne 0 ]; then
            echo -e "${RED}Failed to apply D1 migrations.${RESET}"
            exit 1
        else
            echo -e "${GREEN}D1 migrations applied successfully.${RESET}"
        fi
        ;;
    *)
        echo -e "${RED}Invalid choice. Exiting.${RESET}"
        exit 1
        ;;
esac

echo -e "\n${GREEN}=== Local D1 database setup complete ===${RESET}"

exit 0 