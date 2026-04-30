import fs from "fs";
import path from "path";
import toml from "toml";

const WORKERS_DIR = path.resolve("workers");
const PUBLIC_WORKERS_DIR = path.resolve("pages/dashboard/public/workers");

function convertWorkerDir(workerName: string) {
  const tomlPath = path.join(WORKERS_DIR, workerName, "dashboard.toml");
  if (!fs.existsSync(tomlPath)) return;

  const content = fs.readFileSync(tomlPath, "utf-8");
  let parsed;
  try {
    parsed = toml.parse(content);
  } catch (e) {
    console.error(`Error parsing ${tomlPath}:`, e);
    return;
  }

  // parsed is the raw TOML object. Let's make it JSONC.
  // We'll write it out exactly as the TOML was structured.
  const jsonContent = JSON.stringify(parsed, null, 2);
  const jsoncPath = path.join(WORKERS_DIR, workerName, "dashboard.jsonc");
  fs.writeFileSync(jsoncPath, jsonContent, "utf-8");
  console.log(`Created ${jsoncPath}`);
  fs.unlinkSync(tomlPath);
  console.log(`Deleted ${tomlPath}`);

  // Now handle public directory copy
  const publicTomlPath = path.join(PUBLIC_WORKERS_DIR, `${workerName}.toml`);
  if (fs.existsSync(publicTomlPath)) {
    fs.unlinkSync(publicTomlPath);
    console.log(`Deleted ${publicTomlPath}`);
  }
  const publicJsoncPath = path.join(PUBLIC_WORKERS_DIR, `${workerName}.jsonc`);
  fs.writeFileSync(publicJsoncPath, jsonContent, "utf-8");
  console.log(`Created ${publicJsoncPath}`);
}

const workers = fs.readdirSync(WORKERS_DIR);
for (const w of workers) {
  if (fs.statSync(path.join(WORKERS_DIR, w)).isDirectory()) {
    convertWorkerDir(w);
  }
}
