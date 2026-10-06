# 04. Liquid time constant networks and neuronal circuit policies

Tags: `[S]` seen in a fetched source. `[K]` background knowledge to verify before publishing.

## 4.1 The line of work

| year | work | idea |
| --- | --- | --- |
| 2018 | Lechner, Hasani and Grosu, "Neuronal Circuit Policies" (arXiv 1803.08554) | Model the tap withdrawal (TW) circuit of *C. elegans*, the circuit behind the reflex to a mechanical tap, learn its synaptic and neural parameters as a control policy for the inverted pendulum problem, and reconfigure the circuit's purpose with a search based reinforcement learning method. They also parked a real rover on a pre defined trajectory with a policy learned in simulation. [S: abstract text retrieved from the CatalyzeX author page] |
| 2020 | Lechner et al., "Neural circuit policies enabling auditable autonomy", Nature Machine Intelligence 2:642 to 652 | Sparse, structured four layer circuits (sensory, inter, command, motor neurons) inspired by the worm and used for driving a car in a lane keeping task. [K] |
| 2021 | Hasani, Lechner, Amini, Rus and Grosu, "Liquid Time-constant Networks", AAAI 2021 (arXiv 2006.04439) | Continuous time recurrent networks whose time constants depend on the input. [K, matches the MIT news description in S] |
| 2022 | Hasani et al., "Closed-form continuous-time neural networks", Nature Machine Intelligence 4:992 to 1003 | An approximate closed form for the LTC dynamics, which removes the need for a numerical ODE solver. [K] |
| 2023 | Hasani et al., "Liquid structural state-space models", ICLR 2023 | A bridge to state space sequence models. [K] |
| 2021 on | Liquid AI, a company founded by Hasani, Lechner, Amini and Rus | Commercial models in this family. [K for founding; verify any current product claims] |

The MIT CSAIL press coverage says the networks change their underlying equations to keep adapting to new inputs, and that the work was inspired by *C. elegans*, which has 302 neurons and generates surprisingly complex dynamics. Hasani said the networks sidestep the inscrutability of standard neural networks. [S: ScienceDaily, MIT CSAIL release of 28 January 2021]

Quanta Magazine (7 February 2023) explains that in standard networks the weights are set during training, whereas in liquid networks each neuron is governed by an equation that predicts its behaviour over time, and the way a neuron reacts can vary with the input it receives. It quotes the roboticist Ken Goldberg calling them an elegant and compact alternative, and says experiments show they can run faster and more accurately than other continuous time networks. [S: Quanta Magazine and Nautilus]

An Eni Scuola piece from 2026 reports that Hasani, now CEO of Liquid AI, says these models can run on very small hardware, and notes that liquid networks suit time series data such as video, audio and sensor streams, while standard models are currently more effective on static tasks like image analysis or large scale text generation. [S: eniscuola.eni.com 2026]

## 4.2 The equation

The LTC neuron state obeys: [K]

```
dx/dt = -(1/tau + f(x, I, t, theta)) * x + f(x, I, t, theta) * A
```

`f` is a nonlinearity of the state and input, `A` is a bias, and `tau` is a base time constant. The effective time constant is `tau / (1 + tau * f)`, so it shortens when input is strong. That is the "liquid" property.

`src/network.mjs` uses the same shape with `f = sigmoid(fSlope * (drive - fOffset))` and `A = amp`. This is the single place the project borrows directly from the LTC papers. The rest of the model (chemical and gap junction input, global inhibition, baseline subtraction) is not from them.

## 4.3 What this project is and is not, relative to that work

- It is a fixed, hand parameterised network. There is no training, no gradient, no learned weights.
- The wiring comes from the real connectome instead of a structured random sparse design.
- The Hasani group uses learning to make circuits solve tasks. This project only checks whether simple reflexes appear.
- Do not describe it as a liquid neural network in the sense of those papers without the qualifier "in the style of". It is not the published architecture.

## 4.4 A distinct meaning of "liquid"

Maass, Natschlager and Markram 2002 (Neural Computation 14:2531) introduced liquid state machines, a reservoir computing framework in which a fixed recurrent network projects inputs into a high dimensional state and a trained linear readout reads it. Jaeger 2001 introduced the echo state network with a similar idea. These are different from Hasani's LTCs, although the vocabulary overlaps. [K]

Reservoir computing is relevant here for a specific reason. A fixed network with the real connectome as the reservoir, and a trained linear readout from its activity to a target, would be a legitimate way to ask whether the worm wiring has useful computational properties on tasks such as short term memory or temporal pattern classification. That experiment can be done in a few hundred lines and compared against random reservoirs with matched degree sequence.

## 4.5 Open items for Claude Code

1. Verify every citation above against the primary papers before the site or README quotes a year, venue or number. Pay attention to the NCP journal pages and page ranges.
2. Add a reservoir computing benchmark: drive the network with a time series input through a fixed set of sensory neurons, train a ridge regression readout on all 302 activations, measure memory capacity and a nonlinear task such as NARMA10, and compare the real connectome against degree preserving shuffles and against Erdos Renyi graphs of the same density. This is a clean test of whether the wiring matters.
3. Optionally implement the closed form continuous time (CfC) update as an alternative stepper and compare speed and behaviour with the Euler stepper. The CfC paper gives the formula.
