// Computes GC content in fixed windows along each chromosome and writes a small file that is safe to commit.
//   node scripts/gc_windows.mjs data/genome/c_elegans.fasta [windowSize]     default window 100,000 bases
// Output: data/gc_windows.json, one array of GC percentages per chromosome (the last window is shorter).
import fs from "node:fs";
import readline from "node:readline";

const file = process.argv[2] || "data/genome/c_elegans.fasta";
const W = Number(process.argv[3] || 100000);
const NAMES = { NC_003279: "I", NC_003280: "II", NC_003281: "III", NC_003282: "IV", NC_003283: "V", NC_003284: "X", NC_001328: "MT" };

const rl = readline.createInterface({ input: fs.createReadStream(file), crlfDelay: Infinity });
const chroms = [];
let cur = null, gc = 0, at = 0, inWin = 0;
const flush = () => { if (inWin) cur.gc.push(+(100 * gc / Math.max(1, gc + at)).toFixed(2)); gc = at = inWin = 0; };
for await (const line of rl) {
  if (line.startsWith(">")) {
    if (cur) flush();
    const acc = line.slice(1).split(/\s/)[0];
    cur = { name: NAMES[acc.split(".")[0]] || acc, accession: acc, length: 0, gc: [] };
    chroms.push(cur);
    continue;
  }
  for (let i = 0; i < line.length; i++) {
    const c = line.charCodeAt(i) | 32;
    if (c === 103 || c === 99) gc++; else if (c === 97 || c === 116) at++;
    cur.length++; inWin++;
    if (inWin === W) flush();
  }
}
if (cur) flush();
const nuclear = chroms.filter((c) => c.name !== "MT");
const out = {
  source: "NCBI RefSeq assembly GCF_000002985.6 (WBcel235), fetched with scripts/fetch_genome.sh",
  window: W,
  chromosomes: nuclear,
};
fs.writeFileSync("data/gc_windows.json", JSON.stringify(out));
for (const c of nuclear) console.log(c.name.padEnd(4), c.accession.padEnd(13), String(c.length).padStart(10), "bases", String(c.gc.length).padStart(4), "windows", "GC", Math.min(...c.gc), "to", Math.max(...c.gc));
console.log("wrote data/gc_windows.json", (fs.statSync("data/gc_windows.json").size / 1024).toFixed(1), "KB");
