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
- `w` is the count from the source matrix.
- Matrix labels are zero padded (`DA01`). Names are normalised to the WormAtlas form (`DA1`).
- `class` is a coarse grouping derived from the WormAtlas cell type: sensory, inter, motor, other.

## 2. Neuron model

State: one number `x` per neuron, between 0 and 1.5.

```
a_i   = max(0, (sigmoid(gain * (x_i - threshold)) - base) / (1 - base))      activation, zero at rest
chem_i = sum_j sign_j * log(1 + w_ji) * a_j / norm_i                          chemical input
gap_i  = sum_j log(1 + g_ij) * (x_j - x_i) / norm_i                           electrical input
drive_i = chemScale * chem_i * 2.2 + gapScale * gap_i * 2.2 + ext_i - inhib * mean(a)
f_i   = sigmoid(fSlope * (drive_i - fOffset))                                  the liquid gate
dx_i/dt = -(1/tau + f_i) * x_i + f_i * amp + noise
```

- `norm_i = max(1.5, (total incoming weight)^normPow)`. Without a normalisation like this, hubs saturate.
- `inhib * mean(a)` is a global inhibition term. The network was bistable without it (dead or fully saturated). It is a stabiliser, not a claim about anatomy.
- `sign_j` is -1 for the GABA set in `GABA`, +1 otherwise.
- Integration is forward Euler at `dt = 5 ms`. The noise is seeded, so runs repeat.

Defaults live in `PARAMS` in `src/network.mjs`. The values were chosen by sweeping over `chemScale`, `inhib`, `fOffset` and `threshold` and scoring how many touch reflexes came out with the right sign across seeds. That is a hand tuned fit to qualitative literature, not a fit to recordings.

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

## 4. Steering

`steer(readout)` returns sampling options with Ollama's option names, a mood label (`resting`, `reversing`, `foraging`, `dwelling`) and a one line summary. `systemPrompt(mode)` returns a short tone instruction for the model. `stimuliFromText(text)` pokes sensory groups based on cheap text features.

All of this is a design choice and meant to be edited. See `docs/research/06-steering-theory.md` for the reasoning and for the experiments worth running before trusting it.

## 5. Site

`site/template.html` contains the page. `scripts/build_site.mjs` inlines the connectome and the code from `src/network.mjs` and `src/steer.mjs` (imports and exports stripped) and writes `site/index.html` and `site/artifact.html`. The page has these parts:

- A fixed canvas rendered at about one fifth resolution. Kinematic worms are drawn into an offscreen buffer, then a 4 by 4 ordered dither maps intensity to a five colour palette. A procedural terrain edge scrolls with the page.
- A globe canvas with 302 projected points, arcs for active chemical synapses, drag to rotate, click to fire a neuron.
- A body canvas using the same pixel renderer, with one worm driven by the motor readout.
- Chromosome bars from the real lengths, and a local FASTA reader that streams the file in 4 MB slices and draws a GC map from 100 kb windows.
- Long form notes with sources.

## Tests

`npm test` runs `test/network.test.mjs`: the data has 302 neurons and valid edges, a resting worm is quiet, runs are deterministic, stimulation spreads, three reflex checks pass (head touch is marked as a known miss), steering outputs stay in range, text maps to stimuli.
