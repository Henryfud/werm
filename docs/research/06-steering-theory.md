# 06. Steering a language model with a worm: the theory and the experiments

Tags: `[S]` seen in a fetched source. `[K]` background knowledge to verify before publishing.

This is the part of WERM with the thinnest evidence. The wiring, the genome and the neuron model are grounded in measured data and published work. The step from "worm state" to "how a language model talks" is a design choice, and this file sets out the theory behind it, what it can and cannot do, and the experiments that would show whether it is worth keeping.

## 6.1 What the layer actually does

`src/steer.mjs` takes `readout()` from the network and produces four sampling settings and one tone instruction.

| setting | driven by | direction |
| --- | --- | --- |
| `temperature` | whole network arousal and sensory activity, plus or minus 0.1 for forward or backward drive | more activity, more random |
| `top_p` | sensory activity | more sensory input, wider nucleus |
| `repeat_penalty` | backward drive | backing up, less repetition |
| `num_predict` | forward drive and arousal | crawling forward, longer answers |
| system prompt | mood label (`resting`, `reversing`, `foraging`, `dwelling`) | a one sentence tone line |

It also maps text to stimuli with simple regular expressions: a question pokes the nose touch group, urgent or negative words poke the noxious group, thanks and positive words poke the food smell group, long messages poke the head touch group, and anything else pokes the tail touch group. [C: `src/steer.mjs`]

## 6.2 The theory

**Neuromodulation as an analogy.** In animals, slow neuromodulators such as serotonin, dopamine and neuropeptides change the gain, the time constants and the effective wiring of a fixed circuit, so the same circuit produces different behaviour in different states (Marder 2012, Neuron 76:1, "Neuromodulation of neuronal circuits: back to the future"). [K] Sampling temperature and nucleus width are the closest knobs a language model has: they do not change what the model knows, they change how widely it samples from what it already predicts. A worm state variable driving those knobs is a coarse analogue of neuromodulation acting on a fixed network.

**Sampling settings are real levers.** Temperature rescales the logits before the softmax and so controls entropy (the same device appears in Boltzmann machines, Ackley, Hinton and Sejnowski 1985). Nucleus (top p) sampling truncates the distribution to the smallest set of tokens whose probability reaches p (Holtzman et al. 2020, ICLR, "The curious case of neural text degeneration"). Repetition penalties reduce the probability of tokens already generated (Keskar et al. 2019, CTRL). [K] Each has known, measurable effects on diversity and coherence, which makes them testable.

**Time structure.** A fixed rate network with a time constant of a few hundred milliseconds produces smooth, temporally correlated state. If the sampling settings were driven by an independent random process, they would jump between turns. A worm driven setting has autocorrelation set by the network. Whether that helps a conversation is an empirical question.

**Why a connectome and not a random network?** This is the claim that most needs evidence. A random recurrent network with the same size and density would also produce smooth correlated state. The reason to use the worm is that the structure is real and carries a story people can follow (touch the tail and the forward command rises). Whether the real wiring does anything a degree matched random graph cannot is exactly what the null model experiment below tests.

**Deeper ways to steer a model, for context.** Researchers can intervene on a model's internal activations instead of its sampling settings. Examples include activation addition (Turner et al. 2023), representation engineering (Zou et al. 2023) and inference time intervention (Li et al. 2023). [K, verify titles and venues] These change the content of the computation, not only its randomness, and they need open weights and access to hidden states. A local model served through Ollama does not expose hidden states, so WERM stays at the sampling layer. A future version using llama.cpp or Hugging Face Transformers could inject a worm derived vector into the residual stream. That would be a more interesting experiment and a bigger claim, and it should be tested before it is described.

## 6.3 What it cannot do

- It cannot make a language model more accurate or more capable.
- It cannot give the model a mind state. A one line tone instruction in a prompt is a prompt.
- The worm is not "thinking for" the model. The model generates every token.
- The mappings from worm quantities to settings are arbitrary. Different, equally defensible mappings would give different behaviour.

## 6.4 Experiments to run

All of these can be done locally with a small model and a few hundred prompts. They convert the layer from a demo into something with a measured effect.

1. **Does steering change output at all?** Fix a set of 200 prompts. Generate with default sampling, with worm steering, and with the same settings sampled from an independent random process matched in mean and variance. Compare diversity (distinct n gram ratios, self BLEU, embedding variance across samples), length, and refusal or hedge rate. If worm steering is indistinguishable from the random baseline, the worm adds nothing measurable beyond its settings.
2. **Does temporal structure matter?** Over a long conversation, compare worm driven settings with a shuffled copy of the same sequence (same marginal distribution, destroyed autocorrelation). Look for effects on conversational coherence, for example topic drift measured by embedding similarity across turns.
3. **Does the real wiring matter?** Rewire the connectome with the Maslov and Sneppen degree preserving swap (2002, Science 296:910) and rerun the reflex tests from file 03, the readout statistics, and experiment 1. Run 100 rewirings. Report where the real graph falls in the null distribution. Also compare against an Erdos Renyi graph of equal density. If the real connectome is not distinguishable from its shuffles on any measure, that is a real result and the site should say so.
4. **Does the mapping matter?** Keep the network and change the mapping (for example, drive temperature from forward command only). Measure whether outputs change more than between worm and random steering.
5. **Human evaluation, small and blind.** Present pairs of replies from default and worm steered runs to a handful of people and ask which is more appropriate for the message. Report the number of raters and the result, whatever it is.
6. **Reservoir benchmark** from file 04. It tests the wiring on its own, without any language model.

## 6.5 Honest way to describe it publicly

A defensible description, supported by what exists today: "A 302 neuron model built on the real *C. elegans* wiring diagram, whose state drives the sampling settings and a tone line of a local language model. The mapping from worm to model is a design choice. The reflex behaviour of the network is partly tuned and partly emergent, and three of four reflex checks pass."

If experiments 1 to 4 show effects, add the measured numbers. If they do not, say that too. A plain statement of what was tested is the strongest thing a small project can offer.

## 6.6 Open items for Claude Code

1. Add `scripts/null-models.mjs` implementing degree preserving rewiring, Erdos Renyi graphs and a loop that runs the reflex tests and readout statistics on each. Output a table and a plot.
2. Add `scripts/steer-eval.mjs` implementing experiment 1 against a local Ollama model with fixed seeds. Store prompts in `data/eval-prompts.json`.
3. Add a "Results" section to the README that is empty until real numbers exist, with a clear marker stating that nothing has been measured yet.
4. Consider a second steering backend (llama.cpp activation injection) only after experiments 1 to 4 are done.
