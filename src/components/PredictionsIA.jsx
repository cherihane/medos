/**
 * PredictionsIA — Composant visuel affiché dans les 3 dashboards
 * Pharmacie / Hôpital / Distributeur
 */
import { useState } from "react";
import { usePredictionsIA } from "../hooks/usePredictionsIA";

// ── Spinner ──────────────────────────────────────────────────────────────────
function Spinner() {
  return (
    <div style={{
      width: 20, height: 20,
      border: "2.5px solid #E5E7EB",
      borderTopColor: "#6366F1",
      borderRadius: "50%",
      animation: "spin 0.8s linear infinite",
      display: "inline-block",
    }} />
  );
}

// ── Badge urgence ─────────────────────────────────────────────────────────────
function UrgenceBadge({ urgence }) {
  const map = {
    critique: { bg: "#FEF2F2", color: "#DC2626", label: "CRITIQUE" },
    alerte:   { bg: "#FFFBEB", color: "#D97706", label: "ALERTE" },
    modere:   { bg: "#EFF6FF", color: "#2563EB", label: "MODÉRÉ" },
  };
  const s = map[urgence] || map.modere;
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 6, backgroundColor: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
}

// ── Badge priorité commande ───────────────────────────────────────────────────
function PrioriteBadge({ priorite }) {
  const map = {
    urgente: { bg: "#FEF2F2", color: "#DC2626" },
    haute:   { bg: "#FFFBEB", color: "#D97706" },
    normale: { bg: "#F0FDF4", color: "#16A34A" },
  };
  const s = map[priorite] || map.normale;
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 6, backgroundColor: s.bg, color: s.color }}>
      {priorite?.toUpperCase()}
    </span>
  );
}

// ── Barre de risque ───────────────────────────────────────────────────────────
function RiskBar({ pct }) {
  const color = pct >= 80 ? "#DC2626" : pct >= 50 ? "#F59E0B" : "#10B981";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{ flex: 1, height: 5, backgroundColor: "#F3F4F6", borderRadius: 4 }}>
        <div style={{ width: `${Math.min(100, pct)}%`, height: "100%", backgroundColor: color, borderRadius: 4, transition: "width 0.5s" }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color, minWidth: 32, textAlign: "right" }}>{pct}%</span>
    </div>
  );
}

// ── Placeholder avant analyse ─────────────────────────────────────────────────
function Placeholder({ onAnalyser, loading }) {
  return (
    <div style={{ textAlign: "center", padding: "32px 24px" }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>🤖</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: "#0A1628", marginBottom: 6 }}>
        Prédictions IA non calculées
      </div>
      <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 20 }}>
        Analysez vos stocks avec Claude pour obtenir des prédictions de rupture,<br />
        des alertes saisonnières et des suggestions de commande.
      </div>
      <button
        onClick={onAnalyser}
        disabled={loading}
        style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          padding: "11px 24px",
          backgroundColor: loading ? "#E5E7EB" : "#6366F1",
          color: loading ? "#9CA3AF" : "white",
          border: "none", borderRadius: 10,
          fontSize: 13, fontWeight: 700, cursor: loading ? "wait" : "pointer",
        }}
      >
        {loading ? <><Spinner /> Analyse en cours…</> : "Lancer l'analyse IA"}
      </button>
    </div>
  );
}

// ── Section Ruptures ──────────────────────────────────────────────────────────
function SectionRuptures({ ruptures }) {
  if (!ruptures?.length) return (
    <div style={{ padding: "12px 0", fontSize: 13, color: "#10B981", textAlign: "center" }}>
      Aucune rupture prévue — stocks satisfaisants
    </div>
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {ruptures.map((r, i) => (
        <div key={i} style={{ padding: "12px 14px", backgroundColor: "#FAFAFA", borderRadius: 10, border: "1px solid #F3F4F6" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#0A1628" }}>{r.nom}</span>
            <UrgenceBadge urgence={r.urgence} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 8 }}>
            {[
              { label: "7 jours", val: r.risque7j },
              { label: "14 jours", val: r.risque14j },
              { label: "30 jours", val: r.risque30j },
            ].map(({ label, val }) => (
              <div key={label}>
                <div style={{ fontSize: 10, color: "#9CA3AF", marginBottom: 2 }}>{label}</div>
                <RiskBar pct={val ?? 0} />
              </div>
            ))}
          </div>
          <div style={{ fontSize: 11, color: "#6B7280" }}>
            Stock : <b style={{ color: "#0A1628" }}>{r.stock_actuel}</b> / seuil : <b>{r.stock_minimum}</b>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Section Saisonnier ────────────────────────────────────────────────────────
function SectionSaisonnier({ saisonnier }) {
  if (!saisonnier?.length) return (
    <div style={{ padding: "12px 0", fontSize: 13, color: "#9CA3AF", textAlign: "center" }}>
      Aucune alerte saisonnière active
    </div>
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {saisonnier.map((s, i) => {
        const niveauColor = s.niveau === "pic" ? "#DC2626" : s.niveau === "normal" ? "#D97706" : "#10B981";
        const niveauBg   = s.niveau === "pic" ? "#FEF2F2" : s.niveau === "normal" ? "#FFFBEB" : "#F0FDF4";
        return (
          <div key={i} style={{ padding: "12px 14px", backgroundColor: niveauBg, borderRadius: 10, borderLeft: `3px solid ${s.couleur || niveauColor}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#0A1628" }}>{s.maladie}</span>
              <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 6, backgroundColor: "white", color: s.couleur || niveauColor }}>
                {s.niveau?.toUpperCase()}
              </span>
            </div>
            <div style={{ fontSize: 12, color: "#374151", marginBottom: 6 }}>{s.message}</div>
            {s.medicaments_prioritaires?.length > 0 && (
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {s.medicaments_prioritaires.map((m, j) => (
                  <span key={j} style={{ fontSize: 10, padding: "2px 8px", backgroundColor: "white", borderRadius: 6, color: "#374151", fontWeight: 600 }}>
                    {m}
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Section Commandes ─────────────────────────────────────────────────────────
function SectionCommandes({ commandes }) {
  if (!commandes?.length) return (
    <div style={{ padding: "12px 0", fontSize: 13, color: "#9CA3AF", textAlign: "center" }}>
      Aucune commande suggérée
    </div>
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {commandes.map((c, i) => (
        <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", backgroundColor: "#FAFAFA", borderRadius: 8, border: "1px solid #F3F4F6" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#0A1628" }}>{c.nom}</div>
            <div style={{ fontSize: 11, color: "#6B7280", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.raison}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: 10, flexShrink: 0 }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: "#0A1628" }}>{c.quantite_recommandee?.toLocaleString()}</span>
            <PrioriteBadge priorite={c.priorite} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Composant principal ───────────────────────────────────────────────────────
export default function PredictionsIA() {
  const { predictions, loading, error, analyser } = usePredictionsIA();
  const [tab, setTab] = useState("ruptures");

  const tabs = [
    { id: "ruptures",  label: "Ruptures",  count: predictions?.ruptures?.length },
    { id: "saisonnier", label: "Saisonnier", count: predictions?.saisonnier?.length },
    { id: "commandes", label: "Commandes", count: predictions?.commandes?.length },
  ];

  return (
    <div style={{ backgroundColor: "white", borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes fadeIn { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
      `}</style>

      {/* En-tête */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#0A1628" }}>
            Prédictions IA
          </h3>
          <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>Powered by Claude claude-opus-4-7</div>
        </div>
        {predictions && (
          <button
            onClick={analyser}
            disabled={loading}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "7px 14px",
              backgroundColor: "#EEF2FF",
              color: "#6366F1",
              border: "none", borderRadius: 8,
              fontSize: 12, fontWeight: 700, cursor: loading ? "wait" : "pointer",
            }}
          >
            {loading ? <Spinner /> : "↻"} Actualiser
          </button>
        )}
      </div>

      {/* Résumé */}
      {predictions?.resume && (
        <div style={{ padding: "10px 14px", backgroundColor: "#EEF2FF", borderRadius: 8, marginBottom: 16, fontSize: 12, color: "#4338CA", fontStyle: "italic", animation: "fadeIn 0.3s ease" }}>
          {predictions.resume}
        </div>
      )}

      {/* Erreur */}
      {error && (
        <div style={{ padding: "10px 14px", backgroundColor: "#FEF2F2", borderRadius: 8, marginBottom: 16, fontSize: 12, color: "#DC2626" }}>
          Erreur : {error}
        </div>
      )}

      {/* Placeholder */}
      {!predictions && !loading && !error && (
        <Placeholder onAnalyser={analyser} loading={loading} />
      )}

      {/* Loading initial */}
      {!predictions && loading && (
        <div style={{ textAlign: "center", padding: "32px 0" }}>
          <Spinner />
          <div style={{ fontSize: 13, color: "#6B7280", marginTop: 14 }}>
            Claude analyse vos stocks en temps réel…
          </div>
          <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 4 }}>
            Prédictions ruptures · Alertes saisonnières · Suggestions commandes
          </div>
        </div>
      )}

      {/* Résultats avec onglets */}
      {predictions && (
        <div style={{ animation: "fadeIn 0.3s ease" }}>
          {/* Onglets */}
          <div style={{ display: "flex", gap: 4, marginBottom: 16, borderBottom: "1px solid #F3F4F6", paddingBottom: 0 }}>
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{
                  padding: "8px 14px",
                  border: "none",
                  borderBottom: tab === t.id ? "2.5px solid #6366F1" : "2.5px solid transparent",
                  backgroundColor: "transparent",
                  fontSize: 12, fontWeight: tab === t.id ? 700 : 500,
                  color: tab === t.id ? "#6366F1" : "#6B7280",
                  cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 6,
                  marginBottom: -1,
                }}
              >
                {t.label}
                {t.count != null && (
                  <span style={{
                    fontSize: 10, fontWeight: 700,
                    backgroundColor: tab === t.id ? "#6366F1" : "#F3F4F6",
                    color: tab === t.id ? "white" : "#6B7280",
                    borderRadius: 10, padding: "1px 6px",
                  }}>
                    {t.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Contenu onglet */}
          <div style={{ animation: "fadeIn 0.2s ease" }}>
            {tab === "ruptures"   && <SectionRuptures   ruptures={predictions.ruptures} />}
            {tab === "saisonnier" && <SectionSaisonnier saisonnier={predictions.saisonnier} />}
            {tab === "commandes"  && <SectionCommandes  commandes={predictions.commandes} />}
          </div>
        </div>
      )}
    </div>
  );
}
