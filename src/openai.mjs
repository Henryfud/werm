// Client for any local server that speaks the OpenAI chat completions API: LM Studio, llama.cpp's
// llama-server, vLLM, and Ollama's own /v1 endpoint among them. Nothing leaves your machine unless
// you point it somewhere else.
//
// The worm's settings map onto the standard fields: temperature, top_p, max_tokens (from num_predict)
// and seed. repeat_penalty is not part of that API, so it is not sent on this engine.
const headers = (apiKey) => ({ "content-type": "application/json", ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}) });
const trim = (u) => u.replace(/\/+$/, "");

export function toOpenAI(options = {}) {
  const out = {};
  if (options.temperature != null) out.temperature = options.temperature;
  if (options.top_p != null) out.top_p = options.top_p;
  if (options.num_predict != null) out.max_tokens = options.num_predict;
  if (options.seed != null) out.seed = options.seed;
  return out;
}

export async function chat({ baseUrl, model, messages, options, apiKey }) {
  let res;
  try {
    res = await fetch(`${trim(baseUrl)}/chat/completions`, {
      method: "POST",
      headers: headers(apiKey),
      body: JSON.stringify({ model, messages, stream: false, ...toOpenAI(options) }),
    });
  } catch {
    throw new Error(`Could not reach a server at ${baseUrl}. Is your local engine running with its server switched on?`);
  }
  if (!res.ok) {
    let detail = "";
    try { const j = await res.json(); detail = j.error?.message || j.error || ""; } catch { /* body was not JSON */ }
    throw new Error(`The server at ${baseUrl} answered ${res.status}${detail ? `: ${detail}` : ""}.`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

// Returns null when the server answers and lists the model (or lists no models at all), otherwise what to do.
export async function checkServer({ baseUrl, model, apiKey }) {
  let list;
  try {
    const res = await fetch(`${trim(baseUrl)}/models`, { headers: headers(apiKey) });
    if (!res.ok) throw new Error(String(res.status));
    list = await res.json();
  } catch {
    return `No server answered at ${baseUrl}.\nStart your engine's local server first, then check the address. The README lists the usual ones.`;
  }
  const ids = (list.data || []).map((m) => m.id);
  if (model && ids.length && !ids.includes(model)) return `The server at ${baseUrl} does not list "${model}".\nModels it has: ${ids.join(", ")}`;
  return null;
}
