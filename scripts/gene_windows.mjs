// Counts protein coding genes per window along each chromosome from the RefSeq GFF3 annotation.
//   node scripts/gene_windows.mjs data/genome/annotation.gff.gz [windowSize]     default 100,000 bases
// A gene is counted in the window that holds its start coordinate. Writes data/gene_windows.json.
import fs from "node:fs";
import zlib from "node:zlib";
import readline from "node:readline";

const file = process.argv[2] || "data/genome/annotation.gff.gz";
const W = Number(process.argv[3] || 100000);
const NAMES = { NC_003279: "I", NC_003280: "II", NC_003281: "III", NC_003282: "IV", NC_003283: "V", NC_003284: "X" };
const gc = JSON.parse(fs.readFileSync("data/gc_windows.json", "utf8"));
const lengths = Object.fromEntries(gc.chromosomes.map((c) => [c.name, c.length]));

let input = fs.createReadStream(file);
if (file.endsWith(".gz")) input = input.pipe(zlib.createGunzip());
const rl = readline.createInterface({ input, crlfDelay: Infinity });
const counts = {};
const meta = {};
let total = 0;
for await (const line of rl) {
  if (line.startsWith("#!")) { const [k, ...v] = line.slice(2).split(" "); meta[k] = v.join(" "); continue; }
  if (line.startsWith("#")) continue;
  const f = line.split("\t");
  if (f[2] !== "gene" || !/gene_biotype=protein_coding/.test(f[8])) continue;
  const name = NAMES[f[0].split(".")[0]];
  if (!name) continue;                       // skips the mitochondrial genes
  const arr = counts[name] ||= new Array(Math.ceil(lengths[name] / W)).fill(0);
  arr[Math.floor((Number(f[3]) - 1) / W)]++;
  total++;
}
const out = {
  source: `NCBI RefSeq annotation for GCF_000002985.6 (WBcel235)${meta["annotation-source"] ? ", annotation source " + meta["annotation-source"] : ""}`,
  window: W,
  proteinCodingNuclear: total,
  chromosomes: gc.chromosomes.map((c) => ({ name: c.name, genes: counts[c.name] })),
};
fs.writeFileSync("data/gene_windows.json", JSON.stringify(out));
for (const c of out.chromosomes) console.log(c.name.padEnd(4), String(c.genes.reduce((a, b) => a + b, 0)).padStart(6), "protein coding genes, max per window", Math.max(...c.genes));
console.log("nuclear protein coding genes:", total, "| wrote data/gene_windows.json", (fs.statSync("data/gene_windows.json").size / 1024).toFixed(1), "KB");
