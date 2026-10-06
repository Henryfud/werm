// Prints length and GC content for each record in a FASTA file. Streams the file, so 100 MB is fine.
import fs from "node:fs";
import readline from "node:readline";
const file = process.argv[2];
if (!file) { console.log("usage: node scripts/genome_stats.mjs path/to/file.fasta"); process.exit(1); }
const rl = readline.createInterface({ input: fs.createReadStream(file), crlfDelay: Infinity });
let cur = null; const rows = [];
for await (const line of rl) {
  if (line.startsWith(">")) { cur = { name: line.slice(1).split(" ").slice(0, 3).join(" "), len: 0, gc: 0, at: 0, n: 0 }; rows.push(cur); continue; }
  if (!cur) continue;
  for (let i = 0; i < line.length; i++) {
    const c = line.charCodeAt(i) | 32; cur.len++;
    if (c === 103 || c === 99) cur.gc++; else if (c === 97 || c === 116) cur.at++; else cur.n++;
  }
}
let L = 0, G = 0, A = 0;
for (const r of rows) { L += r.len; G += r.gc; A += r.at; console.log(r.name.padEnd(38), String(r.len).padStart(10), "bases  GC", (100 * r.gc / Math.max(1, r.gc + r.at)).toFixed(2) + "%", r.n ? `(${r.n} other)` : ""); }
console.log("total".padEnd(38), String(L).padStart(10), "bases  GC", (100 * G / Math.max(1, G + A)).toFixed(2) + "%");
