import { createContext, useContext, useEffect, useState } from "react";
import { subscribeNetworkStatus } from "../offline/networkStatus";

const NetworkContext = createContext({ online: true, lastChangeAt: null });

export function NetworkProvider({ children }) {
  // Optimiste au démarrage (navigator.onLine) — la sonde réelle corrige en
  // quelques centaines de ms si besoin, sans faire clignoter l'UI à froid.
  const [online, setOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const [lastChangeAt, setLastChangeAt] = useState(null);

  useEffect(() => {
    const unsubscribe = subscribeNetworkStatus((next) => {
      setOnline((prev) => {
        if (prev !== next) setLastChangeAt(new Date().toISOString());
        return next;
      });
    });
    return unsubscribe;
  }, []);

  return (
    <NetworkContext.Provider value={{ online, lastChangeAt }}>
      {children}
    </NetworkContext.Provider>
  );
}

export function useNetwork() {
  return useContext(NetworkContext);
}
