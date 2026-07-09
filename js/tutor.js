// Tutor IA — panel chat con streaming SSE contra /api/tutor.
// Se abre desde el botón flotante o desde el feedback de una pregunta fallada.

window.IIAPP = window.IIAPP || {};

window.IIAPP.Tutor = (function () {
  const Storage = window.IIAPP.Storage;
  const TEMARIO = window.IIAPP.TEMARIO;
  const Stats = window.IIAPP.Stats;

  const State = {
    open: false,
    messages: [],        // {role, content}
    currentRequest: null,
    contextHint: null,   // {currentQuestionId, currentTopicId, ...}
  };

  function esc(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function renderMarkdownLite(s) {
    // Markdown mínimo: **negrita**, *cursiva*, `código`, salto de línea
    return esc(s)
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\*([^*]+)\*/g, "<em>$1</em>")
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\n/g, "<br>");
  }

  function ensureUI() {
    if (document.getElementById("tutor-panel")) return;

    const fab = document.createElement("button");
    fab.id = "tutor-fab";
    fab.className = "tutor-fab";
    fab.setAttribute("aria-label", "Abrir tutor IA");
    fab.innerHTML = "💬";
    fab.addEventListener("click", () => open());
    document.body.appendChild(fab);

    const panel = document.createElement("aside");
    panel.id = "tutor-panel";
    panel.className = "tutor-panel hidden";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "Tutor IA");
    panel.innerHTML = `
      <div class="tutor-head">
        <div>
          <strong>Tutor IA · Correos</strong>
          <div class="tutor-sub" id="tutor-ctx">Pregúntame sobre el temario</div>
        </div>
        <button class="tutor-close" aria-label="Cerrar tutor" type="button">✕</button>
      </div>
      <div class="tutor-msgs" id="tutor-msgs" aria-live="polite"></div>
      <form class="tutor-form" id="tutor-form" autocomplete="off">
        <textarea id="tutor-input" rows="2" placeholder="Escribe tu pregunta…"
                  aria-label="Pregunta para el tutor" maxlength="1500"></textarea>
        <button type="submit" class="tutor-send" id="tutor-send" aria-label="Enviar">↵</button>
      </form>
      <div class="tutor-footer">
        Sin signup · respuestas citadas al temario · no inventa datos.
      </div>
    `;
    document.body.appendChild(panel);

    panel.querySelector(".tutor-close").addEventListener("click", close);
    panel.querySelector("#tutor-form").addEventListener("submit", onSubmit);
    panel.querySelector("#tutor-input").addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        onSubmit(e);
      }
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && State.open) close();
    });
  }

  function setContextHint(hint) {
    State.contextHint = hint || null;
    const el = document.getElementById("tutor-ctx");
    if (!el) return;
    if (hint?.currentQuestionId) {
      el.textContent = "Contexto: pregunta en pantalla";
    } else if (hint?.currentTopicId) {
      el.textContent = `Contexto: tema ${hint.currentTopicId}`;
    } else {
      el.textContent = "Pregúntame sobre el temario";
    }
  }

  function appendMessage(role, content, opts = {}) {
    const id = `tutor-msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    State.messages.push({ role, content, id });
    const list = document.getElementById("tutor-msgs");
    const wrap = document.createElement("div");
    wrap.className = `tutor-msg tutor-msg-${role}` + (opts.streaming ? " streaming" : "");
    wrap.id = id;
    wrap.innerHTML = renderMarkdownLite(content);
    list.appendChild(wrap);
    list.scrollTop = list.scrollHeight;
    return id;
  }

  function updateMessage(id, content, opts = {}) {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = renderMarkdownLite(content);
    if (opts.done) el.classList.remove("streaming");
    const list = document.getElementById("tutor-msgs");
    list.scrollTop = list.scrollHeight;
  }

  function open(opts = {}) {
    ensureUI();
    setContextHint(opts.contextHint || State.contextHint);

    if (opts.contextHint?.currentQuestionId && State.messages.length === 0) {
      appendMessage(
        "assistant",
        "Estoy mirando la pregunta que tienes en pantalla. ¿Qué quieres que te explique?",
      );
    } else if (State.messages.length === 0) {
      appendMessage(
        "assistant",
        "Pregúntame lo que quieras del temario oficial. Te citaré la fuente exacta (Ley 43/2010, RD 437/2024, manuales).",
      );
    }

    document.getElementById("tutor-panel").classList.remove("hidden");
    document.body.classList.add("tutor-open");
    State.open = true;
    setTimeout(() => document.getElementById("tutor-input")?.focus(), 50);

    if (opts.prefill) {
      const input = document.getElementById("tutor-input");
      input.value = opts.prefill;
    }
  }

  function close() {
    document.getElementById("tutor-panel")?.classList.add("hidden");
    document.body.classList.remove("tutor-open");
    State.open = false;
    if (State.currentRequest) {
      State.currentRequest.abort?.();
      State.currentRequest = null;
    }
  }

  function clear() {
    State.messages = [];
    const list = document.getElementById("tutor-msgs");
    if (list) list.innerHTML = "";
  }

  async function buildContext() {
    const profile = await Storage.getAllProfile().catch(() => ({}));
    const modules = await Stats.byModule().catch(() => ({}));
    const moduleStats = {};
    Object.entries(modules).forEach(([k, v]) => {
      if (v && v.accuracy != null) moduleStats[k] = Math.round(v.accuracy);
    });
    return {
      puesto: profile.puesto || "reparto1",
      alias: profile.alias || (profile.name ? profile.name.split(" ")[0] : null),
      moduleStats,
      ...(State.contextHint || {}),
    };
  }

  async function onSubmit(e) {
    e?.preventDefault();
    const input = document.getElementById("tutor-input");
    const text = (input?.value || "").trim();
    if (!text) return;
    if (State.currentRequest) return; // pending

    input.value = "";
    appendMessage("user", text);
    const replyId = appendMessage("assistant", "", { streaming: true });

    const messages = State.messages
      .filter((m) => m.id !== replyId)
      .map((m) => ({ role: m.role, content: m.content }));
    const context = await buildContext();

    const controller = new AbortController();
    State.currentRequest = controller;
    let acc = "";

    try {
      const res = await fetch("/api/tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        body: JSON.stringify({ messages, context }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => res.statusText);
        let parsed;
        try { parsed = JSON.parse(errText); } catch {}
        const friendly = parsed?.error === "anthropic_not_configured"
          ? "El tutor no está configurado en este entorno. Avisa al administrador."
          : `Error ${res.status}: ${parsed?.error || errText.slice(0, 200)}`;
        updateMessage(replyId, friendly, { done: true });
        const idx = State.messages.findIndex((m) => m.id === replyId);
        if (idx >= 0) State.messages[idx].content = friendly;
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() || "";
        for (const evt of events) {
          const lines = evt.split("\n");
          let event = "message", data = "";
          for (const l of lines) {
            if (l.startsWith("event:")) event = l.slice(6).trim();
            else if (l.startsWith("data:")) data += l.slice(5).trim();
          }
          if (event === "token") {
            let chunk;
            try { chunk = JSON.parse(data); } catch { chunk = data; }
            if (typeof chunk !== "string") chunk = String(chunk ?? "");
            acc += chunk;
            updateMessage(replyId, acc);
          } else if (event === "done") {
            updateMessage(replyId, acc, { done: true });
            const idx = State.messages.findIndex((m) => m.id === replyId);
            if (idx >= 0) State.messages[idx].content = acc;
          } else if (event === "error") {
            let parsed;
            try { parsed = JSON.parse(data); } catch {}
            const msg = acc + (acc ? "\n\n" : "") + `_(error: ${parsed?.error || "interrumpido"})_`;
            updateMessage(replyId, msg, { done: true });
            const idx = State.messages.findIndex((m) => m.id === replyId);
            if (idx >= 0) State.messages[idx].content = msg;
          }
        }
      }
    } catch (err) {
      if (err.name !== "AbortError") {
        const msg = `_(no se pudo contactar con el tutor: ${err.message})_`;
        updateMessage(replyId, msg, { done: true });
        const idx = State.messages.findIndex((m) => m.id === replyId);
        if (idx >= 0) State.messages[idx].content = msg;
      }
    } finally {
      State.currentRequest = null;
    }
  }

  // API pública usada desde otros sitios (showFeedback en app.js)
  function askAboutQuestion(question, options) {
    open({
      contextHint: { currentQuestionId: question.id, currentTopicId: `T${question.module}.${question.topic}` },
      prefill: options?.prefill || "",
    });
  }

  function askAboutTopic(moduleNumber) {
    open({ contextHint: { currentTopicId: `T${moduleNumber}` } });
  }

  // Inicialización: añade el FAB al cargar la página
  if (document.readyState === "complete" || document.readyState === "interactive") {
    setTimeout(ensureUI, 0);
  } else {
    document.addEventListener("DOMContentLoaded", ensureUI);
  }

  return {
    open,
    close,
    clear,
    askAboutQuestion,
    askAboutTopic,
    setContextHint,
  };
})();
