/**
 * create-test-users.js
 * Crée les comptes de test MedOS dans Supabase Auth via l'Admin API.
 *
 * Prérequis :
 *   La variable d'environnement SUPABASE_SERVICE_KEY doit contenir
 *   la service_role key (Supabase Dashboard → Project Settings → API).
 *
 * Exécution :
 *   SUPABASE_SERVICE_KEY=<votre_clé> node scripts/create-test-users.js
 */

const SUPABASE_URL     = "https://yehqmvwmosskumbegzty.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SERVICE_ROLE_KEY) {
  console.error("\nErreur : variable d'environnement SUPABASE_SERVICE_KEY manquante.");
  console.error("Usage  : SUPABASE_SERVICE_KEY=<clé> node scripts/create-test-users.js\n");
  process.exit(1);
}

const USERS = [
  { email: "pharmacie@medos.test",    password: "medos2026", role: "pharmacie"    },
  { email: "hopital@medos.test",      password: "medos2026", role: "hopital"      },
  { email: "distributeur@medos.test", password: "medos2026", role: "distributeur" },
];

async function upsertUser({ email, password, role }) {
  const url = `${SUPABASE_URL}/auth/v1/admin/users`;

  // Vérifie si l'utilisateur existe déjà via la liste
  const listRes = await fetch(`${url}?email=${encodeURIComponent(email)}`, {
    headers: {
      apikey:        SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    },
  });
  const list = await listRes.json();
  const existing = list?.users?.find((u) => u.email === email);

  if (existing) {
    // Met à jour le mot de passe et les métadonnées
    const patchRes = await fetch(`${url}/${existing.id}`, {
      method: "PUT",
      headers: {
        apikey:          SERVICE_ROLE_KEY,
        Authorization:   `Bearer ${SERVICE_ROLE_KEY}`,
        "Content-Type":  "application/json",
      },
      body: JSON.stringify({
        password,
        email_confirm: true,
        user_metadata: { role },
      }),
    });
    const data = await patchRes.json();
    if (patchRes.ok) {
      console.log(`  [maj]   ${email}  →  rôle : ${role}`);
    } else {
      console.error(`  [err]   ${email} : ${data.message || JSON.stringify(data)}`);
    }
    return;
  }

  // Crée un nouvel utilisateur
  const createRes = await fetch(url, {
    method: "POST",
    headers: {
      apikey:          SERVICE_ROLE_KEY,
      Authorization:   `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type":  "application/json",
    },
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,          // pas de mail de confirmation nécessaire
      user_metadata: { role },
    }),
  });
  const data = await createRes.json();
  if (createRes.ok) {
    console.log(`  [créé]  ${email}  →  rôle : ${role}`);
  } else {
    console.error(`  [err]   ${email} : ${data.message || JSON.stringify(data)}`);
  }
}

async function main() {
  console.log("\n── Création des utilisateurs de test MedOS ──────────────────\n");
  for (const user of USERS) {
    await upsertUser(user);
  }
  console.log("\n── Terminé ──────────────────────────────────────────────────");
  console.log("\nComptes disponibles :");
  USERS.forEach((u) =>
    console.log(`  ${u.email.padEnd(32)} mot de passe : ${u.password}  rôle : ${u.role}`)
  );
  console.log("");
}

main().catch((err) => {
  console.error("Erreur inattendue :", err.message);
  process.exit(1);
});
