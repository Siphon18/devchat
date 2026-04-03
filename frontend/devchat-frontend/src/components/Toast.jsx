import { useState, useEffect, useCallback, createContext, useContext } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { scaleIn } from "../utils/motion";

const ToastContext = createContext(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

let toastId = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const reduceMotion = useReducedMotion();

  const addToast = useCallback((message, type = "info", duration = 3500) => {
    const id = ++toastId;
    setToasts(prev => [...prev, { id, message, type, exiting: false }]);
    setTimeout(() => {
      setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t));
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, 300);
    }, duration);
  }, []);

  const toast = useCallback({
    success: (msg) => addToast(msg, "success"),
    error: (msg) => addToast(msg, "error"),
    info: (msg) => addToast(msg, "info"),
  }, [addToast]);

  // Fix: make toast callable with methods
  const toastFn = useCallback((msg, type) => addToast(msg, type), [addToast]);
  toastFn.success = (msg) => addToast(msg, "success");
  toastFn.error = (msg) => addToast(msg, "error");
  toastFn.info = (msg) => addToast(msg, "info");

  return (
      <ToastContext.Provider value={toastFn}>
      {children}
      <div className="toast-container">
        <AnimatePresence initial={false}>
          {toasts.map(t => (
            <motion.div
              key={t.id}
              className={`toast ${t.type} ${t.exiting ? "exiting" : ""}`}
              variants={scaleIn}
              initial={reduceMotion ? false : "hidden"}
              animate="visible"
              exit="exit"
              layout={!reduceMotion}
            >
              <span className="text-base">
                {t.type === "success" ? "✓" : t.type === "error" ? "✕" : "ℹ"}
              </span>
              <span>{t.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
