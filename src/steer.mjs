// Turns the worm's state into settings for a local language model.
//
// To be clear about what this is: the worm does not make the model smarter and it does not
// "think" for it. It sits next to the model and nudges how the model talks, the way a mood would.
// Every mapping below is a design choice, not neuroscience, and each one is easy to change.

import { STIMULI } from "./network.mjs";

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// Read a user message and decide which neurons to poke. Crude on purpose, so you can see how it works.
export function stimuliFromText(text) {
  const t = text.toLowerCase();
  const out = new Set();
  if (/\?/.test(t)) out.add("nose-touch");                                   // a question is something to bump into
  if (/(!|asap|urgent|now|hurry|broken|error|wrong|bad|hate)/.test(t)) out.add("noxious");
  if (/(thanks|thank you|great|love|nice|good|please|cool|awesome)/.test(t)) out.add("food-smell");
  if (text.length > 280) out.add("touch-head");                              // a wall of text hits the head
  if (out.size === 0) out.add("touch-tail");                                 // a plain statement nudges it forward
  return [...out];
}

export function applyStimuli(worm, keys, on = true) {
  for (const k of keys) if (STIMULI[k]) worm.stimulate(k, on);
}

// worm readout -> sampling options (names match Ollama's API)
export function steer(readout) {
  const a = clamp(readout.arousal * 2.4 + readout.sensory * 0.8, 0, 1);
  const forward = readout.drive >= 0;
  const temperature = +(0.25 + 1.0 * a + (forward ? 0.1 : -0.1)).toFixed(2);
  const top_p = +(clamp(0.7 + 0.28 * readout.sensory * 2, 0.7, 0.98)).toFixed(2);
  const repeat_penalty = +(1.05 + 0.2 * clamp(-readout.drive * 3, 0, 1)).toFixed(2);   // backing up means stop repeating yourself
  const num_predict = Math.round(clamp(140 + 360 * (forward ? clamp(readout.drive * 3, 0, 1) : 0) + 120 * a, 120, 600));
  const mode = mood(readout);
  return { options: { temperature, top_p, repeat_penalty, num_predict }, mode, summary: describe(readout, mode) };
}

export function mood(r) {
  if (r.active < 6) return "resting";
  if (r.drive < -0.04) return "reversing";
  if (r.drive > 0.08) return "foraging";
  return "dwelling";
}

const STYLE = {
  resting: "You are calm and brief. Answer in a sentence or two.",
  reversing: "You are cautious. Double check, name what could go wrong, and keep it tight.",
  foraging: "You are curious and moving forward. Offer concrete next steps and be generous with detail.",
  dwelling: "You are steady and thorough. Stay on the topic and explain it clearly.",
};

export function systemPrompt(mode) {
  return `You are a helpful assistant whose tone is nudged by a simulated C. elegans nervous system. Current state: ${mode}. ${STYLE[mode]} Never claim the worm is thinking for you.`;
}

export function describe(r, mode = mood(r)) {
  return `${mode} | drive ${r.drive.toFixed(2)} | arousal ${r.arousal.toFixed(2)} | ${r.active}/302 neurons active`;
}
