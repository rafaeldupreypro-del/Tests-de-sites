/* =========================================================================
   Utilitaires partagés par les fonctions API (/api/contact, /api/newsletter)
   ========================================================================= */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function cleanString(v, maxLen = 2000) {
  if (typeof v !== "string") return "";
  return v.trim().slice(0, maxLen);
}

function isValidEmail(v) {
  return typeof v === "string" && EMAIL_RE.test(v.trim());
}

/* -------------------------------------------------------------------------
   CORS
   Sur Vercel, le site statique et les fonctions /api sont servis sous le
   même domaine : le CORS n'est donc pas strictement nécessaire. On le
   garde tout de même, au cas où l'API serait un jour appelée depuis un
   autre domaine (ex. site en préproduction, app mobile...).
   ------------------------------------------------------------------------- */
function applyCors(req, res) {
  const allowedOrigin = process.env.ALLOWED_ORIGIN || "*";
  res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function handlePreflight(req, res) {
  if (req.method === "OPTIONS") {
    applyCors(req, res);
    res.status(204).end();
    return true;
  }
  return false;
}

/* -------------------------------------------------------------------------
   Limitation de débit — best effort seulement.
   Les fonctions serverless Vercel n'ont pas de mémoire garantie entre deux
   appels (nouvelle instance possible à tout moment) : cette limite ne
   protège donc que les rafales rapprochées sur une même instance "chaude",
   pas un abus soutenu. Pour une protection fiable, brancher un service
   externe (Upstash Redis, Vercel KV, Cloudflare Turnstile...).
   ------------------------------------------------------------------------- */
const hits = new Map(); // ip -> [timestamps]
const WINDOW_MS = 15 * 60 * 1000;
const MAX_HITS = 10;

function isRateLimited(req) {
  const ip =
    (req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
    req.socket?.remoteAddress ||
    "unknown";
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > MAX_HITS;
}

/* -------------------------------------------------------------------------
   Lecture du corps JSON (Vercel le parse déjà automatiquement pour les
   fonctions Node "classiques" quand Content-Type: application/json, donc
   req.body est en principe déjà un objet — cette fonction sert de filet
   de sécurité si jamais ce n'est pas le cas).
   ------------------------------------------------------------------------- */
async function readJsonBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => {
      try {
        resolve(JSON.parse(data || "{}"));
      } catch {
        resolve({});
      }
    });
  });
}

module.exports = {
  cleanString,
  isValidEmail,
  applyCors,
  handlePreflight,
  isRateLimited,
  readJsonBody,
};
