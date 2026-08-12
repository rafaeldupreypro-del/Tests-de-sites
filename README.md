# Atelier Méridien — déploiement sur Vercel

Le site est prêt à être déployé tel quel sur Vercel : le contenu statique
(HTML/CSS/JS/PDF) et les fonctions API (`/api/contact`, `/api/newsletter`)
sont servis ensemble, sous le même domaine, sans configuration
particulière.

## 1. Déployer

Trois façons de faire, du plus simple au plus flexible :

**Depuis l'interface Vercel (le plus simple)**
1. Pousser ce dossier dans un dépôt Git (GitHub, GitLab...).
2. Sur [vercel.com](https://vercel.com), "Add New" → "Project" → importer
   le dépôt.
3. Vercel détecte automatiquement un projet statique + fonctions API
   (aucun framework à choisir, laisser "Other").
4. Cliquer "Deploy".

**Depuis la CLI**
```bash
npm install -g vercel
vercel        # déploiement de test (preview)
vercel --prod # mise en production
```

## 2. Configurer les variables d'environnement

Indispensable pour que le formulaire de contact et la newsletter
fonctionnent réellement. Dans le tableau de bord Vercel du projet :
**Settings → Environment Variables**, ajouter les clés listées dans
`.env.example` :

| Variable | Sert à |
|---|---|
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | Envoyer les e-mails du formulaire de contact |
| `MAIL_FROM`, `MAIL_TO` | Adresse d'expédition et de réception des messages |
| `BREVO_API_KEY` | Stocker les inscrits à la newsletter de façon persistante (recommandé) |
| `BREVO_LIST_ID` | *(optionnel)* liste Brevo précise où ranger les inscrits |
| `ALLOWED_ORIGIN` | Utile seulement si l'API est appelée depuis un autre domaine que le site |

Après avoir ajouté ou modifié une variable, il faut **redéployer** le
projet pour qu'elle soit prise en compte (Vercel propose un bouton
"Redeploy").

## 3. Pourquoi Brevo pour la newsletter

Vercel ne fournit pas de système de fichiers persistant : une fonction
serverless ne peut pas écrire durablement dans un fichier comme le
ferait un serveur classique. Sans stockage externe, chaque inscription
serait perdue au déploiement suivant.

Brevo (gratuit jusqu'à 300 e-mails/jour, sans carte bancaire) résout
ça simplement : `/api/newsletter` ajoute directement chaque inscrit à
une liste Brevo via leur API. Avantages : stockage persistant, envoi de
vraies campagnes depuis leur interface, désinscription automatique
(obligatoire légalement dès qu'on envoie des campagnes).

**Configuration en 3 étapes :**
1. Créer un compte sur [brevo.com](https://www.brevo.com).
2. Paramètres → Clés API → Générer une nouvelle clé → copier dans
   `BREVO_API_KEY`.
3. *(Optionnel)* Contacts → Listes → créer une liste "Newsletter site" →
   l'identifiant numérique de la liste (visible dans l'URL) va dans
   `BREVO_LIST_ID`.

**Sans Brevo configuré**, `/api/newsletter` bascule automatiquement sur
un repli : un e-mail de notification est envoyé à `MAIL_TO` à chaque
inscription, pour ne pas perdre l'information — mais rien n'est stocké
côté serveur. Pratique pour démarrer, à remplacer par Brevo dès que
possible.

## 4. Tester en local

```bash
npm install -g vercel
npm install
vercel dev
```

`vercel dev` fait tourner le site **et** les fonctions `/api` ensemble en
local (contrairement à un simple serveur de fichiers statiques comme
`python -m http.server`, qui ne peut pas exécuter `/api/contact.js`).
Créer un fichier `.env.local` à la racine (copie de `.env.example`
avec de vraies valeurs) pour que `vercel dev` les charge automatiquement.

## 5. Vérifier que ça fonctionne une fois en ligne

```bash
curl -X POST https://votre-site.vercel.app/api/newsletter \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
```

Une réponse `{"ok":true}` confirme que la fonction répond. Vérifiez
ensuite dans Brevo (ou dans la boîte `MAIL_TO`) que l'inscription est
bien arrivée.

## 6. Sécurité déjà en place

- Validation des champs côté serveur (pas seulement côté navigateur).
- Champ "honeypot" invisible : les robots qui remplissent tous les
  champs reçoivent un faux succès, sans déclencher d'e-mail ni d'écriture.
- Limitation de débit basique par IP (voir `api/_utils.js`) — à noter :
  en environnement serverless, cette protection est "best effort" et ne
  remplace pas un vrai service anti-abus (Cloudflare Turnstile, Vercel
  Firewall...) en cas de trafic malveillant soutenu.

## Alternative : hébergement hors Vercel

Le dossier `server/` contient une version alternative du backend sous
forme de serveur Express classique (avec stockage des inscrits dans un
fichier JSON), utilisable sur Render, Railway ou un VPS si vous
préférez ne pas dépendre de Vercel ou de Brevo. Voir `server/README.md`.
