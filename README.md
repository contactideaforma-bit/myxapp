# myXapp — v0

Espace privé pour deux. Next.js 15 + Supabase.
Charte graphique : **Velours Nocturne**.

---

## 🚀 Démarrage — 15 minutes chrono

### Étape 1 — Créer le projet Supabase

1. Va sur [supabase.com](https://supabase.com) → **New project**
2. Nom : `myxapp` · Région : **Frankfurt (eu-central-1)** (le plus proche de la France)
3. Note bien le **mot de passe de la base** quelque part
4. Attends ~2 min que le projet démarre

### Étape 2 — Créer les tables

1. Dans Supabase : menu de gauche → **SQL Editor** → **New query**
2. Copie **tout** le contenu de `supabase/migrations/001_schema.sql` → **Run**
3. Nouvelle query → copie **tout** `supabase/migrations/002_storage.sql` → **Run**

> ✅ Tu dois voir « Success. No rows returned » deux fois.

### Étape 3 — Désactiver la confirmation d'email (pour tester à deux ce soir)

**Authentication** → **Sign In / Providers** → **Email** → décoche **Confirm email** → **Save**.

> Sinon chaque inscription attend un clic dans un mail, et la boîte d'envoi gratuite de Supabase est limitée à 3 mails/heure. On remettra ça en prod.

### Étape 4 — Récupérer les clés

**Project Settings** → **API** :

| Ce qu'il te faut | Où |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Project API keys → `anon` `public` |

### Étape 5 — Lancer en local (VSCode)

```bash
cd myxapp
cp .env.local.example .env.local   # puis colle tes 2 clés dedans
npm install
npm run dev
```

Ouvre http://localhost:3000

### Étape 6 — Tester la liaison à deux

1. **Fenêtre normale** : crée le compte A → tu obtiens un code à 6 lettres
2. **Fenêtre de navigation privée** : crée le compte B → saisis le code de A
3. 💥 Les deux basculent automatiquement dans le chat

### Étape 7 — GitHub + mise en ligne

```bash
git init
git add .
git commit -m "myXapp v0 — auth, liaison par code, chat temps réel"
git branch -M main
git remote add origin https://github.com/TON_PSEUDO/myxapp.git
git push -u origin main
```

Puis sur [vercel.com](https://vercel.com) → **Import** ton repo → ajoute les **2 variables d'environnement** → **Deploy**.
Sur iPhone/Android : ouvre l'URL → **Partager** → **Sur l'écran d'accueil**. Ça devient une vraie app.

---

## 🎨 Charte graphique — Velours Nocturne

| Rôle | Nom | Hex | Usage |
|---|---|---|---|
| Fond profond | `nuit` | `#0D0A0F` | Arrière-plan global |
| Surface | `velours` | `#17111B` | En-tête, pied de page |
| Surface haute | `velours-clair` | `#221A28` | Champs, bulles reçues |
| Bordure | `bord` | `#32263A` | Contours discrets |
| Accent profond | `bordeaux` | `#7A1F3D` | Dégradés, bulles envoyées |
| Accent vif | `bordeaux-vif` | `#A32E52` | Focus, boutons actifs |
| Accent chaud | `orrose` | `#E8B4A0` | Codes, liens, détails |
| Texte | `champagne` | `#F0DCD0` | Corps de texte |
| Texte secondaire | `brume` | `#9B8D96` | Horodatages, aides |

**Typographies** — `Playfair Display` (titres, italique pour l'intime) + `Inter` (interface).

**Principes**

1. **Suggérer, jamais montrer** — le désir est dans la retenue, pas dans le rouge criard.
2. **Une seule flamme à la fois** — un accent vif par écran maximum.
3. **Sombre par défaut** — l'app se consulte le soir, au lit.
4. **Discrétion visuelle** — titre d'onglet neutre (« Agenda »), pas d'icône explicite.
5. **Le mouvement compte** — les bulles montent, les codes pulsent. Rien ne clignote.

Tous les tokens sont dans `src/app/globals.css` (bloc `@theme`) — change une valeur, toute l'app suit.

---

## ✅ Ce qui marche dans cette v0

- Inscription / connexion par email + mot de passe
- Génération d'un **code de liaison à 6 caractères**, à usage unique
- Liaison des 2 comptes → bascule automatique dans le chat quand l'autre rejoint
- **Chat temps réel** (Supabase Realtime), indicateur « écrit… », accusés de lecture
- **Envoi de photos** vers un bucket privé (URL signées 60 s, jamais publiques)
- **Photos vue unique** 🔥 — consumées après ouverture
- **Messages éphémères** — 1 min / 10 min / 1 h, avec compte à rebours visible
- **Mode discret** 👁️ — bouton ou touche `Échap` → fausse liste de courses. Double-clic sur le titre pour revenir.

## 🔒 Sécurité

- **RLS activé** sur les 3 tables : personne ne peut lire les messages d'un autre couple, même avec la clé anon.
- Bucket Storage **privé** : chemin `{couple_id}/…`, une policy vérifie que le dossier correspond à ton couple.
- Le code d'invitation est **brûlé** dès qu'il est utilisé (`invite_code = null`).
- Toutes les opérations sensibles (liaison, ouverture vue unique) passent par des fonctions `security definer` — impossible de les contourner côté client.

⚠️ Le chiffrement est *au repos + RLS*, pas bout-en-bout. Supabase pourrait techniquement lire la base. Pour du E2EE, on ajoutera libsodium en v2 — dis-moi si tu le veux tôt.

---

## 🗺️ Idées pour la suite

| # | Fonction | Pourquoi c'est bon |
|---|---|---|
| 1 | **Le Dé** 🎲 — un tirage/jour, action douce ou brûlante, réglable par curseur | Rituel quotidien = rétention |
| 2 | **Kamasutra** — cartes illustrées, « déjà testé / à tester / coup de cœur » avec double validation | Le catalogue devient un jeu à deux |
| 3 | **Vérité ou Gage** en tour par tour dans le chat | Zéro friction, réutilise l'existant |
| 4 | **Humeur du soir** — un tap sur une échelle 😴→🔥, l'autre le voit | Résout le « comment demander ? » |
| 5 | **Génération d'images IA** — scènes suggestives, style illustration | Ta demande initiale, à faire après le socle |
| 6 | **Coffre à fantasmes** — chacun écrit en secret, on ne révèle QUE les correspondances | Le meilleur mécanisme de l'app selon moi : zéro risque de gêne |
| 7 | **Défis chronométrés** — « avant minuit… » avec notification push | Crée de la tension dans la journée |
| 8 | **Verrouillage biométrique** (Face ID via WebAuthn) | Rend le mode discret vraiment sérieux |

Le **coffre à fantasmes** (#6) est celui que je te conseille juste après cette v0 : c'est peu de code, ça n'existe presque nulle part, et c'est ce qui fait dire « on n'aurait jamais osé se le dire ».

---

## 🧯 Si ça coince

| Message | Solution |
|---|---|
| `Email not confirmed` | Étape 3 : décoche **Confirm email** |
| Le code reste `——————` | Les migrations SQL n'ont pas tourné → refais l'étape 2 |
| Les messages n'arrivent pas en direct | Vérifie **Database → Replication** que `messages` est bien publiée |
| `new row violates row-level security` sur une photo | `002_storage.sql` n'a pas été exécuté |
| Page blanche | `.env.local` manquant ou mal rempli → puis relance `npm run dev` |
# myxapp
