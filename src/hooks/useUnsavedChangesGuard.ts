import { useEffect, useCallback, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

/**
 * Guard against unsaved changes.
 * Works with BrowserRouter (no useBlocker needed).
 * Intercepts link clicks and back/forward navigation.
 */
export function useUnsavedChangesGuard(isDirty: boolean, onSave?: () => Promise<boolean> | boolean) {
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const saveRef = useRef(onSave);
  saveRef.current = onSave;
  const dirtyRef = useRef(isDirty);
  dirtyRef.current = isDirty;
  const navigate = useNavigate();
  const location = useLocation();

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

  // Intercept popstate (back/forward)
  useEffect(() => {
    if (!isDirty) return;

    const handler = () => {
      if (dirtyRef.current) {
        // Push the current path back so the user stays
        window.history.pushState(null, "", location.pathname + location.search);
        setPendingPath("__back__");
      }
    };

    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, [isDirty, location.pathname, location.search]);

  const isBlocked = pendingPath !== null;

  const proceed = useCallback(() => {
    const path = pendingPath;
    setPendingPath(null);
    if (path === "__back__") {
      // Actually go back
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
        // Small delay to let the save propagate
        setTimeout(() => {
          if (path === "__back__") {
            window.history.go(-1);
          } else if (path) {
            navigate(path);
          }
        }, 100);
      }
    }
  }, [pendingPath, navigate]);

  // Function to call before navigating programmatically
  const guardNavigate = useCallback((to: string) => {
    if (dirtyRef.current) {
      setPendingPath(to);
      return false; // blocked
    }
    navigate(to);
    return true;
  }, [navigate]);

  return {
    isBlocked,
    proceed,
    reset,
    saveAndProceed,
    guardNavigate,
  };
}
