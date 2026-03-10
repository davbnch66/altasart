import { useEffect, useCallback, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

/**
 * Guard against unsaved changes.
 * Intercepts: link clicks, back/forward, and tab close.
 */
export function useUnsavedChangesGuard(isDirty: boolean, onSave?: () => Promise<boolean> | boolean) {
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const saveRef = useRef(onSave);
  saveRef.current = onSave;
  const dirtyRef = useRef(isDirty);
  dirtyRef.current = isDirty;
  const navigate = useNavigate();
  const location = useLocation();
  const skipNextRef = useRef(false);

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

  // Intercept all internal link clicks
  useEffect(() => {
    if (!isDirty) return;

    const handler = (e: MouseEvent) => {
      // Find closest <a> tag
      const anchor = (e.target as HTMLElement).closest("a[href]");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("http") || href.startsWith("mailto:") || href.startsWith("tel:")) return;

      // Internal link - block it
      if (dirtyRef.current) {
        e.preventDefault();
        e.stopPropagation();
        setPendingPath(href);
      }
    };

    // Use capture phase to intercept before react-router
    document.addEventListener("click", handler, true);
    return () => document.removeEventListener("click", handler, true);
  }, [isDirty]);

  // Intercept popstate (back/forward)
  useEffect(() => {
    if (!isDirty) return;

    const handler = () => {
      if (dirtyRef.current && !skipNextRef.current) {
        window.history.pushState(null, "", location.pathname + location.search);
        setPendingPath("__back__");
      }
      skipNextRef.current = false;
    };

    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, [isDirty, location.pathname, location.search]);

  const isBlocked = pendingPath !== null;

  const proceed = useCallback(() => {
    const path = pendingPath;
    setPendingPath(null);
    if (path === "__back__") {
      skipNextRef.current = true;
      window.history.go(-1);
    } else if (path) {
      navigate(path);
    }
  }, [pendingPath, navigate]);

  const reset = useCallback(() => {
    setPendingPath(null);
  }, []);

  const saveAndProceed = useCallback(async () => {
    if (saveRef.current) {
      const ok = await saveRef.current();
      if (ok) {
        const path = pendingPath;
        setPendingPath(null);
        setTimeout(() => {
          if (path === "__back__") {
            skipNextRef.current = true;
            window.history.go(-1);
          } else if (path) {
            navigate(path);
          }
        }, 150);
      }
    }
  }, [pendingPath, navigate]);

  return {
    isBlocked,
    proceed,
    reset,
    saveAndProceed,
  };
}
