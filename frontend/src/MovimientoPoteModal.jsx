import { useState } from "react";
import { ArrowDownCircle, ArrowUpCircle, X } from "lucide-react";
import { api } from "./api.js";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function MovimientoPoteModal({ pote, tipo, onCerrar, onGuardado }) {
  const esDeposito = tipo === "deposito";
  const [form, setForm] = useState({
    monto: "",
    descripcion: "",
    fecha: todayISO(),
  });
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    const montoNum = Number(form.monto);
    if (!montoNum || montoNum <= 0) {
      setError("El monto debe ser mayor a 0.");
      return;
    }
    if (!esDeposito && montoNum > Number(pote.saldo)) {
      setError(`El pote solo tiene $${Number(pote.saldo).toFixed(2)}`);
      return;
    }
    if (form.fecha > todayISO()) {
      setError("La fecha no puede ser futura.");
      return;
    }
    setCargando(true);
    try {
      const datos = {
        monto: montoNum,
        descripcion: form.descripcion || null,
        fecha: form.fecha,
      };
      if (esDeposito) {
        await api.depositarPote(pote.id, datos);
      } else {
        await api.retirarPote(pote.id, datos);
      }
      onGuardado();
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onCerrar}>
      <div
        className="bg-white rounded-t-3xl sm:rounded-3xl p-6 w-full max-w-sm shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="flex items-center gap-2 text-lg font-semibold text-carbon">
            {esDeposito ? (
              <ArrowDownCircle size={18} className="text-emerald-600" />
            ) : (
              <ArrowUpCircle size={18} className="text-coral" />
            )}
            {esDeposito ? "Depositar al pote" : "Retirar del pote"}
          </h3>
          <button
            onClick={onCerrar}
            className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-500"
          >
            <X size={18} />
          </button>
        </div>

        <div className="bg-gray-50 rounded-xl p-3 mb-4 flex items-center gap-2">
          <span className="text-2xl">{pote.emoji}</span>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-carbon text-sm truncate">{pote.nombre}</p>
            <p className="text-xs text-gray-500">
              Saldo actual: ${Number(pote.saldo).toFixed(2)} / ${Number(pote.meta).toFixed(2)}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Monto
            </label>
            <input
              type="number"
              step="0.01"
              placeholder="0.00"
              value={form.monto}
              onChange={(e) => setForm({ ...form, monto: e.target.value })}
              className="w-full text-2xl font-bold text-carbon px-3 py-3 rounded-xl border border-gray-200 focus:border-coral focus:outline-none"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Fecha
            </label>
            <input
              type="date"
              value={form.fecha}
              max={todayISO()}
              onChange={(e) => setForm({ ...form, fecha: e.target.value })}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:border-coral focus:outline-none text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Descripción (opcional)
            </label>
            <input
              type="text"
              placeholder="ej. ahorro semanal"
              value={form.descripcion}
              onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:border-coral focus:outline-none text-sm"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={cargando}
            className={`w-full text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-60 ${
              esDeposito ? "bg-emerald-600 hover:bg-emerald-700" : "bg-coral hover:bg-coral-dark"
            }`}
          >
            {cargando ? "Guardando..." : esDeposito ? "Depositar" : "Retirar"}
          </button>
        </form>
      </div>
    </div>
  );
}