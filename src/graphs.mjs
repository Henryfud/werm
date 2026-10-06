// Null model graphs: randomised copies of the wiring that keep some properties and destroy the rest.
// Used by scripts/null-models.mjs and scripts/reservoir.mjs, and by the compare toggle on the site.
//
// Both functions return a new connectome object with the same neurons. Edge weights travel with their edge.
// Neuron properties (name, class, GABA sign, which cells a stimulus pokes) are untouched, so every
// randomised graph can be run with exactly the same code as the real one.

import { mulberry32 } from "./network.mjs";

const pick = (rand, n) => Math.floor(rand() * n);

// Maslov and Sneppen (2002) degree preserving rewiring.
// Chemical edges are directed: every neuron keeps its exact in degree and out degree.
// Gap junctions are undirected and are rewired as their own graph: every neuron keeps its gap degree.
// No self loops and no duplicate edges are created.
export function rewire(connectome, seed = 1, swapsPerEdge = 10) {
  const rand = mulberry32(seed);
  const chem = connectome.edges.filter((e) => e.k === "chem").map((e) => ({ ...e }));
  const gap = connectome.edges.filter((e) => e.k === "gap").map((e) => ({ ...e }));

  const key = (a, b) => a + ">" + b;
  const chemSet = new Set(chem.map((e) => key(e.s, e.t)));
  for (let n = 0, tries = 0; n < chem.length * swapsPerEdge && tries < chem.length * swapsPerEdge * 20; tries++) {
    const e1 = chem[pick(rand, chem.length)], e2 = chem[pick(rand, chem.length)];
    if (e1 === e2 || e1.s === e2.t || e2.s === e1.t) continue;
    if (chemSet.has(key(e1.s, e2.t)) || chemSet.has(key(e2.s, e1.t))) continue;
    chemSet.delete(key(e1.s, e1.t)); chemSet.delete(key(e2.s, e2.t));
    [e1.t, e2.t] = [e2.t, e1.t];
    chemSet.add(key(e1.s, e1.t)); chemSet.add(key(e2.s, e2.t));
    n++;
  }

  const ukey = (a, b) => (a < b ? a + "|" + b : b + "|" + a);
  const gapSet = new Set(gap.map((e) => ukey(e.s, e.t)));
  for (let n = 0, tries = 0; n < gap.length * swapsPerEdge && tries < gap.length * swapsPerEdge * 20; tries++) {
    const e1 = gap[pick(rand, gap.length)], e2 = gap[pick(rand, gap.length)];
    if (e1 === e2) continue;
    // an undirected edge can be read either way round, so flip one at random before swapping ends
    if (rand() < 0.5) [e2.s, e2.t] = [e2.t, e2.s];
    const a = e1.s, b = e1.t, c = e2.s, d = e2.t;
    if (a === d || c === b) continue;
    if (gapSet.has(ukey(a, d)) || gapSet.has(ukey(c, b))) continue;
    gapSet.delete(ukey(a, b)); gapSet.delete(ukey(c, d));
    e1.t = d; e2.t = b;
    gapSet.add(ukey(a, d)); gapSet.add(ukey(c, b));
    n++;
  }
  return { ...connectome, source: `${connectome.source}, degree preserving rewire seed ${seed}`, edges: [...chem, ...gap] };
}

// Erdos Renyi style graph with the same number of chemical and gap edges, placed uniformly at random.
// Degrees are not preserved. The real weights are shuffled onto the new edges, so the weight distribution matches.
export function randomGraph(connectome, seed = 1) {
  const rand = mulberry32(seed);
  const ids = connectome.neurons.map((n) => n.id);
  const N = ids.length;
  const chemW = connectome.edges.filter((e) => e.k === "chem").map((e) => e.w);
  const gapW = connectome.edges.filter((e) => e.k === "gap").map((e) => e.w);
  const shuffle = (arr) => { for (let i = arr.length - 1; i > 0; i--) { const j = pick(rand, i + 1); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };
  shuffle(chemW); shuffle(gapW);
  const edges = [];
  const seen = new Set();
  while (edges.length < chemW.length) {
    const a = pick(rand, N), b = pick(rand, N);
    if (a === b || seen.has(a * N + b)) continue;
    seen.add(a * N + b);
    edges.push({ s: ids[a], t: ids[b], w: chemW[edges.length], k: "chem" });
  }
  const seenGap = new Set();
  let g = 0;
  while (g < gapW.length) {
    const a = pick(rand, N), b = pick(rand, N);
    if (a === b) continue;
    const k = Math.min(a, b) * N + Math.max(a, b);
    if (seenGap.has(k)) continue;
    seenGap.add(k);
    edges.push({ s: ids[a], t: ids[b], w: gapW[g++], k: "gap" });
  }
  return { ...connectome, source: `random graph seed ${seed}`, edges };
}
