#!/bin/bash

# ==========================================================================
# Hoox Trading System Installation Wizard
# An interactive wizard to set up and deploy the Cloudflare Workers
# ==========================================================================

# Script version
WIZARD_VERSION="1.1.0"

# ANSI color codes for better readability
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Setup logging
LOG_FILE="/tmp/hoox-install-$(date +%Y%m%d-%H%M%S).log"
echo "=== Hoox Trading System Installation Wizard v${WIZARD_VERSION} ===" > "$LOG_FILE"
echo "Started at: $(date)" >> "$LOG_FILE"
echo "Working directory: $(pwd)" >> "$LOG_FILE"
echo "=================================================" >> "$LOG_FILE"

# Script variables
STATE_FILE=".install-wizard-state.json"
CURRENT_STEP=1
TOTAL_STEPS=8  # Deployment mode selection + 7 steps
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKER_DIR="$(dirname "$SCRIPT_DIR")/workers"

# Deployment mode
DEPLOYMENT_MODE=""  # "local" or "production"

# Worker selection state
declare -A selected_workers
selected_workers["webhook-receiver"]=true  # Default selection
selected_workers["trade-worker"]=false
selected_workers["telegram-worker"]=false
selected_workers["d1-worker"]=false

# Worker dependencies
declare -A worker_dependencies
worker_dependencies["webhook-receiver"]="trade-worker telegram-worker"
worker_dependencies["trade-worker"]="d1-worker"
worker_dependencies["telegram-worker"]=""
worker_dependencies["d1-worker"]=""

# Worker descriptions
declare -A worker_descriptions
worker_descriptions["webhook-receiver"]="Public-facing endpoint for TradingView signals"
worker_descriptions["trade-worker"]="Executes trades on cryptocurrency exchanges"
worker_descriptions["telegram-worker"]="Sends notifications via Telegram"
worker_descriptions["d1-worker"]="Database service for logging and persistence"

# Worker requirements - services they need
declare -A worker_services
worker_services["webhook-receiver"]="TRADE_WORKER_URL TELEGRAM_WORKER_URL"
worker_services["trade-worker"]="D1_WORKER_URL"
worker_services["telegram-worker"]=""
worker_services["d1-worker"]=""

# Variables to store user inputs
CLOUDFLARE_ACCOUNT_ID=""
D1_DATABASE_ID=""

# ======================================================
# Error handling and cleanup
# ======================================================

# Trap function for better handling of exit cases
cleanup() {
    local exit_code=$?
    
    if [ $exit_code -ne 0 ]; then
        echo -e "\n${RED}Installation wizard was interrupted or encountered an error.${NC}"
        echo -e "You can resume from where you left off by running the wizard again."
        echo -e "A detailed log is available at: ${YELLOW}$LOG_FILE${NC}"
    else
        echo -e "\nInstallation complete! Log file: ${YELLOW}$LOG_FILE${NC}"
    fi
    
    # Don't remove state file on error, so user can resume
    if [ $exit_code -eq 0 ]; then
        if [ -f "$STATE_FILE" ]; then
            rm -f "$STATE_FILE"
        fi
    fi
}

# Set up trap for clean exits
trap cleanup EXIT
trap "exit 1" SIGINT SIGTERM

# ======================================================
# Enhanced Logging Functions
# ======================================================

# Detailed logging function
log() {
    local level="$1"
    local message="$2"
    local timestamp=$(date +"%Y-%m-%d %H:%M:%S")
    
    # Write to log file
    echo "[$timestamp] [$level] $message" >> "$LOG_FILE"
}

# Print a header with logging
print_header() {
    echo -e "\n${BLUE}====================================${NC}"
    echo -e "${BLUE}${BOLD}  $1${NC}"
    echo -e "${BLUE}====================================${NC}"
    log "INFO" "===== $1 ====="
}

# Print a step with logging
print_step() {
    echo -e "\n${CYAN}[Step $CURRENT_STEP/$TOTAL_STEPS]${NC} ${BOLD}$1${NC}"
    log "STEP" "Step $CURRENT_STEP/$TOTAL_STEPS: $1"
    CURRENT_STEP=$((CURRENT_STEP + 1))
}

# Print a success message with logging
print_success() {
    echo -e "${GREEN}✅ $1${NC}"
    log "SUCCESS" "$1"
}

# Print a warning message with logging
print_warning() {
    echo -e "${YELLOW}⚠️ $1${NC}"
    log "WARNING" "$1"
}

# Print an error message with logging
print_error() {
    echo -e "${RED}❌ $1${NC}"
    log "ERROR" "$1"
}

# Print an info message with logging
print_info() {
    echo -e "$1"
    log "INFO" "$1"
}

# Displays a spinner for long-running tasks
spinner() {
    local pid=$1
    local delay=0.1
    local spinstr='|/-\'
    while ps -p $pid > /dev/null; do
        local temp=${spinstr#?}
        printf " [%c]  " "$spinstr"
        local spinstr=$temp${spinstr%"$temp"}
        sleep $delay
        printf "\b\b\b\b\b\b"
    done
    printf "    \b\b\b\b"
}

# Show progress checklist
show_checklist() {
    echo -e "\n${BLUE}Installation Progress:${NC}"
    echo -e "1. ${CURRENT_STEP > 1 ? "${GREEN}✓${NC}" : "□"} Check dependencies"
    echo -e "2. ${CURRENT_STEP > 2 ? "${GREEN}✓${NC}" : "□"} Select deployment mode"
    echo -e "3. ${CURRENT_STEP > 3 ? "${GREEN}✓${NC}" : "□"} Configure Cloudflare account ID"
    echo -e "4. ${CURRENT_STEP > 4 ? "${GREEN}✓${NC}" : "□"} Select workers"
    echo -e "5. ${CURRENT_STEP > 5 ? "${GREEN}✓${NC}" : "□"} Set up D1 database"
    echo -e "6. ${CURRENT_STEP > 6 ? "${GREEN}✓${NC}" : "□"} Configure secrets"
    echo -e "7. ${CURRENT_STEP > 7 ? "${GREEN}✓${NC}" : "□"} Configure worker URLs"
    echo -e "8. ${CURRENT_STEP > 8 ? "${GREEN}✓${NC}" : "□"} Deploy workers"
    echo -e ""
}

# ======================================================
# Helper functions
# ======================================================

# Select deployment mode (local or production)
select_deployment_mode() {
    print_step "Select deployment mode"
    
    echo -e "Choose your deployment mode:"
    echo -e "1. Local Development (for testing locally)"
    echo -e "2. Production Deployment (for deploying to Cloudflare)"
    
    local mode_selected=false
    
    while [ "$mode_selected" = false ]; do
        read -r -p "Enter your choice (1-2): " mode_choice
        
        case "$mode_choice" in
            1)
                DEPLOYMENT_MODE="local"
                echo -e "\n${GREEN}Selected mode: Local Development${NC}"
                echo -e "Workers will be configured for local testing."
                mode_selected=true
                ;;
            2)
                DEPLOYMENT_MODE="production"
                echo -e "\n${GREEN}Selected mode: Production Deployment${NC}"
                echo -e "Workers will be deployed to Cloudflare."
                mode_selected=true
                ;;
            *)
                echo -e "${RED}Invalid selection. Please choose 1 or 2.${NC}"
                ;;
        esac
    done
    
    save_state
}

# Save the current state to file
save_state() {
    log "INFO" "Saving current state to $STATE_FILE"
    
    # Create a properly formatted JSON structure
    cat > "$STATE_FILE" << EOL
{
  "current_step": $CURRENT_STEP,
  "deployment_mode": "$DEPLOYMENT_MODE",
  "account_id": "$CLOUDFLARE_ACCOUNT_ID",
  "d1_database_id": "$D1_DATABASE_ID",
  "selected_workers": {
EOL

    # Add selected workers with proper JSON formatting
    local first=true
    for worker in "${!selected_workers[@]}"; do
        if [ "$first" = false ]; then
            echo "," >> "$STATE_FILE"
        fi
        first=false
        echo "    \"$worker\": ${selected_workers[$worker]}" >> "$STATE_FILE"
    done

    # Close the JSON structure
    cat >> "$STATE_FILE" << EOL

  }
}
EOL

    # Validate the JSON if jq is available
    if command -v jq &> /dev/null; then
        if ! jq empty "$STATE_FILE" 2>/dev/null; then
            log "ERROR" "Generated invalid JSON in state file"
            print_warning "Failed to create a valid state file. Continuing without saving state."
            rm -f "$STATE_FILE"
            return 1
        fi
    fi
    
    log "INFO" "State saved successfully"
    return 0
}

# Load state from file
load_state() {
    if [ -f "$STATE_FILE" ]; then
        if command -v jq &> /dev/null; then
            CURRENT_STEP=$(jq -r '.current_step // 1' "$STATE_FILE")
            DEPLOYMENT_MODE=$(jq -r '.deployment_mode // ""' "$STATE_FILE")
            CLOUDFLARE_ACCOUNT_ID=$(jq -r '.account_id // ""' "$STATE_FILE")
            D1_DATABASE_ID=$(jq -r '.d1_database_id // ""' "$STATE_FILE")
            
            # Load selected workers
            for worker in "${!selected_workers[@]}"; do
                selected_workers[$worker]=$(jq -r ".selected_workers.\"$worker\" // false" "$STATE_FILE")
            done
            return 0
        else
            print_warning "jq not found. Cannot load saved state."
            return 1
        fi
    fi
    return 1
}

# Check for required dependencies
check_dependencies() {
    print_step "Checking dependencies"
    
    local missing_deps=false
    
    echo -e "Checking for required tools..."
    
    # Check for wrangler
    if ! command -v wrangler &> /dev/null; then
        print_error "wrangler is not installed. Please install it with 'npm install -g wrangler' or 'bun install -g wrangler'"
        missing_deps=true
    else
        print_success "wrangler is installed"
    fi
    
    # Check for bun
    if ! command -v bun &> /dev/null; then
        print_error "bun is not installed. Please install it from https://bun.sh"
        missing_deps=true
    else
        print_success "bun is installed"
    fi
    
    # Check for jq (optional but helpful)
    if ! command -v jq &> /dev/null; then
        print_warning "jq is not installed. It's recommended for state management."
        print_warning "Install with: apt-get install jq (Debian/Ubuntu) or brew install jq (macOS)"
    else
        print_success "jq is installed"
    fi
    
    # Check Cloudflare authentication
    echo -e "\nChecking Cloudflare authentication..."
    local cf_check
    cf_check=$(wrangler whoami 2>&1)
    
    if echo "$cf_check" | grep -q "You don't have any authenticated accounts"; then
        print_error "Not authenticated with Cloudflare. Please run 'wrangler login' first."
        missing_deps=true
    else
        print_success "Authenticated with Cloudflare"
    fi
    
    if [ "$missing_deps" = true ]; then
        print_error "Please install missing dependencies and try again."
        exit 1
    fi
    
    save_state
}

# Setup Cloudflare account ID
setup_cloudflare_account() {
    print_step "Setting up Cloudflare account ID"
    log "INFO" "Attempting to detect Cloudflare account ID"
    
    # Try to detect account ID automatically using multiple methods
    local detected_id=""
    
    # Method 1: Try to get from 'wrangler whoami' standard output
    print_info "Checking Cloudflare authentication..."
    local account_info
    account_info=$(wrangler whoami 2>/dev/null)
    
    if [ $? -eq 0 ] && [ -n "$account_info" ]; then
        log "INFO" "Successfully ran wrangler whoami"
        # New robust method: Extract the 32-hex ID from the table row
        detected_id=$(echo "$account_info" | grep -o '│ [a-f0-9]\{32\} │' | head -1 | tr -d '│ ')
        log "INFO" "Table row hex extraction attempt: '$detected_id'"

        # Fallback: Keep the original 32-hex search as a last resort
        if [ -z "$detected_id" ]; then
          detected_id=$(echo "$account_info" | grep -o '[a-f0-9]\{32\}' | head -1)
          log "INFO" "Fallback 32-hex search attempt: '$detected_id'"
        fi
    else
        log "WARNING" "wrangler whoami failed or returned empty output"
    fi
    
    # If we found an ID, confirm and use it
    if [ -n "$detected_id" ]; then
        echo -e "Detected Cloudflare account ID: ${YELLOW}${detected_id}${NC}"
        CLOUDFLARE_ACCOUNT_ID="$detected_id"
        print_success "Using detected account ID"
    else
        print_warning "Could not automatically detect your Cloudflare account ID"
    fi
    
    # If not detected, ask for it
    if [ -z "$CLOUDFLARE_ACCOUNT_ID" ]; then
        echo -e "\nPlease enter your Cloudflare account ID:"
        echo -e "(You can find this in your Cloudflare dashboard URL: https://dash.cloudflare.com/YOUR_ACCOUNT_ID)"
        read -r CLOUDFLARE_ACCOUNT_ID
        
        if [ -z "$CLOUDFLARE_ACCOUNT_ID" ]; then
            print_error "No account ID provided. Cannot continue."
            exit 1
        fi
    fi
    
    # Validate the account ID format (should be 32 hex characters)
    if ! [[ $CLOUDFLARE_ACCOUNT_ID =~ ^[a-f0-9]{32}$ ]]; then
        print_warning "Account ID doesn't match expected format (32 hex characters)"
        echo -e "Continue anyway? [y/N]"
        read -r proceed
        if [[ ! "$proceed" =~ ^[Yy]$ ]]; then
            print_error "Aborting setup due to invalid account ID"
            exit 1
        fi
    fi
    
    echo -e "\nUpdating account ID in worker configurations..."
    log "INFO" "Updating account ID in worker configurations: $CLOUDFLARE_ACCOUNT_ID"
    
    # Use the update-account-id.sh script
    bash "$SCRIPT_DIR/update-account-id.sh" "$CLOUDFLARE_ACCOUNT_ID"
    
    if [ $? -eq 0 ]; then
        print_success "Account ID configured successfully"
    else
        print_error "Failed to update account ID"
        exit 1
    fi
    
    save_state
}

# Display worker selection menu
select_workers() {
    log "STEP" "Setting up worker selection"
    print_step "Worker Selection"
    
    echo -e "${BLUE}Select which workers to install:${NC}"
    echo -e "The Hoox Trading System consists of multiple worker components."
    echo -e "Each component provides different functionality:\n"
    
    echo -e "  ${YELLOW}1. Basic Setup${NC} (Recommended for beginners)"
    echo -e "     Includes: ${GREEN}webhook-receiver${NC} - Main API and frontend"
    echo -e "     Best for: Users who want to quickly deploy and test the system\n"
    
    echo -e "  ${YELLOW}2. Standard Setup${NC} (Recommended for most users)"
    echo -e "     Includes: ${GREEN}webhook-receiver${NC} - Main API and frontend"
    echo -e "              ${GREEN}trade-worker${NC} - Trading strategy execution"
    echo -e "              ${GREEN}d1-worker${NC} - Database for storing configuration"
    echo -e "     Best for: Users wanting full functionality with database persistence\n"
    
    echo -e "  ${YELLOW}3. Advanced Setup${NC} (For experienced users)"
    echo -e "     Includes: ${GREEN}webhook-receiver${NC} - Main API and frontend"
    echo -e "              ${GREEN}trade-worker${NC} - Trading strategy execution"
    echo -e "              ${GREEN}d1-worker${NC} - Database for storing configuration"
    echo -e "              ${GREEN}telegram-worker${NC} - Telegram notifications"
    echo -e "     Best for: Users needing high performance and scalability\n"
    
    echo -e "  ${YELLOW}4. Custom Setup${NC} (Manual selection)"
    echo -e "     Choose individual workers to deploy"
    echo -e "     Best for: Developers and advanced users with specific needs\n"
    
    echo -e "Enter your choice (1-4):"
    read -r template_choice
    
    case $template_choice in
        1)
            # Basic Setup
            selected_workers["webhook-receiver"]=true
            selected_workers["trade-worker"]=false
            selected_workers["d1-worker"]=false
            selected_workers["telegram-worker"]=false
            ;;
        2)
            # Standard Setup
            selected_workers["webhook-receiver"]=true
            selected_workers["trade-worker"]=true
            selected_workers["d1-worker"]=true
            selected_workers["telegram-worker"]=false
            ;;
        3)
            # Advanced Setup
            selected_workers["webhook-receiver"]=true
            selected_workers["trade-worker"]=true
            selected_workers["d1-worker"]=true
            selected_workers["telegram-worker"]=true
            ;;
        4)
            # Custom Setup - manual selection
            custom_worker_selection
            ;;
        *)
            print_error "Invalid choice. Defaulting to Standard Setup."
            log "WARNING" "Invalid template choice: $template_choice. Defaulting to Standard Setup."
            selected_workers["webhook-receiver"]=true
            selected_workers["trade-worker"]=true
            selected_workers["d1-worker"]=true
            selected_workers["telegram-worker"]=false
            ;;
    esac
    
    # Check dependencies
    local dependencies_check_needed=false
    for worker in "${!selected_workers[@]}"; do
        if [ "${selected_workers[$worker]}" = true ]; then
            if [ -n "${worker_dependencies[$worker]}" ]; then
                for dep in ${worker_dependencies[$worker]}; do
                    if [ "${selected_workers[$dep]}" != true ]; then
                        dependencies_check_needed=true
                        break 2
                    fi
                done
            fi
        fi
    done
    
    if [ "$dependencies_check_needed" = true ]; then
        echo -e "\n${YELLOW}Some worker dependencies are not selected.${NC}"
        echo -e "Would you like to automatically select required dependencies? [Y/n]"
        read -r auto_select
        
        if [[ ! "$auto_select" =~ ^[Nn]$ ]]; then
            # Auto-select dependencies
            local changes_made=true
            while [ "$changes_made" = true ]; do
                changes_made=false
                for worker in "${!selected_workers[@]}"; do
                    if [ "${selected_workers[$worker]}" = true ]; then
                        for dep in ${worker_dependencies[$worker]}; do
                            if [ "${selected_workers[$dep]}" != true ]; then
                                selected_workers[$dep]=true
                                changes_made=true
                                echo -e "Auto-selected dependency: $dep (required by $worker)"
                                log "INFO" "Auto-selected dependency: $dep for $worker"
                            fi
                        done
                    fi
                done
            done
        else
            echo -e "Continuing with the current selection. Some features may not work correctly."
            log "WARNING" "User continued without selecting dependencies"
        fi
    fi
    
    # Show summary of selected workers
    echo -e "\n${BLUE}Selected Workers:${NC}"
    for worker in "${!selected_workers[@]}"; do
        if [[ ${selected_workers[$worker]} == true ]]; then
            echo -e "  ${GREEN}✓${NC} $worker"
        else
            echo -e "  ${RED}✗${NC} $worker"
        fi
    done
    
    echo -e "\nIs this selection correct? [Y/n]"
    read -r confirm
    if [[ "$confirm" =~ ^[Nn]$ ]]; then
        custom_worker_selection
    fi
    
    log "INFO" "Worker selection completed. Selected: $(for w in "${!selected_workers[@]}"; do if [[ ${selected_workers[$w]} == true ]]; then echo "$w"; fi; done | paste -sd,)"
    save_state || log "WARNING" "Failed to save state after worker selection"
}

function custom_worker_selection() {
    echo -e "\n${BLUE}Custom Worker Selection:${NC}"
    echo -e "For each worker, enter ${GREEN}y${NC} to include or ${RED}n${NC} to exclude:"
    
    echo -e "\n${YELLOW}webhook-receiver${NC} - Main API and frontend (${GREEN}Recommended${NC})"
    echo -e "This worker provides the UI and core API functionality."
    echo -e "Include webhook-receiver? [Y/n]"
    read -r choice
    if [[ "$choice" =~ ^[Nn]$ ]]; then
        selected_workers["webhook-receiver"]=false
    else
        selected_workers["webhook-receiver"]=true
    fi
    
    echo -e "\n${YELLOW}trade-worker${NC} - Trading strategy execution"
    echo -e "This worker handles the execution of trading strategies."
    echo -e "Include trade-worker? [Y/n]"
    read -r choice
    if [[ "$choice" =~ ^[Nn]$ ]]; then
        selected_workers["trade-worker"]=false
    else
        selected_workers["trade-worker"]=true
    fi
    
    echo -e "\n${YELLOW}d1-worker${NC} - Database for storing configuration"
    echo -e "This worker provides persistent storage for system configuration."
    echo -e "Include d1-worker? [Y/n]"
    read -r choice
    if [[ "$choice" =~ ^[Nn]$ ]]; then
        selected_workers["d1-worker"]=false
    else
        selected_workers["d1-worker"]=true
    fi
    
    echo -e "\n${YELLOW}telegram-worker${NC} - Telegram notifications"
    echo -e "This worker enables notifications via Telegram."
    echo -e "Include telegram-worker? [Y/n]"
    read -r choice
    if [[ "$choice" =~ ^[Nn]$ ]]; then
        selected_workers["telegram-worker"]=false
    else
        selected_workers["telegram-worker"]=true
    fi
    
    # At least one worker must be selected
    if ! [[ ${selected_workers["webhook-receiver"]} == true || ${selected_workers["trade-worker"]} == true || 
           ${selected_workers["d1-worker"]} == true || ${selected_workers["telegram-worker"]} == true ]]; then
        print_error "You must select at least one worker."
        log "ERROR" "No workers selected in custom selection"
        echo -e "Defaulting to webhook-receiver only."
        selected_workers["webhook-receiver"]=true
    fi
}

# Setup D1 database if d1-worker is selected
setup_d1_database() {
    if [ "${selected_workers[d1-worker]}" != true ]; then
        log "INFO" "D1 worker not selected, skipping database setup"
        return 0
    fi
    
    print_step "Setting up D1 database"
    log "INFO" "Beginning D1 database setup"
    
    echo -e "Checking for existing D1 database..."
    
    # Check if the database already exists
    local db_exists=false
    local db_list
    db_list=$(wrangler d1 list 2>/dev/null)
    
    if echo "$db_list" | grep -q "hoox-trading-db"; then
        db_exists=true
        print_success "D1 database 'hoox-trading-db' already exists"
        log "INFO" "Found existing hoox-trading-db database"
        
        # Extract database ID from the list - try multiple extraction methods
        D1_DATABASE_ID=$(echo "$db_list" | grep "hoox-trading-db" | awk '{print $1}')
        
        # Check if extraction failed or returned an invalid value
        if [ -z "$D1_DATABASE_ID" ] || [ "$D1_DATABASE_ID" = "│" ]; then
            print_warning "Found database but couldn't extract ID properly"
            log "WARNING" "Failed to extract database ID from list: '$D1_DATABASE_ID'"
            D1_DATABASE_ID=""
        else
            print_success "Found database ID: $D1_DATABASE_ID"
            log "SUCCESS" "Extracted database ID: $D1_DATABASE_ID"
        fi
    else
        log "INFO" "No existing database found, will create a new one"
    fi
    
    # If database doesn't exist or ID couldn't be extracted, create a new one
    if [ "$db_exists" = false ] || [ -z "$D1_DATABASE_ID" ]; then
        # Try multiple times if needed
        local max_attempts=3
        local attempt=1
        
        while [ $attempt -le $max_attempts ]; do
            echo -e "Creating D1 database 'hoox-trading-db' (attempt $attempt/$max_attempts)..."
            log "INFO" "Creating database, attempt $attempt"
            
            # Create the database
            local create_output
            create_output=$(wrangler d1 create hoox-trading-db 2>&1)
            local create_status=$?
            
            # Log the full output for debugging
            log "INFO" "Database creation output: $create_output"
            
            if [ $create_status -ne 0 ]; then
                print_warning "Attempt $attempt failed to create database"
                log "WARNING" "Database creation failed with exit code $create_status"
                
                if [ $attempt -eq $max_attempts ]; then
                    print_error "Failed to create D1 database after $max_attempts attempts"
                    echo -e "$create_output"
                    
                    # Ask user if they want to continue without D1 or try manual entry
                    echo -e "\n${YELLOW}Options:${NC}"
                    echo -e "1. Continue without D1 database (some features will not work)"
                    echo -e "2. Manually enter a database ID"
                    echo -e "3. Exit and resolve the issue manually"
                    read -r -p "Choose an option (1-3): " db_option
                    
                    case "$db_option" in
                        1)
                            print_warning "Continuing without D1 database"
                            log "WARNING" "User chose to continue without D1 database"
                            selected_workers["d1-worker"]=false
                            return 0
                            ;;
                        2)
                            echo -e "Please enter your D1 database ID:"
                            echo -e "(Run 'wrangler d1 list' in another terminal to find it)"
                            read -r D1_DATABASE_ID
                            log "INFO" "User manually entered database ID: $D1_DATABASE_ID"
                            if [ -z "$D1_DATABASE_ID" ]; then
                                print_error "No database ID provided. Cannot continue with D1 worker."
                                selected_workers["d1-worker"]=false
                                return 0
                            fi
                            break
                            ;;
                        *)
                            print_error "Exiting installation wizard"
                            log "ERROR" "User chose to exit after database creation failed"
                            exit 1
                            ;;
                    esac
                else
                    attempt=$((attempt + 1))
                    echo -e "Retrying in 3 seconds..."
                    sleep 3
                    continue
                fi
            else
                print_success "D1 database created successfully"
                log "SUCCESS" "Database created"
                
                # Try multiple extraction methods
                # Method 1: Extract from "database_id = " pattern
                D1_DATABASE_ID=$(echo "$create_output" | grep -o "database_id = \"[^\"]*\"" | sed 's/database_id = "//;s/"//') 
                log "INFO" "Method 1 extraction result: '$D1_DATABASE_ID'"
                
                # Method 2: Try UUID pattern if method 1 failed
                if [ -z "$D1_DATABASE_ID" ]; then
                    D1_DATABASE_ID=$(echo "$create_output" | grep -o "[0-9a-f]\{8\}-[0-9a-f]\{4\}-[0-9a-f]\{4\}-[0-9a-f]\{4\}-[0-9a-f]\{12\}")
                    log "INFO" "Method 2 extraction result: '$D1_DATABASE_ID'"
                fi
                
                # Method 3: Check database list if all else fails
                if [ -z "$D1_DATABASE_ID" ]; then
                    print_info "Waiting for database to register in Cloudflare..."
                    log "INFO" "Using database list as fallback"
                    sleep 3
                    db_list=$(wrangler d1 list 2>/dev/null)
                    D1_DATABASE_ID=$(echo "$db_list" | grep "hoox-trading-db" | awk '{print $1}')
                    log "INFO" "Method 3 extraction result: '$D1_DATABASE_ID'"
                fi
                
                # If all automated methods fail, ask for manual entry
                if [ -z "$D1_DATABASE_ID" ]; then
                    print_warning "Could not automatically extract database ID."
                    log "WARNING" "All automatic extraction methods failed"
                    echo -e "Please enter your D1 database ID manually:"
                    echo -e "(Run 'wrangler d1 list' in another terminal to find it)"
                    read -r D1_DATABASE_ID
                    log "INFO" "User manually entered database ID: $D1_DATABASE_ID"
                    
                    if [ -z "$D1_DATABASE_ID" ]; then
                        print_error "No database ID provided. Cannot continue with D1 worker."
                        selected_workers["d1-worker"]=false
                        return 0
                    fi
                fi
                
                break
            fi
        done
    fi
    
    # Validate the database ID format (should be a UUID)
    if ! [[ $D1_DATABASE_ID =~ ^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$ ]]; then
        print_warning "Database ID doesn't match expected UUID format: $D1_DATABASE_ID"
        log "WARNING" "Database ID doesn't match UUID format: $D1_DATABASE_ID"
        echo -e "Continue anyway? [y/N]"
        read -r proceed
        if [[ ! "$proceed" =~ ^[Yy]$ ]]; then
            print_error "Aborting D1 database setup"
            selected_workers["d1-worker"]=false
            return 0
        fi
    fi
    
    echo -e "Using Database ID: ${YELLOW}$D1_DATABASE_ID${NC}"
    log "INFO" "Using database ID: $D1_DATABASE_ID"
    
    # Update the database ID in wrangler.toml
    echo -e "Updating database ID in d1-worker/wrangler.toml..."
    
    if [ -f "$WORKER_DIR/d1-worker/wrangler.toml" ]; then
        # Make a backup just in case
        cp "$WORKER_DIR/d1-worker/wrangler.toml" "$WORKER_DIR/d1-worker/wrangler.toml.bak"
        log "INFO" "Created backup of wrangler.toml"
        
        # First check if there's a d1_databases section
        if grep -q "\[\[d1_databases\]\]" "$WORKER_DIR/d1-worker/wrangler.toml"; then
            log "INFO" "Found [[d1_databases]] section, updating database_id"
            # Use a temporary file for compatibility with macOS sed
            sed -e "/\[\[d1_databases\]\]/,/^\[/ s/database_id = \"[^\"]*\"/database_id = \"$D1_DATABASE_ID\"/" "$WORKER_DIR/d1-worker/wrangler.toml" > "$WORKER_DIR/d1-worker/wrangler.toml.tmp" && mv "$WORKER_DIR/d1-worker/wrangler.toml.tmp" "$WORKER_DIR/d1-worker/wrangler.toml"
        else
            # If no d1_databases section, check for standalone database_id
            if grep -q "database_id = " "$WORKER_DIR/d1-worker/wrangler.toml"; then
                log "INFO" "Found standalone database_id, updating"
                # Use a temporary file for compatibility with macOS sed
                sed -e "s/database_id = \"[^\"]*\"/database_id = \"$D1_DATABASE_ID\"/" "$WORKER_DIR/d1-worker/wrangler.toml" > "$WORKER_DIR/d1-worker/wrangler.toml.tmp" && mv "$WORKER_DIR/d1-worker/wrangler.toml.tmp" "$WORKER_DIR/d1-worker/wrangler.toml"
            else
                # Add the entire d1_databases section
                log "INFO" "No database config found, adding [[d1_databases]] section"
                cat >> "$WORKER_DIR/d1-worker/wrangler.toml" << EOL

[[d1_databases]]
binding = "DB"
database_name = "hoox-trading-db"
database_id = "$D1_DATABASE_ID"
EOL
            fi
        fi
    else
        print_error "d1-worker/wrangler.toml not found"
        log "ERROR" "d1-worker/wrangler.toml not found"
        echo -e "Creating basic wrangler.toml for D1 worker..."
        
        # Ensure directory exists
        mkdir -p "$WORKER_DIR/d1-worker"
        
        # Create a minimal wrangler.toml
        cat > "$WORKER_DIR/d1-worker/wrangler.toml" << EOL
name = "d1-worker"
account_id = "$CLOUDFLARE_ACCOUNT_ID"
main = "src/index.js"
compatibility_date = "2024-03-26"
compatibility_flags = ["nodejs_compat"]

[observability]
enabled = true

[[d1_databases]]
binding = "DB"
database_name = "hoox-trading-db"
database_id = "$D1_DATABASE_ID"
EOL
        print_success "Created new wrangler.toml with database configuration"
        log "SUCCESS" "Created new wrangler.toml file"
    fi
    
    # Verify the database ID was correctly updated
    if grep -q "database_id = \"$D1_DATABASE_ID\"" "$WORKER_DIR/d1-worker/wrangler.toml"; then
        print_success "Database ID updated successfully in wrangler.toml"
        log "SUCCESS" "Verified database ID in wrangler.toml"
    else
        print_error "Failed to update database ID in wrangler.toml"
        log "ERROR" "Could not verify database ID in wrangler.toml"
        echo -e "Please manually edit $WORKER_DIR/d1-worker/wrangler.toml"
        echo -e "Set database_id = \"$D1_DATABASE_ID\""
        # Ask if user wants to continue despite the error
        echo -e "Continue D1 setup? [y/N]"
        read -r proceed_verify
        if [[ ! "$proceed_verify" =~ ^[Yy]$ ]]; then
            print_error "Aborting D1 database setup due to verification failure"
            selected_workers["d1-worker"]=false
            return 0
        fi
    fi
    
    # --- Execute the database setup script --- 
    echo -e "\n${BLUE}Running database setup script...${NC}"
    log "INFO" "Executing scripts/setup-db.sh"
    
    if [ -f "$SCRIPT_DIR/setup-db.sh" ]; then
        # Make sure it's executable
        chmod +x "$SCRIPT_DIR/setup-db.sh"
        
        # Run the setup script
        bash "$SCRIPT_DIR/setup-db.sh"
        local setup_status=$?
        
        if [ $setup_status -eq 0 ]; then
            print_success "Database setup script completed successfully."
            log "SUCCESS" "setup-db.sh completed successfully"
        else
            print_error "Database setup script failed with exit code $setup_status."
            log "ERROR" "setup-db.sh failed with exit code $setup_status"
            echo -e "Check the output above for details. You may need to run the setup manually."
            # Ask if user wants to continue despite the error
            echo -e "Continue installation? [y/N]"
            read -r proceed_setup
            if [[ ! "$proceed_setup" =~ ^[Yy]$ ]]; then
                print_error "Aborting installation due to database setup failure"
                exit 1
            fi
        fi
    else
        print_warning "scripts/setup-db.sh not found. Skipping schema/migration step."
        log "WARNING" "setup-db.sh not found, skipping database schema/migration"
    fi
    # --- End of database setup script execution ---
    
    print_success "D1 database setup complete"
    log "SUCCESS" "D1 database setup completed"
    save_state
}

# Configure secrets for selected workers
configure_secrets() {
    print_step "Configuring secrets"
    
    if [ "$DEPLOYMENT_MODE" = "local" ]; then
        echo -e "Configuring local development secrets (.dev.vars files)..."
        # Call the existing script with arguments for local dev
        if [ -f "$SCRIPT_DIR/setup-secrets.sh" ]; then
            bash "$SCRIPT_DIR/setup-secrets.sh" --local
        else
            print_error "setup-secrets.sh not found"
        fi
    elif [ "$DEPLOYMENT_MODE" = "production" ]; then
        echo -e "Configuring production secrets (Cloudflare Worker Secrets)..."
        # Call the existing script with arguments for production
        if [ -f "$SCRIPT_DIR/setup-secrets.sh" ]; then
            bash "$SCRIPT_DIR/setup-secrets.sh" --production
        else
            print_error "setup-secrets.sh not found"
        fi
    else
        echo -e "Do you want to configure secrets for local development or production?"
        echo -e "1. Local development (.dev.vars files)"
        echo -e "2. Production (wrangler secrets)"
        echo -e "3. Both"
        echo -e "4. Skip this step"
        read -r -p "Choose an option (1-4): " secrets_option
        
        case "$secrets_option" in
            1|3)
                echo -e "\nConfiguring local development secrets..."
                # Call the existing script with arguments for local dev
                if [ -f "$SCRIPT_DIR/setup-secrets.sh" ]; then
                    bash "$SCRIPT_DIR/setup-secrets.sh" --local
                else
                    print_error "setup-secrets.sh not found"
                fi
                ;;
            2|3)
                echo -e "\nConfiguring production secrets..."
                # Call the existing script with arguments for production
                if [ -f "$SCRIPT_DIR/setup-secrets.sh" ]; then
                    bash "$SCRIPT_DIR/setup-secrets.sh" --production
                else
                    print_error "setup-secrets.sh not found"
                fi
                ;;
            4)
                echo -e "\nSkipping secrets configuration."
                ;;
            *)
                print_error "Invalid option. Skipping secrets configuration."
                ;;
        esac
    fi
    
    save_state
}

# Configure worker URLs for the selected workers
configure_urls() {
    print_step "Configuring worker URLs"
    
    # Check if we need to update URLs
    local need_urls=false
    for worker in "${!selected_workers[@]}"; do
        if [ "${selected_workers[$worker]}" = true ]; then
            for service in ${worker_services[$worker]}; do
                need_urls=true
                break
            done
        fi
        
        if [ "$need_urls" = true ]; then
            break
        fi
    done
    
    if [ "$need_urls" = false ]; then
        echo -e "No URL configuration needed for the selected workers."
        return 0
    fi
    
    if [ "$DEPLOYMENT_MODE" = "local" ]; then
        echo -e "Configuring local development URLs..."
        # Call the existing script
        if [ -f "$SCRIPT_DIR/update-local-urls.sh" ]; then
            bash "$SCRIPT_DIR/update-local-urls.sh"
        else
            print_error "update-local-urls.sh not found"
        fi
    elif [ "$DEPLOYMENT_MODE" = "production" ]; then
        echo -e "Configuring production URLs..."
        # Call the existing script
        if [ -f "$SCRIPT_DIR/update-urls.sh" ]; then
            bash "$SCRIPT_DIR/update-urls.sh"
        else
            print_error "update-urls.sh not found"
        fi
    else
        echo -e "Do you want to configure URLs for local development or production?"
        echo -e "1. Local development"
        echo -e "2. Production"
        echo -e "3. Both"
        echo -e "4. Skip this step"
        read -r -p "Choose an option (1-4): " url_option
        
        case "$url_option" in
            1|3)
                echo -e "\nConfiguring local development URLs..."
                # Call the existing script
                if [ -f "$SCRIPT_DIR/update-local-urls.sh" ]; then
                    bash "$SCRIPT_DIR/update-local-urls.sh"
                else
                    print_error "update-local-urls.sh not found"
                fi
                ;;
            2|3)
                echo -e "\nConfiguring production URLs..."
                # Call the existing script
                if [ -f "$SCRIPT_DIR/update-urls.sh" ]; then
                    bash "$SCRIPT_DIR/update-urls.sh"
                else
                    print_error "update-urls.sh not found"
                fi
                ;;
            4)
                echo -e "\nSkipping URL configuration."
                ;;
            *)
                print_error "Invalid option. Skipping URL configuration."
                ;;
        esac
    fi
    
    save_state
}

# Deploy the selected workers
deploy_workers() {
    print_step "Deploying selected workers"
    
    echo -e "The following workers will be deployed:"
    for worker in "${!selected_workers[@]}"; do
        if [ "${selected_workers[$worker]}" = true ]; then
            echo -e "- $worker"
        fi
    done
    
    if [ "$DEPLOYMENT_MODE" = "local" ]; then
        echo -e "\nStarting local development servers..."
        
        # Use the dev-start.sh script
        if [ -f "$SCRIPT_DIR/dev-start.sh" ]; then
            bash "$SCRIPT_DIR/dev-start.sh"
        else
            print_error "dev-start.sh not found. Cannot start local development servers."
            echo -e "You can start servers manually with 'cd workers/<worker-name> && bun run dev'"
        fi
    elif [ "$DEPLOYMENT_MODE" = "production" ]; then
        echo -e "\nDo you want to proceed with production deployment? [Y/n]"
        read -r proceed
        
        if [[ "$proceed" =~ ^[Nn]$ ]]; then
            echo -e "Deployment canceled."
            return 0
        fi
        
        echo -e "\n${BLUE}Starting deployment to Cloudflare...${NC}"
        
        # Deploy each selected worker
        local success_count=0
        local total_count=0
        
        for worker in webhook-receiver trade-worker telegram-worker d1-worker; do
            if [ "${selected_workers[$worker]}" = true ]; then
                total_count=$((total_count + 1))
                
                echo -e "\n${BLUE}Deploying $worker...${NC}"
                cd "$WORKER_DIR/$worker" || {
                    print_error "Could not change to directory: $WORKER_DIR/$worker"
                    continue
                }
                
                if [ ! -f "wrangler.toml" ]; then
                    print_error "wrangler.toml not found in $WORKER_DIR/$worker"
                    continue
                fi
                
                echo -e "Running wrangler deploy..."
                bunx wrangler deploy
                
                if [ $? -eq 0 ]; then
                    print_success "Successfully deployed $worker"
                    success_count=$((success_count + 1))
                else
                    print_error "Failed to deploy $worker"
                fi
                
                cd - > /dev/null || exit 1
            fi
        done
        
        echo -e "\n${BLUE}Deployment summary:${NC}"
        echo -e "Total workers: $total_count"
        echo -e "Successfully deployed: $success_count"
        
        if [ $success_count -eq $total_count ]; then
            print_success "All selected workers deployed successfully!"
        else
            print_warning "Some workers could not be deployed. Check the logs above for errors."
        fi
    else
        echo -e "Deployment mode not set. Please run the wizard again and select a deployment mode."
        return 1
    fi
    
    save_state
}

# Display a final success message
show_completion() {
    print_step "Installation complete"
    
    if [ "$DEPLOYMENT_MODE" = "local" ]; then
        echo -e "${GREEN}${BOLD}Local development environment setup completed!${NC}"
        echo -e ""
        echo -e "Local workers running:"
    else
        echo -e "${GREEN}${BOLD}Hoox Trading System setup completed!${NC}"
        echo -e ""
        echo -e "Deployed workers:"
    fi
    
    for worker in "${!selected_workers[@]}"; do
        if [ "${selected_workers[$worker]}" = true ]; then
            echo -e "- $worker"
        fi
    done
    
    echo -e "\nNext steps:"
    
    if [ "$DEPLOYMENT_MODE" = "local" ]; then
        echo -e "1. Test your local workers with appropriate requests"
        echo -e "2. Check the logs for each worker process"
        echo -e "3. Access local workers at the configured ports"
    else
        echo -e "1. Set up TradingView webhooks to point to your webhook-receiver"
        echo -e "2. Test the system with a simple alert"
        echo -e "3. Monitor logs in the Cloudflare dashboard"
    fi
    
    echo -e "\nThank you for using the installation wizard!"
    
    # Clean up state file
    if [ -f "$STATE_FILE" ]; then
        rm "$STATE_FILE"
    fi
}

# ======================================================
# Main execution flow
# ======================================================

# Check if there's a saved state
resume_installation=false
if load_state; then
    echo -e "\n${YELLOW}Found a saved installation state.${NC}"
    echo -e "Would you like to resume the previous installation? [Y/n]"
    read -r resume
    
    if [[ ! "$resume" =~ ^[Nn]$ ]]; then
        resume_installation=true
        echo -e "Resuming installation from step $CURRENT_STEP..."
    else
        echo -e "Starting a new installation..."
        CURRENT_STEP=1
    fi
fi

# Display welcome message
print_header "Hoox Trading System Installation Wizard"
echo -e "This wizard will guide you through the setup and deployment of the Hoox Trading System components.\n"

# Check for help flag
if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
    echo -e "Usage: $0 [OPTIONS]"
    echo -e ""
    echo -e "Options:"
    echo -e "  --help, -h     Show this help message"
    echo -e "  --non-interactive  Run in non-interactive mode with defaults"
    echo -e ""
    echo -e "This wizard will help you set up and deploy the Hoox Trading System components."
    echo -e "It guides you through worker selection, configuration, and deployment."
    exit 0
fi

# Non-interactive mode
if [ "$1" = "--non-interactive" ]; then
    echo -e "${YELLOW}Running in non-interactive mode with default settings.${NC}"
    
    # Check if deployment mode is provided
    if [ "$2" = "local" ]; then
        DEPLOYMENT_MODE="local"
        echo -e "${YELLOW}Deployment mode: Local Development${NC}"
    elif [ "$2" = "production" ]; then
        DEPLOYMENT_MODE="production"
        echo -e "${YELLOW}Deployment mode: Production Deployment${NC}"
    else
        # Default to production if not specified
        DEPLOYMENT_MODE="production"
        echo -e "${YELLOW}Deployment mode: Production Deployment (default)${NC}"
    fi
    
    # Set default selections here
    selected_workers["webhook-receiver"]=true
    selected_workers["trade-worker"]=true
    selected_workers["telegram-worker"]=true
    selected_workers["d1-worker"]=true
fi

# Main script flow
check_dependencies || exit 1

# setup_logging
# print_banner
# setup_state_file

# Resume an existing installation if available
if [ -f "$STATE_FILE" ] && [ -s "$STATE_FILE" ]; then
    echo -e "\n${BLUE}An existing installation was found.${NC}"
    echo -e "Would you like to resume the installation? [Y/n]"
    read -r response
    if [[ "$response" =~ ^[Nn]$ ]]; then
        resume_installation=false
        rm -f "$STATE_FILE"
        log "INFO" "User chose to start a new installation, deleted existing state file"
    else
        resume_installation=true
        load_state
        log "INFO" "Resuming installation from step $CURRENT_STEP"
        print_progress
    fi
else
    resume_installation=false
    log "INFO" "No existing installation found, starting fresh"
fi

if [ "$resume_installation" = false ] || [ $CURRENT_STEP -le 1 ]; then
    select_deployment_mode
fi

if [ "$resume_installation" = false ] || [ $CURRENT_STEP -le 2 ]; then
    setup_cloudflare_account
fi

if [ "$resume_installation" = false ] || [ $CURRENT_STEP -le 3 ]; then
    if [[ "$DEPLOYMENT_MODE" == "production" ]]; then
        setup_d1_database
    else
        print_step "Skipping D1 Database Setup (not needed for local development)"
        log "INFO" "Skipping D1 database setup for local deployment mode"
    fi
fi

if [ "$resume_installation" = false ] || [ $CURRENT_STEP -le 4 ]; then
    select_workers
fi

if [ "$resume_installation" = false ] || [ $CURRENT_STEP -le 5 ]; then
    if [[ "$DEPLOYMENT_MODE" == "production" ]]; then
        setup_worker_urls
    else
        print_step "Skipping Worker URLs Configuration (not needed for local development)"
        log "INFO" "Skipping worker URLs configuration for local deployment mode"
    fi
fi

if [ "$resume_installation" = false ] || [ $CURRENT_STEP -le 6 ]; then
    deploy_workers
fi

show_completion

exit 0

setup_worker_urls() {
    log "STEP" "Setting up worker URLs"
    print_step "Worker URLs Configuration"
    
    echo -e "${BLUE}Worker URLs Configuration${NC}"
    echo -e "Each worker needs a unique URL for production deployment."
    echo -e "You can use your own Cloudflare subdomain or set custom URLs.\n"
    
    # Try to auto-detect the Cloudflare account name
    local cf_account_name=""
    if [ -n "$ACCOUNT_ID" ]; then
        echo -e "Attempting to detect your Cloudflare account subdomain..."
        log "INFO" "Attempting to auto-detect Cloudflare account subdomain"
        
        # Try to get the account name from whoami
        cf_account_name=$(wrangler whoami 2>/dev/null | grep -o 'Name: [^,]*' | sed 's/Name: //' | tr '[:upper:]' '[:lower:]' | tr ' ' '-')
        
        if [ -n "$cf_account_name" ]; then
            print_success "Detected Cloudflare account: $cf_account_name"
            log "SUCCESS" "Detected Cloudflare account subdomain: $cf_account_name"
        else
            print_warning "Could not detect Cloudflare account subdomain"
            log "WARNING" "Failed to auto-detect Cloudflare account subdomain"
        fi
    fi
    
    echo -e "\n${YELLOW}Choose URL configuration method:${NC}"
    echo -e "  1. Use auto-generated URLs (recommended)"
    if [ -n "$cf_account_name" ]; then
        echo -e "     Example: webhook-receiver.$cf_account_name.workers.dev"
    else
        echo -e "     Example: webhook-receiver.your-account.workers.dev"
    fi
    echo -e "  2. Use custom URLs"
    echo -e "     Example: api.yourdomain.com"
    
    echo -e "\nEnter your choice (1-2):"
    read -r url_choice
    
    case $url_choice in
        1)
            # Auto-generated URLs
            configure_auto_generated_urls "$cf_account_name"
            ;;
        2)
            # Custom URLs
            configure_custom_urls
            ;;
        *)
            print_warning "Invalid choice. Defaulting to auto-generated URLs."
            log "WARNING" "Invalid URL configuration choice: $url_choice. Defaulting to auto-generated."
            configure_auto_generated_urls "$cf_account_name"
            ;;
    esac
    
    # Show URL configuration summary
    echo -e "\n${BLUE}Worker URL Configuration Summary:${NC}"
    for worker in "${!selected_workers[@]}"; do
        if [[ ${selected_workers[$worker]} == true ]]; then
            echo -e "  ${GREEN}✓${NC} $worker: ${worker_urls[$worker]}"
        fi
    done
    
    echo -e "\nIs this configuration correct? [Y/n]"
    read -r confirm
    if [[ "$confirm" =~ ^[Nn]$ ]]; then
        if [[ "$url_choice" == "1" ]]; then
            configure_auto_generated_urls "$cf_account_name"
        else
            configure_custom_urls
        fi
    fi
    
    log "INFO" "Worker URL configuration completed"
    
    # Update worker configurations with the URLs
    echo -e "\nUpdating worker configurations with URLs..."
    for worker in "${!selected_workers[@]}"; do
        if [[ ${selected_workers[$worker]} == true ]] && [[ -n "${worker_urls[$worker]}" ]]; then
            # Update wrangler.toml
            if [ -f "$WORKER_DIR/$worker/wrangler.toml" ]; then
                # Update routes section
                if grep -q "routes" "$WORKER_DIR/$worker/wrangler.toml"; then
                    sed -i "s|routes = \[.*\]|routes = [\"${worker_urls[$worker]}/*\"]|" "$WORKER_DIR/$worker/wrangler.toml"
                else
                    # Add routes section if it doesn't exist
                    echo -e "\nroutes = [\"${worker_urls[$worker]}/*\"]" >> "$WORKER_DIR/$worker/wrangler.toml"
                fi
                print_success "Updated URL for $worker: ${worker_urls[$worker]}"
                log "SUCCESS" "Updated wrangler.toml with URL for $worker: ${worker_urls[$worker]}"
            else
                print_warning "Could not find wrangler.toml for $worker"
                log "WARNING" "Missing wrangler.toml for $worker"
            fi
        fi
    done
    
    save_state || log "WARNING" "Failed to save state after URL configuration"
    
    CURRENT_STEP=6
    save_state
}

configure_auto_generated_urls() {
    local account_name="$1"
    
    if [ -z "$account_name" ]; then
        echo -e "Enter your Cloudflare account name (subdomain for workers.dev):"
        read -r account_name
        log "INFO" "User provided Cloudflare account name: $account_name"
    fi
    
    # Sanitize account name (lowercase, remove spaces, special chars)
    account_name=$(echo "$account_name" | tr '[:upper:]' '[:lower:]' | tr -dc 'a-z0-9-')
    
    if [ -z "$account_name" ]; then
        print_error "Invalid account name. Using 'my-account' as fallback."
        log "ERROR" "Invalid account name provided. Using fallback."
        account_name="my-account"
    fi
    
    # Set URLs for selected workers
    for worker in "${!selected_workers[@]}"; do
        if [[ ${selected_workers[$worker]} == true ]]; then
            worker_urls[$worker]="$worker.$account_name.workers.dev"
        fi
    done
    
    print_success "Auto-generated worker URLs using $account_name.workers.dev"
    log "SUCCESS" "Auto-generated worker URLs with subdomain: $account_name"
}

configure_custom_urls() {
    echo -e "\n${BLUE}Custom URL Configuration${NC}"
    echo -e "Enter a custom URL for each worker. Leave blank to use auto-generated URL.\n"
    
    for worker in "${!selected_workers[@]}"; do
        if [[ ${selected_workers[$worker]} == true ]]; then
            echo -e "${YELLOW}$worker${NC}"
            echo -e "Enter custom URL (e.g., api.yourdomain.com):"
            read -r custom_url
            
            if [ -n "$custom_url" ]; then
                # Validate URL format
                if [[ ! "$custom_url" =~ ^[a-zA-Z0-9][a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$ ]]; then
                    print_warning "Invalid URL format: $custom_url"
                    log "WARNING" "Invalid custom URL format: $custom_url"
                    echo -e "Using auto-generated URL instead."
                    worker_urls[$worker]="$worker.your-account.workers.dev"
                else
                    worker_urls[$worker]="$custom_url"
                    log "INFO" "Custom URL set for $worker: $custom_url"
                fi
            else
                worker_urls[$worker]="$worker.your-account.workers.dev"
                log "INFO" "No custom URL provided for $worker, using default"
            fi
        fi
    done
    
    print_success "Custom worker URLs configured"
} 