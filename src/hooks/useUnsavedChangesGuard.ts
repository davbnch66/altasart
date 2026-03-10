import { useEffect, useCallback, useRef, useState } from "react";

/**
 * Guard against unsaved changes.
 * Shows a confirmation dialog before navigating away.
 * Uses a simple pendingPath approach without manipulating browser history.
 */
export function useUnsavedChangesGuard(isDirty: boolean, onSave?: () => Promise<boolean> | boolean) {
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const saveRef = useRef(onSave);
  saveRef.current = onSave;
  const dirtyRef = useRef(isDirty);
  dirtyRef.current = isDirty;

  // Browser close / refresh
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  // Intercept all internal link clicks (capture phase, before react-router)
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!dirtyRef.current) return;

      const anchor = (e.target as HTMLElement).closest("a[href]");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("http") || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("#")) return;

      // Internal link - block it
      e.preventDefault();
      e.stopImmediatePropagation();
      setPendingPath(href);
    };

    document.addEventListener("click", handler, true);
    return () => document.removeEventListener("click", handler, true);
  }, []);

  const isBlocked = pendingPath !== null;

  const proceed = useCallback(() => {
    const path = pendingPath;
    setPendingPath(null);
    if (path) {
      // Use window.location for reliable navigation after blocking
      window.location.href = path;
    }
  }, [pendingPath]);

  const reset = useCallback(() => {
    setPendingPath(null);
  }, []);

  const saveAndProceed = useCallback(async () => {
    if (saveRef.current) {
      const ok = await saveRef.current();
      if (ok) {
        const path = pendingPath;
        setPendingPath(null);
        if (path) {
          setTimeout(() => {
            window.location.href = path;
          }, 150);
        }
      }
    }
  }, [pendingPath]);

  return {
    isBlocked,
    proceed,
    reset,
    saveAndProceed,
  };
}
