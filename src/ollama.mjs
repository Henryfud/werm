// Minimal client for a local Ollama server (https://ollama.com). Nothing leaves your machine.
// Errors are turned into one plain sentence that says what to do next.
export async function chat({ host = "http://localhost:11434", model, messages, options }) {
  let res;
  try {
    res = await fetch(`${host}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model, messages, options, stream: false }),
    });
  } catch {
    throw new Error(`Could not reach Ollama at ${host}. Start it with \`ollama serve\` (or open the Ollama app) and try again.`);
  }
  if (!res.ok) {
    let detail = "";
    try { detail = (await res.json()).error || ""; } catch { /* body was not JSON */ }
    if (res.status === 404) throw new Error(`Ollama does not have the model "${model}". Run \`ollama pull ${model}\` first.${detail ? ` (${detail})` : ""}`);
    throw new Error(`Ollama answered ${res.status}${detail ? `: ${detail}` : ""}.`);
  }
  const data = await res.json();
  return data.message?.content ?? "";
}

// Checks that Ollama is running and has the model, before a chat starts.
// Returns null when all is well, or a few lines that say what to do.
export async function checkOllama({ host = "http://localhost:11434", model }) {
  let tags;
  try {
    const res = await fetch(`${host}/api/tags`);
    if (!res.ok) throw new Error(String(res.status));
    tags = await res.json();
  } catch {
    return [
      `Ollama is not running at ${host}.`,
      "  1. Install it from https://ollama.com/download",
      "  2. Open the Ollama app, or run: ollama serve",
      `  3. Download a model: ollama pull ${model}`,
      "Then run this command again.",
    ].join("\n");
  }
  const names = (tags.models || []).map((m) => m.name);
  const has = names.some((n) => n === model || n === `${model}:latest` || n.split(":")[0] === model);
  if (!has) return `Ollama is running but does not have "${model}". Download it with: ollama pull ${model}${names.length ? `\nModels you have: ${names.join(", ")}` : ""}`;
  return null;
}
