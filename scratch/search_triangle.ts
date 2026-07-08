import fs from "fs";

const filePath = "c:\\ENS\\admin_workspace.html";
const content = fs.readFileSync(filePath, "utf-8");
const lines = content.split("\n");

lines.forEach((line, index) => {
  if (line.toLowerCase().includes("triangle")) {
    console.log(`Line ${index + 1}: ${line.trim()}`);
  }
});
