/* eslint-disable no-restricted-globals */
import * as XLSX from "xlsx";

// Isole XLSX.read()/sheet_to_json() (bibliotheque avec 2 CVE non corrigees sur npm :
// ReDoS + prototype pollution) dans un Worker dedie : un contenu piege bloque au pire
// ce thread, jamais l'interface, et une pollution de Object.prototype pendant le
// parsing reste confinee au realm du Worker sans jamais atteindre le thread principal.
// Voir DEBUG_PROGRESS.md pour l'analyse complete.
self.onmessage = (event) => {
  try {
    const wb = XLSX.read(event.data.buffer, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(ws, { defval: "" });
    self.postMessage({ ok: true, data });
  } catch (err) {
    self.postMessage({ ok: false, error: err?.message || "Fichier Excel illisible ou corrompu." });
  }
};
