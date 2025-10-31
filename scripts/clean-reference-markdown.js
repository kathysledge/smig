import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function cleanMarkdownFiles(dir) {
  const items = fs.readdirSync(dir);

  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      // Recursively process subdirectories
      cleanMarkdownFiles(fullPath);
    } else if (item.endsWith(".md")) {
      // Clean up the markdown content
      let content = fs.readFileSync(fullPath, "utf8");

      // Remove the "**Reference**" and "***" at the top
      content = content.replace(/^\*\*Reference\*\*\n\n\*\*\*\n\n/, "");

      // Remove top 4 lines from files in subfolders (not the main index.md)
      if (
        fullPath.includes("/reference/") &&
        !fullPath.endsWith("/reference/index.md")
      ) {
        const lines = content.split("\n");
        if (lines.length > 4) {
          content = lines.slice(4).join("\n");
        }
      }

      fs.writeFileSync(fullPath, content);
      console.log(`Cleaned: ${fullPath}`);
    }
  }
}

// Start from the reference docs directory
const referenceDir = path.join(__dirname, "../docs/reference");
if (fs.existsSync(referenceDir)) {
  cleanMarkdownFiles(referenceDir);
  console.log("Finished cleaning reference markdown files");
} else {
  console.error("reference directory not found:", referenceDir);
}
