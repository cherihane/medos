import { render, screen, fireEvent } from "@testing-library/react";
import { useAuth } from "../context/AuthContext";
import AjouterClientModal from "./AjouterClientModal";

// Bug signalé (session 11) : "l'utilisatrice ne voit que le mode MedOS". Le
// onClick était toujours correct (fonctionnel), mais le style — onglet actif
// blanc sur fond gris quasi identique (#F3F4F6 vs white), seule différence un
// box-shadow de 1px très discret — rendait le bouton "Client manuel"
// perceptible comme un simple sous-titre décoratif plutôt qu'un bouton
// cliquable. Corrigé avec un contraste de marque (fond ambre + bordure sur
// l'onglet actif). Ce test verrouille le comportement fonctionnel ET vérifie
// que le style actif est désormais nettement différent du style inactif.

jest.mock("../context/AuthContext", () => ({
  useAuth: jest.fn(),
}));

jest.mock("../hooks/useMutations", () => ({
  insertDistributeurClient: jest.fn(),
  rechercherClientParEmail: jest.fn(),
}));

beforeEach(() => {
  useAuth.mockReturnValue({ auth: { etablissement_id: "dist-1" } });
});

test("les deux onglets MedOS et manuel sont présents, avec un style visuellement distinct pour celui actif", () => {
  render(<AjouterClientModal onClose={() => {}} onSaved={() => {}} />);

  const btnMedOS = screen.getByRole("button", { name: "Client MedOS" });
  const btnManuel = screen.getByRole("button", { name: "Client manuel" });

  // Par défaut, mode MedOS actif : fond ambre distinct du fond transparent
  // de l'onglet inactif — ce n'est plus "blanc sur gris très clair".
  expect(btnMedOS.style.backgroundColor).toBe("rgb(255, 251, 235)"); // #FFFBEB
  expect(btnManuel.style.backgroundColor).toBe("transparent");
  expect(btnMedOS.style.backgroundColor).not.toBe(btnManuel.style.backgroundColor);
});

test("cliquer sur \"Client manuel\" fait bien apparaître le formulaire manuel (pas seulement visuel, fonctionnel)", () => {
  render(<AjouterClientModal onClose={() => {}} onSaved={() => {}} />);

  // Mode MedOS par défaut : champ email visible, pas le formulaire manuel.
  expect(screen.getByPlaceholderText("contact@pharmacie.com")).toBeInTheDocument();
  expect(screen.queryByPlaceholderText("Ex: Pharmacie du Marché")).toBeNull();

  fireEvent.click(screen.getByRole("button", { name: "Client manuel" }));

  // Bascule confirmée : formulaire manuel visible, recherche email disparue.
  expect(screen.getByPlaceholderText("Ex: Pharmacie du Marché")).toBeInTheDocument();
  expect(screen.queryByPlaceholderText("contact@pharmacie.com")).toBeNull();

  // Et le style actif a basculé sur le bon onglet.
  const btnManuel = screen.getByRole("button", { name: "Client manuel" });
  expect(btnManuel.style.backgroundColor).toBe("rgb(255, 251, 235)");
});

test("le bouton \"Ajouter le client\" en mode manuel exige un nom mais rien d'autre", () => {
  render(<AjouterClientModal onClose={() => {}} onSaved={() => {}} />);
  fireEvent.click(screen.getByRole("button", { name: "Client manuel" }));
  fireEvent.click(screen.getByRole("button", { name: "Ajouter le client" }));
  expect(screen.getByText("Le nom du client est obligatoire.")).toBeInTheDocument();
});
