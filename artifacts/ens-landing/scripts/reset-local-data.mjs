import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, "..");
const dataDir = path.join(appRoot, ".dev-data");
const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
const backupDir = path.join(dataDir, `reset-backup-${stamp}`);

const stores = [
  "auth.json",
  "core.json",
  "messages.json",
  "message-attachments.json",
];

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const existingStores = [];
  for (const store of stores) {
    const storePath = path.join(dataDir, store);
    if (await pathExists(storePath)) existingStores.push({ name: store, path: storePath });
  }

  if (!existingStores.length) {
    console.log("No local dev data stores found. Nothing to reset.");
    return;
  }

  await fs.mkdir(backupDir, { recursive: true });
  for (const store of existingStores) {
    await fs.copyFile(store.path, path.join(backupDir, store.name));
    await fs.rm(store.path, { force: true });
  }

  console.log(`Reset ${existingStores.length} local dev data store(s).`);
  console.log(`Backup: ${backupDir}`);
  console.log("Restart the API server so it recreates clean empty stores.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
