# Audit

The first version of WERM was built in one session in a sandbox that could not reach NCBI, could not run a language model, and could not push to GitHub. This file records the audit that followed: what was checked, what changed, and what could not be verified. It was done on 2026-10-05 with Node 25.3 on macOS. CI repeats the checks on Node 20 and 22.

Short version: the data and the genome check out exactly. The model had two real bugs, both now fixed. A resting network ignited by itself after about 2.5 s, and one GABA cell class was missing. The claim that "three of four reflex checks pass" turned out to be the wrong measure, and the site, README and docs now report a better one. Most citations were from memory. They have now been checked against Crossref or the publisher, and every one that appears in public copy has a DOI.

## Decisions made by the project owner

These were choices, not oversights.

| decision | effect |
| --- | --- |
| Do the full roadmap except Phase 5 (stronger model) | Phase 5 stays listed under "Next" in the README |
| Write the steering evaluation, do not run it | `scripts/steer-eval.mjs` exists with tests and a dry run. No language model was installed or run. The site and README say the steering effect is unmeasured |
| Keep the site's look, including worms crawling over the text | Handoff issue 9 closed as "keep" |
| Repository `Henryfud/werm`, private first | |
| Host on Netlify from the GitHub repo, domain werm.si | `netlify.toml` added |
| X account @WERM_si, logo from `werm-profile.png` | Logo is the favicon, the header mark and the link preview image |
| Show "CA: coming soon" at the top of the site | A thin bar above the nav. The earlier "no coin, no token" rule in `CLAUDE.md` and `HANDOFF.md` is marked as superseded. The README does not mention it |

## 1. Run everything first

| check | result |
| --- | --- |
| `npm test` on the handoff state | 9 pass, 1 todo, as described. But the "todo" head touch test was passing, which turned out to matter (section 3) |
| `node src/cli.mjs sim` | runs |
| `node scripts/build_site.mjs` | 292 KB, no console errors in a browser |

## 2. Data

| check | result |
| --- | --- |
| Rebuild `data/connectome.json` from `cect` 0.3.5 | byte for byte identical before the class change |
| 302 neurons, 3,709 chemical pairs, 1,105 gap junction pairs | confirmed |
| Every number in `docs/research/02-connectome.md` section 2.2 | recomputed by `scripts/check_data.mjs`, all match. Runs in CI |
| CANL and CANR present with edges | yes. ALA sends them chemical synapses, and they have gap junctions with ALA and PVD |
| What an edge weight is (handoff issue 1) | **Resolved from the source.** The workbook's legend sheet says the weights are "the total number of EM serial sections of connectivity, taking into account both the number of synapses and the sizes of synapses". So 20,965 is a count of microscope sections, not of synapses, and is not comparable with White 1986. All wording now says "connection weight" or "sections". White et al. 1986 give "about 5000 chemical synapses, 2000 neuromuscular junctions and 600 gap junctions" (abstract, via Crossref). The site now quotes that breakdown instead of "about 7,000" |
| Neuron classes (handoff issue 7) | 21 cells were "other". The build script now uses the WormAtlas type strings that ship in `cect`: "Touch" (ALN, PLN, SDQ, AQR, PQR) and "O2, CO2" (BAG, URX) count as sensory, and "Linker to pharynx" (RIP) as interneuron. 7 remain: CAN, MC, MI, NSM. New counts: sensory 83, inter 87, motor 125, other 7 |
| 25 random edges against NemaNode | **Not done.** NemaNode shows the Witvliet datasets, which use different units and animals, so a direct match is not expected. The byte identical rebuild from the published workbook is the stronger check |

## 3. Model

| check | result |
| --- | --- |
| Equations in `docs/ARCHITECTURE.md` match the code | they did, except the rest point (below). Docs updated |
| Readout name patterns | each matches exactly the intended cells: AVBL AVBR PVCL PVCR; AVAL AVAR AVDL AVDR AVEL AVER; DB1 to 7 and VB1 to 11; DA1 to 9 and VA1 to 12 |
| `dt` 5 ms against 2.5 ms | drives change by at most 0.005. Kept 5 ms |
| Speed | about 57,000 steps a second in Node, about 200 times faster than the page needs |
| Seeded runs repeat | yes. A snapshot test pins one run so CI checks it on Node 20 and 22 |
| **Bug: the network ignited at rest** | The activation curve subtracted the output at x = 0.07, but with these parameters a neuron with no input settles at x = 0.091. Every neuron leaked a little, and after about 2.5 s a loop of head motor neurons (RMD, SMD, SIA) switched on with no input at all, even with the noise off. The original rest test only looked at 2 s. Fixed by computing the rest point from the parameters (`restState`). A test now runs 30 s at five seeds |
| **GABA list (handoff issue 8)** | Checked against Gendrel, Atlas and Hobert 2016, Table 1. RIBL and RIBR, "conventional" GABA neurons in that paper, were missing. Added. Cells that only take up GABA, or hold it by unknown means, stay excitatory. Full list and reasons in `docs/NEUROTRANSMITTERS.md` |
| **The reflex checks were the wrong measure** | Poking random sensory neurons pushed the network backward 80 to 90 percent of the time. So three of the four "passing" reflexes (all backward ones) were passing because the network leaned backward for almost any input. A sign check alone cannot tell a reflex from that lean. Two measures were added: each reflex against 50 to 100 matched random pokes (`specificity`), and the head versus tail contrast from Chalfie et al. 1985 (`headTailContrast`) |
| Parameter sweep (handoff issue 6) | The original sweep was lost. `scripts/sweep.mjs` is a reconstruction over 1,470 points, with a selection rule written down before the results were seen. Its output is `docs/results/sweep.csv`. The handoff's "best was 9 of 12" could not be reproduced: at seeds 1 to 3 the old defaults scored 12 of 12, for the reason above |
| New parameters | `chemScale 2.4, inhib 20, fOffset 0.9, threshold 0.3`, up from `1.8, 12, 0.5, 0.3`. Results in `docs/RESULTS.md` |
| Head touch (handoff issue 2) | AVM's chemical output goes mostly to the forward command cells (AVB 22, PVC 27 sections) and very little to the backward ones (AVD 2). Its strongest link to AVD is a gap junction (8). ALM is similar. Because every non GABA chemical synapse is excitatory here, a head touch also pushes forward. In the animal, these synapses onto the opposite direction command cells are a plausible place for inhibition the model does not have. See `docs/RESULTS.md` |
| Food smell leaning backward (handoff issue 10) | Mostly the general backward lean, which is now smaller. No claim is made about food smell |

## 4. Steering

| check | result |
| --- | --- |
| End to end against Ollama | **Not run**, by decision |
| Option names | `temperature`, `top_p`, `repeat_penalty`, `num_predict` and `seed` are Ollama option names, and `stream: false` returns `message.content`. Checked by reading, not by running |
| Errors | `src/ollama.mjs` now says plainly when Ollama is not running or the model is missing |
| `stimuliFromText` on odd input | It used to throw on `null` and matched parts of words ("know" fired `noxious`). It now accepts anything, matches whole words, and counts length in characters, not UTF-16 units. Tested |
| System prompt | never asks the model to claim feelings or consciousness. Tested |
| Evaluation | `scripts/steer-eval.mjs`, 200 prompts in `data/eval-prompts.json`, `--dry-run` works offline. Design notes in `docs/RESULTS.md` |

## 5. Site

| check | result |
| --- | --- |
| Every factual sentence | checked against the research pack and the verified citations. Changed: edge weight wording, the White 1986 counts, the reflex claims, the rest point, the genome paragraph, and "first animal genome" (removed, since the claim could not be confirmed in that form) |
| Sources | rebuilt from verified entries only, with DOI links |
| Genome | real GC and gene density maps on first load from `data/gc_windows.json` and `data/gene_windows.json`. No sequence is shown that was not measured |
| Browser smoke test | `npm run test:site` checks for no errors and no sideways overflow at 360, 400, 768 and 1440 px, and that a stimulus lights up neurons. Runs in CI |
| Prose rule | `scripts/check_prose.mjs` fails CI on em dashes or double hyphens in Markdown and page text |
| Page weight | about 345 KB before fonts, under the 400 KB budget |

## 6. Genome

| check | result |
| --- | --- |
| Accession versions from memory | all seven were right: NC_003279.8, NC_003280.10, NC_003281.10, NC_003282.8, NC_003283.11, NC_003284.9, NC_001328.1 |
| Lengths | every chromosome matches research file 01 to the base. Total with the mitochondrion is 100,286,401, the KEGG figure exactly. The six nuclear chromosomes sum to 100,272,607 |
| GC | 35.44 percent measured |
| Genes | 19,971 protein coding genes on the six chromosomes in the RefSeq annotation (annotation source WormBase WS298). The site uses this count and names the release |

## 7. Citations

Every entry in `docs/research/07-reading-list.md` was looked up in Crossref, Europe PMC, arXiv or the publisher on 2026-10-05. The file now gives each one's status and DOI. Corrections that mattered: the Mulcahy et al. 2018 title was wrong, and the Izquierdo and Beer 2013 article number was missing.

## Could not verify

- Whether a polyadic synapse adds its full section count to every partner in the Cook matrices. The Methods text could not be fetched. Wording avoids depending on it.
- The male somatic cell count (one source says 1,031, another 1,033). The site does not use it.
- WormAtlas pages could not be fetched directly (certificate errors). Facts that rest only on WormAtlas search snippets are not on the site.
