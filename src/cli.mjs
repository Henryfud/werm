#!/usr/bin/env node
import fs from "node:fs";
import readline from "node:readline/promises";
import { WormBrain, STIMULI } from "./network.mjs";
import { steer, systemPrompt, stimuliFromText, applyStimuli } from "./steer.mjs";
import { chat } from "./ollama.mjs";

const connectome = JSON.parse(fs.readFileSync(new URL("../data/connectome.json", import.meta.url), "utf8"));
const [cmd = "help", ...rest] = process.argv.slice(2);
const flag = (name, def) => { const i = rest.indexOf(`--${name}`); return i >= 0 ? rest[i + 1] : def; };

if (cmd === "sim") {
  const stim = flag("stim", "touch-head");
  const seconds = Number(flag("seconds", 3));
  const w = new WormBrain(connectome);
  w.run(1);
  console.log("rest   ", fmt(w.readout()));
  if (stim !== "none") w.stimulate(stim, true);
  const steps = Math.round(seconds / 0.5);
  for (let i = 1; i <= steps; i++) { w.run(0.5); console.log(`t+${(i * 0.5).toFixed(1)}s`.padEnd(7), fmt(w.readout())); }
} else if (cmd === "chat") {
  const model = flag("model", "llama3.2");
  const w = new WormBrain(connectome);
  w.run(1);
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const history = [];
  console.log(`WERM chat. Model: ${model}. Type 'exit' to quit.\n`);
  for (;;) {
    const line = (await rl.question("you > ")).trim();
    if (!line || line === "exit") break;
    const keys = stimuliFromText(line);
    w.clearInput(); applyStimuli(w, keys, true); w.run(1.5);
    const s = steer(w.readout());
    console.log(`  worm: ${s.summary} | stimuli: ${keys.join(", ")}`);
    console.log(`  sampling: ${JSON.stringify(s.options)}`);
    history.push({ role: "user", content: line });
    try {
      const reply = await chat({ model, options: s.options, messages: [{ role: "system", content: systemPrompt(s.mode) }, ...history] });
      history.push({ role: "assistant", content: reply });
      console.log(`\nai  > ${reply}\n`);
    } catch (e) { console.log(`\n${e.message}\n`); history.pop(); }
    w.clearInput(); w.run(1.0);
  }
  rl.close();
} else {
  console.log(`WERM
  node src/cli.mjs sim  [--stim ${Object.keys(STIMULI).join("|")}|none] [--seconds 3]
  node src/cli.mjs chat [--model llama3.2]     needs Ollama running locally`);
}

function fmt(r) {
  return `drive ${r.drive.toFixed(2).padStart(5)}  fwd ${r.forward.toFixed(2)}  back ${r.backward.toFixed(2)}  sensory ${r.sensory.toFixed(2)}  active ${String(r.active).padStart(3)}`;
}
