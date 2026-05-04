// Workers commands (new Command interface)
export { WorkersCloneCommand as clone } from "./workers/clone.js";
export { WorkersSetupCommand as setup } from "./workers/setup.js";
export { WorkersDevCommand as dev } from "./workers/dev.js";
export { WorkersDeployCommand as deploy } from "./workers/deploy.js";
export { WorkersStatusCommand as status } from "./workers/status.js";
export { WorkersTestCommand as test } from "./workers/test.js";
export { WorkersLogsCommand as logs } from "./workers/logs.js";
export { WorkersRollbackCommand as rollback } from "./workers/rollback.js";
export { WorkersMetricsCommand as metrics } from "./workers/metrics.js";
export { WorkersListCommand as list } from "./workers/list.js";

// Config commands (new Command interface)
export { ConfigInitCommand as configInit } from "./config/init.js";
export { ConfigSecretsCommand as configSecrets } from "./config/secrets.js";
export { ConfigKeysCommand as configKeys } from "./config/keys.js";

// Other command exports
export { setupValidate, setupRepair, setupExport } from "./setup.js";
export * as cfD1 from "./cf/d1.js";
export * as cfR2 from "./cf/r2.js";
export * as cfKV from "./cf/kv.js";
export * as cfSecrets from "./cf/secrets.js";
export * as cfQueues from "./cf/queues.js";
export * as cfZones from "./cf/zones.js";
export { runTui } from "./tui.js";

// Utility commands (new Command interface)
export { LogsDownloadCommand as logsDownload } from "./logs/download.js";
export { HousekeepingCommand as housekeeping } from "./housekeeping.js";
export { WafCommand as waf } from "./waf.js";
export { R2ProvisionCommand as r2Provision } from "./r2-provision.js";
