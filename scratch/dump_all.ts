import { db, projects, boothDesigns, boothVersions, clients } from "../lib/db/src";

async function main() {
  const allProjects = await db.select().from(projects);
  console.log("--- PROJECTS ---");
  for (const p of allProjects) {
    console.log(`Project ID: ${p.id}, Name: ${p.name}, Client ID: ${p.clientId}`);
  }

  const allClients = await db.select().from(clients);
  console.log("--- CLIENTS ---");
  for (const c of allClients) {
    console.log(`Client ID: ${c.id}, Company Name: ${c.companyName}`);
  }

  const allDesigns = await db.select().from(boothDesigns);
  console.log("--- DESIGNS ---");
  for (const d of allDesigns) {
    console.log(`Design ID: ${d.id}, Project ID: ${d.projectId}, Name: ${d.name}`);
  }

  const allVersions = await db.select().from(boothVersions);
  console.log("--- VERSIONS ---");
  for (const v of allVersions) {
    console.log(`Version ID: ${v.id}, Design ID: ${v.designId}, Status: ${v.status}`);
    console.log(`Layout JSON: ${JSON.stringify(v.layoutJson, null, 2)}`);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
