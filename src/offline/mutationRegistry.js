/**
 * mutationRegistry.js — résout un nom d'action en fonction réelle de useMutations.js.
 * Les actions en file d'attente stockent un `name` (string, sérialisable dans
 * IndexedDB), jamais une référence de fonction.
 *
 * Convention déjà en place dans useMutations.js (hospitalisations, feuille de
 * réveil, partogramme) : une mutation dont le nom finit par "SiInchangee" est une
 * écriture conditionnelle (vérifie updated_at) qui renvoie un tableau vide plutôt
 * qu'une erreur quand la ligne a été modifiée entre-temps par quelqu'un d'autre.
 * Le moteur de synchro s'appuie sur cette convention pour détecter un conflit au
 * rejeu sans avoir à connaître chaque mutation individuellement.
 */
import * as mutations from "../hooks/useMutations";

export function getMutation(name) {
  const fn = mutations[name];
  if (typeof fn !== "function") {
    throw new Error(`Action hors-ligne inconnue : "${name}" n'existe pas dans useMutations.js`);
  }
  return fn;
}

export function isConditionalMutation(name) {
  return name.endsWith("SiInchangee");
}
