// Minimal client for a local Ollama server (https://ollama.com). Nothing leaves your machine.
export async function chat({ host = "http://localhost:11434", model, messages, options }) {
  const res = await fetch(`${host}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ model, messages, options, stream: false }),
  });
  if (!res.ok) throw new Error(`Ollama said ${res.status}. Is it running, and did you pull ${model}?`);
  const data = await res.json();
  return data.message?.content ?? "";
}
