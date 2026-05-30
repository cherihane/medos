import { useState, useCallback } from "react";

let _id = 0;

export function useToast() {
  const [toasts, setToasts] = useState([]);

  const toast = useCallback((msg, type = "success", duration = 3800) => {
    const id = ++_id;
    setToasts((prev) => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), duration);
  }, []);

  const success = useCallback((msg) => toast(msg, "success"), [toast]);
  const error   = useCallback((msg) => toast(msg, "error"),   [toast]);

  return { toasts, toast, success, error };
}
