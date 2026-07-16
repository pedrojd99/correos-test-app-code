// /api/subscribe — Alta en la lista de aviso de convocatoria.
// Da de alta el email como contacto en una Audience de Resend
// (https://resend.com/docs/api-reference/contacts/create-contact).
//
// Variables de entorno:
//   RESEND_API_KEY      obligatoria
//   RESEND_AUDIENCE_ID  obligatoria
//
// Request (POST application/json):
//   { email: string, website?: string }   // website = honeypot, debe venir vacío
//
// Response (application/json):
//   200 { ok: true }                       alta correcta (o duplicado, o bot silenciado)
//   400 { ok: false, error: 'invalid_email' }
//   405 { ok: false, error: 'method_not_allowed' }
//   429 { ok: false, error: 'rate_limited' }
//   503 { ok: false, error: 'unavailable' } fallo de config o de Resend

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Rate-limit en memoria por contenedor warm (mismo enfoque que api/tutor.js:
// suficiente para frenar bucles, no es una garantía global).
const RATE = { perIp: 5, windowMs: 60 * 1000 };
const ipHits = new Map(); // ip -> [timestamps]

function isRateLimited(req) {
  const now = Date.now();
  const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim()
    || req.socket?.remoteAddress || "unknown";
  const hits = (ipHits.get(ip) || []).filter((t) => now - t < RATE.windowMs);
  if (hits.length >= RATE.perIp) { ipHits.set(ip, hits); return true; }
  hits.push(now);
  ipHits.set(ip, hits);
  if (ipHits.size > 5000) ipHits.clear();
  return false;
}

export default async function handler(req, res) {
  const json = (status, payload) => {
    res.statusCode = status;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(payload));
  };

  if (req.method !== "POST") return json(405, { ok: false, error: "method_not_allowed" });

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  body = body || {};

  // Honeypot: los bots rellenan todos los campos. Respuesta de éxito
  // silenciosa para no darles señal de que han sido detectados.
  if (typeof body.website === "string" && body.website.trim() !== "") {
    return json(200, { ok: true });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return json(400, { ok: false, error: "invalid_email" });
  }

  if (isRateLimited(req)) {
    res.setHeader("Retry-After", "60");
    return json(429, { ok: false, error: "rate_limited" });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const audienceId = process.env.RESEND_AUDIENCE_ID;
  if (!apiKey || !audienceId) {
    console.error("subscribe_not_configured: faltan RESEND_API_KEY y/o RESEND_AUDIENCE_ID");
    return json(503, { ok: false, error: "unavailable" });
  }

  try {
    const r = await fetch(`https://api.resend.com/audiences/${audienceId}/contacts`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, unsubscribed: false }),
    });

    if (r.ok) return json(200, { ok: true });

    // Contacto ya existente: para el usuario es un éxito (ya está en la lista).
    if (r.status === 409) return json(200, { ok: true });

    const detail = await r.text().catch(() => "");
    console.error(`resend_error ${r.status}: ${detail.slice(0, 500)}`);
    return json(503, { ok: false, error: "unavailable" });
  } catch (e) {
    console.error("resend_network_error:", e);
    return json(503, { ok: false, error: "unavailable" });
  }
}
