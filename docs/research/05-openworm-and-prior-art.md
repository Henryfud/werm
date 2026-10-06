# 05. OpenWorm, prior art and neighbouring projects

Tags: `[S]` seen in a fetched source. `[K]` background knowledge to verify before publishing.

## 5.1 OpenWorm

OpenWorm is an open science project aiming to build a computational model of the whole *C. elegans* animal. Its two stated long term goals are to recreate the worm in software and to make the simulation a faithful biological model that scientists can use. [S: Gleeson et al. 2015, BMC Neuroscience 16(Suppl 1):P141]

Components, per the project pages and the 2015 poster abstract: [S]

| part | role |
| --- | --- |
| **c302** | A framework in NeuroML 2 for generating network models of the worm's nervous system at several levels of biophysical detail. Levels A to D. Level C1, Hodgkin Huxley style cells with graded synapses, is the recommended default for coupling with the body simulator. |
| **Sibernetic** | A smoothed particle hydrodynamics engine that simulates the body and its fluid environment, with contractile elastic matter and impermeable membranes. |
| **Geppetto** | A web based visualisation and simulation engine, built to bring the simulation to the browser. |
| **ConnectomeToolbox** (`cect` on PyPI) | Structured datasets on anatomical (chemical and electrical), functional and extrasynaptic connectomes. Described by the project as a work in progress. This is where WERM's wiring data came from. |
| **OpenWorm meta repository** | A Docker stack that wires the pieces together. |

State of the organisation in early 2026, from the OpenWorm design document site: 109 repositories in the GitHub organisation, a move to formal Design Documents (DD001 neural circuit, DD002 muscle, DD003 and DD004 body physics, DD013 integration, DD020 connectome data access), and a planned Phase 3 web simulator described as a Three.js and WebGPU static site (WormSim 2.0). [S: docs.openworm.org repository inventory and projects overview. These are planning documents, so describe the state as planned unless confirmed.]

Install note from the c302 README: clone the repository, install with pip, the optional `owmeta` data layer can be skipped, and running c302 with the NEURON simulator is not supported on Windows. Example commands: `python c302/c302_Pharyngeal.py B` to generate a pharyngeal network, and `c302 MyNetwork parameters_C -cells ["AVBR","VD3"] -cellstostimulate ["AVBR"] -paramoverride {"unphysiological_offset_current":"2.9pA"} -duration 300`. [S]

Papers to cite when describing the project: Szigeti et al. 2014 (Front. Comput. Neurosci. 8:137); Sarma et al. 2018 (Phil. Trans. R. Soc. B 373:20170382); Gleeson et al. 2018 (Phil. Trans. R. Soc. B 373:20170379). [K, verify the article numbers]

### Where WERM fits

WERM does not try to be a faithful biophysical model. It is a deliberately small network on the same wiring data, readable end to end in an afternoon, that runs in a browser tab. It trades fidelity for legibility. The README and the site say so, and the site should link to c302 for anyone who wants the real thing.

A worthwhile project for Claude Code is to export the WERM wiring to NeuroML and run the same stimuli through c302 Level C1, then compare the sign of the forward and backward command activation. That would put a real number on how far the toy model is from a conductance based one.

## 5.2 The thread this project started from: the fly brain

The first idea in the conversation was a project inspired by a fly brain model. The relevant real work: [K, verify before quoting]

- The hemibrain connectome of the adult *Drosophila* central brain (Scheffer et al. 2020, eLife).
- FlyWire, the whole adult fly brain connectome (Dorkenwald et al. 2024, Nature, with the companion Schlegel et al. 2024), on the order of 140,000 neurons and tens of millions of synapses.
- Shiu et al. 2024 (Nature), a leaky integrate and fire model of the whole fly brain built directly from the FlyWire wiring, which predicted neurons involved in feeding and grooming behaviours and some of which were validated in experiments.
- Lappalainen et al. 2024 (Nature), connectome constrained networks predicting neural activity across the fly visual system.

A worm choice sits at the opposite end of scale from those projects. The worm gives a complete, small, long studied circuit that can be shown on one screen, and it has decades of behavioural literature to test against. That is why WERM uses it.

## 5.3 The site that inspired the visual direction

The original inspiration was Sorocarp (sorolabs.si), a slime mould (*Physarum polycephalum*) particle model presented as "Slime Intelligence" with a paper trading portfolio, an open source repository under the MIT licence, and a token on pump.fun. [S: the site and its docs]

What it does well, from reading its pages: a one line hook (SI, not AI) backed by a comparison table, a live visual where the model's state is the product, documentation with parameter tables and an API reference, a narrator voice written by a language model that is only allowed to describe, and an honest statement that the portfolio is paper only. [S]

Sorocarp's simulation is a Jones 2010 style particle model with seven local rules (hunger, settle, sense, turn, move, leave a trail, feed divide die). [S] The relevant paper is Jones, J. 2010, "Characteristics of pattern formation and evolution in approximations of Physarum transport networks", Artificial Life 16:127. [K]

**Do not copy Sorocarp's code, wording or layout.** WERM takes the general idea of a biological system as the engine and a live visual as the proof, and does everything else differently: a different organism, a different model class (a recurrent rate network on a measured wiring diagram), and a different visual language (pixel dither, globe, terrain).

## 5.4 Other "small brain" computing work worth reading

- Reservoir computing (Jaeger 2001; Maass et al. 2002). See file 04. [K]
- Neuromorphic computing platforms such as Intel Loihi and SpiNNaker, which run spiking models efficiently. [K]
- Physical reservoirs built from unusual substrates. [K, general area; no specific citation endorsed here]
- Embodied small circuit controllers, for example Beer's work on minimally cognitive agents and central pattern generators. Beer 1995, "On the dynamics of small continuous time recurrent neural networks", Adaptive Behavior 3:469. [K]

## 5.5 Open items for Claude Code

1. Confirm the OpenWorm article numbers and citations before the README cites them.
2. Decide whether to build the NeuroML export and c302 comparison.
3. Add a short "related work" section to the site that links c302, the connectome toolbox, NemaNode and the liquid network papers, without any promotional wording.
