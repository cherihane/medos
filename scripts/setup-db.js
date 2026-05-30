#!/usr/bin/env node
/**
 * MedOS — Script de création des tables Supabase
 * Usage : node scripts/setup-db.js <SERVICE_ROLE_KEY>
 * La service_role key se trouve dans Supabase > Project Settings > API
 */

const https = require("https");
const fs = require("fs");
const path = require("path");

const PROJECT_REF = "yehqmvwmosskumbegzty";
const serviceKey = process.argv[2];

if (!serviceKey) {
  console.error("\nUsage: node scripts/setup-db.js <SERVICE_ROLE_KEY>");
  console.error("La clé se trouve dans : Supabase Dashboard > Project Settings > API > service_role\n");
  process.exit(1);
}

const sqlFile = path.join(__dirname, "../supabase/migrations/20240101000000_medos_schema.sql");
const sql = fs.readFileSync(sqlFile, "utf8");

function runSQL(query) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query });
    const options = {
      hostname: `${PROJECT_REF}.supabase.co`,
      path: "/rest/v1/rpc/exec_sql",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
    };

    // Fallback: use the management API
    const mgmtOptions = {
      hostname: "api.supabase.com",
      path: `/v1/projects/${PROJECT_REF}/database/query`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
        Authorization: `Bearer ${serviceKey}`,
      },
    };

    const req = https.request(mgmtOptions, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        if (res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        } else {
          resolve(JSON.parse(data || "{}"));
        }
      });
    });

    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

(async () => {
  console.log("\nMedOS — Création des tables Supabase...\n");
  try {
    const result = await runSQL(sql);
    console.log("Tables créées avec succès !");
    console.log(result);
  } catch (err) {
    console.error("Erreur:", err.message);
    console.log("\nAlternative — collez ce SQL dans Supabase > SQL Editor :");
    console.log("https://supabase.com/dashboard/project/" + PROJECT_REF + "/sql/new");
  }
})();
