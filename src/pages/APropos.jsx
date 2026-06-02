import { Link } from "react-router-dom";

const APP_VERSION = "1.0.0";

const CARD = ({ titre, children }) => (
  <div style={{
    backgroundColor: "white",
    border: "1px solid #E5E7EB",
    borderRadius: 14,
    padding: "24px 28px",
    marginBottom: 20,
  }}>
    <h2 style={{ fontSize: 14, fontWeight: 700, color: "#0A1628", margin: "0 0 12px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
      {titre}
    </h2>
    <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.8 }}>{children}</div>
  </div>
);

const INFO = ({ label, value }) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #F3F4F6" }}>
    <span style={{ fontSize: 12, color: "#6B7280" }}>{label}</span>
    <span style={{ fontSize: 12, fontWeight: 600, color: "#0A1628" }}>{value}</span>
  </div>
);

export default function APropos() {
  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#F8FAFC", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      {/* Header */}
      <div style={{ backgroundColor: "#0A1628", padding: "18px 32px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Link to="/" style={{ textDecoration: "none" }}>
          <span style={{ color: "#3B82F6", fontWeight: 900, fontSize: 20 }}>Med</span>
          <span style={{ color: "white",   fontWeight: 900, fontSize: 20 }}>OS</span>
        </Link>
        <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 12 }}>A propos</span>
      </div>

      <div style={{ maxWidth: 780, margin: "0 auto", padding: "48px 24px" }}>
        {/* Hero */}
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 64, height: 64,
            backgroundColor: "#0A1628",
            borderRadius: 16,
            marginBottom: 16,
          }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
            </svg>
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: "#0A1628", margin: "0 0 6px" }}>
            <span style={{ color: "#3B82F6" }}>Med</span>OS
          </h1>
          <p style={{ fontSize: 14, color: "#6B7280", margin: 0 }}>
            Intelligence Medicale Africaine
          </p>
        </div>

        <CARD titre="Notre mission">
          <p style={{ margin: 0 }}>
            MedOS est la plateforme SaaS medicale qui connecte les acteurs du systeme de sante en Afrique :
            pharmacies, hopitaux, distributeurs pharmaceutiques et autorites sanitaires. Notre mission est
            d'ameliorer la gestion des medicaments, la tracabilite des stocks et la coordination entre
            etablissements pour des soins de meilleure qualite.
          </p>
        </CARD>

        <CARD titre="Kela Group">
          <p>
            MedOS est developpe par Kela Group, entreprise specialisee dans les solutions technologiques
            pour le secteur de la sante en Afrique. Nous concevons des outils adaptes aux realites et
            contraintes du terrain, avec une approche centree sur l'utilisateur.
          </p>
          <p style={{ marginTop: 10, marginBottom: 0 }}>
            Contact :{" "}
            <a href="mailto:contact@kelagroup.org" style={{ color: "#3B82F6" }}>contact@kelagroup.org</a>
          </p>
        </CARD>

        <CARD titre="Informations techniques">
          <INFO label="Version de l'application" value={`v${APP_VERSION}`} />
          <INFO label="Plateforme"               value="MedOS SaaS" />
          <INFO label="Hebergement"              value="Supabase (infrastructure securisee)" />
          <INFO label="Donnees chiffrees"         value="TLS en transit — AES au repos" />
          <INFO label="Support"                  value="contact@kelagroup.org" />
        </CARD>

        <CARD titre="Modules disponibles">
          {[
            ["Pharmacie",   "Gestion des stocks, caisse, ordonnances, fournisseurs, rapports"],
            ["Hopital",     "Stock hospitalier, patients, reseau de redistribution, alertes"],
            ["Distributeur","Gestion entrepot, livraisons, tracabilite, previsions"],
            ["Autorite",    "Vue nationale, epidemiologie, lutte anti-contrefacons, ODD"],
          ].map(([role, desc]) => (
            <div key={role} style={{ padding: "8px 0", borderBottom: "1px solid #F3F4F6" }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#0A1628" }}>{role}</span>
              <span style={{ fontSize: 12, color: "#6B7280", marginLeft: 10 }}>{desc}</span>
            </div>
          ))}
        </CARD>

        <div style={{ marginTop: 40, paddingTop: 24, borderTop: "1px solid #E5E7EB", display: "flex", gap: 16, flexWrap: "wrap" }}>
          <Link to="/"               style={{ fontSize: 12, color: "#6B7280", textDecoration: "none" }}>Retour a l'accueil</Link>
          <Link to="/cgu"            style={{ fontSize: 12, color: "#6B7280", textDecoration: "none" }}>Conditions d'utilisation</Link>
          <Link to="/confidentialite" style={{ fontSize: 12, color: "#6B7280", textDecoration: "none" }}>Confidentialite</Link>
        </div>
      </div>
    </div>
  );
}
