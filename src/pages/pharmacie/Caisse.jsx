import { useState, useEffect, useCallback } from "react";
import Layout from "../../components/Layout";
import Toast from "../../components/Toast";
import { useToast } from "../../hooks/useToast";
import { useMedicaments } from "../../hooks/useSupabaseData";
import { insertVentes, decrementStock, insertJournalCaisse, fetchJournalJour, insertClotureCaisse, fetchClotureCaisse } from "../../hooks/useMutations";
import { supabase } from "../../supabaseClient";
import { useAuth } from "../../context/AuthContext";
import { openDocument, tableHTML, kpiHTML, fetchEtabFromAuth } from "../../utils/MedOSDocument";

// ─── helpers ──────────────────────────────────────────────────────────────────
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function shortId(uuid) {
  return (uuid ?? "").slice(0, 8).toUpperCase();
}

// Génère un numéro de transaction lisible : TXN-YYYYMMDD-XXXX
function txnRef(date, uuid) {
  const d = date.toISOString().slice(0, 10).replace(/-/g, "");
  return `TXN-${d}-${(uuid ?? "").slice(0, 6).toUpperCase()}`;
}

const MODE_LABELS = {
  especes: "Espèces",
  mobile_money: "Mobile Money",
  credit: "Crédit",
  carte: "Carte",
  assurance: "Assurance",
};

// ─── Ticket de caisse imprimable ─────────────────────────────────────────────
function printTicket({ ref, date, items, paiement, total, montantRecu, monnaie, etab }) {
  const dateStr = date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
  const heureStr = date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const modeLabel = MODE_LABELS[paiement] ?? paiement;
  const lignes = items.map((i) => `
    <tr>
      <td style="padding:2px 0;font-size:11px;max-width:28mm;overflow:hidden;white-space:nowrap">${i.nom}</td>
      <td style="text-align:center;padding:2px 4px;font-size:11px">${i.qty}</td>
      <td style="text-align:right;padding:2px 0;font-size:11px;white-space:nowrap">${(i.prix_unitaire ?? 0).toLocaleString("fr-FR")} FCFA</td>
      <td style="text-align:right;padding:2px 0;font-size:11px;white-space:nowrap">${((i.prix_unitaire ?? 0) * i.qty).toLocaleString("fr-FR")}</td>
    </tr>`).join("");

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Ticket ${ref}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:'Courier New',Courier,monospace; width:72mm; padding:4mm 3mm; font-size:12px; color:#000; }
    .centre { text-align:center; }
    .bold   { font-weight:bold; }
    .sep-solid  { border-top:1px solid #000; margin:5px 0; }
    .sep-dashed { border-top:1px dashed #000; margin:5px 0; }
    table { width:100%; border-collapse:collapse; }
    th { font-size:9px; text-transform:uppercase; padding:2px 0; border-bottom:1px solid #000; }
    th:nth-child(2),td:nth-child(2) { text-align:center; }
    th:nth-child(3),td:nth-child(3),th:nth-child(4),td:nth-child(4) { text-align:right; }
    .row-total td { font-weight:bold; font-size:14px; border-top:1px solid #000; padding-top:4px; }
    .footer { text-align:center; font-size:10px; margin-top:8px; }
    @media print { @page { size:72mm auto; margin:0; } body { width:72mm; } }
  </style>
</head>
<body>
  <div class="centre bold" style="font-size:15px">${etab?.nom ?? "Pharmacie"}</div>
  ${etab?.ville ? `<div class="centre" style="font-size:10px">${etab.ville}</div>` : ""}
  <div class="sep-solid"></div>
  <div class="centre bold" style="font-size:12px;letter-spacing:1px">${ref}</div>
  <div class="centre" style="font-size:10px">${dateStr} &nbsp; ${heureStr}</div>
  <div class="sep-dashed"></div>
  <table>
    <thead>
      <tr>
        <th style="text-align:left">Article</th>
        <th>Qte</th>
        <th>P.U.</th>
        <th>Total</th>
      </tr>
    </thead>
    <tbody>${lignes}</tbody>
    <tfoot>
      <tr class="row-total">
        <td colspan="3">TOTAL TTC</td>
        <td style="text-align:right;white-space:nowrap">${total.toLocaleString("fr-FR")} FCFA</td>
      </tr>
    </tfoot>
  </table>
  <div class="sep-dashed"></div>
  <div style="font-size:11px">Mode de paiement : <strong>${modeLabel}</strong></div>
  ${paiement === "especes" && montantRecu != null ? `
  <div style="font-size:11px">Montant recu      : ${montantRecu.toLocaleString("fr-FR")} FCFA</div>
  <div style="font-size:11px">Monnaie rendue    : ${(monnaie ?? 0).toLocaleString("fr-FR")} FCFA</div>` : ""}
  <div class="sep-solid"></div>
  <div class="footer">MedOS — Merci de votre confiance</div>
</body>
</html>`;

  const w = window.open("", "_blank", "width=320,height=600,toolbar=0,menubar=0");
  if (!w) { alert("Autorisez les pop-ups pour imprimer le ticket."); return; }
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => { w.print(); }, 350);
}

// ─── Document de clôture imprimable ──────────────────────────────────────────
function printCloture({ date, totaux, nb, gerant, etab }) {
  const dateStr = new Date(date).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const heureStr = new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Cloture ${date}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:Arial,sans-serif; max-width:160mm; margin:auto; padding:12mm; font-size:13px; }
    h1 { font-size:18px; font-weight:800; color:#0A1628; margin-bottom:4px; }
    .sub { font-size:12px; color:#6B7280; margin-bottom:16px; }
    table { width:100%; border-collapse:collapse; margin-top:16px; }
    th { background:#F3F4F6; padding:8px 12px; text-align:left; font-size:11px; text-transform:uppercase; letter-spacing:0.05em; }
    td { padding:10px 12px; border-bottom:1px solid #E5E7EB; font-size:13px; }
    .val { text-align:right; font-weight:700; }
    .total-row td { font-size:15px; font-weight:800; color:#0A1628; background:#F0F4FB; border-top:2px solid #0A1628; }
    .footer { margin-top:24px; font-size:11px; color:#9CA3AF; text-align:center; border-top:1px solid #E5E7EB; padding-top:12px; }
    .badge { display:inline-block; padding:3px 10px; border-radius:4px; background:#DCFCE7; color:#16A34A; font-weight:700; font-size:11px; }
    @media print { @page { margin:10mm; } }
  </style>
</head>
<body>
  <h1>Cloture de caisse</h1>
  <div class="sub">${etab?.nom ?? ""} ${etab?.ville ? "· " + etab.ville : ""}</div>
  <div><strong>Journee du</strong> ${dateStr}</div>
  <div style="margin-top:6px;font-size:12px;color:#6B7280">Cloturee le ${new Date().toLocaleDateString("fr-FR")} a ${heureStr} par ${gerant}</div>
  <div style="margin-top:6px"><span class="badge">JOURNEE CLOTUREE — LECTURE SEULE</span></div>
  <table>
    <thead><tr><th>Mode de paiement</th><th class="val">Montant (FCFA)</th></tr></thead>
    <tbody>
      <tr><td>Especes</td><td class="val">${totaux.especes.toLocaleString("fr-FR")}</td></tr>
      <tr><td>Mobile Money</td><td class="val">${totaux.mobile.toLocaleString("fr-FR")}</td></tr>
      <tr><td>Credit</td><td class="val">${totaux.credit.toLocaleString("fr-FR")}</td></tr>
      <tr><td>Autres</td><td class="val">${totaux.autres.toLocaleString("fr-FR")}</td></tr>
      <tr class="total-row"><td>TOTAL ENCAISSE</td><td class="val">${totaux.total.toLocaleString("fr-FR")}</td></tr>
    </tbody>
  </table>
  <div style="margin-top:12px;font-size:13px">Nombre de transactions : <strong>${nb}</strong></div>
  <div class="footer">MedOS — Document de cloture officiel · ${dateStr}</div>
</body>
</html>`;
  const w = window.open("", "_blank", "width=700,height=900,toolbar=0,menubar=0");
  if (!w) { alert("Autorisez les pop-ups pour imprimer la cloture."); return; }
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => { w.print(); }, 350);
}

// ─── Impression journal du gérant ─────────────────────────────────────────────
async function printJournal(journal, date, auth) {
  const etab = await fetchEtabFromAuth(auth);
  const totalEncaisse = journal.reduce((s, r) => s + (r.montant_total ?? 0), 0);
  const totalEspeces  = journal.filter((r) => r.mode_paiement === "especes").reduce((s, r) => s + (r.montant_total ?? 0), 0);
  const totalMonnaie  = journal.reduce((s, r) => s + (r.monnaie_rendue ?? 0), 0);
  const rows = journal.map((r) => {
    const heure  = new Date(r.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    const detail = Array.isArray(r.detail) ? r.detail.map((d) => `${d.nom} ×${d.qty}`).join(", ") : "—";
    return [
      `<span style="font-family:monospace;font-size:11px">${shortId(r.id)}</span>`,
      heure,
      MODE_LABELS[r.mode_paiement] ?? r.mode_paiement ?? "—",
      `<strong>${(r.montant_total ?? 0).toLocaleString("fr-FR")} FCFA</strong>`,
      detail,
    ];
  });
  openDocument({
    titre: "Journal de caisse",
    sousTitre: `Journée du ${new Date(date).toLocaleDateString("fr-FR")} — ${journal.length} transaction${journal.length !== 1 ? "s" : ""}`,
    etablissement: etab,
    sections: [
      {
        titre: "Récapitulatif de la journée",
        html: kpiHTML([
          { label: "Total encaissé",    value: `${totalEncaisse.toLocaleString("fr-FR")} FCFA`, color: "#10B981" },
          { label: "Dont espèces",      value: `${totalEspeces.toLocaleString("fr-FR")} FCFA`,  color: "#3B82F6" },
          { label: "Monnaie rendue",    value: `${totalMonnaie.toLocaleString("fr-FR")} FCFA`,  color: "#F59E0B" },
          { label: "Transactions",      value: String(journal.length),                           color: "#8B5CF6" },
        ]),
      },
      {
        titre: "Détail des transactions",
        html: rows.length === 0
          ? `<div style="padding:16px;color:#9CA3AF;font-size:13px">Aucune transaction enregistrée pour cette journée.</div>`
          : tableHTML(["Réf.", "Heure", "Mode", "Montant", "Articles"], rows),
      },
    ],
  });
}

// ─── Export CSV ───────────────────────────────────────────────────────────────
function exportCSV(journal, date) {
  const header = ["Ref","Heure","Caissier","Mode","Montant (FCFA)","Reçu (FCFA)","Monnaie (FCFA)","Articles","Détail"].join(";");
  const rows = journal.map((r) => {
    const heure = new Date(r.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    const detail = Array.isArray(r.detail)
      ? r.detail.map((d) => `${d.nom}×${d.qty}@${d.prix_unitaire ?? 0}FCFA`).join("|")
      : "";
    return [
      shortId(r.id),
      heure,
      r.caissier_email ?? "",
      MODE_LABELS[r.mode_paiement] ?? r.mode_paiement ?? "",
      r.montant_total ?? 0,
      r.montant_recu ?? "",
      r.monnaie_rendue ?? "",
      r.nb_articles ?? 0,
      detail,
    ].join(";");
  });
  const csv = [header, ...rows].join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `journal_caisse_${date}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Onglet Caisse ────────────────────────────────────────────────────────────
function OngletCaisse({ onSaleComplete }) {
  const { auth } = useAuth();
  const { data: medicaments, loading } = useMedicaments();
  const { toasts, success, error: toastError } = useToast();
  const [cart, setCart] = useState([]);
  const [search, setSearch] = useState("");
  const [paiement, setPaiement] = useState("especes");
  const [montantRecu, setMontantRecu] = useState("");
  const [saving, setSaving] = useState(false);
  const [lastTicket, setLastTicket] = useState(null);

  const total = cart.reduce((s, i) => s + (i.prix_unitaire ?? 0) * i.qty, 0);
  const monnaie = paiement === "especes" ? Math.max(0, Number(montantRecu) - total) : 0;
  const recuInsuffisant = paiement === "especes" && montantRecu !== "" && Number(montantRecu) < total;

  // Bloque les médicaments sans prix : force à saisir un prix avant de vendre
  const addToCart = (med) => {
    if ((med.stock_actuel ?? 0) === 0) return toastError(`${med.nom} est en rupture de stock`);
    if ((med.prix_unitaire ?? 0) === 0) return toastError(`${med.nom} — prix unitaire non défini (0 FCFA). Mettez à jour l'inventaire.`);
    setCart((prev) => {
      const ex = prev.find((i) => i.id === med.id);
      if (ex) {
        if (ex.qty >= (med.stock_actuel ?? 0)) return prev;
        // On conserve le prix snapshot au moment de l'ajout
        return prev.map((i) => i.id === med.id ? { ...i, qty: i.qty + 1 } : i);
      }
      // Snapshot du prix au moment de l'ajout au panier
      return [...prev, { ...med, prix_unitaire: med.prix_unitaire ?? 0, qty: 1 }];
    });
  };

  const updateQty = (id, qty) => {
    if (qty <= 0) setCart((prev) => prev.filter((i) => i.id !== id));
    else setCart((prev) => prev.map((i) => i.id === id ? { ...i, qty } : i));
  };

  const favoris = medicaments.slice(0, 8);
  const resultats = search
    ? medicaments.filter((m) => m.nom.toLowerCase().includes(search.toLowerCase()))
    : [];

  const handleEncaisser = async () => {
    if (cart.length === 0) return;
    if (recuInsuffisant) return toastError("Montant reçu insuffisant");
    // Vérification prix avant validation
    const sansPrice = cart.filter((i) => (i.prix_unitaire ?? 0) === 0);
    if (sansPrice.length > 0) return toastError(`Prix manquant : ${sansPrice.map((i) => i.nom).join(", ")}`);
    setSaving(true);
    try {
      const now = new Date();
      const etablissement_id = auth?.etablissement_id ?? null;
      const caissier_id = auth?.user?.id ?? null;
      const caissier_email = auth?.user?.email ?? null;

      // 1. Insert ventes (prix snapshot depuis le panier, pas depuis la DB)
      const rows = cart.map((item) => ({
        medicament_id: item.id,
        quantite: item.qty,
        prix_unitaire: item.prix_unitaire,           // snapshot
        montant_total: item.prix_unitaire * item.qty, // snapshot
        mode_paiement: paiement,
        date_vente: now.toISOString(),
        ...(etablissement_id ? { etablissement_id } : {}),
        ...(caissier_id ? { vendu_par: caissier_id } : {}),
      }));
      await insertVentes(rows);

      // 2. Décrémenter le stock
      await Promise.all(cart.map((item) => decrementStock(item.id, item.qty)));

      // 3. Journal de caisse avec détail complet (prix snapshot)
      const montantRecuNum = paiement === "especes" && montantRecu !== "" ? Number(montantRecu) : null;
      const monnaieRendue = montantRecuNum != null ? Math.max(0, montantRecuNum - total) : null;
      await insertJournalCaisse({
        etablissement_id,
        caissier_id,
        caissier_email,
        montant_total: total,
        montant_recu: montantRecuNum,
        monnaie_rendue: monnaieRendue,
        mode_paiement: paiement,
        nb_articles: cart.reduce((s, i) => s + i.qty, 0),
        detail: cart.map((i) => ({
          nom: i.nom,
          qty: i.qty,
          prix_unitaire: i.prix_unitaire,           // snapshot — jamais 0
          sous_total: i.prix_unitaire * i.qty,       // snapshot
        })),
      });

      success(`Vente enregistrée — ${total.toLocaleString()} FCFA`);
      const ticketYear = now.getFullYear();
      const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
      setLastTicket({
        ref: `TKT-${ticketYear}-${rand}`,
        date: now,
        items: cart.map((i) => ({ nom: i.nom, qty: i.qty, prix_unitaire: i.prix_unitaire })),
        paiement,
        total,
        montantRecu: montantRecuNum,
        monnaie: monnaieRendue,
        etab: await fetchEtabFromAuth(auth),
      });
      setCart([]);
      setMontantRecu("");
      onSaleComplete?.();
    } catch (e) {
      toastError("Erreur : " + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Toast toasts={toasts} />

      {/* Bannière ticket après vente */}
      {lastTicket && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px", backgroundColor: "#DCFCE7", border: "1.5px solid #16A34A", borderRadius: 12, marginBottom: 16 }}>
          <div>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#15803D" }}>Vente enregistrée — {lastTicket.ref}</span>
            <span style={{ fontSize: 12, color: "#16A34A", marginLeft: 12 }}>{lastTicket.total.toLocaleString()} FCFA · {MODE_LABELS[lastTicket.paiement] ?? lastTicket.paiement}</span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => printTicket(lastTicket)}
              style={{ padding: "7px 16px", backgroundColor: "#16A34A", color: "white", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" }}
            >
              Imprimer le ticket
            </button>
            <button
              onClick={() => setLastTicket(null)}
              style={{ padding: "7px 12px", backgroundColor: "transparent", color: "#16A34A", border: "1.5px solid #16A34A", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}
            >
              Fermer
            </button>
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 20, height: "calc(100vh - 220px)" }}>
        {/* Gauche */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ backgroundColor: "white", borderRadius: 14, padding: "16px 20px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <input
              placeholder="Rechercher un médicament…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: "100%", padding: "10px 14px", border: "1.5px solid #E5E7EB", borderRadius: 10, fontSize: 14, outline: "none", boxSizing: "border-box" }}
            />
          </div>

          <div style={{ backgroundColor: "white", borderRadius: 14, padding: "20px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <h3 style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 700, color: "#0A1628" }}>
              Produits disponibles {!loading && `(${medicaments.length})`}
            </h3>
            {loading ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
                {[1,2,3,4,5,6,7,8].map((i) => (
                  <div key={i} style={{ height: 64, backgroundColor: "#F3F4F6", borderRadius: 10, animation: "pulse 1.5s ease-in-out infinite" }} />
                ))}
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
                {favoris.map((m) => {
                  const sansPrix = (m.prix_unitaire ?? 0) === 0;
                  const rupture = (m.stock_actuel ?? 0) === 0;
                  const disabled = sansPrix || rupture;
                  return (
                    <button key={m.id} onClick={() => addToCart(m)} style={{
                      padding: "12px 8px",
                      backgroundColor: disabled ? "#F3F4F6" : "#F0F4FB",
                      border: `1.5px solid ${sansPrix && !rupture ? "#FCD34D" : "#E5E7EB"}`,
                      borderRadius: 10,
                      cursor: disabled ? "not-allowed" : "pointer",
                      textAlign: "center",
                      opacity: disabled ? 0.6 : 1,
                    }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#0A1628", marginBottom: 4 }}>{m.nom}</div>
                      <div style={{ fontSize: 12, color: sansPrix ? "#F59E0B" : "#3B82F6", fontWeight: 600 }}>
                        {sansPrix ? "Prix manquant" : `${m.prix_unitaire.toLocaleString()} FCFA`}
                      </div>
                      <div style={{ fontSize: 10, color: "#9CA3AF" }}>Stock: {m.stock_actuel ?? 0}</div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {search && resultats.length > 0 && (
            <div style={{ backgroundColor: "white", borderRadius: 14, padding: "20px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", flex: 1, overflow: "auto" }}>
              <h3 style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 700, color: "#0A1628" }}>Résultats ({resultats.length})</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {resultats.map((m) => {
                  const sansPrix = (m.prix_unitaire ?? 0) === 0;
                  return (
                    <div key={m.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", backgroundColor: "#F8FAFC", borderRadius: 10 }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13, color: "#0A1628" }}>{m.nom}</div>
                        <div style={{ fontSize: 11, color: "#9CA3AF" }}>{m.categorie} · Stock : {m.stock_actuel ?? 0}</div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <span style={{ fontWeight: 700, color: sansPrix ? "#F59E0B" : "#374151" }}>
                          {sansPrix ? "Prix manquant" : `${m.prix_unitaire.toLocaleString()} FCFA`}
                        </span>
                        <button onClick={() => addToCart(m)} style={{ padding: "6px 14px", backgroundColor: "#3B82F6", color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                          Ajouter
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Droite : panier */}
        <div style={{ backgroundColor: "white", borderRadius: 14, padding: "20px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", display: "flex", flexDirection: "column" }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: "#0A1628" }}>Panier</h3>

          <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
            {cart.length === 0 && (
              <div style={{ textAlign: "center", color: "#9CA3AF", fontSize: 13, padding: 40 }}>
                Aucun article.<br />Cliquez sur un produit pour l'ajouter.
              </div>
            )}
            {cart.map((item) => (
              <div key={item.id} style={{ padding: "10px 14px", backgroundColor: "#F8FAFC", borderRadius: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: "#0A1628" }}>{item.nom}</div>
                  <button onClick={() => updateQty(item.id, 0)} style={{ background: "none", border: "none", cursor: "pointer", color: "#9CA3AF", fontSize: 14, padding: 0 }}>×</button>
                </div>
                <div style={{ fontSize: 10, color: "#9CA3AF", marginBottom: 4 }}>{item.prix_unitaire.toLocaleString()} FCFA / unité</div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <button onClick={() => updateQty(item.id, item.qty - 1)} style={{ width: 26, height: 26, borderRadius: "50%", border: "1px solid #E5E7EB", background: "white", cursor: "pointer", fontWeight: 700 }}>-</button>
                    <span style={{ fontSize: 14, fontWeight: 700, width: 24, textAlign: "center" }}>{item.qty}</span>
                    <button onClick={() => updateQty(item.id, item.qty + 1)} style={{ width: 26, height: 26, borderRadius: "50%", border: "1px solid #E5E7EB", background: "white", cursor: "pointer", fontWeight: 700 }}>+</button>
                  </div>
                  <span style={{ fontWeight: 700, color: "#0A1628" }}>{(item.prix_unitaire * item.qty).toLocaleString()} FCFA</span>
                </div>
              </div>
            ))}
          </div>

          <div style={{ borderTop: "1px solid #E5E7EB", paddingTop: 16, marginTop: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 13, color: "#6B7280" }}>
              <span>Sous-total ({cart.reduce((s, i) => s + i.qty, 0)} articles)</span>
              <span>{total.toLocaleString()} FCFA</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 18, fontWeight: 800, color: "#0A1628", marginBottom: 16 }}>
              <span>TOTAL</span>
              <span>{total.toLocaleString()} FCFA</span>
            </div>

            {/* Mode de paiement */}
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Mode de paiement</label>
              <div style={{ display: "flex", gap: 8 }}>
                {[{ key: "especes", label: "Espèces" }, { key: "mobile_money", label: "Mobile" }, { key: "credit", label: "Crédit" }].map((mode) => (
                  <button key={mode.key} onClick={() => { setPaiement(mode.key); setMontantRecu(""); }} style={{
                    flex: 1, padding: "8px", borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: "pointer",
                    border: paiement === mode.key ? "2px solid #3B82F6" : "1.5px solid #E5E7EB",
                    backgroundColor: paiement === mode.key ? "#EFF6FF" : "white",
                    color: paiement === mode.key ? "#2563EB" : "#6B7280",
                  }}>{mode.label}</button>
                ))}
              </div>
            </div>

            {/* Suivi espèces */}
            {paiement === "especes" && (
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>Montant reçu du client (FCFA)</label>
                <input
                  type="number"
                  min="0"
                  value={montantRecu}
                  onChange={(e) => setMontantRecu(e.target.value)}
                  placeholder={`Min. ${total.toLocaleString()}`}
                  style={{
                    width: "100%", padding: "8px 12px",
                    border: `1.5px solid ${recuInsuffisant ? "#EF4444" : "#E5E7EB"}`,
                    borderRadius: 8, fontSize: 13, boxSizing: "border-box", outline: "none",
                    color: recuInsuffisant ? "#EF4444" : "#0A1628",
                  }}
                />
                {recuInsuffisant && (
                  <div style={{ fontSize: 11, color: "#EF4444", marginTop: 3 }}>
                    Montant insuffisant (manque {(total - Number(montantRecu)).toLocaleString()} FCFA)
                  </div>
                )}
                {!recuInsuffisant && montantRecu !== "" && Number(montantRecu) >= total && (
                  <div style={{ fontSize: 12, color: "#10B981", fontWeight: 700, marginTop: 4 }}>
                    Monnaie à rendre : {monnaie.toLocaleString()} FCFA
                  </div>
                )}
              </div>
            )}

            <button
              disabled={cart.length === 0 || saving || recuInsuffisant}
              onClick={handleEncaisser}
              style={{
                width: "100%", padding: "14px",
                backgroundColor: cart.length === 0 || saving || recuInsuffisant ? "#E5E7EB" : "#10B981",
                color: cart.length === 0 || saving || recuInsuffisant ? "#9CA3AF" : "white",
                border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700,
                cursor: cart.length === 0 || saving || recuInsuffisant ? "not-allowed" : "pointer",
              }}
            >
              {saving ? "Enregistrement…" : "Valider la vente"}
            </button>

            {cart.length > 0 && !saving && (
              <button
                onClick={() => { setCart([]); setMontantRecu(""); }}
                style={{ width: "100%", marginTop: 8, padding: "10px", backgroundColor: "white", border: "1.5px solid #E5E7EB", borderRadius: 10, fontSize: 13, color: "#6B7280", cursor: "pointer" }}>
                Vider le panier
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Modal clôture de caisse ─────────────────────────────────────────────────
function ClotureModal({ date, journal, byMode, totalEncaisse, auth, onClose, onDone }) {
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  const nb = journal.length;
  const totaux = {
    especes:  byMode.especes     ?? 0,
    mobile:   byMode.mobile_money ?? 0,
    credit:   byMode.credit       ?? 0,
    autres:   Object.entries(byMode).filter(([k]) => !["especes", "mobile_money", "credit"].includes(k)).reduce((s, [, v]) => s + v, 0),
    total:    totalEncaisse,
  };

  const handleCloturer = async () => {
    if (!password) { setErr("Mot de passe requis"); return; }
    setSaving(true);
    setErr(null);
    try {
      const { error: authErr } = await supabase.auth.signInWithPassword({
        email: auth?.user?.email ?? "",
        password,
      });
      if (authErr) throw new Error("Mot de passe incorrect");
      await insertClotureCaisse({
        etablissement_id: auth?.etablissement_id ?? null,
        gerant_id:        auth?.user?.id         ?? null,
        gerant_email:     auth?.user?.email       ?? null,
        date_journee:     date,
        total_especes:    totaux.especes,
        total_mobile:     totaux.mobile,
        total_credit:     totaux.credit,
        total_encaisse:   totaux.total,
        nb_transactions:  nb,
      });
      const etab = await fetchEtabFromAuth(auth);
      printCloture({
        date,
        totaux,
        nb,
        gerant: auth?.user?.email ?? "Gérant",
        etab,
      });
      onDone();
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  const dateStr = new Date(date + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ backgroundColor: "white", borderRadius: 16, padding: "28px 32px", width: 480, maxWidth: "95vw", boxShadow: "0 8px 40px rgba(0,0,0,0.18)" }}>
        <h2 style={{ margin: "0 0 4px", fontSize: 17, fontWeight: 800, color: "#0A1628" }}>Clôture de caisse</h2>
        <p style={{ margin: "0 0 20px", fontSize: 12, color: "#6B7280" }}>{dateStr}</p>

        {/* Récapitulatif */}
        <div style={{ backgroundColor: "#F8FAFC", borderRadius: 10, padding: "14px 16px", marginBottom: 20 }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <tbody>
              {[
                { label: "Espèces",      val: totaux.especes },
                { label: "Mobile Money", val: totaux.mobile },
                { label: "Crédit",       val: totaux.credit },
                { label: "Autres",       val: totaux.autres },
              ].map((r) => (
                <tr key={r.label}>
                  <td style={{ fontSize: 13, color: "#374151", padding: "5px 0" }}>{r.label}</td>
                  <td style={{ fontSize: 13, fontWeight: 700, color: "#0A1628", textAlign: "right" }}>{r.val.toLocaleString("fr-FR")} FCFA</td>
                </tr>
              ))}
              <tr style={{ borderTop: "2px solid #0A1628" }}>
                <td style={{ fontSize: 14, fontWeight: 800, color: "#0A1628", paddingTop: 8 }}>TOTAL ENCAISSÉ</td>
                <td style={{ fontSize: 15, fontWeight: 800, color: "#10B981", textAlign: "right", paddingTop: 8 }}>{totaux.total.toLocaleString("fr-FR")} FCFA</td>
              </tr>
            </tbody>
          </table>
          <div style={{ marginTop: 10, fontSize: 12, color: "#6B7280" }}>Transactions : <strong>{nb}</strong></div>
        </div>

        <div style={{ backgroundColor: "#FFFBEB", border: "1.5px solid #FCD34D", borderRadius: 8, padding: "10px 14px", marginBottom: 20, fontSize: 12, color: "#92400E" }}>
          Cette opération est irréversible. La journée sera verrouillée en lecture seule. Confirmez avec votre mot de passe.
        </div>

        <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Mot de passe du gérant</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCloturer()}
          placeholder="Votre mot de passe"
          style={{ width: "100%", padding: "9px 12px", border: `1.5px solid ${err ? "#EF4444" : "#E5E7EB"}`, borderRadius: 8, fontSize: 13, boxSizing: "border-box", outline: "none", marginBottom: err ? 6 : 16 }}
        />
        {err && <div style={{ fontSize: 12, color: "#EF4444", marginBottom: 12 }}>{err}</div>}

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "10px", border: "1.5px solid #E5E7EB", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", backgroundColor: "white", color: "#374151" }}>
            Annuler
          </button>
          <button onClick={handleCloturer} disabled={saving} style={{ flex: 2, padding: "10px", backgroundColor: saving ? "#E5E7EB" : "#DC2626", color: saving ? "#9CA3AF" : "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer" }}>
            {saving ? "Clôture en cours…" : "Clôturer et imprimer"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Onglet Journal du gérant ─────────────────────────────────────────────────
function OngletJournal({ refreshKey }) {
  const { auth } = useAuth();
  const [date, setDate] = useState(todayISO());
  const [journal, setJournal] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [cloture, setCloture] = useState(null);
  const [showCloture, setShowCloture] = useState(false);

  const isGerant = auth?.role_interne === null || auth?.role_interne === "gerant";

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [data, clot] = await Promise.all([
        fetchJournalJour(auth?.etablissement_id ?? null, date),
        fetchClotureCaisse(auth?.etablissement_id ?? null, date),
      ]);
      setJournal(data);
      setCloture(clot);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [auth?.etablissement_id, date]);

  useEffect(() => { load(); }, [load, refreshKey]);

  // ── Calculs anti-fraude ──
  const totalEncaisse = journal.reduce((s, r) => s + (r.montant_total ?? 0), 0);
  const totalMonnaieRendue = journal.reduce((s, r) => s + (r.monnaie_rendue ?? 0), 0);

  // Espèces : ventes en espèces seulement
  const rowsEspeces = journal.filter((r) => r.mode_paiement === "especes");
  const totalEspecesTheorique = rowsEspeces.reduce((s, r) => s + (r.montant_total ?? 0), 0);
  const totalEspecesDeclaresRecu = rowsEspeces.reduce((s, r) => s + (r.montant_recu ?? r.montant_total ?? 0), 0);
  const totalEspecesApresMonnaie = totalEspecesTheorique; // ce qui devrait être en caisse
  const ecartEspeces = totalEspecesDeclaresRecu - totalMonnaieRendue - totalEspecesTheorique;
  const hasEcart = Math.abs(ecartEspeces) > 0.01;

  const byMode = journal.reduce((acc, r) => {
    const k = r.mode_paiement ?? "autre";
    acc[k] = (acc[k] ?? 0) + (r.montant_total ?? 0);
    return acc;
  }, {});

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* Modal clôture */}
      {showCloture && (
        <ClotureModal
          date={date}
          journal={journal}
          byMode={byMode}
          totalEncaisse={totalEncaisse}
          auth={auth}
          onClose={() => setShowCloture(false)}
          onDone={() => { setShowCloture(false); load(); }}
        />
      )}

      {/* Bannière journée clôturée */}
      {cloture && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px", backgroundColor: "#DCFCE7", border: "1.5px solid #16A34A", borderRadius: 12 }}>
          <div>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#15803D" }}>Journée clôturée — lecture seule</span>
            <span style={{ fontSize: 12, color: "#16A34A", marginLeft: 12 }}>
              {cloture.total_encaisse?.toLocaleString("fr-FR")} FCFA · {cloture.nb_transactions} transaction{cloture.nb_transactions !== 1 ? "s" : ""}
            </span>
          </div>
          <button
            onClick={async () => { const etab = await fetchEtabFromAuth(auth); printCloture({ date, totaux: { especes: 0, mobile: 0, credit: 0, autres: 0, total: cloture.total_encaisse ?? 0 }, nb: cloture.nb_transactions ?? 0, gerant: cloture.gerant_email ?? "Gérant", etab }); }}
            style={{ padding: "6px 14px", backgroundColor: "#16A34A", color: "white", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" }}
          >
            Réimprimer
          </button>
        </div>
      )}

      {/* Barre d'outils */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          style={{ padding: "8px 12px", border: "1.5px solid #E5E7EB", borderRadius: 8, fontSize: 13 }}
        />
        <button onClick={load} style={{ padding: "8px 16px", backgroundColor: "#3B82F6", color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          Actualiser
        </button>
        <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
          {isGerant && (
            <button
              onClick={() => setShowCloture(true)}
              disabled={cloture != null || journal.length === 0}
              style={{
                padding: "8px 16px",
                backgroundColor: cloture != null ? "#DCFCE7" : journal.length === 0 ? "#E5E7EB" : "#DC2626",
                color: cloture != null ? "#16A34A" : journal.length === 0 ? "#9CA3AF" : "white",
                border: cloture != null ? "1.5px solid #16A34A" : "none",
                borderRadius: 8, fontSize: 13, fontWeight: 700,
                cursor: cloture != null || journal.length === 0 ? "not-allowed" : "pointer",
              }}
            >
              {cloture != null ? "Journee cloturee" : "Cloturer la journee"}
            </button>
          )}
          <button
            onClick={() => printJournal(journal, date, auth)}
            disabled={journal.length === 0}
            style={{
              padding: "8px 16px", backgroundColor: journal.length === 0 ? "#E5E7EB" : "#10B981",
              color: journal.length === 0 ? "#9CA3AF" : "white",
              border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600,
              cursor: journal.length === 0 ? "not-allowed" : "pointer",
            }}
          >
            Imprimer le journal
          </button>
          <button
            onClick={() => exportCSV(journal, date)}
            disabled={journal.length === 0}
            style={{
              padding: "8px 16px", backgroundColor: journal.length === 0 ? "#E5E7EB" : "#0A1628",
              color: journal.length === 0 ? "#9CA3AF" : "white",
              border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600,
              cursor: journal.length === 0 ? "not-allowed" : "pointer",
            }}
          >
            Exporter CSV
          </button>
        </div>
      </div>

      {/* Alerte écart caisse */}
      {hasEcart && rowsEspeces.length > 0 && (
        <div style={{ backgroundColor: "#FEF2F2", border: "1.5px solid #EF4444", borderRadius: 12, padding: "14px 18px", display: "flex", alignItems: "flex-start", gap: 10 }}>
          <span style={{ fontSize: 18, flexShrink: 0 }}>⚠</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#DC2626", marginBottom: 2 }}>Ecart de caisse détecté</div>
            <div style={{ fontSize: 12, color: "#7F1D1D" }}>
              Espèces attendues en caisse : <strong>{totalEspecesApresMonnaie.toLocaleString()} FCFA</strong>.
              Montant reçu – monnaie rendue : <strong>{(totalEspecesDeclaresRecu - totalMonnaieRendue).toLocaleString()} FCFA</strong>.
              Ecart : <strong>{ecartEspeces > 0 ? "+" : ""}{ecartEspeces.toLocaleString()} FCFA</strong>.
            </div>
          </div>
        </div>
      )}

      {/* KPI */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        {[
          { label: "Total encaissé", value: `${totalEncaisse.toLocaleString()} FCFA`, color: "#10B981" },
          { label: "Dont espèces (ventes)", value: `${totalEspecesTheorique.toLocaleString()} FCFA`, color: "#3B82F6" },
          { label: "Monnaie rendue", value: `${totalMonnaieRendue.toLocaleString()} FCFA`, color: "#F59E0B" },
          { label: "Espèces à vérifier", value: `${totalEspecesApresMonnaie.toLocaleString()} FCFA`, color: hasEcart ? "#EF4444" : "#10B981" },
        ].map((k) => (
          <div key={k.label} style={{ backgroundColor: "white", borderRadius: 12, padding: "14px 16px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <div style={{ fontSize: 10, color: "#9CA3AF", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.04em" }}>{k.label}</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Récapitulatif espèces à vérifier physiquement */}
      {rowsEspeces.length > 0 && (
        <div style={{ backgroundColor: "white", borderRadius: 12, padding: "16px 20px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", border: "1.5px solid #E5E7EB" }}>
          <h4 style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: "#0A1628" }}>
            Récapitulatif espèces — a vérifier physiquement
          </h4>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, fontSize: 13 }}>
            <div style={{ padding: "8px 12px", backgroundColor: "#F0F4FB", borderRadius: 8 }}>
              <div style={{ fontSize: 10, color: "#6B7280", marginBottom: 2 }}>Total ventes espèces</div>
              <div style={{ fontWeight: 700 }}>{totalEspecesTheorique.toLocaleString()} FCFA</div>
            </div>
            <div style={{ padding: "8px 12px", backgroundColor: "#FFFBEB", borderRadius: 8 }}>
              <div style={{ fontSize: 10, color: "#6B7280", marginBottom: 2 }}>– Monnaie rendue</div>
              <div style={{ fontWeight: 700, color: "#D97706" }}>– {totalMonnaieRendue.toLocaleString()} FCFA</div>
            </div>
            <div style={{ padding: "8px 12px", backgroundColor: hasEcart ? "#FEF2F2" : "#DCFCE7", borderRadius: 8, border: `1.5px solid ${hasEcart ? "#EF4444" : "#16A34A"}` }}>
              <div style={{ fontSize: 10, color: "#6B7280", marginBottom: 2 }}>= Espèces en caisse</div>
              <div style={{ fontWeight: 800, color: hasEcart ? "#DC2626" : "#16A34A" }}>{totalEspecesApresMonnaie.toLocaleString()} FCFA</div>
            </div>
          </div>
        </div>
      )}

      {/* Répartition par mode */}
      {Object.keys(byMode).length > 0 && (
        <div style={{ backgroundColor: "white", borderRadius: 12, padding: "16px 20px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <h4 style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: "#0A1628" }}>Répartition par mode de paiement</h4>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {Object.entries(byMode).map(([mode, montant]) => (
              <div key={mode} style={{ padding: "8px 14px", backgroundColor: "#F0F4FB", borderRadius: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>{MODE_LABELS[mode] ?? mode}</span>
                <span style={{ fontSize: 13, fontWeight: 800, color: "#2563EB", marginLeft: 8 }}>{montant.toLocaleString()} FCFA</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Liste des transactions — lecture seule, immuable */}
      <div style={{ backgroundColor: "white", borderRadius: 12, padding: "16px 20px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <h4 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#0A1628" }}>
            Registre des transactions ({journal.length}) — lecture seule
          </h4>
          <span style={{ fontSize: 10, fontWeight: 700, color: "#6B7280", padding: "3px 8px", backgroundColor: "#F3F4F6", borderRadius: 6 }}>
            IMMUABLE — aucune modification possible
          </span>
        </div>
        {loading && <div style={{ color: "#9CA3AF", fontSize: 13 }}>Chargement…</div>}
        {error && <div style={{ color: "#EF4444", fontSize: 13 }}>Une erreur s'est produite. Veuillez réessayer.</div>}
        {!loading && !error && journal.length === 0 && (
          <div style={{ color: "#9CA3AF", fontSize: 13, textAlign: "center", padding: 20 }}>Aucune transaction pour cette date.</div>
        )}
        {!loading && journal.map((row, idx) => {
          const heure = new Date(row.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
          const ref = shortId(row.id);
          return (
            <div key={row.id} style={{
              borderBottom: idx < journal.length - 1 ? "1px solid #F3F4F6" : "none",
              padding: "12px 0",
            }}>
              {/* Ligne principale */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontFamily: "monospace", fontSize: 11, fontWeight: 700, color: "#374151", backgroundColor: "#F3F4F6", padding: "2px 6px", borderRadius: 4 }}>
                    #{ref}
                  </span>
                  <span style={{ fontSize: 12, color: "#6B7280" }}>{heure}</span>
                  {row.caissier_email && (
                    <span style={{ fontSize: 11, color: "#9CA3AF" }}>{row.caissier_email}</span>
                  )}
                  <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 10, backgroundColor: "#EFF6FF", color: "#2563EB", fontWeight: 600 }}>
                    {MODE_LABELS[row.mode_paiement] ?? row.mode_paiement}
                  </span>
                  <span style={{ fontSize: 11, color: "#9CA3AF" }}>{row.nb_articles} art.</span>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 12 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: "#0A1628" }}>{(row.montant_total ?? 0).toLocaleString()} FCFA</div>
                  {row.mode_paiement === "especes" && row.montant_recu != null && (
                    <div style={{ fontSize: 11, color: "#6B7280" }}>
                      Reçu : {row.montant_recu.toLocaleString()} FCFA
                      {row.monnaie_rendue != null && row.monnaie_rendue > 0 && (
                        <span style={{ color: "#F59E0B", marginLeft: 4 }}>/ Monnaie : {row.monnaie_rendue.toLocaleString()} FCFA</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
              {/* Détail articles avec prix unitaire */}
              {Array.isArray(row.detail) && row.detail.length > 0 && (
                <div style={{ marginTop: 4, paddingLeft: 10, borderLeft: "2px solid #E5E7EB" }}>
                  {row.detail.map((d, di) => (
                    <div key={di} style={{ fontSize: 11, color: "#374151", lineHeight: 1.7 }}>
                      <span style={{ fontWeight: 600 }}>{d.nom}</span>
                      {" — "}
                      {d.qty} × {(d.prix_unitaire ?? 0).toLocaleString()} FCFA
                      {" = "}
                      <span style={{ fontWeight: 700 }}>{(d.sous_total ?? 0).toLocaleString()} FCFA</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────
export default function Caisse() {
  const [onglet, setOnglet] = useState("caisse");
  const [journalKey, setJournalKey] = useState(0);

  const handleSaleComplete = () => setJournalKey((k) => k + 1);

  return (
    <Layout title="Caisse — Point de Vente" subtitle="Enregistrement des ventes et dispensation">
      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20, backgroundColor: "white", borderRadius: 12, padding: 4, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", width: "fit-content" }}>
        {[
          { key: "caisse", label: "Caisse" },
          { key: "journal", label: "Journal du gérant" },
        ].map((t) => (
          <button key={t.key} onClick={() => setOnglet(t.key)} style={{
            padding: "8px 20px", borderRadius: 8, border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer",
            backgroundColor: onglet === t.key ? "#3B82F6" : "transparent",
            color: onglet === t.key ? "white" : "#6B7280",
          }}>{t.label}</button>
        ))}
      </div>

      {onglet === "caisse" && <OngletCaisse onSaleComplete={handleSaleComplete} />}
      {onglet === "journal" && <OngletJournal refreshKey={journalKey} />}

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
    </Layout>
  );
}
