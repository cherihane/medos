/**
 * NouvelleLivraisonModal — formulaire panier multi-médicaments pour créer une
 * livraison. Composant UNIQUE partagé entre l'écran Livraisons (distributeur)
 * et le bouton "Créer une livraison" d'une fiche client (Réseau clients) —
 * il n'existe qu'un seul chemin de création de livraison dans toute
 * l'application, jamais un mini-formulaire parallèle sans panier ni décrément
 * de stock (voir DEBUG_PROGRESS.md, bug confirmé session 11).
 *
 * Le panier de médicaments est fixé ici, à la création — c'est le seul
 * moment où l'on décrémente le stock entrepôt du distributeur (l'expédition
 * réelle des produits), voir handleSave. Le destinataire peut être un client
 * MedOS (distributeur_clients_id + etablissement_id réel) ou un client
 * manuel (distributeur_clients_id seul, etablissement_id nul).
 */
import { colors } from "../theme";
import { useState, useEffect } from "react";
import Modal, { Field, Row, ModalFooter, inputStyle, selectStyle } from "./Modal";
import {
  insertLivraison, insertLivraisonLignes, updateLivraison, expedierLigneLivraison,
} from "../hooks/useMutations";
import { supabase } from "../supabaseClient";
import { openDocument, tableHTML, infoGridHTML, fetchEtabFromAuth } from "../utils/MedOSDocument";

function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR");
}

// ── Bon de livraison — impression locale, PDF serveur (pièce jointe), email ───
// Même pattern que le bon de commande fabricant (Entrepot.jsx) : un document
// imprimable côté client, un PDF généré côté serveur pour l'email, un envoi
// honnête qui trace le vrai statut sans jamais bloquer la livraison elle-même.
export function printBonLivraison({ numeroSuivi, destinataireNom, lignes, dateDepart, etab }) {
  const dateFr = new Date().toLocaleDateString("fr-FR");
  openDocument({
    titre: "Bon de livraison",
    sousTitre: `${numeroSuivi} — Émis le ${dateFr}`,
    etablissement: etab,
    sections: [
      { titre: "Destinataire", html: infoGridHTML([
        { label: "Client", value: destinataireNom || "—" },
        { label: "Date de livraison", value: dateDepart ? new Date(dateDepart).toLocaleDateString("fr-FR") : "Non précisée" },
      ]) },
      { titre: "Médicaments", html: tableHTML(
        ["Médicament", "Quantité"],
        lignes.map((l) => [l.medicament_nom || l.nom || "—", `${(l.quantite || 0).toLocaleString("fr-FR")} unités`]),
        { alignRight: [1] }
      ) },
    ],
  });
}

export async function genererPieceJointeBonLivraison({ numeroSuivi, destinataireNom, destinataireEmail, lignes, dateDepart, etabNom }) {
  try {
    const { data, error } = await supabase.functions.invoke("generate-bon-commande-pdf", {
      body: {
        reference: numeroSuivi, etablissementNom: etabNom, entiteLabel: "CLIENT", documentType: "livraison",
        fournisseur: { nom: destinataireNom, email: destinataireEmail },
        lignes: lignes.map((l) => ({ nom: l.medicament_nom || l.nom, quantite: l.quantite })),
        dateLivraison: dateDepart,
      },
    });
    if (error || !data?.pdfBase64) return null;
    return { filename: data.filename, content: data.pdfBase64 };
  } catch {
    return null;
  }
}

async function sendLivraisonEmail({ destinataireEmail, destinataireNom, numeroSuivi, lignes, dateDepart, distributeurNom, pieceJointe }) {
  const dateStr = dateDepart ? new Date(dateDepart).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" }) : "Non précisée";
  const totalQty = lignes.reduce((s, l) => s + (l.quantite || 0), 0);
  const lignesHtml = lignes.map((l, i) => `
    <tr style="background:${i % 2 === 0 ? "#ffffff" : "#F8FAFC"}">
      <td style="padding:10px 14px;font-size:13px;color:#0A1628;font-weight:600;border-bottom:1px solid #e5e7eb">${l.medicament_nom || l.nom}</td>
      <td style="padding:10px 14px;font-size:13px;color:#374151;text-align:right;border-bottom:1px solid #e5e7eb">${(l.quantite || 0).toLocaleString("fr-FR")} unités</td>
    </tr>`).join("");

  const html = `
<div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb">
  <div style="background:#F59E0B;padding:28px 32px">
    <h1 style="color:white;margin:0;font-size:20px;font-weight:700">Bon de livraison</h1>
    <p style="color:rgba(255,255,255,0.88);margin:6px 0 0;font-size:13px">MedOS — Plateforme de distribution médicale</p>
  </div>
  <div style="padding:28px 32px">
    <p style="font-size:14px;color:#374151;margin:0 0 6px">Bonjour${destinataireNom ? ` <strong>${destinataireNom}</strong>` : ""},</p>
    <p style="font-size:14px;color:#374151;margin:0 0 22px">
      Le distributeur <strong>${distributeurNom}</strong> vous informe de l'expédition de la livraison
      <strong>${numeroSuivi}</strong> ci-dessous via la plateforme MedOS.
    </p>
    <div className="table-scroll"><table style="width:100%;border-collapse:collapse;margin-bottom:20px">
      <tr style="background:#F8FAFC">
        <td style="padding:9px 0;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:12px;width:44%">Date de livraison</td>
        <td style="padding:9px 0;border-bottom:1px solid #e5e7eb;font-weight:700;font-size:13px;color:#0A1628">${dateStr}</td>
      </tr>
    </table></div>
    <h2 style="font-size:14px;font-weight:700;color:#0A1628;margin:0 0 10px">Médicaments</h2>
    <div className="table-scroll"><table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:20px">
      <thead>
        <tr style="background:#0A1628">
          <th style="padding:10px 14px;text-align:left;font-size:12px;color:#fff;font-weight:700">Médicament</th>
          <th style="padding:10px 14px;text-align:right;font-size:12px;color:#fff;font-weight:700">Quantité</th>
        </tr>
      </thead>
      <tbody>${lignesHtml}
        <tr style="background:#FFFBEB">
          <td style="padding:10px 14px;font-size:13px;font-weight:700;color:#92400E">${lignes.length} référence${lignes.length > 1 ? "s" : ""}</td>
          <td style="padding:10px 14px;font-size:13px;font-weight:700;color:#92400E;text-align:right">${totalQty.toLocaleString("fr-FR")} unités au total</td>
        </tr>
      </tbody>
    </table></div>
    <p style="font-size:12px;color:#9CA3AF;margin:0">Bon de livraison joint en pièce jointe (PDF).</p>
  </div>
  <div style="background:#F8FAFC;padding:14px 32px;border-top:1px solid #e5e7eb;text-align:center">
    <p style="font-size:12px;color:#9CA3AF;margin:0">MedOS — ${distributeurNom}</p>
  </div>
</div>`;

  const { error } = await supabase.functions.invoke("send-app-email", {
    body: {
      to: destinataireEmail,
      subject: `Bon de livraison MedOS — ${numeroSuivi}`,
      html,
      ...(pieceJointe ? { attachments: [pieceJointe] } : {}),
    },
  });
  if (error) throw new Error(error.message);
}

// `preselectedRelationId` : quand ouvert depuis une fiche client (ReseauClients.jsx),
// le destinataire est déjà connu — pré-rempli mais toujours modifiable, pas verrouillé.
export default function NouvelleLivraisonModal({ relations, medicaments, distributeurId, distributeurNom, auth, preselectedRelationId = "", onClose, onSaved }) {
  const [form, setForm] = useState({
    relation_id: preselectedRelationId, transporteur: "",
    date_depart: new Date().toISOString().slice(0, 10), date_arrivee_prevue: "",
    commande_id: "",
  });
  const [cart, setCart] = useState([]);
  const [medicamentId, setMedicamentId] = useState("");
  const [quantite, setQuantite] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);
  const [partiel, setPartiel] = useState(null);
  const set = (k) => (e) => { setFormError(null); setForm((f) => ({ ...f, [k]: e.target.value })); };

  // Commande d'origine (optionnelle) — les commandes que CE client a passées
  // chez ce distributeur, pour relier la livraison à ce qui a été commandé
  // (visible ensuite dans le détail de la livraison). Rechargé à chaque
  // changement de destinataire ; jamais obligatoire, une livraison peut très
  // bien être créée sans commande d'origine.
  const [commandesClient, setCommandesClient] = useState([]);
  useEffect(() => {
    const relation = relations.find((r) => r.id === form.relation_id);
    if (!relation || relation.client.estManuel) { setCommandesClient([]); return; }
    let cancelled = false;
    supabase
      .from("commandes")
      .select("id, reference, date_commande, montant_total")
      .eq("distributeur_id", distributeurId)
      .eq("etablissement_id", relation.client.id)
      .order("date_commande", { ascending: false })
      .limit(20)
      .then(({ data }) => { if (!cancelled) setCommandesClient(data ?? []); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.relation_id]);

  const addToCart = () => {
    if (!medicamentId) { setFormError("Choisissez un médicament."); return; }
    const qty = parseInt(quantite, 10);
    if (!qty || qty <= 0) { setFormError("Quantité invalide."); return; }
    const med = medicaments.find((m) => m.id === medicamentId);
    if (!med) return;
    setFormError(null);
    setCart((c) => {
      const existing = c.find((it) => it.medicament_id === medicamentId);
      if (existing) {
        return c.map((it) => it.medicament_id === medicamentId ? { ...it, quantite: (Number(it.quantite) || 0) + qty } : it);
      }
      const nom = `${med.nom}${med.dosage ? ` ${med.dosage}` : ""}${med.forme ? ` (${med.forme})` : ""}`;
      return [...c, { medicament_id: med.id, nom, quantite: qty, stock_disponible: med.stock_actuel ?? 0 }];
    });
    setMedicamentId("");
    setQuantite("");
  };

  const updateCartQuantite = (medicament_id, val) => {
    const n = parseInt(val, 10);
    setCart((c) => c.map((it) => it.medicament_id === medicament_id ? { ...it, quantite: Number.isNaN(n) ? "" : n } : it));
  };
  const removeFromCart = (medicament_id) => setCart((c) => c.filter((it) => it.medicament_id !== medicament_id));

  const handleSave = async () => {
    if (!form.relation_id) { setFormError("Sélectionnez un client destinataire."); return; }
    if (cart.length === 0) { setFormError("Ajoutez au moins un médicament à la livraison."); return; }
    for (const it of cart) {
      if (!it.quantite || it.quantite <= 0) { setFormError(`Quantité invalide pour "${it.nom}".`); return; }
      if (it.quantite > it.stock_disponible) {
        setFormError(`Stock entrepôt insuffisant pour "${it.nom}" (disponible : ${it.stock_disponible}, demandé : ${it.quantite}).`);
        return;
      }
    }
    const relation = relations.find((r) => r.id === form.relation_id);
    if (!relation) { setFormError("Client introuvable."); return; }
    setSaving(true);
    setFormError(null);
    try {
      const livraison = await insertLivraison({
        etablissement_id: relation.client.estManuel ? null : relation.client.id,
        distributeur_clients_id: relation.id,
        distributeur_id: distributeurId,
        commande_id: form.commande_id || null,
        statut: "planifiee",
        transporteur: form.transporteur || null,
        numero_suivi: "LIV-" + Date.now().toString().slice(-8),
        date_depart: form.date_depart || null,
        date_arrivee_prevue: form.date_arrivee_prevue || null,
        cree_par_id: auth?.user?.id ?? null,
        cree_par_email: auth?.user?.email ?? null,
      });

      await insertLivraisonLignes(cart.map((it) => ({
        livraison_id: livraison.id,
        medicament_id: it.medicament_id,
        medicament_nom: it.nom,
        quantite: it.quantite,
      })));

      // Décrément entrepôt, ligne par ligne, vérifié et appliqué côté
      // serveur (voir expedier_ligne_livraison). Si une ligne échoue après
      // que d'autres ont déjà été décrémentées (rare, concurrence), la
      // livraison existe déjà avec un état partiellement appliqué — on ne
      // le cache pas, on l'affiche clairement plutôt que de prétendre un
      // succès complet.
      const echecs = [];
      for (const it of cart) {
        const res = await expedierLigneLivraison(it.medicament_id, it.quantite, distributeurId);
        if (res !== "ok") echecs.push({ nom: it.nom, res });
      }

      if (echecs.length > 0) {
        setPartiel({ numero_suivi: livraison.numero_suivi, echecs, total: cart.length });
        setSaving(false);
        return;
      }

      // Notification dans l'espace MedOS du client (en plus de l'email) — un
      // client manuel n'a pas de compte MedOS à notifier, seul l'email compte
      // pour lui. Best-effort : n'empêche jamais la livraison si ça échoue.
      if (!relation.client.estManuel) {
        try {
          await supabase.rpc("notifier_client_distributeur", {
            p_etablissement_id: relation.client.id,
            p_type: "livraison",
            p_titre: `Nouvelle livraison — ${distributeurNom}`,
            p_message: `${cart.length} médicament${cart.length > 1 ? "s" : ""}${form.date_arrivee_prevue ? `, arrivée prévue le ${fmtDate(form.date_arrivee_prevue)}` : ""}`,
            p_severite: "info",
          });
        } catch (_) {}
      }

      // Bon de livraison envoyé au moment de l'expédition (= création, voir
      // commentaire plus haut sur le décrément entrepôt). Un client manuel
      // sans email n'en reçoit simplement pas — ce n'est jamais une erreur
      // qui bloque la livraison, seulement un statut tracé honnêtement.
      if (relation.client.email) {
        let emailStatut = "non_envoye";
        let emailErreur = null;
        try {
          const etab = await fetchEtabFromAuth(auth);
          const pieceJointe = await genererPieceJointeBonLivraison({
            numeroSuivi: livraison.numero_suivi,
            destinataireNom: relation.client.nom,
            destinataireEmail: relation.client.email,
            lignes: cart,
            dateDepart: form.date_depart,
            etabNom: etab.nom,
          });
          await sendLivraisonEmail({
            destinataireEmail: relation.client.email,
            destinataireNom: relation.client.nom,
            numeroSuivi: livraison.numero_suivi,
            lignes: cart,
            dateDepart: form.date_depart,
            distributeurNom,
            pieceJointe,
          });
          emailStatut = "envoye";
        } catch (emailErr) {
          emailStatut = "echec";
          emailErreur = emailErr.message;
        }
        await updateLivraison(livraison.id, { email_statut: emailStatut, email_erreur: emailErreur });
      }

      onSaved();
      onClose();
    } catch (e) {
      setFormError("Erreur : " + e.message);
      setSaving(false);
    }
  };

  if (partiel) {
    return (
      <Modal title="Livraison créée avec une anomalie" onClose={() => { onSaved(); onClose(); }} width={480}>
        <div style={{ padding: "10px 14px", backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, fontSize: 12, color: "#DC2626", marginBottom: 12 }}>
          La livraison {partiel.numero_suivi} a été créée, mais le décrément du stock entrepôt a
          échoué pour {partiel.echecs.length} produit{partiel.echecs.length > 1 ? "s" : ""} sur {partiel.total} —
          vérifiez le stock manuellement dans Entrepôt.
        </div>
        {partiel.echecs.map((e, i) => (
          <div key={i} style={{ padding: "8px 12px", backgroundColor: "#FFFBEB", borderRadius: 8, marginBottom: 6, fontSize: 12, color: "#92400E" }}>
            {e.nom} — {e.res === "stock_insuffisant" ? "stock insuffisant" : "produit introuvable"}
          </div>
        ))}
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
          <button onClick={() => { onSaved(); onClose(); }} style={{ padding: "8px 20px", backgroundColor: colors.bgSurface, border: `1px solid ${colors.border}`, borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            Fermer
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Nouvelle livraison" onClose={onClose} width={520}>
      <Field label="Destinataire *">
        <select style={selectStyle} value={form.relation_id} onChange={set("relation_id")}>
          <option value="">— Sélectionner un client —</option>
          {relations.map((r) => (
            <option key={r.id} value={r.id}>
              {r.client.nom}{r.client.ville ? ` (${r.client.ville})` : ""}{r.client.estManuel ? " — manuel" : ""}
            </option>
          ))}
        </select>
        {relations.length === 0 && (
          <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 4 }}>
            Aucun client pour l'instant — ajoutez-en un depuis "Réseau clients".
          </div>
        )}
      </Field>
      {commandesClient.length > 0 && (
        <Field label="Commande d'origine (optionnel)">
          <select style={selectStyle} value={form.commande_id} onChange={set("commande_id")}>
            <option value="">— Aucune, livraison créée directement —</option>
            {commandesClient.map((c) => (
              <option key={c.id} value={c.id}>
                {c.reference ?? c.id.slice(0, 8).toUpperCase()} — {fmtDate(c.date_commande)} — {(c.montant_total ?? 0).toLocaleString("fr-FR")} FCFA
              </option>
            ))}
          </select>
          <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 4 }}>
            Relie cette livraison à une commande déjà reçue de ce client — visible ensuite dans le
            détail de la livraison.
          </div>
        </Field>
      )}
      <Field label="Transporteur">
        <input style={inputStyle} value={form.transporteur} onChange={set("transporteur")} placeholder="Ex: DHL, Transport Koné…" />
      </Field>
      <Row>
        <Field label="Date de départ">
          <input style={inputStyle} type="date" value={form.date_depart} onChange={set("date_depart")} />
        </Field>
        <Field label="Arrivée prévue">
          <input style={inputStyle} type="date" value={form.date_arrivee_prevue} onChange={set("date_arrivee_prevue")} />
        </Field>
      </Row>

      <Field label="Médicaments à expédier *">
        <div style={{ display: "flex", gap: 8 }}>
          <select style={{ ...selectStyle, flex: 2 }} value={medicamentId} onChange={(e) => setMedicamentId(e.target.value)}>
            <option value="">— Médicament de l'entrepôt —</option>
            {medicaments.map((m) => (
              <option key={m.id} value={m.id}>{m.nom}{m.dosage ? ` ${m.dosage}` : ""} — stock {m.stock_actuel ?? 0}</option>
            ))}
          </select>
          <input style={{ ...inputStyle, flex: 1 }} type="number" min="1" value={quantite} onChange={(e) => setQuantite(e.target.value)} placeholder="Qté" />
          <button type="button" onClick={addToCart} style={{ padding: "0 14px", backgroundColor: "#F59E0B", color: "white", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            + Ajouter
          </button>
        </div>
        {medicaments.length === 0 && (
          <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 4 }}>
            Aucun médicament dans votre entrepôt — réceptionnez-en d'abord depuis "Entrepôt".
          </div>
        )}
      </Field>

      {cart.length > 0 && (
        <div style={{ border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden", marginBottom: 14 }}>
          {cart.map((it) => (
            <div key={it.medicament_id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderBottom: "1px solid var(--border-light)" }}>
              <div style={{ flex: 1, fontSize: 12, color: colors.navy, fontWeight: 600 }}>{it.nom}</div>
              <input
                type="number" min="1"
                value={it.quantite}
                onChange={(e) => updateCartQuantite(it.medicament_id, e.target.value)}
                style={{ ...inputStyle, width: 70, padding: "6px 8px", fontSize: 12 }}
              />
              <span style={{ fontSize: 11, color: it.quantite > it.stock_disponible ? "#DC2626" : colors.textMuted }}>
                / {it.stock_disponible} dispo
              </span>
              <button type="button" onClick={() => removeFromCart(it.medicament_id)} style={{ background: "none", border: "none", color: "#EF4444", cursor: "pointer", fontSize: 16, fontWeight: 700 }}>×</button>
            </div>
          ))}
        </div>
      )}

      {formError && (
        <div style={{ padding: "10px 14px", backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, fontSize: 13, color: "#DC2626" }}>
          {formError}
        </div>
      )}
      <ModalFooter onCancel={onClose} onSubmit={handleSave} submitLabel="Créer la livraison" saving={saving} />
    </Modal>
  );
}
