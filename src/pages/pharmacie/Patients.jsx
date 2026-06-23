import { colors } from "../../theme";
import { useState } from "react";
import Layout from "../../components/Layout";
import Modal, { Field, Row, ModalFooter, inputStyle, selectStyle } from "../../components/Modal";
import Toast from "../../components/Toast";
import { useToast } from "../../hooks/useToast";
import { usePatientsPaginated } from "../../hooks/useSupabaseData";
import Pagination from "../../components/Pagination";
import { insertPatient, updatePatient } from "../../hooks/useMutations";
import { useIsMobile } from "../../hooks/useWindowSize";

function calcAge(dateNaissance) {
  if (!dateNaissance) return "—";
  const diff = Date.now() - new Date(dateNaissance).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
}

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR");
}

function Skeleton() {
  return (
    <div style={{ padding: "14px 20px", display: "flex", alignItems: "center", gap: 14, borderBottom: "1px solid var(--border-light)", animation: "pulse 1.5s ease-in-out infinite" }}>
      <div style={{ width: 40, height: 40, borderRadius: "50%", backgroundColor: colors.borderLight, flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div style={{ width: "55%", height: 14, backgroundColor: colors.borderLight, borderRadius: 6, marginBottom: 6 }} />
        <div style={{ width: "40%", height: 11, backgroundColor: colors.borderLight, borderRadius: 6 }} />
      </div>
    </div>
  );
}

// ── Modal Ajouter / Éditer patient ────────────────────────────────────────────
function PatientModal({ patient, onClose, onSaved }) {
  const isEdit = !!patient;
  const [form, setForm] = useState({
    prenom:        patient?.prenom        ?? "",
    nom:           patient?.nom           ?? "",
    date_naissance: patient?.date_naissance ? patient.date_naissance.slice(0, 10) : "",
    genre:         patient?.genre         ?? "M",
    telephone:     patient?.telephone     ?? "",
    email:         patient?.email         ?? "",
    groupe_sanguin: patient?.groupe_sanguin ?? "",
    adresse:       patient?.adresse       ?? "",
  });
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSave = async () => {
    if (!form.prenom.trim() || !form.nom.trim()) return showError("Prénom et nom sont obligatoires.");
    setSaving(true);
    try {
      const payload = {
        prenom:         form.prenom,
        nom:            form.nom,
        date_naissance: form.date_naissance || null,
        genre:          form.genre,
        telephone:      form.telephone || null,
        email:          form.email || null,
        groupe_sanguin: form.groupe_sanguin || null,
        adresse:        form.adresse || null,
      };
      if (isEdit) {
        await updatePatient(patient.id, payload);
      } else {
        await insertPatient(payload);
      }
      onSaved();
      onClose();
    } catch (e) {
      showError("Erreur : " + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={isEdit ? `Éditer — ${patient.prenom} ${patient.nom}` : "Nouveau patient"} onClose={onClose}>
      <Row>
        <Field label="Prénom *">
          <input style={inputStyle} value={form.prenom} onChange={set("prenom")} />
        </Field>
        <Field label="Nom *">
          <input style={inputStyle} value={form.nom} onChange={set("nom")} />
        </Field>
      </Row>
      <Row>
        <Field label="Date de naissance">
          <input style={inputStyle} type="date" value={form.date_naissance} onChange={set("date_naissance")} />
        </Field>
        <Field label="Genre">
          <select style={selectStyle} value={form.genre} onChange={set("genre")}>
            <option value="M">Masculin</option>
            <option value="F">Féminin</option>
          </select>
        </Field>
      </Row>
      <Row>
        <Field label="Téléphone">
          <input style={inputStyle} value={form.telephone} onChange={set("telephone")} placeholder="+225 07 00 00 00" />
        </Field>
        <Field label="Groupe sanguin">
          <select style={selectStyle} value={form.groupe_sanguin} onChange={set("groupe_sanguin")}>
            <option value="">—</option>
            {["A+","A-","B+","B-","AB+","AB-","O+","O-"].map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </Field>
      </Row>
      <Field label="Email">
        <input style={inputStyle} type="email" value={form.email} onChange={set("email")} />
      </Field>
      <Field label="Adresse">
        <input style={inputStyle} value={form.adresse} onChange={set("adresse")} />
      </Field>
      <ModalFooter onCancel={onClose} onSubmit={handleSave} submitLabel={isEdit ? "Sauvegarder" : "Ajouter le patient"} saving={saving} />
    </Modal>
  );
}

export default function Patients() {
  const isMobile = useIsMobile();

  const [search, setSearch]   = useState("");
  const [filtre, setFiltre]   = useState("");
  const { data: patients, loading, error, total, page, setPage, totalPages, refetch } = usePatientsPaginated(search, 20, filtre);
  const { toasts, success, error: showError } = useToast();
  const [selected, setSelected] = useState(null);
  const [modal, setModal] = useState(null); // null | "add" | "edit"

  return (
    <Layout title="Patients" subtitle="Dossiers patients et historique médicamenteux">
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
      <Toast toasts={toasts} />

      {(modal === "add" || modal === "edit") && (
        <PatientModal
          patient={modal === "edit" ? selected : null}
          onClose={() => setModal(null)}
          onSaved={() => {
            refetch();
            success(modal === "edit" ? "Dossier patient mis à jour" : "Patient ajouté avec succès");
          }}
        />
      )}

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 360px", gap: 20 }}>
        {/* ── Liste ── */}
        <div style={{ backgroundColor: colors.bgCard, borderRadius: 14, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: colors.navy }}>
                Patients ({loading ? "…" : total})
              </h3>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  placeholder="Rechercher…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ padding: "7px 14px", border: "1.5px solid var(--border)", borderRadius: 10, fontSize: 13, outline: "none", width: 200 }}
                />
                <button
                  onClick={() => setModal("add")}
                  style={{ padding: "7px 14px", backgroundColor: "#3B82F6", color: "white", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                  + Ajouter
                </button>
              </div>
            </div>
            {/* Filtres */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {[
                { key: "",               label: "Tous" },
                { key: "fidele",         label: "Fidèle (5+ visites)" },
                { key: "recurrent",      label: "Récurrent (2–4 visites)" },
                { key: "occasionnel",    label: "Occasionnel (1 visite)" },
                { key: "avec_allergies", label: "Avec allergies" },
                { key: "avec_mutuelle",  label: "Avec mutuelle" },
              ].map((f) => (
                <button key={f.key} onClick={() => { setFiltre(f.key); setPage?.(1); }} style={{
                  padding: "4px 12px", borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: "pointer", border: "none",
                  backgroundColor: filtre === f.key ? "#3B82F6" : "#F3F4F6",
                  color: filtre === f.key ? "white" : "#6B7280",
                }}>{f.label}</button>
              ))}
            </div>
          </div>

          {loading && [1, 2, 3, 4, 5].map((i) => <Skeleton key={i} />)}
          {error && !loading && (
            <div style={{ padding: "20px", fontSize: 13, color: "#DC2626", textAlign: "center" }}>Une erreur s'est produite. Veuillez réessayer.</div>
          )}
          {!loading && !error && patients.length === 0 && (
            <div style={{ padding: "40px 20px", textAlign: "center", color: colors.textMuted, fontSize: 13 }}>
              {search ? "Aucun patient trouvé" : "Aucun patient dans la base de données"}
            </div>
          )}

          {!loading && patients.map((p) => {
            const initials = `${p.prenom?.[0] || ""}${p.nom?.[0] || ""}`;
            const age = calcAge(p.date_naissance);
            const isF = p.genre === "F";
            return (
              <div
                key={p.id}
                onClick={() => setSelected(p)}
                style={{
                  padding: "14px 20px", display: "flex", alignItems: "center", gap: 14,
                  cursor: "pointer", borderBottom: "1px solid var(--border-light)",
                  backgroundColor: selected?.id === p.id ? "#EFF6FF" : "white",
                  transition: "background 0.15s",
                }}
              >
                <div style={{
                  width: 40, height: 40, borderRadius: "50%", flexShrink: 0,
                  backgroundColor: isF ? "#FCE7F3" : "#DBEAFE",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 14, fontWeight: 800, color: isF ? "#9D174D" : "#1D4ED8",
                }}>
                  {initials}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: colors.navy }}>{p.prenom} {p.nom}</div>
                  <div style={{ fontSize: 12, color: colors.textMuted }}>
                    {age} ans · Gr. {p.groupe_sanguin || "—"} · {p.telephone || "—"}
                  </div>
                </div>
              </div>
            );
          })}
          <Pagination page={page} totalPages={totalPages} total={total} onPage={setPage} />
        </div>

        {/* ── Fiche patient ── */}
        <div style={{ backgroundColor: colors.bgCard, borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          {!selected ? (
            <div style={{ textAlign: "center", color: colors.textMuted, fontSize: 13, paddingTop: 60 }}>
              <div style={{ width: 48, height: 48, backgroundColor: colors.bg, borderRadius: 12, margin: "0 auto 12px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                </svg>
              </div>
              Sélectionnez un patient pour voir son dossier
            </div>
          ) : (
            <>
              <div style={{ textAlign: "center", marginBottom: 20 }}>
                <div style={{
                  width: 64, height: 64, borderRadius: "50%", margin: "0 auto 10px",
                  backgroundColor: selected.genre === "F" ? "#FCE7F3" : "#DBEAFE",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 24, fontWeight: 800,
                  color: selected.genre === "F" ? "#9D174D" : "#1D4ED8",
                }}>
                  {selected.prenom?.[0]}{selected.nom?.[0]}
                </div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: colors.navy }}>
                  {selected.prenom} {selected.nom}
                </h3>
                <div style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
                  ID : {selected.id?.slice(0, 8).toUpperCase()}
                </div>
              </div>

              {[
                { label: "Âge",            value: `${calcAge(selected.date_naissance)} ans` },
                { label: "Genre",          value: selected.genre === "M" ? "Masculin" : selected.genre === "F" ? "Féminin" : "—" },
                { label: "Groupe sanguin", value: selected.groupe_sanguin || "—" },
                { label: "Téléphone",      value: selected.telephone || "—" },
                { label: "Email",          value: selected.email || "—" },
                { label: "Enregistré le",  value: formatDate(selected.created_at) },
              ].map((item) => (
                <div key={item.label} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--border-light)" }}>
                  <span style={{ fontSize: 13, color: colors.textSecondary }}>{item.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: colors.navy }}>{item.value}</span>
                </div>
              ))}

              {selected.antecedents?.length > 0 && (
                <div style={{ marginTop: 14 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: colors.text, marginBottom: 8 }}>Antécédents</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {selected.antecedents.map((m) => (
                      <span key={m} style={{ padding: "4px 12px", backgroundColor: "#FFFBEB", color: "#F59E0B", borderRadius: 10, fontSize: 12, fontWeight: 700 }}>{m}</span>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
                <button
                  onClick={() => setModal("edit")}
                  style={{ flex: 1, padding: "10px", backgroundColor: "#3B82F6", color: "white", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                  Éditer profil
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}
