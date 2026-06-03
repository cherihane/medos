import { colors } from "../../theme";
import { useState, useEffect, useCallback } from "react";
import Layout from "../../components/Layout";
import Modal, { Field, Row, ModalFooter, inputStyle, selectStyle } from "../../components/Modal";
import Toast from "../../components/Toast";
import { useToast } from "../../hooks/useToast";
import { useAuth } from "../../context/AuthContext";
import {
  insertGarde, updateGarde, deleteGarde, fetchGardes,
  fetchMembresPersonnel,
} from "../../hooks/useMutations";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
} from "@dnd-kit/core";
import { openDocument, tableHTML, fetchEtabFromAuth } from "../../utils/MedOSDocument";

// ── Constantes ────────────────────────────────────────────────────────────────
const SERVICES = [
  "Urgences",
  "Pediatrie",
  "Maternite",
  "Chirurgie",
  "Medecine generale",
];

const CRENEAUX = [
  { key: "matin", label: "Matin",      debut: "06:00", fin: "14:00" },
  { key: "aprem", label: "Apres-midi", debut: "14:00", fin: "22:00" },
  { key: "nuit",  label: "Nuit",       debut: "22:00", fin: "06:00" },
];

const ROLES = [
  { value: "Medecin",       label: "Medecin",       color: "#16A34A", bg: "#DCFCE7" },
  { value: "Infirmier",     label: "Infirmier",     color: "#2563EB", bg: "#DBEAFE" },
  { value: "Aide-soignant", label: "Aide-soignant", color: "#D97706", bg: "#FEF3C7" },
  { value: "Sage-femme",    label: "Sage-femme",    color: "#7C3AED", bg: "#EDE9FE" },
  { value: "Laborantin",    label: "Laborantin",    color: "#0891B2", bg: "#CFFAFE" },
];

function roleStyle(role) {
  return ROLES.find((r) => r.value === role) ?? { color: "#6B7280", bg: "#F3F4F6" };
}

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

function fmtDay(d) {
  return d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric" });
}

function fmtMonth(d) {
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
}

function cellKey(service, creneauKey, dateISO) {
  return `${service}||${creneauKey}||${dateISO}`;
}

function parseCellKey(key) {
  const [service, creneauKey, dateISO] = key.split("||");
  return { service, creneauKey, dateISO };
}

// ── Detection conflits ────────────────────────────────────────────────────────
function detectConflits(gardes) {
  const seen = {};
  const conflits = new Set();
  gardes.forEach((g) => {
    const k = `${g.personnel_nom}__${g.date_garde}__${g.heure_debut}`;
    if (seen[k]) {
      conflits.add(g.id);
      conflits.add(seen[k]);
    } else {
      seen[k] = g.id;
    }
  });
  return conflits;
}

// ── Modal ajout / edition ────────────────────────────────────────────────────
function GardeModal({ garde, preset, membres, onClose, onSaved, auth }) {
  const isEdit = !!garde;
  const [form, setForm] = useState({
    personnel_nom:  garde?.personnel_nom  ?? "",
    personnel_role: garde?.personnel_role ?? "Medecin",
    service:        garde?.service        ?? preset?.service  ?? SERVICES[0],
    date_garde:     garde?.date_garde     ?? preset?.dateISO  ?? toISO(new Date()),
    heure_debut:    garde?.heure_debut    ?? preset?.debut    ?? "06:00",
    heure_fin:      garde?.heure_fin      ?? preset?.fin      ?? "14:00",
    notes:          garde?.notes          ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [useMembre, setUseMembre] = useState(membres.length > 0);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleMembreSelect = (e) => {
    const m = membres.find((mb) => mb.id === e.target.value);
    if (!m) return;
    const roleMap = {
      medecin: "Medecin", infirmier: "Infirmier",
      "aide-soignant": "Aide-soignant", "sage-femme": "Sage-femme",
      laborantin: "Laborantin",
    };
    setForm((f) => ({
      ...f,
      personnel_nom: m.email,
      personnel_role: roleMap[m.role_interne?.toLowerCase()] ?? "Medecin",
    }));
  };

  const handleSave = async () => {
    if (!form.personnel_nom.trim()) return alert("Le nom est obligatoire.");
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
    <Modal title={isEdit ? "Modifier la garde" : "Ajouter une garde"} onClose={onClose}>
      {membres.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <button
              onClick={() => setUseMembre(true)}
              style={{ fontSize: 12, padding: "4px 12px", borderRadius: 8, border: "none", cursor: "pointer",
                backgroundColor: useMembre ? "#3B82F6" : colors.bgSurface, color: useMembre ? "white" : colors.text, fontWeight: 600 }}
            >Choisir un membre</button>
            <button
              onClick={() => setUseMembre(false)}
              style={{ fontSize: 12, padding: "4px 12px", borderRadius: 8, border: "none", cursor: "pointer",
                backgroundColor: !useMembre ? "#3B82F6" : colors.bgSurface, color: !useMembre ? "white" : colors.text, fontWeight: 600 }}
            >Saisir manuellement</button>
          </div>
          {useMembre && (
            <Field label="Membre du personnel">
              <select style={selectStyle} defaultValue="" onChange={handleMembreSelect}>
                <option value="">-- Selectionner --</option>
                {membres.map((m) => (
                  <option key={m.id} value={m.id}>{m.email} ({m.role_interne})</option>
                ))}
              </select>
            </Field>
          )}
        </div>
      )}

      <Row>
        <Field label="Nom / identifiant *">
          <input style={inputStyle} value={form.personnel_nom} onChange={set("personnel_nom")} placeholder="Dr. Kaboré" />
        </Field>
        <Field label="Role">
          <select style={selectStyle} value={form.personnel_role} onChange={set("personnel_role")}>
            {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </Field>
      </Row>
      <Row>
        <Field label="Service">
          <select style={selectStyle} value={form.service} onChange={set("service")}>
            {SERVICES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Date">
          <input style={inputStyle} type="date" value={form.date_garde} onChange={set("date_garde")} />
        </Field>
      </Row>
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
      <ModalFooter onCancel={onClose} onSubmit={handleSave} submitLabel={isEdit ? "Sauvegarder" : "Ajouter"} saving={saving} />
    </Modal>
  );
}

// ── Carte garde (draggable) ───────────────────────────────────────────────────
function GardeCard({ garde, onEdit, onDelete, conflit, overlay }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: garde.id,
    data: { garde },
  });

  const rs = roleStyle(garde.personnel_role);

  return (
    <div
      ref={setNodeRef}
      style={{
        backgroundColor: rs.bg,
        border: conflit ? "2px solid #F59E0B" : `1.5px solid ${rs.color}33`,
        borderRadius: 8,
        padding: "7px 9px",
        marginBottom: 5,
        cursor: isDragging ? "grabbing" : "grab",
        opacity: isDragging && !overlay ? 0.3 : 1,
        transform: transform ? `translate(${transform.x}px, ${transform.y}px)` : undefined,
        boxShadow: overlay ? "0 8px 24px rgba(0,0,0,0.2)" : "0 1px 3px rgba(0,0,0,0.06)",
        userSelect: "none",
        position: "relative",
      }}
      {...(overlay ? {} : { ...attributes, ...listeners })}
    >
      {conflit && (
        <div style={{ position: "absolute", top: 4, right: 4, fontSize: 9, fontWeight: 800, color: "#D97706", backgroundColor: "#FEF3C7", borderRadius: 4, padding: "1px 5px" }}>CONFLIT</div>
      )}
      <div style={{ fontSize: 11, fontWeight: 700, color: rs.color, marginBottom: 3, paddingRight: conflit ? 48 : 0 }}>
        {garde.personnel_nom}
      </div>
      <span style={{ fontSize: 10, color: rs.color, backgroundColor: "white", borderRadius: 4, padding: "1px 6px", border: `1px solid ${rs.color}44`, fontWeight: 600 }}>
        {garde.personnel_role}
      </span>
      {garde.notes && (
        <div style={{ fontSize: 10, color: colors.textMuted, marginTop: 3, fontStyle: "italic" }}>{garde.notes}</div>
      )}
      {!overlay && (
        <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onEdit(garde); }}
            style={{ fontSize: 10, padding: "2px 8px", border: "none", borderRadius: 4, backgroundColor: "#EFF6FF", color: "#2563EB", cursor: "pointer", fontWeight: 600 }}
          >Edit</button>
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onDelete(garde.id); }}
            style={{ fontSize: 10, padding: "2px 8px", border: "none", borderRadius: 4, backgroundColor: "#FEF2F2", color: "#DC2626", cursor: "pointer", fontWeight: 600 }}
          >Sup.</button>
        </div>
      )}
    </div>
  );
}

// ── Cellule droppable ────────────────────────────────────────────────────────
function DroppableCell({ id, gardes, onAdd, onEdit, onDelete, conflits, alerteVide }) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      style={{
        minHeight: 80,
        padding: "5px 5px 4px",
        backgroundColor: isOver ? "#EFF6FF" : alerteVide ? "#FFF7F7" : "transparent",
        border: isOver
          ? "2px dashed #3B82F6"
          : alerteVide
          ? "1.5px dashed #EF444488"
          : "none",
        borderRadius: 8,
        transition: "background-color 0.15s, border-color 0.15s",
      }}
    >
      {gardes.map((g) => (
        <GardeCard
          key={g.id}
          garde={g}
          onEdit={onEdit}
          onDelete={onDelete}
          conflit={conflits.has(g.id)}
          overlay={false}
        />
      ))}
      <button
        onClick={() => onAdd(id)}
        style={{
          width: "100%",
          marginTop: gardes.length > 0 ? 4 : 0,
          padding: "4px 0",
          border: `1px dashed ${colors.border}`,
          borderRadius: 6,
          backgroundColor: "transparent",
          fontSize: 11,
          color: colors.textMuted,
          cursor: "pointer",
          fontWeight: 600,
        }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#3B82F6"; e.currentTarget.style.color = "#3B82F6"; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = colors.border; e.currentTarget.style.color = colors.textMuted; }}
      >
        + Ajouter
      </button>
    </div>
  );
}

// ── Export PDF ────────────────────────────────────────────────────────────────
async function exportPlanningPDF(gardes, weekDates, auth) {
  const etab = await fetchEtabFromAuth(auth);
  const debut = fmtMonth(weekDates[0]);
  const fin   = fmtMonth(weekDates[6]);

  const sections = SERVICES.map((service) => {
    const rows = [];
    weekDates.forEach((d) => {
      const iso = toISO(d);
      CRENEAUX.forEach((cr) => {
        const cellGardes = gardes.filter(
          (g) => g.service === service && g.date_garde === iso && g.heure_debut?.slice(0, 5) === cr.debut
        );
        cellGardes.forEach((g) => {
          rows.push([
            d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }),
            cr.label,
            `${cr.debut} – ${cr.fin}`,
            g.personnel_nom,
            g.personnel_role,
            g.notes ?? "—",
          ]);
        });
      });
    });

    if (rows.length === 0) return null;
    return {
      titre: service,
      html: tableHTML(
        ["Jour", "Creneau", "Horaire", "Personnel", "Role", "Notes"],
        rows,
      ),
    };
  }).filter(Boolean);

  if (sections.length === 0) {
    alert("Aucune garde a exporter cette semaine.");
    return;
  }

  openDocument({
    titre: "Planning des gardes",
    sousTitre: `Semaine du ${debut} au ${fin}`,
    etablissement: etab,
    sections,
  });
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function Planning() {
  const { auth } = useAuth();
  const { toasts, success } = useToast();
  const [weekBase, setWeekBase] = useState(new Date());
  const [gardes, setGardes] = useState([]);
  const [membres, setMembres] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [activeGarde, setActiveGarde] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const weekDates = getWeekDates(weekBase);
  const weekStart = toISO(weekDates[0]);
  const weekEnd   = toISO(weekDates[6]);
  const todayISO  = toISO(new Date());
  const isCurrentWeek = weekDates.some((d) => toISO(d) === todayISO);

  const conflits = detectConflits(gardes);
  const nbNuit   = gardes.filter((g) => g.heure_debut?.slice(0, 5) === "22:00").length;
  const nbJour   = gardes.length - nbNuit;
  const nbPers   = new Set(gardes.map((g) => g.personnel_nom)).size;

  const load = useCallback(async () => {
    setLoading(true);
    const [data, mems] = await Promise.all([
      fetchGardes(auth?.etablissement_id, weekStart, weekEnd),
      fetchMembresPersonnel(auth?.etablissement_id),
    ]);
    setGardes(data);
    setMembres(mems);
    setLoading(false);
  }, [auth?.etablissement_id, weekStart, weekEnd]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id) => {
    if (!window.confirm("Supprimer cette garde ?")) return;
    await deleteGarde(id);
    setGardes((prev) => prev.filter((g) => g.id !== id));
    success("Garde supprimee");
  };

  const handleAdd = (ck) => {
    const { service, creneauKey, dateISO } = parseCellKey(ck);
    const cr = CRENEAUX.find((c) => c.key === creneauKey);
    setModal({ preset: { service, dateISO, debut: cr?.debut ?? "06:00", fin: cr?.fin ?? "14:00" } });
  };

  const handleDragStart = ({ active }) => {
    setActiveGarde(gardes.find((g) => g.id === active.id) ?? null);
  };

  const handleDragEnd = async ({ active, over }) => {
    setActiveGarde(null);
    if (!over) return;
    const garde = gardes.find((g) => g.id === active.id);
    if (!garde) return;
    const { service, creneauKey, dateISO } = parseCellKey(over.id);
    const cr = CRENEAUX.find((c) => c.key === creneauKey);
    if (!cr) return;
    if (service === garde.service && dateISO === garde.date_garde && cr.debut === garde.heure_debut?.slice(0, 5)) return;

    const updated = { ...garde, service, date_garde: dateISO, heure_debut: cr.debut, heure_fin: cr.fin };
    setGardes((prev) => prev.map((g) => g.id === garde.id ? updated : g));
    try {
      await updateGarde(garde.id, { service, date_garde: dateISO, heure_debut: cr.debut, heure_fin: cr.fin });
      success("Garde deplacee");
    } catch {
      setGardes((prev) => prev.map((g) => g.id === garde.id ? garde : g));
    }
  };

  // Calcul cellules vides (seulement pour la semaine courante)
  const emptyAlerts = new Set();
  if (!loading && isCurrentWeek) {
    SERVICES.forEach((service) => {
      weekDates.forEach((d) => {
        const iso = toISO(d);
        CRENEAUX.forEach((cr) => {
          const count = gardes.filter(
            (g) => g.service === service && g.date_garde === iso && g.heure_debut?.slice(0, 5) === cr.debut
          ).length;
          if (count === 0) emptyAlerts.add(cellKey(service, cr.key, iso));
        });
      });
    });
  }

  const SERVICE_COL = 124;
  const DAY_COL     = 112;

  return (
    <Layout title="Planning des gardes" subtitle="Vue semaine — Grille service x creneau">
      <Toast toasts={toasts} />

      {modal && (
        <GardeModal
          garde={modal.garde}
          preset={modal.preset}
          membres={membres}
          auth={auth}
          onClose={() => setModal(null)}
          onSaved={() => { load(); success(modal.garde ? "Garde modifiee" : "Garde ajoutee"); }}
        />
      )}

      {/* KPI */}
      <div className="kpi-row" style={{ marginBottom: 20 }}>
        {[
          { label: "Gardes jour",        value: loading ? "…" : nbJour,           color: "#3B82F6" },
          { label: "Gardes de nuit",     value: loading ? "…" : nbNuit,           color: "#7C3AED" },
          { label: "Personnel planifie", value: loading ? "…" : nbPers,           color: "#10B981" },
          { label: "Conflits detectes",  value: loading ? "…" : conflits.size,    color: conflits.size > 0 ? "#D97706" : "#9CA3AF" },
        ].map((k) => (
          <div key={k.label} style={{ backgroundColor: colors.bgCard, padding: "14px 20px", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", flex: 1, borderLeft: `4px solid ${k.color}` }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 12, color: colors.textSecondary }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Alertes */}
      {!loading && conflits.size > 0 && (
        <div style={{ backgroundColor: "#FFFBEB", border: "1.5px solid #F59E0B", borderRadius: 10, padding: "10px 16px", marginBottom: 12, fontSize: 13, color: "#92400E", fontWeight: 600 }}>
          {Math.floor(conflits.size / 2)} conflit(s) detecte(s) — meme personnel assigne deux fois sur le meme creneau. Les cartes concernees sont marquees.
        </div>
      )}
      {!loading && isCurrentWeek && emptyAlerts.size > 0 && (
        <div style={{ backgroundColor: "#FEF2F2", border: "1.5px solid #EF4444", borderRadius: 10, padding: "10px 16px", marginBottom: 12, fontSize: 13, color: "#7F1D1D", fontWeight: 600 }}>
          {emptyAlerts.size} creneau(x) sans personnel cette semaine. Les cellules sans affectation sont encadrees en rouge.
        </div>
      )}

      {/* Navigation */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={() => { const d = new Date(weekBase); d.setDate(d.getDate() - 7); setWeekBase(d); }}
            style={{ padding: "7px 14px", border: `1px solid ${colors.border}`, borderRadius: 8, backgroundColor: colors.bgCard, cursor: "pointer", fontSize: 13, color: colors.text, fontWeight: 600 }}>
            Precedente
          </button>
          <span style={{ fontSize: 14, fontWeight: 700, color: colors.navy, minWidth: 280, textAlign: "center" }}>
            {fmtMonth(weekDates[0])} — {weekDates[6].toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
          </span>
          <button onClick={() => { const d = new Date(weekBase); d.setDate(d.getDate() + 7); setWeekBase(d); }}
            style={{ padding: "7px 14px", border: `1px solid ${colors.border}`, borderRadius: 8, backgroundColor: colors.bgCard, cursor: "pointer", fontSize: 13, color: colors.text, fontWeight: 600 }}>
            Suivante
          </button>
          <button onClick={() => setWeekBase(new Date())}
            style={{ padding: "7px 12px", border: "none", borderRadius: 8, backgroundColor: "#EFF6FF", cursor: "pointer", fontSize: 13, color: "#2563EB", fontWeight: 700 }}>
            Auj.
          </button>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => exportPlanningPDF(gardes, weekDates, auth)}
            style={{ padding: "7px 16px", backgroundColor: colors.bgCard, color: "#7C3AED", border: `1px solid #7C3AED`, borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" }}
          >Exporter PDF</button>
          <button
            onClick={() => setModal({})}
            style={{ padding: "7px 16px", backgroundColor: "#10B981", color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" }}
          >+ Nouvelle garde</button>
        </div>
      </div>

      {/* Legende */}
      <div style={{ display: "flex", gap: 14, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
        {ROLES.map((r) => (
          <div key={r.value} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: r.color }} />
            <span style={{ fontSize: 11, color: colors.textSecondary, fontWeight: 600 }}>{r.label}</span>
          </div>
        ))}
        <div style={{ display: "flex", alignItems: "center", gap: 5, marginLeft: 6 }}>
          <div style={{ width: 10, height: 10, borderRadius: 3, border: "2px solid #F59E0B", backgroundColor: "#FEF3C7" }} />
          <span style={{ fontSize: 11, color: "#D97706", fontWeight: 600 }}>Conflit</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <div style={{ width: 10, height: 10, borderRadius: 3, border: "1.5px dashed #EF4444", backgroundColor: "#FFF7F7" }} />
          <span style={{ fontSize: 11, color: "#EF4444", fontWeight: 600 }}>Creneau vide</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <div style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: "#3B82F6", opacity: 0.5 }} />
          <span style={{ fontSize: 11, color: colors.textMuted }}>Glisser-deposer pour deplacer</span>
        </div>
      </div>

      {/* Grille Trello */}
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div style={{ overflowX: "auto", borderRadius: 14, boxShadow: "0 1px 6px rgba(0,0,0,0.08)", backgroundColor: colors.bgCard }}>
          <div style={{ minWidth: SERVICE_COL + DAY_COL * 7 }}>

            {/* En-tete jours */}
            <div style={{
              display: "grid",
              gridTemplateColumns: `${SERVICE_COL}px repeat(7, ${DAY_COL}px)`,
              borderBottom: `2px solid ${colors.border}`,
              position: "sticky",
              top: 0,
              zIndex: 10,
              backgroundColor: colors.bgCard,
            }}>
              <div style={{ padding: "12px 10px", borderRight: `2px solid ${colors.border}`, backgroundColor: colors.bgSurface, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: colors.textSecondary, textTransform: "uppercase", letterSpacing: "0.05em" }}>Service</div>
              </div>
              {weekDates.map((d) => {
                const iso = toISO(d);
                const isToday = iso === todayISO;
                return (
                  <div key={iso} style={{
                    padding: "10px 8px",
                    textAlign: "center",
                    borderRight: `1px solid ${colors.border}`,
                    backgroundColor: isToday ? "#EFF6FF" : colors.bgCard,
                    borderBottom: isToday ? "3px solid #3B82F6" : "none",
                  }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: isToday ? "#2563EB" : colors.navy, textTransform: "capitalize" }}>
                      {fmtDay(d)}
                    </div>
                    {isToday && <div style={{ fontSize: 9, fontWeight: 700, color: "#2563EB", marginTop: 2 }}>AUJOURD'HUI</div>}
                  </div>
                );
              })}
            </div>

            {/* Lignes : service x creneau */}
            {SERVICES.map((service, sIdx) => (
              <div key={service} style={{ borderBottom: sIdx < SERVICES.length - 1 ? `2px solid ${colors.border}` : "none" }}>
                {CRENEAUX.map((cr, crIdx) => {
                  const crColor = cr.key === "nuit" ? "#7C3AED" : cr.key === "matin" ? "#D97706" : "#2563EB";
                  const crBg   = cr.key === "nuit" ? "#F5F3FF" : cr.key === "matin" ? "#FFFBEB" : "#EFF6FF";

                  return (
                    <div
                      key={cr.key}
                      style={{
                        display: "grid",
                        gridTemplateColumns: `${SERVICE_COL}px repeat(7, ${DAY_COL}px)`,
                        borderBottom: crIdx < CRENEAUX.length - 1 ? `1px solid ${colors.borderLight}` : "none",
                      }}
                    >
                      {/* Etiquette service + creneau */}
                      <div style={{
                        padding: "8px 10px",
                        borderRight: `2px solid ${colors.border}`,
                        backgroundColor: crIdx === 0 ? colors.bgSurface : colors.bgCard,
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "center",
                        gap: 4,
                      }}>
                        {crIdx === 0 && (
                          <div style={{ fontSize: 12, fontWeight: 800, color: colors.navy, lineHeight: 1.2 }}>
                            {service}
                          </div>
                        )}
                        <div style={{
                          fontSize: 10, fontWeight: 700, color: crColor,
                          backgroundColor: crBg, borderRadius: 5,
                          padding: "2px 7px", display: "inline-block",
                        }}>
                          {cr.label}
                        </div>
                        <div style={{ fontSize: 9, color: colors.textMuted }}>
                          {cr.debut} – {cr.fin}
                        </div>
                      </div>

                      {/* Cellules par jour */}
                      {weekDates.map((d) => {
                        const iso = toISO(d);
                        const isToday = iso === todayISO;
                        const ck = cellKey(service, cr.key, iso);
                        const cellGardes = gardes.filter(
                          (g) => g.service === service && g.date_garde === iso && g.heure_debut?.slice(0, 5) === cr.debut
                        );
                        const alerteVide = emptyAlerts.has(ck);

                        return (
                          <div
                            key={iso}
                            style={{
                              padding: "6px 5px",
                              borderRight: `1px solid ${colors.borderLight}`,
                              backgroundColor: isToday ? "#F0F9FF" : "transparent",
                            }}
                          >
                            {loading ? (
                              <div style={{ height: 50, backgroundColor: colors.borderLight, borderRadius: 6, animation: "pulse 1.5s ease-in-out infinite" }} />
                            ) : (
                              <DroppableCell
                                id={ck}
                                gardes={cellGardes}
                                onAdd={handleAdd}
                                onEdit={(g) => setModal({ garde: g })}
                                onDelete={handleDelete}
                                conflits={conflits}
                                alerteVide={alerteVide}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        <DragOverlay>
          {activeGarde && (
            <GardeCard
              garde={activeGarde}
              onEdit={() => {}}
              onDelete={() => {}}
              conflit={conflits.has(activeGarde.id)}
              overlay
            />
          )}
        </DragOverlay>
      </DndContext>

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
    </Layout>
  );
}
