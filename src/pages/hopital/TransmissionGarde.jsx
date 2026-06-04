import { colors } from "../../theme";
import { useState, useEffect, useCallback } from "react";
import { SERVICES_HOPITAL } from "../../constants/hopital";
import Layout from "../../components/Layout";
import Toast from "../../components/Toast";
import { useToast } from "../../hooks/useToast";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../supabaseClient";
import { insertTransmissionGarde, fetchLitsOccupes } from "../../hooks/useMutations";
import { openDocument, tableHTML, infoGridHTML, signatureRowHTML, fetchEtabFromAuth } from "../../utils/MedOSDocument";

const ACCENT = "#10B981";

function fmtDate(iso) { if (!iso) return "—"; return new Date(iso).toLocaleDateString("fr-FR"); }

export default function TransmissionGarde() {
  const { auth } = useAuth();
  const { toasts, success } = useToast();
  const [etabId, setEtabId]               = useState(auth?.etablissement_id ?? null);
  const [membres, setMembres]             = useState([]);
  const [litsOccupes, setLitsOccupes]     = useState([]);
  const [loading, setLoading]             = useState(true);
  const [saving, setSaving]               = useState(false);
  const [messageGeneral, setMessageGeneral] = useState("");
  const [medecinEntrant, setMedecinEntrant] = useState("");
  const [service, setService]             = useState("");
  const [signalements, setSignalements]   = useState({});
  // { patient_id: { selected: bool, message: string } }

  useEffect(() => {
    const resolve = async () => {
      let eid = auth?.etablissement_id;
      if (!eid && auth?.user?.email) {
        const { data } = await supabase.from("etablissements").select("id").eq("email", auth.user.email).maybeSingle();
        eid = data?.id ?? null;
      }
      if (!eid && auth?.user?.email) {
        const { data } = await supabase.from("membres_personnel").select("etablissement_id").eq("email", auth.user.email).eq("actif", true).maybeSingle();
        eid = data?.etablissement_id ?? null;
      }
      if (eid) setEtabId(eid);
    };
    resolve();
  }, [auth]);

  const load = useCallback(async () => {
    if (!etabId) return;
    setLoading(true);
    const [lits, mems] = await Promise.all([
      fetchLitsOccupes(etabId),
      supabase.from("membres_personnel").select("email, prenom, nom, role_interne")
        .eq("etablissement_id", etabId).eq("actif", true).eq("role_interne", "Médecin"),
    ]);
    setLitsOccupes(lits);
    setMembres(mems.data ?? []);
    setLoading(false);
  }, [etabId]);

  useEffect(() => { load(); }, [load]);

  const patientsAffiches = service
    ? litsOccupes.filter((h) => h.service === service)
    : litsOccupes;

  const toggleSignalement = (id) => {
    setSignalements((prev) => ({
      ...prev,
      [id]: { selected: !prev[id]?.selected, message: prev[id]?.message ?? "" },
    }));
  };

  const setMessage = (id, msg) => {
    setSignalements((prev) => ({ ...prev, [id]: { ...prev[id], message: msg } }));
  };

  const handleValider = async () => {
    if (!etabId) return;
    setSaving(true);
    try {
      const patientsSignales = Object.entries(signalements)
        .filter(([, v]) => v.selected)
        .map(([patient_id, v]) => {
          const h = litsOccupes.find((x) => (x.patient_id ?? x.id) === patient_id) ?? {};
          return {
            patient_id,
            nom: h.patients ? `${h.patients.prenom} ${h.patients.nom}` : "—",
            lit: h.lit ?? "?",
            chambre: h.chambre ?? "?",
            service: h.service ?? service ?? "—",
            message: v.message,
          };
        });

      await insertTransmissionGarde({
        etablissement_id: etabId,
        medecin_sortant: auth?.user?.email ?? "",
        medecin_entrant: medecinEntrant || null,
        service: service || null,
        message_general: messageGeneral || null,
        patients_critiques: patientsSignales,
      });

      const etab = await fetchEtabFromAuth(auth);
      openDocument({
        titre: "Fiche de transmission de garde",
        sousTitre: `${new Date().toLocaleDateString("fr-FR")} ${new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`,
        etablissement: etab,
        sections: [
          {
            titre: "Informations de transmission",
            html: infoGridHTML([
              { label: "Medecin sortant", value: auth?.user?.email ?? "—" },
              { label: "Medecin entrant", value: medecinEntrant || "A determiner" },
              { label: "Service",         value: service || "Tous services" },
              { label: "Date/Heure",      value: new Date().toLocaleString("fr-FR") },
            ]),
          },
          {
            titre: "Message general",
            html: `<p style="font-size:13px;line-height:1.6">${messageGeneral || "Aucun message particulier."}</p>`,
          },
          ...(patientsSignales.length > 0 ? [{
            titre: "Patients a surveiller",
            html: tableHTML(
              ["Patient", "Lit / Ch.", "Service", "Consignes de surveillance"],
              patientsSignales.map((s) => [s.nom, `${s.lit} / ${s.chambre}`, s.service, s.message || "—"]),
            ),
          }] : []),
          { titre: "", html: signatureRowHTML(["Medecin sortant", "Medecin entrant"]) },
        ],
      });

      success("Transmission enregistree et imprimee");
      setMessageGeneral("");
      setMedecinEntrant("");
      setSignalements({});
    } catch (e) {
      alert("Erreur : " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const nbSignales = Object.values(signalements).filter((v) => v.selected).length;

  const inputSt  = { width: "100%", padding: "9px 12px", border: `1.5px solid ${colors.border}`, borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box", color: colors.navy, backgroundColor: colors.bgCard };
  const labelSt  = { fontSize: 12, fontWeight: 600, color: colors.text, display: "block", marginBottom: 5 };
  const sectionSt = { backgroundColor: colors.bgCard, borderRadius: 14, padding: 24, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginBottom: 16 };
  const sectionTitle = (t) => <h3 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 700, color: colors.navy, paddingBottom: 10, borderBottom: `2px solid ${ACCENT}` }}>{t}</h3>;

  return (
    <Layout title="Transmission de garde" subtitle={`${new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })} — Passation de service`}>
      <Toast toasts={toasts} />

      {/* Section 1 — Message général */}
      <div style={sectionSt}>
        {sectionTitle("Message general du service")}
        <div style={{ marginBottom: 14 }}>
          <label style={labelSt}>Service (optionnel)</label>
          <select style={{ ...inputSt, maxWidth: 280 }} value={service} onChange={(e) => setService(e.target.value)}>
            <option value="">Tous les services</option>
            {SERVICES_HOPITAL.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <label style={labelSt}>Informations generales a transmettre</label>
        <textarea
          style={{ ...inputSt, resize: "vertical", minHeight: 90 }}
          value={messageGeneral}
          onChange={(e) => setMessageGeneral(e.target.value)}
          placeholder="Ex: Generateur en panne salle 3, eviter les appareils dependants secteur. Shortage de solutions de perfusion — contacter pharmacie."
        />
      </div>

      {/* Section 2 — Patients à signaler */}
      <div style={sectionSt}>
        {sectionTitle(`Patients a surveiller (${nbSignales} selectionne${nbSignales > 1 ? "s" : ""})`)}
        {loading && <div style={{ textAlign: "center", color: colors.textMuted, padding: 24 }}>Chargement des patients hospitalises...</div>}
        {!loading && patientsAffiches.length === 0 && (
          <div style={{ textAlign: "center", color: colors.textMuted, padding: 24, fontSize: 13 }}>
            Aucun patient hospitalise{service ? ` en ${service}` : ""}.
          </div>
        )}
        {!loading && patientsAffiches.map((h) => {
          const pid  = h.patient_id ?? h.id;
          const nom  = h.patients ? `${h.patients.prenom} ${h.patients.nom}` : "Patient";
          const sel  = !!signalements[pid]?.selected;
          const msg  = signalements[pid]?.message ?? "";
          return (
            <div key={pid} style={{ borderRadius: 10, border: `1.5px solid ${sel ? ACCENT : colors.border}`, backgroundColor: sel ? "#F0FDF4" : colors.bgSurface, padding: "12px 14px", marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: sel ? 10 : 0 }}>
                <div
                  onClick={() => toggleSignalement(pid)}
                  style={{ width: 20, height: 20, borderRadius: 5, border: `2px solid ${sel ? ACCENT : colors.border}`, backgroundColor: sel ? ACCENT : "white", flexShrink: 0, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                >
                  {sel && <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: colors.navy }}>{nom}</div>
                  <div style={{ fontSize: 11, color: colors.textMuted }}>
                    Lit {h.lit ?? "?"} — Ch. {h.chambre ?? "?"} — {h.service ?? "—"}
                    {h.date_sortie_prevue ? ` — Sortie prevue : ${fmtDate(h.date_sortie_prevue)}` : ""}
                  </div>
                </div>
              </div>
              {sel && (
                <textarea
                  style={{ ...inputSt, resize: "vertical", minHeight: 60, fontSize: 12 }}
                  value={msg}
                  onChange={(e) => setMessage(pid, e.target.value)}
                  placeholder="Consignes de surveillance : ex. Surveiller TA toutes les 2h. Sous Nicardipine IVSE 4mg/h. Bilan renal demain matin."
                  autoFocus
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Section 3 — Médecin entrant */}
      <div style={sectionSt}>
        {sectionTitle("Medecin entrant")}
        {membres.length > 0 ? (
          <div>
            <label style={labelSt}>Selectionner le medecin de releve</label>
            <select style={{ ...inputSt, maxWidth: 380 }} value={medecinEntrant} onChange={(e) => setMedecinEntrant(e.target.value)}>
              <option value="">-- A determiner --</option>
              {membres.map((m) => <option key={m.email} value={m.email}>{m.prenom ?? ""} {m.nom ?? ""} ({m.email})</option>)}
            </select>
          </div>
        ) : (
          <div>
            <label style={labelSt}>Email ou nom du medecin entrant</label>
            <input style={{ ...inputSt, maxWidth: 380 }} value={medecinEntrant} onChange={(e) => setMedecinEntrant(e.target.value)} placeholder="dr.dupont@hopital.com" />
          </div>
        )}
      </div>

      {/* Bouton valider */}
      <button
        onClick={handleValider}
        disabled={saving}
        style={{ width: "100%", padding: "14px 20px", backgroundColor: saving ? "#D1D5DB" : ACCENT, color: "white", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: saving ? "wait" : "pointer" }}
      >
        {saving ? "Enregistrement en cours..." : `Valider et imprimer la fiche de transmission (${nbSignales} patient${nbSignales > 1 ? "s" : ""})`}
      </button>
    </Layout>
  );
}
