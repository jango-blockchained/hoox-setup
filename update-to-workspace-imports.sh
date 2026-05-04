#!/bin/bash
# Update all imports to use @hoox/shared workspace package

echo "Updating imports in workers..."

# Update all workers to use @hoox/shared
for worker in workers/*/; do
  echo "Processing $worker..."
  find "$worker" -name "*.ts" -type f | while read file; do
    # Update type imports
    sed -i "s|from ['\"].*packages/shared/src/types['\"]|from '@hoox/shared/src/types'|g" "$file"
    sed -i "s|from ['\"].*packages/shared/src/types/|from '@hoox/shared/src/types/|g" "$file"
    
    # Update middleware imports  
    sed -i "s|from ['\"].*packages/shared/src/middleware['\"]|from '@hoox/shared/src/middleware'|g" "$file"
    sed -i "s|from ['\"].*packages/shared/src/middleware/|from '@hoox/shared/src/middleware/|g" "$file"
    
    # Update errors imports
    sed -i "s|from ['\"].*packages/shared/src/errors['\"]|from '@hoox/shared/src/errors'|g" "$file"
    
    # Update router imports
    sed -i "s|from ['\"].*packages/shared/src/router['\"]|from '@hoox/shared/src/router'|g" "$file"
    sed -i "s|from ['\"].*packages/shared/src/types/router['\"]|from '@hoox/shared/src/types/router'|g" "$file"
  done
done

echo "Updating imports in packages..."
# Update hoox-cli if it imports from shared
find packages/hoox-cli -name "*.ts" -type f 2>/dev/null | while read file; do
  sed -i "s|from ['\"].*packages/shared/src/|from '@hoox/shared/src/|g" "$file"
done

echo "All imports updated to use @hoox/shared workspace package"
