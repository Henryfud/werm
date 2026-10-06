// The reflex checks: poke a group of sensory neurons and see which way the command interneurons lean.
// Shared by the tests, the parameter sweep and the null model experiment, so they all measure the same thing.

import { WormBrain, STIMULI, mulberry32 } from "./network.mjs";

// stimulus and the sign of drive the literature reports (+1 forward, -1 backward). See docs/research/03.
export const REFLEXES = [
  ["touch-head", -1],
  ["touch-tail", 1],
  ["nose-touch", -1],
  ["noxious", -1],
];

// one trial: 1 s to settle, then 1.5 s of stimulation, then read drive (forward minus backward)
export function reflexDrive(connectome, params, seed, key) {
  const w = new WormBrain(connectome, params, seed);
  w.run(1);
  w.stimulate(key);
  w.run(1.5);
  return w.readout().drive;
}

// run every reflex at every seed. score counts trials with the expected sign.
export function scoreReflexes(connectome, params = {}, seeds = [1, 2, 3]) {
  const per = {};
  let score = 0, margin = 0;
  for (const [key, sign] of REFLEXES) {
    const drives = seeds.map((s) => reflexDrive(connectome, params, s, key));
    const hits = drives.filter((d) => Math.sign(d) === sign).length;
    const mean = drives.reduce((a, b) => a + b, 0) / drives.length;
    per[key] = { mean, hits, of: seeds.length };
    score += hits;
    margin += sign * mean;              // positive when the average push is the right way
  }
  return { score, total: REFLEXES.length * seeds.length, margin: margin / REFLEXES.length, per };
}

// how busy a resting network is: active neuron count after 2 s with no input
export function restActivity(connectome, params = {}, seed = 1) {
  const w = new WormBrain(connectome, params, seed);
  w.run(2);
  return w.readout().active;
}

// every combination of the values in grid, e.g. { chemScale: [1.5, 1.8], inhib: [10, 12] }
export function gridPoints(grid) {
  let points = [{}];
  for (const [k, vals] of Object.entries(grid)) points = points.flatMap((p) => vals.map((v) => ({ ...p, [k]: v })));
  return points;
}

// score every grid point, best first (by score, then by margin)
export function sweep(connectome, grid, seeds = [1, 2, 3], base = {}) {
  const rows = gridPoints(grid).map((p) => ({ params: p, ...scoreReflexes(connectome, { ...base, ...p }, seeds) }));
  return rows.sort((a, b) => b.score - a.score || b.margin - a.margin);
}

// The control for a reflex: poke random sensory neurons instead of the real ones, with the same number of cells
// and the same strength, and see how the network leans. If almost any poke pushes it backward, a backward
// "reflex" says little. Draws are seeded so the control repeats exactly.
export function controlDrives(connectome, params, key, { seed = 1, draws = 50, simSeed = 1 } = {}) {
  const { cells, amp } = STIMULI[key];
  const pool = connectome.neurons.filter((n) => n.class === "sensory" && !cells.includes(n.id)).map((n) => n.id);
  const rand = mulberry32(seed);
  const out = [];
  for (let d = 0; d < draws; d++) {
    const p = pool.slice();
    for (let i = p.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
    const w = new WormBrain(connectome, params, simSeed);
    w.run(1);
    w.setInput(p.slice(0, cells.length), amp);
    w.run(1.5);
    out.push(w.readout().drive);
  }
  return out;
}

// where a reflex sits among its random controls, in the direction the literature expects.
// 100 means the real stimulus pushes harder the expected way than every random poke did.
export function specificity(connectome, params, key, sign, opts = {}) {
  const ctrl = controlDrives(connectome, params, key, opts);
  const w = new WormBrain(connectome, params, opts.simSeed ?? 1);
  w.run(1); w.stimulate(key); w.run(1.5);
  const drive = w.readout().drive;
  const beaten = ctrl.filter((c) => sign * drive > sign * c).length;
  const sameSign = ctrl.filter((c) => Math.sign(c) === sign).length;
  return { drive, percentile: (100 * beaten) / ctrl.length, controlSameSign: sameSign / ctrl.length, controlMean: ctrl.reduce((a, b) => a + b, 0) / ctrl.length };
}

// the head versus tail contrast from Chalfie et al. 1985, stated inside the model:
// a tail touch should push further forward than a head touch. Positive means it does.
export function headTailContrast(connectome, params = {}, seeds = [1, 2, 3]) {
  let s = 0;
  for (const seed of seeds) s += reflexDrive(connectome, params, seed, "touch-tail") - reflexDrive(connectome, params, seed, "touch-head");
  return s / seeds.length;
}
