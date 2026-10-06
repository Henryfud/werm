# 02. The connectome

Tags: `[S]` seen in a source fetched while building this project. `[C]` computed from `data/connectome.json`. `[K]` background knowledge, verify before publishing.

## 2.1 A short history of the maps

| year | work | what it added |
| --- | --- | --- |
| 1976 | Albertson and Thomson, pharynx | Reconstruction of the pharyngeal nervous system. [S: listed in the OpenWorm toolbox] |
| 1986 | White, Southgate, Thomson and Brenner, Phil. Trans. R. Soc. B 314:1 to 340 | First complete wiring diagram of any nervous system, from serial section electron microscopy. 302 neurons and about 7,000 chemical and electrical synapses. [S for the 302 and 7,000 figures; K for the citation details] |
| 1987 | Durbin, PhD thesis | Revised and extended dataset (JSH and N2A in the toolbox). [S] |
| 2011 | Varshney et al., PLoS Comput. Biol. 7:e1001066 | Re-analysis of the hermaphrodite somatic network with updated annotation, widely used for network science. [S: toolbox lists Varshney 2011; K: citation] |
| 2012 | Jarrell et al., Science 337:437 | Male posterior nervous system connectome. [K] |
| 2019 | Cook et al., Nature 571:63 to 71 | Whole animal connectomes of both sexes, including muscles and other cells. The dataset used in this project is the Cook 2019 hermaphrodite network. [S] |
| 2020 | Cook et al. | Further corrections and the "corrected July 2020" workbook used by the build script. [S: workbook filename; K: details] |
| 2021 | Brittin et al., Nature | Multi scale brain map from whole brain volumetric reconstruction. [S: listed in the toolbox; K: title] |
| 2021 | Witvliet et al., Nature 596:257 to 261 | Eight isogenic animals from L1 to adult. [S] |

### Witvliet et al. 2021 in detail [S unless marked]

- Eight isogenic animals: three L1, two L2, one L3 and two adults, reconstructed by electron microscopy. The two adults allow comparison with each other and with the original White data.
- The brain was defined as the nerve ring, the ventral ganglion and the neuropil anterior of the ventral sublateral commissures. Chemical synapses were annotated for every neuron, glia and muscle in that region. Gap junctions were partly annotated and excluded from the analysis.
- Chemical synapse weight was assessed by the number and the size of synapses.
- Total synapses in the connectome grow about six fold across development, from about 1,300 at birth to about 8,000 in adulthood.
- Only a quarter of the new synapses connected a neuron to a new partner. About 74 percent strengthened partnerships that existed at birth.
- Interneurons changed much less than sensory and motor neurons.
- 3,113 connections (averaging 1,292 per dataset) were classed as stable, variable or developmentally dynamic. 1,647 connections (averaging 323 per dataset) had no more than two synapses in two or more datasets and were left right asymmetric, and were classed as variable.
- The authors host an online database, NemaNode (nemanode.org).

The main message for this project: the same 302 neurons exist in each animal, and each animal has its own particular synapses. A model built from one connectome is a model of a sample.

## 2.2 The dataset in this repository

`data/connectome.json` comes from `scripts/build_connectome.py`, which reads the workbook "SI 5 Connectome adjacency matrices, corrected July 2020.xlsx" shipped inside the `cect` Python package (OpenWorm Connectome Toolbox, version 0.3.5 at the time of download). [S]

Profile computed from the file: [C]

| quantity | value |
| --- | --- |
| Neurons | 302 (sensory 71, interneuron 85, motor 125, other 21 under the coarse class used here) |
| Directed chemical connections (neuron to neuron pairs) | 3,709 |
| Gap junction pairs (stored once, symmetric) | 1,105 |
| Sum of chemical edge weights | 20,965 |
| Sum of gap junction edge weights | 5,779 |
| Median chemical edge weight | 3 |
| Largest chemical edge weight | 75 |
| Share of chemical edges with weight 1 | 30.5 percent |
| Chemical connection density | 4.08 percent of the 302 by 301 possible directed pairs |
| Share of chemical pairs that are reciprocal | 37.1 percent |
| Neurons with at least one gap junction | 298 |
| Isolated neurons | none |

Highest chemical total degree (in plus out): AVAL 108, AVAR 107, AVDR 76, DVA 74, PVCR 71, AVEL 70, PVCL 70, AVER 69, AVBL 68, AVDL 64, AVBR 63, RIAL 63. [C]
Highest incoming weight: AVAR 685, AVAL 667, RIAL 434, RIAR 414, AVBL 338, AVBR 333, RMDDL 310. [C]
Highest outgoing weight: RIAR 450, RIAL 400, AVAR 292, RIH 266, AVAL 258, AIZL 248, FLPL 241, ALA 232. [C]

AVA, AVB, AVD, AVE, PVC and DVA are classical locomotion command and integration neurons, which is why they dominate the hub list. [K]

### A discrepancy to resolve

The sum of chemical edge weights is 20,965. The 1986 paper and many summaries say about 7,000 synapses in total. [S for 7,000, C for 20,965] The likely explanation is that Cook 2019 matrices count each post synaptic partner of a polyadic synapse separately and count by electron microscopy contact rather than by distinct synaptic specialisation, so one presynaptic release site with three partners contributes three. That is a guess. Claude Code should read the legend sheet ("TITLE AND LEGEND") of the Cook workbook and the Methods of Cook et al. 2019, and then fix the wording anywhere the project says "synapses" for a quantity that is really "edge weight". The site currently avoids the problem by showing the number of connected pairs (4,814) and by quoting the 1986 figure in prose.

### Naming and cleaning rules in the build script

- Matrix labels use two digit numbers (DA01, VB11). WormAtlas names use one digit (DA1). The script normalises with a regular expression.
- The neuron list comes from the cell name file `IndividualNeurons.csv` in the package, intersected with labels present in the matrices. 302 neurons result, including CANL and CANR, which appear in the columns but not the rows of the chemical sheet.
- Muscles, glia, hypodermis, intestine and the pharyngeal non neuronal cells are dropped. This model has no body.
- The coarse `class` field comes from the WormAtlas `Type` string with simple keyword matching. The "other" group (21 neurons) holds cells whose type string contains none of the keywords, such as AQR, PQR, URX, BAG, CAN, MC, MI and NSM. Several of these are sensory or neuromodulatory in reality. Improving the classification is a good first task.

## 2.3 What a wiring diagram does not contain

Each of these is a known gap, and each is a place the model could be extended. [K unless marked]

1. **Sign.** Electron microscopy shows a synapse, not whether it excites or inhibits. Sign depends on the transmitter and on the receptors on the target. In worms the same transmitter can be excitatory on one target and inhibitory on another, for example through different glutamate receptors (GLR ionotropic receptors versus the glutamate gated chloride channels such as AVR-14 and GLC-3).
2. **Strength.** Synapse count is a proxy. Size and release machinery matter.
3. **Gap junction rectification and composition.** Innexin composition makes some gap junctions asymmetric. The "symmetric" sheet assumes bidirectional coupling.
4. **Extrasynaptic signalling.** Neuropeptides and monoamines act at a distance. Bentley et al. 2016 built a monoamine extrasynaptic network, and Ripoll-Sanchez et al. 2023 (Neuron) built a neuropeptide connectome using receptor expression and interaction data, with short, mid and long range models. The cect package includes these as CSV files (`01022024_neuropeptide_connectome_*_range_model.csv`, `08062023_monoamine_connectome.csv`). [S: file names listed from the unpacked package; K for the paper details]
5. **Intrinsic dynamics.** Neurons differ in channel complement. Many worm neurons use graded potentials rather than classical sodium spikes (Goodman et al. 1998, Neuron 20:763), although some, such as AWA, fire calcium based action potentials (Liu et al. 2018, Cell). [K]
6. **Plasticity and state.** Worms habituate, learn associations, switch between roaming and dwelling, sleep during lethargus and after stress. None of it is in a static diagram.
7. **Individual variation and development.** See Witvliet above.

## 2.4 Anatomy versus function

Functional measurements and structural wiring agree only partly. Randi et al. 2023 (Nature) built a signal propagation atlas by stimulating single neurons optogenetically and recording calcium responses across the brain, and found that anatomical connectivity predicts functional connectivity only partly. [S: the toolbox lists Randi et al. 2023 as functional connectome data; K: the headline conclusion]

Whole brain calcium imaging in moving worms (Kato et al. 2015 Cell, Nguyen et al. 2016 PNAS, Venkatachalam et al. 2016 PNAS, Kaplan et al. 2020 Neuron, Atanas et al. 2023 Cell) shows low dimensional population dynamics that track the motor command sequence, with state transitions between forward, reverse and turning. [K] These papers are the best targets if someone wants a quantitative test of the model. A model that only reproduces sign of drive for four stimuli has not been tested against any of them.

## 2.5 Network science results about the worm connectome

Worth knowing, and a possible basis for model tests: [K]

- The network is small world, with short average path length and high clustering relative to a random graph (Watts and Strogatz 1998 used the worm as an example).
- It has a rich club of highly connected hub interneurons that are densely interconnected (Towlson et al. 2013, J. Neurosci. 33:6380). The hub list above matches that picture.
- Controllability analysis (Yan et al. 2017, Nature 550:519) predicted which neurons are needed to control locomotion and tested the predictions by laser ablation.
- Degree preserving randomisation (Maslov and Sneppen 2002, Science 296:910) is the standard null model. Running the reflex tests on rewired graphs is a clean experiment, described in `06-steering-theory.md`.

## 2.6 Open items for Claude Code

1. Resolve the weight sum discrepancy in 2.2 and fix the wording.
2. Improve the `class` assignment using WormAtlas neuron classes or the CeNGEN neuron class table.
3. Replace the `GABA` set in `src/network.mjs` with a full neurotransmitter map from the three papers named in file 01, and add a cholinergic and glutamatergic assignment. Glutamate needs a per target sign rule.
4. Add the neuropeptide and monoamine CSV files as a slow second layer.
5. Add the Witvliet L1 to adult datasets so the model can be run at different developmental stages. The cect package ships them as `witvliet_2020_*.xlsx`.
6. Cross check a sample of edges against NemaNode.
