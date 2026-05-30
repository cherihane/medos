#!/bin/bash
# ============================================================
# MedOS — Déploiement Edge Function check-stock-alert
# Usage: bash scripts/deploy-edge-function.sh
# ============================================================

set -e

PROJECT_REF="yehqmvwmosskumbegzty"
FUNCTION_NAME="check-stock-alert"

echo "🚀 Déploiement MedOS Edge Function: $FUNCTION_NAME"
echo ""

# Vérifier supabase CLI
if ! command -v supabase &> /dev/null; then
  echo "❌ Supabase CLI non installé."
  echo "   Installez-le avec : npm install -g supabase"
  echo "   Ou : brew install supabase/tap/supabase"
  exit 1
fi

# Vérifier les variables d'environnement requises
if [ -z "$RESEND_API_KEY" ]; then
  echo "❌ RESEND_API_KEY non défini."
  echo "   Créez un compte sur https://resend.com (gratuit)"
  echo "   Puis : export RESEND_API_KEY=re_xxxxxxxxxxxxxxxxx"
  exit 1
fi

ADMIN_EMAIL="${ADMIN_EMAIL:-admin@votre-etablissement.com}"
APP_URL="${APP_URL:-http://localhost:3000}"
WEBHOOK_SECRET="${WEBHOOK_SECRET:-medos_wh_secret_2024}"

echo "📋 Configuration :"
echo "   Project ref  : $PROJECT_REF"
echo "   Admin email  : $ADMIN_EMAIL"
echo "   App URL      : $APP_URL"
echo ""

# Login Supabase
echo "🔐 Connexion Supabase..."
supabase login

# Lier le projet
echo "🔗 Liaison au projet $PROJECT_REF..."
supabase link --project-ref "$PROJECT_REF"

# Déployer les secrets
echo "🔑 Déploiement des secrets..."
supabase secrets set \
  RESEND_API_KEY="$RESEND_API_KEY" \
  ADMIN_EMAIL="$ADMIN_EMAIL" \
  APP_URL="$APP_URL" \
  WEBHOOK_SECRET="$WEBHOOK_SECRET" \
  --project-ref "$PROJECT_REF"

echo "✅ Secrets déployés"

# Déployer la fonction
echo "📦 Déploiement de la fonction $FUNCTION_NAME..."
supabase functions deploy "$FUNCTION_NAME" \
  --project-ref "$PROJECT_REF" \
  --no-verify-jwt

echo ""
echo "✅ Edge Function déployée avec succès !"
echo ""
echo "🔗 URL de la fonction :"
echo "   https://$PROJECT_REF.supabase.co/functions/v1/$FUNCTION_NAME"
echo ""
echo "📋 Étape suivante — Exécutez dans Supabase SQL Editor :"
echo "   1. supabase/migrations/20240102000000_stock_alert_trigger.sql"
echo "   2. scripts/setup-alerts.sql"
echo ""
echo "🧪 Test rapide (remplacez le token) :"
echo "   curl -X POST https://$PROJECT_REF.supabase.co/functions/v1/$FUNCTION_NAME \\"
echo "     -H 'Authorization: Bearer \$SUPABASE_ANON_KEY' \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"type\":\"UPDATE\",\"table\":\"medicaments\",\"record\":{\"id\":\"test-id\",\"nom\":\"Quinine 300mg\",\"stock_actuel\":3,\"stock_minimum\":50,\"categorie\":\"Antipaludéen\"}}'"
echo ""
echo "🎉 Système d'alertes email MedOS opérationnel !"
