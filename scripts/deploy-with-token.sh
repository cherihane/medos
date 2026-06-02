#!/bin/bash
# ============================================================
# MedOS — Deploiement complet avec Personal Access Token
# Usage: bash scripts/deploy-with-token.sh sbp_VOTRE_TOKEN_ICI
# ============================================================

set -e

TOKEN="$1"
PROJECT_REF="yehqmvwmosskumbegzty"

FUNCTIONS=(
  "check-stock-alert"
  "send-inscription-email"
  "send-activation-email"
)

if [ -z "$TOKEN" ]; then
  echo ""
  echo "Token manquant."
  echo ""
  echo "Comment obtenir votre Personal Access Token :"
  echo "   1. Ouvrez https://supabase.com/dashboard/account/tokens"
  echo "   2. Cliquez 'Generate new token'"
  echo "   3. Nom : 'MedOS Deploy'"
  echo "   4. Copiez le token (commence par sbp_)"
  echo ""
  echo "   Puis relancez :"
  echo "   bash scripts/deploy-with-token.sh sbp_VOTRE_TOKEN"
  echo ""
  exit 1
fi

export SUPABASE_ACCESS_TOKEN="$TOKEN"

echo ""
echo "Deploiement MedOS Edge Functions"
echo "   Projet    : $PROJECT_REF"
echo "   Fonctions : ${FUNCTIONS[*]}"
echo ""

# 1. Lier le projet
echo "Liaison au projet Supabase..."
supabase link --project-ref "$PROJECT_REF"
echo "Projet lie"

# 2. Deployer les secrets
echo ""
echo "Deploiement des secrets..."
supabase secrets set \
  RESEND_API_KEY="re_iUaDVQFG_LAX2mHCRxm6rf216167mGdJY" \
  ADMIN_EMAIL="contact@kelagroup.org" \
  APP_URL="http://81.17.98.80" \
  WEBHOOK_SECRET="medos_wh_secret_2024" \
  SUPABASE_URL="https://${PROJECT_REF}.supabase.co" \
  SUPABASE_SERVICE_ROLE_KEY="sb_secret_ctYN_7iPgU9xnCuKnLsxDQ_K_eI_UtA" \
  --project-ref "$PROJECT_REF"
echo "Secrets deployes"

# 3. Deployer toutes les fonctions
echo ""
for fn in "${FUNCTIONS[@]}"; do
  echo "Deploiement de $fn ..."
  supabase functions deploy "$fn" \
    --project-ref "$PROJECT_REF" \
    --no-verify-jwt
  echo "$fn deployee"
  echo ""
done

# 4. Test de check-stock-alert
echo "Test de check-stock-alert..."
ANON_KEY="sb_publishable_d0hgwt-SF7pzOswk-JVvZA_CkLm-4nI"
RESULT=$(curl -s -X POST \
  "https://${PROJECT_REF}.supabase.co/functions/v1/check-stock-alert" \
  -H "Authorization: Bearer ${ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "UPDATE",
    "table": "medicaments",
    "record": {
      "id": "00000000-0000-0000-0000-000000000001",
      "nom": "Quinine 300mg (TEST)",
      "code": "QUI-300-TEST",
      "categorie": "Antipaludeen",
      "stock_actuel": 3,
      "stock_minimum": 50
    },
    "old_record": {
      "id": "00000000-0000-0000-0000-000000000001",
      "nom": "Quinine 300mg (TEST)",
      "stock_actuel": 10,
      "stock_minimum": 50
    }
  }')

echo "Reponse check-stock-alert : $RESULT"
if echo "$RESULT" | grep -q '"ok":true'; then
  echo "Test check-stock-alert reussi"
else
  echo "Reponse inattendue — verifiez les logs dans Supabase Dashboard > Edge Functions"
fi

echo ""
echo "------------------------------------------------"
echo "Deploiement termine !"
echo ""
echo "Etapes finales — Supabase SQL Editor :"
echo "   Executez ces fichiers dans l'ordre :"
echo "   1. supabase/migrations/20240102000000_stock_alert_trigger.sql"
echo "   2. supabase/migrations/20240112000000_inscription_email_trigger.sql"
echo ""
echo "   URL SQL Editor :"
echo "   https://supabase.com/dashboard/project/${PROJECT_REF}/sql/new"
echo "------------------------------------------------"
