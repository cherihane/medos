-- Point 6 (session 11) : une commande fabricant ne pouvait porter que des
-- médicaments déjà présents dans l'entrepôt (medicament_id obligatoire côté
-- formulaire, alors que la colonne est nullable depuis l'origine — voir
-- CommandeFabricantCard.handleStatutChange qui a déjà `if (l.medicament_id)`
-- avant l'incrément de stock, anticipant ce cas sans jamais pouvoir s'y
-- produire). On permet maintenant une ligne "médicament hors entrepôt" :
-- medicament_id reste null jusqu'à la réception, medicament_nom porte le nom
-- saisi librement, et ce nouveau champ dosage complète l'information capturée
-- à la commande (le fabricant, lui, est déjà celui de l'en-tête de la
-- commande — pas besoin d'un champ dédié par ligne).
ALTER TABLE public.commande_lignes
  ADD COLUMN IF NOT EXISTS dosage text;
