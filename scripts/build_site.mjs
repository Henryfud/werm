// Inlines the connectome and the simulation code into site/template.html.
// Writes site/index.html (full page) and site/artifact.html (fragment for hosts that wrap the page themselves).
import fs from "node:fs";
const root = new URL("../", import.meta.url);
const read = (p) => fs.readFileSync(new URL(p, root), "utf8");
const strip = (src) => src.replace(/^import .*$/gm, "").replace(/^export (default )?/gm, "");
const gh = process.env.GITHUB_URL || "https://github.com/Henryfud/werm";

const connectome = read("data/connectome.json").trim();
const code = strip(read("src/network.mjs")) + "\n" + strip(read("src/steer.mjs"));
let html = read("site/template.html")
  .replace("/*__CONNECTOME__*/", `const CONNECTOME = ${connectome};`)
  .replace("/*__NETWORK__*/", code)
  .replaceAll("__GITHUB_URL__", gh);

fs.writeFileSync(new URL("site/artifact.html", root), html);
const full = `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><style>html,body{margin:0}</style></head><body>\n${html}\n</body></html>\n`;
fs.writeFileSync(new URL("site/index.html", root), full);
console.log("built site/index.html", (full.length / 1024).toFixed(0) + " KB");
