import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";

const ToastContext = createContext(null);
let counter = 0;

const ICONS = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (type, message, title) => {
      const id = ++counter;
      setToasts((current) => [...current, { id, type, message, title }]);
      window.setTimeout(() => dismiss(id), 5200);
    },
    [dismiss]
  );

  const toast = useMemo(
    () => ({
      success: (message, title = "Done") => push("success", message, title),
      error: (message, title = "Something went wrong") => push("error", message, title),
      warning: (message, title = "Heads up") => push("warning", message, title),
      info: (message, title = "Notice") => push("info", message, title),
    }),
    [push]
  );

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack" aria-live="polite">
        {toasts.map((item) => {
          const Icon = ICONS[item.type] || Info;
          return (
            <div className={`toast ${item.type}`} key={item.id}>
              <Icon size={18} style={{ flexShrink: 0, marginTop: 1 }} />
              <div>
                {item.title ? <strong>{item.title}</strong> : null}
                <p>{item.message}</p>
              </div>
              <button
                type="button"
                className="icon-btn close"
                onClick={() => dismiss(item.id)}
                aria-label="Dismiss"
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside ToastProvider");
  return context.toast;
}
