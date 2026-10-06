# Architecture

Four layers, each replaceable.

```
wiring (data/connectome.json)
   -> neuron model (src/network.mjs)
        -> readout (forward, backward, arousal, active count)
             -> steering (src/steer.mjs) -> local model via Ollama
             -> body drawing and globe (site/template.html)
```

## 1. Wiring

`scripts/build_connectome.py` reads the Cook 2019 supplementary workbook (adjacency matrices for chemical synapses and symmetric gap junctions) and writes one JSON file.

```json
{
  "source": "...",
  "neurons": [{ "id": "AVAL", "class": "inter", "type": "...", "lineage": "..." }],
  "edges": [{ "s": "ALML", "t": "AVDL", "w": 3, "k": "chem" }]
}
```

- `k` is `chem` (directed, one way) or `gap` (stored once, applied both ways).
- `w` is the value from the source matrix: the number of electron microscope serial sections in which the two cells were seen joined (the workbook legend says this takes into account both the number and the size of synapses). It is not a synapse count.
- Matrix labels are zero padded (`DA01`). Names are normalised to the WormAtlas form (`DA1`).
- `class` is a coarse grouping derived from the WormAtlas cell type: sensory 83, inter 87, motor 125, other 7 (CAN, MC, MI, NSM).

## 2. Neuron model

State: one number `x` per neuron, between 0 and 1.5.

```
x_rest = f0 * amp / (1/tau + f0),  f0 = sigmoid(-fSlope * fOffset)          where a neuron with no input settles
base  = sigmoid(gain * (x_rest - threshold))
a_i   = max(0, (sigmoid(gain * (x_i - threshold)) - base) / (1 - base))      activation, zero at rest
chem_i = sum_j sign_j * log(1 + w_ji) * a_j / norm_i                          chemical input
gap_i  = sum_j log(1 + g_ij) * (x_j - x_i) / norm_i                           electrical input
drive_i = chemScale * chem_i * 2.2 + gapScale * gap_i * 2.2 + ext_i - inhib * mean(a)
f_i   = sigmoid(fSlope * (drive_i - fOffset))                                  the liquid gate
dx_i/dt = -(1/tau + f_i) * x_i + f_i * amp + noise
```

- `norm_i = max(1.5, (total incoming weight)^normPow)`. Without a normalisation like this, hubs saturate.
- `inhib * mean(a)` is a global inhibition term. The network was bistable without it (dead or fully saturated). It is a stabiliser, not a claim about anatomy.
- `sign_j` is -1 for the 28 conventional GABA neurons in `GABA`, +1 otherwise. See `NEUROTRANSMITTERS.md`.
- Every neuron starts at `x_rest`. With no input and no noise, the network stays exactly there.
- Integration is forward Euler at `dt = 5 ms`. The noise is seeded, so runs repeat.

Defaults live in `PARAMS` in `src/network.mjs`. `chemScale`, `inhib`, `fOffset` and `threshold` were chosen by `scripts/sweep.mjs` (1,470 settings) with a rule fixed in advance: quiet at rest for 30 s, best reflex sign score, then largest head versus tail contrast. That is a fit to qualitative literature, not to recordings. See `RESULTS.md`.

## 3. Readout

`WormBrain.readout()` returns:

| field | meaning |
| --- | --- |
| `forward` | mean activation of AVB and PVC (forward command interneurons) |
| `backward` | mean activation of AVA, AVD, AVE (backward command interneurons) |
| `motorFwd`, `motorBack` | mean activation of DB and VB, and of DA and VA motor neurons |
| `drive` | forward minus backward |
| `sensory` | mean activation of sensory neurons |
| `arousal` | mean activation of all 302 |
| `active` | count of neurons above half activation |

## 4. Reflexes and null models

`src/reflex.mjs` holds the reflex measurements shared by the tests, the sweep and the experiments: `reflexDrive` (one trial), `scoreReflexes` (sign checks), `specificity` (a stimulus against matched random pokes of sensory neurons) and `headTailContrast`.

`src/graphs.mjs` makes fake wiring with the same neurons: `rewire` (Maslov and Sneppen degree preserving swaps, chemical and gap junction graphs separately, weights travel with edges) and `randomGraph` (same edge counts and weights, placed at random). Both return a connectome object that `WormBrain` runs unchanged.

## 5. Steering

`steer(readout)` returns sampling options with Ollama's option names, a mood label (`resting`, `reversing`, `foraging`, `dwelling`) and a one line summary. `systemPrompt(mode)` returns a short tone instruction for the model. `stimuliFromText(text)` pokes sensory groups based on cheap text features.

All of this is a design choice and meant to be edited. See `docs/research/06-steering-theory.md` for the reasoning and for the experiments worth running before trusting it.

## 6. Site

`site/template.html` contains the page. `scripts/build_site.mjs` inlines the connectome, the genome windows, the null model summary, the logo and the code from `src/network.mjs`, `src/steer.mjs` and `src/graphs.mjs` (imports and exports stripped), and writes `site/index.html` and `site/artifact.html`. It fails if any placeholder is left. The page has these parts:

- A fixed canvas rendered at about one fifth resolution. Kinematic worms are drawn into an offscreen buffer, then a 4 by 4 ordered dither maps intensity to a five colour palette. A procedural terrain edge scrolls with the page.
- A globe canvas with 302 projected points, arcs for active chemical connections, drag to rotate, click to fire a neuron.
- A compare panel that runs a second brain on a degree preserving shuffle (`rewire(CONNECTOME, 1)`) with the same inputs.
- A body canvas using the same pixel renderer, with one worm driven by the motor readout.
- Chromosome bars to scale, each drawn as a GC strip and a gene density strip from the committed 100 kb windows, and a local FASTA reader that streams a file in 4 MB slices and draws the same GC map in the browser.
- Long form notes with sources.

## Tests

`npm test` runs `test/*.test.mjs`: data invariants, quiet at rest for 30 s, the rest point is a fixed point, bounds, determinism and a recorded snapshot, the four reflex signs, the head versus tail contrast, tail touch specificity, the null graph invariants, steering ranges at extreme readouts, the system prompt, text to stimuli on odd input, the site build, and the steering evaluation planner. `npm run test:site` loads the built page in headless Chromium.
