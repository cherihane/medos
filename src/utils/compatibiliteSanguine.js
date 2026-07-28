/**
 * Compatibilité transfusionnelle ABO/Rhésus — vraie table de compatibilité,
 * pas une simple correspondance exacte. Utilisée pour BLOQUER (pas juste
 * avertir) toute tentative de réserver un groupe incompatible.
 *
 * Règle standard :
 *  - Compatibilité ABO du donneur : O peut donner à O/A/B/AB ; A à A/AB ;
 *    B à B/AB ; AB à AB uniquement.
 *  - Compatibilité Rhésus : un donneur Rh- est compatible avec un receveur
 *    Rh- ou Rh+ ; un donneur Rh+ est compatible uniquement avec un receveur
 *    Rh+.
 *  - Les deux conditions doivent être vraies simultanément.
 */

export const GROUPES_SANGUINS = ["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"];

const DONNEURS_ABO_COMPATIBLES = {
  O:  ["O"],
  A:  ["O", "A"],
  B:  ["O", "B"],
  AB: ["O", "A", "B", "AB"],
};

function parseGroupe(groupe) {
  const rh = groupe.slice(-1); // "+" ou "-"
  const abo = groupe.slice(0, -1); // "O","A","B","AB"
  return { abo, rh };
}

/**
 * Retourne la liste des groupes DONNEURS compatibles pour un patient d'un
 * groupe donné (ce que la poche doit être pour pouvoir lui être transfusée).
 */
export function groupesDonneursCompatibles(groupePatient) {
  const { abo, rh } = parseGroupe(groupePatient);
  const donneursABO = DONNEURS_ABO_COMPATIBLES[abo] ?? [];
  const groupes = [];
  for (const donneurABO of donneursABO) {
    groupes.push(`${donneurABO}-`); // un donneur Rh- convient toujours
    if (rh === "+") groupes.push(`${donneurABO}+`); // receveur Rh+ accepte aussi Rh+
  }
  return groupes;
}

/** true si une poche du groupe `groupePoche` peut être transfusée à un patient du groupe `groupePatient`. */
export function estCompatible(groupePatient, groupePoche) {
  if (!groupePatient || !groupePoche) return false;
  return groupesDonneursCompatibles(groupePatient).includes(groupePoche);
}
