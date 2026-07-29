import { colors } from "../../theme";
import { useState, useEffect } from "react";
import Layout from "../../components/Layout";
import Toast from "../../components/Toast";
import { useToast } from "../../hooks/useToast";
import { useAuth } from "../../context/AuthContext";
import { useAlertesPaginated, useAlertesStats } from "../../hooks/useSupabaseData";
import { updateAlerte, insertAlerte, fetchLitsOccupes, fetchConstantes, fetchPerfusionsActives } from "../../hooks/useMutations";
import { supabase } from "../../supabaseClient";
import Pagination from "../../components/Pagination";

const severityStyle = {
  critique: { bg: "#FEF2F2", border: "#FCA5A5", color: "#EF4444", dot: "#EF4444" },
  alerte:   { bg: "#FFFBEB", border: "#FCD34D", color: "#D97706", dot: "#F59E0B" },
  info:     { bg: "#EFF6FF", border: "#BFDBFE", color: "#2563EB", dot: "#3B82F6" },
};

function fmt(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default function Alertes() {
  const { auth } = useAuth();
  const [filter, setFilter] = useState("tous");
  const { data: alertes, loading, error, total, page, setPage, totalPages, refetch } = useAlertesPaginated(filter);
  const stats = useAlertesStats();
  const { toasts, success, error: toastError } = useToast();
  const [readIds, setReadIds] = useState(new Set());
  const [actioning, setActioning] = useState(null);
  const [generating, setGenerating] = useState(false);

  // readIds ne reflétait que les clics de CETTE session — les alertes déjà
  // lues en base (alert.lu) réapparaissaient "non lues" après un simple F5.
  // Trouvé lors de l'audit exhaustif hôpital.
  useEffect(() => {
    const dejaLues = alertes.filter((a) => a.lu).map((a) => a.id);
    if (dejaLues.length) setReadIds((prev) => new Set([...prev, ...dejaLues]));
  }, [alertes]);

  const genererAlertesCliniques = async () => {
    if (!auth?.etablissement_id) return;
    setGenerating(true);
    try {
      const now = new Date();
      const alertesACreer = [];
      const eid = auth.etablissement_id;

      const [hospit, perfusions] = await Promise.all([
        fetchLitsOccupes(eid),
        fetchPerfusionsActives(eid),
      ]);

      // 1. Patients sans constante depuis 6h
      for (const h of hospit) {
        const constantes = await fetchConstantes(h.patient_id, 1);
        const derniere = constantes?.[0];
        if (!derniere || (now - new Date(derniere.created_at)) > 6 * 3600000) {
          const nom = `${h.patients?.prenom ?? ""} ${h.patients?.nom ?? ""}`.trim();
          alertesACreer.push({ etablissement_id: eid, titre: "Constantes non enregistrees", message: `${nom} — Aucune constante depuis plus de 6h (${h.service ?? ""} Lit ${h.lit ?? "—"})`, severite: "alerte", resolu: false });
        }
      }

      // 2. Perfusions dont la fin est depassee
      for (const p of perfusions) {
        if (p.heure_fin_prevue && new Date(p.heure_fin_prevue) < now) {
          const nom = `${p.patients?.prenom ?? ""} ${p.patients?.nom ?? ""}`.trim();
          const retardMin = Math.round((now - new Date(p.heure_fin_prevue)) / 60000);
          alertesACreer.push({ etablissement_id: eid, titre: "Fin de perfusion depassee", message: `${nom} — Perfusion ${p.type_solute} ${p.volume_ml}mL terminee depuis ${retardMin} min`, severite: "critique", resolu: false });
        }
      }

      // 3. Sorties depassees
      for (const h of hospit) {
        if (h.date_sortie_prevue && new Date(h.date_sortie_prevue) < now) {
          const nom = `${h.patients?.prenom ?? ""} ${h.patients?.nom ?? ""}`.trim();
          alertesACreer.push({ etablissement_id: eid, titre: "Sortie depassee", message: `${nom} — Sortie prevue le ${new Date(h.date_sortie_prevue).toLocaleDateString("fr-FR")} non effectuee (${h.service ?? ""} Lit ${h.lit ?? "—"})`, severite: "alerte", resolu: false });
        }
      }

      let nbCreees = 0;
      for (const alerte of alertesACreer) {
        const { data: existing } = await supabase.from("alertes").select("id").eq("etablissement_id", alerte.etablissement_id).eq("titre", alerte.titre).eq("message", alerte.message).eq("resolu", false).maybeSingle();
        if (!existing) { await insertAlerte(alerte); nbCreees++; }
      }
      success(`${nbCreees} alerte(s) clinique(s) generee(s).`);
      refetch();
    } catch (e) {
      toastError("Erreur : " + e.message);
    } finally {
      setGenerating(false);
    }
  };

  const markRead = async (id) => {
    setActioning(id);
    try {
      await updateAlerte(id, { lu: true });
      setReadIds((prev) => new Set([...prev, id]));
      success("Alerte marquée comme lue");
    } catch (e) {
      toastError("Erreur : " + e.message);
    } finally {
      setActioning(null);
    }
  };

  const markAllRead = async () => {
    // Ne traitait que la page affichée (pageSize=20) en se présentant comme
    // "tout marquer" — corrigé pour cibler explicitement toutes les alertes
    // non lues non résolues de l'établissement, pas seulement celles
    // actuellement à l'écran. Trouvé lors de l'audit exhaustif hôpital.
    try {
      let q = supabase.from("alertes").select("id").eq("resolu", false).eq("lu", false);
      if (filter !== "tous") q = q.eq("severite", filter);
      const { data: toutesNonLues } = await q;
      const ids = (toutesNonLues ?? []).map((a) => a.id);
      await Promise.all(ids.map((id) => updateAlerte(id, { lu: true })));
      setReadIds((prev) => new Set([...prev, ...ids]));
      success(`${ids.length} alerte(s) marquée(s) comme lue(s)`);
      refetch();
    } catch (e) {
      toastError("Erreur : " + e.message);
    }
  };

  // Aucune action ne permettait jamais de résoudre une alerte "clinique"
  // (constantes non enregistrées, perfusion dépassée, sortie dépassée) —
  // seules les alertes stock/banque de sang se résolvent automatiquement
  // côté serveur. Une alerte clinique restait donc active indéfiniment,
  // même des semaines après que le problème réel a été traité. Trouvé lors
  // de l'audit exhaustif hôpital.
  const resoudre = async (id) => {
    setActioning(id);
    try {
      await updateAlerte(id, { resolu: true });
      success("Alerte résolue");
      refetch();
    } catch (e) {
      toastError("Erreur : " + e.message);
    } finally {
      setActioning(null);
    }
  };

  const filtered = alertes;
  const unreadCount = alertes.filter((a) => !readIds.has(a.id)).length;

  return (
    <Layout title="Alertes" subtitle="Surveillance et gestion des alertes pharmaceutiques">
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
      <Toast toasts={toasts} />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {["tous", "critique", "alerte", "info"].map((f) => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: "7px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", textTransform: "capitalize",
              border: filter === f ? "2px solid #10B981" : "1.5px solid var(--border)",
              backgroundColor: filter === f ? "#DCFCE7" : "white",
              color: filter === f ? "#16A34A" : "#6B7280",
            }}>{f}</button>
          ))}
          {unreadCount > 0 && (
            <span style={{ padding: "3px 10px", backgroundColor: "#EF4444", color: "white", borderRadius: 12, fontSize: 12, fontWeight: 700 }}>
              {unreadCount} non lues
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={genererAlertesCliniques} disabled={generating} style={{ padding: "8px 16px", backgroundColor: generating ? "#E5E7EB" : "#10B981", color: generating ? "#9CA3AF" : "white", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: generating ? "wait" : "pointer" }}>
            {generating ? "Analyse..." : "Actualiser alertes cliniques"}
          </button>
          {unreadCount > 0 && (
            <button onClick={markAllRead} style={{ padding: "8px 16px", backgroundColor: colors.bgCard, border: "1.5px solid var(--border)", borderRadius: 10, fontSize: 13, color: colors.text, cursor: "pointer", fontWeight: 600 }}>
              Tout marquer comme lu
            </button>
          )}
        </div>
      </div>

      <div className="kpi-row">
        {[
          { label: "Critiques",    value: stats.loading ? "…" : stats.critique, color: "#EF4444", bg: "#FEF2F2" },
          { label: "Alertes",      value: stats.loading ? "…" : stats.alerte,   color: "#F59E0B", bg: "#FFFBEB" },
          { label: "Informations", value: stats.loading ? "…" : stats.info,     color: "#3B82F6", bg: "#EFF6FF" },
          { label: "Non lues",     value: loading ? "…" : unreadCount,          color: "#8B5CF6", bg: "#F5F3FF" },
        ].map((s) => (
          <div key={s.label} style={{ backgroundColor: s.bg, borderRadius: 12, padding: "14px 20px", flex: 1, borderLeft: `4px solid ${s.color}` }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, color: colors.textSecondary }}>{s.label}</div>
          </div>
        ))}
      </div>

      {error && (
        <div style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 12, padding: "14px 18px", marginBottom: 16, fontSize: 13, color: "#DC2626" }}>
          Une erreur s'est produite. Veuillez réessayer.
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {loading && [1, 2, 3, 4].map((i) => (
          <div key={i} style={{ height: 72, backgroundColor: colors.bgSurface, borderRadius: 14, animation: "pulse 1.5s ease-in-out infinite" }} />
        ))}
        {!loading && filtered.length === 0 && (
          <div style={{ backgroundColor: colors.bgCard, borderRadius: 14, padding: 40, textAlign: "center", color: colors.textMuted, fontSize: 13 }}>
            Aucune alerte active
          </div>
        )}
        {!loading && filtered.map((alert) => {
          const s = severityStyle[alert.severite] ?? severityStyle.info;
          const isRead = readIds.has(alert.id);
          const isActioning = actioning === alert.id;
          return (
            <div key={alert.id} style={{
              backgroundColor: isRead ? "white" : s.bg,
              border: `1px solid ${isRead ? "#E5E7EB" : s.border}`,
              borderRadius: 14, padding: "16px 20px",
              display: "flex", alignItems: "center", gap: 14,
              boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
              opacity: isRead ? 0.7 : 1,
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: isRead ? 500 : 700, color: colors.navy, marginBottom: 4 }}>{alert.titre}</div>
                {alert.message && alert.message !== alert.titre && (
                  <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>{alert.message}</div>
                )}
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 10, fontWeight: 700, backgroundColor: s.bg, color: s.color, border: `1px solid ${s.border}` }}>{alert.severite}</span>
                  <span style={{ fontSize: 11, color: colors.textMuted }}>{alert.type}</span>
                  <span style={{ fontSize: 12, color: colors.textMuted }}>{fmt(alert.created_at)}</span>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {!isRead && (
                  <button
                    onClick={() => markRead(alert.id)}
                    disabled={isActioning}
                    style={{ padding: "6px 14px", backgroundColor: colors.bgCard, border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, color: colors.text, cursor: isActioning ? "wait" : "pointer" }}>
                    {isActioning ? "…" : "Marquer lu"}
                  </button>
                )}
                <button
                  onClick={() => resoudre(alert.id)}
                  disabled={isActioning}
                  style={{ padding: "6px 14px", backgroundColor: "#16A34A", border: "none", borderRadius: 8, fontSize: 12, color: "white", fontWeight: 600, cursor: isActioning ? "wait" : "pointer" }}>
                  {isActioning ? "…" : "Résoudre"}
                </button>
              </div>
              <div style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: isRead ? "#D1D5DB" : s.dot, flexShrink: 0 }} />
            </div>
          );
        })}
      </div>
      <Pagination page={page} totalPages={totalPages} total={total} onPage={setPage} />
    </Layout>
  );
}
