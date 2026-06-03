import { colors } from "../../theme";
import { useState, useEffect, useCallback } from "react";
import Layout from "../../components/Layout";
import Modal, { Field, Row, ModalFooter, inputStyle, selectStyle } from "../../components/Modal";
import Toast from "../../components/Toast";
import { useToast } from "../../hooks/useToast";
import { useAuth } from "../../context/AuthContext";
import { insertGarde, updateGarde, deleteGarde, fetchGardes } from "../../hooks/useMutations";

// ── Constantes ────────────────────────────────────────────────────────────────
const SERVICES_HO = [
  "Urgences", "Medecine generale", "Maternite", "Pediatrie",
  "Cardiologie", "Chirurgie", "Neurologie", "Ophtalmologie",
];

const ROLES_PERS = ["Medecin", "Infirmier", "Aide-soignant", "Sage-femme", "Laborantin"];

const TYPES_GARDE = [
  { value: "garde",     label: "Garde",     color: "#3B82F6" },
  { value: "astreinte", label: "Astreinte", color: "#F59E0B" },
  { value: "repos",     label: "Repos",     color: "#9CA3AF" },
];

const CRENEAUX = [
  { label: "Matin (6h-14h)",  debut: "06:00", fin: "14:00" },
  { label: "Apres-midi (14h-22h)", debut: "14:00", fin: "22:00" },
  { label: "Nuit (22h-6h)",   debut: "22:00", fin: "06:00" },
  { label: "Journee (8h-18h)", debut: "08:00", fin: "18:00" },
];

// ── Helpers semaine ───────────────────────────────────────────────────────────
function getWeekDates(base) {
  const monday = new Date(base);
  monday.setDate(base.getDate() - ((base.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function toISO(d) { return d.toISOString().slice(0, 10); }

function fmtDayShort(d) {
  return d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric" });
}

// ── Couleur badge type ────────────────────────────────────────────────────────
function typeColor(type) {
  return TYPES_GARDE.find((t) => t.value === type)?.color ?? "#3B82F6";
}

// ── Modal ajout/edition garde ─────────────────────────────────────────────────
function GardeModal({ garde, datePreset, onClose, onSaved, auth }) {
  const isEdit = !!garde;
  const [form, setForm] = useState({
    personnel_nom:  garde?.personnel_nom  ?? "",
    personnel_role: garde?.personnel_role ?? "Medecin",
    service:        garde?.service        ?? "Urgences",
    date_garde:     garde?.date_garde     ?? datePreset ?? toISO(new Date()),
    heure_debut:    garde?.heure_debut    ?? "06:00",
    heure_fin:      garde?.heure_fin      ?? "14:00",
    type_garde:     garde?.type_garde     ?? "garde",
    notes:          garde?.notes          ?? "",
  });
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const applyCreneaux = (c) => setForm((f) => ({ ...f, heure_debut: c.debut, heure_fin: c.fin }));

  const handleSave = async () => {
    if (!form.personnel_nom.trim()) return alert("Le nom du personnel est obligatoire.");
    setSaving(true);
    try {
      const payload = { ...form, etablissement_id: auth?.etablissement_id ?? null };
      if (isEdit) await updateGarde(garde.id, payload);
      else await insertGarde(payload);
      onSaved();
      onClose();
    } catch (e) {
      alert("Erreur : " + e.message);
    } finally { setSaving(false); }
  };

  return (
    <Modal title={isEdit ? "Modifier la garde" : "Nouvelle garde"} onClose={onClose}>
      <Row>
        <Field label="Nom du personnel *">
          <input style={inputStyle} value={form.personnel_nom} onChange={set("personnel_nom")} placeholder="Dr. Kaboré" />
        </Field>
        <Field label="Role">
          <select style={selectStyle} value={form.personnel_role} onChange={set("personnel_role")}>
            {ROLES_PERS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </Field>
      </Row>
      <Row>
        <Field label="Service">
          <select style={selectStyle} value={form.service} onChange={set("service")}>
            {SERVICES_HO.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Type">
          <select style={selectStyle} value={form.type_garde} onChange={set("type_garde")}>
            {TYPES_GARDE.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </Field>
      </Row>
      <Field label="Date">
        <input style={inputStyle} type="date" value={form.date_garde} onChange={set("date_garde")} />
      </Field>
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: colors.text, marginBottom: 6 }}>Creneaux rapides</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {CRENEAUX.map((c) => (
            <button key={c.label} onClick={() => applyCreneaux(c)} style={{
              padding: "4px 10px", borderRadius: 8, fontSize: 11, cursor: "pointer", border: `1px solid ${colors.border}`,
              backgroundColor: form.heure_debut === c.debut ? "#3B82F6" : colors.bgSurface,
              color: form.heure_debut === c.debut ? "white" : colors.text,
              fontWeight: 600,
            }}>{c.label}</button>
          ))}
        </div>
      </div>
      <Row>
        <Field label="Heure debut">
          <input style={inputStyle} type="time" value={form.heure_debut} onChange={set("heure_debut")} />
        </Field>
        <Field label="Heure fin">
          <input style={inputStyle} type="time" value={form.heure_fin} onChange={set("heure_fin")} />
        </Field>
      </Row>
      <Field label="Notes">
        <input style={inputStyle} value={form.notes} onChange={set("notes")} placeholder="Optionnel..." />
      </Field>
      <ModalFooter onCancel={onClose} onSubmit={handleSave} submitLabel={isEdit ? "Sauvegarder" : "Ajouter la garde"} saving={saving} />
    </Modal>
  );
}

// ── Carte garde ───────────────────────────────────────────────────────────────
function GardeCard({ garde, onEdit, onDelete }) {
  const c = typeColor(garde.type_garde);
  return (
    <div style={{
      backgroundColor: colors.bgCard,
      borderLeft: `3px solid ${c}`,
      borderRadius: 8,
      padding: "8px 10px",
      marginBottom: 6,
      boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
    }}>
      <div style={{ fontWeight: 700, fontSize: 12, color: colors.navy, marginBottom: 2 }}>{garde.personnel_nom}</div>
      <div style={{ fontSize: 11, color: colors.textSecondary }}>{garde.personnel_role}</div>
      <div style={{ fontSize: 11, color: c, fontWeight: 600, marginTop: 2 }}>{garde.heure_debut?.slice(0, 5)} – {garde.heure_fin?.slice(0, 5)}</div>
      <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
        <button onClick={() => onEdit(garde)} style={{ fontSize: 10, padding: "2px 8px", border: "none", borderRadius: 4, backgroundColor: "#EFF6FF", color: "#2563EB", cursor: "pointer", fontWeight: 600 }}>Edit</button>
        <button onClick={() => onDelete(garde.id)} style={{ fontSize: 10, padding: "2px 8px", border: "none", borderRadius: 4, backgroundColor: "#FEF2F2", color: "#DC2626", cursor: "pointer", fontWeight: 600 }}>Sup.</button>
      </div>
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function Planning() {
  const { auth } = useAuth();
  const { toasts, success } = useToast();
  const [weekBase, setWeekBase] = useState(new Date());
  const [gardes, setGardes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // null | { mode: "add"|"edit", garde?, date? }
  const [filterService, setFilterService] = useState("Tous");

  const weekDates = getWeekDates(weekBase);
  const weekStart = toISO(weekDates[0]);
  const weekEnd   = toISO(weekDates[6]);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await fetchGardes(auth?.etablissement_id, weekStart, weekEnd);
    setGardes(data);
    setLoading(false);
  }, [auth?.etablissement_id, weekStart, weekEnd]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id) => {
    if (!window.confirm("Supprimer cette garde ?")) return;
    await deleteGarde(id);
    load();
    success("Garde supprimee");
  };

  const prevWeek = () => { const d = new Date(weekBase); d.setDate(d.getDate() - 7); setWeekBase(d); };
  const nextWeek = () => { const d = new Date(weekBase); d.setDate(d.getDate() + 7); setWeekBase(d); };

  const services = ["Tous", ...SERVICES_HO];
  const gardesFiltrees = filterService === "Tous" ? gardes : gardes.filter((g) => g.service === filterService);

  // Compte par service et par type pour le resume
  const nbGardes = gardes.filter((g) => g.type_garde === "garde").length;
  const nbAstreintes = gardes.filter((g) => g.type_garde === "astreinte").length;

  return (
    <Layout title="Planning des gardes" subtitle="Organisation hebdomadaire du personnel de sante">
      <Toast toasts={toasts} />

      {modal && (
        <GardeModal
          garde={modal.garde}
          datePreset={modal.date}
          auth={auth}
          onClose={() => setModal(null)}
          onSaved={() => { load(); success(modal.garde ? "Garde modifiee" : "Garde ajoutee"); }}
        />
      )}

      {/* Resume semaine */}
      <div className="kpi-row" style={{ marginBottom: 20 }}>
        {[
          { label: "Gardes cette semaine", value: loading ? "…" : nbGardes, color: "#3B82F6" },
          { label: "Astreintes", value: loading ? "…" : nbAstreintes, color: "#F59E0B" },
          { label: "Personnel planifie", value: loading ? "…" : new Set(gardes.map((g) => g.personnel_nom)).size, color: "#10B981" },
          { label: "Services couverts", value: loading ? "…" : new Set(gardes.map((g) => g.service)).size, color: "#8B5CF6" },
        ].map((k) => (
          <div key={k.label} style={{ backgroundColor: colors.bgCard, padding: "14px 20px", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", flex: 1, borderLeft: `4px solid ${k.color}` }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 12, color: colors.textSecondary }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Navigation semaine + filtres */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={prevWeek} style={{ padding: "7px 14px", border: `1px solid ${colors.border}`, borderRadius: 8, backgroundColor: colors.bgCard, cursor: "pointer", fontSize: 13, color: colors.text }}>Precedente</button>
          <span style={{ fontSize: 14, fontWeight: 700, color: colors.navy }}>
            Semaine du {weekDates[0].toLocaleDateString("fr-FR", { day: "numeric", month: "long" })} au {weekDates[6].toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
          </span>
          <button onClick={nextWeek} style={{ padding: "7px 14px", border: `1px solid ${colors.border}`, borderRadius: 8, backgroundColor: colors.bgCard, cursor: "pointer", fontSize: 13, color: colors.text }}>Suivante</button>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <select value={filterService} onChange={(e) => setFilterService(e.target.value)} style={{ ...selectStyle, width: "auto" }}>
            {services.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <button onClick={() => setModal({ mode: "add" })} style={{ padding: "7px 16px", backgroundColor: "#10B981", color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            + Ajouter une garde
          </button>
        </div>
      </div>

      {/* Calendrier hebdomadaire */}
      <div style={{ backgroundColor: colors.bgCard, borderRadius: 14, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(7, 1fr)`, borderBottom: `1px solid ${colors.border}` }}>
          {weekDates.map((d) => {
            const isToday = toISO(d) === toISO(new Date());
            return (
              <div key={toISO(d)} style={{ padding: "12px 10px", textAlign: "center", borderRight: `1px solid ${colors.borderLight}`, backgroundColor: isToday ? "#EFF6FF" : "transparent" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: isToday ? "#3B82F6" : colors.navy, textTransform: "capitalize" }}>
                  {fmtDayShort(d)}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: `repeat(7, 1fr)`, minHeight: 400 }}>
          {weekDates.map((d) => {
            const iso = toISO(d);
            const dayGardes = gardesFiltrees.filter((g) => g.date_garde === iso);
            const isToday = iso === toISO(new Date());
            return (
              <div
                key={iso}
                style={{ padding: "10px 8px", borderRight: `1px solid ${colors.borderLight}`, minHeight: 200, backgroundColor: isToday ? "#F0F9FF" : "transparent", cursor: "pointer" }}
                onClick={() => setModal({ mode: "add", date: iso })}
              >
                {loading ? (
                  <div style={{ height: 40, backgroundColor: colors.borderLight, borderRadius: 6, animation: "pulse 1.5s ease-in-out infinite" }} />
                ) : (
                  dayGardes.map((g) => (
                    <div key={g.id} onClick={(e) => e.stopPropagation()}>
                      <GardeCard garde={g} onEdit={(garde) => setModal({ mode: "edit", garde })} onDelete={handleDelete} />
                    </div>
                  ))
                )}
                {!loading && dayGardes.length === 0 && (
                  <div style={{ fontSize: 11, color: colors.textMuted, textAlign: "center", paddingTop: 16 }}>Cliquer pour ajouter</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Legende */}
      <div style={{ display: "flex", gap: 16, marginTop: 14, flexWrap: "wrap" }}>
        {TYPES_GARDE.map((t) => (
          <div key={t.value} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: t.color }} />
            <span style={{ fontSize: 12, color: colors.textSecondary }}>{t.label}</span>
          </div>
        ))}
      </div>

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
    </Layout>
  );
}
