import { createContext, useContext, useState, useCallback, useMemo, useRef } from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

const ToastContext = createContext(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast debe usarse dentro de ToastProvider");
  return ctx;
}

const MAX_TOASTS = 3;
const DEBOUNCE_MS = 800;
const DURACION_DEFAULT = 3000;
const DURACION_CON_ACCION = 5000;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const ultimosMensajes = useRef({});

  /**
   * showToast(mensaje, tipo, opciones)
   * - tipo: "exito" | "error" | "info"
   * - opciones.accion: texto del botón (ej: "Deshacer")
   * - opciones.onAccion: función a ejecutar al tocar el botón
   * - opciones.duracion: ms que dura (default 3000, con acción 5000)
   */
  const showToast = useCallback((mensaje, tipo = "exito", opciones = {}) => {
    const ahora = Date.now();
    const ultimo = ultimosMensajes.current[mensaje] || 0;
    const tieneAccion = Boolean(opciones.accion);

    // Si tiene acción, siempre se muestra (no debounce) para no perder el "Deshacer"
    if (!tieneAccion && ahora - ultimo < DEBOUNCE_MS) {
      return;
    }
    ultimosMensajes.current[mensaje] = ahora;

    const id = `${ahora}-${Math.random()}`;
    const duracion =
      opciones.duracion ?? (tieneAccion ? DURACION_CON_ACCION : DURACION_DEFAULT);

    setToasts((prev) => {
      const nuevos = [
        ...prev,
        {
          id,
          mensaje,
          tipo,
          accion: opciones.accion,
          onAccion: opciones.onAccion,
        },
      ];
      return nuevos.slice(-MAX_TOASTS);
    });

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duracion);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
}

function ToastContainer({ toasts, onRemove }) {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed top-4 left-0 right-0 z-[100] flex flex-col items-center gap-2 pointer-events-none px-4">
      {toasts.map((t) => (
        <Toast key={t.id} toast={t} onRemove={onRemove} />
      ))}
    </div>
  );
}

function Toast({ toast, onRemove }) {
  const estilos = {
    exito: { bg: "bg-emerald-600", Icono: CheckCircle2 },
    error: { bg: "bg-red-600", Icono: AlertCircle },
    info: { bg: "bg-blue-600", Icono: Info },
  };

  const { bg, Icono } = estilos[toast.tipo] || estilos.exito;

  function handleAccion(e) {
    e.stopPropagation();
    if (toast.onAccion) toast.onAccion();
    onRemove(toast.id);
  }

  return (
    <div
      className={`${bg} text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 pointer-events-auto animate-toast max-w-md w-full`}
    >
      <Icono size={18} className="shrink-0" />
      <span className="text-sm font-medium flex-1">{toast.mensaje}</span>

      {toast.accion && (
        <button
          onClick={handleAccion}
          className="shrink-0 text-xs font-bold uppercase tracking-wider bg-white/20 hover:bg-white/30 px-3 py-1 rounded-full transition-colors"
        >
          {toast.accion}
        </button>
      )}

      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove(toast.id);
        }}
        className="opacity-70 hover:opacity-100 shrink-0"
      >
        <X size={16} />
      </button>
    </div>
  );
}