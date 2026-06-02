import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";

// ─── constantes ──────────────────────────────────────────────────────────────
const ROLES = [
  {
    key: "pharmacie",
    label: "Pharmacie",
    desc: "Officine, pharmacie communautaire ou hospitalière",
  },
  {
    key: "hopital",
    label: "Hôpital / Clinique",
    desc: "Structure hospitalière publique ou privée",
  },
  {
    key: "distributeur",
    label: "Distributeur pharmaceutique",
    desc: "Grossiste ou distributeur de médicaments",
  },
  {
    key: "autorite",
    label: "Autorité sanitaire",
    desc: "Ministère de la santé, agence de régulation",
  },
];

const PAYS = [
  "Côte d'Ivoire", "Sénégal", "Mali", "Burkina Faso", "Niger",
  "Guinée", "Bénin", "Togo", "Cameroun", "Congo", "RD Congo",
  "Gabon", "Tchad", "Centrafrique", "Madagascar", "Autre",
];

// ─── styles ───────────────────────────────────────────────────────────────────
const inputStyle = {
  width: "100%",
  padding: "10px 14px",
  border: "1.5px solid #E5E7EB",
  borderRadius: 8,
  fontSize: 13,
  outline: "none",
  boxSizing: "border-box",
  color: "#0A1628",
  backgroundColor: "white",
};

const labelStyle = {
  display: "block",
  fontSize: 12,
  fontWeight: 600,
  color: "#374151",
  marginBottom: 5,
};

function Field({ label, required, children, hint }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={labelStyle}>
        {label}
        {required && <span style={{ color: "#EF4444", marginLeft: 2 }}>*</span>}
      </label>
      {children}
      {hint && <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 3 }}>{hint}</div>}
    </div>
  );
}

function Row({ children }) {
  return <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>{children}</div>;
}

function SectionTitle({ children }) {
  return (
    <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 14, marginTop: 8, paddingBottom: 6, borderBottom: "1px solid #F3F4F6" }}>
      {children}
    </div>
  );
}

// ─── Étape 1 — Choix du rôle ─────────────────────────────────────────────────
function EtapeRole({ value, onChange }) {
  return (
    <div>
      <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 20 }}>
        Sélectionnez le type de votre structure de santé.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {ROLES.map((r) => (
          <button
            key={r.key}
            type="button"
            onClick={() => onChange(r.key)}
            style={{
              padding: "16px",
              borderRadius: 10,
              border: value === r.key ? "2px solid #3B82F6" : "1.5px solid #E5E7EB",
              backgroundColor: value === r.key ? "#EFF6FF" : "white",
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 700, color: value === r.key ? "#2563EB" : "#0A1628", marginBottom: 4 }}>
              {r.label}
            </div>
            <div style={{ fontSize: 11, color: "#9CA3AF" }}>{r.desc}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Champs spécifiques par rôle ─────────────────────────────────────────────
function ChampsSpecifiques({ role, form, onChange }) {
  const set = (k) => (e) => onChange({ ...form, [k]: e.target.value });

  if (role === "pharmacie") return (
    <>
      <SectionTitle>Informations spécifiques — Pharmacie</SectionTitle>
      <Row>
        <Field label="Type d'établissement" required>
          <select style={{ ...inputStyle, cursor: "pointer" }} value={form.type_etablissement || ""} onChange={set("type_etablissement")}>
            <option value="">— Sélectionner —</option>
            <option value="officine">Officine</option>
            <option value="hospitaliere">Pharmacie hospitalière</option>
            <option value="communautaire">Pharmacie communautaire</option>
          </select>
        </Field>
        <Field label="Nombre de pharmaciens" required>
          <input style={inputStyle} type="number" min="1" value={form.nb_pharmaciens || ""} onChange={set("nb_pharmaciens")} placeholder="Ex: 2" />
        </Field>
      </Row>
      <Field label="Horaires d'ouverture">
        <input style={inputStyle} value={form.horaires || ""} onChange={set("horaires")} placeholder="Ex: Lun–Sam 08h–20h, Dim 09h–13h" />
      </Field>
    </>
  );

  if (role === "hopital") return (
    <>
      <SectionTitle>Informations spécifiques — Hôpital / Clinique</SectionTitle>
      <Row>
        <Field label="Type d'établissement" required>
          <select style={{ ...inputStyle, cursor: "pointer" }} value={form.type_etablissement || ""} onChange={set("type_etablissement")}>
            <option value="">— Sélectionner —</option>
            <option value="public">Hôpital public</option>
            <option value="prive">Hôpital privé</option>
            <option value="clinique">Clinique</option>
            <option value="chru">CHRU / CHU</option>
          </select>
        </Field>
        <Field label="Nombre de lits">
          <input style={inputStyle} type="number" min="1" value={form.nb_lits || ""} onChange={set("nb_lits")} placeholder="Ex: 120" />
        </Field>
      </Row>
      <Field label="Spécialités principales">
        <input style={inputStyle} value={form.specialites || ""} onChange={set("specialites")} placeholder="Ex: Pédiatrie, Chirurgie, Maternité, Cardiologie" />
      </Field>
    </>
  );

  if (role === "distributeur") return (
    <>
      <SectionTitle>Informations spécifiques — Distributeur</SectionTitle>
      <Row>
        <Field label="Zone de distribution" required>
          <input style={inputStyle} value={form.zone_distribution || ""} onChange={set("zone_distribution")} placeholder="Ex: Grand Abidjan, Sud du pays" />
        </Field>
        <Field label="Nombre de clients (établissements)">
          <input style={inputStyle} type="number" min="0" value={form.nb_clients || ""} onChange={set("nb_clients")} placeholder="Ex: 45" />
        </Field>
      </Row>
      <Field label="Types de médicaments distribués">
        <input style={inputStyle} value={form.types_medicaments || ""} onChange={set("types_medicaments")} placeholder="Ex: Médicaments essentiels, vaccins, dispositifs médicaux" />
      </Field>
    </>
  );

  if (role === "autorite") return (
    <>
      <SectionTitle>Informations spécifiques — Autorité sanitaire</SectionTitle>
      <Row>
        <Field label="Organisation de rattachement" required>
          <input style={inputStyle} value={form.organisation || ""} onChange={set("organisation")} placeholder="Ex: Ministère de la Santé, DPM, ANRP" />
        </Field>
        <Field label="Région / Département couvert" required>
          <input style={inputStyle} value={form.region || ""} onChange={set("region")} placeholder="Ex: Abidjan, Région des Lagunes, National" />
        </Field>
      </Row>
    </>
  );

  return null;
}

// ─── Étape 2 — Formulaire complet ────────────────────────────────────────────
function EtapeFormulaire({ form, onChange }) {
  const set = (k) => (e) => onChange({ ...form, [k]: e.target.value });

  return (
    <div>
      <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 18 }}>
        Renseignez les informations de votre établissement et les coordonnées du responsable.
      </p>

      {/* Établissement */}
      <SectionTitle>Établissement — {ROLES.find((r) => r.key === form.role)?.label}</SectionTitle>

      <Field label="Nom officiel de l'établissement" required>
        <input style={inputStyle} value={form.nom} onChange={set("nom")} placeholder="Ex: Pharmacie Centrale de Cocody" />
      </Field>

      <Field label="Adresse complète (rue, quartier)" required>
        <input style={inputStyle} value={form.adresse || ""} onChange={set("adresse")} placeholder="Ex: 12 Avenue Christiane Gbagbo, Cocody" />
      </Field>

      <Row>
        <Field label="Ville" required>
          <input style={inputStyle} value={form.ville} onChange={set("ville")} placeholder="Ex: Abidjan" />
        </Field>
        <Field label="Pays" required>
          <select style={{ ...inputStyle, cursor: "pointer" }} value={form.pays} onChange={set("pays")}>
            <option value="">— Sélectionner —</option>
            {PAYS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </Field>
      </Row>

      <Field
        label="Numéro de licence officielle du Ministère de la Santé"
        required
        hint="Ce numéro sera vérifié lors de la validation de votre demande."
      >
        <input style={inputStyle} value={form.licence} onChange={set("licence")} placeholder="Ex: MSP-LIC-2024-00123" />
      </Field>

      {/* Champs spécifiques au rôle */}
      <ChampsSpecifiques role={form.role} form={form} onChange={onChange} />

      {/* Responsable */}
      <SectionTitle>Responsable de l'établissement</SectionTitle>

      <Row>
        <Field label="Prénom" required>
          <input style={inputStyle} value={form.responsable_prenom || ""} onChange={set("responsable_prenom")} placeholder="Ex: Marie" />
        </Field>
        <Field label="Nom" required>
          <input style={inputStyle} value={form.responsable_nom || ""} onChange={set("responsable_nom")} placeholder="Ex: Kouassi" />
        </Field>
      </Row>

      <Field label="Téléphone principal" required>
        <input style={inputStyle} type="tel" value={form.telephone || ""} onChange={set("telephone")} placeholder="Ex: +225 07 00 00 00 00" />
      </Field>

      {/* Compte */}
      <SectionTitle>Compte administrateur</SectionTitle>

      <Field label="Adresse email professionnelle" required hint="Cet email servira d'identifiant de connexion.">
        <input style={inputStyle} type="email" value={form.email} onChange={set("email")} placeholder="responsable@etablissement.com" />
      </Field>

      <Row>
        <Field label="Mot de passe" required hint="Minimum 8 caractères.">
          <input style={inputStyle} type="password" value={form.password} onChange={set("password")} placeholder="Min. 8 caractères" />
        </Field>
        <Field label="Confirmer le mot de passe" required>
          <input style={inputStyle} type="password" value={form.passwordConfirm} onChange={set("passwordConfirm")} placeholder="Identique au mot de passe" />
        </Field>
      </Row>

      {/* Note gestion du personnel */}
      <div style={{ marginTop: 6, padding: "12px 16px", backgroundColor: "#F0F4FB", borderRadius: 10, border: "1px solid #DBEAFE" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#1D4ED8", marginBottom: 4 }}>Gestion du personnel</div>
        <div style={{ fontSize: 12, color: "#374151", lineHeight: 1.6 }}>
          Une fois votre compte validé par MedOS, vous pourrez inviter votre personnel depuis les paramètres de votre compte.
          Chaque membre recevra un email d'invitation avec un rôle défini (caissier, pharmacien, médecin, infirmière…)
          et accèdera uniquement aux fonctionnalités correspondant à son rôle.
        </div>
      </div>
    </div>
  );
}

// ─── Étape 3 — Confirmation ───────────────────────────────────────────────────
function EtapeConfirmation({ email }) {
  const navigate = useNavigate();
  return (
    <div style={{ textAlign: "center", padding: "20px 0" }}>
      <div style={{ width: 56, height: 56, borderRadius: "50%", backgroundColor: "#DCFCE7", border: "2px solid #16A34A", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", fontSize: 22, color: "#16A34A", fontWeight: 800 }}>
        ✓
      </div>
      <h2 style={{ fontSize: 18, fontWeight: 800, color: "#0A1628", marginBottom: 10 }}>
        Demande envoyée avec succès
      </h2>
      <p style={{ fontSize: 13, color: "#6B7280", maxWidth: 380, margin: "0 auto 20px", lineHeight: 1.6 }}>
        Votre demande d'accès à MedOS a bien été reçue et est en cours d'examen.
        Vous recevrez une réponse à <strong style={{ color: "#0A1628" }}>{email}</strong> dans un délai de 24 à 48 heures ouvrées.
      </p>
      <div style={{ backgroundColor: "#FFFBEB", border: "1px solid #FCD34D", borderRadius: 10, padding: "12px 18px", fontSize: 12, color: "#92400E", marginBottom: 24, textAlign: "left", maxWidth: 380, margin: "0 auto 24px", lineHeight: 1.6 }}>
        <strong>Prochaine étape :</strong> une fois votre compte validé, connectez-vous sur la page de connexion
        avec votre adresse email et le mot de passe choisi lors de l'inscription.
        Vous pourrez ensuite inviter votre équipe depuis les paramètres.
      </div>
      <button
        onClick={() => navigate("/")}
        style={{ padding: "11px 28px", backgroundColor: "#3B82F6", color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
      >
        Retour à la connexion
      </button>
    </div>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────
const EMPTY_FORM = {
  role: "",
  nom: "", adresse: "", licence: "", ville: "", pays: "",
  responsable_prenom: "", responsable_nom: "", telephone: "",
  email: "", password: "", passwordConfirm: "",
  // pharmacie
  type_etablissement: "", nb_pharmaciens: "", horaires: "",
  // hopital
  nb_lits: "", specialites: "",
  // distributeur
  zone_distribution: "", nb_clients: "", types_medicaments: "",
  // autorite
  organisation: "", region: "",
};

const ETAPES = ["Type de structure", "Informations", "Confirmation"];

export default function Inscription() {
  const navigate = useNavigate();
  const [etape, setEtape] = useState(0);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [erreur, setErreur] = useState(null);
  const [emailConfirme, setEmailConfirme] = useState("");

  const validerEtape0 = () => {
    if (!form.role) { setErreur("Veuillez choisir un type de structure."); return false; }
    return true;
  };

  const validerEtape1 = () => {
    if (!form.nom.trim()) { setErreur("Le nom de l'établissement est obligatoire."); return false; }
    if (!form.adresse?.trim()) { setErreur("L'adresse est obligatoire."); return false; }
    if (!form.ville.trim()) { setErreur("La ville est obligatoire."); return false; }
    if (!form.pays) { setErreur("Le pays est obligatoire."); return false; }
    if (!form.licence.trim()) { setErreur("Le numéro de licence est obligatoire."); return false; }
    if (!form.responsable_prenom?.trim() || !form.responsable_nom?.trim()) { setErreur("Le nom et prénom du responsable sont obligatoires."); return false; }
    if (!form.telephone?.trim()) { setErreur("Le téléphone est obligatoire."); return false; }
    if (!form.email.trim()) { setErreur("L'email est obligatoire."); return false; }
    if (form.password.length < 8) { setErreur("Le mot de passe doit contenir au moins 8 caractères."); return false; }
    if (form.password !== form.passwordConfirm) { setErreur("Les mots de passe ne correspondent pas."); return false; }
    // Champs spécifiques obligatoires
    if (form.role === "pharmacie" && !form.type_etablissement) { setErreur("Veuillez préciser le type de pharmacie."); return false; }
    if (form.role === "hopital" && !form.type_etablissement) { setErreur("Veuillez préciser le type d'établissement hospitalier."); return false; }
    if (form.role === "distributeur" && !form.zone_distribution?.trim()) { setErreur("La zone de distribution est obligatoire."); return false; }
    if (form.role === "autorite" && (!form.organisation?.trim() || !form.region?.trim())) { setErreur("L'organisation de rattachement et la région sont obligatoires."); return false; }
    return true;
  };

  const handleSuivant = () => {
    setErreur(null);
    if (etape === 0 && !validerEtape0()) return;
    if (etape === 1 && !validerEtape1()) return;
    setEtape((e) => e + 1);
  };

  const handleSoumettre = async () => {
    setErreur(null);
    if (!validerEtape1()) return;
    setSaving(true);
    try {
      // 1. Créer le compte Supabase Auth
      const { error: signUpError } = await supabase.auth.signUp({
        email: form.email.trim(),
        password: form.password,
        options: { data: { role: form.role } },
      });
      if (signUpError) throw new Error(signUpError.message);

      // 2. Construire le payload établissement
      const payload = {
        nom: form.nom.trim(),
        type: form.role,
        ville: form.ville.trim(),
        pays: form.pays,
        email: form.email.trim(),
        adresse: form.adresse?.trim() || null,
        licence_numero: form.licence.trim(),
        statut_inscription: "en_attente",
        actif: false,
        notes_inscription: {
          responsable_prenom: form.responsable_prenom?.trim() || null,
          responsable_nom: form.responsable_nom?.trim() || null,
          telephone: form.telephone?.trim() || null,
          // pharmacie
          ...(form.role === "pharmacie" ? {
            type_etablissement: form.type_etablissement,
            nb_pharmaciens: form.nb_pharmaciens || null,
            horaires: form.horaires?.trim() || null,
          } : {}),
          // hopital
          ...(form.role === "hopital" ? {
            type_etablissement: form.type_etablissement,
            nb_lits: form.nb_lits || null,
            specialites: form.specialites?.trim() || null,
          } : {}),
          // distributeur
          ...(form.role === "distributeur" ? {
            zone_distribution: form.zone_distribution?.trim() || null,
            nb_clients: form.nb_clients || null,
            types_medicaments: form.types_medicaments?.trim() || null,
          } : {}),
          // autorite
          ...(form.role === "autorite" ? {
            organisation: form.organisation?.trim() || null,
            region: form.region?.trim() || null,
          } : {}),
        },
      };

      const { error: insertError } = await supabase.from("etablissements").insert(payload);
      if (insertError) throw new Error(insertError.message);

      // 3. Envoyer les emails d'inscription (confirmation + notification admin) — non bloquant
      try {
        await supabase.functions.invoke("send-inscription-email", {
          body: {
            nom:              payload.nom,
            type:             payload.type,
            ville:            payload.ville,
            pays:             payload.pays,
            email:            payload.email,
            adresse:          payload.adresse ?? null,
            licence_numero:   payload.licence_numero,
            notes_inscription: payload.notes_inscription,
          },
        });
      } catch (emailErr) {
        // Un echec d'email ne doit pas bloquer l'inscription
        console.error("[inscription] Echec envoi emails:", emailErr);
      }

      // 4. Déconnecter — le compte n'est pas encore validé
      await supabase.auth.signOut();

      setEmailConfirme(form.email.trim());
      setEtape(2);
    } catch (e) {
      setErreur(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#F8FAFC", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "40px 20px" }}>
      <div style={{ width: "100%", maxWidth: 600 }}>

        {/* En-tête */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 26, fontWeight: 900, color: "#0A1628", letterSpacing: "-0.5px", marginBottom: 4 }}>
            Med<span style={{ color: "#3B82F6" }}>OS</span>
          </div>
          <div style={{ fontSize: 13, color: "#9CA3AF" }}>Demande d'accès à la plateforme</div>
        </div>

        {/* Carte */}
        <div style={{ backgroundColor: "white", borderRadius: 16, boxShadow: "0 4px 24px rgba(0,0,0,0.08)", padding: "28px 32px" }}>

          {/* Stepper */}
          {etape < 2 && (
            <div style={{ display: "flex", alignItems: "center", marginBottom: 26 }}>
              {ETAPES.slice(0, 2).map((label, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", flex: i < 1 ? 1 : "initial" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{
                      width: 26, height: 26, borderRadius: "50%",
                      backgroundColor: i < etape ? "#10B981" : i === etape ? "#3B82F6" : "#E5E7EB",
                      color: i <= etape ? "white" : "#9CA3AF",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 11, fontWeight: 700, flexShrink: 0,
                    }}>
                      {i < etape ? "✓" : i + 1}
                    </div>
                    <span style={{ fontSize: 12, fontWeight: i === etape ? 700 : 400, color: i === etape ? "#0A1628" : "#9CA3AF", whiteSpace: "nowrap" }}>
                      {label}
                    </span>
                  </div>
                  {i < 1 && <div style={{ flex: 1, height: 1, backgroundColor: i < etape ? "#10B981" : "#E5E7EB", margin: "0 10px" }} />}
                </div>
              ))}
            </div>
          )}

          {/* Titre */}
          {etape < 2 && (
            <h2 style={{ fontSize: 16, fontWeight: 800, color: "#0A1628", marginBottom: 18 }}>
              {etape === 0 ? "Quel type de structure représentez-vous ?" : "Informations de votre établissement"}
            </h2>
          )}

          {/* Contenu scrollable pour étape 2 */}
          <div style={etape === 1 ? { maxHeight: "60vh", overflowY: "auto", paddingRight: 4 } : {}}>
            {etape === 0 && <EtapeRole value={form.role} onChange={(r) => setForm((f) => ({ ...f, role: r }))} />}
            {etape === 1 && <EtapeFormulaire form={form} onChange={setForm} />}
            {etape === 2 && <EtapeConfirmation email={emailConfirme} />}
          </div>

          {/* Erreur */}
          {erreur && (
            <div style={{ marginTop: 14, padding: "10px 14px", backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, fontSize: 13, color: "#DC2626" }}>
              {erreur}
            </div>
          )}

          {/* Navigation */}
          {etape < 2 && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 22, paddingTop: 18, borderTop: "1px solid #F3F4F6" }}>
              <button
                type="button"
                onClick={() => etape === 0 ? navigate("/") : setEtape((e) => e - 1)}
                style={{ padding: "10px 20px", backgroundColor: "white", border: "1.5px solid #E5E7EB", borderRadius: 8, fontSize: 13, color: "#6B7280", cursor: "pointer", fontWeight: 600 }}
              >
                {etape === 0 ? "Retour à la connexion" : "Précédent"}
              </button>

              {etape === 0 && (
                <button type="button" onClick={handleSuivant} disabled={!form.role} style={{
                  padding: "10px 24px", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700,
                  backgroundColor: form.role ? "#3B82F6" : "#E5E7EB",
                  color: form.role ? "white" : "#9CA3AF",
                  cursor: form.role ? "pointer" : "not-allowed",
                }}>
                  Suivant
                </button>
              )}

              {etape === 1 && (
                <button type="button" onClick={handleSoumettre} disabled={saving} style={{
                  padding: "10px 24px", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700,
                  backgroundColor: saving ? "#E5E7EB" : "#10B981",
                  color: saving ? "#9CA3AF" : "white",
                  cursor: saving ? "not-allowed" : "pointer",
                }}>
                  {saving ? "Envoi en cours…" : "Soumettre la demande"}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
