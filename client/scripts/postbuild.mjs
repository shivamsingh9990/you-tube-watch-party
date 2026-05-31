import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, "../dist");
const indexHtml = path.join(distDir, "index.html");

if (fs.existsSync(indexHtml)) {
  fs.copyFileSync(indexHtml, path.join(distDir, "404.html"));
  console.log("postbuild: copied index.html -> 404.html for SPA fallback");
}
