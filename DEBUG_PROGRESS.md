# DEBUG_PROGRESS — Suivi de fiabilisation MedOS

> Ce fichier est committé sur GitHub. Il permet à toute nouvelle session de Claude
> Code de reprendre le travail sans perdre le contexte.
>
> Légende : ⬜ à tester · 🔴 cassé (cause notée) · 🟡 corrigé, à revalider · ✅ validé en conditions réelles (prod, après rechargement de page)

Environnement de test : compte réel `cherihaneadam123@gmail.com` sur https://medos.kelagroup.org,
utilisé comme bac à sable (accord explicite de l'utilisateur, 2026-07-19).
Scripts de test : dossier `/diagnostic` (non commité, voir `.gitignore`).
Déploiement : SSH `root@81.17.98.80` (clé `~/.ssh/medos_deploy`) →
`cd /var/www/medos && git stash && git pull origin master && npm install && npm run build && systemctl restart nginx`.

**Règle absolue** : ne jamais modifier le flux de chargement de `src/context/AuthContext.jsx`
(setLoading, buildAuthBase, enrichWithEtablissement, mountedRef, getSession, onAuthStateChange).
Si un bug semble venir de là, le documenter ici et demander confirmation avant de toucher au fichier.

---

## Module PHARMACIE

| # | Fonctionnalité | Statut | Détails |
|---|---|---|---|
| 1 | Connexion avec le compte réel | ⬜ | |
| 2 | Ouverture de session de caisse (fond de caisse) | ⬜ | |
| 3 | Recherche + ajout médicament au panier (texte) | ⬜ | |
| 3b | Ajout médicament au panier (scanner QR) | ⬜ | |
| 4 | Vente paiement simple (espèces) | ⬜ | |
| 5 | Vente paiement mixte (espèces + assurance/CNSS) | ⬜ | |
| 6 | Impression du ticket de caisse | ⬜ | |
| 7 | Création et dispensation d'une ordonnance | ⬜ | |
| 8 | Décrément de stock après vente/dispensation | ⬜ | |
| 9 | Ajout d'un médicament à l'inventaire | ⬜ | |
| 9b | Import CSV inventaire | ⬜ | (si le temps le permet) |
| 10 | Alertes stock bas / péremption | ⬜ | |
| 11 | Fournisseurs et mouvements de stock | ⬜ | |
| 12 | Gestion des patients (création, historique, fidélité) | ⬜ | |
| 13 | Rapports du jour | ⬜ | |
| 14 | Clôture de caisse (journal anti-fraude) | ⬜ | |

### Journal détaillé

_(Chaque entrée horodatée avec ce qui a été trouvé, corrigé, et le résultat de la revalidation.)_

---

## Module DISTRIBUTEUR

Non commencé — en attente de validation complète du module Pharmacie.

## Module HÔPITAL

Non commencé — en attente de validation complète du module Pharmacie.
