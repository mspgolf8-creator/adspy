# Adspy

Adspy perso : pubs Meta actives (API officielle Ad Library, pubs diffusées en UE), classées par catégorie avec Claude.

## Mise en route (une seule fois)

1. **Supabase** : crée un projet sur supabase.com. Dans SQL Editor, colle `supabase/schema.sql` et clique Run.
2. **Meta** : vérifie ton identité sur facebook.com/ads/library/api, crée une app sur developers.facebook.com, puis génère un token d'accès dans le Graph API Explorer.
3. **Claude** : crée une clé API sur console.anthropic.com.
4. Copie `.env.example` en `.env.local` et remplis les valeurs.
5. Lance `npm run dev`, puis ouvre http://localhost:3000.

## Utilisation

- **Réglages** : ajoute des mots-clés, puis « Collecter » et « Classer ».
- **Pubs** : filtre par catégorie, angle, ancienneté, recherche texte. ★ pour sauvegarder.
- En ligne de commande : `npm run collect`, `npm run classify`, `npm run daily` (les deux).

## Limites

- L'API Meta donne les pubs commerciales seulement si elles sont diffusées en UE.
- L'API ne fournit pas les vidéos ou images : le bouton « Voir la pub » ouvre la pub dans l'Ad Library.
- Le token Meta du Graph API Explorer expire vite (environ 1 h). Prends un token longue durée (60 jours) pour la collecte quotidienne.
