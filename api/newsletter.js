/* =========================================================================
   POST /api/newsletter — Vercel serverless function
   Inscrit une adresse e-mail à la newsletter.

   Vercel ne fournit pas de système de fichiers persistant : impossible de
   stocker les inscrits dans un fichier JSON comme sur un serveur classique
   (voir server/server.js pour cette version-là, utilisable sur Render,
   Railway ou un VPS). Ici, deux stratégies :

   1. Si BREVO_API_KEY est configurée : l'adresse est ajoutée directement
      à une liste Brevo (service d'emailing gratuit jusqu'à 300 e-mails/
      jour). C'est la solution recommandée — persistante, exploitable pour
      de vraies campagnes, gère la désinscription automatiquement.

   2. Sinon (repli) : un e-mail de notification est envoyé à MAIL_TO avec
      l'adresse du nouvel inscrit, pour ne pas perdre l'information. Cette
      solution n'est pas persistante côté serveur — pensez à configurer
      Brevo dès que possible (voir README).
   ========================================================================= */

const nodemailer = require("nodemailer");
const {
  cleanString,
  isValidEmail,
  applyCors,
  handlePreflight,
  isRateLimited,
  readJsonBody,
} = require("./_utils");

const BREVO_API = "https://api.brevo.com/v3/contacts";

async function addToBrevo(email) {
  const listId = process.env.BREVO_LIST_ID ? Number(process.env.BREVO_LIST_ID) : undefined;

  // On vérifie d'abord si le contact existe déjà, pour renvoyer une
  // information fidèle au formulaire ("déjà inscrit" vs "inscription
  // confirmée") plutôt que de toujours répondre succès.
  const existing = await fetch(`${BREVO_API}/${encodeURIComponent(email)}`, {
    method: "GET",
    headers: { "api-key": process.env.BREVO_API_KEY },
  });

  if (existing.status === 200) {
    return { ok: true, alreadySubscribed: true };
  }

  const res = await fetch(BREVO_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": process.env.BREVO_API_KEY,
    },
    body: JSON.stringify({
      email,
      listIds: listId ? [listId] : undefined,
      updateEnabled: true,
    }),
  });

  if (!res.ok && res.status !== 204) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Brevo a répondu ${res.status} : ${detail}`);
  }

  return { ok: true, alreadySubscribed: false };
}

let transporter = null;
function getTransporter() {
  if (transporter) return transporter;
  if (!process.env.SMTP_HOST) return null;
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  return transporter;
}

async function notifyByEmail(email) {
  const mail = getTransporter();
  if (!mail) {
    console.warn("[newsletter] Ni Brevo ni SMTP configurés — inscription non conservée:", email);
    return;
  }
  await mail.sendMail({
    from: process.env.MAIL_FROM || `"Site Atelier Méridien" <${process.env.SMTP_USER}>`,
    to: process.env.MAIL_TO || "contact@atelier-meridien.fr",
    subject: "[Newsletter] Nouvelle inscription",
    text: `Nouvelle inscription à la newsletter : ${email}\n\n(Repli e-mail : configurez BREVO_API_KEY pour un stockage persistant — voir README.)`,
  });
}

module.exports = async function handler(req, res) {
  applyCors(req, res);
  if (handlePreflight(req, res)) return;

  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "Méthode non autorisée." });
    return;
  }

  if (isRateLimited(req)) {
    res.status(429).json({ ok: false, error: "Trop de tentatives. Merci de réessayer dans quelques minutes." });
    return;
  }

  const body = await readJsonBody(req);
  const email = cleanString(body.email, 200);

  if (cleanString(body.company, 100)) {
    res.status(200).json({ ok: true }); // honeypot
    return;
  }

  if (!isValidEmail(email)) {
    res.status(400).json({ ok: false, error: "Adresse e-mail invalide." });
    return;
  }

  try {
    if (process.env.BREVO_API_KEY) {
      const result = await addToBrevo(email.trim());
      res.status(200).json(result);
      return;
    }

    await notifyByEmail(email.trim());
    res.status(200).json({
      ok: true,
      warning: "Inscription notifiée par e-mail (stockage persistant non configuré — voir README).",
    });
  } catch (err) {
    console.error("[newsletter] Échec:", err.message);
    res.status(502).json({ ok: false, error: "Une erreur est survenue. Merci de réessayer." });
  }
};
