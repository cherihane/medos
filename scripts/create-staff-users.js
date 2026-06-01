/**
 * create-staff-users.js
 * Crée les comptes de test du personnel avec rôles internes dans Supabase Auth.
 *
 * Usage :
 *   SUPABASE_SERVICE_KEY=<service_role_key> node scripts/create-staff-users.js
 *
 * La service role key se trouve dans :
 *   Supabase Dashboard → Settings → API → service_role (secret)
 */

const SUPABASE_URL = "https://yehqmvwmosskumbegzty.supabase.co";
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;

if (!SERVICE_KEY) {
  console.error(
    "\nErreur : variable SUPABASE_SERVICE_KEY manquante.\n" +
    "Lancez le script ainsi :\n" +
    "  SUPABASE_SERVICE_KEY=<votre_service_role_key> node scripts/create-staff-users.js\n"
  );
  process.exit(1);
}

const USERS = [
  {
    email:    "caissier@medos.test",
    password: "medos2026",
    meta:     { role: "pharmacie", role_interne: "caissier" },
  },
  {
    email:    "pharmacien@medos.test",
    password: "medos2026",
    meta:     { role: "pharmacie", role_interne: "pharmacien" },
  },
  {
    email:    "medecin@medos.test",
    password: "medos2026",
    meta:     { role: "hopital", role_interne: "medecin" },
  },
];

async function adminPost(path, body) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/${path}`, {
    method:  "POST",
    headers: {
      "Content-Type":  "application/json",
      "apikey":        SERVICE_KEY,
      "Authorization": `Bearer ${SERVICE_KEY}`,
    },
    body: JSON.stringify(body),
  });
  return { status: res.status, data: await res.json() };
}

async function upsertUser({ email, password, meta }) {
  // 1. Tenter la création
  const { status, data } = await adminPost("users", {
    email,
    password,
    email_confirm: true,         // confirmer l'email d'emblée (compte de test)
    user_metadata: meta,
  });

  if (status === 200 || status === 201) {
    console.log(`  [OK] Cree     : ${email}  (${meta.role} / ${meta.role_interne})`);
    return;
  }

  // 2. Si l'utilisateur existe déjà, mettre à jour ses métadonnées
  if (data?.msg?.includes("already") || data?.message?.includes("already") || status === 422) {
    // Chercher l'utilisateur par email
    const listRes = await fetch(
      `${SUPABASE_URL}/auth/v1/admin/users?email=${encodeURIComponent(email)}`,
      {
        headers: {
          "apikey":        SERVICE_KEY,
          "Authorization": `Bearer ${SERVICE_KEY}`,
        },
      }
    );
    const listData = await listRes.json();
    const existing = listData?.users?.[0];

    if (!existing) {
      console.error(`  [ERR] Impossible de retrouver : ${email} — ${JSON.stringify(data)}`);
      return;
    }

    // Mettre à jour les métadonnées et le mot de passe
    const updateRes = await fetch(
      `${SUPABASE_URL}/auth/v1/admin/users/${existing.id}`,
      {
        method:  "PUT",
        headers: {
          "Content-Type":  "application/json",
          "apikey":        SERVICE_KEY,
          "Authorization": `Bearer ${SERVICE_KEY}`,
        },
        body: JSON.stringify({
          password,
          email_confirm: true,
          user_metadata: meta,
        }),
      }
    );
    const updateData = await updateRes.json();
    if (updateRes.status === 200) {
      console.log(`  [OK] Mis a jour : ${email}  (${meta.role} / ${meta.role_interne})`);
    } else {
      console.error(`  [ERR] Mise a jour echouee : ${email} — ${JSON.stringify(updateData)}`);
    }
    return;
  }

  console.error(`  [ERR] ${email} — HTTP ${status} — ${JSON.stringify(data)}`);
}

async function main() {
  console.log("\nCreation des comptes de test (personnel MedOS)\n" + "─".repeat(52));
  for (const u of USERS) {
    await upsertUser(u);
  }
  console.log("\nTermine.\n");
}

main().catch((err) => { console.error(err); process.exit(1); });
