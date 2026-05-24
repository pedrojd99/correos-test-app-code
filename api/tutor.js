// /api/tutor — Endpoint serverless (Vercel/Node) que sirve el tutor IA
// con streaming SSE. Reutiliza el prompt engineered prompts/tutor-system-v1.md
// y aplica retrieval por módulo del temario.
//
// Variables de entorno:
//   ANTHROPIC_API_KEY  obligatoria
//   TUTOR_MODEL        opcional (default: claude-sonnet-4-6)
//   TUTOR_MAX_TOKENS   opcional (default: 600)
//
// Request (POST application/json):
//   {
//     messages: [{role: 'user'|'assistant', content: string}],
//     context: {
//       puesto?: 'reparto'|'agente'|'atc'|'clasificacion',
//       currentQuestionId?: string,
//       currentTopicId?: string,
//       moduleStats?: Record<number, number>   // {1: 78, 2: 45, ...}
//     }
//   }
//
// Response: text/event-stream
//   event: token   data: "..."
//   event: done    data: {"usage":...}
//   event: error   data: {"error":"..."}

import Anthropic from "@anthropic-ai/sdk";
import fs from "node:fs";
import path from "node:path";

// ─── Carga única (warm container reutiliza) ──────────────────────────────────
let PROMPT_TEMPLATE = null;
let TEMARIO_BY_MODULE = null;
let TEMARIO_OUTLINE = null;
let QUESTIONS_BY_ID = null;

function loadPrompt() {
  if (PROMPT_TEMPLATE) return PROMPT_TEMPLATE;
  const file = path.join(process.cwd(), "prompts", "tutor-system-v1.md");
  const raw = fs.readFileSync(file, "utf-8");
  const block = raw.match(/```\r?\n([\s\S]*?)```/);
  if (!block) throw new Error("prompts/tutor-system-v1.md sin bloque ``` ```");
  PROMPT_TEMPLATE = block[1].trim();
  return PROMPT_TEMPLATE;
}

function loadTemario() {
  if (TEMARIO_BY_MODULE) return TEMARIO_BY_MODULE;
  const file = path.join(process.cwd(), "data", "temario_content.js");
  const src = fs.readFileSync(file, "utf-8");
  const out = {};
  const re = /^(\d+):\s*`([\s\S]*?)`,?\s*$/gm;
  let m;
  while ((m = re.exec(src)) !== null) {
    out[Number(m[1])] = m[2].trim();
  }
  TEMARIO_BY_MODULE = out;
  return out;
}

function loadOutline() {
  if (TEMARIO_OUTLINE) return TEMARIO_OUTLINE;
  const file = path.join(process.cwd(), "data", "temario.js");
  const src = fs.readFileSync(file, "utf-8");
  const modRe = /\{\s*number:\s*(\d+)\s*,\s*name:\s*'([^']+)'/g;
  const topicRe = /\{\s*number:\s*(\d+)\s*,\s*name:\s*'([^']+)'\s*\}/g;
  const lines = [];
  let mm;
  while ((mm = modRe.exec(src)) !== null) {
    lines.push(`T${mm[1]}: ${mm[2]}`);
  }
  // Topics secundarios (sin separar por módulo: vale como índice plano)
  let tm;
  const topicsAdded = [];
  while ((tm = topicRe.exec(src)) !== null) {
    topicsAdded.push(`  ${tm[1]}. ${tm[2]}`);
  }
  TEMARIO_OUTLINE = lines.join("\n") + "\n\n" + topicsAdded.join("\n");
  return TEMARIO_OUTLINE;
}

function loadQuestions() {
  if (QUESTIONS_BY_ID) return QUESTIONS_BY_ID;
  const file = path.join(process.cwd(), "data", "questions.js");
  const src = fs.readFileSync(file, "utf-8");
  const re =
    /\{id:'([^']+)',module:(\d+),topic:(\d+),text:'([^']+)',options:\[([^\]]+)\],correct:'([A-D])'/g;
  const optRe = /\{letter:'([A-D])',text:'([^']+)'\}/g;
  const out = {};
  let m;
  while ((m = re.exec(src)) !== null) {
    const opts = [];
    let o;
    optRe.lastIndex = 0;
    while ((o = optRe.exec(m[5])) !== null) opts.push({ letter: o[1], text: o[2] });
    out[m[1]] = {
      id: m[1],
      module: Number(m[2]),
      topic: Number(m[3]),
      text: m[4],
      options: opts,
      correct: m[6],
    };
  }
  QUESTIONS_BY_ID = out;
  return out;
}

// ─── Retrieval ligero ────────────────────────────────────────────────────────
// MVP: chunk = módulo entero. Estrategia:
//   1. Si hay currentQuestionId → usa el módulo de esa pregunta.
//   2. Si no, match por palabras clave del último mensaje del usuario.
//   3. Devuelve hasta 2 módulos concatenados (≤ ~25k tokens).
function retrieveChunks(userMsg, ctx) {
  const temario = loadTemario();
  const questions = loadQuestions();
  const moduleIds = new Set();

  if (ctx?.currentQuestionId && questions[ctx.currentQuestionId]) {
    moduleIds.add(questions[ctx.currentQuestionId].module);
  }

  if (moduleIds.size === 0 && userMsg) {
    // Match por densidad de palabras-clave del mensaje en cada módulo
    const words = (userMsg.toLowerCase().match(/[a-záéíóúñ]{4,}/gi) ?? []).slice(0, 25);
    const scores = {};
    for (const [num, html] of Object.entries(temario)) {
      const text = html.toLowerCase();
      let score = 0;
      for (const w of words) {
        if (text.includes(w)) score++;
      }
      scores[num] = score;
    }
    const top = Object.entries(scores)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .filter(([, s]) => s > 0)
      .map(([n]) => Number(n));
    top.forEach((n) => moduleIds.add(n));
  }

  // Fallback: módulo 1
  if (moduleIds.size === 0) moduleIds.add(1);

  const chunks = [];
  for (const num of moduleIds) {
    if (temario[num]) chunks.push(`=== Módulo ${num} ===\n${stripHtml(temario[num])}`);
  }
  return chunks.join("\n\n");
}

function stripHtml(html) {
  return html
    .replace(/<\/?(?:h[1-6]|p|li|ul|ol|strong|em|table|tr|td|th|tbody|thead)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ─── Helpers de contexto ─────────────────────────────────────────────────────
const PUESTO_LABEL = {
  reparto: "Reparto · Personal Laboral Indefinido",
  agente: "Agente · Personal Laboral Indefinido",
  atc: "Atención al Cliente · Personal Laboral Indefinido",
  clasificacion: "Clasificación · Personal Laboral Indefinido",
};
const PUESTO_CORTE = {
  reparto: 5.5,
  agente: 6.0,
  atc: 6.0,
  clasificacion: 5.5,
};

function fillPrompt(template, ctx, retrievedChunks, recentMessages) {
  const puestoKey = ctx?.puesto && PUESTO_LABEL[ctx.puesto] ? ctx.puesto : "reparto";
  const stats = ctx?.moduleStats
    ? Object.entries(ctx.moduleStats)
        .map(([k, v]) => `T${k} ${v}%`)
        .join(" · ")
    : "(sin datos suficientes)";
  const currentQ = ctx?.currentQuestionId
    ? loadQuestions()[ctx.currentQuestionId]
    : null;
  const subs = {
    "{puesto}": PUESTO_LABEL[puestoKey],
    "{nivel_corte}": String(PUESTO_CORTE[puestoKey]),
    "{temario_outline}": loadOutline(),
    "{learner_alias}": ctx?.alias || "el opositor",
    "{learner_module_stats}": stats,
    "{current_topic_id}": ctx?.currentTopicId || "(libre)",
    "{current_question_id}": ctx?.currentQuestionId || "(ninguna)",
    "{retrieved_chunks}": retrievedChunks || "(sin fragmentos relevantes)",
    "{recent_messages}":
      recentMessages?.length
        ? recentMessages.map((m) => `${m.role}: ${m.content}`).join("\n")
        : "(inicio de conversación)",
  };
  let out = template;
  for (const [k, v] of Object.entries(subs)) out = out.split(k).join(v);

  // Si hay pregunta actual, la inyectamos como hint extra al final del bloque
  // dinámico para que el tutor sepa qué tienen en pantalla.
  if (currentQ) {
    const qBlock =
      `\n\n=== PREGUNTA EN PANTALLA ===\n${currentQ.text}\n` +
      currentQ.options.map((o) => `${o.letter}) ${o.text}`).join("\n") +
      `\nRespuesta correcta: ${currentQ.correct}\n`;
    out = out.replace("=== FRAGMENTOS RELEVANTES DEL TEMARIO (RAG) ===", qBlock + "\n=== FRAGMENTOS RELEVANTES DEL TEMARIO (RAG) ===");
  }
  return out;
}

// ─── Handler ─────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "method_not_allowed" }));
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.statusCode = 503;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "anthropic_not_configured" }));
    return;
  }

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  if (!body || !Array.isArray(body.messages) || body.messages.length === 0) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "missing_messages" }));
    return;
  }

  // Sanea + recorta historial (max 12 turnos para no inflar el contexto dinámico)
  const messages = body.messages
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-12)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));

  if (messages[messages.length - 1].role !== "user") {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "last_message_must_be_user" }));
    return;
  }

  const ctx = body.context || {};
  const lastUserMsg = messages[messages.length - 1].content;
  const history = messages.slice(0, -1);

  let systemPrompt;
  try {
    const template = loadPrompt();
    const chunks = retrieveChunks(lastUserMsg, ctx);
    systemPrompt = fillPrompt(template, ctx, chunks, history);
  } catch (e) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "prompt_assembly_failed", detail: String(e.message || e) }));
    return;
  }

  // ─── SSE ───────────────────────────────────────────────────────────────────
  res.statusCode = 200;
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();

  // SSE: siempre JSON.stringify para que saltos de línea dentro del payload no
  // partan el evento en múltiples campos `data:`.
  const send = (event, data) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  const client = new Anthropic({ apiKey });
  const model = process.env.TUTOR_MODEL || "claude-sonnet-4-6";
  const maxTokens = Number(process.env.TUTOR_MAX_TOKENS || 600);

  try {
    const stream = await client.messages.stream({
      model,
      max_tokens: maxTokens,
      temperature: 0.3,
      system: [
        {
          type: "text",
          text: systemPrompt,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: lastUserMsg }],
    });

    for await (const chunk of stream) {
      if (chunk.type === "content_block_delta" && chunk.delta?.type === "text_delta") {
        send("token", chunk.delta.text);
      }
    }
    const final = await stream.finalMessage();
    send("done", {
      usage: final?.usage
        ? {
            inputTokens: final.usage.input_tokens,
            outputTokens: final.usage.output_tokens,
            cacheReadTokens: final.usage.cache_read_input_tokens || 0,
            cacheCreateTokens: final.usage.cache_creation_input_tokens || 0,
          }
        : null,
      stopReason: final?.stop_reason ?? null,
    });
    res.end();
  } catch (e) {
    send("error", { error: String(e?.message || e) });
    res.end();
  }
}

// Vercel-specific: disable default body size limit since SSE responses can be long
export const config = {
  api: {
    responseLimit: false,
  },
};
