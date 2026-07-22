import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { supabase } from "../supabaseClient";
import Inscription from "./Inscription";

// react-router-dom v7 n'est pas résolvable par le resolver Jest 27 figé dans
// react-scripts (son "exports" ne pointe vers aucun fichier que Jest 27 sait
// lire) — Inscription.jsx n'utilise que useNavigate(), donc on le mocke
// directement plutôt que de rendre un vrai <MemoryRouter>.
jest.mock(
  "react-router-dom",
  () => ({
    useNavigate: () => jest.fn(),
    Link: ({ children, ...props }) => <a {...props}>{children}</a>,
  }),
  { virtual: true }
);

jest.mock("../supabaseClient", () => ({
  supabase: {
    rpc: jest.fn(),
    auth: {
      signUp: jest.fn(),
      signOut: jest.fn(),
    },
    from: jest.fn(),
    functions: { invoke: jest.fn() },
  },
}));

beforeEach(() => {
  supabase.rpc.mockReset();
  supabase.auth.signUp.mockReset();
  supabase.auth.signOut.mockReset();
  supabase.from.mockReset();
  supabase.functions.invoke.mockReset();

  supabase.auth.signUp.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
  supabase.auth.signOut.mockResolvedValue({ error: null });
  supabase.from.mockImplementation(() => ({
    insert: jest.fn(() => Promise.resolve({ error: null })),
  }));
  supabase.functions.invoke.mockResolvedValue({ data: { ok: true }, error: null });
});

function renderInscription() {
  return render(<Inscription />);
}

// Remplit l'étape 1 (choix du rôle "Pharmacie") puis l'étape 2 (formulaire),
// avec l'email fourni, jusqu'au clic sur "Soumettre la demande".
async function remplirEtSoumettre(email) {
  renderInscription();

  fireEvent.click(screen.getByText("Pharmacie"));
  fireEvent.click(screen.getByText("Suivant"));

  fireEvent.change(screen.getByPlaceholderText("Ex: Pharmacie Centrale de Cocody"), { target: { value: "Pharmacie Test" } });
  fireEvent.change(screen.getByPlaceholderText("Ex: 12 Avenue Christiane Gbagbo, Cocody"), { target: { value: "1 Rue Test" } });
  fireEvent.change(screen.getByPlaceholderText("Ex: Abidjan"), { target: { value: "Abidjan" } });

  const comboboxes = screen.getAllByRole("combobox");
  fireEvent.change(comboboxes[0], { target: { value: "Côte d'Ivoire" } }); // Pays
  fireEvent.change(comboboxes[1], { target: { value: "officine" } }); // Type d'établissement (pharmacie)

  fireEvent.change(screen.getByPlaceholderText("Ex: MSP-LIC-2024-00123"), { target: { value: "MSP-LIC-2026-00001" } });
  fireEvent.change(screen.getByPlaceholderText("Ex: Marie"), { target: { value: "Jean" } });
  fireEvent.change(screen.getByPlaceholderText("Ex: Kouassi"), { target: { value: "Testeur" } });
  fireEvent.change(screen.getByPlaceholderText("Ex: +225 07 00 00 00 00"), { target: { value: "+225 07 00 00 00 00" } });
  fireEvent.change(screen.getByPlaceholderText("responsable@etablissement.com"), { target: { value: email } });
  fireEvent.change(screen.getByPlaceholderText("Min. 8 caractères"), { target: { value: "motdepasse123" } });
  fireEvent.change(screen.getByPlaceholderText("Identique au mot de passe"), { target: { value: "motdepasse123" } });

  fireEvent.click(screen.getByText("Soumettre la demande"));
}

test("un email déjà associé à un autre établissement bloque la soumission avec un message clair", async () => {
  supabase.rpc.mockResolvedValue({ data: true, error: null }); // email déjà utilisé

  await remplirEtSoumettre("deja-utilise@example.com");

  await screen.findByText("Cet email est déjà associé à un autre établissement MedOS.");
  expect(supabase.rpc).toHaveBeenCalledWith(
    "email_etablissement_deja_utilise",
    { p_email: "deja-utilise@example.com" }
  );
  // Aucun compte ni établissement ne doit avoir été créé.
  expect(supabase.auth.signUp).not.toHaveBeenCalled();
});

test("un email inédit passe la vérification et l'inscription se déroule normalement", async () => {
  supabase.rpc.mockResolvedValue({ data: false, error: null }); // email jamais utilisé

  await remplirEtSoumettre("jamais-vu@example.com");

  await waitFor(() => expect(supabase.auth.signUp).toHaveBeenCalled());
  await screen.findByText("Demande envoyée avec succès");
  expect(screen.queryByText("Cet email est déjà associé à un autre établissement MedOS.")).toBeNull();
});
