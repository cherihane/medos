import { Link } from "react-router-dom";

const SECTION = ({ titre, children }) => (
  <section style={{ marginBottom: 32 }}>
    <h2 style={{ fontSize: 16, fontWeight: 700, color: "#0A1628", marginBottom: 10, marginTop: 0 }}>{titre}</h2>
    <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.8 }}>{children}</div>
  </section>
);

export default function CGU() {
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
            Conditions Generales d'Utilisation
          </h1>
          <p style={{ fontSize: 12, color: "#9CA3AF", margin: 0 }}>
            Version 1.0 — En vigueur depuis le 1er janvier 2025
          </p>
        </div>

        <SECTION titre="1. Objet">
          <p>
            Les presentes Conditions Generales d'Utilisation (CGU) regissent l'acces et l'utilisation de la
            plateforme MedOS, editee par Kela Group. En accedant a la plateforme, l'utilisateur accepte
            sans reserve les presentes CGU.
          </p>
          <p style={{ marginTop: 10 }}>
            MedOS est une plateforme SaaS destinee aux professionnels de la sante et aux organismes du
            secteur pharmaceutique en Afrique : pharmacies, hopitaux, distributeurs pharmaceutiques et
            autorites sanitaires.
          </p>
        </SECTION>

        <SECTION titre="2. Acces a la plateforme">
          <p>
            L'acces a MedOS est conditionne a la creation d'un compte et a la validation manuelle par
            l'equipe Kela Group. Chaque organisme doit fournir un numero de licence officiel delivre par
            le Ministere de la Sante competent. Kela Group se reserve le droit de refuser ou de suspendre
            tout compte ne respectant pas les conditions d'eligibilite.
          </p>
          <p style={{ marginTop: 10 }}>
            L'utilisateur s'engage a fournir des informations exactes, completes et a jour lors de
            l'inscription et a notifier immediatement Kela Group de toute modification.
          </p>
        </SECTION>

        <SECTION titre="3. Propriete intellectuelle">
          <p>
            L'ensemble des elements constitutifs de MedOS (interfaces, contenus, marques, logos,
            algorithmes, base de donnees) est la propriete exclusive de Kela Group et est protege par le
            droit de la propriete intellectuelle applicable. Toute reproduction, representation,
            modification ou exploitation non autorisee est strictement interdite.
          </p>
        </SECTION>

        <SECTION titre="4. Responsabilites">
          <p>
            MedOS fournit des outils d'aide a la gestion pharmaceutique et medicale. Les informations
            affichees ne constituent pas un conseil medical. L'utilisateur reste seul responsable des
            decisions prises sur la base des donnees de la plateforme.
          </p>
          <p style={{ marginTop: 10 }}>
            Kela Group ne saurait etre tenu responsable en cas d'interruption de service, de perte de
            donnees imputables a l'utilisateur, ou de tout dommage indirect resultant de l'utilisation
            de la plateforme.
          </p>
        </SECTION>

        <SECTION titre="5. Donnees personnelles">
          <p>
            Les donnees collectees sont traitees conformement a la politique de confidentialite de
            MedOS, disponible sur{" "}
            <Link to="/confidentialite" style={{ color: "#3B82F6" }}>cette page</Link>.
            Kela Group s'engage a proteger les donnees personnelles conformement aux lois en vigueur
            dans les pays d'operation.
          </p>
        </SECTION>

        <SECTION titre="6. Suspension et resiliation">
          <p>
            Kela Group se reserve le droit de suspendre ou de resilier l'acces a MedOS en cas de
            violation des presentes CGU, de comportement frauduleux ou d'atteinte a l'integrite de la
            plateforme. L'utilisateur peut resilier son abonnement en contactant le support.
          </p>
        </SECTION>

        <SECTION titre="7. Modifications des CGU">
          <p>
            Kela Group se reserve le droit de modifier les presentes CGU a tout moment. Les
            utilisateurs seront informes par email au moins 15 jours avant l'entree en vigueur de
            toute modification substantielle. L'utilisation continue de la plateforme apres notification
            vaut acceptation des nouvelles conditions.
          </p>
        </SECTION>

        <SECTION titre="8. Droit applicable">
          <p>
            Les presentes CGU sont soumises au droit applicable dans le pays du siege de Kela Group.
            Tout litige sera soumis a la competence exclusive des juridictions competentes, sauf accord
            amiable prealable.
          </p>
        </SECTION>

        <SECTION titre="9. Contact">
          <p>
            Pour toute question relative aux presentes CGU, contactez-nous a :{" "}
            <a href="mailto:contact@kelagroup.org" style={{ color: "#3B82F6" }}>contact@kelagroup.org</a>
          </p>
        </SECTION>

        <div style={{ marginTop: 40, paddingTop: 24, borderTop: "1px solid #E5E7EB", display: "flex", gap: 16, flexWrap: "wrap" }}>
          <Link to="/"               style={{ fontSize: 12, color: "#6B7280", textDecoration: "none" }}>Retour a l'accueil</Link>
          <Link to="/confidentialite" style={{ fontSize: 12, color: "#6B7280", textDecoration: "none" }}>Politique de confidentialite</Link>
          <Link to="/a-propos"        style={{ fontSize: 12, color: "#6B7280", textDecoration: "none" }}>A propos</Link>
        </div>
      </div>
    </div>
  );
}
