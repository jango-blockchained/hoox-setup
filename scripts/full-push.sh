#!/bin/bash
set -e

MAX_RETRIES=5
COMMIT_MSG="${1:-Update submodule}"

echo "=== Full Push: Committing submodules and main repo ==="

# Get list of submodules
SUBMODULES=$(git submodule foreach --quiet 'echo $path')

commit_and_push() {
    local repo_path=$1
    local retry=0
    local success=false
    
    while [ $retry -lt $MAX_RETRIES ] && [ "$success" = "false" ]; do
        echo "[$repo_path] Attempt $(($retry + 1))/$MAX_RETRIES..."
        
        # Check for changes
        cd "$repo_path"
        if git diff --quiet && git diff --cached --quiet; then
            echo "[$repo_path] No changes to commit"
            cd ../..
            return 0
        fi
        
        # Stage all changes
        git add -A
        
        # Commit
        git commit -m "$COMMIT_MSG" 2>/dev/null && {
            # Push with retries
            for ((push_retry=0; push_retry<MAX_RETRIES; push_retry++)); do
                if git push origin HEAD 2>/dev/null; then
                    echo "[$repo_path] ✅ Pushed successfully"
                    success=true
                    break
                else
                    echo "[$repo_path] Push retry $(($push_retry + 1))/$MAX_RETRIES..."
                    sleep 2
                fi
            done
        } || {
            echo "[$repo_path] No changes to commit (already up to date or commit failed)"
            success=true
        }
        
        cd ../..
        retry=$(($retry + 1))
    done
    
    if [ "$success" = "false" ]; then
        echo "[$repo_path] ❌ Failed after $MAX_RETRIES attempts"
        return 1
    fi
    return 0
}

FAILED=0
for submod in $SUBMODULES; do
    commit_and_push "$submod" || FAILED=1
done

if [ $FAILED -eq 1 ]; then
    echo "❌ Some submodules failed to push"
    exit 1
fi

echo "=== All submodules pushed. Now pushing main repo ==="

# Update submodules in main repo
git add $SUBMODULES
git commit -m "$COMMIT_MSG: update submodules" 2>/dev/null || echo "No main repo changes to commit"

# Push main repo with retries
for ((retry=0; retry<MAX_RETRIES; retry++)); do
    if git push origin main 2>/dev/null; then
        echo "✅ Main repo pushed successfully"
        exit 0
    fi
    echo "Main repo push retry $(($retry + 1))/$MAX_RETRIES..."
    sleep 2
done

echo "❌ Main repo push failed after $MAX_RETRIES attempts"
exit 1