#!/bin/bash
set -e

cd /home/jango/Git/hoox-setup

OUTPUT_FILE="/tmp/test-results.txt"
> "$OUTPUT_FILE"

echo "================================================================================" >> "$OUTPUT_FILE"
echo "BUILD VALIDATION REPORT" >> "$OUTPUT_FILE"
echo "================================================================================" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# 1. Run the specific test file
echo "[1/3] Running: bun test packages/shared/src/path-utils.test.ts" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

if bun test packages/shared/src/path-utils.test.ts >> "$OUTPUT_FILE" 2>&1; then
  TEST_PASS=true
else
  TEST_PASS=false
fi

# 2. Check coverage output
echo "" >> "$OUTPUT_FILE"
echo "[2/3] Checking Coverage Output" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

if [ -f "coverage/coverage-summary.json" ]; then
  echo "Coverage Summary:" >> "$OUTPUT_FILE"
  cat coverage/coverage-summary.json | jq '.total | "  Statements: \(.statements.pct)%\n  Branches:   \(.branches.pct)%\n  Functions:  \(.functions.pct)%\n  Lines:      \(.lines.pct)%"' -r >> "$OUTPUT_FILE" 2>&1 || echo "Could not parse coverage" >> "$OUTPUT_FILE"
else
  echo "Coverage summary not found" >> "$OUTPUT_FILE"
fi

# 3. Run typecheck
echo "" >> "$OUTPUT_FILE"
echo "[3/3] Running: bun run typecheck" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

if bun run typecheck >> "$OUTPUT_FILE" 2>&1; then
  TYPECHECK_PASS=true
else
  TYPECHECK_PASS=false
fi

# Final summary
echo "" >> "$OUTPUT_FILE"
echo "================================================================================" >> "$OUTPUT_FILE"
echo "FINAL REPORT" >> "$OUTPUT_FILE"
echo "================================================================================" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

if [ "$TEST_PASS" = true ]; then
  echo "Test Status:      ✓ PASS" >> "$OUTPUT_FILE"
else
  echo "Test Status:      ✗ FAIL" >> "$OUTPUT_FILE"
fi

if [ "$TYPECHECK_PASS" = true ]; then
  echo "Typecheck Status: ✓ PASS" >> "$OUTPUT_FILE"
else
  echo "Typecheck Status: ✗ FAIL" >> "$OUTPUT_FILE"
fi

if [ -f "coverage/coverage-summary.json" ]; then
  echo "" >> "$OUTPUT_FILE"
  echo "Coverage Metrics:" >> "$OUTPUT_FILE"
  cat coverage/coverage-summary.json | jq '.total | "  Statements: \(.statements.pct)%\n  Branches:   \(.branches.pct)%\n  Functions:  \(.functions.pct)%\n  Lines:      \(.lines.pct)%"' -r >> "$OUTPUT_FILE" 2>&1 || true
fi

if [ "$TEST_PASS" = true ] && [ "$TYPECHECK_PASS" = true ]; then
  echo "" >> "$OUTPUT_FILE"
  echo "Overall Status:   ✓ SUCCESS" >> "$OUTPUT_FILE"
else
  echo "" >> "$OUTPUT_FILE"
  echo "Overall Status:   ✗ FAILURE" >> "$OUTPUT_FILE"
fi

echo "================================================================================" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Print the output
cat "$OUTPUT_FILE"

# Exit with appropriate code
if [ "$TEST_PASS" = true ] && [ "$TYPECHECK_PASS" = true ]; then
  exit 0
else
  exit 1
fi
