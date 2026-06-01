import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(rootDir, "public");
const port = Number(process.env.PORT ?? 5178);

const provider = (
  process.env.PFE_AI_PROVIDER ?? (process.env.OPENAI_API_KEY ? "openai" : "ollama")
).toLowerCase();
const ollamaUrl = process.env.OLLAMA_URL ?? "http://localhost:11434";
const ollamaModel = process.env.OLLAMA_MODEL ?? "llama3.1";
const openAiBaseUrl = process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";
const openAiModel = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

const modes = {
  academique:
    "Ameliore le style pour un rapport PFE academique, clair et rigoureux.",
  professionnel:
    "Rends le texte plus professionnel, fluide et precis, sans ajouter d'informations.",
  simple:
    "Simplifie le texte et rends-le plus clair, tout en gardant le sens technique.",
  soutenance:
    "Transforme le texte en version orale naturelle pour une soutenance.",
  resume:
    "Resume le texte en gardant uniquement les idees importantes et les termes techniques essentiels.",
};

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

async function readRequestBody(req) {
  let body = "";

  for await (const chunk of req) {
    body += chunk;

    if (body.length > 120_000) {
      throw new Error("Text is too long. Keep one section or paragraph at a time.");
    }
  }

  return body ? JSON.parse(body) : {};
}

function buildMessages({ text, mode, language }) {
  const selectedMode = modes[mode] ?? modes.academique;
  const outputLanguage = language === "en" ? "English" : "French";

  return [
    {
      role: "system",
      content:
        "You are an academic writing assistant for a final-year engineering project report. " +
        "Your role is to improve the user's own writing, not to invent content or hide authorship.",
    },
    {
      role: "user",
      content: `Rewrite the following text in ${outputLanguage}.\n\nMode: ${selectedMode}\n\nRules:\n- Keep the exact technical meaning.\n- Do not invent facts, metrics, tools, dates, citations, or results.\n- Preserve technology names, KPIs, model names, architecture terms, numbers, and citations.\n- Improve clarity, flow, grammar, and academic tone.\n- Avoid generic marketing language.\n- Return only the rewritten text.\n\nText:\n"""\n${text}\n"""`,
    },
  ];
}

async function rewriteWithOllama(messages) {
  const response = await fetch(`${ollamaUrl.replace(/\/$/, "")}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: ollamaModel,
      messages,
      stream: false,
      options: { temperature: 0.35 },
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Ollama returned ${response.status}. Make sure Ollama is running and model '${ollamaModel}' is installed.`,
    );
  }

  const data = await response.json();
  const content = data?.message?.content?.trim();

  if (!content) {
    throw new Error("Ollama returned an empty response.");
  }

  return content;
}

async function rewriteWithOpenAI(messages) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required when PFE_AI_PROVIDER=openai.");
  }

  const response = await fetch(`${openAiBaseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: openAiModel,
      messages,
      temperature: 0.35,
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`OpenAI-compatible API returned ${response.status}: ${details}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content?.trim();

  if (!content) {
    throw new Error("OpenAI-compatible API returned an empty response.");
  }

  return content;
}

async function handleRewrite(req, res) {
  try {
    const body = await readRequestBody(req);
    const text = String(body.text ?? "").trim();
    const mode = String(body.mode ?? "academique");
    const language = String(body.language ?? "fr");

    if (text.length < 10) {
      sendJson(res, 400, { error: "Paste a paragraph or section first." });
      return;
    }

    const messages = buildMessages({ text, mode, language });
    const rewritten =
      provider === "openai"
        ? await rewriteWithOpenAI(messages)
        : await rewriteWithOllama(messages);

    sendJson(res, 200, { rewritten, provider, model: provider === "openai" ? openAiModel : ollamaModel });
  } catch (error) {
    sendJson(res, 500, { error: error instanceof Error ? error.message : "Unknown error" });
  }
}

async function serveStatic(req, res) {
  const requestUrl = new URL(req.url ?? "/", `http://${req.headers.host}`);
  const pathname = requestUrl.pathname === "/" ? "/index.html" : requestUrl.pathname;
  const safePath = path.resolve(publicDir, `.${decodeURIComponent(pathname)}`);

  if (!safePath.startsWith(publicDir)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  try {
    const content = await readFile(safePath);
    const extension = path.extname(safePath);
    res.writeHead(200, { "Content-Type": contentTypes[extension] ?? "text/plain" });
    res.end(content);
  } catch {
    const index = await readFile(path.join(publicDir, "index.html"));
    res.writeHead(200, { "Content-Type": contentTypes[".html"] });
    res.end(index);
  }
}

const server = createServer(async (req, res) => {
  const requestUrl = new URL(req.url ?? "/", `http://${req.headers.host}`);

  if (req.method === "GET" && requestUrl.pathname === "/api/config") {
    sendJson(res, 200, {
      provider,
      model: provider === "openai" ? openAiModel : ollamaModel,
    });
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/api/rewrite") {
    await handleRewrite(req, res);
    return;
  }

  if (req.method === "GET") {
    await serveStatic(req, res);
    return;
  }

  sendJson(res, 405, { error: "Method not allowed" });
});

server.listen(port, () => {
  console.log(`PFE Writing Assistant running at http://localhost:${port}`);
  console.log(`Provider: ${provider} | Model: ${provider === "openai" ? openAiModel : ollamaModel}`);
});
