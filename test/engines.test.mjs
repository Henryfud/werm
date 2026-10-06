// Tests the engine clients and the connect command against small fake servers, so no model is needed.
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { spawn, execFileSync } from "node:child_process";
import { chat, checkOllama } from "../src/ollama.mjs";

function fakeOllama(models = ["llama3.2:latest"]) {
  const seen = [];
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (d) => (body += d));
    req.on("end", () => {
      if (req.url === "/api/tags") return res.end(JSON.stringify({ models: models.map((name) => ({ name })) }));
      if (req.url === "/api/chat") {
        const j = JSON.parse(body);
        seen.push(j);
        if (!models.some((m) => m.split(":")[0] === j.model)) { res.statusCode = 404; return res.end(JSON.stringify({ error: `model "${j.model}" not found` })); }
        return res.end(JSON.stringify({ message: { role: "assistant", content: "hello from the fake model" } }));
      }
      res.statusCode = 404; res.end("{}");
    });
  });
  return new Promise((r) => server.listen(0, "127.0.0.1", () => r({ server, seen, host: `http://127.0.0.1:${server.address().port}` })));
}

test("checkOllama explains how to start Ollama when it is not running", async () => {
  const msg = await checkOllama({ host: "http://127.0.0.1:9", model: "llama3.2" });
  assert.match(msg, /ollama\.com\/download/);
  assert.match(msg, /ollama pull llama3\.2/);
});

test("checkOllama finds a model by its short name and reports a missing one", async () => {
  const { server, host } = await fakeOllama();
  try {
    assert.equal(await checkOllama({ host, model: "llama3.2" }), null);
    assert.match(await checkOllama({ host, model: "mistral" }), /ollama pull mistral/);
  } finally { server.close(); }
});

test("chat sends the worm's options, stream off, and returns the reply", async () => {
  const { server, seen, host } = await fakeOllama();
  try {
    const options = { temperature: 0.5, top_p: 0.8, repeat_penalty: 1.1, num_predict: 200 };
    const reply = await chat({ host, model: "llama3.2", messages: [{ role: "user", content: "hi" }], options });
    assert.equal(reply, "hello from the fake model");
    assert.equal(seen[0].stream, false);
    assert.deepEqual(seen[0].options, options);
    await assert.rejects(chat({ host, model: "mistral", messages: [] }), /ollama pull mistral/);
  } finally { server.close(); }
});

test("the connect command runs end to end and exits cleanly when input ends", async () => {
  const { server, seen, host } = await fakeOllama();
  try {
    const cli = new URL("../src/cli.mjs", import.meta.url).pathname;
    const p = spawn(process.execPath, [cli, "connect", "--host", host]);
    let out = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (out += d));
    p.stdin.end("why is this broken?\nthanks!\n");
    const code = await new Promise((r) => p.on("close", r));
    assert.equal(code, 0, out);
    assert.match(out, /worm: \w+ \| drive/);
    assert.match(out, /sampling: \{"temperature"/);
    assert.match(out, /hello from the fake model/);
    assert.equal(seen.length, 2);
    assert.equal(seen[0].messages[0].role, "system");
  } finally { server.close(); }
});

// ---------- OpenAI style servers (LM Studio, llama.cpp, vLLM, Ollama /v1) ----------
import { chat as oaChat, checkServer, toOpenAI } from "../src/openai.mjs";

function fakeOpenAI() {
  const seen = [];
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (d) => (body += d));
    req.on("end", () => {
      if (req.url === "/v1/models") return res.end(JSON.stringify({ data: [{ id: "local-model" }] }));
      if (req.url === "/v1/chat/completions") { seen.push(JSON.parse(body)); return res.end(JSON.stringify({ choices: [{ message: { role: "assistant", content: "hi from an openai style server" } }] })); }
      res.statusCode = 404; res.end("{}");
    });
  });
  return new Promise((r) => server.listen(0, "127.0.0.1", () => r({ server, seen, baseUrl: `http://127.0.0.1:${server.address().port}/v1` })));
}

test("worm settings map onto standard OpenAI fields, and repeat_penalty is not sent", () => {
  assert.deepEqual(toOpenAI({ temperature: 0.4, top_p: 0.8, repeat_penalty: 1.2, num_predict: 300 }), { temperature: 0.4, top_p: 0.8, max_tokens: 300 });
});

test("OpenAI style server: check, send, and the full connect command", async () => {
  const { server, seen, baseUrl } = await fakeOpenAI();
  try {
    assert.equal(await checkServer({ baseUrl, model: "local-model" }), null);
    assert.match(await checkServer({ baseUrl, model: "other" }), /local-model/);
    assert.match(await checkServer({ baseUrl: "http://127.0.0.1:9/v1", model: "x" }), /No server answered/);
    assert.equal(await oaChat({ baseUrl, model: "local-model", messages: [], options: { temperature: 0.5 } }), "hi from an openai style server");
    const cli = new URL("../src/cli.mjs", import.meta.url).pathname;
    const p = spawn(process.execPath, [cli, "connect", "--base-url", baseUrl, "--model", "local-model"]);
    let out = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (out += d));
    p.stdin.end("hello there\n");
    assert.equal(await new Promise((r) => p.on("close", r)), 0, out);
    assert.match(out, /hi from an openai style server/);
    const last = seen[seen.length - 1];
    assert.equal(last.model, "local-model");
    assert.equal(last.stream, false);
    assert.ok("temperature" in last && "max_tokens" in last && !("repeat_penalty" in last));
  } finally { server.close(); }
});

test("the steer command prints settings as JSON without any engine", () => {
  const out = JSON.parse(execFileSync(process.execPath, [new URL("../src/cli.mjs", import.meta.url).pathname, "steer", "thanks, that is great"], { encoding: "utf8" }));
  assert.deepEqual(out.stimuli, ["food-smell"]);
  assert.ok(out.ollama_options.temperature > 0 && out.openai_params.max_tokens > 0);
  assert.match(out.system_prompt, /Never claim the worm is thinking for you/);
});
