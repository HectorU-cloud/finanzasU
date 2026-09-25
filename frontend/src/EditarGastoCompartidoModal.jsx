import { useState } from "react";
import { Pencil, X } from "lucide-react";
import { api } from "./api.js";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function EditarGastoCompartidoModal({
  grupoId,
  gasto,
  categorias,
  tarjetas = [],
  onCerrar,
  onGuardado,
}) {
  const [form, setForm] = useState({
    fecha: gasto.fecha,
    monto: gasto.monto,
    descripcion: gasto.descripcion || "",
    categoria: gasto.categoria || "",
    tarjeta_id: gasto.tarjeta_id || "",
  });
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    const montoNum = Number(form.monto);
    if (!form.fecha || !montoNum || montoNum <= 0) {
      setError("Completa fecha y un monto válido.");
      return;
    }
    if (form.fecha > todayISO()) {
      setError("La fecha no puede ser futura.");
      return;
    }
    setCargando(true);
    try {
      await api.actualizarGastoCompartido(grupoId, gasto.id, {
        fecha: form.fecha,
        monto: montoNum,
        descripcion: form.descripcion || null,
        categoria: form.categoria || null,
        tarjeta_id: form.tarjeta_id ? Number(form.tarjeta_id) : null,
      });
      onGuardado();
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onCerrar}
    >
      <div
        className="rounded-t-3xl sm:rounded-3xl p-6 w-full max-w-sm shadow-2xl max-h-[90vh] overflow-y-auto"
        style={{ background: "var(--surface)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="flex items-center gap-2 text-lg font-semibold text-carbon">
            <Pencil size={18} className="text-coral" />
            Editar gasto
          </h3>
          <button
            onClick={onCerrar}
            className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-500"
          >
            <X size={18} />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4"
          onKeyDown={(e) => {
            if (e.key === "Escape") onCerrar();
          }}
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Fecha
              </label>
              <input
                type="date"
                value={form.fecha}
                max={todayISO()}
                min="2000-01-01"
                onChange={(e) => setForm({ ...form, fecha: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:border-coral focus:outline-none text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Monto
              </label>
              <input
                type="number"
                step="0.01"
                value={form.monto}
                onChange={(e) => setForm({ ...form, monto: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:border-coral focus:outline-none text-sm font-semibold"
              />
            </div>
          </div>

          <p className="text-[10px] text-gray-400 -mt-2">
            Si cambias el monto, las divisiones se recalculan equitativamente.
          </p>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Pagado con (opcional)
            </label>
            <select
              value={form.tarjeta_id}
              onChange={(e) => setForm({ ...form, tarjeta_id: e.target.value })}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:border-coral focus:outline-none text-sm bg-white"
            >
              <option value="">Sin especificar</option>
              {tarjetas.map((t) => (
                <option key={t.id} value={t.id}>{t.nombre}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Categoría (opcional)
            </label>
            <select
              value={form.categoria}
              onChange={(e) => setForm({ ...form, categoria: e.target.value })}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:border-coral focus:outline-none text-sm bg-white"
            >
              <option value="">Sin categoría</option>
              {categorias.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Descripción (opcional)
            </label>
            <input
              type="text"
              value={form.descripcion}
              onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
              placeholder="ej. mercado"
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
            {cargando ? "Guardando..." : "Guardar cambios"}
          </button>
        </form>
      </div>
    </div>
  );
}