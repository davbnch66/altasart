import { useEffect, useCallback, useRef } from "react";
import { useBlocker } from "react-router-dom";

/**
 * Hook that detects unsaved changes and blocks navigation with a confirmation dialog.
 * Also handles browser tab close / refresh via beforeunload.
 *
 * @param isDirty - whether the form has unsaved changes
 * @param onSave - async function to save; returns true if save succeeded
 */
export function useUnsavedChangesGuard(isDirty: boolean, onSave?: () => Promise<boolean> | boolean) {
  // Block react-router navigation
  const blocker = useBlocker(isDirty);
  const saveRef = useRef(onSave);
  saveRef.current = onSave;

  // Handle browser close / refresh
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  const proceed = useCallback(() => {
    if (blocker.state === "blocked") blocker.proceed?.();
  }, [blocker]);

  const reset = useCallback(() => {
    if (blocker.state === "blocked") blocker.reset?.();
  }, [blocker]);

  const saveAndProceed = useCallback(async () => {
    if (saveRef.current) {
      const ok = await saveRef.current();
      if (ok && blocker.state === "blocked") {
        blocker.proceed?.();
      }
    }
  }, [blocker]);

  return {
    isBlocked: blocker.state === "blocked",
    proceed,
    reset,
    saveAndProceed,
  };
}
