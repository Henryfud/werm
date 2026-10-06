# Synapse signs and the GABA list

A wiring diagram says which neurons touch. It does not say whether a synapse excites or inhibits its target. That depends on the transmitter the presynaptic cell releases and on the receptors the target carries. WERM uses one simple rule:

> A chemical synapse is inhibitory if the presynaptic neuron is a conventional GABA neuron. Every other chemical synapse is excitatory. Gap junctions have no sign. They pass current toward whichever side is lower.

The list lives in `GABA` in `src/network.mjs`.

## Source

Gendrel M, Atlas EG, Hobert O. 2016. A cellular and regulatory map of the GABAergic nervous system of *C. elegans*. eLife 5:e17686. [doi:10.7554/eLife.17686](https://doi.org/10.7554/eLife.17686)

Their Table 1 lists every GABA positive cell in the adult and sorts them by how the cell gets its GABA. Checked 2026-10-05 against the table as served by the eLife API.

## The list used here (28 neurons)

| class | neurons | Gendrel 2016 category |
| --- | --- | --- |
| RME | RMED, RMEV, RMEL, RMER | conventional, known before |
| RIS | RIS | conventional, known before |
| AVL | AVL | conventional, known before |
| DVB | DVB | conventional, known before |
| DD | DD1 to DD6 | conventional, known before |
| VD | VD1 to VD13 | conventional, known before |
| RIB | RIBL, RIBR | conventional, newly identified in that paper |

"Conventional" means the cell makes GABA (it expresses *unc-25*, the GABA synthesis enzyme) and packs it for synaptic release (*unc-47*, the vesicular transporter).

## Left out on purpose

| class | neurons | why not inhibitory here |
| --- | --- | --- |
| SMD | SMDDL, SMDDR, SMDVL, SMDVR | GABA by unknown means, weak staining, also cholinergic |
| AVA | AVAL, AVAR | GABA by unknown means, weak staining, also cholinergic |
| AVB | AVBL, AVBR | GABA by unknown means, also cholinergic |
| AVJ | AVJL, AVJR | GABA by unknown means |
| ALA | ALA | takes GABA up (*snf-11*), does not make it |
| AVF | AVFL, AVFR | takes GABA up, does not make it |

Making AVA or AVB inhibitory would turn the command neurons upside down on the strength of a weak stain. The rule above keeps to cells whose GABA release is established.

## What changed in the audit

The first version of the model had the 26 neurons known before 2016 and was missing RIB. Adding RIBL and RIBR reduced the network's habit of leaning backward whatever it was poked with. Measured as the share of 100 random four neuron sensory pokes that pushed the command neurons backward:

| | without RIB | with RIB |
| --- | --- | --- |
| first version parameters | 80% | 61% |
| parameters after the audit sweep | 55% | 42% |

The RIB fix and the new parameters each remove about half of the lean. See `docs/RESULTS.md`.

## What this rule gets wrong

- **Glutamate can inhibit.** The same transmitter can excite one target and inhibit another, depending on the receptors the target carries (for glutamate, ionotropic receptors versus glutamate gated chloride channels). This is background knowledge recorded in `docs/research/02-connectome.md`, section 2.3, not something WERM measures. Getting those right needs receptor expression per target cell, which WERM does not model. The touch neurons are a likely example: their chemical synapses onto the opposite direction command cells are a plausible reason head touch is the weakest reflex in the model. See `docs/RESULTS.md`.
- **Maps for the other transmitters exist** and are the obvious next step: acetylcholine (Pereira et al. 2015, eLife 4:e12432, [doi:10.7554/eLife.12432](https://doi.org/10.7554/eLife.12432)) and glutamate (Serrano-Saiz et al. 2013, Cell 155:659, [doi:10.1016/j.cell.2013.09.052](https://doi.org/10.1016/j.cell.2013.09.052)).
