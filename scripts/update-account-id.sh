#!/bin/bash

# Script to update the Cloudflare account ID in all worker wrangler.toml files

# ANSI color codes for better readability
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print header
echo -e "${BLUE}====================================${NC}"
echo -e "${BLUE}  Cloudflare Account ID Updater${NC}"
echo -e "${BLUE}====================================${NC}"

# Function to ask for the account ID if not provided
get_account_id() {
    local default_id=""
    
    if [ -z "$1" ]; then
        echo -e "\n${YELLOW}Please enter your Cloudflare account ID:${NC}"
        if [ -n "$default_id" ]; then
            echo -e "${YELLOW}(or press Enter to use default: ${default_id})${NC}"
        fi
        read -r input_id
        
        if [ -z "$input_id" ] && [ -n "$default_id" ]; then
            echo -e "${YELLOW}Using default account ID: ${default_id}${NC}"
            echo "$default_id"
        elif [ -z "$input_id" ] && [ -z "$default_id" ]; then
            echo -e "${RED}Error: No account ID provided${NC}"
            exit 1
        else
            echo "$input_id"
        fi
    else
        echo "$1"
    fi
}

# Function to check if wrangler.toml exists and update it
update_worker_toml() {
    local worker_name=$1
    local account_id=$2
    local worker_path="workers/$worker_name/wrangler.toml"
    
    echo -e "\n${BLUE}Processing ${worker_name}...${NC}"
    
    if [ ! -f "$worker_path" ]; then
        echo -e "${RED}Error: wrangler.toml not found in $worker_path${NC}"
        return 1
    fi
    
    # Check if account_id already exists in the file
    if grep -q "^account_id" "$worker_path"; then
        # Update existing account_id
        echo -e "${YELLOW}Updating existing account_id in $worker_path${NC}"
        sed -i "s/^account_id = \".*\"/account_id = \"$account_id\"/" "$worker_path"
    else
        # Add account_id after name line
        echo -e "${YELLOW}Adding account_id to $worker_path${NC}"
        sed -i "/^name = /a account_id = \"$account_id\"" "$worker_path"
    fi
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Successfully updated $worker_path${NC}"
        grep -n "account_id" "$worker_path" | head -1
    else
        echo -e "${RED}❌ Failed to update $worker_path${NC}"
        return 1
    fi
}

# Main function
main() {
    local account_id
    account_id=$(get_account_id "$1")
    
    echo -e "\n${BLUE}Using Cloudflare account ID: ${account_id}${NC}"
    echo -e "${BLUE}Updating all worker wrangler.toml files...${NC}"
    
    # Get list of all worker directories
    worker_dirs=$(find workers -maxdepth 1 -type d -not -path "workers" | sort)
    
    # Track success count
    success_count=0
    total_count=0
    
    # Process each worker
    for worker_path in $worker_dirs; do
        # Extract worker name from path
        worker_name=$(basename "$worker_path")
        total_count=$((total_count + 1))
        
        # Update the worker's wrangler.toml
        if update_worker_toml "$worker_name" "$account_id"; then
            success_count=$((success_count + 1))
        fi
    done
    
    # Display summary
    echo -e "\n${BLUE}====================================${NC}"
    echo -e "${BLUE}  Summary${NC}"
    echo -e "${BLUE}====================================${NC}"
    echo -e "Total workers processed: $total_count"
    echo -e "Successfully updated: $success_count"
    
    if [ $success_count -eq $total_count ]; then
        echo -e "\n${GREEN}✅ All worker wrangler.toml files have been updated successfully!${NC}"
    else
        echo -e "\n${YELLOW}⚠️ Some worker wrangler.toml files could not be updated.${NC}"
        echo -e "${YELLOW}Please check the logs above and fix any issues manually.${NC}"
    fi
}

# Run the script with first argument as account ID (optional)
main "$1"

# Make the script executable after creating it
chmod +x "$(dirname "$0")/update-account-id.sh" 