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
