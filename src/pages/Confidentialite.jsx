import { Link } from "react-router-dom";

const SECTION = ({ titre, children }) => (
  <section style={{ marginBottom: 32 }}>
    <h2 style={{ fontSize: 16, fontWeight: 700, color: "#0A1628", marginBottom: 10, marginTop: 0 }}>{titre}</h2>
    <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.8 }}>{children}</div>
  </section>
);

export default function Confidentialite() {
  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#F8FAFC", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      {/* Header */}
      <div style={{ backgroundColor: "#0A1628", padding: "18px 32px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Link to="/" style={{ textDecoration: "none" }}>
          <span style={{ color: "#3B82F6", fontWeight: 900, fontSize: 20 }}>Med</span>
          <span style={{ color: "white",   fontWeight: 900, fontSize: 20 }}>OS</span>
        </Link>
        <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 12 }}>Documents legaux</span>
      </div>

      <div style={{ maxWidth: 780, margin: "0 auto", padding: "48px 24px" }}>
        <div style={{ marginBottom: 36 }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: "#0A1628", margin: "0 0 6px" }}>
            Politique de Confidentialite
          </h1>
          <p style={{ fontSize: 12, color: "#9CA3AF", margin: 0 }}>
            Version 1.0 — En vigueur depuis le 1er janvier 2025
          </p>
        </div>

        <SECTION titre="1. Responsable du traitement">
          <p>
            Le responsable du traitement des donnees personnelles collectees via MedOS est Kela Group.
            Pour toute question relative au traitement de vos donnees, contactez-nous a :{" "}
            <a href="mailto:contact@kelagroup.org" style={{ color: "#3B82F6" }}>contact@kelagroup.org</a>
          </p>
        </SECTION>

        <SECTION titre="2. Donnees collectees">
          <p>MedOS collecte les categories de donnees suivantes :</p>
          <ul style={{ marginTop: 8, paddingLeft: 20 }}>
            <li style={{ marginBottom: 6 }}>
              <strong>Donnees d'identification :</strong> nom de l'etablissement, adresse, numero de licence,
              coordonnees du responsable (nom, prenom, email, telephone).
            </li>
            <li style={{ marginBottom: 6 }}>
              <strong>Donnees d'utilisation :</strong> actions effectuees sur la plateforme, dates et
              horaires de connexion, pages visitees.
            </li>
            <li style={{ marginBottom: 6 }}>
              <strong>Donnees metier :</strong> stocks de medicaments, ordonnances, transactions, donnees
              patients (dans le cadre de l'utilisation du module hopital).
            </li>
          </ul>
        </SECTION>

        <SECTION titre="3. Finalites du traitement">
          <p>Les donnees collectees sont utilisees aux fins suivantes :</p>
          <ul style={{ marginTop: 8, paddingLeft: 20 }}>
            <li style={{ marginBottom: 6 }}>Fourniture et amelioration des services MedOS</li>
            <li style={{ marginBottom: 6 }}>Verification de l'eligibilite et validation des comptes</li>
            <li style={{ marginBottom: 6 }}>Envoi de notifications operationnelles et de communications de service</li>
            <li style={{ marginBottom: 6 }}>Detection et prevention des activites frauduleuses</li>
            <li style={{ marginBottom: 6 }}>Respect des obligations legales et reglementaires</li>
          </ul>
        </SECTION>

        <SECTION titre="4. Base legale du traitement">
          <p>
            Le traitement de vos donnees repose sur : l'execution du contrat (fourniture du service),
            le respect d'obligations legales, et, pour certaines communications, votre consentement
            expresse lors de l'inscription.
          </p>
        </SECTION>

        <SECTION titre="5. Hebergement et securite des donnees">
          <p>
            Les donnees MedOS sont hebergees sur l'infrastructure Supabase, beneficiant de chiffrement
            en transit (TLS) et au repos. Les acces sont controles par des politiques de securite
            strictes. Kela Group applique des mesures techniques et organisationnelles appropriees pour
            proteger vos donnees contre tout acces non autorise, perte ou alteration.
          </p>
        </SECTION>

        <SECTION titre="6. Duree de conservation">
          <p>
            Les donnees sont conservees pendant la duree de la relation contractuelle et jusqu'a
            5 ans apres la resiliation du compte, sauf obligation legale de conservation plus longue.
            Les donnees patients sont conservees conformement aux obligations legales du secteur de sante
            applicables dans le pays d'utilisation.
          </p>
        </SECTION>

        <SECTION titre="7. Partage des donnees">
          <p>
            Kela Group ne vend pas vos donnees personnelles. Elles peuvent etre partagees uniquement avec :
          </p>
          <ul style={{ marginTop: 8, paddingLeft: 20 }}>
            <li style={{ marginBottom: 6 }}>Les sous-traitants techniques necessaires au fonctionnement du service (hebergement, emails transactionnels)</li>
            <li style={{ marginBottom: 6 }}>Les autorites competentes en cas d'obligation legale</li>
          </ul>
        </SECTION>

        <SECTION titre="8. Vos droits">
          <p>
            Conformement aux reglementations applicables, vous disposez des droits suivants sur vos
            donnees personnelles : droit d'acces, de rectification, d'effacement, de portabilite,
            d'opposition et de limitation du traitement.
          </p>
          <p style={{ marginTop: 10 }}>
            Pour exercer ces droits, contactez-nous a :{" "}
            <a href="mailto:contact@kelagroup.org" style={{ color: "#3B82F6" }}>contact@kelagroup.org</a>.
            Nous repondrons dans un delai maximum de 30 jours.
          </p>
        </SECTION>

        <SECTION titre="9. Cookies">
          <p>
            MedOS utilise uniquement des cookies techniques strictement necessaires au fonctionnement
            de la plateforme (session d'authentification). Aucun cookie publicitaire ou de suivi tiers
            n'est utilise.
          </p>
        </SECTION>

        <SECTION titre="10. Modifications">
          <p>
            Cette politique peut etre mise a jour. Toute modification substantielle sera communiquee
            par email aux utilisateurs au moins 15 jours avant son entree en vigueur.
          </p>
        </SECTION>

        <div style={{ marginTop: 40, paddingTop: 24, borderTop: "1px solid #E5E7EB", display: "flex", gap: 16, flexWrap: "wrap" }}>
          <Link to="/"    style={{ fontSize: 12, color: "#6B7280", textDecoration: "none" }}>Retour a l'accueil</Link>
          <Link to="/cgu" style={{ fontSize: 12, color: "#6B7280", textDecoration: "none" }}>Conditions d'utilisation</Link>
          <Link to="/a-propos" style={{ fontSize: 12, color: "#6B7280", textDecoration: "none" }}>A propos</Link>
        </div>
      </div>
    </div>
  );
}
