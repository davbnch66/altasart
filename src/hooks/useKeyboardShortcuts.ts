import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

/**
 * Global keyboard shortcuts:
 * - Cmd+K → handled by GlobalSearch (already exists)
 * - Cmd+Shift+C → Nouveau client
 * - Cmd+Shift+D → Nouveau devis
 * - Cmd+Shift+V → Nouvelle visite
 * - Cmd+Shift+F → Nouvelle facture
 * - Cmd+Shift+O → Nouveau dossier
 * - Cmd+Shift+P → Planning
 */
export function useKeyboardShortcuts() {
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || !e.shiftKey) return;
      
      // Don't trigger when typing in inputs
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      switch (e.key.toLowerCase()) {
        case "c":
          e.preventDefault();
          navigate("/clients?new=1");
          break;
        case "d":
          e.preventDefault();
          navigate("/devis?new=1");
          break;
        case "v":
          e.preventDefault();
          navigate("/visites?new=1");
          break;
        case "f":
          e.preventDefault();
          navigate("/finance?new=1");
          break;
        case "o":
          e.preventDefault();
          navigate("/dossiers?new=1");
          break;
        case "p":
          e.preventDefault();
          navigate("/planning");
          break;
      }
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [navigate]);
}
