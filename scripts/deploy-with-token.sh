#!/bin/bash
# ============================================================
# MedOS — Déploiement complet avec Personal Access Token
# Usage: bash scripts/deploy-with-token.sh sbp_VOTRE_TOKEN_ICI
# ============================================================

set -e

TOKEN="$1"
PROJECT_REF="yehqmvwmosskumbegzty"
FUNCTION_NAME="check-stock-alert"

if [ -z "$TOKEN" ]; then
  echo ""
  echo "❌ Token manquant."
  echo ""
  echo "📋 Comment obtenir votre Personal Access Token :"
  echo "   1. Ouvrez https://supabase.com/dashboard/account/tokens dans votre navigateur"
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
echo "🚀 Déploiement MedOS Edge Function"
echo "   Projet  : $PROJECT_REF"
echo "   Fonction: $FUNCTION_NAME"
echo ""

# 1. Lier le projet
echo "🔗 Liaison au projet Supabase..."
supabase link --project-ref "$PROJECT_REF"
echo "✅ Projet lié"

# 2. Déployer les secrets
echo ""
echo "🔑 Déploiement des secrets..."
supabase secrets set \
  RESEND_API_KEY="re_iUaDVQFG_LAX2mHCRxm6rf216167mGdJY" \
  ADMIN_EMAIL="cherihaneadam123@gmail.com" \
  APP_URL="http://localhost:3000" \
  WEBHOOK_SECRET="medos_wh_secret_2024" \
  SUPABASE_URL="https://${PROJECT_REF}.supabase.co" \
  SUPABASE_SERVICE_ROLE_KEY="sb_secret_ctYN_7iPgU9xnCuKnLsxDQ_K_eI_UtA" \
  --project-ref "$PROJECT_REF"
echo "✅ Secrets déployés"

# 3. Déployer la fonction
echo ""
echo "📦 Déploiement de la Edge Function..."
supabase functions deploy "$FUNCTION_NAME" \
  --project-ref "$PROJECT_REF" \
  --no-verify-jwt
echo "✅ Edge Function déployée !"

# 4. Test de la fonction
echo ""
echo "🧪 Test de la fonction..."
ANON_KEY="sb_publishable_d0hgwt-SF7pzOswk-JVvZA_CkLm-4nI"
RESULT=$(curl -s -X POST \
  "https://${PROJECT_REF}.supabase.co/functions/v1/${FUNCTION_NAME}" \
  -H "Authorization: Bearer ${ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "UPDATE",
    "table": "medicaments",
    "record": {
      "id": "00000000-0000-0000-0000-000000000001",
      "nom": "Quinine 300mg (TEST)",
      "code": "QUI-300-TEST",
      "categorie": "Antipaludéen",
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

echo "Réponse : $RESULT"

if echo "$RESULT" | grep -q '"ok":true'; then
  echo ""
  echo "✅ Test réussi ! Vérifiez votre email cherihaneadam123@gmail.com"
else
  echo ""
  echo "⚠️  Réponse inattendue — vérifiez les logs dans Supabase Dashboard > Edge Functions"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎉 Déploiement terminé !"
echo ""
echo "📋 Étape finale — Supabase SQL Editor :"
echo "   Exécutez ces 2 fichiers dans l'ordre :"
echo "   1. supabase/migrations/20240102000000_stock_alert_trigger.sql"
echo "   2. scripts/setup-alerts.sql"
echo ""
echo "   URL SQL Editor :"
echo "   https://supabase.com/dashboard/project/${PROJECT_REF}/sql/new"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
