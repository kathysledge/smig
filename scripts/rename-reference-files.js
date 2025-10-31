import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function renameReadmeFiles(dir) {
  const items = fs.readdirSync(dir);

  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      // Recursively process subdirectories
      renameReadmeFiles(fullPath);
    } else if (item === "README.md") {
      // Rename README.md to index.md
      const newPath = path.join(dir, "index.md");
      fs.renameSync(fullPath, newPath);
      console.log(`Renamed: ${fullPath} -> ${newPath}`);
    }
  }
}

function updateLinks(dir) {
  const items = fs.readdirSync(dir);

  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      // Recursively process subdirectories
      updateLinks(fullPath);
    } else if (item.endsWith(".md")) {
      // Update README.md links to index.md
      let content = fs.readFileSync(fullPath, "utf8");
      content = content.replace(/README\.md/g, "index.md");
      fs.writeFileSync(fullPath, content);
      console.log(`Updated links in: ${fullPath}`);
    }
  }
}

// Start from the reference docs directory
const referenceDir = path.join(__dirname, "../docs/reference");
if (fs.existsSync(referenceDir)) {
  renameReadmeFiles(referenceDir);
  updateLinks(referenceDir);
  console.log(
    "Finished renaming README.md files to index.md and updating links",
  );
} else {
  console.error("reference directory not found:", referenceDir);
}
