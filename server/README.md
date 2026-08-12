# Atelier Méridien — Backend (formulaire de contact & newsletter)

Serveur Node/Express minimal qui reçoit le formulaire de contact et les
inscriptions à la newsletter du site. Le site (fichiers HTML/CSS/JS à la
racine) est un site **statique** : il peut être hébergé n'importe où
(OVH, Netlify, Vercel, GitHub Pages...). Ce backend, lui, doit tourner en
continu quelque part pour que les deux formulaires fonctionnent.

## 1. Installation en local

```bash
cd server
npm install
cp .env.example .env
```

Ouvrez `.env` et renseignez au minimum :

```
SMTP_HOST=...
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
MAIL_TO=contact@atelier-meridien.fr
```

Sans ces identifiants SMTP, le serveur démarre quand même et **reçoit**
bien les messages (visibles dans les logs), mais ne les envoie pas par
e-mail — utile pour tester, pas pour la production.

```bash
npm start
```

Le serveur écoute par défaut sur `http://localhost:3000`.

## 2. Où trouver des identifiants SMTP

Trois options courantes, du plus simple au plus robuste :

- **Gmail** : nécessite un "mot de passe d'application" (pas votre mot de
  passe habituel) — à activer dans les paramètres de sécurité Google.
  Limité en volume, correct pour démarrer.
- **Hébergeur du nom de domaine** (OVH, Infomaniak, Gandi...) : si
  `contact@atelier-meridien.fr` existe déjà comme boîte mail chez
  l'hébergeur, ses identifiants SMTP habituels fonctionnent directement.
- **Service transactionnel** (Brevo, Resend, Mailjet, Postmark...) :
  recommandé en production — meilleure délivrabilité, tableau de bord,
  volumes gratuits suffisants pour un site vitrine.

## 3. Déployer le backend

Le site statique et ce backend n'ont pas besoin d'être hébergés au même
endroit. Trois pistes simples :

### Option A — Render.com (gratuit pour démarrer)
1. Créer un compte, "New Web Service", connecter le dépôt Git contenant
   ce dossier `server/`.
2. Build command : `npm install` — Start command : `npm start`.
3. Renseigner les variables d'environnement du `.env` dans l'interface
   Render (onglet "Environment").
4. Une fois déployé, Render donne une URL du type
   `https://atelier-meridien-server.onrender.com`.

### Option B — Railway.app
Même principe que Render : import du dépôt, variables d'environnement
dans l'interface, déploiement automatique à chaque push.

### Option C — VPS classique (OVH, Hetzner...)
```bash
git clone <votre-dépôt>
cd server
npm install
# configurer .env
npm install -g pm2
pm2 start server.js --name meridien-backend
pm2 save
```
Placer ensuite un reverse proxy (Nginx) devant, avec un certificat HTTPS
(Let's Encrypt / Certbot), pour exposer le backend en `https://`.

## 4. Brancher le site statique sur le backend déployé

Dans `assets/main.js`, la constante `API_BASE` pointe vers
`http://localhost:3000` uniquement quand le site tourne en local. Une
fois le backend déployé, remplacez la ligne suivante :

```js
var API_BASE = (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
  ? 'http://localhost:3000'
  : '';
```

par l'URL réelle du backend déployé, par exemple :

```js
var API_BASE = (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
  ? 'http://localhost:3000'
  : 'https://atelier-meridien-server.onrender.com';
```

Et côté backend, dans `.env`, mettez à jour `ALLOWED_ORIGIN` avec le vrai
domaine du site (ex. `https://www.atelier-meridien.fr`) pour que le
CORS autorise les requêtes.

## 5. Les inscrits à la newsletter

Ils sont stockés dans `server/data/subscribers.json` (format simple,
adapté à un faible volume). Pour un usage plus sérieux (envoi de
campagnes, désinscription en un clic, statistiques), il est préférable
de brancher un vrai outil d'emailing (Brevo, Mailchimp...) : la route
`/api/newsletter` peut être adaptée pour y transférer chaque inscription
via leur API au lieu du fichier JSON local.

## 6. Sécurité déjà en place

- Limitation de débit (10 requêtes / 15 min / IP) sur les deux routes.
- Champ "honeypot" invisible : les robots qui remplissent tous les
  champs se voient répondre un faux succès, sans déclencher d'e-mail.
- Validation des champs côté serveur (pas seulement côté navigateur).

## 7. Vérifier que ça fonctionne

```bash
curl http://localhost:3000/api/health
# {"ok":true}
```

Puis testez le vrai formulaire de contact du site : le message doit
apparaître dans la boîte `MAIL_TO`, avec l'adresse du visiteur en
"Répondre à".
