// Fails if prose contains an em dash or a double hyphen. A house rule for this repo, checked in CI.
// Looks at every Markdown file (outside code blocks and inline code) and at the visible text of
// site/template.html (outside <script>, <style> and HTML comments). Code is allowed to use "--".
//   node scripts/check_prose.mjs
import fs from "node:fs";
import path from "node:path";

const root = new URL("../", import.meta.url).pathname;
const skip = new Set(["node_modules", ".git", "data"]);
const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skip.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith(".md")) files.push(p);
  }
})(root);

const BAD = /—|––|(^|[^-!<>])--(?![->])/;   // em dash, doubled en dash, or a bare double hyphen
const problems = [];
const report = (file, n, line) => problems.push(`${path.relative(root, file)}:${n}: ${line.trim().slice(0, 120)}`);

for (const f of files) {
  let inFence = false;
  fs.readFileSync(f, "utf8").split("\n").forEach((line, i) => {
    if (/^\s*(```|~~~)/.test(line)) { inFence = !inFence; return; }
    if (inFence) return;
    if (BAD.test(line.replace(/`[^`]*`/g, ""))) report(f, i + 1, line);
  });
}

const tpl = path.join(root, "site/template.html");
const html = fs.readFileSync(tpl, "utf8");
const masked = html.replace(/<(script|style)[\s\S]*?<\/\1>|<!--[\s\S]*?-->|<code[\s\S]*?<\/code>|<pre[\s\S]*?<\/pre>|<div class="(?:code|eq)"[\s\S]*?<\/div>/g, (m) => m.replace(/[^\n]/g, " "));
masked.split("\n").forEach((line, i) => {
  const text = line.replace(/<[^>]*>/g, " ");
  if (BAD.test(text)) report(tpl, i + 1, html.split("\n")[i]);
});

if (problems.length) {
  console.log(`Found ${problems.length} line(s) with an em dash or a double hyphen in prose:\n` + problems.join("\n"));
  process.exit(1);
}
console.log(`prose check passed: ${files.length} Markdown files and the site template`);
