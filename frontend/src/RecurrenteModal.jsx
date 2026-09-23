import { useState, useEffect } from "react";
import { Calendar, X, Plus, Trash2 } from "lucide-react";
import { api } from "./api.js";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function RecurrenteModal({ recurrente, onCerrar, onGuardado }) {
  const editando = Boolean(recurrente);
  const [cuentas, setCuentas] = useState([]);
  const [tarjetas, setTarjetas] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  const [form, setForm] = useState({
    nombre: recurrente?.nombre || "",
    tipo: recurrente?.tipo || "ingreso",
    cuenta_id: recurrente?.cuenta_id || "",
    tarjeta_id: recurrente?.tarjeta_id || "",
    monto_total: recurrente?.monto_total || "",
    frecuencia: recurrente?.frecuencia || "mensual",
    categoria: recurrente?.categoria || "",
    descripcion: recurrente?.descripcion || "",
    fecha_inicio: recurrente?.fecha_inicio || todayISO(),
    pagos: recurrente?.pagos || [
      { dia_del_mes: 0, porcentaje: 100, etiqueta: "Pago único" },
    ],
  });

  useEffect(() => {
    Promise.all([
      api.getCuentas().catch(() => []),
      api.getTarjetas().catch(() => []),
      api.getCategorias("gasto").catch(() => ({ categorias: [] })),
      api.getCategorias("ingreso").catch(() => ({ categorias: [] })),
    ]).then(([c, t, gastosCats, ingresosCats]) => {
      setCuentas(Array.isArray(c) ? c : []);
      setTarjetas(Array.isArray(t) ? t : []);
      setCategorias([...new Set([...(gastosCats?.categorias || []), ...(ingresosCats?.categorias || [])])]);
    });
  }, []);

  function actualizarPago(index, campo, valor) {
    const nuevos = [...form.pagos];
    nuevos[index] = { ...nuevos[index], [campo]: valor };
    setForm({ ...form, pagos: nuevos });
  }

  function agregarPago() {
    setForm({
      ...form,
      pagos: [...form.pagos, { dia_del_mes: 15, porcentaje: 0, etiqueta: "" }],
    });
  }

  function eliminarPago(index) {
    if (form.pagos.length <= 1) return;
    const nuevos = form.pagos.filter((_, i) => i !== index);
    setForm({ ...form, pagos: nuevos });
  }

  function aplicarPreset(preset) {
    if (preset === "50-50") {
      setForm({
        ...form,
        pagos: [
          { dia_del_mes: 15, porcentaje: 50, etiqueta: "Primera quincena" },
          { dia_del_mes: 0, porcentaje: 50, etiqueta: "Segunda quincena" },
        ],
      });
    } else if (preset === "40-60") {
      setForm({
        ...form,
        pagos: [
          { dia_del_mes: 15, porcentaje: 40, etiqueta: "Primera quincena" },
          { dia_del_mes: 0, porcentaje: 60, etiqueta: "Segunda quincena" },
        ],
      });
    } else if (preset === "100") {
      setForm({
        ...form,
        pagos: [{ dia_del_mes: 0, porcentaje: 100, etiqueta: "Pago único" }],
      });
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!form.nombre.trim()) {
      setError("Ponle un nombre.");
      return;
    }
    const montoNum = Number(form.monto_total);
    if (!montoNum || montoNum <= 0) {
      setError("El monto total debe ser mayor a 0.");
      return;
    }
    if (form.tipo === "ingreso" && !form.cuenta_id) {
      setError("Los ingresos necesitan una cuenta destino.");
      return;
    }
    if (form.tipo === "gasto_cuenta" && !form.cuenta_id) {
      setError("Los gastos necesitan una cuenta de origen.");
      return;
    }
    if (form.tipo === "gasto_tarjeta" && !form.tarjeta_id) {
      setError("Los gastos de tarjeta necesitan una tarjeta.");
      return;
    }

    const suma = form.pagos.reduce((acc, p) => acc + Number(p.porcentaje || 0), 0);
    if (Math.abs(suma - 100) > 0.01) {
      setError(`Los porcentajes deben sumar 100%. Actual: ${suma}%`);
      return;
    }

    if (form.pagos.some((p) => !p.porcentaje || Number(p.porcentaje) <= 0)) {
      setError("Todos los pagos deben tener un porcentaje mayor a 0.");
      return;
    }

    setCargando(true);
    try {
      const datos = {
        nombre: form.nombre.trim(),
        tipo: form.tipo,
        cuenta_id: form.cuenta_id ? Number(form.cuenta_id) : null,
        tarjeta_id: form.tarjeta_id ? Number(form.tarjeta_id) : null,
        monto_total: montoNum,
        frecuencia: form.frecuencia,
        categoria: form.categoria || null,
        descripcion: form.descripcion || null,
        fecha_inicio: form.fecha_inicio,
        pagos: form.pagos.map((p) => ({
          dia_del_mes: Number(p.dia_del_mes),
          porcentaje: Number(p.porcentaje),
          etiqueta: p.etiqueta || null,
        })),
      };

      if (editando) {
        await api.actualizarRecurrente(recurrente.id, {
          nombre: datos.nombre,
          monto_total: datos.monto_total,
          categoria: datos.categoria,
          descripcion: datos.descripcion,
        });
      } else {
        await api.crearRecurrente(datos);
      }
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
        className="rounded-t-3xl sm:rounded-3xl p-6 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto"
        style={{ background: "var(--surface)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="flex items-center gap-2 text-lg font-semibold text-carbon">
            <Calendar size={18} className="text-coral" />
            {editando ? "Editar recurrente" : "Nueva recurrente"}
          </h3>
          <button
            onClick={onCerrar}
            className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-500"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Nombre */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Nombre
            </label>
            <input
              type="text"
              placeholder="ej. Sueldo quincenal"
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:border-coral focus:outline-none text-sm"
              autoFocus
            />
          </div>

          {/* Tipo (solo al crear) */}
          {!editando && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Tipo
              </label>
              <div className="flex bg-gray-100 p-1 rounded-xl">
                {[
                  { id: "ingreso", label: "Ingreso" },
                  { id: "gasto_cuenta", label: "Gasto cuenta" },
                  { id: "gasto_tarjeta", label: "Gasto tarjeta" },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setForm({ ...form, tipo: t.id })}
                    className={`flex-1 py-2 text-[11px] font-semibold rounded-lg transition-all ${
                      form.tipo === t.id
                        ? "bg-white text-coral shadow-sm"
                        : "text-gray-500"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Cuenta o Tarjeta según tipo */}
          {form.tipo === "ingreso" && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Cuenta destino
              </label>
              <select
                value={form.cuenta_id}
                onChange={(e) => setForm({ ...form, cuenta_id: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:border-coral focus:outline-none text-sm bg-white"
              >
                <option value="">Selecciona una cuenta</option>
                {cuentas.map((c) => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </select>
            </div>
          )}

          {form.tipo === "gasto_cuenta" && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Cuenta origen
              </label>
              <select
                value={form.cuenta_id}
                onChange={(e) => setForm({ ...form, cuenta_id: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:border-coral focus:outline-none text-sm bg-white"
              >
                <option value="">Selecciona una cuenta</option>
                {cuentas.map((c) => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </select>
            </div>
          )}

          {form.tipo === "gasto_tarjeta" && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Tarjeta
              </label>
              <select
                value={form.tarjeta_id}
                onChange={(e) => setForm({ ...form, tarjeta_id: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:border-coral focus:outline-none text-sm bg-white"
              >
                <option value="">Selecciona una tarjeta</option>
                {tarjetas.map((t) => (
                  <option key={t.id} value={t.id}>{t.nombre}</option>
                ))}
              </select>
            </div>
          )}

          {/* Monto total */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Monto total ({form.frecuencia})
            </label>
            <input
              type="number"
              step="0.01"
              placeholder="0.00"
              value={form.monto_total}
              onChange={(e) => setForm({ ...form, monto_total: e.target.value })}
              className="w-full text-2xl font-bold text-carbon px-3 py-3 rounded-xl border border-gray-200 focus:border-coral focus:outline-none"
            />
          </div>

          {/* Frecuencia */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Frecuencia
            </label>
            <select
              value={form.frecuencia}
              onChange={(e) => setForm({ ...form, frecuencia: e.target.value })}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:border-coral focus:outline-none text-sm bg-white"
            >
              <option value="mensual">Mensual</option>
              <option value="anual">Anual</option>
            </select>
          </div>

          {/* Split de pagos */}
          {!editando && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-medium text-gray-500">
                  ¿Cómo se reparte?
                </label>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => aplicarPreset("100")}
                    className="text-[10px] px-2 py-1 rounded-full border border-gray-200 hover:border-coral hover:text-coral"
                  >
                    100%
                  </button>
                  <button
                    type="button"
                    onClick={() => aplicarPreset("50-50")}
                    className="text-[10px] px-2 py-1 rounded-full border border-gray-200 hover:border-coral hover:text-coral"
                  >
                    50/50
                  </button>
                  <button
                    type="button"
                    onClick={() => aplicarPreset("40-60")}
                    className="text-[10px] px-2 py-1 rounded-full border border-gray-200 hover:border-coral hover:text-coral"
                  >
                    40/60
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                {form.pagos.map((pago, i) => (
                  <div
                    key={i}
                    className="rounded-xl p-3 space-y-2"
                    style={{
                      background: "var(--surface-alt)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-carbon">
                        Pago {i + 1}
                      </span>
                      {form.pagos.length > 1 && (
                        <button
                          type="button"
                          onClick={() => eliminarPago(i)}
                          className="w-6 h-6 rounded-full flex items-center justify-center text-red-500 hover:bg-red-50"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[10px] text-gray-500 mb-1">
                          Día (0=último)
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="31"
                          value={pago.dia_del_mes}
                          onChange={(e) =>
                            actualizarPago(i, "dia_del_mes", e.target.value)
                          }
                          className="w-full px-2 py-1.5 rounded-lg border border-gray-200 focus:border-coral focus:outline-none text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-gray-500 mb-1">
                          %
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={pago.porcentaje}
                          onChange={(e) =>
                            actualizarPago(i, "porcentaje", e.target.value)
                          }
                          className="w-full px-2 py-1.5 rounded-lg border border-gray-200 focus:border-coral focus:outline-none text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-gray-500 mb-1">
                          Monto
                        </label>
                        <input
                          type="text"
                          disabled
                          value={`$${(
                            (Number(form.monto_total) *
                              Number(pago.porcentaje || 0)) /
                            100
                          ).toFixed(2)}`}
                          className="w-full px-2 py-1.5 rounded-lg bg-gray-100 text-gray-500 text-sm"
                        />
                      </div>
                    </div>

                    <input
                      type="text"
                      placeholder="Etiqueta (ej. Primera quincena)"
                      value={pago.etiqueta || ""}
                      onChange={(e) =>
                        actualizarPago(i, "etiqueta", e.target.value)
                      }
                      className="w-full px-2 py-1.5 rounded-lg border border-gray-200 focus:border-coral focus:outline-none text-xs"
                    />
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={agregarPago}
                className="mt-2 w-full py-2 rounded-xl border-2 border-dashed border-gray-300 text-gray-500 text-xs font-medium hover:border-coral hover:text-coral transition-colors flex items-center justify-center gap-1"
              >
                <Plus size={12} /> Agregar otro pago
              </button>
            </div>
          )}

          {/* Categoría */}
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

          {/* Descripción */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Descripción (opcional)
            </label>
            <input
              type="text"
              placeholder="ej. pagado por el trabajo"
              value={form.descripcion}
              onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:border-coral focus:outline-none text-sm"
            />
          </div>

          {/* Fecha inicio */}
          {!editando && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Fecha de inicio
              </label>
              <input
                type="date"
                value={form.fecha_inicio}
                onChange={(e) => setForm({ ...form, fecha_inicio: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:border-coral focus:outline-none text-sm"
              />
            </div>
          )}

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
            {cargando ? "Guardando..." : editando ? "Guardar cambios" : "Crear recurrente"}
          </button>
        </form>
      </div>
    </div>
  );
}