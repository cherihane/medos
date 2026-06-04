import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../../components/Layout";
import KpiCard from "../../components/KpiCard";
import PredictionsIA from "../../components/PredictionsIA";
import { useAlertes, useKpiHopital, usePatients } from "../../hooks/useSupabaseData";
import { supabase } from "../../supabaseClient";
import { colors, radius, shadow, font } from "../../theme";
import { useAuth } from "../../context/AuthContext";
import { fetchLitsOccupes, fetchDerniereTransmission } from "../../hooks/useMutations";

function useTendanceHopital() {
  const [hier, setHier] = useState(null);
  useEffect(() => {
    const today = new Date();
    const hierDebut = new Date(today); hierDebut.setDate(hierDebut.getDate() - 1); hierDebut.setHours(0,0,0,0);
    const hierFin   = new Date(today); hierFin.setDate(hierFin.getDate() - 1); hierFin.setHours(23,59,59,999);
    Promise.all([
      supabase.from("alertes").select("id, severite").eq("resolu", false).gte("created_at", hierDebut.toISOString()).lte("created_at", hierFin.toISOString()),
      supabase.from("ordonnances").select("id").gte("created_at", hierDebut.toISOString()).lte("created_at", hierFin.toISOString()),
    ]).then(([alts, ords]) => {
      setHier({
        alertesHier: (alts.data ?? []).filter((a) => a.severite === "critique").length,
        ordonnancesHier: ords.data?.length ?? 0,
      });
    });
  }, []);
  return hier;
}

function fmtChange(now, prev) {
  if (prev == null || prev === 0) return null;
  const pct = Math.round(((now - prev) / prev) * 100);
  return pct > 0 ? `+${pct}%` : `${pct}%`;
}


function severiteStyle(severite) {
  switch (severite) {
    case "critique": return { bg: "#FEF2F2", border: "#EF4444" };
    case "alerte":   return { bg: "#FFFBEB", border: "#F59E0B" };
    default:         return { bg: "#EFF6FF", border: "#3B82F6" };
  }
}

function Skeleton({ height = 16, width = "100%", mb = 8 }) {
  return (
    <div style={{
      height, width, backgroundColor: colors.borderLight, borderRadius: 6, marginBottom: mb,
      animation: "pulse 1.5s ease-in-out infinite",
    }} />
  );
}

// ── KPI depuis Supabase ───────────────────────────────────────────────────────
function KpiSection() {
  const { data: live, loading } = useKpiHopital();
  const hier = useTendanceHopital();
  const navigate = useNavigate();

  const kpis = [
    { label: "Patients hospitalisés",  value: live?.patientsHospitalises ?? 0, color: "#3B82F6", to: "/hopital/patients",   change: null },
    { label: "Alertes critiques",      value: live?.alertesCritiques ?? 0,     color: "#EF4444", to: "/hopital/alertes",    change: hier ? fmtChange(live?.alertesCritiques ?? 0, hier.alertesHier) : null },
    { label: "Médicaments dispensés",  value: live?.medicamentsDispenses ?? 0, color: "#10B981", to: "/hopital/stock",      change: null },
    { label: "Ordonnances",            value: live?.ordonnancesTotal ?? 0,     color: "#8B5CF6", to: "/hopital/patients",   change: hier ? fmtChange(live?.ordonnancesTotal ?? 0, hier.ordonnancesHier) : null },
  ];

  if (loading) {
    return (
      <div className="kpi-row">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} style={{ flex: 1, backgroundColor: colors.bgCard, borderRadius: 14, padding: "20px 24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <Skeleton height={36} width={36} mb={12} />
            <Skeleton height={28} width="60%" mb={8} />
            <Skeleton height={14} width="80%" mb={0} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="kpi-row">
      {kpis.map((k) => (
        <div
          key={k.label}
          onClick={() => navigate(k.to)}
          style={{
            backgroundColor: colors.bgCard, borderRadius: 14, padding: "20px 24px",
            boxShadow: "0 1px 4px rgba(0,0,0,0.06)", flex: 1,
            borderLeft: `4px solid ${k.color}`,
            cursor: "pointer",
          }}
          onMouseEnter={(e) => e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.1)"}
          onMouseLeave={(e) => e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,0.06)"}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: k.color }}>{k.value}</div>
            {k.change && (
              <span style={{
                fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 20,
                backgroundColor: k.change.startsWith("-") ? "#FEE2E2" : "#DCFCE7",
                color: k.change.startsWith("-") ? "#DC2626" : "#16A34A",
              }}>{k.change}</span>
            )}
          </div>
          <div style={{ fontSize: 12, color: colors.textSecondary }}>{k.label}</div>
        </div>
      ))}
    </div>
  );
}

// ── Panneau alertes (données Supabase) ────────────────────────────────────────
function AlertesPanel() {
  const { data, loading, error } = useAlertes(8);

  const alertes = data;
  const isLive  = !loading && !error && data.length > 0;

  return (
    <div style={{ backgroundColor: colors.bgCard, borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: colors.navy }}>Alertes actives</h3>
        <span style={{
          fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 10,
          backgroundColor: isLive ? "#DCFCE7" : "#F3F4F6",
          color: isLive ? "#16A34A" : "#9CA3AF",
        }}>
          {isLive ? "TEMPS RÉEL" : "STATIQUE"}
        </span>
      </div>

      {loading && [1,2,3].map((i) => <Skeleton key={i} height={44} mb={8} />)}

      {!loading && alertes.length === 0 && (
        <div style={{ fontSize: 13, color: colors.textMuted, textAlign: "center", padding: "20px 0" }}>
          Aucune alerte active
        </div>
      )}

      {!loading && alertes.map((a, i) => {
        const { bg, border } = severiteStyle(a.severite);
        return (
          <div key={a.id || i} style={{
            display: "flex", flexDirection: "column", padding: "11px 14px",
            borderRadius: 10, marginBottom: 8, backgroundColor: bg,
            borderLeft: `4px solid ${border}`,
          }}>
            <span style={{ fontSize: 13, color: colors.text, fontWeight: 500 }}>{a.titre}</span>
            {a.message && a.message !== a.titre && (
              <span style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>{a.message}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Panneau patients récents ──────────────────────────────────────────────────
function PatientsPanel() {
  const { data, loading } = usePatients();

  const recent = data.slice(0, 5);

  return (
    <div style={{ backgroundColor: colors.bgCard, borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: colors.navy }}>Patients enregistrés</h3>
        {!loading && (
          <span style={{ fontSize: 12, color: colors.textSecondary }}>{data.length} total</span>
        )}
      </div>

      {loading && [1,2,3].map((i) => <Skeleton key={i} height={40} mb={8} />)}

      {!loading && recent.length === 0 && (
        <div style={{ fontSize: 12, color: colors.textMuted, textAlign: "center", padding: "20px 0" }}>
          Aucun patient enregistré
        </div>
      )}

      {!loading && recent.length > 0 && (
        <div>
          {recent.map((p) => (
            <div key={p.id} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "10px 0", borderBottom: "1px solid var(--border-light)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: "50%",
                  backgroundColor: "#EFF6FF",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 13, fontWeight: 700, color: "#3B82F6",
                }}>
                  {p.prenom?.[0]}{p.nom?.[0]}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: colors.navy }}>
                    {p.prenom} {p.nom}
                  </div>
                  <div style={{ fontSize: 11, color: colors.textMuted }}>
                    {p.antecedents?.length > 0 ? p.antecedents.join(", ") : "Aucun antécédent"}
                  </div>
                </div>
              </div>
              <span style={{
                fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 8,
                backgroundColor: colors.borderLight, color: colors.textSecondary,
              }}>
                {p.groupe_sanguin || "—"}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Lits occupes */}
      <h3 style={{ margin: "20px 0 10px", fontSize: 14, fontWeight: 700, color: colors.navy }}>Lits occupes</h3>
      <LitsOccupesPanel />
    </div>
  );
}

// ── Panneau lits occupes ──────────────────────────────────────────────────────
function LitsOccupesPanel() {
  const { auth } = useAuth();
  const [lits, setLits] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLitsOccupes(auth?.etablissement_id).then((data) => { setLits(data); setLoading(false); });
  }, [auth?.etablissement_id]); // eslint-disable-line

  if (loading) return <div style={{ height: 60, backgroundColor: colors.borderLight, borderRadius: 8, animation: "pulse 1.5s ease-in-out infinite" }} />;
  if (lits.length === 0) return <div style={{ fontSize: 12, color: colors.textMuted, textAlign: "center", padding: "12px 0" }}>Aucun patient hospitalise actuellement</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {lits.slice(0, 6).map((h) => (
        <div key={h.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", backgroundColor: "#FEF2F2", borderRadius: 8, borderLeft: "3px solid #EF4444" }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: colors.navy }}>{h.patients?.prenom} {h.patients?.nom}</div>
            <div style={{ fontSize: 11, color: colors.textSecondary }}>{h.service ?? "—"}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#DC2626" }}>Lit {h.lit ?? "?"} — Ch. {h.chambre ?? "?"}</div>
            <div style={{ fontSize: 10, color: colors.textMuted }}>Sortie: {h.date_sortie_prevue ? new Date(h.date_sortie_prevue).toLocaleDateString("fr-FR") : "—"}</div>
          </div>
        </div>
      ))}
      {lits.length > 6 && <div style={{ fontSize: 11, color: colors.textMuted, textAlign: "center" }}>+{lits.length - 6} autres patients hospitalises</div>}
    </div>
  );
}

// ── Dashboard role-specific ───────────────────────────────────────────────────
function KpiRoleCard({ label, value, color, sublabel }) {
  return (
    <div style={{ backgroundColor: colors.bgCard, borderRadius: 12, padding: "18px 20px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", borderTop: `3px solid ${color}`, flex: 1, minWidth: 160 }}>
      <div style={{ fontSize: 28, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 13, color: colors.text, marginTop: 4 }}>{label}</div>
      {sublabel && <div style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>{sublabel}</div>}
    </div>
  );
}

const ACCENT = "#10B981";

function DashboardRole({ ri }) {
  const { auth } = useAuth();
  const navigate = useNavigate();
  const [kpis, setKpis] = useState([]);
  const [shortcut, setShortcut] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rdvJourDetail, setRdvJourDetail]     = useState([]);
  const [patientsRecents, setPatientsRecents] = useState([]);
  const [fileMedecin, setFileMedecin]         = useState([]);
  const [examensDispos, setExamensDispos]     = useState([]);
  const [transmission, setTransmission]       = useState(null);
  const todayISO = new Date().toISOString().slice(0, 10);
  const debutJour = todayISO + "T00:00:00.000Z";
  const finJour   = todayISO + "T23:59:59.999Z";

  useEffect(() => {
    const eid = auth?.etablissement_id;
    const email = auth?.user?.email ?? "";
    if (!eid) { setLoading(false); return; }

    const load = async () => {
      setLoading(true);
      try {
        if (ri === "Médecin") {
          const emailPrefix = email.split("@")[0];
          const today = todayISO;
          const dans3j = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
          const [cAttenteRes, hRes, eDispoRes, ordRenouv, fileRes, trans] = await Promise.all([
            supabase.from("consultations").select("id", { count: "exact", head: true }).eq("etablissement_id", eid).eq("statut", "en_attente").gte("heure_arrivee", debutJour),
            supabase.from("hospitalisations").select("id", { count: "exact", head: true }).eq("etablissement_id", eid).eq("statut", "hospitalise"),
            supabase.from("examens").select("id, type_examen, interpretation, patients(prenom, nom)").eq("etablissement_id", eid).eq("statut", "resultat_disponible").ilike("prescripteur", `%${emailPrefix}%`).limit(5),
            supabase.from("ordonnances").select("id", { count: "exact", head: true }).eq("etablissement_id", eid).lte("date_expiration", dans3j).gte("date_expiration", today),
            supabase.from("consultations").select("id, triage, patients(prenom, nom)").eq("etablissement_id", eid).eq("statut", "en_attente").gte("heure_arrivee", debutJour).order("heure_arrivee").limit(5),
            fetchDerniereTransmission(eid, null),
          ]);
          setKpis([
            { label: "Patients en attente",     value: cAttenteRes.count ?? 0, color: "#F59E0B" },
            { label: "Resultats disponibles",   value: eDispoRes.data?.length ?? 0, color: (eDispoRes.data?.length ?? 0) > 0 ? "#EF4444" : "#9CA3AF" },
            { label: "Patients hospitalises",   value: hRes.count ?? 0,         color: "#3B82F6" },
            { label: "Ordonnances a renouveler",value: ordRenouv.count ?? 0,    color: "#8B5CF6" },
          ]);
          setShortcut({ label: "Commencer les consultations", path: "/hopital/mes-consultations" });
          setFileMedecin(fileRes.data ?? []);
          setExamensDispos(eDispoRes.data ?? []);
          setTransmission(trans);

        } else if (ri === "Infirmière") {
          const seuil6h = new Date(Date.now() - 6 * 3600 * 1000).toISOString();
          const [hRes, cRes, aRes, lRes] = await Promise.all([
            supabase.from("hospitalisations").select("patient_id").eq("etablissement_id", eid).eq("statut", "hospitalise"),
            supabase.from("consultations").select("id").eq("etablissement_id", eid).gte("heure_arrivee", debutJour).eq("statut", "en_attente"),
            supabase.from("alertes").select("id").eq("resolu", false),
            supabase.from("constantes_vitales").select("patient_id").gte("created_at", seuil6h),
          ]);
          const hospitalises = hRes.data ?? [];
          const constRecents = new Set((lRes.data ?? []).map((c) => c.patient_id));
          const manquantes   = hospitalises.filter((h) => !constRecents.has(h.patient_id)).length;
          setKpis([
            { label: "Patients hospitalises",   value: hospitalises.length,      color: "#EF4444" },
            { label: "Constantes manquantes",   value: manquantes,               color: manquantes > 0 ? "#EF4444" : "#9CA3AF" },
            { label: "Consultations en attente",value: cRes.data?.length ?? 0,   color: "#F59E0B" },
            { label: "Alertes non resolues",    value: aRes.data?.length ?? 0,   color: "#8B5CF6" },
          ]);
          setShortcut({ label: "Aller a mon service", path: "/hopital/mon-service" });

        } else if (ri === "Secrétaire médicale") {
          const [cRes, rdvRes, pRes, fRes, rdvDetailRes, pRecentRes] = await Promise.all([
            supabase.from("consultations").select("id", { count: "exact", head: true }).eq("etablissement_id", eid).eq("statut", "en_attente"),
            supabase.from("consultations").select("id", { count: "exact", head: true }).eq("etablissement_id", eid).eq("type", "rdv").eq("date_rdv", todayISO),
            supabase.from("patients").select("id", { count: "exact", head: true }).eq("etablissement_id", eid).gte("created_at", debutJour).lte("created_at", finJour),
            supabase.from("factures_hopital").select("id", { count: "exact", head: true }).eq("etablissement_id", eid).eq("statut", "emise"),
            supabase.from("consultations").select("id, heure_rdv, service, medecin_nom, patients(prenom, nom)").eq("etablissement_id", eid).eq("type", "rdv").eq("date_rdv", todayISO).order("heure_rdv"),
            supabase.from("patients").select("id, prenom, nom, numero_dossier, created_at").eq("etablissement_id", eid).order("created_at", { ascending: false }).limit(5),
          ]);
          setKpis([
            { label: "En salle d'attente",      value: cRes.count ?? 0,         color: "#F59E0B" },
            { label: "RDV d'aujourd'hui",        value: rdvRes.count ?? 0,       color: "#3B82F6" },
            { label: "Nouveaux patients auj.",   value: pRes.count ?? 0,         color: ACCENT },
            { label: "Factures en attente",      value: fRes.count ?? 0,         color: "#EF4444" },
          ]);
          setShortcut({ label: "Enregistrer une arrivee", path: "/hopital/consultations" });
          setRdvJourDetail(rdvDetailRes.data ?? []);
          setPatientsRecents(pRecentRes.data ?? []);

        } else if (ri === "Laborantin") {
          const [eRes, eResAuj, eUrgRes] = await Promise.all([
            supabase.from("examens").select("id").eq("etablissement_id", eid).in("statut", ["prescrit", "en_cours"]),
            supabase.from("examens").select("id").eq("etablissement_id", eid).eq("statut", "resultat_disponible").gte("updated_at", debutJour).lte("updated_at", finJour),
            supabase.from("examens").select("id").eq("etablissement_id", eid).eq("urgence", true).neq("statut", "resultat_disponible"),
          ]);
          setKpis([
            { label: "Examens a traiter",          value: eRes.data?.length ?? 0,    color: "#3B82F6" },
            { label: "Resultats saisis auj.",       value: eResAuj.data?.length ?? 0, color: "#10B981" },
            { label: "Urgents en attente",          value: eUrgRes.data?.length ?? 0, color: eUrgRes.data?.length > 0 ? "#EF4444" : "#9CA3AF" },
            { label: "Total en base",               value: (eRes.data?.length ?? 0) + (eResAuj.data?.length ?? 0), color: "#8B5CF6" },
          ]);
          setShortcut({ label: "Traiter les examens", path: "/hopital/examens" });

        } else if (ri === "Caissier") {
          const [fERes, fPRes] = await Promise.all([
            supabase.from("factures_hopital").select("id, reste_patient").eq("etablissement_id", eid).eq("statut", "emise"),
            supabase.from("factures_hopital").select("id, reste_patient").eq("etablissement_id", eid).eq("statut", "payee").gte("date_paiement", debutJour).lte("date_paiement", finJour),
          ]);
          const facEmises = fERes.data ?? [];
          const facPayees = fPRes.data ?? [];
          const montantAttente  = facEmises.reduce((s, f) => s + (f.reste_patient ?? 0), 0);
          const montantEncaisse = facPayees.reduce((s, f) => s + (f.reste_patient ?? 0), 0);
          setKpis([
            { label: "Factures en attente",    value: facEmises.length,                    color: "#EF4444" },
            { label: "Montant en attente",     value: `${Math.round(montantAttente / 1000)}K FCFA`, color: "#F59E0B" },
            { label: "Encaisse aujourd'hui",   value: `${Math.round(montantEncaisse / 1000)}K FCFA`, color: "#10B981" },
            { label: "Transactions auj.",      value: facPayees.length,                    color: "#3B82F6" },
          ]);
          setShortcut({ label: "Ouvrir la caisse", path: "/hopital/caisse" });

        } else if (ri === "Pharmacien hospitalier") {
          const [mRes, oRes] = await Promise.all([
            supabase.from("medicaments").select("id, stock_actuel, stock_minimum, prix_unitaire"),
            supabase.from("ordonnances").select("id").eq("etablissement_id", eid).eq("statut", "en_attente"),
          ]);
          const meds = mRes.data ?? [];
          const ruptures = meds.filter((m) => (m.stock_actuel ?? 0) === 0).length;
          const alertes  = meds.filter((m) => (m.stock_actuel ?? 0) > 0 && (m.stock_actuel ?? 0) <= (m.stock_minimum ?? 0)).length;
          const valeur   = meds.reduce((s, m) => s + (m.stock_actuel ?? 0) * (m.prix_unitaire ?? 0), 0);
          setKpis([
            { label: "Medicaments en rupture", value: ruptures,                           color: ruptures > 0 ? "#EF4444" : "#9CA3AF" },
            { label: "Sous le seuil",          value: alertes,                            color: alertes > 0 ? "#F59E0B" : "#9CA3AF" },
            { label: "Ordonnances a dispenser",value: oRes.data?.length ?? 0,             color: "#3B82F6" },
            { label: "Valeur du stock",        value: `${Math.round(valeur / 1000)}K FCFA`, color: "#8B5CF6" },
          ]);
          setShortcut({ label: "Voir le stock", path: "/hopital/stock" });
        }
      } finally { setLoading(false); }
    };
    load();
  }, [auth?.etablissement_id, ri]); // eslint-disable-line

  if (!kpis.length && !loading) return null;

  const isSecretaire = ri === "Secrétaire médicale";
  const isMedecin    = ri === "Médecin";

  return (
    <div style={{ marginBottom: 24 }}>
      <div className="kpi-row" style={{ marginBottom: 16 }}>
        {loading ? [1,2,3,4].map((i) => (
          <div key={i} style={{ flex: 1, backgroundColor: colors.bgCard, borderRadius: 12, padding: "18px 20px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <div style={{ height: 28, width: "60%", backgroundColor: colors.borderLight, borderRadius: 6, marginBottom: 8 }} />
            <div style={{ height: 14, width: "80%", backgroundColor: colors.borderLight, borderRadius: 6 }} />
          </div>
        )) : kpis.map((k) => <KpiRoleCard key={k.label} {...k} />)}
      </div>

      {/* Alerte transmission de garde */}
      {isMedecin && !loading && transmission && (
        <div style={{ padding: "12px 16px", backgroundColor: "#FFFBEB", border: "1.5px solid #F59E0B", borderRadius: 10, marginBottom: 16, fontSize: 13 }}>
          <strong style={{ color: "#92400E" }}>Transmission de garde recue</strong>
          <span style={{ color: "#6B7280", marginLeft: 8, fontSize: 12 }}>
            de {transmission.medecin_sortant} — {new Date(transmission.date_transmission).toLocaleString("fr-FR")}
          </span>
          {transmission.message_general && (
            <div style={{ marginTop: 6, color: "#78350F", fontSize: 12 }}>{transmission.message_general}</div>
          )}
        </div>
      )}

      {/* Dashboard enrichi médecin */}
      {isMedecin && !loading && (fileMedecin.length > 0 || examensDispos.length > 0) && (
        <div className="dash-grid-2" style={{ marginBottom: 16 }}>
          {/* File d'attente */}
          <div style={{ backgroundColor: colors.bgCard, borderRadius: 14, padding: "20px 22px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: colors.navy }}>Ma file d'attente</h3>
              <button onClick={() => navigate("/hopital/mes-consultations")}
                style={{ fontSize: 11, padding: "3px 10px", backgroundColor: "#EFF6FF", color: "#2563EB", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>
                Voir tout
              </button>
            </div>
            {fileMedecin.length === 0 ? (
              <div style={{ fontSize: 13, color: colors.textMuted, textAlign: "center", padding: 20 }}>Aucun patient en attente.</div>
            ) : fileMedecin.map((c) => {
              const TRIAGE_COLORS = { urgent: "#EF4444", semi_urgent: "#F59E0B", non_urgent: "#10B981" };
              const tc = TRIAGE_COLORS[c.triage] ?? "#9CA3AF";
              return (
                <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${colors.borderLight}`, fontSize: 12 }}>
                  <span style={{ fontWeight: 600, color: colors.navy }}>{c.patients ? `${c.patients.prenom} ${c.patients.nom}` : "—"}</span>
                  {c.triage && <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 8, backgroundColor: tc + "20", color: tc }}>{c.triage.replace("_", " ")}</span>}
                </div>
              );
            })}
          </div>

          {/* Résultats d'examens */}
          <div style={{ backgroundColor: colors.bgCard, borderRadius: 14, padding: "20px 22px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: colors.navy }}>Resultats a lire</h3>
              <button onClick={() => navigate("/hopital/examens")}
                style={{ fontSize: 11, padding: "3px 10px", backgroundColor: "#EFF6FF", color: "#2563EB", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>
                Voir tout
              </button>
            </div>
            {examensDispos.length === 0 ? (
              <div style={{ fontSize: 13, color: colors.textMuted, textAlign: "center", padding: 20 }}>Aucun resultat disponible.</div>
            ) : examensDispos.map((e) => {
              const interpColor = { normal: "#10B981", anormal: "#F59E0B", critique: "#EF4444" }[e.interpretation] ?? "#6B7280";
              return (
                <div key={e.id} style={{ padding: "8px 0", borderBottom: `1px solid ${colors.borderLight}`, fontSize: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontWeight: 600, color: colors.navy }}>{e.patients ? `${e.patients.prenom} ${e.patients.nom}` : "—"}</span>
                    {e.interpretation && <span style={{ fontSize: 10, fontWeight: 700, color: interpColor }}>{e.interpretation.toUpperCase()}</span>}
                  </div>
                  <div style={{ color: colors.textMuted, marginTop: 2 }}>{e.type_examen ?? "Examen"}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Dashboard enrichi secretaire */}
      {isSecretaire && !loading && (
        <div className="dash-grid-2" style={{ marginBottom: 16 }}>
          {/* RDV du jour */}
          <div style={{ backgroundColor: colors.bgCard, borderRadius: 14, padding: "20px 22px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: colors.navy }}>RDV du jour</h3>
              <button onClick={() => navigate("/hopital/agenda")}
                style={{ fontSize: 11, padding: "3px 10px", backgroundColor: "#EFF6FF", color: "#2563EB", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>
                Voir l'agenda
              </button>
            </div>
            {rdvJourDetail.length === 0 && (
              <div style={{ fontSize: 13, color: colors.textMuted, textAlign: "center", padding: 20 }}>Aucun rendez-vous programme aujourd'hui.</div>
            )}
            {rdvJourDetail.map((rdv) => (
              <div key={rdv.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${colors.borderLight}`, fontSize: 12 }}>
                <div>
                  <span style={{ fontWeight: 700, color: colors.navy }}>{rdv.patients ? `${rdv.patients.prenom} ${rdv.patients.nom}` : "—"}</span>
                  <span style={{ color: colors.textMuted, marginLeft: 8 }}>{rdv.service}</span>
                  {rdv.medecin_nom && <span style={{ color: colors.textMuted, marginLeft: 4 }}>— {rdv.medecin_nom}</span>}
                </div>
                <span style={{ fontWeight: 700, color: ACCENT, flexShrink: 0, marginLeft: 8 }}>{rdv.heure_rdv?.slice(0, 5) ?? "—"}</span>
              </div>
            ))}
          </div>

          {/* Derniers patients enregistres */}
          <div style={{ backgroundColor: colors.bgCard, borderRadius: 14, padding: "20px 22px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700, color: colors.navy }}>Derniers patients enregistres</h3>
            {patientsRecents.length === 0 && (
              <div style={{ fontSize: 13, color: colors.textMuted, textAlign: "center", padding: 20 }}>Aucun patient enregistre recemment.</div>
            )}
            {patientsRecents.map((p) => (
              <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${colors.borderLight}`, fontSize: 12 }}>
                <div>
                  <span style={{ fontWeight: 700, color: colors.navy }}>{p.prenom} {p.nom}</span>
                  <span style={{ fontSize: 10, color: "#6B7280", fontFamily: "monospace", marginLeft: 8 }}>{p.numero_dossier}</span>
                </div>
                <span style={{ fontSize: 11, color: colors.textMuted }}>{new Date(p.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {shortcut && (
        <button onClick={() => navigate(shortcut.path)}
          style={{ width: "100%", padding: "14px 20px", backgroundColor: ACCENT, color: "white", border: "none", borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
          {shortcut.label}
        </button>
      )}
    </div>
  );
}

// ── Dashboard principal ───────────────────────────────────────────────────────
export default function DashboardHopital() {
  const { auth } = useAuth();
  const ri = auth?.role_interne;
  const isDirecteur = !ri || ri === "Directeur";
  const [etabNom, setEtabNom] = useState("");

  useEffect(() => {
    if (!auth?.etablissement_id) return;
    supabase
      .from("etablissements")
      .select("nom")
      .eq("id", auth.etablissement_id)
      .maybeSingle()
      .then(({ data }) => { if (data?.nom) setEtabNom(data.nom); });
  }, [auth?.etablissement_id]);

  return (
    <Layout title="Dashboard Hôpital" subtitle={etabNom ? `Vue d'ensemble — ${etabNom}` : "Vue d'ensemble"}>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>

      {/* Dashboard role-specific pour tous sauf Directeur */}
      {!isDirecteur && <DashboardRole ri={ri} />}

      {/* Dashboard complet pour Directeur (ou compte principal) */}
      {isDirecteur && (
        <>
          <KpiSection />
          <div className="dash-grid-2">
            <AlertesPanel />
            <PatientsPanel />
          </div>
          <div className="dash-grid-2" style={{ marginTop: 20 }}>
            <div style={{ backgroundColor: colors.bgCard, borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
              <h3 style={{ margin: "0 0 8px", fontSize: 15, fontWeight: 700, color: colors.navy }}>Dispensation médicaments</h3>
              <p style={{ margin: 0, fontSize: 13, color: colors.textMuted }}>Données de dispensation disponibles après enregistrement des ventes en caisse.</p>
            </div>
            <PredictionsIA />
          </div>
        </>
      )}

      {/* Pour les roles avec dashboard reduit, afficher quand meme alertes */}
      {!isDirecteur && (
        <div className="dash-grid-2">
          <AlertesPanel />
          <PatientsPanel />
        </div>
      )}
    </Layout>
  );
}
