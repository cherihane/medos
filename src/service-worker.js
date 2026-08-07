/* eslint-disable no-restricted-globals */
// Service worker MedOS — mise en cache de l'interface (app shell) pour que
// l'application se charge même sans réseau du tout (Phase 0, point 5 de la
// mission hors-ligne). Ne cache QUE les fichiers statiques générés au build
// (JS/CSS/images précachés via __WB_MANIFEST) — les données métier (stock,
// patients, ventes...) passent par le cache IndexedDB de src/offline/, pas ici.

import { clientsClaim } from "workbox-core";
import { ExpirationPlugin } from "workbox-expiration";
import { precacheAndRoute, createHandlerBoundToURL } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import { StaleWhileRevalidate } from "workbox-strategies";

clientsClaim();

// Précache tous les fichiers générés par le build (manifest injecté par
// InjectManifest de workbox-webpack-plugin, déjà présent via react-scripts).
precacheAndRoute(self.__WB_MANIFEST);

// Routage "app shell" : toute navigation (changement de page) est servie par
// index.html précaché, y compris sans réseau — indispensable pour un
// rechargement de page hors-ligne (F5) sur une route interne type
// /pharmacie/caisse.
const fileExtensionRegexp = new RegExp("/[^/?]+\\.[^/]+$");
registerRoute(
  ({ request, url }) => {
    if (request.mode !== "navigate") return false;
    if (url.pathname.startsWith("/_")) return false;
    if (url.pathname.match(fileExtensionRegexp)) return false;
    return true;
  },
  createHandlerBoundToURL(process.env.PUBLIC_URL + "/index.html"),
);

// Images statiques (logos, icônes) servies same-origin — cache-first avec
// revalidation en arrière-plan.
registerRoute(
  ({ url }) => url.origin === self.location.origin && /\.(?:png|jpg|jpeg|svg|ico)$/.test(url.pathname),
  new StaleWhileRevalidate({
    cacheName: "medos-images",
    plugins: [new ExpirationPlugin({ maxEntries: 60 })],
  }),
);

// Permet à l'app de forcer l'activation d'une nouvelle version du service
// worker sans attendre la fermeture de tous les onglets.
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
