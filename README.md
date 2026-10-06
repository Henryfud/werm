<p align="center"><img src="site/assets/logo.png" alt="WERM logo" width="120"></p>

# WERM

**W**iring-**E**ncoded **R**ecurrent **M**odulator

A 302 neuron model built on the real wiring diagram of *Caenorhabditis elegans*, with a small steering layer that lets its state nudge a local language model. It runs in a browser tab, in Node, or connected to a language model on your own computer through Ollama or any OpenAI style local server.

[werm.si](https://werm.si) · [@WERM_si on X](https://x.com/WERM_si)

[![ci](https://github.com/Henryfud/werm/actions/workflows/ci.yml/badge.svg)](https://github.com/Henryfud/werm/actions/workflows/ci.yml)

The site in `site/` is a long scroll page with a generative pixel worm field, a live connectome globe, the genome drawn to scale from the real sequence, and long form notes. The code in `src/` is the same code the site runs.

## What is real here

- **The wiring.** `data/connectome.json` is the adult hermaphrodite network from Cook et al. 2019 ([doi:10.1038/s41586-019-1352-7](https://doi.org/10.1038/s41586-019-1352-7)), taken from the OpenWorm Connectome Toolbox. 302 neurons, 3,709 directed chemical connections and 1,105 gap junction pairs. Each connection's weight is the number of electron microscope sections in which the two cells were seen joined, not a synapse count.
- **The genome.** `data/gc_windows.json` and `data/gene_windows.json` were measured from the NCBI reference genome (RefSeq GCF_000002985.6, WBcel235) and its gene annotation (WormBase WS298) by scripts in this repo. 100,272,607 bases on six chromosomes, 35.4 percent GC, 19,971 protein coding genes.
- **The neuron model.** A rate network with a gate in the style of the liquid time constant networks of Hasani et al. 2021, run on that wiring. The 28 neurons that make and release GABA (Gendrel et al. 2016) are inhibitory. Everything else is excitatory.
- **The results.** Measured, with the scripts to rerun them. Summary below, details in [`docs/RESULTS.md`](docs/RESULTS.md).

## What is a design choice

- **Synapse signs.** A wiring diagram does not say which synapses excite and which inhibit. The GABA rule above is a simplification, explained in [`docs/NEUROTRANSMITTERS.md`](docs/NEUROTRANSMITTERS.md).
- **The parameters.** Four were picked by `scripts/sweep.mjs` over 1,470 settings, using a rule fixed before the results were seen. It is a tuned model, not a fit to recordings.
- **The steering.** The mapping from worm state to temperature, top_p and the rest is easy to see and easy to change. Neuroscience does not dictate it.

## Results

| question | answer |
| --- | --- |
| Does tail touch push the network forward? | Yes, strongly. It beats 100 out of 100 random pokes of the same size. |
| Does nose touch push it backward? | Yes. It beats 100 out of 100 random pokes. |
| Does head touch push it backward? | Only slightly. The wiring shows why: the head touch cells send most of their chemical output to the *forward* command cells. |
| Does a noxious stimulus push it backward? | No better than a random poke. |
| Does the real wiring matter? | For the head versus tail difference, yes. Each of 100 shuffled copies (same number of connections per neuron) got its own parameter sweep, and only 2 matched the real wiring. Of 100 random networks, 5 did. |
| Is the real wiring a better general signal processor? | No. On a memory benchmark it did slightly worse than its shuffles. |
| Does the steering change what a language model says? | Not measured. The test is written (`scripts/steer-eval.mjs`) and has not been run. |

## Quick start

```bash
git clone https://github.com/Henryfud/werm
cd werm
npm test
node src/cli.mjs sim --stim touch-tail --seconds 3
```

You need Node 20 or newer. The model has no runtime dependencies. `npm test` runs the unit tests without installing anything.

### Rerun the experiments

```bash
npm run sweep          # parameter sweep, writes docs/results/sweep.csv
npm run experiments    # null models and reservoir benchmark, writes docs/results/
```

They use every CPU core and take a few minutes.

## Run it locally with Ollama or any local engine

WERM runs entirely on your own computer. Connect it to a language model running locally and every message you send goes through the worm first: it pokes the worm's sensory neurons, the brain runs for a moment, and the worm's state sets the model's sampling settings and a one line tone. Nothing leaves your machine.

### With Ollama

1. Install Ollama from [ollama.com/download](https://ollama.com/download) and open it (or run `ollama serve`).
2. Download a model. Any model you have works, just use its name.
3. Connect the worm:

```bash
ollama pull llama3.2
node src/cli.mjs connect --model llama3.2
```

If Ollama is not running, or the model is missing, the command says so and tells you what to run. Use `--host` if Ollama is not on `http://localhost:11434`.

### With LM Studio, llama.cpp, vLLM or another engine

Anything that serves the OpenAI chat completions API works. Start the engine's local server, then point WERM at it with `--base-url` and the model name the server uses:

```bash
node src/cli.mjs connect --base-url http://localhost:1234/v1 --model YOUR_MODEL
```

| engine | how to start its server | `--base-url` |
| --- | --- | --- |
| LM Studio | Developer tab, start the local server | `http://localhost:1234/v1` |
| llama.cpp | `llama-server -m your-model.gguf` | `http://localhost:8080/v1` |
| vLLM | `vllm serve your-model` | `http://localhost:8000/v1` |
| Ollama, OpenAI style | runs with Ollama | `http://localhost:11434/v1` |

On these servers WERM sends `temperature`, `top_p` and `max_tokens`. The repeat penalty is not part of that API, so it is left out. If your server needs a key, set `WERM_API_KEY`.

### In your own code, with any engine

```bash
node src/cli.mjs steer "why is my code broken?"
```

prints what the worm would send for that message, without contacting any model:

```json
{
  "stimuli": ["nose-touch", "noxious"],
  "mode": "reversing",
  "ollama_options": { "temperature": 0.31, "top_p": 0.72, "repeat_penalty": 1.11, "num_predict": 159 },
  "openai_params": { "temperature": 0.31, "top_p": 0.72, "max_tokens": 159 },
  "system_prompt": "You are a helpful assistant whose tone is nudged by a simulated C. elegans nervous system. ..."
}
```

In JavaScript you can use the pieces directly:

```js
import fs from "node:fs";
import { WormBrain } from "./src/network.mjs";
import { steer, stimuliFromText, applyStimuli, systemPrompt } from "./src/steer.mjs";

const worm = new WormBrain(JSON.parse(fs.readFileSync("data/connectome.json", "utf8")));
worm.run(1);                                             // settle
applyStimuli(worm, stimuliFromText("thanks, that helped"), true);
worm.run(1.5);                                           // let the brain respond
const { options, mode } = steer(worm.readout());          // sampling settings, Ollama names
// send options and systemPrompt(mode) to your engine
```

### Does it change anything?

Not measured yet. `scripts/steer-eval.mjs` compares default settings, worm settings and random settings over 200 prompts:

```bash
node scripts/steer-eval.mjs --dry-run --limit 5     # offline, prints the planned settings
node scripts/steer-eval.mjs --model llama3.2        # the real run, needs Ollama
```

### Rebuild the genome maps

```bash
bash scripts/fetch_genome.sh                                   # about 100 MB from NCBI
node scripts/genome_stats.mjs data/genome/c_elegans.fasta
node scripts/gc_windows.mjs data/genome/c_elegans.fasta
bash scripts/fetch_annotation.sh                               # about 10 MB
node scripts/gene_windows.mjs data/genome/annotation.gff.gz
```

The downloads are git ignored. The site can also read the FASTA file locally and draw the GC map in your browser. Nothing is uploaded.

### Rebuild the connectome file

```bash
python3 -m venv .venv && .venv/bin/pip install openpyxl
.venv/bin/pip download cect==0.3.5 --no-deps -d dl
unzip -q dl/cect-*.whl -d dl/x
.venv/bin/python scripts/build_connectome.py dl/x/cect/data
```

### Rebuild the site

```bash
npm run build:site
```

Writes `site/index.html`. Set `GITHUB_URL` or `SITE_URL` to change the links on the page. Netlify builds the same way (`netlify.toml`).

### Checks

```bash
npm test               # unit tests, 36 of them
npm run check          # no em dashes in prose, data profile matches docs/research/02
npm ci && npx playwright install chromium && npm run test:site   # headless browser smoke test
```

CI runs all of these on Node 20 and 22.

## Layout

```
data/connectome.json        302 neurons and their connections
data/gc_windows.json        GC content per 100 kb, measured from the reference genome
data/gene_windows.json      protein coding genes per 100 kb, from the RefSeq annotation
data/eval-prompts.json      200 prompts for the steering evaluation
src/network.mjs             the neuron model
src/reflex.mjs              reflex checks, specificity against random pokes, head versus tail contrast
src/graphs.mjs              shuffled and random versions of the wiring
src/steer.mjs               worm state to sampling settings and tone
src/ollama.mjs              client for a local Ollama server
src/openai.mjs              client for any OpenAI style local server (LM Studio, llama.cpp, vLLM)
src/cli.mjs                 sim, connect and steer commands
scripts/                    data build, genome, sweep, experiments, checks, site build
site/template.html          the page, with placeholders
test/                       unit tests and the browser smoke test
docs/RESULTS.md             what has been measured
docs/ARCHITECTURE.md        the model, the readout, the steering, the site
docs/NEUROTRANSMITTERS.md   which neurons are inhibitory and why
docs/research/              research notes and the checked reading list
AUDIT.md                    what was checked and changed after the first version
```

## Limits, plainly

This is a small model on a real map. It has no muscles, no body physics, no neuropeptides and no learning. It has not been compared with recordings from real worms. It cannot tell you what a real worm would do. The steering layer does not give a language model new abilities, and its effect has not been measured.

If you want a faithful biophysical simulation, use [OpenWorm's c302](https://github.com/openworm/c302). This project is for people who want something small enough to take apart in an afternoon.

## Next

- Run the steering evaluation against a local model and add the numbers to `docs/RESULTS.md`.
- Pass the repeat penalty to OpenAI style servers that accept it as an extra field.
- A receptor based sign map, using the acetylcholine and glutamate maps (Pereira et al. 2015, Serrano-Saiz et al. 2013), to test the head touch explanation.
- A stronger model: fit parameters against a larger set of reflexes with a held out set, add slow neuromodulators, add habituation, compare with c302, and run on the developmental wiring of Witvliet et al. 2021.

## Credits

Wiring data: Cook et al. 2019, via the OpenWorm Connectome Toolbox. GABA map: Gendrel, Atlas and Hobert 2016. Genome: the *C. elegans* Sequencing Consortium, NCBI RefSeq and WormBase. The liquid time constant idea: Hasani, Lechner, Amini, Rus and Grosu. Everything about the worm: the *C. elegans* community. Every citation, with its checked status, is in [`docs/research/07-reading-list.md`](docs/research/07-reading-list.md).

MIT licensed.
