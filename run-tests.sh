#!/bin/bash
cd /home/jango/Git/hoox-setup

echo "================================================================================"
echo "TEST EXECUTION REPORT"
echo "================================================================================"

# 1. Run the specific test file
echo ""
echo "[1/3] Running: bun test packages/shared/src/path-utils.test.ts"
echo ""
bun test packages/shared/src/path-utils.test.ts
TEST_EXIT=$?

# 2. Check coverage output
echo ""
echo "[2/3] Checking Coverage Output"
echo ""
if [ -f "coverage/coverage-summary.json" ]; then
  echo "Coverage Summary:"
  cat coverage/coverage-summary.json | grep -A 20 '"total"'
else
  echo "Coverage summary not found"
fi

# 3. Run typecheck
echo ""
echo "[3/3] Running: bun run typecheck"
echo ""
bun run typecheck
TYPECHECK_EXIT=$?

# Final summary
echo ""
echo "================================================================================"
echo "FINAL REPORT"
echo "================================================================================"
echo "Test Status:      $([ $TEST_EXIT -eq 0 ] && echo '✓ PASS' || echo '✗ FAIL')"
echo "Typecheck Status: $([ $TYPECHECK_EXIT -eq 0 ] && echo '✓ PASS' || echo '✗ FAIL')"

if [ -f "coverage/coverage-summary.json" ]; then
  echo ""
  echo "Coverage Metrics:"
  cat coverage/coverage-summary.json | jq '.total | "  Statements: \(.statements.pct)%\n  Branches:   \(.branches.pct)%\n  Functions:  \(.functions.pct)%\n  Lines:      \(.lines.pct)%"' -r
fi

OVERALL=$([ $TEST_EXIT -eq 0 ] && [ $TYPECHECK_EXIT -eq 0 ] && echo 0 || echo 1)
echo ""
echo "Overall Status:   $([ $OVERALL -eq 0 ] && echo '✓ SUCCESS' || echo '✗ FAILURE')"
echo "================================================================================"

exit $OVERALL
