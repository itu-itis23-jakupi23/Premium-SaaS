
import { db, boothVersions, boothDesigns, projects } from "../lib/db/src";
import fs from "fs";
import path from "path";

async function main() {
  const versions = await db.select().from(boothVersions);
  console.log(`Found ${versions.length} versions`);
  for (const v of versions) {
    console.log(`Version ID: ${v.id}, Number: ${v.versionNumber}, Title: ${v.title}`);
    const filePath = path.join("c:\\Users\\User\\Downloads\\Premium-SaaS-Builder (2)\\Premium-SaaS-Builder\\scratch", `layout-${v.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(v.layoutJson, null, 2));
    console.log(`Saved to ${filePath}`);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
