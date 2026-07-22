import { render, screen, act } from "@testing-library/react";
import { supabase } from "../supabaseClient";
import { AuthProvider, useAuth } from "./AuthContext";

// ── Mock Supabase ────────────────────────────────────────────────────────────
// `mockAuthState.session` représente ce qui est partagé entre TOUS les "onglets"
// (comme localStorage dans un vrai navigateur) — un seul compte Supabase Auth,
// un seul user_metadata. `sessionStorage`, lui, reste le storage RÉEL de jsdom
// (par test-window), qu'on vide/restaure explicitement pour simuler des onglets
// physiquement distincts.
// Note : create-react-app active `resetMocks: true` — les implémentations des
// jest.fn() sont donc (re)posées dans beforeEach, pas dans le factory ci-dessous.
const mockAuthState = { session: null };
function setSession(session) {
  mockAuthState.session = session;
}

jest.mock("../supabaseClient", () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
      onAuthStateChange: jest.fn(),
      signInWithPassword: jest.fn(),
      updateUser: jest.fn(),
      signOut: jest.fn(),
    },
    from: jest.fn(),
  },
}));

function fakeUser(role, overrides = {}) {
  return {
    id: "test-user-id",
    email: "test@example.com",
    user_metadata: { role, ...overrides },
  };
}

function Probe() {
  const { auth } = useAuth();
  return <div data-testid="role">{auth?.role ?? "none"}</div>;
}

beforeEach(() => {
  sessionStorage.clear();
  mockAuthState.session = null;

  supabase.auth.getSession.mockImplementation(() =>
    Promise.resolve({ data: { session: mockAuthState.session } })
  );
  supabase.auth.onAuthStateChange.mockImplementation(() => ({
    data: { subscription: { unsubscribe: jest.fn() } },
  }));
  supabase.auth.updateUser.mockImplementation(() => Promise.resolve({ data: {}, error: null }));
  supabase.auth.signOut.mockImplementation(() => Promise.resolve({ error: null }));
  supabase.from.mockImplementation(() => {
    const obj = {
      select: jest.fn(() => obj),
      eq: jest.fn(() => obj),
      maybeSingle: jest.fn(() => Promise.resolve({ data: null, error: null })),
    };
    return obj;
  });
});

// ── Scénario 1 : compte mono-établissement, aucune régression ────────────────

test("scénario 1 — connexion puis rafraîchissement affichent le même rôle qu'avant le correctif", async () => {
  setSession({ user: fakeUser("pharmacie") });

  const { unmount } = render(
    <AuthProvider>
      <Probe />
    </AuthProvider>
  );
  await screen.findByText("pharmacie");
  expect(sessionStorage.getItem("medos_role_actif")).toBe("pharmacie");
  unmount();

  // "Rafraîchissement" = démontage/remontage du provider (React repart de zéro),
  // sessionStorage de cet onglet survit — comme dans un vrai navigateur.
  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>
  );
  await screen.findByText("pharmacie");
  expect(sessionStorage.getItem("medos_role_actif")).toBe("pharmacie");
});

// ── Scénario 2 : compte multi-établissements ──────────────────────────────────

test("scénario 2 — un autre onglet qui change le rôle du compte partagé ne fait pas basculer cet onglet", async () => {
  // Onglet A se connecte en distributeur.
  setSession({ user: fakeUser("distributeur") });
  const tabA = render(
    <AuthProvider>
      <Probe />
    </AuthProvider>
  );
  await screen.findByText("distributeur");
  const roleSessionTabA = sessionStorage.getItem("medos_role_actif");
  expect(roleSessionTabA).toBe("distributeur");
  tabA.unmount();

  // Rafraîchir l'onglet A SANS qu'aucun autre événement ne survienne : doit
  // rester distributeur (non-régression du cas simple, même onglet).
  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>
  );
  await screen.findByText("distributeur");
  expect(sessionStorage.getItem("medos_role_actif")).toBe("distributeur");

  // Un AUTRE onglet se connecte avec le même compte partagé en choisissant le
  // rôle pharmacie — exactement ce que fait login() via updateUser({role}) :
  // ça écrase user_metadata.role pour tout le compte, visible par tous les onglets.
  setSession({ user: fakeUser("pharmacie") });

  // Nouvel onglet B : sessionStorage vierge (jamais partagée entre onglets).
  sessionStorage.clear();
  const tabB = render(
    <AuthProvider>
      <Probe />
    </AuthProvider>
  );
  await screen.findByText("pharmacie"); // onglet B démarre bien sur le rôle actuel du compte
  expect(sessionStorage.getItem("medos_role_actif")).toBe("pharmacie");
  tabB.unmount();

  // On revient à l'onglet A : sa PROPRE sessionStorage (jamais touchée par
  // l'onglet B) est restaurée, puis on le rafraîchit.
  sessionStorage.clear();
  sessionStorage.setItem("medos_role_actif", roleSessionTabA);
  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>
  );
  // Preuve concrète attendue : malgré user_metadata.role = "pharmacie" côté
  // compte partagé (mutation faite par l'onglet B), l'onglet A reste distributeur.
  await screen.findByText("distributeur");
  expect(sessionStorage.getItem("medos_role_actif")).toBe("distributeur");
});

// ── Scénario 3 : premier login, aucun rôle en sessionStorage encore ──────────

test("scénario 3 — premier login sans sessionStorage préexistant fonctionne normalement", async () => {
  expect(sessionStorage.getItem("medos_role_actif")).toBeNull();
  setSession({ user: fakeUser("hopital") });

  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>
  );
  await screen.findByText("hopital");
  expect(sessionStorage.getItem("medos_role_actif")).toBe("hopital");
  // Pas d'écran blanc / pas d'état "none" persistant.
  expect(screen.queryByText("none")).toBeNull();
});

// ── login() fixe explicitement le rôle choisi dans le formulaire ────────────

function LoginProbe() {
  const { auth, login } = useAuth();
  return (
    <div>
      <div data-testid="role">{auth?.role ?? "none"}</div>
      <button onClick={() => login("pharmacie", "test@example.com", "pw")}>go</button>
    </div>
  );
}

test("login() fige le rôle choisi dans ce formulaire, même si le snapshot user renvoyé par signIn porte encore l'ancien rôle", async () => {
  // Le compte est déjà partagé : signInWithPassword réussit et renvoie un objet
  // user dont user_metadata.role est encore "distributeur" (pas encore rafraîchi
  // côté client) — mais l'utilisateur a choisi "pharmacie" dans le formulaire.
  const staleUser = fakeUser("distributeur");
  supabase.auth.signInWithPassword.mockImplementation(() =>
    Promise.resolve({ data: { user: staleUser, session: { user: staleUser } }, error: null })
  );

  render(
    <AuthProvider>
      <LoginProbe />
    </AuthProvider>
  );
  await screen.findByText("none");

  await act(async () => {
    screen.getByText("go").click();
  });

  await screen.findByText("pharmacie");
  expect(sessionStorage.getItem("medos_role_actif")).toBe("pharmacie");
});
