# 03. Neural dynamics and behaviour circuits

Tags: `[S]` seen in a fetched source. `[C]` computed in this repository. `[K]` background knowledge to verify before publishing.

## 3.1 What the neurons actually do

Hodgkin and Huxley (1952, J. Physiol. 117:500) described the squid giant axon with conductance based equations, and every serious worm simulation descends from that tradition. Most *C. elegans* neurons do not fire classical sodium action potentials. Recordings show graded, calcium and potassium channel driven voltage changes (Goodman et al. 1998, Neuron 20:763), and the neurons are electrically compact, so a signal can spread along a process without regeneration. Some neurons do fire all or none calcium action potentials, for example the AWA olfactory neurons (Liu, Kidd, Dobosiewicz and Bargmann 2018, Cell 175:57). [K]

This is the justification for a rate model. A graded potential neuron is reasonably described by a continuous activation that depends on input. A rate model is a very coarse description, and nothing here claims more.

The OpenWorm c302 framework builds network models at four levels of detail. Level A uses integrate and fire style cells, B and C add conductance models, and D adds more biophysical detail. Level C1 (Hodgkin Huxley cells with graded synapses) is the recommended default for coupling with the Sibernetic body simulator. [S: OpenWorm projects overview and c302 README]

## 3.2 The locomotion circuit

Core structure, with the cells present in `data/connectome.json`: [K]

- **Forward command interneurons:** AVB (AVBL, AVBR) and PVC (PVCL, PVCR).
- **Backward command interneurons:** AVA (AVAL, AVAR), AVD (AVDL, AVDR) and AVE (AVEL, AVER).
- **A type motor neurons:** DA1 to DA9 and VA1 to VA12, active in backward movement.
- **B type motor neurons:** DB1 to DB7 and VB1 to VB11, active in forward movement.
- **D type inhibitory motor neurons:** DD1 to DD6 and VD1 to VD13, GABAergic, which relax muscles on the opposite side during a bend.
- **AS motor neurons** (AS1 to AS11) and the **VC** neurons (VC1 to VC6, egg laying related).
- **Head motor neurons** such as RMD, SMD and RME for head bends.

Key results to know: [K]

- Chalfie et al. 1985 (J. Neurosci. 5:956) laid out the touch circuit. Gentle touch to the anterior body (ALML, ALMR, AVM) leads to backward movement through the AVD and AVA command interneurons, and gentle touch to the posterior (PLML, PLMR) leads to forward acceleration through PVC and AVB.
- Gray, Hill and Bargmann 2005 (PNAS 102:3184) showed that AVA and AVB activity is anti correlated and that command interneuron states bias the worm toward forward or backward movement.
- Kawano et al. 2011 (Neuron 72:572) showed that gap junctions between AVB and the B type motor neurons, and the balance between forward and backward circuits, bias the worm toward forward locomotion.
- Fouad et al. 2018 (eLife) showed that forward locomotion uses distributed rhythm generators along the body. Gao et al. 2018 (eLife) showed that excitatory A type motor neurons can act as local oscillators for backward movement.
- Nose touch and nociception work through ASH, a polymodal sensory neuron, with strong connections to AVA, AVD and AVE and thus to reversal (Kaplan and Horvitz 1993, PNAS 90:2227). ADL contributes to avoidance of some noxious chemicals. [K]

### What the model does with these facts

The stimuli in `src/network.mjs` map to the literature as follows. [K for the literature, C for the model result]

| stimulus key | neurons driven | expected from literature | result in this model |
| --- | --- | --- | --- |
| `touch-tail` | PLML, PLMR | forward acceleration | **forward, drive +0.20** |
| `nose-touch` | ASH, FLP, OLQ | reversal | **backward, drive -0.23** |
| `noxious` | ASH, ADL | reversal | **backward, drive -0.08** (weak) |
| `touch-head` | ALML, ALMR, AVM | reversal | **backward but weak, drive -0.08** in the sweep, flagged as a todo test because it is sensitive to parameters |
| `food-smell` | AWA, AWC, ASE | slowing and local search, dwelling | drive -0.10, mild backward bias, no claim made |

Drive is forward command activation minus backward command activation, read after 1.5 s of stimulation following 1 s of warm up. [C]

Important honesty point: the touch head check is the one the parameter sweep reached with the smallest margin. The sweep maximum was 9 out of 12 sign checks (four stimuli times three seeds), which is three of four stimuli right. [C] No setting in the sweep got all four. That is a result about how little a bare wiring diagram plus a generic rate model can reproduce, and it should stay on the site and in the README.

One concrete suspect for the head touch miss: AVM has outgoing connections to both forward and backward command neurons in the wiring, and the model has no mechanism to select between them. Claude Code should look at the AVM edges in `data/connectome.json` before changing any parameters. [K for the AVM literature; the edge listing is a task]

## 3.3 Published models that connect the connectome to behaviour

- Izquierdo and Beer 2013 (PLoS Comput. Biol. 9) built an ensemble of neuroanatomical models of klinotaxis, using the connectome as a constraint and searching over unknown parameters with an evolutionary algorithm. Izquierdo and Beer 2018 (Phil. Trans. R. Soc. B) extended this to a neuromechanical model of forward locomotion. [K]
- Boyle, Berri and Cohen 2012 (Front. Comput. Neurosci. 6:10) built an integrated neuromechanical model of gait modulation. [K]
- Szigeti et al. 2014 (Front. Comput. Neurosci. 8:137) described the OpenWorm project, and Gleeson et al. 2018 (Phil. Trans. R. Soc. B 373) described c302. [K for the citations; S for c302 and Sibernetic existing and what they do]
- Hasani et al. 2018 to 2020 used the tap withdrawal circuit as the structure for Neuronal Circuit Policies, control policies for the inverted pendulum and a rover. [S: arXiv abstract text]
- A student style "wired" robot: Timothy Busbice's Lego robot driven by the connectome (circa 2014). [K, weak. Verify before mentioning.]

These are the standards to compare against. A constraint-plus-search method (Izquierdo and Beer) is more principled than hand tuning, and a natural upgrade is to fit the free parameters of `src/network.mjs` against a behavioural target using a simple evolutionary or gradient free optimiser.

## 3.4 Mechanosensory habituation and learning

Worms habituate to repeated taps (Rankin, Beck and Chiba 1990, Behav. Brain Res. 37:89), and the tap withdrawal circuit is the standard system for studying it. Wicks and Rankin 1995 (J. Neurosci. 15:2434) examined how mechanosensory inputs integrate. [K] The model on this site has no plasticity. Adding a slow depression variable on selected synapses would add habituation and is a small, testable change.

## 3.5 State and neuromodulation

- Dopamine mediates the slowing response to food, and serotonin mediates the effect of past experience of food (Sawin, Ranganathan and Horvitz 2000, Neuron 26:619). [K]
- Roaming and dwelling states are controlled by serotonin and PDF neuropeptide signalling (Flavell et al. 2013, Cell 154:1023). [K]
- Sleep like quiescence occurs during lethargus and after stress, driven by the RIS interneuron, which is GABAergic and peptidergic (Turek et al. 2016, eLife). [K]
- The neuropeptidergic connectome of Ripoll-Sanchez et al. 2023 gives a map of peptide signalling. [S for existence]

These are the slow variables that a pure fast synaptic model lacks, and any claim about "mood" in the steering layer is borrowed language. A defensible next step is to add one slow variable, such as serotonin from NSM and HSN with a time constant of seconds to minutes, that shifts gain across the network, and to make that variable, not instantaneous arousal, drive temperature.

## 3.6 Open items for Claude Code

1. List the AVM, ALM and PLM output edges from `data/connectome.json` and explain the head touch result.
2. Run the sweep in a reproducible script (`scripts/sweep.mjs`) and commit its output table. The sweep code used during development lived in a scratch directory and is not in the repository.
3. Add a second reflex test set from the literature with stimuli and expected sign, for example silencing AVA to abolish reversals, or driving ALA for quiescence.
4. Replace hand tuning with a search over `chemScale`, `inhib`, `fOffset`, `threshold`, `amp`, `tau` against a fixed list of reflex targets. Keep a held out set of targets that the search never sees. Report held out accuracy honestly.
5. Try the pharyngeal and ventral cord subnetworks separately. The ventral cord wiring (A, B, D, AS, VC classes) alone is enough to study wave propagation.
