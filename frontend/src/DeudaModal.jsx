import { useState } from "react";
import { HandCoins, X } from "lucide-react";
import { api } from "./api.js";

export default function DeudaModal({ deuda, onCerrar, onGuardado }) {
  const editando = Boolean(deuda);
  const [form, setForm] = useState({
    persona: deuda?.persona || "",
    tipo: deuda?.tipo || "debo",
    monto: deuda?.monto_original || "",
    descripcion: deuda?.descripcion || "",
    frecuencia_recordatorio_dias: deuda?.frecuencia_recordatorio_dias || "",
  });
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!form.persona.trim()) {
      setError(form.tipo === "debo" ? "¿A quién le debes?" : "¿Quién te debe?");
      return;
    }
    if (!editando) {
      const montoNum = Number(form.monto);
      if (!montoNum || montoNum <= 0) {
        setError("El monto debe ser mayor a 0.");
        return;
      }
    }
    setCargando(true);
    try {
      const frecuencia = form.frecuencia_recordatorio_dias
        ? Number(form.frecuencia_recordatorio_dias)
        : null;

      if (editando) {
        await api.actualizarDeuda(deuda.id, {
          persona: form.persona.trim(),
          descripcion: form.descripcion || null,
          frecuencia_recordatorio_dias: frecuencia,
        });
      } else {
        await api.crearDeuda({
          persona: form.persona.trim(),
          tipo: form.tipo,
          monto: Number(form.monto),
          descripcion: form.descripcion || null,
          frecuencia_recordatorio_dias: frecuencia,
        });
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
        className="bg-white rounded-t-3xl sm:rounded-3xl p-6 w-full max-w-sm shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="flex items-center gap-2 text-lg font-semibold text-carbon">
            <HandCoins size={18} className="text-coral" />
            {editando ? "Editar deuda" : "Nueva deuda"}
          </h3>
          <button
            onClick={onCerrar}
            className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-500"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!editando && (
            <div className="flex bg-gray-100 p-1 rounded-2xl">
              <button
                type="button"
                onClick={() => setForm({ ...form, tipo: "debo" })}
                className={`flex-1 py-2 text-sm font-semibold rounded-xl transition-all ${
                  form.tipo === "debo" ? "bg-white text-coral shadow-sm" : "text-gray-500"
                }`}
              >
                Yo debo
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, tipo: "me_deben" })}
                className={`flex-1 py-2 text-sm font-semibold rounded-xl transition-all ${
                  form.tipo === "me_deben" ? "bg-white text-emerald-600 shadow-sm" : "text-gray-500"
                }`}
              >
                Me deben
              </button>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              {form.tipo === "debo" ? "¿A quién le debes?" : "¿Quién te debe?"}
            </label>
            <input
              type="text"
              placeholder="ej. Mi hermano"
              value={form.persona}
              onChange={(e) => setForm({ ...form, persona: e.target.value })}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:border-coral focus:outline-none text-sm"
              autoFocus
            />
          </div>

          {!editando && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Monto total
              </label>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={form.monto}
                onChange={(e) => setForm({ ...form, monto: e.target.value })}
                className="w-full text-2xl font-bold text-carbon px-3 py-3 rounded-xl border border-gray-200 focus:border-coral focus:outline-none"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Descripción (opcional)
            </label>
            <input
              type="text"
              placeholder="ej. préstamo para el carro"
              value={form.descripcion}
              onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:border-coral focus:outline-none text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Recordarme cada (días)
            </label>
            <input
              type="number"
              min="1"
              max="365"
              placeholder="ej. 7 — déjalo vacío para no recordar"
              value={form.frecuencia_recordatorio_dias}
              onChange={(e) => setForm({ ...form, frecuencia_recordatorio_dias: e.target.value })}
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
            className="w-full bg-coral text-white font-semibold py-3 rounded-xl hover:bg-coral-dark transition-colors disabled:opacity-60"
          >
            {cargando ? "Guardando..." : editando ? "Guardar cambios" : "Crear deuda"}
          </button>
        </form>
      </div>
    </div>
  );
}
