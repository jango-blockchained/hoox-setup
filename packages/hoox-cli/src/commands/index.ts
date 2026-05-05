// Workers commands (new Command interface)
export { WorkersCloneCommand as workersClone } from "./workers/clone.js";
export { WorkersSetupCommand as workersSetup } from "./workers/setup.js";
export { WorkersDevCommand as workersDev } from "./workers/dev.js";
export { WorkersDeployCommand as workersDeploy } from "./workers/deploy.js";
export { WorkersStatusCommand as workersStatus } from "./workers/status.js";
export { WorkersTestCommand as workersTest } from "./workers/test.js";
export { WorkersLogsCommand as workersLogs } from "./workers/logs.js";
export { WorkersListCommand as workersList } from "./workers/list.js";
export { WorkersUpdateInternalUrlsCommand as workersUpdateInternalUrls } from "./workers/update-urls.js";

// Config commands (new Command interface)
export { ConfigInitCommand as configInit } from "./config/init.js";
export { ConfigSecretsCommand as configSecrets } from "./config/secrets.js";
export { ConfigKeysCommand as configKeys } from "./config/keys.js";

// CF commands (new Command interface)
export { default as cfD1 } from "./cf/d1.js";
export { default as cfKV } from "./cf/kv.js";
export { default as cfQueues } from "./cf/queues.js";
export { default as cfR2 } from "./cf/r2.js";
export { default as cfSecrets } from "./cf/secrets.js";
export { default as cfZones } from "./cf/zones.js";

// Dashboard commands
export { DashboardDeployCommand as dashboardDeploy } from "./dashboard/deploy.js";

// R2 provisioning command
export { default as r2Provision } from "./r2/index.js";

// Trade commands
export { default as tradeDeploy } from "./trade/deploy.js";

// WAF commands
export { default as waf } from "./waf/index.js";

// Check commands
export { CheckSetupCommand as checkSetup } from "./check-setup/index.js";

// Housekeeping commands
export { default as housekeeping } from "./housekeeping/index.js";

// Repair commands
export { RepairCommand as repair } from "./repair/index.js";
