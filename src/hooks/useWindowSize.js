import { useState, useEffect } from "react";

/**
 * Retourne les dimensions actuelles de la fenêtre.
 * Se met à jour automatiquement lors du redimensionnement.
 */
export function useWindowSize() {
  const [size, setSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  useEffect(() => {
    const handler = () =>
      setSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  return size;
}

/**
 * Raccourci : true si la largeur est inférieure au breakpoint (défaut 768px).
 */
export function useIsMobile(breakpoint = 768) {
  const { width } = useWindowSize();
  return width < breakpoint;
}
