#!/bin/zsh
# Serveur de l'app Adspy installée dans Chrome : http://localhost:4545
# Lancé au login par launchd (ca.mathew.adspy-web). Rebuild seulement si le code a changé.
export PATH="/Users/mathewsenecalpontbriand/.local/node/bin:/usr/local/bin:/usr/bin:/bin"
export NEXT_DIST_DIR=".next-app"
export NODE_ENV=production
cd "/Users/mathewsenecalpontbriand/Dropshipping/adspy" || exit 1

stamp=".next-app/.built-from"
current=$(git rev-parse HEAD 2>/dev/null)$(git status --porcelain src next.config.ts package.json 2>/dev/null | shasum | cut -c1-8)
if [ ! -f "$stamp" ] || [ "$(cat "$stamp")" != "$current" ]; then
  echo "$(date '+%F %T') build…"
  npx next build || exit 1
  echo "$current" > "$stamp"
fi
echo "$(date '+%F %T') démarrage sur http://localhost:4545"
exec npx next start -p 4545 -H 127.0.0.1
