// Does the real wiring matter? Runs the reflex measurements on the real connectome and on randomised copies.
//
//   node scripts/null-models.mjs [--graphs 100] [--quick]
//
// Null graphs (see src/graphs.mjs):
//   rewired  Maslov and Sneppen degree preserving swaps. Every neuron keeps its in, out and gap degree.
//   random   Erdos Renyi style. Same number of edges and the same weights, placed uniformly at random.
//
// Part A, fixed parameters. PARAMS were tuned on the real graph, so this part favours it. Measures:
//   contrast     drive(touch-tail) minus drive(touch-head), mean of seeds 1 to 3. Chalfie 1985 says positive.
//   tail         drive under touch-tail. The literature says positive (forward).
//   score        sign checks passed out of 12 (4 reflexes, 3 seeds). Weak on its own, kept for continuity.
//   spec_*       percentile of each reflex among 50 matched random pokes (see src/reflex.mjs).
//   rest         neurons active after 2 s with no input.
// Part B, each graph gets its own small parameter sweep (81 points), so no graph is handicapped by
// parameters tuned for another. Measures the best contrast and best score each graph can reach.
//
// Writes docs/results/null-models.json and SVG plots in docs/results/.
import fs from "node:fs";
import { isMainThread, runPool, serveJobs } from "./lib/pool.mjs";
import { histogram } from "./lib/svg.mjs";
import { rewire, randomGraph } from "../src/graphs.mjs";
import { REFLEXES, scoreReflexes, specificity, restActivity, headTailContrast, gridPoints } from "../src/reflex.mjs";

const connectome = JSON.parse(fs.readFileSync(new URL("../data/connectome.json", import.meta.url), "utf8"));
const SEEDS = [1, 2, 3];
const GRID_B = { chemScale: [1.2, 1.8, 2.4], inhib: [8, 12, 16], fOffset: [0.3, 0.5, 0.7], threshold: [0.2, 0.3, 0.4] };

function graphFor({ kind, seed }) {
  if (kind === "real") return connectome;
  if (kind === "rewired") return rewire(connectome, seed);
  return randomGraph(connectome, seed);
}

function measure(job) {
  const g = graphFor(job);
  if (job.part === "A") {
    const s = scoreReflexes(g, {}, SEEDS);
    const out = { ...job, contrast: s.per["touch-tail"].mean - s.per["touch-head"].mean, tail: s.per["touch-tail"].mean, score: s.score, rest: restActivity(g) };
    for (const [k, sign] of REFLEXES) out["spec_" + k] = specificity(g, {}, k, sign, { draws: job.draws }).percentile;
    return out;
  }
  let bestContrast = -Infinity, bestScore = 0;
  for (const p of gridPoints(GRID_B)) {
    if (restActivity(g, p) > 20) continue;          // a network that is busy at rest is not a usable setting
    const s = scoreReflexes(g, p, SEEDS);
    bestScore = Math.max(bestScore, s.score);
    bestContrast = Math.max(bestContrast, s.per["touch-tail"].mean - s.per["touch-head"].mean);
  }
  return { ...job, bestContrast, bestScore };
}

if (!isMainThread) serveJobs(measure);
else {
  const arg = (n, d) => { const i = process.argv.indexOf("--" + n); return i >= 0 ? process.argv[i + 1] : d; };
  const quick = process.argv.includes("--quick");
  const nGraphs = Number(arg("graphs", quick ? 6 : 100));
  const draws = quick ? 10 : 50;
  const jobs = [];
  for (const part of quick ? ["A"] : ["A", "B"]) {
    jobs.push({ part, kind: "real", seed: 0, draws });
    for (let i = 1; i <= nGraphs; i++) { jobs.push({ part, kind: "rewired", seed: i, draws }); jobs.push({ part, kind: "random", seed: i, draws }); }
  }
  const t0 = Date.now();
  const res = await runPool(new URL(import.meta.url), jobs, undefined, (d, n) => { if (d % 20 === 0 || d === n) process.stderr.write(`\r${d}/${n} graphs measured, ${((Date.now() - t0) / 1000).toFixed(0)} s`); });
  process.stderr.write("\n");

  // where the real graph sits: share of null graphs with a strictly lower value (ties count half)
  const rank = (real, vals) => (100 * (vals.filter((v) => v < real).length + 0.5 * vals.filter((v) => v === real).length)) / vals.length;
  const summary = {};
  const metrics = { A: ["contrast", "tail", "score", "rest", ...REFLEXES.map(([k]) => "spec_" + k)], B: ["bestContrast", "bestScore"] };
  for (const part of Object.keys(metrics)) {
    const rows = res.filter((r) => r.part === part);
    if (!rows.length) continue;
    const real = rows.find((r) => r.kind === "real");
    summary[part] = {};
    for (const m of metrics[part]) {
      summary[part][m] = { real: real[m] };
      for (const kind of ["rewired", "random"]) {
        const v = rows.filter((r) => r.kind === kind).map((r) => r[m]).sort((a, b) => a - b);
        const mean = v.reduce((a, b) => a + b, 0) / v.length;
        summary[part][m][kind] = { mean, sd: Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / v.length), min: v[0], max: v[v.length - 1], realPercentile: rank(real[m], v) };
      }
    }
  }
  const out = { generated: new Date().toISOString().slice(0, 10), graphsPerKind: nGraphs, seeds: SEEDS, controlDraws: draws, gridB: GRID_B, summary, rows: res };
  if (!quick) {
    fs.writeFileSync(new URL("../docs/results/null-models.json", import.meta.url), JSON.stringify(out, null, 1));
    const plot = (part, m, title, file) => {
      const rows = res.filter((r) => r.part === part);
      fs.writeFileSync(new URL(`../docs/results/${file}`, import.meta.url), histogram({
        title, xlabel: m, real: rows.find((r) => r.kind === "real")[m],
        groups: [
          { label: "degree preserving", color: "#8a22b8", values: rows.filter((r) => r.kind === "rewired").map((r) => r[m]) },
          { label: "random (same density)", color: "#3333ea", values: rows.filter((r) => r.kind === "random").map((r) => r[m]) },
        ],
      }));
    };
    plot("A", "contrast", "Head versus tail contrast, fixed parameters", "null-contrast.svg");
    plot("A", "tail", "Tail touch drive, fixed parameters", "null-tail.svg");
    plot("B", "bestContrast", "Best contrast with a per graph sweep", "null-best-contrast.svg");
  }
  for (const [part, ms] of Object.entries(summary)) {
    console.log(`\nPart ${part}`);
    console.log("metric".padEnd(16), "real".padStart(8), "| rewired mean (sd)  real pct | random mean (sd)   real pct");
    for (const [m, s] of Object.entries(ms)) {
      const f = (k) => `${s[k].mean.toFixed(3).padStart(7)} (${s[k].sd.toFixed(3)})  ${s[k].realPercentile.toFixed(0).padStart(5)}`;
      console.log(m.padEnd(16), Number(s.real).toFixed(3).padStart(8), "|", f("rewired"), "   |", f("random"));
    }
  }
}
