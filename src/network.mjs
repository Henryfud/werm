// WERM: a liquid time-constant style rate network on the real C. elegans wiring diagram.
//
// What this is: 302 units wired exactly like the Cook et al. 2019 hermaphrodite connectome,
// each with its own leaky state that speeds up or slows down depending on how much input it gets
// (the "liquid" part, after Hasani et al. 2021).
//
// What this is not: a Hodgkin-Huxley model or a faithful emulation. Real synapse signs are
// mostly unknown from wiring alone, so signs here are an approximation (see SIGNS below).

// The "conventional" GABA neurons of the adult hermaphrodite, the ones that make GABA and release it at
// synapses (Gendrel, Atlas and Hobert 2016, eLife 5:e17686, Table 1). Their chemical output is treated as
// inhibitory and everything else as excitatory. Cells that only take up GABA, or hold it by unknown means
// (ALA, AVF, AVA, AVB, AVJ, SMD), are left excitatory. A simplification. See docs/NEUROTRANSMITTERS.md.
export const GABA = new Set([
  "RMED", "RMEV", "RMEL", "RMER", "AVL", "DVB", "RIS", "RIBL", "RIBR",
  ...Array.from({ length: 6 }, (_, i) => `DD${i + 1}`),
  ...Array.from({ length: 13 }, (_, i) => `VD${i + 1}`),
]);

// Chosen by scripts/sweep.mjs with a rule fixed before the results were seen: stay quiet at rest for 30 s,
// pass the most reflex sign checks, then take the largest head versus tail contrast. Table: docs/results/sweep.csv.
export const PARAMS = {
  tau: 0.4,           // base time constant, seconds
  dt: 0.005,          // integration step, seconds
  gain: 9.0,          // steepness of the activation curve
  threshold: 0.3,     // where the activation curve is half open
  amp: 2.0,           // how high a fully driven neuron can climb
  fSlope: 4.0,        // how sharply input opens the liquid gate
  fOffset: 0.9,       // how much input it takes to open the gate halfway
  chemScale: 2.4,     // overall chemical synapse strength
  normPow: 0.75,      // how hard each neuron divides by how much it listens to (1 = pure average)
  inhib: 20.0,         // global inhibition pulled from the average activity of the whole net
  gapScale: 0.55,     // overall gap junction strength
  noise: 0.012,       // small seeded noise so the worm never sits perfectly still
  baseDrive: 0.0,     // constant background input
};

export const STIMULI = {
  "touch-head": { label: "Touch the head", cells: ["ALML", "ALMR", "AVM"], amp: 1.6 },
  "touch-tail": { label: "Touch the tail", cells: ["PLML", "PLMR"], amp: 1.6 },
  "food-smell": { label: "Smell food", cells: ["AWAL", "AWAR", "AWCL", "AWCR", "ASEL", "ASER"], amp: 1.3 },
  "nose-touch": { label: "Bump into something", cells: ["ASHL", "ASHR", "FLPL", "FLPR", "OLQDL", "OLQDR", "OLQVL", "OLQVR"], amp: 1.5 },
  "noxious": { label: "Something nasty", cells: ["ASHL", "ASHR", "ADLL", "ADLR"], amp: 1.6 },
};

// Where a neuron settles with zero drive: set dx/dt = 0 with f = sigmoid(-fSlope * fOffset).
// Activation is measured from this point, so a network with no input stays at rest instead of slowly igniting.
export function restState({ tau, amp, fSlope, fOffset }) {
  const f0 = 1 / (1 + Math.exp(fSlope * fOffset));
  return (f0 * amp) / (1 / tau + f0);
}

// small seeded PRNG so runs are reproducible
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class WormBrain {
  constructor(connectome, params = {}, seed = 302) {
    this.p = { ...PARAMS, ...params };
    this.rand = mulberry32(seed);
    this.ids = connectome.neurons.map((n) => n.id);
    this.index = new Map(this.ids.map((id, i) => [id, i]));
    this.meta = connectome.neurons;
    const N = this.ids.length;
    this.N = N;

    // incoming edge lists, with weights compressed so a few huge synapses cannot run the show
    this.chemIn = Array.from({ length: N }, () => []);
    this.gapIn = Array.from({ length: N }, () => []);
    for (const e of connectome.edges) {
      const s = this.index.get(e.s), t = this.index.get(e.t);
      if (s === undefined || t === undefined) continue;
      const w = Math.log1p(e.w);
      if (e.k === "chem") {
        this.chemIn[t].push([s, (GABA.has(e.s) ? -1 : 1) * w]);
      } else {
        this.gapIn[t].push([s, w]);
        this.gapIn[s].push([t, w]);
      }
    }
    // normalise by how much each neuron listens to, so deep hubs do not saturate
    const np = this.p.normPow;
    this.chemNorm = this.chemIn.map((l) => 1 / Math.max(1.5, Math.pow(l.reduce((a, [, w]) => a + Math.abs(w), 0), np)));
    this.gapNorm = this.gapIn.map((l) => 1 / Math.max(1.5, Math.pow(l.reduce((a, [, w]) => a + w, 0), np)));

    // start every neuron at the point it settles to with no input at all
    this.xRest = restState(this.p);
    this.x = new Float64Array(N).fill(this.xRest);
    this.act = new Float64Array(N);
    this.ext = new Float64Array(N);
    this.t = 0;
    this._refreshActivation();
  }

  _refreshActivation() {
    const { gain, threshold } = this.p;
    // subtract what a resting neuron puts out, so a quiet worm is quiet
    const base = 1 / (1 + Math.exp(-gain * (this.xRest - threshold)));
    for (let i = 0; i < this.N; i++) {
      const a = 1 / (1 + Math.exp(-gain * (this.x[i] - threshold)));
      this.act[i] = Math.max(0, (a - base) / (1 - base));
    }
  }

  // drive a named set of neurons with extra current. amp 0 switches it off.
  setInput(names, amp) {
    for (const n of names) {
      const i = this.index.get(n);
      if (i !== undefined) this.ext[i] = amp;
    }
  }
  clearInput() { this.ext.fill(0); }
  stimulate(key, on = true) {
    const s = STIMULI[key];
    if (s) this.setInput(s.cells, on ? s.amp : 0);
  }

  step() {
    const { tau, dt, chemScale, gapScale, noise, baseDrive, amp, fSlope, fOffset, inhib } = this.p;
    const N = this.N, x = this.x, act = this.act;
    let meanAct = 0;
    for (let i = 0; i < N; i++) meanAct += act[i];
    meanAct /= N;
    const next = new Float64Array(N);
    for (let i = 0; i < N; i++) {
      let chem = 0;
      const ci = this.chemIn[i];
      for (let k = 0; k < ci.length; k++) chem += ci[k][1] * act[ci[k][0]];
      let gap = 0;
      const gi = this.gapIn[i];
      for (let k = 0; k < gi.length; k++) gap += gi[k][1] * (x[gi[k][0]] - x[i]);
      const drive = chemScale * chem * this.chemNorm[i] * 2.2 + gapScale * gap * this.gapNorm[i] * 2.2 + this.ext[i] + baseDrive - inhib * meanAct;
      // liquid time constant: input opens the gate f, which both speeds the decay and pulls toward the target
      const f = 1 / (1 + Math.exp(-fSlope * (drive - fOffset)));
      const dx = -(1 / tau + f) * x[i] + f * amp + (this.rand() - 0.5) * noise * 2;
      next[i] = Math.min(1.5, Math.max(0, x[i] + dt * dx));
    }
    this.x = next;
    this._refreshActivation();
    this.t += dt;
  }

  run(seconds) {
    const n = Math.round(seconds / this.p.dt);
    for (let i = 0; i < n; i++) this.step();
  }

  // average activation of a group of neurons by name list or regex
  mean(match) {
    let s = 0, c = 0;
    for (let i = 0; i < this.N; i++) {
      const id = this.ids[i];
      if (Array.isArray(match) ? match.includes(id) : match.test(id)) { s += this.act[i]; c++; }
    }
    return c ? s / c : 0;
  }

  // the numbers the rest of the project uses
  readout() {
    const forward = this.mean(/^(AVB[LR]|PVC[LR])$/);
    const backward = this.mean(/^(AVA[LR]|AVD[LR]|AVE[LR])$/);
    const motorFwd = this.mean(/^(DB\d+|VB\d+)$/);
    const motorBack = this.mean(/^(DA\d+|VA\d+)$/);
    const sensory = this.meta.filter((m) => m.class === "sensory");
    let sa = 0;
    for (const m of sensory) sa += this.act[this.index.get(m.id)];
    sa /= Math.max(1, sensory.length);
    let all = 0;
    for (let i = 0; i < this.N; i++) all += this.act[i];
    all /= this.N;
    let active = 0;
    for (let i = 0; i < this.N; i++) if (this.act[i] > 0.5) active++;
    return {
      forward, backward, motorFwd, motorBack,
      drive: forward - backward,            // positive: crawling forward, negative: backing up
      sensory: sa,
      arousal: all,
      active,                                // neurons above half activation
      t: this.t,
    };
  }
}
