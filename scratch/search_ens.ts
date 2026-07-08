import fs from "fs";
import path from "path";

const dirPath = "c:\\ENS";
const keywords = ["slope", "sloped", "slant", "slanted", "diagonal", "triangle"];

function walkDir(dir: string, callback: (filePath: string) => void) {
  fs.readdirSync(dir).forEach(f => {
    const dirPath = path.join(dir, f);
    const isDirectory = fs.statSync(dirPath).isDirectory();
    if (isDirectory) {
      if (!f.startsWith(".") && f !== "node_modules" && f !== "__pycache__" && f !== "vendor" && f !== "GLB") {
        walkDir(dirPath, callback);
      }
    } else {
      callback(dirPath);
    }
  });
}

const textExtensions = [".ts", ".tsx", ".js", ".jsx", ".html", ".css", ".py", ".json", ".sql", ".txt", ".md"];

walkDir(dirPath, (filePath) => {
  const ext = path.extname(filePath).toLowerCase();
  if (textExtensions.includes(ext)) {
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      for (const keyword of keywords) {
        if (content.toLowerCase().includes(keyword)) {
          console.log(`Match found in: ${filePath} -> "${keyword}"`);
        }
      }
    } catch (e) {
      // ignore read errors
    }
  }
});
