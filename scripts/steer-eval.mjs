#!/usr/bin/env node
// Does worm steering change what a local model says? Experiments 1, 2 and 4 from docs/research/06-steering-theory.md.
//
// This script has not been run against a real model in this repository yet. No numbers exist.
//
//   node scripts/steer-eval.mjs --dry-run [--limit 5]        print the planned settings, no server needed
//   node scripts/steer-eval.mjs [--model llama3.2] [--host http://localhost:11434] [--samples 3] [--limit N]
//                               [--seed 1] [--embed-model nomic-embed-text] [--mapping alt] [--conversation]
//
// Experiment 1 (the default). Each of the 200 prompts in data/eval-prompts.json goes to the model
// under three conditions, --samples times each:
//   default  no sampling options, system prompt "You are a helpful assistant."
//   worm     a fresh WormBrain per prompt, seeded with the prompt index plus one. Then the same steps as
//            src/cli.mjs: run 1 s, clear input, apply stimuliFromText, run 1.5 s, steer(readout).
//            Options and systemPrompt(mode) come from src/steer.mjs unchanged.
//   random   options drawn from a seeded random process with the same per option mean and standard
//            deviation as the worm condition over all 200 prompts. Each option is drawn on its own from a
//            normal distribution, clamped to the range steer() can produce, and rounded the way steer() rounds.
//            The mode label is drawn to match how often each mode appears in the worm condition. Same
//            system prompt template as worm. The fit always uses all 200 prompts, so a --limit run is a prefix
//            of the full run.
// Every call passes options.seed. The seed depends only on the prompt and the sample number, so all
// conditions share it and differences come from the settings, not the dice.
//
// Experiment 4 (--mapping alt) adds a fourth condition, alt. Same network, same stimuli, same steer()
// output, except temperature is driven by the forward command neurons only:
//   temperature = round2(0.15 + 1.2 * clamp(readout.forward / 0.6, 0, 1))
// readout.forward is the mean activation of AVBL, AVBR, PVCL and PVCR. On these prompts it runs from 0 to
// about 0.61, so dividing by 0.6 spreads it over the same 0.15 to 1.35 range steer() uses. The summary then
// prints how far alt moves each metric from worm, next to how far random moves it from worm.
//
// Experiment 2 (--conversation). One long scripted chat over the prompts in order, with full history like
// src/cli.mjs. One WormBrain (default seed, like the cli) lives through the whole chat, including the
// cli's 1 s rest after each reply. Arm "worm" uses its settings turn by turn. Arm "shuffled" uses the same
// settings in a seeded random order: same values, no memory from one turn to the next. The metric is the
// mean word overlap (Jaccard index of word sets) between consecutive replies. It is a cheap proxy for topic
// drift, not a measure of coherence. With --embed-model it also reports mean cosine similarity of
// consecutive reply embeddings.
//
// Metrics for experiment 1, per prompt across its samples, then averaged over prompts:
//   distinct1, distinct2  unique word n grams divided by all word n grams, pooled over the samples
//   selfBleu              mean BLEU 4 of each sample against the other samples (higher means more alike)
//   words                 mean reply length in words
//   hedge                 share of replies that match any pattern in HEDGES below
//   embedVar              with --embed-model: mean squared distance of unit length embeddings from their centre
//
// Raw replies are appended to docs/results/steer-eval/raw-<model>-<date>.jsonl, one JSON object per call,
// each tagged with a run id. The summary JSON and a markdown table go to stdout.
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { WormBrain, mulberry32 } from "../src/network.mjs";
import { steer, systemPrompt, stimuliFromText, applyStimuli } from "../src/steer.mjs";
import { chat } from "../src/ollama.mjs";

const ROOT = new URL("../", import.meta.url);
export const DEFAULT_SYSTEM = "You are a helpful assistant.";
export const OPTION_KEYS = ["temperature", "top_p", "repeat_penalty", "num_predict"];
// The range each option can take under steer() in src/steer.mjs.
export const RANGES = { temperature: [0.15, 1.35], top_p: [0.7, 0.98], repeat_penalty: [1.05, 1.25], num_predict: [120, 600] };

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const round2 = (v) => +v.toFixed(2);

export function loadPrompts() {
  return JSON.parse(fs.readFileSync(new URL("data/eval-prompts.json", ROOT), "utf8"));
}
export function loadConnectome() {
  return JSON.parse(fs.readFileSync(new URL("data/connectome.json", ROOT), "utf8"));
}

// One chat turn's worth of worm, as in src/cli.mjs, on a worm that has already rested.
function turn(worm, text) {
  const keys = stimuliFromText(text);
  worm.clearInput(); applyStimuli(worm, keys, true); worm.run(1.5);
  const readout = worm.readout();
  return { keys, readout };
}

// Experiment 4 mapping. Everything from steer() except temperature, which follows the forward command only.
export function altSteer(readout) {
  const s = steer(readout);
  const temperature = round2(0.15 + 1.2 * clamp(readout.forward / 0.6, 0, 1));
  return { ...s, options: { ...s.options, temperature } };
}

// Per option mean and standard deviation (population), plus how often each mode shows up.
export function fitOptions(list) {
  const fit = {};
  for (const k of OPTION_KEYS) {
    const v = list.map((s) => s.options[k]);
    const mean = v.reduce((a, b) => a + b, 0) / v.length;
    const sd = Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / v.length);
    fit[k] = { mean, sd };
  }
  const modes = {};
  for (const s of list) modes[s.mode] = (modes[s.mode] ?? 0) + 1;
  for (const m in modes) modes[m] /= list.length;
  return { options: fit, modes };
}

// Standard normal draw from a uniform source (Box and Muller).
function normal(rand) {
  const u = Math.max(rand(), 1e-12), v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function sampleRandom(fit, rand) {
  const options = {};
  for (const k of OPTION_KEYS) {
    const { mean, sd } = fit.options[k];
    const [lo, hi] = RANGES[k];
    const x = clamp(mean + sd * normal(rand), lo, hi);
    options[k] = k === "num_predict" ? Math.round(x) : round2(x);
  }
  let r = rand(), mode = null;
  const entries = Object.entries(fit.modes).sort(([a], [b]) => a.localeCompare(b));
  for (const [m, p] of entries) { mode = m; r -= p; if (r < 0) break; }
  return { options, mode };
}

// The seed handed to Ollama for one prompt and one sample. Shared by every condition.
export function callSeed(base, index, sample) {
  return (base * 1000003 + index * 1009 + sample) >>> 0;
}

// Plans experiment 1 (and 4). Pure: no network, no clock, no file writes beyond reading inputs.
export function planRun({ prompts = loadPrompts(), connectome = loadConnectome(), seed = 1, mapping = "standard", samples = 3, limit } = {}) {
  const worm = [], alt = [];
  prompts.forEach((p, i) => {
    const w = new WormBrain(connectome, {}, i + 1);
    w.run(1);
    const { keys, readout } = turn(w, p.text);
    worm.push({ ...steer(readout), keys, forward: readout.forward });
    if (mapping === "alt") alt.push(altSteer(readout));
  });
  const fit = fitOptions(worm);
  const rand = mulberry32((0x9e3779b9 ^ seed) >>> 0);
  const random = prompts.map(() => sampleRandom(fit, rand));

  const n = Math.min(prompts.length, limit ?? prompts.length);
  const rows = [];
  for (let i = 0; i < n; i++) {
    const p = prompts[i];
    const seeds = Array.from({ length: samples }, (_, s) => callSeed(seed, i, s));
    const base = { id: p.id, category: p.category, index: i, stimuli: worm[i].keys, seeds };
    rows.push({ ...base, condition: "default", mode: null, options: {}, system: DEFAULT_SYSTEM });
    rows.push({ ...base, condition: "worm", mode: worm[i].mode, options: worm[i].options, system: systemPrompt(worm[i].mode) });
    rows.push({ ...base, condition: "random", mode: random[i].mode, options: random[i].options, system: systemPrompt(random[i].mode) });
    if (mapping === "alt") rows.push({ ...base, condition: "alt", mode: alt[i].mode, options: alt[i].options, system: systemPrompt(alt[i].mode) });
  }
  return { fit, rows, worm: worm.map((s) => s.options), random: random.map((s) => s.options) };
}

// Plans experiment 2. One worm across the whole chat, then a seeded shuffle of the same settings.
export function planConversation({ prompts = loadPrompts(), connectome = loadConnectome(), seed = 1, limit } = {}) {
  const list = prompts.slice(0, Math.min(prompts.length, limit ?? prompts.length));
  const w = new WormBrain(connectome);
  w.run(1);
  const worm = list.map((p) => {
    const { readout } = turn(w, p.text);
    const s = steer(readout);
    w.clearInput(); w.run(1.0);
    return { options: s.options, mode: s.mode };
  });
  const order = worm.map((_, i) => i);
  const rand = mulberry32((0x85ebca6b ^ seed) >>> 0);
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  const shuffled = order.map((j) => worm[j]);
  return { prompts: list, worm, shuffled, order };
}

// Metrics.

export function words(text) {
  return text.toLowerCase().replace(/’/g, "'").match(/[a-z0-9']+/g) ?? [];
}

function ngrams(tokens, n) {
  const out = [];
  for (let i = 0; i + n <= tokens.length; i++) out.push(tokens.slice(i, i + n).join(" "));
  return out;
}

// Unique n grams over all n grams, pooled across the samples. N grams never cross from one sample to the next.
export function distinctN(texts, n) {
  const all = texts.flatMap((t) => ngrams(words(t), n));
  return all.length ? new Set(all).size / all.length : 0;
}

export function meanWords(texts) {
  return texts.length ? texts.reduce((a, t) => a + words(t).length, 0) / texts.length : 0;
}

function counts(list) {
  const m = new Map();
  for (const g of list) m.set(g, (m.get(g) ?? 0) + 1);
  return m;
}

// BLEU 4 with uniform weights. Smoothing: add one to the matched and total counts for n of 2 to 4
// (Lin and Och 2004), so short replies do not score zero just for missing a 4 gram. Unigrams are not smoothed.
// Brevity penalty uses the reference length closest to the candidate, shorter one on a tie.
export function bleu4(candidate, references) {
  const c = words(candidate), refs = references.map(words);
  if (!c.length || !refs.length) return 0;
  let logSum = 0;
  for (let n = 1; n <= 4; n++) {
    const cand = counts(ngrams(c, n));
    const maxRef = new Map();
    for (const r of refs) for (const [g, k] of counts(ngrams(r, n))) maxRef.set(g, Math.max(maxRef.get(g) ?? 0, k));
    let match = 0, total = 0;
    for (const [g, k] of cand) { match += Math.min(k, maxRef.get(g) ?? 0); total += k; }
    if (n > 1) { match += 1; total += 1; }
    if (match === 0 || total === 0) return 0;
    logSum += Math.log(match / total) / 4;
  }
  const r = refs.map((x) => x.length).sort((a, b) => Math.abs(a - c.length) - Math.abs(b - c.length) || a - b)[0];
  const bp = c.length > r ? 1 : Math.exp(1 - r / c.length);
  return bp * Math.exp(logSum);
}

// Mean BLEU of each sample against all the others. Needs at least two samples.
export function selfBleu(texts) {
  if (texts.length < 2) return null;
  let s = 0;
  for (let i = 0; i < texts.length; i++) s += bleu4(texts[i], texts.filter((_, j) => j !== i));
  return s / texts.length;
}

// Hedge and refusal patterns. Short on purpose; a match on any one counts the reply once.
export const HEDGES = [
  /\bas an ai\b/i,
  /\bi(?:'m| am) (?:not sure|unable|not able)\b/i,
  /\bi (?:cannot|can't|can not) (?:help|assist|provide|answer)\b/i,
  /\bi(?:'m| am) sorry\b/i,
  /\bi apologi[sz]e\b/i,
  /\bit depends\b/i,
  /\bi (?:don't|do not) have (?:access|enough information)\b/i,
  /\bconsult (?:a|an|your) (?:professional|doctor|expert|lawyer)\b/i,
];

export function hedgeRate(texts) {
  if (!texts.length) return 0;
  return texts.filter((t) => HEDGES.some((re) => re.test(t.replace(/’/g, "'")))).length / texts.length;
}

export function jaccard(a, b) {
  const A = new Set(words(a)), B = new Set(words(b));
  if (!A.size && !B.size) return 1;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  return inter / (A.size + B.size - inter);
}

function unit(v) {
  const n = Math.sqrt(v.reduce((a, x) => a + x * x, 0)) || 1;
  return v.map((x) => x / n);
}

// Mean squared distance of unit length embeddings from their centre. 0 means all samples point the same way.
export function embedVariance(vectors) {
  if (vectors.length < 2) return null;
  const u = vectors.map(unit), d = u[0].length;
  const centre = Array.from({ length: d }, (_, j) => u.reduce((a, v) => a + v[j], 0) / u.length);
  return u.reduce((a, v) => a + v.reduce((s, x, j) => s + (x - centre[j]) ** 2, 0), 0) / u.length;
}

export function cosine(a, b) {
  const ua = unit(a), ub = unit(b);
  return ua.reduce((s, x, j) => s + x * ub[j], 0);
}

const mean = (v) => { const x = v.filter((y) => y !== null && Number.isFinite(y)); return x.length ? x.reduce((a, b) => a + b, 0) / x.length : null; };

// Turns a list of {condition, replies, vectors?} (one per prompt and condition) into a per condition summary.
export function summarise(groups) {
  const by = {};
  for (const g of groups) (by[g.condition] ??= []).push(g);
  const out = {};
  for (const [cond, list] of Object.entries(by)) {
    out[cond] = {
      prompts: list.length,
      distinct1: mean(list.map((g) => distinctN(g.replies, 1))),
      distinct2: mean(list.map((g) => distinctN(g.replies, 2))),
      selfBleu: mean(list.map((g) => selfBleu(g.replies))),
      words: mean(list.map((g) => meanWords(g.replies))),
      hedge: mean(list.map((g) => hedgeRate(g.replies))),
      embedVar: mean(list.map((g) => (g.vectors ? embedVariance(g.vectors) : null))),
    };
  }
  return out;
}

const METRICS = ["distinct1", "distinct2", "selfBleu", "words", "hedge", "embedVar"];
const cell = (v) => (v === null || v === undefined ? "n/a" : v.toFixed(3));

export function markdownTable(summary) {
  const lines = [`| condition | prompts | ${METRICS.join(" | ")} |`, `|${"---|".repeat(METRICS.length + 2)}`];
  for (const [cond, s] of Object.entries(summary)) lines.push(`| ${cond} | ${s.prompts} | ${METRICS.map((m) => cell(s[m])).join(" | ")} |`);
  return lines.join("\n");
}

// Experiment 4: how far alt and random each move every metric away from worm.
export function shiftTable(summary) {
  const lines = ["| metric | abs(alt minus worm) | abs(random minus worm) |", "|---|---|---|"];
  for (const m of METRICS) {
    const w = summary.worm?.[m], a = summary.alt?.[m], r = summary.random?.[m];
    const d = (x) => (x === null || x === undefined || w === null || w === undefined ? null : Math.abs(x - w));
    lines.push(`| ${m} | ${cell(d(a))} | ${cell(d(r))} |`);
  }
  return lines.join("\n");
}

// Talking to Ollama.

async function reachable(host) {
  try { const r = await fetch(`${host}/api/tags`); return r.ok; } catch { return false; }
}

async function embed(host, model, input) {
  const res = await fetch(`${host}/api/embed`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ model, input }) });
  if (!res.ok) throw new Error(`Ollama said ${res.status} for embeddings. Did you pull ${model}?`);
  return (await res.json()).embeddings;
}

function fail(msg) { console.error(msg); process.exit(1); }

function rawPath(model) {
  const safe = model.replace(/[^a-zA-Z0-9._-]/g, "_");
  const date = new Date().toISOString().slice(0, 10);
  return new URL(`docs/results/steer-eval/raw-${safe}-${date}.jsonl`, ROOT);
}

function openRaw(model) {
  fs.mkdirSync(new URL("docs/results/steer-eval/", ROOT), { recursive: true });
  const path = rawPath(model);
  const run = new Date().toISOString();
  return { path, write: (obj) => fs.appendFileSync(path, JSON.stringify({ run, ...obj }) + "\n") };
}

async function call(host, model, system, history, options) {
  try {
    return await chat({ host, model, options, messages: [{ role: "system", content: system }, ...history] });
  } catch (e) {
    fail(e.message.startsWith("Ollama said") ? e.message : `Lost contact with Ollama at ${host}: ${e.message}`);
  }
}

async function runExperiment1(cfg) {
  const plan = planRun(cfg);
  const raw = openRaw(cfg.model);
  const groups = [];
  for (const row of plan.rows) {
    const replies = [];
    for (let s = 0; s < row.seeds.length; s++) {
      const options = { ...row.options, seed: row.seeds[s] };
      const reply = await call(cfg.host, cfg.model, row.system, [{ role: "user", content: cfg.prompts[row.index].text }], options);
      replies.push(reply);
      raw.write({ experiment: cfg.mapping === "alt" ? 4 : 1, model: cfg.model, id: row.id, category: row.category, condition: row.condition, sample: s, mode: row.mode, options, reply });
    }
    const vectors = cfg.embedModel ? await embed(cfg.host, cfg.embedModel, replies).catch((e) => fail(e.message)) : null;
    groups.push({ condition: row.condition, replies, vectors });
    process.stderr.write(`\r${groups.length}/${plan.rows.length}`);
  }
  process.stderr.write("\n");
  const summary = summarise(groups);
  console.log(JSON.stringify({ experiment: cfg.mapping === "alt" ? 4 : 1, model: cfg.model, samples: cfg.samples, seed: cfg.seed, raw: raw.path.pathname, fit: plan.fit, summary }, null, 2));
  console.log("\n" + markdownTable(summary));
  if (cfg.mapping === "alt") console.log("\n" + shiftTable(summary));
}

async function runExperiment2(cfg) {
  const plan = planConversation(cfg);
  const raw = openRaw(cfg.model);
  const result = {};
  for (const arm of ["worm", "shuffled"]) {
    const overlaps = [], cosines = [];
    for (let s = 0; s < cfg.samples; s++) {
      const history = [], replies = [];
      for (let i = 0; i < plan.prompts.length; i++) {
        const { options, mode } = plan[arm][i];
        const opts = { ...options, seed: callSeed(cfg.seed, i, s) };
        history.push({ role: "user", content: plan.prompts[i].text });
        const reply = await call(cfg.host, cfg.model, systemPrompt(mode), history, opts);
        history.push({ role: "assistant", content: reply });
        replies.push(reply);
        raw.write({ experiment: 2, model: cfg.model, arm, sample: s, turn: i, id: plan.prompts[i].id, mode, options: opts, reply });
        process.stderr.write(`\r${arm} sample ${s + 1} turn ${i + 1}/${plan.prompts.length}`);
      }
      for (let i = 1; i < replies.length; i++) overlaps.push(jaccard(replies[i - 1], replies[i]));
      if (cfg.embedModel) {
        const v = await embed(cfg.host, cfg.embedModel, replies).catch((e) => fail(e.message));
        for (let i = 1; i < v.length; i++) cosines.push(cosine(v[i - 1], v[i]));
      }
    }
    result[arm] = { turns: plan.prompts.length, samples: cfg.samples, meanJaccard: mean(overlaps), meanCosine: cfg.embedModel ? mean(cosines) : null };
  }
  process.stderr.write("\n");
  console.log(JSON.stringify({ experiment: 2, model: cfg.model, seed: cfg.seed, raw: raw.path.pathname, order: plan.order, result }, null, 2));
  console.log("\n| arm | turns | samples | mean Jaccard of consecutive replies | mean cosine of consecutive replies |\n|---|---|---|---|---|");
  for (const [arm, r] of Object.entries(result)) console.log(`| ${arm} | ${r.turns} | ${r.samples} | ${cell(r.meanJaccard)} | ${cell(r.meanCosine)} |`);
}

function printDryRun(cfg) {
  if (cfg.conversation) {
    const plan = planConversation(cfg);
    console.log(`Experiment 2 plan: ${plan.prompts.length} turns, one conversation per arm per sample, ${cfg.samples} samples.`);
    plan.prompts.forEach((p, i) => {
      console.log(`${p.id} turn ${i + 1}`);
      console.log(`  worm      ${plan.worm[i].mode.padEnd(9)} ${JSON.stringify(plan.worm[i].options)}`);
      console.log(`  shuffled  ${plan.shuffled[i].mode.padEnd(9)} ${JSON.stringify(plan.shuffled[i].options)}`);
    });
    return;
  }
  const plan = planRun(cfg);
  const fit = Object.fromEntries(OPTION_KEYS.map((k) => [k, { mean: round2(plan.fit.options[k].mean), sd: +plan.fit.options[k].sd.toFixed(3) }]));
  console.log(`Experiment ${cfg.mapping === "alt" ? 4 : 1} plan. Random condition fit on all prompts: ${JSON.stringify(fit)} modes ${JSON.stringify(plan.fit.modes)}`);
  let last = null;
  for (const r of plan.rows) {
    if (r.id !== last) { console.log(`${r.id} ${r.category} stimuli ${r.stimuli.join(",")} seeds ${r.seeds.join(",")}`); last = r.id; }
    console.log(`  ${r.condition.padEnd(8)} ${(r.mode ?? "none").padEnd(9)} ${JSON.stringify(r.options)}`);
  }
}

async function main(argv) {
  const has = (name) => argv.includes(`--${name}`);
  const flag = (name, def) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : def; };
  const prompts = loadPrompts();
  const cfg = {
    prompts,
    connectome: loadConnectome(),
    model: flag("model", "llama3.2"),
    host: flag("host", "http://localhost:11434"),
    samples: Number(flag("samples", 3)),
    limit: has("limit") ? Number(flag("limit")) : undefined,
    seed: Number(flag("seed", 1)),
    mapping: flag("mapping", "standard"),
    embedModel: flag("embed-model"),
    conversation: has("conversation"),
  };
  if (!["standard", "alt"].includes(cfg.mapping)) fail(`Unknown --mapping ${cfg.mapping}. Use standard or alt.`);
  if (cfg.conversation && cfg.mapping === "alt") fail("--conversation and --mapping alt are separate experiments. Run them one at a time.");
  if (has("dry-run")) return printDryRun(cfg);
  if (!(await reachable(cfg.host))) fail(`Could not reach Ollama at ${cfg.host}. Start it with "ollama serve" and pull ${cfg.model} first.`);
  return cfg.conversation ? runExperiment2(cfg) : runExperiment1(cfg);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main(process.argv.slice(2));
