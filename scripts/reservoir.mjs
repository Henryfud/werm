// Reservoir benchmark: is the real wiring a better signal processor than shuffled wiring?
//
//   node scripts/reservoir.mjs [--graphs 100] [--quick]
//
// The network is used as a fixed "reservoir" (Jaeger 2001, Maass et al. 2002). A random input signal u(t)
// drives every sensory neuron. Nothing in the network is trained. A linear readout (ridge regression over the
// states of all 302 neurons plus a bias) is fitted on one stretch of time and scored on a later stretch.
//
// Tasks
//   memory capacity  sum over delays k = 1..30 of the squared correlation between the readout and u(t - k).
//                    Higher means the network holds on to its recent input for longer.
//   NARMA10          a standard nonlinear target that mixes the last ten inputs. Scored as NRMSE, lower is better.
//
// Each input value is held for 10 model steps (50 ms). 200 washout steps, 2,000 training steps, 1,000 test steps.
// The same input sequence (seed 7) is used for every graph. Real wiring is compared with 100 degree preserving
// rewirings and 100 random graphs of equal density (src/graphs.mjs), all at the default PARAMS.
//
// Writes docs/results/reservoir.json and docs/results/reservoir-memory.svg.
import fs from "node:fs";
import { isMainThread, runPool, serveJobs } from "./lib/pool.mjs";
import { histogram } from "./lib/svg.mjs";
import { WormBrain, mulberry32 } from "../src/network.mjs";
import { rewire, randomGraph } from "../src/graphs.mjs";

const connectome = JSON.parse(fs.readFileSync(new URL("../data/connectome.json", import.meta.url), "utf8"));
const HOLD = 10, WASH = 200, TRAIN = 2000, TEST = 1000, DELAYS = 30, IN_GAIN = 1.6, RIDGE = 1e-4;
const T = WASH + TRAIN + TEST;
const SENSORY = connectome.neurons.filter((n) => n.class === "sensory").map((n) => n.id);

function inputs(seed = 7) {
  const r = mulberry32(seed);
  return Array.from({ length: T }, () => r() * 0.5);   // NARMA10 is defined for inputs in [0, 0.5]
}

function narma10(u) {
  const y = new Array(u.length).fill(0);
  for (let t = 9; t < u.length - 1; t++) {
    let s = 0;
    for (let i = 0; i < 10; i++) s += y[t - i];
    y[t + 1] = 0.3 * y[t] + 0.05 * y[t] * s + 1.5 * u[t - 9] * u[t] + 0.1;
  }
  return y;
}

// collect the state of every neuron at the end of each held input
function states(graph, u) {
  const w = new WormBrain(graph, {}, 1);
  w.run(1);
  const X = [];
  for (let t = 0; t < T; t++) {
    w.setInput(SENSORY, IN_GAIN * u[t]);
    for (let k = 0; k < HOLD; k++) w.step();
    X.push(Float64Array.from(w.x));
  }
  return X;
}

// ridge regression for several targets at once: solve (A'A + lambda I) W = A'Y by Cholesky
function fitRidge(A, Ys) {
  const n = A[0].length, m = A.length;
  const G = Array.from({ length: n }, () => new Float64Array(n));
  for (const row of A) for (let i = 0; i < n; i++) { const ri = row[i]; if (ri === 0) continue; const Gi = G[i]; for (let j = 0; j <= i; j++) Gi[j] += ri * row[j]; }
  let tr = 0;
  for (let i = 0; i < n; i++) tr += G[i][i];
  const lam = RIDGE * (tr / n) + 1e-12;
  for (let i = 0; i < n; i++) { G[i][i] += lam; for (let j = 0; j < i; j++) G[j][i] = G[i][j]; }
  const L = Array.from({ length: n }, () => new Float64Array(n));
  for (let i = 0; i < n; i++) for (let j = 0; j <= i; j++) {
    let s = G[i][j];
    for (let k = 0; k < j; k++) s -= L[i][k] * L[j][k];
    L[i][j] = i === j ? Math.sqrt(Math.max(s, 1e-12)) : s / L[j][j];
  }
  return Ys.map((y) => {
    const b = new Float64Array(n);
    for (let r = 0; r < m; r++) { const yr = y[r]; if (yr === 0) continue; const row = A[r]; for (let i = 0; i < n; i++) b[i] += row[i] * yr; }
    const z = new Float64Array(n);
    for (let i = 0; i < n; i++) { let s = b[i]; for (let k = 0; k < i; k++) s -= L[i][k] * z[k]; z[i] = s / L[i][i]; }
    const x = new Float64Array(n);
    for (let i = n - 1; i >= 0; i--) { let s = z[i]; for (let k = i + 1; k < n; k++) s -= L[k][i] * x[k]; x[i] = s / L[i][i]; }
    return x;
  });
}

const predict = (A, w) => A.map((row) => row.reduce((s, v, i) => s + v * w[i], 0));
const corr2 = (a, b) => {
  const n = a.length, ma = a.reduce((x, y) => x + y, 0) / n, mb = b.reduce((x, y) => x + y, 0) / n;
  let sab = 0, saa = 0, sbb = 0;
  for (let i = 0; i < n; i++) { const da = a[i] - ma, db = b[i] - mb; sab += da * db; saa += da * da; sbb += db * db; }
  return saa && sbb ? (sab * sab) / (saa * sbb) : 0;
};
const nrmse = (p, y) => {
  const n = y.length, my = y.reduce((a, b) => a + b, 0) / n;
  let se = 0, sv = 0;
  for (let i = 0; i < n; i++) { se += (p[i] - y[i]) ** 2; sv += (y[i] - my) ** 2; }
  return Math.sqrt(se / sv);
};

function score(graph) {
  const u = inputs(), y = narma10(u);
  const X = states(graph, u).map((x) => [...x, 1]);
  const tr = [WASH, WASH + TRAIN], te = [WASH + TRAIN, T];
  const A = X.slice(...tr), B = X.slice(...te);
  const targets = [];
  for (let k = 1; k <= DELAYS; k++) targets.push(u.map((_, t) => (t - k >= 0 ? u[t - k] : 0)));
  targets.push(y);
  const W = fitRidge(A, targets.map((tg) => tg.slice(...tr)));
  let memory = 0;
  for (let k = 0; k < DELAYS; k++) memory += corr2(predict(B, W[k]), targets[k].slice(...te));
  return { memory, narma: nrmse(predict(B, W[DELAYS]), y.slice(...te)), activeMean: X.slice(...te).reduce((s, x) => s + x.slice(0, -1).filter((v) => v > 0.3).length, 0) / TEST };
}

if (!isMainThread) serveJobs(({ kind, seed }) => ({ kind, seed, ...score(kind === "real" ? connectome : kind === "rewired" ? rewire(connectome, seed) : randomGraph(connectome, seed)) }));
else {
  const arg = (n, d) => { const i = process.argv.indexOf("--" + n); return i >= 0 ? process.argv[i + 1] : d; };
  const quick = process.argv.includes("--quick");
  const n = Number(arg("graphs", quick ? 4 : 100));
  const jobs = [{ kind: "real", seed: 0 }];
  for (let i = 1; i <= n; i++) jobs.push({ kind: "rewired", seed: i }, { kind: "random", seed: i });
  const t0 = Date.now();
  const res = await runPool(new URL(import.meta.url), jobs, undefined, (d, m) => { if (d % 20 === 0 || d === m) process.stderr.write(`\r${d}/${m} graphs, ${((Date.now() - t0) / 1000).toFixed(0)} s`); });
  process.stderr.write("\n");
  const real = res.find((r) => r.kind === "real");
  const summary = {};
  for (const m of ["memory", "narma", "activeMean"]) {
    summary[m] = { real: real[m] };
    for (const kind of ["rewired", "random"]) {
      const v = res.filter((r) => r.kind === kind).map((r) => r[m]);
      const mean = v.reduce((a, b) => a + b, 0) / v.length;
      summary[m][kind] = { mean, sd: Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / v.length), min: Math.min(...v), max: Math.max(...v), realPercentile: (100 * (v.filter((x) => x < real[m]).length + 0.5 * v.filter((x) => x === real[m]).length)) / v.length };
    }
  }
  console.log("metric        real     | rewired mean (sd)  real pct | random mean (sd)  real pct");
  for (const [m, s] of Object.entries(summary)) {
    const f = (k) => `${s[k].mean.toFixed(3).padStart(7)} (${s[k].sd.toFixed(3)}) ${s[k].realPercentile.toFixed(0).padStart(5)}`;
    console.log(m.padEnd(12), s.real.toFixed(3).padStart(8), " |", f("rewired"), "   |", f("random"));
  }
  if (!quick) {
    fs.writeFileSync(new URL("../docs/results/reservoir.json", import.meta.url), JSON.stringify({ generated: new Date().toISOString().slice(0, 10), graphsPerKind: n, settings: { HOLD, WASH, TRAIN, TEST, DELAYS, IN_GAIN, RIDGE, inputSeed: 7 }, summary, rows: res }, null, 1));
    fs.writeFileSync(new URL("../docs/results/reservoir-memory.svg", import.meta.url), histogram({
      title: "Memory capacity (higher holds input longer)", xlabel: "memory capacity", real: real.memory,
      groups: [
        { label: "degree preserving", color: "#8a22b8", values: res.filter((r) => r.kind === "rewired").map((r) => r.memory) },
        { label: "random (same density)", color: "#3333ea", values: res.filter((r) => r.kind === "random").map((r) => r.memory) },
      ],
    }));
  }
}
