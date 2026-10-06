import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { WormBrain, STIMULI, GABA, PARAMS, restState } from "../src/network.mjs";
import { steer, stimuliFromText, mood, systemPrompt } from "../src/steer.mjs";
import { REFLEXES, reflexDrive, specificity, headTailContrast } from "../src/reflex.mjs";
import { rewire, randomGraph } from "../src/graphs.mjs";

const c = JSON.parse(fs.readFileSync(new URL("../data/connectome.json", import.meta.url), "utf8"));
const ids = new Set(c.neurons.map((n) => n.id));

// ---------- data ----------

test("connectome has 302 neurons, 3,709 chemical and 1,105 gap junction connections", () => {
  assert.equal(c.neurons.length, 302);
  assert.equal(c.edges.filter((e) => e.k === "chem").length, 3709);
  assert.equal(c.edges.filter((e) => e.k === "gap").length, 1105);
  for (const e of c.edges) { assert.ok(ids.has(e.s)); assert.ok(ids.has(e.t)); assert.ok(e.w > 0); }
});

test("every GABA neuron and every stimulus cell exists in the data", () => {
  for (const g of GABA) assert.ok(ids.has(g), g);
  for (const s of Object.values(STIMULI)) for (const cell of s.cells) assert.ok(ids.has(cell), cell);
});

// ---------- model ----------

test("a resting worm stays quiet for 30 s at any of five seeds", () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    const w = new WormBrain(c, {}, seed);
    w.run(30);
    assert.ok(w.readout().active <= 3, `seed ${seed}: ${w.readout().active} active`);
  }
});

test("rest state is a fixed point of the update with no input and no noise", () => {
  const w = new WormBrain(c, { noise: 0 });
  w.run(2);
  const xr = restState(PARAMS);
  for (const v of w.x) assert.ok(Math.abs(v - xr) < 1e-9);
});

test("states and activations stay in bounds under strong input", () => {
  const w = new WormBrain(c);
  for (const k of Object.keys(STIMULI)) w.stimulate(k);
  w.run(3);
  for (const v of w.x) assert.ok(v >= 0 && v <= 1.5);
  for (const a of w.act) assert.ok(a >= 0 && a <= 1);
});

test("same seed gives the same run", () => {
  const a = new WormBrain(c, {}, 7), b = new WormBrain(c, {}, 7);
  a.stimulate("touch-head"); b.stimulate("touch-head");
  a.run(1); b.run(1);
  assert.deepEqual(Array.from(a.x), Array.from(b.x));
});

// A fixed number from a fixed run. CI runs this on Node 20 and 22, so it checks runs repeat across versions.
// If you change the model on purpose, update the number and say why in the commit.
test("seeded run matches the recorded snapshot", () => {
  const a = new WormBrain(c, {}, 7);
  a.stimulate("touch-tail");
  a.run(2);
  const h = a.x.reduce((s, v, i) => s + v * (i + 1), 0);
  assert.ok(Math.abs(h - 3311.9390431385) < 1e-6, `got ${h}`);
});

test("stimulation spreads past the neurons that were poked", () => {
  const w = new WormBrain(c);
  w.run(1);
  w.stimulate("touch-tail");
  w.run(2);
  assert.ok(w.readout().active > STIMULI["touch-tail"].cells.length + 10);
});

// Regression: the sign of every reflex at the default seed. Signs alone say little (see the specificity test).
for (const [key, sign] of REFLEXES) {
  test(`reflex sign: ${key}`, () => {
    assert.equal(Math.sign(reflexDrive(c, {}, 302, key)), sign);
  });
}

test("tail touch pushes further forward than head touch (Chalfie et al. 1985)", () => {
  assert.ok(headTailContrast(c) > 0.2);
});

test("tail touch beats at least 95 percent of matched random pokes", () => {
  const s = specificity(c, {}, "touch-tail", 1, { draws: 50 });
  assert.ok(s.percentile >= 95, `percentile ${s.percentile}`);
});

// ---------- null graphs ----------

const degrees = (g, kind) => {
  const out = {}, inn = {};
  for (const e of g.edges.filter((x) => x.k === kind)) { out[e.s] = (out[e.s] || 0) + 1; inn[e.t] = (inn[e.t] || 0) + 1; }
  return { out, inn };
};

test("degree preserving rewire keeps every degree and the weights, with no loops or duplicates", () => {
  const r = rewire(c, 3);
  const a = degrees(c, "chem"), b = degrees(r, "chem");
  assert.deepEqual(a.out, b.out);
  assert.deepEqual(a.inn, b.inn);
  const gapDeg = (g) => { const d = {}; for (const e of g.edges.filter((x) => x.k === "gap")) { d[e.s] = (d[e.s] || 0) + 1; d[e.t] = (d[e.t] || 0) + 1; } return d; };
  assert.deepEqual(gapDeg(c), gapDeg(r));
  const ws = (g) => g.edges.map((e) => e.k + e.w).sort().join();
  assert.equal(ws(c), ws(r));
  const chemKeys = r.edges.filter((e) => e.k === "chem").map((e) => e.s + ">" + e.t);
  assert.equal(new Set(chemKeys).size, chemKeys.length);
  for (const e of r.edges) assert.notEqual(e.s, e.t);
  const same = c.edges.filter((e) => e.k === "chem").filter((e) => new Set(chemKeys).has(e.s + ">" + e.t)).length;
  assert.ok(same < 3709 * 0.2, `${same} chemical edges unchanged`);
});

test("random graph matches edge counts and weights", () => {
  const r = randomGraph(c, 3);
  assert.equal(r.edges.filter((e) => e.k === "chem").length, 3709);
  assert.equal(r.edges.filter((e) => e.k === "gap").length, 1105);
  const ws = (g) => g.edges.map((e) => e.k + e.w).sort().join();
  assert.equal(ws(c), ws(r));
  for (const e of r.edges) assert.notEqual(e.s, e.t);
});

// ---------- steering ----------

test("steering stays inside its ranges at extreme readouts", () => {
  const extremes = [
    { forward: 0, backward: 0, drive: 0, sensory: 0, arousal: 0, active: 0 },
    { forward: 1, backward: 0, drive: 1, sensory: 1, arousal: 1, active: 302 },
    { forward: 0, backward: 1, drive: -1, sensory: 1, arousal: 1, active: 302 },
    { forward: 0, backward: 1, drive: -1, sensory: 0, arousal: 0, active: 10 },
  ];
  for (const r of extremes) {
    const s = steer(r);
    assert.ok(s.options.temperature >= 0.1 && s.options.temperature <= 1.4, JSON.stringify(s.options));
    assert.ok(s.options.top_p >= 0.7 && s.options.top_p <= 0.98);
    assert.ok(s.options.repeat_penalty >= 1.05 && s.options.repeat_penalty <= 1.25);
    assert.ok(s.options.num_predict >= 120 && s.options.num_predict <= 600);
    assert.ok(["resting", "reversing", "foraging", "dwelling"].includes(s.mode));
  }
});

test("system prompt never asks the model to claim feelings or that the worm thinks for it", () => {
  for (const m of ["resting", "reversing", "foraging", "dwelling"]) {
    const p = systemPrompt(m);
    assert.match(p, /Never claim the worm is thinking for you/);
    assert.doesNotMatch(p, /you feel|your feelings|conscious/i);
  }
});

test("text becomes stimuli", () => {
  assert.ok(stimuliFromText("why is this broken?!").includes("noxious"));
  assert.ok(stimuliFromText("thanks, that is great").includes("food-smell"));
  assert.deepEqual(stimuliFromText("ok"), ["touch-tail"]);
  assert.deepEqual(stimuliFromText("I know the badge"), ["touch-tail"]);   // whole words only
});

test("text to stimuli never throws on odd input", () => {
  for (const x of ["", null, undefined, 42, {}, "\u{1F41B}".repeat(300), "x".repeat(200000), "\uD800", "ÄÖÜ ß ?"]) {
    const out = stimuliFromText(x);
    assert.ok(Array.isArray(out) && out.length >= 1);
    for (const k of out) assert.ok(k in STIMULI);
  }
  assert.ok(stimuliFromText("\u{1F41B}".repeat(281)).includes("touch-head"));   // counted in characters
});

// ---------- site build ----------

test("site build inlines the data and leaves no placeholders", () => {
  execFileSync(process.execPath, [new URL("../scripts/build_site.mjs", import.meta.url).pathname], { stdio: "pipe" });
  const html = fs.readFileSync(new URL("../site/index.html", import.meta.url), "utf8");
  assert.match(html, /const CONNECTOME = \{/);
  assert.match(html, /const GC_WINDOWS = \{/);
  assert.match(html, /class WormBrain/);
  assert.doesNotMatch(html, /__[A-Z_]+__/);
  assert.ok(html.length < 400 * 1024, `${(html.length / 1024).toFixed(0)} KB`);
});
