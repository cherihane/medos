import { colors } from "../../theme";
import { useState, useEffect } from "react";
import Layout from "../../components/Layout";
import Modal, { Field, Row, ModalFooter, inputStyle, selectStyle } from "../../components/Modal";
import Toast from "../../components/Toast";
import { useToast } from "../../hooks/useToast";
import { useLivraisonsPaginated, useDistributeurClients, useMedicaments, useLivraisonLignes } from "../../hooks/useSupabaseData";
import Pagination from "../../components/Pagination";
import {
  insertLivraison, insertLivraisonLignes, updateLivraison, receiveLivraison, expedierLigneLivraison,
  deleteLivraison, ajusterLigneLivraison, annulerLivraison, updateLivraisonLigneDisponibilite,
} from "../../hooks/useMutations";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../supabaseClient";
import { openDocument, tableHTML, infoGridHTML, fetchEtabFromAuth } from "../../utils/MedOSDocument";

const statusStyle = {
  planifiee:   { bg: "#F3F4F6",  color: colors.textSecondary,  label: "Planifiée" },
  en_transit:  { bg: "#DBEAFE",  color: "#2563EB",  label: "En transit" },
  livree:      { bg: "#DCFCE7",  color: "#16A34A",  label: "Livrée" },
  incident:    { bg: "#FEF2F2",  color: "#EF4444",  label: "Incident" },
  annulee:     { bg: "#E5E7EB",  color: "#4B5563",  label: "Annulée" },
};

function fmt(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR");
}

// ── Bon de livraison — impression locale, PDF serveur (pièce jointe), email ───
// Même pattern que le bon de commande fabricant (Entrepot.jsx) : un document
// imprimable côté client, un PDF généré côté serveur pour l'email, un envoi
// honnête qui trace le vrai statut sans jamais bloquer la livraison elle-même.
function printBonLivraison({ numeroSuivi, destinataireNom, lignes, dateDepart, etab }) {
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

async function genererPieceJointeBonLivraison({ numeroSuivi, destinataireNom, destinataireEmail, lignes, dateDepart, etabNom }) {
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

// ── Modal Nouvelle livraison ───────────────────────────────────────────────────
// Le panier de médicaments est fixé ici, à la création — c'est le seul
// moment où l'on décrémente le stock entrepôt du distributeur (l'expédition
// réelle des produits), voir handleSave. Le destinataire peut être un client
// MedOS (distributeur_clients_id + etablissement_id réel) ou un client
// manuel (distributeur_clients_id seul, etablissement_id nul).
function NouvelleModal({ relations, medicaments, distributeurId, distributeurNom, auth, onClose, onSaved }) {
  const [form, setForm] = useState({
    relation_id: "", transporteur: "",
    date_depart: new Date().toISOString().slice(0, 10), date_arrivee_prevue: "",
  });
  const [cart, setCart] = useState([]);
  const [medicamentId, setMedicamentId] = useState("");
  const [quantite, setQuantite] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);
  const [partiel, setPartiel] = useState(null);
  const set = (k) => (e) => { setFormError(null); setForm((f) => ({ ...f, [k]: e.target.value })); };

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
        statut: "planifiee",
        transporteur: form.transporteur || null,
        numero_suivi: "LIV-" + Date.now().toString().slice(-8),
        date_depart: form.date_depart || null,
        date_arrivee_prevue: form.date_arrivee_prevue || null,
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

// ── Modal Modifier une livraison (tant que non "livree") ─────────────────────
// Transporteur/dates modifiables librement ; le panier (ajout/retrait/quantité)
// passe par ajuster_ligne_livraison côté serveur pour réconcilier le stock
// entrepôt à chaque changement — jamais un simple update local qui désynchro-
// niserait le stock réel. La disponibilité par ligne (point c) est éditable
// ici aussi, sans impact sur le stock.
function EditModal({ livraison, medicaments, distributeurId, onClose, onSaved }) {
  const { data: lignesExistantes, loading: loadingLignes } = useLivraisonLignes(livraison.id);
  const [form, setForm] = useState({
    transporteur: livraison.transporteur || "",
    date_depart: livraison.date_depart ? livraison.date_depart.slice(0, 10) : "",
    date_arrivee_prevue: livraison.date_arrivee_prevue ? livraison.date_arrivee_prevue.slice(0, 10) : "",
  });
  const [cart, setCart] = useState(null);
  const [medicamentId, setMedicamentId] = useState("");
  const [quantite, setQuantite] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);
  const set = (k) => (e) => { setFormError(null); setForm((f) => ({ ...f, [k]: e.target.value })); };

  useEffect(() => {
    if (!loadingLignes && cart === null) {
      setCart(lignesExistantes.map((l) => ({
        medicament_id: l.medicament_id, nom: l.medicament_nom,
        quantite: l.quantite, original_quantite: l.quantite,
        disponible: l.disponible !== false, original_disponible: l.disponible !== false,
      })));
    }
  }, [loadingLignes, lignesExistantes, cart]);

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
      return [...c, { medicament_id: med.id, nom, quantite: qty, original_quantite: 0, disponible: true, original_disponible: true }];
    });
    setMedicamentId("");
    setQuantite("");
  };

  const updateCartQuantite = (medicament_id, val) => {
    const n = parseInt(val, 10);
    setCart((c) => c.map((it) => it.medicament_id === medicament_id ? { ...it, quantite: Number.isNaN(n) ? "" : n } : it));
  };
  const removeFromCart = (medicament_id) => setCart((c) => c.filter((it) => it.medicament_id !== medicament_id));
  const toggleDisponible = (medicament_id) => setCart((c) => c.map((it) => it.medicament_id === medicament_id ? { ...it, disponible: !it.disponible } : it));

  const handleSave = async () => {
    if (!cart) return;
    for (const it of cart) {
      if (!it.quantite || it.quantite <= 0) { setFormError(`Quantité invalide pour "${it.nom}".`); return; }
    }
    setSaving(true);
    setFormError(null);
    try {
      await updateLivraison(livraison.id, {
        transporteur: form.transporteur || null,
        date_depart: form.date_depart || null,
        date_arrivee_prevue: form.date_arrivee_prevue || null,
      });

      const cartIds = new Set(cart.map((it) => it.medicament_id));
      const supprimees = lignesExistantes.filter((l) => !cartIds.has(l.medicament_id));

      const echecs = [];
      for (const l of supprimees) {
        const res = await ajusterLigneLivraison(livraison.id, l.medicament_id, l.medicament_nom, 0, distributeurId);
        if (res !== "ok") echecs.push({ nom: l.medicament_nom, res });
      }
      for (const it of cart) {
        if (it.quantite !== it.original_quantite) {
          const res = await ajusterLigneLivraison(livraison.id, it.medicament_id, it.nom, it.quantite, distributeurId);
          if (res !== "ok") echecs.push({ nom: it.nom, res });
        }
        if (it.disponible !== it.original_disponible) {
          await updateLivraisonLigneDisponibilite(livraison.id, it.medicament_id, it.disponible);
        }
      }

      if (echecs.length > 0) {
        setFormError(
          "Certaines lignes n'ont pas pu être ajustées : " +
          echecs.map((e) => `${e.nom} (${e.res === "stock_insuffisant" ? "stock insuffisant" : e.res})`).join(", ")
        );
        setSaving(false);
        return;
      }

      onSaved();
      onClose();
    } catch (e) {
      setFormError("Erreur : " + e.message);
      setSaving(false);
    }
  };

  return (
    <Modal title={`Modifier — ${livraison.numero_suivi ?? ""}`} onClose={onClose} width={520}>
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

      <Field label="Médicaments">
        <div style={{ display: "flex", gap: 8 }}>
          <select style={{ ...selectStyle, flex: 2 }} value={medicamentId} onChange={(e) => setMedicamentId(e.target.value)}>
            <option value="">— Ajouter un médicament de l'entrepôt —</option>
            {medicaments.map((m) => (
              <option key={m.id} value={m.id}>{m.nom}{m.dosage ? ` ${m.dosage}` : ""} — stock {m.stock_actuel ?? 0}</option>
            ))}
          </select>
          <input style={{ ...inputStyle, flex: 1 }} type="number" min="1" value={quantite} onChange={(e) => setQuantite(e.target.value)} placeholder="Qté" />
          <button type="button" onClick={addToCart} style={{ padding: "0 14px", backgroundColor: "#F59E0B", color: "white", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            + Ajouter
          </button>
        </div>
      </Field>

      {loadingLignes || cart === null ? (
        <div style={{ fontSize: 12, color: colors.textMuted, padding: "12px 0" }}>Chargement du panier…</div>
      ) : cart.length > 0 && (
        <div style={{ border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden", marginBottom: 14 }}>
          {cart.map((it) => (
            <div key={it.medicament_id} style={{ padding: "8px 12px", borderBottom: "1px solid var(--border-light)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ flex: 1, fontSize: 12, color: colors.navy, fontWeight: 600 }}>{it.nom}</div>
                <input
                  type="number" min="1"
                  value={it.quantite}
                  onChange={(e) => updateCartQuantite(it.medicament_id, e.target.value)}
                  style={{ ...inputStyle, width: 70, padding: "6px 8px", fontSize: 12 }}
                />
                <button type="button" onClick={() => removeFromCart(it.medicament_id)} style={{ background: "none", border: "none", color: "#EF4444", cursor: "pointer", fontSize: 16, fontWeight: 700 }}>×</button>
              </div>
              <button
                type="button"
                onClick={() => toggleDisponible(it.medicament_id)}
                style={{
                  marginTop: 6, padding: "3px 10px", borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: "pointer", border: "none",
                  backgroundColor: it.disponible ? "#DCFCE7" : "#FEF2F2",
                  color: it.disponible ? "#16A34A" : "#DC2626",
                }}
              >
                {it.disponible ? "Disponible" : "En rupture, à reporter"}
              </button>
            </div>
          ))}
        </div>
      )}

      {formError && (
        <div style={{ padding: "10px 14px", backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, fontSize: 13, color: "#DC2626" }}>
          {formError}
        </div>
      )}
      <ModalFooter onCancel={onClose} onSubmit={handleSave} submitLabel="Enregistrer les modifications" saving={saving} />
    </Modal>
  );
}

// ── Modal Traçabilité — lots liés aux médicaments d'une livraison ────────────
function TracabiliteModal({ livraison, onClose }) {
  const [lots, setLots] = useState(null);
  const lignes = livraison.livraison_lignes ?? [];

  useEffect(() => {
    const ids = [...new Set(lignes.map((l) => l.medicament_id).filter(Boolean))];
    if (ids.length === 0) { setLots([]); return; }
    supabase
      .from("lots")
      .select("id, medicament_id, numero_lot, fabricant, date_fabrication, date_expiration")
      .in("medicament_id", ids)
      .order("date_expiration", { ascending: true })
      .then(({ data }) => setLots(data ?? []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [livraison.id]);

  return (
    <Modal title={`Traçabilité — ${livraison.numero_suivi ?? ""}`} onClose={onClose} width={520}>
      {lignes.map((l) => {
        const lotsProduit = (lots ?? []).filter((lo) => lo.medicament_id === l.medicament_id);
        return (
          <div key={l.id} style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: colors.navy, marginBottom: 6 }}>{l.medicament_nom} × {l.quantite}</div>
            {lots === null ? (
              <div style={{ fontSize: 12, color: colors.textMuted }}>Chargement…</div>
            ) : lotsProduit.length === 0 ? (
              <div style={{ fontSize: 12, color: colors.textMuted }}>Aucun lot certifié MedOS enregistré pour ce médicament.</div>
            ) : (
              lotsProduit.map((lo) => (
                <div key={lo.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 10px", backgroundColor: colors.bgSurface, borderRadius: 8, marginBottom: 4, fontSize: 12 }}>
                  <span style={{ fontFamily: "monospace", color: colors.navy, fontWeight: 700 }}>{lo.numero_lot}</span>
                  <span style={{ color: colors.textSecondary }}>{lo.fabricant ?? "—"}</span>
                  <span style={{ color: colors.textSecondary }}>Péremption {fmt(lo.date_expiration)}</span>
                </div>
              ))
            )}
          </div>
        );
      })}
      {lignes.length === 0 && (
        <div style={{ fontSize: 13, color: colors.textMuted, padding: "12px 0" }}>Aucun médicament sur cette livraison.</div>
      )}
      <div style={{ marginTop: 8, display: "flex", justifyContent: "flex-end" }}>
        <button onClick={onClose} style={{ padding: "8px 20px", backgroundColor: colors.bgSurface, border: `1px solid ${colors.border}`, borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          Fermer
        </button>
      </div>
    </Modal>
  );
}

// ── Modal Update statut ───────────────────────────────────────────────────────
function StatutModal({ livraison, onClose, onSaved }) {
  const { data: lignes } = useLivraisonLignes(livraison.id);
  const [statut, setStatut] = useState(livraison.statut);
  const [saving, setSaving] = useState(false);
  const [stockWarn, setStockWarn] = useState(null);
  const [results, setResults] = useState(null);

  const handleSave = async () => {
    setSaving(true);
    setStockWarn(null);
    try {
      const update = { statut };
      if (statut === "livree") {
        update.date_arrivee_reelle = new Date().toISOString();
        update.lignes_livrees = JSON.stringify(lignes.map((l) => ({ nom: l.medicament_nom, quantite: l.quantite })));
        update.quantite_livree = lignes.reduce((s, l) => s + (l.quantite || 0), 0);

        // L'écriture du statut passe en premier et seule : si elle échoue,
        // aucun mouvement de stock n'a été appliqué et un nouvel essai
        // reste sûr — jamais rejoué après un succès partiel.
        await updateLivraison(livraison.id, update);

        const lignesResults = [];
        for (const ligne of lignes) {
          const res = await receiveLivraison(ligne.medicament_nom, ligne.quantite, livraison.etablissement_id);
          lignesResults.push({ nom: ligne.medicament_nom, quantite: ligne.quantite, status: res === "ok" ? "ok" : "introuvable" });
        }

        onSaved(statut);
        setResults(lignesResults);
      } else {
        await updateLivraison(livraison.id, update);
        onSaved(statut);
        onClose();
      }
    } catch (e) {
      setStockWarn("Erreur : " + e.message);
    } finally {
      setSaving(false);
    }
  };

  if (results !== null) {
    return (
      <Modal title="Recapitulatif de la livraison" onClose={onClose} width={480}>
        <div style={{ marginBottom: 16 }}>
          {results.map((r, i) => (
            <div key={i} style={{
              padding: "10px 14px", marginBottom: 8, borderRadius: 8,
              backgroundColor: r.status === "ok" ? "#F0FDF4" : "#FFFBEB",
              border: `1px solid ${r.status === "ok" ? "#BBF7D0" : "#FDE68A"}`,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                <span style={{ fontWeight: 800, color: r.status === "ok" ? "#16A34A" : "#D97706", fontSize: 15 }}>
                  {r.status === "ok" ? "✓" : "⚠"}
                </span>
                <span style={{ fontWeight: 600, color: r.status === "ok" ? "#15803D" : "#92400E" }}>
                  {r.nom} × {r.quantite}
                </span>
              </div>
              {r.status === "introuvable" && (
                <div style={{ marginTop: 4, fontSize: 12, color: "#92400E", paddingLeft: 23 }}>
                  Ce medicament n'existe pas encore dans l'inventaire du destinataire — ajoutez-le manuellement
                </div>
              )}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            style={{ padding: "8px 20px", backgroundColor: colors.bgSurface, border: `1px solid ${colors.border}`, borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            Fermer
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Modifier le statut" onClose={onClose} width={480}>
      <Field label="Nouveau statut">
        <select style={selectStyle} value={statut} onChange={(e) => { setStatut(e.target.value); setStockWarn(null); }}>
          {Object.entries(statusStyle).filter(([key]) => key !== "annulee").map(([key, val]) => (
            <option key={key} value={key}>{val.label}</option>
          ))}
        </select>
      </Field>

      {statut === "livree" && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: colors.textMuted, marginBottom: 8, padding: "8px 12px", backgroundColor: colors.bgSurface, borderRadius: 8 }}>
            Le stock du destinataire sera incrémenté d'après le panier de cette livraison.
          </div>
          {lignes.length === 0 && (
            <div style={{ fontSize: 12, color: "#DC2626" }}>Aucun médicament enregistré pour cette livraison.</div>
          )}
          {lignes.map((l) => (
            <div key={l.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 13 }}>
              <span style={{ color: colors.navy, fontWeight: 600 }}>
                {l.medicament_nom}
                {l.disponible === false && <span style={{ marginLeft: 6, fontSize: 10, color: "#DC2626", fontWeight: 700 }}>EN RUPTURE</span>}
              </span>
              <span style={{ color: colors.textSecondary }}>× {l.quantite}</span>
            </div>
          ))}
          {stockWarn && (
            <div style={{ marginTop: 10, padding: "8px 12px", backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, fontSize: 12, color: "#DC2626" }}>
              {stockWarn}
            </div>
          )}
        </div>
      )}

      <ModalFooter onCancel={onClose} onSubmit={handleSave} submitLabel="Mettre à jour" saving={saving} />
    </Modal>
  );
}

// ── Modal Détail livraison livrée ─────────────────────────────────────────────
function DetailModal({ livraison, onClose }) {
  const lignes = (() => {
    try { return JSON.parse(livraison.lignes_livrees); } catch { return []; }
  })();
  return (
    <Modal title={`Detail — ${livraison.numero_suivi}`} onClose={onClose} width={480}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14, fontSize: 13 }}>
        <span style={{ color: colors.textSecondary }}>Date d'arrivee reelle</span>
        <span style={{ fontWeight: 600, color: colors.navy }}>{fmt(livraison.date_arrivee_reelle)}</span>
      </div>
      <div style={{ fontSize: 12, fontWeight: 700, color: colors.textSecondary, textTransform: "uppercase", marginBottom: 8 }}>
        Medicaments livres
      </div>
      {lignes.length === 0 && (
        <div style={{ fontSize: 13, color: colors.textMuted, padding: "12px 0" }}>Aucun detail disponible.</div>
      )}
      {lignes.map((l, i) => (
        <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border-light)", fontSize: 13 }}>
          <span style={{ fontWeight: 600, color: colors.navy }}>{l.nom}</span>
          <span style={{ color: colors.textSecondary }}>x {l.quantite}</span>
        </div>
      ))}
      <div style={{ marginTop: 12, fontSize: 13, color: colors.textSecondary }}>
        Quantite totale : <strong style={{ color: colors.navy }}>{livraison.quantite_livree ?? 0}</strong>
      </div>
      <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end" }}>
        <button
          onClick={onClose}
          style={{ padding: "8px 20px", backgroundColor: colors.bgSurface, border: `1px solid ${colors.border}`, borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          Fermer
        </button>
      </div>
    </Modal>
  );
}

export default function Livraisons() {
  const { auth } = useAuth();
  const [filter, setFilter] = useState("tous");
  const { data: livraisons, loading, error, total, page, setPage, totalPages, refetch } = useLivraisonsPaginated(filter);
  const { data: relations } = useDistributeurClients();
  const relationsById = Object.fromEntries(relations.map((r) => [r.id, r]));
  const { data: medicaments } = useMedicaments(auth?.etablissement_id);
  const { toasts, success, error: toastError } = useToast();
  const [showNouvelle, setShowNouvelle] = useState(false);
  const [editModal, setEditModal] = useState(null);
  const [statutModal, setStatutModal] = useState(null);
  const [detailModal, setDetailModal] = useState(null);
  const [tracabiliteModal, setTracabiliteModal] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const filtered = livraisons;

  const destNom = (l) => l.etablissements?.nom ?? relationsById[l.distributeur_clients_id]?.client?.nom ?? "—";
  const destVille = (l) => l.etablissements?.ville ?? relationsById[l.distributeur_clients_id]?.client?.ville ?? "";

  const handleAnnuler = async (l) => {
    if (!window.confirm(`Annuler la livraison ${l.numero_suivi} ? Le stock entrepôt sera restitué.`)) return;
    setBusyId(l.id);
    try {
      const res = await annulerLivraison(l.id, auth?.etablissement_id);
      if (res !== "ok") { toastError("Impossible d'annuler : " + res); return; }
      refetch();
      success("Livraison annulée, stock entrepôt restitué.");
    } catch (e) {
      toastError("Erreur : " + e.message);
    } finally {
      setBusyId(null);
    }
  };

  const handleSupprimer = async (l) => {
    if (!window.confirm(`Supprimer définitivement la livraison ${l.numero_suivi} ? Cette action est irréversible.`)) return;
    setBusyId(l.id);
    try {
      await deleteLivraison(l.id);
      refetch();
      success("Livraison supprimée.");
    } catch (e) {
      toastError("Erreur : " + e.message);
    } finally {
      setBusyId(null);
    }
  };

  // Revoir/réimprimer le bon de livraison depuis l'historique — même document
  // que celui joint à l'email d'origine, régénéré à la demande.
  const handleVoirBon = async (l) => {
    const etab = await fetchEtabFromAuth(auth);
    printBonLivraison({
      numeroSuivi: l.numero_suivi,
      destinataireNom: destNom(l),
      lignes: l.livraison_lignes ?? [],
      dateDepart: l.date_depart,
      etab,
    });
  };

  return (
    <Layout title="Livraisons" subtitle="Suivi des livraisons en temps réel">
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
      <Toast toasts={toasts} />

      {showNouvelle && (
        <NouvelleModal
          relations={relations}
          medicaments={medicaments}
          distributeurId={auth?.etablissement_id}
          distributeurNom={auth?.structure ?? "Votre Distributeur"}
          auth={auth}
          onClose={() => setShowNouvelle(false)}
          onSaved={() => { refetch(); success("Livraison créée avec succès"); }}
        />
      )}
      {editModal && (
        <EditModal
          livraison={editModal}
          medicaments={medicaments}
          distributeurId={auth?.etablissement_id}
          onClose={() => setEditModal(null)}
          onSaved={() => { refetch(); success("Livraison modifiée avec succès"); }}
        />
      )}
      {statutModal && (
        <StatutModal
          livraison={statutModal}
          onClose={() => setStatutModal(null)}
          onSaved={(newStatut) => {
            refetch();
            success(`Livraison mise à jour : ${statusStyle[newStatut]?.label ?? newStatut}`);
          }}
        />
      )}
      {detailModal && (
        <DetailModal livraison={detailModal} onClose={() => setDetailModal(null)} />
      )}
      {tracabiliteModal && (
        <TracabiliteModal livraison={tracabiliteModal} onClose={() => setTracabiliteModal(null)} />
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 16 }}>
          {[
            { label: "En transit",  value: loading ? "…" : livraisons.filter(l => l.statut === "en_transit").length,  color: "#3B82F6" },
            { label: "Livrées",     value: loading ? "…" : livraisons.filter(l => l.statut === "livree").length,       color: "#10B981" },
            { label: "Planifiées",  value: loading ? "…" : livraisons.filter(l => l.statut === "planifiee").length,    color: "#F59E0B" },
            { label: "Incidents",   value: loading ? "…" : livraisons.filter(l => l.statut === "incident").length,     color: "#EF4444" },
          ].map((k) => (
            <div key={k.label} style={{ backgroundColor: colors.bgCard, padding: "14px 18px", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", borderLeft: `4px solid ${k.color}` }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: k.color }}>{k.value}</div>
              <div style={{ fontSize: 11, color: colors.textSecondary }}>{k.label}</div>
            </div>
          ))}
        </div>
        <button
          onClick={() => setShowNouvelle(true)}
          style={{ padding: "9px 18px", backgroundColor: "#F59E0B", color: "white", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          + Nouvelle livraison
        </button>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {["tous", ...Object.keys(statusStyle)].map((f) => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", textTransform: "capitalize",
            border: filter === f ? "2px solid #F59E0B" : "1.5px solid var(--border)",
            backgroundColor: filter === f ? "#FFFBEB" : "white",
            color: filter === f ? "#D97706" : "#6B7280",
          }}>
            {f === "tous" ? "Toutes" : statusStyle[f]?.label ?? f}
          </button>
        ))}
      </div>

      {error && (
        <div style={{ backgroundColor: "#FEF2F2", padding: "14px 18px", borderRadius: 12, marginBottom: 16, fontSize: 13, color: "#DC2626" }}>
          Une erreur s'est produite. Veuillez réessayer.
        </div>
      )}

      <div style={{ backgroundColor: colors.bgCard, borderRadius: 14, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "hidden" }}>
        <div className="table-scroll"><table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ backgroundColor: colors.bgSurface }}>
              {["N° Suivi", "Destinataire", "Produits", "Transporteur", "Départ", "Statut", "Actions"].map((h) => (
                <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 700, color: colors.textSecondary, borderBottom: "1px solid var(--border)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && [1,2,3].map((i) => (
              <tr key={i} style={{ borderBottom: "1px solid var(--border-light)", animation: "pulse 1.5s ease-in-out infinite" }}>
                {[120,160,120,80,90,80,100].map((w, j) => (
                  <td key={j} style={{ padding: "14px 16px" }}><div style={{ height: 13, width: w, backgroundColor: colors.borderLight, borderRadius: 6 }} /></td>
                ))}
              </tr>
            ))}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={7} style={{ padding: 40, textAlign: "center", color: colors.textMuted, fontSize: 13 }}>Aucune livraison trouvée</td></tr>
            )}
            {!loading && filtered.map((l) => {
              const s = statusStyle[l.statut] ?? statusStyle.planifiee;
              const lignes = l.livraison_lignes ?? [];
              const modifiable = !["livree", "annulee"].includes(l.statut);
              return (
                <tr key={l.id} style={{ borderBottom: "1px solid var(--border-light)" }}>
                  <td style={{ padding: "14px 16px", fontFamily: "monospace", color: colors.textSecondary, fontSize: 12 }}>{l.numero_suivi ?? "—"}</td>
                  <td style={{ padding: "14px 16px", fontWeight: 600, color: colors.navy }}>
                    {destNom(l)}
                    {destVille(l) && <div style={{ fontSize: 11, color: colors.textMuted }}>{destVille(l)}</div>}
                    {l.email_statut === "envoye" && <div style={{ fontSize: 10, color: "#16A34A", fontWeight: 700 }}>Bon envoyé par email</div>}
                    {l.email_statut === "echec" && <div style={{ fontSize: 10, color: "#DC2626", fontWeight: 700 }} title={l.email_erreur ?? ""}>Échec envoi email</div>}
                  </td>
                  <td style={{ padding: "14px 16px", color: colors.textSecondary, fontSize: 12 }} title={lignes.map(x => `${x.medicament_nom} ×${x.quantite}`).join(", ")}>
                    {lignes.length === 0 ? "—" : `${lignes.length} produit${lignes.length > 1 ? "s" : ""}`}
                    {lignes.some((x) => x.disponible === false) && (
                      <div style={{ color: "#DC2626", fontWeight: 700, fontSize: 10 }}>rupture signalée</div>
                    )}
                  </td>
                  <td style={{ padding: "14px 16px", color: colors.textSecondary }}>{l.transporteur ?? "—"}</td>
                  <td style={{ padding: "14px 16px", color: colors.textSecondary, fontSize: 12 }}>{fmt(l.date_depart)}</td>
                  <td style={{ padding: "14px 16px" }}>
                    <span style={{ padding: "3px 10px", backgroundColor: s.bg, color: s.color, borderRadius: 10, fontSize: 11, fontWeight: 700 }}>{s.label}</span>
                  </td>
                  <td style={{ padding: "14px 16px" }}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {modifiable && (
                        <button onClick={() => setEditModal(l)} style={{ padding: "4px 10px", backgroundColor: "#FFFBEB", color: "#D97706", border: "none", borderRadius: 6, fontSize: 11, cursor: "pointer", fontWeight: 600 }}>
                          Modifier
                        </button>
                      )}
                      {modifiable && (
                        <button onClick={() => setStatutModal(l)} style={{ padding: "4px 10px", backgroundColor: "#EFF6FF", color: "#2563EB", border: "none", borderRadius: 6, fontSize: 11, cursor: "pointer", fontWeight: 600 }}>
                          Statut
                        </button>
                      )}
                      {l.statut === "livree" && (
                        <button onClick={() => setDetailModal(l)} style={{ padding: "4px 10px", backgroundColor: "#DCFCE7", color: "#16A34A", border: "none", borderRadius: 6, fontSize: 11, cursor: "pointer", fontWeight: 600 }}>
                          Détail
                        </button>
                      )}
                      {lignes.length > 0 && (
                        <button onClick={() => setTracabiliteModal(l)} style={{ padding: "4px 10px", backgroundColor: colors.bgSurface, color: colors.text, border: "1px solid var(--border)", borderRadius: 6, fontSize: 11, cursor: "pointer", fontWeight: 600 }}>
                          Traçabilité
                        </button>
                      )}
                      {lignes.length > 0 && (
                        <button onClick={() => handleVoirBon(l)} style={{ padding: "4px 10px", backgroundColor: colors.bgSurface, color: colors.text, border: "1px solid var(--border)", borderRadius: 6, fontSize: 11, cursor: "pointer", fontWeight: 600 }}>
                          Bon de livraison
                        </button>
                      )}
                      {modifiable && (
                        <button onClick={() => handleAnnuler(l)} disabled={busyId === l.id} style={{ padding: "4px 10px", backgroundColor: "#FEF2F2", color: "#DC2626", border: "none", borderRadius: 6, fontSize: 11, cursor: busyId === l.id ? "wait" : "pointer", fontWeight: 600 }}>
                          Annuler
                        </button>
                      )}
                      {l.statut === "planifiee" && (
                        <button onClick={() => handleSupprimer(l)} disabled={busyId === l.id} style={{ padding: "4px 10px", backgroundColor: "transparent", color: "#9CA3AF", border: "1px solid var(--border)", borderRadius: 6, fontSize: 11, cursor: busyId === l.id ? "wait" : "pointer", fontWeight: 600 }}>
                          Supprimer
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table></div>
        <Pagination page={page} totalPages={totalPages} total={total} onPage={setPage} />
      </div>
    </Layout>
  );
}
