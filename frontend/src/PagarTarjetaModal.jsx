import { useEffect, useState } from "react";
import { CreditCard, X, CheckCircle2 } from "lucide-react";
import { api } from "./api.js";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

const NOMBRES_MES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

export default function PagarTarjetaModal({ tarjeta, onCerrar, onPagado }) {
  const hoy = new Date();
  const [cuentas, setCuentas] = useState([]);
  const [estado, setEstado] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [form, setForm] = useState({
    cuenta_id: "",
    monto: "",
    fecha_pago: todayISO(),
  });
  const [error, setError] = useState("");
  const [exito, setExito] = useState(false);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    async function cargar() {
      try {
        const [cuentasData, estadoData] = await Promise.all([
          api.getCuentas(),
          api.getEstadoPagoTarjeta(tarjeta.id, hoy.getFullYear(), hoy.getMonth() + 1),
        ]);
        setCuentas(cuentasData || []);
        setEstado(estadoData);
        setForm((f) => ({
          ...f,
          cuenta_id: cuentasData[0]?.id || "",
          monto: estadoData?.pendiente > 0 ? Number(estadoData.pendiente).toFixed(2) : "",
        }));
      } catch (err) {
        setError(err.message);
      } finally {
        setCargando(false);
      }
    }
    cargar();
  }, [tarjeta.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!form.cuenta_id) {
      setError("Selecciona una cuenta de origen.");
      return;
    }
    const montoNum = Number(form.monto);
    if (!montoNum || montoNum <= 0) {
      setError("El monto debe ser mayor a 0.");
      return;
    }
    if (estado && montoNum > Number(estado.pendiente)) {
      setError(`El monto excede lo pendiente ($${Number(estado.pendiente).toFixed(2)})`);
      return;
    }
    if (form.fecha_pago > todayISO()) {
      setError("La fecha no puede ser futura.");
      return;
    }

    // Validar saldo suficiente en la cuenta seleccionada
    const cuentaSeleccionada = cuentas.find((c) => c.id === Number(form.cuenta_id));
    if (cuentaSeleccionada) {
      const saldoDisponible = Number(
        cuentaSeleccionada.saldo_actual ?? cuentaSeleccionada.saldo_inicial ?? 0
      );
      if (montoNum > saldoDisponible) {
        setError(
          `Saldo insuficiente en "${cuentaSeleccionada.nombre}". ` +
          `Disponible: $${saldoDisponible.toFixed(2)}`
        );
        return;
      }
    }

    setEnviando(true);
    try {
      await api.crearPagoTarjeta({
        tarjeta_id: tarjeta.id,
        cuenta_id: Number(form.cuenta_id),
        monto: montoNum,
        anio: hoy.getFullYear(),
        mes: hoy.getMonth() + 1,
        fecha_pago: form.fecha_pago,
      });
      setExito(true);
      setTimeout(() => {
        onPagado();
      }, 1800);
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  function usarPendienteCompleto() {
    if (estado?.pendiente > 0) {
      setForm((f) => ({ ...f, monto: Number(estado.pendiente).toFixed(2) }));
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
        <div className="flex items-center justify-between mb-5">
          <h3 className="flex items-center gap-2 text-lg font-semibold text-carbon">
            <CreditCard size={18} />
            Pagar tarjeta
          </h3>
          <button
            onClick={onCerrar}
            className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-500"
          >
            <X size={18} />
          </button>
        </div>

        {exito ? (
          <div className="text-center py-8">
            <CheckCircle2 size={48} className="text-emerald-500 mx-auto mb-3" />
            <p className="font-semibold text-carbon mb-1">¡Pago registrado!</p>
            <p className="text-sm text-gray-500">Actualizando saldos...</p>
          </div>
        ) : cargando ? (
          <p className="text-sm text-gray-400 text-center py-8">Cargando...</p>
        ) : !estado ? (
          <p className="text-sm text-red-500 text-center py-8">
            No se pudo cargar el estado de la tarjeta
          </p>
        ) : estado.total_gastos === 0 ? (
          <div className="text-center py-6">
            <p className="text-sm text-gray-500">
              Esta tarjeta no tiene gastos en {NOMBRES_MES[hoy.getMonth()]} {hoy.getFullYear()}.
            </p>
          </div>
        ) : estado.cerrado ? (
          <div className="text-center py-6">
            <CheckCircle2 size={40} className="text-emerald-500 mx-auto mb-3" />
            <p className="font-semibold text-carbon mb-1">
              Ya está pagada
            </p>
            <p className="text-sm text-gray-500">
              Esta tarjeta se pagó completamente para {NOMBRES_MES[hoy.getMonth()]} {hoy.getFullYear()}.
            </p>
          </div>
        ) : (
          <>
            {/* Resumen del mes */}
            <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-4 mb-5">
              <p className="text-xs text-gray-500 mb-1">
                {tarjeta.nombre} · {NOMBRES_MES[hoy.getMonth()]} {hoy.getFullYear()}
              </p>
              <div className="grid grid-cols-3 gap-2 mt-3">
                <div>
                  <p className="text-[10px] text-gray-400 uppercase">Gastos</p>
                  <p className="text-sm font-bold text-carbon">
                    ${Number(estado.total_gastos).toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 uppercase">Pagado</p>
                  <p className="text-sm font-bold text-emerald-600">
                    ${Number(estado.total_pagado).toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 uppercase">Pendiente</p>
                  <p className="text-sm font-bold text-coral">
                    ${Number(estado.pendiente).toFixed(2)}
                  </p>
                </div>
              </div>

              {/* Barra de progreso */}
              <div className="mt-3">
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 transition-all"
                    style={{ width: `${Math.min(estado.porcentaje_pagado, 100)}%` }}
                  />
                </div>
                <p className="text-[10px] text-gray-500 mt-1">
                  {estado.porcentaje_pagado}% pagado
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Monto a pagar
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={form.monto}
                    onChange={(e) => setForm({ ...form, monto: e.target.value })}
                    className="w-full text-2xl font-bold text-carbon px-3 py-3 rounded-xl border border-gray-200 focus:border-coral focus:outline-none pr-24"
                  />
                  <button
                    type="button"
                    onClick={usarPendienteCompleto}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-coral bg-coral/10 px-2 py-1 rounded-lg"
                  >
                    Pagar todo
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Desde la cuenta
                </label>
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
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Fecha del pago
                </label>
                <input
                  type="date"
                  value={form.fecha_pago}
                  max={todayISO()}
                  min="2000-01-01"
                  onChange={(e) => setForm({ ...form, fecha_pago: e.target.value })}
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
                disabled={enviando || cuentas.length === 0}
                className="w-full bg-coral text-white font-semibold py-3 rounded-xl hover:bg-coral-dark transition-colors disabled:opacity-60"
              >
                {enviando ? "Procesando..." : `Pagar $${Number(form.monto || 0).toFixed(2)}`}
              </button>

              {cuentas.length === 0 && (
                <p className="text-xs text-amber-600 text-center">
                  Primero crea una cuenta para poder pagar
                </p>
              )}
            </form>
          </>
        )}
      </div>
    </div>
  );
}