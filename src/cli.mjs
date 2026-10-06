#!/usr/bin/env node
import fs from "node:fs";
import readline from "node:readline";
import { WormBrain, STIMULI } from "./network.mjs";
import { steer, systemPrompt, stimuliFromText, applyStimuli } from "./steer.mjs";
import * as ollama from "./ollama.mjs";
import * as openai from "./openai.mjs";

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
} else if (cmd === "connect" || cmd === "chat") {   // "chat" is the older name for the same command
  // two engines: Ollama's own API (default), or any server with the OpenAI chat API (--base-url)
  const baseUrl = flag("base-url", null);
  const apiKey = process.env.WERM_API_KEY;
  const model = flag("model", baseUrl ? undefined : "llama3.2");
  const host = flag("host", "http://localhost:11434");
  if (baseUrl && !model) { console.log("Give the model name your server uses, for example: --model qwen2.5-7b-instruct"); process.exit(1); }
  const problem = baseUrl ? await openai.checkServer({ baseUrl, model, apiKey }) : await ollama.checkOllama({ host, model });
  if (problem) { console.log(problem); process.exit(1); }
  const send = (messages, options) => (baseUrl ? openai.chat({ baseUrl, model, messages, options, apiKey }) : ollama.chat({ host, model, messages, options }));
  if (baseUrl) console.log("OpenAI style server: temperature, top_p, max_tokens and seed are sent. repeat_penalty is not part of that API.");
  const w = new WormBrain(connectome);
  w.run(1);
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const history = [];
  console.log(`WERM connected to ${model}. Type a message, or 'exit' (or Ctrl+D) to quit.\n`);
  let closed = false;
  rl.on("close", () => (closed = true));
  const prompt = () => { if (!closed) rl.prompt(); };   // input may already be closed when piped
  rl.setPrompt("you > ");
  prompt();
  // reading lines as a stream keeps anything typed or pasted while the model is answering
  for await (const raw of rl) {
    const line = raw.trim();
    if (line === "exit") break;
    if (!line) { prompt(); continue; }
    const keys = stimuliFromText(line);
    w.clearInput(); applyStimuli(w, keys, true); w.run(1.5);
    const s = steer(w.readout());
    console.log(`  worm: ${s.summary} | stimuli: ${keys.join(", ")}`);
    console.log(`  sampling: ${JSON.stringify(s.options)}`);
    history.push({ role: "user", content: line });
    try {
      const reply = await send([{ role: "system", content: systemPrompt(s.mode) }, ...history], s.options);
      history.push({ role: "assistant", content: reply });
      console.log(`\nai  > ${reply}\n`);
    } catch (e) { console.log(`\n${e.message}\n`); history.pop(); }
    w.clearInput(); w.run(1.0);
    prompt();
  }
  rl.close();
} else if (cmd === "steer") {
  // no model needed: print what the worm would send for one message, for use with any engine or script
  const text = rest.filter((a, i) => !a.startsWith("--") && !(i > 0 && rest[i - 1].startsWith("--"))).join(" ");
  const keys = stimuliFromText(text);
  const w = new WormBrain(connectome);
  w.run(1); applyStimuli(w, keys, true); w.run(1.5);
  const s = steer(w.readout());
  const out = { stimuli: keys, mode: s.mode, summary: s.summary, ollama_options: s.options, openai_params: openai.toOpenAI(s.options), system_prompt: systemPrompt(s.mode) };
  console.log(JSON.stringify(out, null, 2));
} else {
  console.log(`WERM
  node src/cli.mjs sim  [--stim ${Object.keys(STIMULI).join("|")}|none] [--seconds 3]
  node src/cli.mjs connect [--model llama3.2] [--host http://localhost:11434]     with Ollama
  node src/cli.mjs connect --base-url http://localhost:1234/v1 --model NAME      with any OpenAI style local server
  node src/cli.mjs steer "your message"                                      print the worm's settings as JSON, no model needed`);
}

function fmt(r) {
  return `drive ${r.drive.toFixed(2).padStart(5)}  fwd ${r.forward.toFixed(2)}  back ${r.backward.toFixed(2)}  sensory ${r.sensory.toFixed(2)}  active ${String(r.active).padStart(3)}`;
}
