import { useAuth } from "../context/AuthContext";

// Un role_interne a acces complet en ecriture si l'ecran fait partie de sa
// navigation par defaut (auth.nav, deja filtree par role + permissions_nav
// individuelles) ; sinon il n'y accede que via un acces elargi ponctuel et
// reste en lecture seule. Direction (role_interne null) garde l'acces complet.
// Voir DEBUG_PROGRESS.md, "Permissions par action".
export function useAccesEcranComplet(chemin) {
  const { auth } = useAuth();
  if (!auth?.role_interne) return true;
  return Array.isArray(auth.nav) && auth.nav.some((item) => item.path === chemin);
}
