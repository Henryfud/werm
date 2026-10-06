# WERM

**W**iring-**E**ncoded **R**ecurrent **M**odulator

A 302 neuron model built on the real wiring diagram of *Caenorhabditis elegans*, with a small steering layer that lets its state nudge a local language model. It runs in a browser tab, in Node, or in a terminal chat against Ollama.

The site in `site/` is a long scroll page with a generative pixel worm field, a live connectome globe, a genome viewer drawn to scale, and long form notes. The code in `src/` is the same code the site runs.

## What is real here

- **The wiring.** `data/connectome.json` is the adult hermaphrodite network from Cook et al. 2019 (Nature 571, 63 to 71), taken from the OpenWorm Connectome Toolbox. 302 neurons, 3,709 directed chemical connections, 1,105 gap junction pairs between neurons.
- **The genome numbers.** Chromosome lengths and accessions come from the NCBI RefSeq record for assembly GCF_000002985.6. Gene counts come from WormBase.
- **The neuron model.** A liquid time constant style rate network after Hasani et al. 2021, run on that wiring.
- **The steering.** A few sampling settings and a tone instruction, sent to a model running on your own machine.

## What is a design choice

- Synapse signs. Wiring does not say which synapses excite and which inhibit. A short list of known GABAergic cells is treated as inhibitory and everything else as excitatory.
- The parameters. They were tuned by hand until touch inputs gave the reflexes in the literature. Three of the four reflex checks pass. Head touch is a known miss and is marked as such in `test/network.test.mjs`.
- The mapping from worm state to temperature, top_p and the rest. It is easy to see and easy to change. Neuroscience does not dictate it.

Details and sources are in `docs/`.

## Quick start

```bash
git clone https://github.com/Henryfud/werm
cd werm
npm test
node src/cli.mjs sim --stim touch-tail --seconds 3
```

You need Node 20 or newer. There are no runtime dependencies.

### Chat with a worm steered local model

```bash
ollama pull llama3.2
node src/cli.mjs chat --model llama3.2
```

Each message pokes the worm (a question, a thank you, an angry word, a long paste), the network runs for a moment, and its state becomes sampling settings and a tone line for the model. The terminal prints both so you can see the link.

### Get the genome

```bash
bash scripts/fetch_genome.sh
node scripts/genome_stats.mjs data/genome/c_elegans.fasta
```

This downloads the six chromosomes and the mitochondrial genome from NCBI by accession and joins them into one FASTA file of about 100 MB. The file is git ignored. The site can read it locally and draw a GC map, nothing is uploaded.

### Rebuild the site

```bash
npm run build:site
```

Writes `site/index.html`. Set `GITHUB_URL` to change the repo link on the page.

### Rebuild the connectome file

```bash
pip download cect --no-deps -d dl
unzip dl/cect-*.whl -d dl/x
pip install openpyxl
python3 scripts/build_connectome.py dl/x/cect/data
```

## Layout

```
data/connectome.json        302 neurons and their connections
src/network.mjs             the neuron model
src/steer.mjs               worm state to sampling settings and tone
src/ollama.mjs              tiny client for a local Ollama server
src/cli.mjs                 sim and chat commands
scripts/                    data build, genome fetch, genome stats, site build
site/template.html          the page, with placeholders
test/network.test.mjs       determinism, quiet at rest, spreading, reflex checks, steering ranges
docs/                       architecture and research notes
```

## Limits, plainly

This is a small model on a real map. It has no muscles, no body physics, no neuropeptides and no learning. It cannot tell you what a real worm would do. The steering layer does not give a language model new abilities. It changes how the model talks.

If you want a faithful biophysical simulation, use [OpenWorm](https://github.com/openworm/c302). This project is for people who want something small enough to take apart in an afternoon.

## Credits

Wiring data: Cook et al. 2019, via the OpenWorm Connectome Toolbox. The liquid time constant idea: Hasani, Lechner, Amini, Rus and Grosu. Everything about the worm: the C. elegans community.

MIT licensed.
