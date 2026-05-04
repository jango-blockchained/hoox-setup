// Workers commands (new Command interface)
export { WorkersCloneCommand as workersClone } from "./workers/clone.js";
export { WorkersSetupCommand as workersSetup } from "./workers/setup.js";
export { WorkersDevCommand as workersDev } from "./workers/dev.js";
export { WorkersDeployCommand as workersDeploy } from "./workers/deploy.js";
export { WorkersStatusCommand as workersStatus } from "./workers/status.js";
export { WorkersTestCommand as workersTest } from "./workers/test.js";
export { WorkersLogsCommand as workersLogs } from "./workers/logs.js";
export { WorkersListCommand as workersList } from "./workers/list.js";

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

// Trade commands
export { default as tradeDeploy } from "./trade/deploy.js";
