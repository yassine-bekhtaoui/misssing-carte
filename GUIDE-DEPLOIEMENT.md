# Guide de déploiement

## 1. Créer la base de données Supabase (gratuit)

1. Aller sur https://supabase.com → "Start your project" → créer un compte
2. Créer un nouveau projet (choisir un nom, un mot de passe DB, région Europe)
3. Aller dans **SQL Editor** → coller et exécuter le contenu de `supabase-schema.sql`
4. Aller dans **Settings > API** et noter :
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role secret` → `SUPABASE_SERVICE_ROLE_KEY`

## 2. Déployer sur Vercel (gratuit)

1. Aller sur https://vercel.com → créer un compte
2. Importer ce projet depuis GitHub (ou glisser-déposer le dossier)
3. Dans **Environment Variables**, ajouter :

```
NEXT_PUBLIC_SUPABASE_URL      = (votre URL Supabase)
NEXT_PUBLIC_SUPABASE_ANON_KEY = (votre clé anon)
SUPABASE_SERVICE_ROLE_KEY     = (votre clé service_role)
ADMIN_PASSWORD                = (mot de passe de votre équipe)
AUTH_SECRET                   = (chaîne aléatoire longue, ex: générer sur https://generate-secret.vercel.app/32)
```

4. Cliquer **Deploy** → votre app est en ligne !

## 3. Utilisation

- **Globe public** : `https://votre-app.vercel.app/`
- **Proposer un artiste** : `https://votre-app.vercel.app/proposer`
- **Panel admin** : `https://votre-app.vercel.app/admin` (mot de passe partagé avec l'équipe)

## Pousser sur GitHub (nécessaire pour Vercel)

```bash
git init
git add .
git commit -m "Initial commit"
# Créer un repo sur github.com, puis :
git remote add origin https://github.com/VOTRE-NOM/music-map.git
git push -u origin main
```

## Favoris utilisateurs

Pour activer les comptes et les favoris :

1. Dans Supabase, aller dans **Authentication > Providers** et vÃ©rifier que Email est activÃ©.
2. Dans **SQL Editor**, exÃ©cuter le contenu de `supabase-favorites.sql`.
