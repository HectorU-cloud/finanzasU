import { useState, useEffect } from "react";
import { Receipt, X } from "lucide-react";
import { api } from "./api.js";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function EgresoCuentaModal({ egreso, onCerrar, onGuardado }) {
  const editando = Boolean(egreso);
  const [cuentas, setCuentas] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [form, setForm] = useState({
    cuenta_id: egreso?.cuenta_id || "",
    monto: egreso?.monto || "",
    fecha: egreso?.fecha || todayISO(),
    categoria: egreso?.categoria || "",
    descripcion: egreso?.descripcion || "",
  });
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    Promise.all([
      api.getCuentas().catch(() => []),
      api.getCategorias().catch(() => ({ categorias: [] })),
    ]).then(([cs, cats]) => {
      setCuentas(cs || []);
      setCategorias(cats?.categorias || []);
      if (!editando && cs?.length > 0) {
        setForm((f) => ({ ...f, cuenta_id: f.cuenta_id || cs[0].id }));
      }
    });
  }, [editando]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!form.cuenta_id) {
      setError("Selecciona una cuenta.");
      return;
    }
    const montoNum = Number(form.monto);
    if (!montoNum || montoNum <= 0) {
      setError("El monto debe ser mayor a 0.");
      return;
    }
    if (form.fecha > todayISO()) {
      setError("La fecha no puede ser futura.");
      return;
    }
    setCargando(true);
    try {
      const datos = {
        cuenta_id: Number(form.cuenta_id),
        monto: montoNum,
        fecha: form.fecha,
        categoria: form.categoria || null,
        descripcion: form.descripcion || null,
      };
      if (editando) {
        await api.actualizarEgresoCuenta(egreso.id, datos);
      } else {
        await api.crearEgresoCuenta(datos);
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
            <Receipt size={18} className="text-coral" />
            {editando ? "Editar gasto directo" : "Nuevo gasto directo"}
          </h3>
          <button
            onClick={onCerrar}
            className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-500"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Monto</label>
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
            <label className="block text-xs font-medium text-gray-500 mb-1">Cuenta</label>
            <select
              value={form.cuenta_id}
              onChange={(e) => setForm({ ...form, cuenta_id: e.target.value })}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:border-coral focus:outline-none text-sm bg-white"
            >
              {cuentas.length === 0 && <option value="">Sin cuentas</option>}
              {cuentas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre} (${Number(c.saldo_actual ?? c.saldo_inicial).toFixed(2)})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Categoría (opcional)</label>
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
            <label className="block text-xs font-medium text-gray-500 mb-1">Fecha</label>
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
            <label className="block text-xs font-medium text-gray-500 mb-1">Descripción (opcional)</label>
            <input
              type="text"
              placeholder="ej. corte del perro"
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
            disabled={cargando || cuentas.length === 0}
            className="w-full bg-coral text-white font-semibold py-3 rounded-xl hover:bg-coral-dark transition-colors disabled:opacity-60"
          >
            {cargando ? "Guardando..." : editando ? "Guardar cambios" : "Registrar gasto"}
          </button>
        </form>
      </div>
    </div>
  );
}