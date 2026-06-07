// Global test preload to prevent accidental external binary spawns (wrangler, etc.)
// This file is injected automatically by the test runner. To allow blocked commands
// in intentional live tests, set HOOX_TEST_ALLOW_WRANGLER=1 in the env.

import { installSpawnShim } from "@hoox/test-utils/spawn-shim";

installSpawnShim();
