// The parameter sweep behind PARAMS in src/network.mjs.
//
//   node scripts/sweep.mjs            writes docs/results/sweep.csv and prints the top rows
//
// For each combination of chemScale, inhib, fOffset and threshold (1,470 points) it measures, at seeds 1, 2, 3:
//   score     reflex trials with the expected sign, out of 12 (4 reflexes x 3 seeds)
//   contrast  drive(touch-tail) minus drive(touch-head). Chalfie et al. 1985 says tail touch drives
//             forward and head touch drives backward, so this should be positive
//   rest30    the most neurons active after 30 s with no input, over the three seeds
//
// Selection rule, fixed before looking at the results:
//   1. keep points where a resting worm stays quiet (rest30 <= 3 for every seed)
//   2. of those, keep the best score
//   3. of those, pick the largest contrast
// Specificity (each reflex against random pokes, src/reflex.mjs) is reported for the chosen point but is
// not used to choose it, so it stays an honest check.
//
// The sweep from the original session lived in a scratch folder and was lost. This file is the record now.
import fs from "node:fs";
import { isMainThread, runPool, serveJobs } from "./lib/pool.mjs";
import { WormBrain, PARAMS } from "../src/network.mjs";
import { scoreReflexes, gridPoints, specificity, REFLEXES } from "../src/reflex.mjs";

export const GRID = {
  chemScale: [1.2, 1.5, 1.8, 2.1, 2.4, 2.7],
  inhib: [8, 10, 12, 14, 16, 18, 20],
  fOffset: [0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9],
  threshold: [0.2, 0.25, 0.3, 0.35, 0.4],
};
export const SEEDS = [1, 2, 3];
const c = JSON.parse(fs.readFileSync(new URL("../data/connectome.json", import.meta.url), "utf8"));

function rest30(params) {
  let worst = 0;
  for (const seed of SEEDS) { const w = new WormBrain(c, params, seed); w.run(30); worst = Math.max(worst, w.readout().active); }
  return worst;
}

function measure(p) {
  const s = scoreReflexes(c, p, SEEDS);
  return { params: p, score: s.score, total: s.total, contrast: s.per["touch-tail"].mean - s.per["touch-head"].mean, margin: s.margin, rest30: rest30(p), per: Object.fromEntries(Object.entries(s.per).map(([k, v]) => [k, v.mean])) };
}

if (!isMainThread) serveJobs(measure);
else {
  const t0 = Date.now();
  const rows = await runPool(new URL(import.meta.url), gridPoints(GRID), undefined, (d, n) => { if (d % 25 === 0 || d === n) process.stderr.write(`\r${d}/${n} points, ${((Date.now() - t0) / 1000).toFixed(0)} s`); });
  process.stderr.write("\n");
  const keys = Object.keys(GRID);
  rows.sort((a, b) => (a.rest30 <= 3 ? 0 : 1) - (b.rest30 <= 3 ? 0 : 1) || b.score - a.score || b.contrast - a.contrast);
  const head = [...keys, "score", "total", "contrast", "rest30", ...REFLEXES.map(([k]) => `${k}_drive`)].join(",");
  const lines = rows.map((r) => [...keys.map((k) => r.params[k]), r.score, r.total, r.contrast.toFixed(4), r.rest30, ...REFLEXES.map(([k]) => r.per[k].toFixed(4))].join(","));
  fs.writeFileSync(new URL("../docs/results/sweep.csv", import.meta.url), head + "\n" + lines.join("\n") + "\n");

  const quiet = rows.filter((r) => r.rest30 <= 3);
  const hist = {};
  for (const r of quiet) hist[r.score] = (hist[r.score] || 0) + 1;
  console.log(`${rows.length} points, ${quiet.length} stay quiet at rest for 30 s. Quiet points per score: ${JSON.stringify(hist)}`);
  const current = rows.find((r) => keys.every((k) => r.params[k] === PARAMS[k]));
  if (current) console.log(`current PARAMS: score ${current.score}/12, contrast ${current.contrast.toFixed(3)}, rest30 ${current.rest30}`);
  console.log("top 8:");
  for (const r of rows.slice(0, 8)) console.log(" ", JSON.stringify(r.params), `${r.score}/12 contrast ${r.contrast.toFixed(3)} rest30 ${r.rest30}`, REFLEXES.map(([k]) => `${k} ${r.per[k].toFixed(2)}`).join("  "));
  const best = rows[0];
  console.log("\nchosen point, specificity against 100 random pokes (percentile, share of random pokes with the same sign):");
  for (const [k, sign] of REFLEXES) {
    const s = specificity(c, { ...PARAMS, ...best.params }, k, sign, { draws: 100 });
    console.log(" ", k.padEnd(11), `${s.percentile.toFixed(0)}th`, `${(100 * s.controlSameSign).toFixed(0)}%`);
  }
}
