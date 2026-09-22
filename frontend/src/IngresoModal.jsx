import { useEffect, useState } from "react";
import { TrendingUp, X } from "lucide-react";
import { api } from "./api.js";
import { useToast } from "./ToastContext.jsx";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function IngresoModal({ ingreso, cuentas, onCerrar, onGuardado }) {
  const editando = Boolean(ingreso);
  const [categorias, setCategorias] = useState([]);
  const [form, setForm] = useState({
    cuenta_id: ingreso?.cuenta_id || cuentas[0]?.id || "",
    fecha: ingreso?.fecha || todayISO(),
    monto: ingreso?.monto || "",
    descripcion: ingreso?.descripcion || "",
    categoria: ingreso?.categoria || "",
  });
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    api.getCategoriasIngreso()
      .then((d) => setCategorias(d.categorias))
      .catch(() => {});
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!form.cuenta_id) {
      setError("Selecciona una cuenta destino.");
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
        fecha: form.fecha,
        monto: montoNum,
        descripcion: form.descripcion || null,
        categoria: form.categoria || null,
      };
      if (editando) {
        await api.actualizarIngreso(ingreso.id, datos);
      } else {
        await api.crearIngreso(datos);
      }
      showToast(editando ? "Ingreso actualizado ✓" : "Ingreso registrado ✓");
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
            <TrendingUp size={18} className="text-emerald-600" />
            {editando ? "Editar ingreso" : "Nuevo ingreso"}
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
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Monto
            </label>
            <input
              type="number"
              step="0.01"
              placeholder="0.00"
              value={form.monto}
              onChange={(e) => setForm({ ...form, monto: e.target.value })}
              className="w-full text-2xl font-bold text-carbon px-3 py-3 rounded-xl border border-gray-200 focus:border-emerald-500 focus:outline-none"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Cuenta destino
            </label>
            <select
              value={form.cuenta_id}
              onChange={(e) => setForm({ ...form, cuenta_id: e.target.value })}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:border-emerald-500 focus:outline-none text-sm bg-white"
            >
              {cuentas.length === 0 && <option value="">Sin cuentas disponibles</option>}
              {cuentas.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Categoría
            </label>
            <select
              value={form.categoria}
              onChange={(e) => setForm({ ...form, categoria: e.target.value })}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:border-emerald-500 focus:outline-none text-sm bg-white"
            >
              <option value="">Sin categoría</option>
              {categorias.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

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
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:border-emerald-500 focus:outline-none text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Descripción (opcional)
            </label>
            <input
              type="text"
              placeholder="ej. sueldo de octubre"
              value={form.descripcion}
              onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:border-emerald-500 focus:outline-none text-sm"
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
            className="w-full bg-emerald-600 text-white font-semibold py-3 rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-60"
          >
            {cargando ? "Guardando..." : editando ? "Guardar cambios" : "Registrar ingreso"}
          </button>

          {cuentas.length === 0 && (
            <p className="text-xs text-amber-600 text-center">
              Primero crea una cuenta para poder registrar ingresos.
            </p>
          )}
        </form>
      </div>
    </div>
  );
}