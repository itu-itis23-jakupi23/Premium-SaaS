import fs from "fs";
import path from "path";

const filePath = "c:\\Users\\User\\Downloads\\Premium-SaaS-Builder (2)\\Premium-SaaS-Builder\\artifacts\\ens-landing\\src\\components\\workspace\\BoothCanvas.tsx";
const content = fs.readFileSync(filePath, "utf-8");

const terms = ["slope", "sloped", "slant", "slanted", "diagonal", "triangle", "polygon", "post", "pole", "column", "BH", "FH", "buildWall"];

for (const term of terms) {
  const regex = new RegExp(term, "gi");
  const matches = content.match(regex);
  console.log(`Term "${term}": ${matches ? matches.length : 0} matches`);
}

// Find occurrences of buildWall and print their surrounding lines
const lines = content.split("\n");
lines.forEach((line, index) => {
  if (line.includes("buildWall")) {
    console.log(`Line ${index + 1}: ${line.trim()}`);
  }
});
