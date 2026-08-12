/* =========================================================================
   ATELIER MÉRIDIEN — backend
   Deux routes : POST /api/contact et POST /api/newsletter
   ========================================================================= */

require("dotenv").config();

const path = require("path");
const fs = require("fs");
const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const nodemailer = require("nodemailer");

const PORT = process.env.PORT || 3000;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "http://localhost:8080";
const DATA_DIR = path.join(__dirname, "data");
const SUBSCRIBERS_FILE = path.join(DATA_DIR, "subscribers.json");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
if (!fs.existsSync(SUBSCRIBERS_FILE)) fs.writeFileSync(SUBSCRIBERS_FILE, "[]", "utf-8");

const app = express();
app.use(express.json({ limit: "100kb" }));
app.use(cors({ origin: ALLOWED_ORIGIN }));

/* -------------------------------------------------------------------------
   Anti-abus : limite le nombre de requêtes par IP
   ------------------------------------------------------------------------- */
const formLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: "Trop de tentatives. Merci de réessayer dans quelques minutes." },
});

/* -------------------------------------------------------------------------
   Transporteur e-mail (SMTP configuré via variables d'environnement)
   ------------------------------------------------------------------------- */
let transporter = null;
function getTransporter() {
  if (transporter) return transporter;
  if (!process.env.SMTP_HOST) return null; // pas configuré : voir README
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

/* -------------------------------------------------------------------------
   Validation simple, sans dépendance externe
   ------------------------------------------------------------------------- */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function cleanString(v, maxLen = 2000) {
  if (typeof v !== "string") return "";
  return v.trim().slice(0, maxLen);
}

/* =========================================================================
   POST /api/contact
   Reçoit le formulaire de contact et l'envoie par e-mail à l'agence.
   ========================================================================= */
app.post("/api/contact", formLimiter, async (req, res) => {
  const name = cleanString(req.body.name, 200);
  const email = cleanString(req.body.email, 200);
  const phone = cleanString(req.body.phone, 40);
  const subject = cleanString(req.body.subject, 60);
  const budget = cleanString(req.body.budget, 40);
  const message = cleanString(req.body.message, 5000);

  // Honeypot anti-spam : champ caché côté formulaire, doit rester vide
  if (cleanString(req.body.company, 100)) {
    return res.status(200).json({ ok: true }); // on ne prévient pas le bot
  }

  const errors = {};
  if (!name) errors.name = "Merci d'indiquer votre nom.";
  if (!EMAIL_RE.test(email)) errors.email = "Adresse e-mail invalide.";
  if (!subject) errors.subject = "Merci de choisir un sujet.";
  if (message.length < 20) errors.message = "Message trop court (20 caractères minimum).";

  if (Object.keys(errors).length) {
    return res.status(400).json({ ok: false, errors });
  }

  const subjectLabels = {
    residentiel: "Maison individuelle",
    collectif: "Logement collectif",
    tertiaire: "Bureaux / tertiaire",
    culturel: "Équipement public / culturel",
    urbanisme: "Étude urbaine",
    autre: "Autre",
  };
  const budgetLabels = {
    lt150: "Moins de 150 000 €",
    "150-500": "150 000 € — 500 000 €",
    "500-2m": "500 000 € — 2 M€",
    gt2m: "Plus de 2 M€",
  };

  const mail = getTransporter();
  if (!mail) {
    console.warn("[contact] SMTP non configuré — message reçu mais non envoyé par e-mail:",
      { name, email, subject });
    return res.status(200).json({
      ok: true,
      warning: "Message reçu (SMTP non configuré côté serveur — voir README.md).",
    });
  }

  try {
    await mail.sendMail({
      from: process.env.MAIL_FROM || `"Site Atelier Méridien" <${process.env.SMTP_USER}>`,
      to: process.env.MAIL_TO || "contact@atelier-meridien.fr",
      replyTo: email,
      subject: `[Contact site] ${subjectLabels[subject] || subject} — ${name}`,
      text: [
        `Nom : ${name}`,
        `E-mail : ${email}`,
        phone ? `Téléphone : ${phone}` : null,
        `Nature du projet : ${subjectLabels[subject] || subject}`,
        budget ? `Budget prévisionnel : ${budgetLabels[budget] || budget}` : null,
        "",
        "Message :",
        message,
      ].filter(Boolean).join("\n"),
    });
    res.json({ ok: true });
  } catch (err) {
    console.error("[contact] Échec d'envoi e-mail:", err.message);
    res.status(502).json({ ok: false, error: "Échec de l'envoi. Merci de réessayer ou de nous appeler directement." });
  }
});

/* =========================================================================
   POST /api/newsletter
   Ajoute une adresse e-mail à la liste des inscrits (fichier JSON local).
   ========================================================================= */
app.post("/api/newsletter", formLimiter, async (req, res) => {
  const email = cleanString(req.body.email, 200);

  if (cleanString(req.body.company, 100)) {
    return res.status(200).json({ ok: true }); // honeypot
  }

  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ ok: false, error: "Adresse e-mail invalide." });
  }

  let subscribers = [];
  try {
    subscribers = JSON.parse(fs.readFileSync(SUBSCRIBERS_FILE, "utf-8"));
  } catch {
    subscribers = [];
  }

  const already = subscribers.some((s) => s.email.toLowerCase() === email.toLowerCase());
  if (!already) {
    subscribers.push({ email, subscribedAt: new Date().toISOString() });
    fs.writeFileSync(SUBSCRIBERS_FILE, JSON.stringify(subscribers, null, 2), "utf-8");
  }

  // E-mail de confirmation optionnel si SMTP configuré
  const mail = getTransporter();
  if (mail) {
    try {
      await mail.sendMail({
        from: process.env.MAIL_FROM || `"Atelier Méridien" <${process.env.SMTP_USER}>`,
        to: email,
        subject: "Inscription à la newsletter — Atelier Méridien",
        text: "Merci de votre inscription. Vous recevrez nos actualités et projets récents.\n\nAtelier Méridien\n12 Quai de Southampton, 76600 Le Havre",
      });
    } catch (err) {
      console.warn("[newsletter] e-mail de confirmation non envoyé:", err.message);
    }
  }

  res.json({ ok: true, alreadySubscribed: already });
});

/* -------------------------------------------------------------------------
   Santé du service
   ------------------------------------------------------------------------- */
app.get("/api/health", (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Atelier Méridien — backend en écoute sur http://localhost:${PORT}`);
  if (!process.env.SMTP_HOST) {
    console.warn("⚠️  SMTP non configuré : les e-mails ne seront pas envoyés (voir .env.example).");
  }
});
