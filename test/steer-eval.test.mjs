import test from "node:test";
import assert from "node:assert/strict";
import { stimuliFromText } from "../src/steer.mjs";
import {
  loadPrompts, loadConnectome, planRun, planConversation, OPTION_KEYS, RANGES,
  distinctN, meanWords, bleu4, selfBleu, hedgeRate, jaccard, embedVariance, altSteer,
} from "../scripts/steer-eval.mjs";

const prompts = loadPrompts();
const connectome = loadConnectome();
const CATEGORIES = ["question", "thanks", "complaint", "long", "statement"];

test("prompts file has 200 unique ids and 40 per category", () => {
  assert.equal(prompts.length, 200);
  assert.equal(new Set(prompts.map((p) => p.id)).size, 200);
  for (const c of CATEGORIES) assert.equal(prompts.filter((p) => p.category === c).length, 40, c);
  assert.ok(prompts.every((p) => CATEGORIES.includes(p.category)));
});

test("long prompts are over 280 characters and question prompts contain a question mark", () => {
  for (const p of prompts.filter((x) => x.category === "long")) assert.ok(p.text.length > 280, p.id);
  for (const p of prompts.filter((x) => x.category === "question")) assert.ok(p.text.includes("?"), p.id);
});

test("each category fires exactly the stimulus it is meant to exercise", () => {
  // stimuliFromText matches substrings, so "know" fires noxious via "now". This catches that.
  const want = { question: "nose-touch", thanks: "food-smell", complaint: "noxious", long: "touch-head", statement: "touch-tail" };
  for (const p of prompts) assert.deepEqual(stimuliFromText(p.text), [want[p.category]], `${p.id}: ${p.text}`);
});

test("dry run plan is deterministic for a fixed seed", () => {
  const a = planRun({ prompts, connectome, seed: 4, limit: 10 });
  const b = planRun({ prompts, connectome, seed: 4, limit: 10 });
  assert.deepEqual(a, b);
  assert.equal(a.rows.length, 30);
  assert.deepEqual([...new Set(a.rows.map((r) => r.condition))], ["default", "worm", "random"]);
  const c = planRun({ prompts, connectome, seed: 5, limit: 10 });
  assert.notDeepEqual(a.random, c.random);
  assert.deepEqual(a.worm, c.worm);
});

test("random condition matches the worm condition's option means within 10 percent and stays in range", () => {
  const plan = planRun({ prompts, connectome, seed: 1 });
  for (const k of OPTION_KEYS) {
    const mw = plan.worm.reduce((s, o) => s + o[k], 0) / plan.worm.length;
    const mr = plan.random.reduce((s, o) => s + o[k], 0) / plan.random.length;
    assert.ok(Math.abs(mr - mw) <= 0.1 * Math.abs(mw), `${k}: worm ${mw} random ${mr}`);
    for (const o of plan.random) assert.ok(o[k] >= RANGES[k][0] && o[k] <= RANGES[k][1], `${k} ${o[k]}`);
  }
});

test("alt mapping only changes temperature and adds a fourth condition", () => {
  const plan = planRun({ prompts, connectome, seed: 1, mapping: "alt", limit: 3 });
  assert.equal(plan.rows.length, 12);
  for (let i = 0; i < 3; i++) {
    const w = plan.rows.find((r) => r.index === i && r.condition === "worm");
    const a = plan.rows.find((r) => r.index === i && r.condition === "alt");
    assert.equal(a.mode, w.mode);
    for (const k of ["top_p", "repeat_penalty", "num_predict"]) assert.equal(a.options[k], w.options[k]);
  }
  assert.equal(altSteer({ forward: 0, drive: 0, arousal: 0, sensory: 0, active: 0 }).options.temperature, 0.15);
  assert.equal(altSteer({ forward: 0.9, drive: 0, arousal: 0, sensory: 0, active: 0 }).options.temperature, 1.35);
});

test("conversation plan shuffles the same settings", () => {
  const a = planConversation({ prompts, connectome, seed: 2, limit: 20 });
  const b = planConversation({ prompts, connectome, seed: 2, limit: 20 });
  assert.deepEqual(a, b);
  assert.equal(a.worm.length, 20);
  const key = (s) => JSON.stringify(s);
  assert.deepEqual(a.shuffled.map(key).sort(), a.worm.map(key).sort());
  assert.deepEqual([...a.order].sort((x, y) => x - y), Array.from({ length: 20 }, (_, i) => i));
});

test("metric functions give known values on small examples", () => {
  assert.equal(distinctN(["a a b"], 1), 2 / 3);
  assert.equal(distinctN(["a a b"], 2), 1);
  assert.equal(distinctN(["a b", "a b"], 1), 0.5);
  assert.equal(distinctN(["a b", "c d"], 2), 1);              // no bigram across the two samples
  assert.equal(meanWords(["one two", "one two three four"]), 3);
  assert.equal(bleu4("the cat sat on the mat", ["the cat sat on the mat"]), 1);
  assert.equal(bleu4("a b", ["c d"]), 0);
  assert.equal(selfBleu(["a b c d", "a b c d"]), 1);
  assert.equal(selfBleu(["only one"]), null);
  // unigrams 2/4, bigrams (1+1)/(3+1), trigrams (0+1)/(2+1), 4 grams (0+1)/(1+1), equal lengths so no penalty
  assert.ok(Math.abs(bleu4("a b c d", ["a b x y"]) - (0.5 * 0.5 * (1 / 3) * 0.5) ** 0.25) < 1e-12);
  assert.equal(hedgeRate(["I'm not sure about that.", "Boil it for six minutes.", "As an AI, I cannot taste food."]), 2 / 3);
  assert.equal(hedgeRate(["I’m sorry to hear that."]), 1);
  assert.equal(jaccard("a b c", "b c d"), 0.5);
  assert.equal(embedVariance([[1, 0], [1, 0]]), 0);
  assert.equal(embedVariance([[1, 0], [-1, 0]]), 1);
});
