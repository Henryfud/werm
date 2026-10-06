// Recomputes the data profile quoted in docs/research/02-connectome.md and the genome files, and fails on any mismatch.
//   node scripts/check_data.mjs
import fs from "node:fs";
const read = (p) => JSON.parse(fs.readFileSync(new URL("../" + p, import.meta.url), "utf8"));
const c = read("data/connectome.json");
const gc = read("data/gc_windows.json");
const genes = read("data/gene_windows.json");

const chem = c.edges.filter((e) => e.k === "chem"), gap = c.edges.filter((e) => e.k === "gap");
const sum = (a) => a.reduce((x, y) => x + y, 0);
const ws = chem.map((e) => e.w).sort((a, b) => a - b);
const chemPairs = new Set(chem.map((e) => e.s + ">" + e.t));
const touched = new Set(c.edges.flatMap((e) => [e.s, e.t]));
const classes = {};
for (const n of c.neurons) classes[n.class] = (classes[n.class] || 0) + 1;

const actual = {
  neurons: c.neurons.length,
  chemicalPairs: chem.length,
  gapPairs: gap.length,
  chemicalWeightSum: sum(chem.map((e) => e.w)),
  gapWeightSum: sum(gap.map((e) => e.w)),
  medianChemicalWeight: ws[Math.floor(ws.length / 2)],
  maxChemicalWeight: ws[ws.length - 1],
  shareChemicalWeightOne: +(100 * ws.filter((w) => w === 1).length / ws.length).toFixed(1),
  chemicalDensityPercent: +(100 * chem.length / (302 * 301)).toFixed(2),
  reciprocalPercent: +(100 * chem.filter((e) => chemPairs.has(e.t + ">" + e.s)).length / chem.length).toFixed(1),
  neuronsWithGap: new Set(gap.flatMap((e) => [e.s, e.t])).size,
  isolated: c.neurons.filter((n) => !touched.has(n.id)).length,
  hasCAN: ["CANL", "CANR"].every((id) => c.neurons.some((n) => n.id === id) && touched.has(id)),
  classes,
  nuclearBases: sum(gc.chromosomes.map((x) => x.length)),
  chromosomeLengths: Object.fromEntries(gc.chromosomes.map((x) => [x.name, x.length])),
  gcWindowsMatchLengths: gc.chromosomes.every((x) => x.gc.length === Math.ceil(x.length / gc.window)),
  proteinCodingNuclear: genes.proteinCodingNuclear,
  geneWindowsSum: sum(genes.chromosomes.flatMap((x) => x.genes)),
};

const expected = {
  neurons: 302, chemicalPairs: 3709, gapPairs: 1105, chemicalWeightSum: 20965, gapWeightSum: 5779,
  medianChemicalWeight: 3, maxChemicalWeight: 75, shareChemicalWeightOne: 30.5, chemicalDensityPercent: 4.08,
  reciprocalPercent: 37.1, neuronsWithGap: 298, isolated: 0, hasCAN: true,
  classes: { sensory: 83, inter: 87, motor: 125, other: 7 },
  nuclearBases: 100272607,
  chromosomeLengths: { I: 15072434, II: 15279421, III: 13783801, IV: 17493829, V: 20924180, X: 17718942 },
  gcWindowsMatchLengths: true,
  proteinCodingNuclear: 19971, geneWindowsSum: 19971,
};

let bad = 0;
for (const [k, v] of Object.entries(expected)) {
  const canon = (x) => JSON.stringify(x && typeof x === "object" ? Object.fromEntries(Object.entries(x).sort()) : x);
  const ok = canon(actual[k]) === canon(v);
  if (!ok) { bad++; console.log(`MISMATCH ${k}: expected ${JSON.stringify(v)}, got ${JSON.stringify(actual[k])}`); }
}
if (bad) process.exit(1);
console.log(`data check passed: ${Object.keys(expected).length} quantities match`);
