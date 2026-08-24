"use client";

// Module-level pub-sub, same shape as the original's __toastListeners —
// pushToast() is callable from anywhere (event handlers deep in a view)
// without needing a React context provider wired through every tree.
import { useEffect, useState } from "react";

type Listener = (msg: string) => void;
let listeners: Listener[] = [];

export function pushToast(msg: string) {
  listeners.forEach((fn) => fn(msg));
}

export function ToastHost() {
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const fn: Listener = (msg) => {
      setToast(msg);
      clearTimeout(timer);
      timer = setTimeout(() => setToast(null), 2600);
    };
    listeners.push(fn);
    return () => {
      listeners = listeners.filter((x) => x !== fn);
      clearTimeout(timer);
    };
  }, []);

  if (!toast) return null;
  return (
    <div
      style={{
        position: "fixed",
        bottom: 24,
        left: "50%",
        transform: "translateX(-50%)",
        background: "var(--text-primary)",
        color: "#fff",
        borderRadius: 10,
        padding: "12px 20px",
        fontSize: 13.5,
        fontWeight: 600,
        boxShadow: "var(--shadow-card)",
        zIndex: 200,
      }}
    >
      {toast}
    </div>
  );
}
