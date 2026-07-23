import { render, screen } from "@testing-library/react";
import NouvelleLivraisonModal from "./NouvelleLivraisonModal";

// Bug confirmé (session 11) : le bouton "Créer une livraison" d'une fiche
// client (ReseauClients.jsx) utilisait un mini-formulaire parallèle sans
// panier ni décrément de stock. Corrigé en réutilisant ce composant partout
// — ce test vérifie que, ouvert depuis une fiche client, le client est bien
// pré-sélectionné dans LE MÊME formulaire panier que l'écran Livraisons
// principal (pas une copie séparée).

const relations = [
  { id: "rel-1", client: { id: "etab-1", nom: "Pharmacie Mimi", ville: "Brazzaville", estManuel: false, email: "mimi@example.com" } },
  { id: "rel-2", client: { id: "rel-2", nom: "Dépôt Manuel", ville: "Pointe-Noire", estManuel: true, email: null } },
];
const medicaments = [
  { id: "med-1", nom: "Ceftriaxone", dosage: "1g", forme: "Injectable", stock_actuel: 100 },
];

test("le panier complet (médicaments, quantités, stock) est bien présent, pas un mini-formulaire sans panier", () => {
  render(
    <NouvelleLivraisonModal
      relations={relations}
      medicaments={medicaments}
      distributeurId="dist-1"
      distributeurNom="Poto-Poto"
      auth={{ etablissement_id: "dist-1", structure: "Poto-Poto", user: { id: "u1", email: "dist@example.com" } }}
      onClose={() => {}}
      onSaved={() => {}}
    />
  );
  // Champ panier médicaments — absent de l'ancien CommandeClientModal.
  expect(screen.getByText("Médicaments à expédier *")).toBeInTheDocument();
  expect(screen.getByPlaceholderText("Qté")).toBeInTheDocument();
});

test("ouvert depuis une fiche client (preselectedRelationId), le bon client est pré-sélectionné dans CE formulaire", () => {
  render(
    <NouvelleLivraisonModal
      relations={relations}
      medicaments={medicaments}
      distributeurId="dist-1"
      distributeurNom="Poto-Poto"
      auth={{ etablissement_id: "dist-1", structure: "Poto-Poto", user: { id: "u1", email: "dist@example.com" } }}
      preselectedRelationId="rel-1"
      onClose={() => {}}
      onSaved={() => {}}
    />
  );
  const select = screen.getByDisplayValue("Pharmacie Mimi (Brazzaville)");
  expect(select.value).toBe("rel-1");
});

test("le client manuel pré-sélectionné fonctionne aussi (pas seulement les clients MedOS)", () => {
  render(
    <NouvelleLivraisonModal
      relations={relations}
      medicaments={medicaments}
      distributeurId="dist-1"
      distributeurNom="Poto-Poto"
      auth={{ etablissement_id: "dist-1", structure: "Poto-Poto", user: { id: "u1", email: "dist@example.com" } }}
      preselectedRelationId="rel-2"
      onClose={() => {}}
      onSaved={() => {}}
    />
  );
  const select = screen.getByDisplayValue("Dépôt Manuel (Pointe-Noire) — manuel");
  expect(select.value).toBe("rel-2");
});
