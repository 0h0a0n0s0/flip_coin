#!/bin/bash

# Monorepo Refactoring Script
# This script migrates the project to a Pnpm Workspace + Turborepo structure
# All moves use `git mv` to preserve Git history

set -e  # Exit on error

echo "🚀 Starting Monorepo Refactoring..."
echo ""

# Color codes for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to print colored messages
print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    print_error "Not a git repository. Please initialize git first."
    exit 1
fi

# Phase 1: Create directory structure
echo "📁 Phase 1: Creating directory structure..."
mkdir -p apps packages/database packages/ui services/wallet
print_success "Directory structure created"

# Phase 2: Move apps
echo ""
echo "📦 Phase 2: Moving apps..."

# Move frontend-vue3 -> apps/web
if [ -d "frontend-vue3" ]; then
    echo "  Moving frontend-vue3 -> apps/web..."
    git mv frontend-vue3 apps/web
    print_success "frontend-vue3 moved to apps/web"
    
    # Update package.json name
    if [ -f "apps/web/package.json" ]; then
        sed -i.bak 's/"name": "flip-coin-frontend"/"name": "@flipcoin\/web"/' apps/web/package.json
        rm apps/web/package.json.bak
        print_success "Updated apps/web/package.json name to @flipcoin/web"
    fi
else
    print_warning "frontend-vue3 directory not found, skipping..."
fi

# Move admin-ui -> apps/admin
if [ -d "admin-ui" ]; then
    echo "  Moving admin-ui -> apps/admin..."
    git mv admin-ui apps/admin
    print_success "admin-ui moved to apps/admin"
    
    # Update package.json name
    if [ -f "apps/admin/package.json" ]; then
        sed -i.bak 's/"name": "admin-ui"/"name": "@flipcoin\/admin"/' apps/admin/package.json
        rm apps/admin/package.json.bak
        print_success "Updated apps/admin/package.json name to @flipcoin/admin"
    fi
else
    print_warning "admin-ui directory not found, skipping..."
fi

# Move backend -> apps/backend-legacy
if [ -d "backend" ]; then
    echo "  Moving backend -> apps/backend-legacy..."
    git mv backend apps/backend-legacy
    print_success "backend moved to apps/backend-legacy"
    
    # Update package.json name
    if [ -f "apps/backend-legacy/package.json" ]; then
        sed -i.bak 's/"name": "backend"/"name": "@flipcoin\/backend-legacy"/' apps/backend-legacy/package.json
        rm apps/backend-legacy/package.json.bak
        print_success "Updated apps/backend-legacy/package.json name to @flipcoin/backend-legacy"
    fi
else
    print_error "backend directory not found! Cannot proceed."
    exit 1
fi

# Phase 3: Create packages/database
echo ""
echo "📚 Phase 3: Setting up packages/database..."

# Move db.js to packages/database
if [ -f "apps/backend-legacy/db.js" ]; then
    echo "  Moving db.js -> packages/database/index.js..."
    git mv apps/backend-legacy/db.js packages/database/index.js
    print_success "db.js moved to packages/database/index.js"
else
    print_warning "db.js not found, creating placeholder..."
    touch packages/database/index.js
    git add packages/database/index.js
fi

# Move migrations directory
if [ -d "apps/backend-legacy/migrations" ]; then
    echo "  Moving migrations -> packages/database/migrations..."
    git mv apps/backend-legacy/migrations packages/database/migrations
    print_success "migrations moved to packages/database/migrations"
fi

# Create packages/database/package.json
cat > packages/database/package.json << 'EOF'
{
  "name": "@flipcoin/database",
  "version": "1.0.0",
  "description": "Database connection and migration utilities",
  "main": "index.js",
  "private": true,
  "dependencies": {
    "pg": "^8.16.3"
  }
}
EOF
git add packages/database/package.json
print_success "Created packages/database/package.json"

# Phase 4: Create packages/ui
echo ""
echo "🎨 Phase 4: Setting up packages/ui..."

cat > packages/ui/package.json << 'EOF'
{
  "name": "@flipcoin/ui",
  "version": "1.0.0",
  "description": "Shared UI components and design system",
  "private": true,
  "dependencies": {}
}
EOF
git add packages/ui/package.json
print_success "Created packages/ui/package.json"

# Phase 5: Create services/wallet
echo ""
echo "🔐 Phase 5: Setting up services/wallet..."

cat > services/wallet/package.json << 'EOF'
{
  "name": "@flipcoin/service-wallet",
  "version": "1.0.0",
  "description": "Wallet service - HIGH SECURITY ZONE",
  "private": true,
  "dependencies": {}
}
EOF
git add services/wallet/package.json
print_success "Created services/wallet/package.json"

# Phase 6: Update dependencies in apps/backend-legacy
echo ""
echo "🔗 Phase 6: Updating dependencies..."

# Update apps/backend-legacy/package.json to include @flipcoin/database
if [ -f "apps/backend-legacy/package.json" ]; then
    # Check if dependencies section exists
    if grep -q '"dependencies"' apps/backend-legacy/package.json; then
        # Add @flipcoin/database to dependencies if not already present
        if ! grep -q '"@flipcoin/database"' apps/backend-legacy/package.json; then
            # Use a temporary file to add the dependency
            node << 'NODE_SCRIPT'
const fs = require('fs');
const path = 'apps/backend-legacy/package.json';
const pkg = JSON.parse(fs.readFileSync(path, 'utf8'));
pkg.dependencies = pkg.dependencies || {};
pkg.dependencies['@flipcoin/database'] = 'workspace:*';
fs.writeFileSync(path, JSON.stringify(pkg, null, 2) + '\n');
NODE_SCRIPT
            print_success "Added @flipcoin/database to apps/backend-legacy/package.json dependencies"
        else
            print_warning "@flipcoin/database already in dependencies"
        fi
    fi
fi

# Phase 7: Update require statements in apps/backend-legacy
echo ""
echo "📝 Phase 7: Updating require statements..."

# Find and replace require('./db') with require('@flipcoin/database')
find apps/backend-legacy -type f \( -name "*.js" -o -name "*.ts" \) -exec sed -i.bak \
    -e "s/require(['\"]\.\/db['\"])/require('@flipcoin\/database')/g" \
    -e "s/require(['\"]\.\.\/db['\"])/require('@flipcoin\/database')/g" \
    -e "s/require(['\"]\.\.\/\.\.\/db['\"])/require('@flipcoin\/database')/g" \
    -e "s/from ['\"]\.\/db['\"]/from '@flipcoin\/database'/g" \
    -e "s/from ['\"]\.\.\/db['\"]/from '@flipcoin\/database'/g" \
    -e "s/from ['\"]\.\.\/\.\.\/db['\"]/from '@flipcoin\/database'/g" \
    {} \;

# Remove backup files
find apps/backend-legacy -name "*.bak" -delete
print_success "Updated require/import statements in apps/backend-legacy"

# Phase 8: Create root package.json if it doesn't exist
echo ""
echo "📋 Phase 8: Setting up root package.json..."

if [ ! -f "package.json" ]; then
    cat > package.json << 'EOF'
{
  "name": "flip-coin-monorepo",
  "version": "1.0.0",
  "private": true,
  "description": "Flip Coin Monorepo",
  "workspaces": [
    "apps/*",
    "packages/*",
    "services/*"
  ],
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "lint": "turbo run lint"
  },
  "devDependencies": {
    "turbo": "^2.0.0"
  },
  "engines": {
    "node": ">=18.0.0",
    "pnpm": ">=8.0.0"
  }
}
EOF
    git add package.json
    print_success "Created root package.json"
else
    # Update existing package.json to include turbo
    if ! grep -q '"turbo"' package.json; then
        node << 'NODE_SCRIPT'
const fs = require('fs');
const path = 'package.json';
const pkg = JSON.parse(fs.readFileSync(path, 'utf8'));
pkg.devDependencies = pkg.devDependencies || {};
pkg.devDependencies.turbo = '^2.0.0';
fs.writeFileSync(path, JSON.stringify(pkg, null, 2) + '\n');
NODE_SCRIPT
        print_success "Added turbo to root package.json devDependencies"
    else
        print_warning "turbo already in root package.json"
    fi
fi

# Phase 9: Summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Refactoring Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📦 New Structure:"
echo "  apps/"
echo "    ├── web/              (@flipcoin/web)"
echo "    ├── admin/            (@flipcoin/admin)"
echo "    └── backend-legacy/   (@flipcoin/backend-legacy)"
echo ""
echo "  packages/"
echo "    ├── database/         (@flipcoin/database)"
echo "    └── ui/               (@flipcoin/ui)"
echo ""
echo "  services/"
echo "    └── wallet/           (@flipcoin/service-wallet)"
echo ""
echo "⚠️  Next Steps:"
echo "  1. Review the changes: git status"
echo "  2. Test the build: pnpm install && pnpm build"
echo "  3. Commit the changes: git commit -m 'refactor: migrate to monorepo structure'"
echo ""
echo "📝 Note: All file moves used 'git mv' to preserve Git history."
echo ""

