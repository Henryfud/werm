# WERM handoff for Claude Code

**WERM = Wiring-Encoded Recurrent Modulator.**
A 302 neuron network built on the measured wiring diagram of *Caenorhabditis elegans*, a long scroll website to present it, and a small layer that lets the network's state steer the sampling settings of a local language model.

This file is written for you, Claude Code. Read all of it before you touch anything.

---

## 0. What you are being asked to do

You are inheriting a finished first pass. Everything in this zip was built in one long session in a sandbox that could not reach NCBI and could not push to GitHub. Your job has four parts, in this order.

1. **Go over the GitHub material.** Everything under `repo/` is meant to be pushed to GitHub as one repository named `werm`. Before you add anything, audit all of it: the code, the data, the tests, the docs, the site, and every number and citation. Section 4 tells you exactly how. Do not skip this, and do not start new features first. The code was tuned by hand under time pressure and several claims were written from memory.
2. **Close the verification gaps.** Section 6 lists every known issue. Fix the wording or the code. Where a fact cannot be verified, remove it or mark it clearly.
3. **Build the missing pieces.** Section 7 is the roadmap with acceptance criteria. The most valuable items are the genome fetch, the null model experiment (does the real wiring beat shuffled wiring) and the steering evaluation.
4. **Publish.** Section 13. Ask the user before you create a public repository or push anything.

The research pack is in `repo/docs/research/`. Seven files, about ten thousand words, each marked line by line as seen in a source, computed from the data, or recalled from memory. Treat the recalled items as leads to check, not as facts.

---

## 1. The project in one page

**Idea.** A previous conversation started from a fly brain model, then looked at Sorocarp (a slime mould that "trades", at sorolabs.si) as an example of a biological system presented as an engine with a live visual as proof. The user wanted something different. They chose the worm *C. elegans* because it is the one animal whose whole nervous system has been mapped, with 302 neurons and a few thousand connections, small enough to show on one screen and run in a browser tab.

**What exists.**

- A neuron model on the real wiring (`src/network.mjs`).
- A steering layer from network state to local LLM sampling options and a tone line (`src/steer.mjs`), plus an Ollama client and a CLI (`src/cli.mjs`).
- A cleaned connectome file (`data/connectome.json`) and the script that builds it.
- A long single page website (`site/`) with a fixed pixel dithered field of generative worms that react to scroll, a rotating connectome globe you can poke, a body canvas driven by the network, chromosome bars to scale, a local FASTA reader that draws a GC map, and long form notes with sources.
- A test suite, a genome fetch script, a genome stats script, a site build script.
- Research notes and this handoff.

**What the user asked for, in their words, condensed.**

- The project is a website plus a GitHub repo, linked to each other.
- It should use the genome and the biology of the worm, in real depth, with a very long write up.
- The visual direction is the reference image in `reference/`: navy ground, purple and magenta dither, blue, lime accent, mono and grotesque type. Imagine generative worms wiggling around the screen as you scroll, with scroll animations throughout, plus a globe with arcs like the second reference image.
- Use real science. Say "theory" occasionally where the claim really is a theory, but do not overuse it.
- The name is **WERM**. The acronym is Wiring-Encoded Recurrent Modulator.
- There is **no coin and no token** in this project. It is a conceptual build.
- The hero line explains C. elegans in a playful, simple way for ordinary readers.

---

## 2. Rules about writing and tone

These come from the user. Follow them in every file you write or edit.

- No em dashes and no double hyphens in prose. Use a comma, a period or a new sentence. (CSS custom properties and command line flags are code and are fine.)
- The copy should sound like a person wrote it. Short sentences. Plain words. No brochure language. No stock phrases.
- Where a reader might not know a term, explain it simply. Playfulness is welcome in small doses.
- Do not add unsolicited warnings or disclaimers beyond what the project's honesty section already states. The honest limits section exists once. Do not sprinkle caveats through every page.
- When you need a decision from the user, ask a direct multiple choice question with two to four options and a recommended first option. Avoid open ended questions.
- Do not describe the project as fictional or hypothetical. Describe what it is: a real model on real data, with specific stated limits.
- Be consistent. If a name, number or term appears in more than one place, use the same one everywhere.

---

## 3. Inventory

```
repo/
  README.md                       entry point, quick start, what is real and what is a design choice
  CLAUDE.md                       short rules file for future Claude Code sessions in this repo
  HANDOFF.md                      this file
  LICENSE                         MIT
  package.json                    scripts: test, sim, chat, build:site, build:data
  .gitignore                      excludes node_modules and data/genome
  data/connectome.json            302 neurons, 4,814 connection records
  src/network.mjs                 WormBrain class, PARAMS, STIMULI, GABA set, seeded PRNG
  src/steer.mjs                   steer(), mood(), systemPrompt(), stimuliFromText(), applyStimuli()
  src/ollama.mjs                  fetch client for a local Ollama server
  src/cli.mjs                     `sim` and `chat` commands
  scripts/build_connectome.py     workbook to JSON (needs openpyxl and the cect package contents)
  scripts/build_site.mjs          inlines data and code into the template
  scripts/fetch_genome.sh         downloads the reference genome from NCBI
  scripts/genome_stats.mjs        length and GC per FASTA record
  site/template.html              the page, with placeholders
  site/index.html                 built full page (generated)
  site/artifact.html              built fragment for hosts that wrap the page (generated)
  test/network.test.mjs           10 tests, 9 pass, 1 todo (known miss)
  docs/ARCHITECTURE.md            the model, the readout, the steering, the site
  docs/research/01 to 07          research pack
reference/
  reference-1-hero.png            the hero aesthetic the user likes (navy, purple dither, lime)
  reference-2-globe.png           the globe with arcs
```

A private preview of the built site was published from the original session. Ask the user for the link if you need it. Do not rely on it, rebuild from `site/template.html`.

---

## 4. The audit: go over the GitHub material

Work through this list top to bottom. Keep a running file `AUDIT.md` at the repo root recording what you checked, what you changed and what you could not verify. Commit it.

### 4.1 Run everything first

```bash
cd repo
node --version                # needs 20 or newer
npm test
node src/cli.mjs sim --stim touch-tail --seconds 3
node src/cli.mjs sim --stim touch-head --seconds 3
node scripts/build_site.mjs
```

Expected: 9 tests pass and 1 is marked todo (the head touch reflex check). The site builds to about 286 KB. If anything differs, find out why before moving on.

Then open `site/index.html` in a real browser and check the console. The original session verified: no console errors in headless Chromium, page width does not overflow at 400 px, the globe animates, arcs light up under stimulation.

### 4.2 Data (`data/connectome.json`, `scripts/build_connectome.py`)

1. Rebuild the file from source and confirm it is byte for byte identical.

   ```bash
   mkdir -p dl && pip download cect --no-deps -d dl
   unzip -q dl/cect-*.whl -d dl/x
   pip install openpyxl
   python3 scripts/build_connectome.py dl/x/cect/data
   git diff --stat data/connectome.json
   ```

2. Confirm 302 neurons, 3,709 chemical connections and 1,105 gap junction pairs.
3. Resolve the weight discrepancy. The sum of chemical edge weights is 20,965 while the 1986 paper reports about 7,000 synapses. See research file 02, section 2.2. Read the legend sheet in the Cook 2019 workbook and the paper's Methods, then correct any wording that calls edge weight "synapses".
4. Check the neuron classification. 21 neurons are in an "other" class because the keyword matching missed them. Improve it using WormAtlas classes. Keep the four class names the site uses, or update the site.
5. Spot check at least 25 random edges against NemaNode or the original supplementary tables.
6. Confirm that CANL and CANR are present and have edges.

### 4.3 Model (`src/network.mjs`)

1. Read the whole file against `docs/ARCHITECTURE.md`. The equations in the docs must match the code exactly. Fix whichever is wrong.
2. The `PARAMS` were chosen by a sweep that is not in the repo. Reproduce it in `scripts/sweep.mjs`, commit it, and commit the output table. See research file 03, section 3.6.
3. Check numerical behaviour. `dt` is 5 ms with forward Euler. Verify results do not change materially at `dt` of 2.5 ms.
4. `readout()` uses regular expressions on neuron names (`AVB[LR]`, `PVC[LR]`, `AVA/AVD/AVE`, `DB\d+`, and so on). Confirm each matches the intended cells in the data and no others. Print the matched lists.
5. The GABA set includes DD1 to DD6 and VD1 to VD13, RMED, RMEV, RMEL, RMER, AVL, DVB, RIS. Check it against Gendrel et al. 2016 and correct it. Document the final list in the docs.
6. Seeded noise: confirm the same seed always gives identical results across Node versions.
7. Performance: one step is 302 neurons with about 16 incoming edges each. Confirm it runs thousands of steps per second in Node and in the browser.

### 4.4 Steering (`src/steer.mjs`, `src/ollama.mjs`, `src/cli.mjs`)

1. Install Ollama, pull a small model and run `node src/cli.mjs chat --model llama3.2`. Make sure the loop works end to end. The original session could not test this because Ollama was not available.
2. Confirm the option names match the current Ollama API (`temperature`, `top_p`, `repeat_penalty`, `num_predict`) and that `stream: false` returns `message.content`.
3. Check error handling when Ollama is not running or the model is missing.
4. Read `stimuliFromText` and decide whether the regular expressions are sensible. They are intentionally crude. Keep them crude but make sure they cannot throw on odd input (empty string, very long input, unicode).
5. The system prompt tells the model it is steered by a simulated nervous system. Make sure it never instructs the model to claim feelings or consciousness.

### 4.5 Site (`site/template.html`, `scripts/build_site.mjs`)

1. Check every factual sentence in the notes against research files 01 to 07. Remove or soften anything not backed there.
2. Check the Sources list. Every link should open. Add DOI links for the entries you verify.
3. Check the hero line and the acronym line. The hero line reads: "A 302 neuron brain, copied from the real wiring diagram of C. elegans (a see-through worm about the size of a pinhead, and the first animal to have its entire brain mapped), running in this tab."
4. Performance. The page renders a pixel field at about one fifth resolution every frame, plus a globe and a body canvas. Profile it on a mid range laptop and a phone. Target 60 fps on desktop and a stable 30 on a mid range phone. If it falls short, reduce the field cell resolution, reduce arcs drawn, or throttle the body canvas when off screen (it is already paused by an IntersectionObserver).
5. Accessibility. Check keyboard focus on every control, the aria labels, `prefers-reduced-motion` (worms freeze and the anatomy line draws fully), contrast of the dim mono text on navy.
6. Responsive. Test at 360, 400, 768, 1024, 1440 and 1920 px. The anatomy SVG scrolls horizontally inside its own container on narrow screens, which is intended.
7. The hero worm overlaps the lede text on some widths. Decide whether to add a soft navy scrim behind text or constrain the worm lanes.
8. Make sure no copy contains em dashes or double hyphens.

### 4.6 Docs and README

1. README must describe exactly what the repo contains and nothing else. Remove anything that is aspirational.
2. Confirm every command in the README works from a clean clone.
3. Confirm the statement "three of the four reflex checks pass" is true after your changes, and update it if the number changes.

### 4.7 Genome

Run the fetch script with network access. The accession versions in the script were written from memory (`NC_003279.8`, `NC_003280.10`, `NC_003281.10`, `NC_003282.8`, `NC_003283.11`, `NC_003284.9`, `NC_001328.1`). If NCBI rejects one, look up the current version on the RefSeq assembly GCF_000002985.6 page and fix the script. Compare the output of `scripts/genome_stats.mjs` against the chromosome lengths in research file 01, section 1.4.

Write your findings into `AUDIT.md`. When the audit is done, tell the user what you found in a short summary, with a direct question about anything that needs their decision.

---

## 5. Facts you can rely on

Full tables with sources are in the research pack. These are the numbers that appear on the site.

| fact | value | status |
| --- | --- | --- |
| Neurons in the adult hermaphrodite | 302 | seen in many sources |
| Synapses and gap junctions, White 1986 | about 7,000 | seen |
| Reference genome size | about 100.3 million bases (WormBase: 100,272,276) | seen |
| GC content | about 35.4 percent (64.6 percent AT) | seen and computed |
| Chromosomes | I to V and X, plus a 13,794 base mitochondrial genome | seen |
| Chromosome lengths | I 15,072,434, II 15,279,421, III 13,783,801, IV 17,493,829, V 20,924,180, X 17,718,942 | seen (KEGG, RefSeq) |
| Protein coding genes | 19,985 of 49,187 genes in total, WormBase 2022 | seen |
| Genome first published | 1998, Science 282:2012 | seen |
| Synapses at birth versus adult | about 1,300 versus about 8,000 | seen (Witvliet 2021) |
| New synapses that reinforce existing partnerships | about 74 percent | seen |
| Neurons born after hatching | about a quarter | seen |
| Somatic cells in the adult hermaphrodite | 959 | recall, verify |
| Nobel prizes tied to the worm | 2002, 2006, 2008 and 2024 | 2024 seen, others recall |
| Dataset in this repo | 302 neurons, 3,709 chemical pairs, 1,105 gap pairs | computed |

---

## 6. Known issues and open questions

Severity: **A** affects correctness of a public claim. **B** affects quality. **C** nice to have.

| # | sev | issue | where to look |
| --- | --- | --- | --- |
| 1 | A | Chemical weight sum is 20,965 versus about 7,000 synapses in the literature. Wording must not call edge weight "synapses". | research 02 section 2.2, `scripts/build_connectome.py` |
| 2 | A | Head touch should trigger reversal. The model gets it only weakly. Check AVM edges before changing parameters. The test is marked todo. | research 03 section 3.2, `test/network.test.mjs` |
| 3 | A | Many citations are from memory. None may appear on the site or in the README until verified. | research 07 |
| 4 | A | The genome sequence has never been downloaded in this project. Accession versions are unverified. The site does not display a sequence and must not until a real file is loaded. | `scripts/fetch_genome.sh` |
| 5 | A | The steering loop was never run against a real model. | `src/cli.mjs` |
| 6 | B | The parameter sweep script is not in the repo. | research 03 section 3.6 |
| 7 | B | The `class` field has 21 cells under "other". | `scripts/build_connectome.py` |
| 8 | B | GABA assignment is a short hand list. | `src/network.mjs`, research 02 |
| 9 | B | The site's hero worm can cross the lede text. | `site/template.html` |
| 10 | B | `food-smell` produces a mild backward drive. No literature claim is made, but think about whether it is surprising. | research 03 |
| 11 | B | The notes say "about 7,000" synapses and the hero shows 4,814 "connections". Keep the two clearly separate in wording. | `site/template.html` |
| 12 | C | The site title and repo name use `werm`. Confirm the user's GitHub account and the final repo URL. The default in the build script is `https://github.com/Henryfud/werm` and was set from earlier context. It may be wrong. | `scripts/build_site.mjs` |

---

## 7. Roadmap with acceptance criteria

### Phase 0. Audit (section 4)

Done when `AUDIT.md` exists, every item in section 6 with severity A is closed or has a decision from the user, and `npm test` is green.

### Phase 1. Make the data and docs airtight

- Verify and fix citations. Move entries in research file 07 from recall to verified with a date. Add DOIs.
- Fix the weight discrepancy wording.
- Improve classification and the neurotransmitter map. Add `docs/NEUROTRANSMITTERS.md` with the final list and sources.
- Commit `scripts/sweep.mjs` and its output.

Done when every number on the site traces to a line in the research pack.

### Phase 2. Genome layer

- Run the fetch. Confirm lengths.
- Add a compact derived file that is safe to commit: per chromosome GC in 100 kb windows (about 1,000 numbers total). Commit it as `data/gc_windows.json`. The site can then draw a real GC map without any upload, and the file picker remains for people who want to load their own.
- Add gene density in windows from the WormBase GFF3 annotation (also from the reference assembly). Show gene density below the GC strip. Gene annotation is another download, so write `scripts/fetch_annotation.sh`.
- Optional: embed the 13,794 base mitochondrial genome in the site as a scrolling sequence viewer. It is small enough to ship inline. Verify the sequence against NCBI before shipping it.

Done when the genome section shows real measured data on first load, with no fake or placeholder sequence anywhere.

### Phase 3. Does the wiring matter? (the null model experiment)

Implement `scripts/null-models.mjs` as specified in research file 06, section 6.4, experiment 3, and the reservoir benchmark in file 04, section 4.5.

- Degree preserving rewiring (Maslov and Sneppen), 100 graphs.
- Erdos Renyi graphs with matched edge density.
- For each graph, run the four reflex stimuli and record the sign of drive, the margin, and the spread of readout statistics.
- Report where the real connectome sits in each distribution.

Done when there is a table and a plot in `docs/RESULTS.md`, with the plain result. If the real wiring is indistinguishable from shuffles, say so on the site. That is a legitimate finding and the strongest honest thing the project can show.

### Phase 4. Steering evaluation

Implement `scripts/steer-eval.mjs` per research file 06, experiments 1, 2 and 4. Use a small local model, fixed seeds and 200 prompts in `data/eval-prompts.json`.

Done when `docs/RESULTS.md` has measured effects of worm steering versus default sampling and versus a matched random driver, with the raw numbers.

### Phase 5. Stronger model (optional, only after phases 3 and 4)

- Fit the free parameters against a larger set of reflex targets using a gradient free search, with a held out set. Report held out accuracy.
- Add slow neuromodulatory variables (research 03 section 3.5).
- Add synaptic depression for habituation.
- Export the network to NeuroML and compare with c302 level C1 (research 05).
- Try the Witvliet developmental datasets so the model can run at L1, L2, L3 and adult.

### Phase 6. Site polish

- Add a "results" section that appears only once Phase 3 and 4 data exist.
- A "compare" toggle that runs the same stimulus on real wiring versus a shuffled graph, side by side, using Phase 3's rewired graphs.
- A small about panel that explains in two sentences each: connectome, genome, liquid time constant, steering.
- Social preview image and meta tags in the full `site/index.html` wrapper.

### Phase 7. Publish (section 13)

---

## 8. Site specification

### 8.1 Design tokens (already in the template)

| token | value | use |
| --- | --- | --- |
| `--ink` | `#03050f` | page ground, navy black |
| `--ink-2` | `#090c22` | secondary ground |
| `--panel` | `#0a0e29` | panels |
| `--paper` | `#ece8e1` | text, outlines |
| `--dim` | `#a09db4` | secondary text |
| `--violet` | `#8a22b8` | dither mid tone |
| `--blue` | `#3333ea` | dither low tone |
| `--lime` | `#c9ff2e` | accent, highest dither tone, CTAs |
| display face | Hanken Grotesk 400 to 700 | headlines tight, tracking about minus 0.05 em |
| mono face | Martian Mono 300 to 500 | labels, readouts, code |

The site is a single dark look by design. It sets all colours explicitly and does not have a light theme.

### 8.2 Structure

1. **Hero.** Large headline "Wired from the worm" with the word "worm" in a horizontal stripe fill. Directly under it the acronym at display size, Wiring Encoded Recurrent Modulator, with lime initials W, E, R, M, then a short plain explanation of each word. Lede with the playful C. elegans line. Two buttons. Floating readout cards (state, neurons wired, active now, connections). Terrain with lime speckled edge at the bottom of the hero scrolls up as you scroll.
2. **Brain.** Globe of 302 neurons, sensory on top, motor on the bottom. Stimulus buttons, live meters for forward command, backward command and arousal. Below it the steering layer with live settings and the command block.
3. **Body.** Draw on scroll schematic of the worm, with a glossary of six parts. A live body canvas driven by the network.
4. **Genome.** Six chromosome bars to scale, local FASTA reader with GC map, fact grid.
5. **Notes.** Long read with a sticky table of contents. Eleven sections, then Sources.
6. **Footer.** "Take it apart." and the GitHub button.

### 8.3 Motion

- The fixed canvas renders worms into an offscreen buffer at about one fifth resolution, then applies a 4 by 4 Bayer ordered dither mapped to five tones (transparent, blue, violet, orchid, lime). Worms are kinematic chains of circles with a sinusoidal bend wave.
- Five background worms (W1 to W5), each with its own `WormBrain` instance seeded differently and calibrated to its own resting state. Seven food dots sit on the field. A worm that comes within about 120 px of food gets the `food-smell` stimulus and steers toward it; reaching it triggers an "eating" label, a ring pulse and a respawn of the food. A worm whose head touches another worm gets `nose-touch`, and the worm it touched gets `touch-tail` or `touch-head` depending on where it was hit. Scrolling down fires `touch-tail` on every worm and scrolling up fires `touch-head`. Reversal is decided by the brain readout relative to the worm's own baseline, so it is partly a design choice and should be described that way. Each worm carries a small live label with its name, state and food count.
- The terrain edge is a sum of sines with a lime speckle band, anchored to the bottom of the hero and moved by scroll position.
- The globe rotates slowly, can be dragged, and arcs are drawn for chemical synapses whose presynaptic neuron is active.
- The anatomy outline draws with `stroke-dashoffset` tied to scroll position.
- A demo input fires every few seconds until someone presses a button, so the page is alive on arrival. It labels itself as "(demo)".
- `prefers-reduced-motion`: the field and body worms stop moving and the anatomy draws fully.

### 8.4 Things to try in Phase 6

- Make the background worms interact with the headline, for example by bending around the heading glyphs.
- Draw worm skin texture with a second dither pass.
- Replace the schematic anatomy with a more accurate illustration in the same line style.
- Add a small sound layer (off by default, start on click) where motor neuron activity maps to soft pulses. Sound must start from a user gesture.

### 8.5 Performance budget

Total page weight under 400 KB before fonts. No external scripts. Fonts come from Google Fonts only. Initial render under one second on broadband. Animation frame cost under 8 ms on a mid range laptop.

---

## 9. Model specification

See `docs/ARCHITECTURE.md` for the equations and the research pack file 03 for the reflex table. In short:

```
f  = sigmoid(fSlope * (drive - fOffset))
dx/dt = -(1/tau + f) * x + f * amp + noise
drive = chemScale * chem * 2.2 + gapScale * gap * 2.2 + external - inhib * meanActivation
```

Defaults: `tau 0.4`, `dt 0.005`, `gain 9`, `threshold 0.3`, `amp 2.0`, `fSlope 4`, `fOffset 0.5`, `chemScale 1.8`, `normPow 0.75`, `inhib 12`, `gapScale 0.55`, `noise 0.012`.

Result table with these defaults, drive read after 1.5 s of stimulation:

| stimulus | drive | expected sign | passes |
| --- | --- | --- | --- |
| touch-tail | +0.20 | forward | yes |
| nose-touch | -0.23 | backward | yes |
| noxious | -0.08 | backward | yes, weakly |
| touch-head | -0.08 in the sweep, test is todo | backward | marginal |
| food-smell | -0.10 | none claimed | not tested |

Rest state: zero neurons above half activation.

---

## 10. Steering specification

See research file 06. The theory is that a small recurrent network with real structure can act as a slow, correlated state variable that modulates how a language model samples. That is a theory about usefulness, not an established result. It has to be tested, and Phase 3 and 4 are the tests.

Keep the claims at exactly this level on the site until there are measurements:

- The worm's state sets a few sampling numbers and a tone line.
- The mapping is a design choice.
- The model generates every token.

---

## 11. Genome specification

- The page shows chromosome lengths to scale from the RefSeq record. These are real.
- The page does not show a sequence unless the visitor loads one. The sandbox could not download the sequence, and a made up sequence would be wrong.
- After Phase 2 the page ships a real derived GC windows file.
- Genome and connectome stay separate layers in the narrative. The genome builds the worm. The connectome is the finished wiring. The model runs on the wiring.
- Possible bridge, later: gene expression by neuron type (CeNGEN) coloring the globe by transmitter identity. See research file 01 section 1.5.

---

## 12. Testing plan

- **Unit:** keep the current ten tests green. Add tests for steering outputs at extreme readouts, for `stimuliFromText` on odd input, and for `build_site.mjs` (the output contains the connectome and no unreplaced placeholders).
- **Regression:** snapshot the reflex table above and fail if the sign of any passing stimulus flips.
- **Property:** a resting network stays under three active neurons for any seed. Activations stay within bounds.
- **Browser:** a headless Chromium smoke test that loads `site/index.html`, waits two seconds, asserts no console errors, no horizontal overflow at 400 px, and a nonzero active neuron count after clicking a stimulus.
- **Visual:** screenshots at three widths before and after any layout change.
- **Data:** a script that recomputes the data profile in research file 02 and compares it with the file.

---

## 13. Publishing to GitHub

The sandbox had no authenticated GitHub access. You will need the user's help.

1. Ask the user for their GitHub username and whether the repository should be public or private. Offer: public, private, or private now and public later. Recommend private first.
2. Confirm the repo name. The working name is `werm`.
3. Initialise and commit.

   ```bash
   cd repo
   git init -b main
   git add .
   git commit -m "WERM: first public version"
   ```

4. Create the remote and push, only after the user says yes.

   ```bash
   gh auth status
   gh repo create <user>/werm --private --source . --push
   ```

5. Rebuild the site with the real URL so the buttons and clone commands are right.

   ```bash
   GITHUB_URL=https://github.com/<user>/werm npm run build:site
   ```

6. Add repository topics and a short description. Suggested description: "A 302 neuron network on the real C. elegans wiring diagram, with a steering layer for local language models."
7. Do not commit `data/genome/`. It is git ignored.
8. Add the live site link to the README once the site is hosted somewhere.

Commit message style: short imperative subject, one blank line, a few lines of detail if needed.

---

## 14. Things not to do

- Do not add a coin, token, wallet, trading feature or anything financial. The project has none, and the user confirmed that.
- Do not invent a genome sequence, a connectome edge, a statistic or a citation. If a number is not in the research pack with a source, find the source or leave it out.
- Do not describe the model as a faithful emulation of the worm, as a liquid neural network in the sense of the MIT papers without the words "in the style of", or as something that makes a language model smarter.
- Do not copy Sorocarp's code, wording, layout or structure. It was an example of the kind of project, not a template.
- Do not reproduce long passages from papers or articles. Paraphrase and cite.
- Do not use em dashes or double hyphens in prose.
- Do not remove the honesty section from the notes or the limits section from the README.
- Do not push, publish or create a repository without the user's yes.

---

## 15. Decision log

| decision | reason |
| --- | --- |
| Worm, not slime mould or fly | Complete, small, measured wiring. A different organism from the Sorocarp example. A long behavioural literature to test against. |
| Rate network with a liquid style gate | Simple enough to read, runs in a browser, nods to the real research line that came from this worm. |
| Real connectome from Cook 2019 via the OpenWorm toolbox | Standard dataset, openly available, both sexes studied, includes corrected workbook. |
| Global inhibition term | Without it the network was dead or saturated. Documented as a stabiliser. |
| Hand tuning, then honest reporting of the miss | Gets visible reflexes for the demo and keeps the claim true. |
| Steering at the sampling layer | Works with any local model through Ollama. Hidden state injection needs open weights and is a later experiment. |
| Genome shown as lengths plus a local file reader | NCBI was unreachable during the build. Nothing fake on the page. |
| Single dark look, pixel dither field | Matches the reference the user liked. |
| Name WERM, Wiring-Encoded Recurrent Modulator | The user asked for an acronym that sounds intelligent. Each word is accurate: the model is encoded from the wiring, it is a recurrent network, and it modulates a language model. |
| Private repo first in the publishing steps | Cheaper to open up than to take back. |

---

## 16. Glossary

- **Connectome.** The full list of which neurons connect to which, and how strongly.
- **Chemical synapse.** A one way link using a neurotransmitter.
- **Gap junction.** A direct electrical link that passes current both ways.
- **Command interneurons.** A small group (AVA, AVB, AVD, AVE, PVC) whose activity sets whether the worm goes forward or backward.
- **Reflex check.** A test that a stimulus pushes the network toward the behaviour the literature reports.
- **Liquid time constant.** A neuron model in which input speeds up or slows down the neuron's own dynamics.
- **Reservoir computing.** Using a fixed recurrent network as a feature generator and training only a readout.
- **Null model.** A randomised version of a network that keeps some properties (such as the degree of each node) and destroys the rest, used to ask whether the real structure matters.
- **Sampling settings.** Temperature, top p, repetition penalty and length limit, the knobs on how a language model picks the next token.
- **RefSeq.** NCBI's curated reference sequences.

---

## 17. Kickoff prompts for the user to paste

**First message to Claude Code:**

> Read HANDOFF.md in this folder completely, then read docs/research/01 through 07. Start with section 4, the audit of everything in the repo, before you build anything new. Keep AUDIT.md as you go. When the audit is done, give me a short summary and ask me any decisions as multiple choice questions. Do not push to GitHub or create a repository until I say yes.

**After the audit:**

> Go to Phase 1 and Phase 2 of the roadmap. Verify the citations in research file 07, fix the weight discrepancy wording, and fetch the real genome. Show me the genome stats output next to the table in research file 01.

**When ready for experiments:**

> Do Phase 3, the null model experiment. Run it on the real wiring and 100 degree preserving shuffles, put the table and plot in docs/RESULTS.md, and tell me plainly whether the real wiring beats the shuffles.

**When ready to publish:**

> Do Phase 7. I will tell you my GitHub username. Make the repository private first, then show me the final README and the site build before I decide whether to make it public.
