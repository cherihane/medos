// Politique de mot de passe unique, partagée par Inscription, Login (premier accès) et
// Réinitialisation — évite qu'un des 3 points d'entrée reste plus faible que les autres.
export function motDePasseValide(password) {
  return (
    (password || "").length >= 10 &&
    /[a-zA-Z]/.test(password) &&
    /[0-9]/.test(password)
  );
}

export const MOT_DE_PASSE_MESSAGE_ERREUR =
  "Le mot de passe doit contenir au moins 10 caractères, avec au moins une lettre et un chiffre.";
