#!/bin/bash
# =============================================================================
# CRITICAL: Git History Credential Purge Script
# =============================================================================
# This script removes the leaked Cloudflare API token from git history.
#
# BEFORE RUNNING:
# 1. Rotate the token on the Cloudflare dashboard FIRST
# 2. Ensure all collaborators are notified they must re-clone after force push
# 3. Back up the repo: cp -r .git .git.backup
#
# AFTER RUNNING:
# 1. Force push: git push --force --all
# 2. Force push tags: git push --force --tags
# 3. Tell all collaborators to re-clone (git pull won't work after rewrite)
# 4. Verify: git log --all -S "cfut_" should return zero results
# =============================================================================

set -euo pipefail

echo "⚠️  This script will rewrite git history to remove leaked credentials."
echo "   Make sure you have:"
echo "   1. Rotated the Cloudflare API token"
echo "   2. Backed up the repository"
echo "   3. Notified all collaborators"
echo ""
read -p "Continue? [y/N] " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 1
fi

# Check if git-filter-repo is installed
if ! command -v git-filter-repo &> /dev/null; then
    echo "❌ git-filter-repo is not installed."
    echo "   Install it: pip install git-filter-repo"
    echo "   Or: brew install git-filter-repo"
    exit 1
fi

echo "🔍 Checking for leaked credentials in history..."
RESULTS=$(git log --all -S "cfut_VeWq1O7Z" --oneline 2>/dev/null || true)
if [ -z "$RESULTS" ]; then
    echo "✅ No leaked credentials found in history. Nothing to do."
    exit 0
fi

echo "⚠️  Found leaked credentials in these commits:"
echo "$RESULTS"
echo ""

echo "🧹 Purging workers.jsonc from git history..."
# Remove workers.jsonc from all commits (it should only exist in working tree, not in history)
git filter-repo --path workers.jsonc --invert-paths --force

echo ""
echo "🔍 Verifying purge..."
REMAINING=$(git log --all -S "cfut_" --oneline 2>/dev/null || true)
if [ -z "$REMAINING" ]; then
    echo "✅ All leaked credentials have been removed from history."
else
    echo "⚠️  Some credentials may still remain:"
    echo "$REMAINING"
    echo "   You may need to run additional cleanup."
fi

echo ""
echo "📋 Next steps:"
echo "   1. git push --force --all"
echo "   2. git push --force --tags"
echo "   3. Notify collaborators to re-clone"
echo "   4. Verify no remote copies retain the old history"
