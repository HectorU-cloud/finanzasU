import { useEffect, useState } from "react";
import { AlertTriangle, X, Loader2 } from "lucide-react";
import { api } from "./api.js";
import { useToast } from "./ToastContext.jsx";

function formatMoney(n) {
  return `$${Number(n).toFixed(2)}`;
}

export default function EliminarCuentaModal({ cuenta, onCerrar, onEliminada }) {
  const [deps, setDeps] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [confirmText, setConfirmText] = useState("");
  const [eliminando, setEliminando] = useState(false);
  const [error, setError] = useState("");
  const { showToast } = useToast();

  useEffect(() => {
    setCargando(true);
    api
      .getDependenciasCuenta(cuenta.id)
      .then((d) => setDeps(d))
      .catch((err) => setError(err.message))
      .finally(() => setCargando(false));
  }, [cuenta.id]);

  const nombreExacto = cuenta.nombre;
  const coincide = confirmText === nombreExacto;
  const sinDependencias = deps && !deps.tiene_dependencias;

  // Lista de items a mostrar en el resumen
  const items = deps
    ? [
        deps.ingresos.cantidad > 0 && {
          texto: `${deps.ingresos.cantidad} ingreso${deps.ingresos.cantidad !== 1 ? "s" : ""} por ${formatMoney(deps.ingresos.total)}`,
        },
        deps.pagos_tarjeta.cantidad > 0 && {
          texto: `${deps.pagos_tarjeta.cantidad} pago${deps.pagos_tarjeta.cantidad !== 1 ? "s" : ""} de tarjeta por ${formatMoney(deps.pagos_tarjeta.total)}`,
        },
        deps.egresos_directos.cantidad > 0 && {
          texto: `${deps.egresos_directos.cantidad} egreso${deps.egresos_directos.cantidad !== 1 ? "s" : ""} directo${deps.egresos_directos.cantidad !== 1 ? "s" : ""} por ${formatMoney(deps.egresos_directos.total)}`,
        },
        deps.potes.cantidad > 0 && {
          texto: `${deps.potes.cantidad} pote${deps.potes.cantidad !== 1 ? "s" : ""} con ${formatMoney(deps.potes.total_ahorrado)} ahorrados`,
        },
        deps.tarjetas_debito.cantidad > 0 && {
          texto: `${deps.tarjetas_debito.cantidad} tarjeta${deps.tarjetas_debito.cantidad !== 1 ? "s" : ""} de débito (${deps.tarjetas_debito.nombres.join(", ")})`,
        },
        deps.abonos_deuda.cantidad > 0 && {
          texto: `${deps.abonos_deuda.cantidad} abono${deps.abonos_deuda.cantidad !== 1 ? "s" : ""} de deuda por ${formatMoney(deps.abonos_deuda.total)}`,
        },
        deps.recurrentes.cantidad > 0 && {
          texto: `${deps.recurrentes.cantidad} recurrente${deps.recurrentes.cantidad !== 1 ? "s" : ""} (${deps.recurrentes.nombres.join(", ")})`,
        },
      ].filter(Boolean)
    : [];

  async function handleEliminarSimple() {
    setEliminando(true);
    setError("");
    try {
      await api.eliminarCuenta(cuenta.id);
      showToast("Cuenta eliminada ✓");
      onEliminada();
    } catch (err) {
      setError(err.message);
      setEliminando(false);
    }
  }

  async function handleEliminarTodo() {
    if (!coincide) return;
    setEliminando(true);
    setError("");
    try {
      await api.eliminarCuentaTodo(cuenta.id, confirmText);
      showToast("Cuenta eliminada permanentemente", "info");
      onEliminada();
    } catch (err) {
      setError(err.message);
      setEliminando(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onCerrar}
    >
      <div
        className="bg-white rounded-t-3xl sm:rounded-3xl p-6 w-full max-w-sm shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h3 className="flex items-center gap-2 text-lg font-semibold text-carbon">
            <AlertTriangle size={18} className="text-coral" />
            {sinDependencias ? "Eliminar cuenta" : "Eliminar permanentemente"}
          </h3>
          <button
            onClick={onCerrar}
            className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-500"
            disabled={eliminando}
          >
            <X size={18} />
          </button>
        </div>

        {cargando ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={24} className="animate-spin text-coral" />
          </div>
        ) : error && !deps ? (
          <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">
            {error}
          </p>
        ) : sinDependencias ? (
          <>
            <p className="text-sm text-gray-600 mb-6">
              ¿Eliminar <strong className="text-carbon">{cuenta.nombre}</strong>?
              Esta cuenta no tiene movimientos registrados.
            </p>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2 mb-4">
                {error}
              </p>
            )}

            <div className="flex gap-2">
              <button
                onClick={onCerrar}
                className="flex-1 py-3 rounded-xl border border-gray-200 text-carbon font-medium text-sm"
                disabled={eliminando}
              >
                Cancelar
              </button>
              <button
                onClick={handleEliminarSimple}
                disabled={eliminando}
                className="flex-1 py-3 rounded-xl bg-coral text-white font-semibold text-sm hover:bg-coral-dark transition-colors disabled:opacity-60"
              >
                {eliminando ? "Eliminando..." : "Sí, eliminar"}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
              <p className="text-xs text-amber-800 leading-relaxed">
                Vas a eliminar <strong>{cuenta.nombre}</strong>. Esta cuenta contiene:
              </p>
              <ul className="mt-2 space-y-1">
                {items.map((item, i) => (
                  <li key={i} className="text-xs text-amber-800 flex items-start gap-1.5">
                    <span className="text-amber-500 mt-0.5">·</span>
                    <span>{item.texto}</span>
                  </li>
                ))}
              </ul>
            </div>

            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2 mb-4 leading-relaxed">
              Si continúas, TODOS estos datos se borrarán permanentemente y{" "}
              <strong>NO podrán recuperarse</strong> desde la papelera.
            </p>

            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-500 mb-1.5">
                Escribe <strong className="text-carbon">{nombreExacto}</strong> para confirmar:
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={nombreExacto}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:border-coral focus:outline-none text-sm"
                disabled={eliminando}
                autoFocus
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2 mb-4">
                {error}
              </p>
            )}

            <div className="flex gap-2">
              <button
                onClick={onCerrar}
                className="flex-1 py-3 rounded-xl border border-gray-200 text-carbon font-medium text-sm"
                disabled={eliminando}
              >
                Cancelar
              </button>
              <button
                onClick={handleEliminarTodo}
                disabled={!coincide || eliminando}
                className={`flex-1 py-3 rounded-xl font-semibold text-sm transition-colors ${
                  coincide && !eliminando
                    ? "bg-red-600 text-white hover:bg-red-700"
                    : "bg-gray-200 text-gray-400 cursor-not-allowed"
                }`}
              >
                {eliminando ? "Eliminando..." : "Eliminar permanentemente"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
