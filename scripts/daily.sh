#!/bin/zsh
# Collecte + classement quotidien de l'adspy (lancé par launchd : ca.mathew.adspy)
export PATH="/Users/mathewsenecalpontbriand/.local/node/bin:/usr/local/bin:/usr/bin:/bin"
cd "/Users/mathewsenecalpontbriand/Dropshipping/adspy" || exit 1
mkdir -p logs
{
  echo "===== $(date '+%Y-%m-%d %H:%M') ====="
  # Au réveil du Mac, le Wi-Fi met parfois une minute à revenir : on attend jusqu'à 10 min
  for i in {1..60}; do
    host -W 3 graph.facebook.com >/dev/null 2>&1 && host -W 3 supabase.co >/dev/null 2>&1 && break
    [ $i -eq 1 ] && echo "En attente du réseau…"
    sleep 10
  done
  out=$(npm run --silent daily 2>&1)
  echo "$out"
  # Si le réseau a coupé en cours de route, on réessaie une fois 15 min plus tard
  if echo "$out" | grep -q "fetch failed\|ENOTFOUND\|ECONNRESET"; then
    echo "Réseau perdu pendant la collecte, nouvel essai dans 15 min…"
    sleep 900
    npm run --silent daily 2>&1
  fi
  echo
} >> logs/daily.log 2>&1
