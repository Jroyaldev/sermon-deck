#!/usr/bin/env bash

# SermonFlow Development Environment Setup Script
# This script automates the initial setup of the SermonFlow development environment.
# It checks dependencies, installs packages, sets up the database, and provides next steps.

# Set strict error handling
set -e

# Colors for pretty output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Log functions
log_info() {
    echo -e "${BLUE}INFO:${NC} $1"
}

log_success() {
    echo -e "${GREEN}SUCCESS:${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}WARNING:${NC} $1"
}

log_error() {
    echo -e "${RED}ERROR:${NC} $1" >&2
}

print_header() {
    echo -e "\n${BOLD}$1${NC}"
    echo -e "${BOLD}$(printf '=%.0s' $(seq 1 ${#1}))${NC}\n"
}

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check version meets minimum requirement
version_gte() {
    # $1 = version to check, $2 = minimum version
    printf '%s\n%s\n' "$2" "$1" | sort -V -C
}

# Function to check if PostgreSQL is running
is_postgres_running() {
    if command_exists pg_isready; then
        if pg_isready -q; then
            return 0
        else
            return 1
        fi
    else
        # Try psql as a fallback
        if command_exists psql; then
            if psql -c '\q' postgres >/dev/null 2>&1; then
                return 0
            else
                return 1
            fi
        else
            return 1
        fi
    fi
}

# Function to create database if it doesn't exist
create_database_if_not_exists() {
    local db_name="sermonflow"
    
    log_info "Checking if database '$db_name' exists..."
    
    if psql -lqt | cut -d \| -f 1 | grep -qw "$db_name"; then
        log_info "Database '$db_name' already exists."
    else
        log_info "Creating database '$db_name'..."
        createdb "$db_name"
        log_success "Database '$db_name' created successfully."
    fi
}

# Function to enable pgvector extension
enable_pgvector() {
    local db_name="sermonflow"
    
    log_info "Enabling pgvector extension in '$db_name'..."
    
    if psql -d "$db_name" -c "CREATE EXTENSION IF NOT EXISTS vector;" 2>/dev/null; then
        log_success "pgvector extension enabled successfully."
    else
        log_error "Failed to enable pgvector extension. Please install it manually."
        log_info "You can try: 'sudo apt install postgresql-15-pgvector' on Ubuntu/Debian"
        log_info "or 'brew install pgvector' on macOS."
        exit 1
    fi
}

# Function to check if .env file exists and create it if not
setup_env_file() {
    if [ -f "$PROJECT_ROOT/.env" ]; then
        log_info ".env file already exists. Skipping creation."
    else
        log_info "Creating .env file from template..."
        cp "$PROJECT_ROOT/.env.example" "$PROJECT_ROOT/.env"
        
        # Generate random JWT secrets
        JWT_SECRET=$(openssl rand -hex 32)
        REFRESH_TOKEN_SECRET=$(openssl rand -hex 32)
        
        # Update .env file with generated secrets and database URL
        sed -i.bak "s/JWT_SECRET=your-super-secret-jwt-key-min-32-chars/JWT_SECRET=$JWT_SECRET/" "$PROJECT_ROOT/.env"
        sed -i.bak "s/REFRESH_TOKEN_SECRET=another-secret-key-min-32-chars/REFRESH_TOKEN_SECRET=$REFRESH_TOKEN_SECRET/" "$PROJECT_ROOT/.env"
        
        # Clean up backup files
        rm -f "$PROJECT_ROOT/.env.bak"
        
        log_success ".env file created with secure JWT secrets."
        log_warning "Please review the .env file and update other values as needed, especially:"
        log_warning "- DATABASE_URL (currently set to postgresql://postgres:password@localhost:5432/sermonflow)"
        log_warning "- OPENAI_API_KEY (required for AI features)"
    fi
}

# Main script execution starts here
clear
echo -e "${BOLD}${GREEN}"
echo "   _____                                 ______ _                 "
echo "  / ____|                               |  ____| |                "
echo " | (___   ___ _ __ _ __ ___   ___  _ __ | |__  | | _____      __ "
echo "  \___ \ / _ \ '__| '_ \` _ \ / _ \| '_ \|  __| | |/ _ \ \ /\ / / "
echo "  ____) |  __/ |  | | | | | | (_) | | | | |    | | (_) \ V  V /  "
echo " |_____/ \___|_|  |_| |_| |_|\___/|_| |_|_|    |_|\___/ \_/\_/   "
echo -e "${NC}"
echo -e "${BOLD}Development Environment Setup${NC}\n"

log_info "Setting up SermonFlow development environment..."

# Check for required dependencies
print_header "Checking Dependencies"

# Check Node.js
if command_exists node; then
    NODE_VERSION=$(node -v | cut -d 'v' -f 2)
    log_info "Node.js found: v$NODE_VERSION"
    
    if version_gte "$NODE_VERSION" "18.17.0"; then
        log_success "Node.js version meets requirements (≥ 18.17.0)"
    else
        log_error "Node.js version is too old. Please install v18.17.0 or newer."
        log_info "We recommend using nvm: https://github.com/nvm-sh/nvm"
        exit 1
    fi
else
    log_error "Node.js not found. Please install Node.js v18.17.0 or newer."
    log_info "We recommend using nvm: https://github.com/nvm-sh/nvm"
    exit 1
fi

# Check pnpm
if command_exists pnpm; then
    PNPM_VERSION=$(pnpm -v)
    log_info "pnpm found: v$PNPM_VERSION"
    
    if version_gte "$PNPM_VERSION" "8.0.0"; then
        log_success "pnpm version meets requirements (≥ 8.0.0)"
    else
        log_warning "pnpm version is older than recommended. Please consider upgrading to v8.0.0 or newer."
        log_info "You can upgrade with: 'npm install -g pnpm@latest'"
    fi
else
    log_error "pnpm not found. Please install pnpm v8.0.0 or newer."
    log_info "You can install with: 'npm install -g pnpm'"
    exit 1
fi

# Check PostgreSQL
if command_exists psql; then
    PSQL_VERSION=$(psql --version | awk '{print $3}')
    log_info "PostgreSQL client found: v$PSQL_VERSION"
    
    if version_gte "$PSQL_VERSION" "15.0"; then
        log_success "PostgreSQL version meets requirements (≥ 15.0)"
    else
        log_warning "PostgreSQL version is older than recommended. Some features may not work correctly."
    fi
    
    # Check if PostgreSQL server is running
    if is_postgres_running; then
        log_success "PostgreSQL server is running."
    else
        log_error "PostgreSQL server is not running. Please start it before continuing."
        log_info "On macOS: brew services start postgresql@15"
        log_info "On Linux: sudo service postgresql start"
        log_info "On Windows: Start PostgreSQL service from Services"
        
        read -p "Do you want to continue anyway? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
else
    log_error "PostgreSQL client (psql) not found. Please install PostgreSQL v15.0 or newer."
    log_info "Visit: https://www.postgresql.org/download/"
    
    read -p "Do you want to continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Check Docker (optional)
if command_exists docker; then
    DOCKER_VERSION=$(docker --version | awk '{print $3}' | sed 's/,//')
    log_info "Docker found: v$DOCKER_VERSION"
    
    if version_gte "$DOCKER_VERSION" "24.0.0"; then
        log_success "Docker version meets requirements (≥ 24.0.0)"
    else
        log_warning "Docker version is older than recommended. Consider upgrading for better compatibility."
    fi
else
    log_warning "Docker not found. This is optional but recommended for containerized development."
    log_info "Visit: https://docs.docker.com/get-docker/"
fi

# Install dependencies
print_header "Installing Dependencies"

log_info "Installing project dependencies with pnpm..."
cd "$PROJECT_ROOT"
pnpm install
log_success "Dependencies installed successfully."

# Set up environment variables
print_header "Setting Up Environment"

setup_env_file

# Set up database
print_header "Setting Up Database"

# Only proceed with database setup if PostgreSQL is available
if command_exists psql && is_postgres_running; then
    # Create database if it doesn't exist
    create_database_if_not_exists
    
    # Enable pgvector extension
    enable_pgvector
    
    # Run Prisma migrations
    log_info "Running database migrations..."
    cd "$PROJECT_ROOT"
    pnpm prisma migrate dev --name init
    log_success "Database migrations completed successfully."
    
    # Generate Prisma client
    log_info "Generating Prisma client..."
    pnpm prisma generate
    log_success "Prisma client generated successfully."
    
    # Ask if user wants to seed the database
    read -p "Do you want to seed the database with sample data? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        log_info "Seeding database..."
        pnpm --filter @sermonflow/api run db:seed
        log_success "Database seeded successfully."
    else
        log_info "Skipping database seeding."
    fi
else
    log_warning "Skipping database setup as PostgreSQL is not available or not running."
    log_warning "You'll need to set up the database manually later."
fi

# Verify setup
print_header "Verifying Setup"

log_info "Checking project structure..."
if [ -d "$PROJECT_ROOT/apps" ] && [ -d "$PROJECT_ROOT/packages" ] && [ -d "$PROJECT_ROOT/prisma" ]; then
    log_success "Project structure looks good."
else
    log_error "Project structure seems incomplete. Please check your repository."
fi

log_info "Checking compiled packages..."
if [ -d "$PROJECT_ROOT/node_modules/.pnpm" ]; then
    log_success "Package compilation looks good."
else
    log_warning "Package compilation might have issues. Try running 'pnpm install' manually."
fi

# Next steps
print_header "Next Steps"

echo -e "${GREEN}SermonFlow development environment setup completed!${NC}"
echo
echo -e "${BOLD}To start the development servers:${NC}"
echo -e "  ${BLUE}pnpm dev${NC}               # Starts all services"
echo -e "  ${BLUE}pnpm --filter @sermonflow/api dev${NC}  # API server only"
echo -e "  ${BLUE}pnpm --filter @sermonflow/web dev${NC}  # Web app only"
echo
echo -e "${BOLD}Useful commands:${NC}"
echo -e "  ${BLUE}pnpm prisma studio${NC}     # Visual database explorer"
echo -e "  ${BLUE}pnpm test${NC}              # Run tests"
echo -e "  ${BLUE}pnpm lint${NC}              # Run linters"
echo
echo -e "${BOLD}API Documentation:${NC}"
echo -e "  ${BLUE}http://localhost:3000/api/docs${NC}  # When API server is running"
echo
echo -e "${BOLD}For more information:${NC}"
echo -e "  ${BLUE}docs/SETUP.md${NC}          # Detailed setup guide"
echo -e "  ${BLUE}docs/ARCHITECTURE.md${NC}   # System architecture"
echo

log_success "Happy coding! 🕊️"
