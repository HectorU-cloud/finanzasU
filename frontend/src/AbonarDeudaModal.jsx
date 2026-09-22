import { useState } from "react";
import { HandCoins, PartyPopper, X } from "lucide-react";
import { api } from "./api.js";


function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function AbonarDeudaModal({ deuda, onCerrar, onGuardado }) {
  const [form, setForm] = useState({ monto: "", fecha: todayISO(), nota: "", cuenta_id: "",});
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  const [resultado, setResultado] = useState(null); // { deuda, quedo_saldada }

  const saldoPendiente = Number(deuda.saldo_pendiente);
  const verbo = deuda.tipo === "debo" ? "Abonar a" : "Registrar pago de";

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    const montoNum = Number(form.monto);
    if (!montoNum || montoNum <= 0) {
      setError("El monto debe ser mayor a 0.");
      return;
    }
    if (montoNum > saldoPendiente) {
      setError(`El saldo pendiente es de $${saldoPendiente.toFixed(2)}.`);
      return;
    }
    if (form.fecha > todayISO()) {
      setError("La fecha no puede ser futura.");
      return;
    }
    setCargando(true);
    try {
      const r = await api.abonarDeuda(deuda.id, {
        monto: montoNum,
        fecha: form.fecha,
        nota: form.nota || null,
        cuenta_id: form.cuenta_id ? Number(form.cuenta_id) : null,  // <-- NUEVO
      });
      setResultado(r);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }

    const [cuentas, setCuentas] = useState([]);

  useEffect(() => {
    api.getCuentas()
      .then((d) => setCuentas(d || []))
      .catch(() => setCuentas([]));
  }, []);
  }

  if (resultado) {
    return (
      <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4">
        <div className="bg-white rounded-t-3xl sm:rounded-3xl p-8 w-full max-w-sm shadow-2xl text-center">
          {resultado.quedo_saldada ? (
            <>
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-4">
                <PartyPopper size={30} />
              </div>
              <h3 className="text-xl font-bold text-carbon mb-2">¡Excelente!</h3>
              <p className="text-sm text-gray-500 mb-6">
                Has {deuda.tipo === "debo" ? "pagado" : "cobrado"} en total{" "}
                <span className="font-semibold text-carbon">
                  ${Number(resultado.deuda.monto_original).toFixed(2)}
                </span>{" "}
                de {deuda.tipo === "debo" ? "tu deuda con" : "lo que te debía"}{" "}
                {deuda.persona}.
              </p>
            </>
          ) : (
            <>
              <div className="w-16 h-16 rounded-full bg-coral-soft text-coral flex items-center justify-center mx-auto mb-4">
                <HandCoins size={28} />
              </div>
              <h3 className="text-xl font-bold text-carbon mb-2">¡Abono registrado!</h3>
              <p className="text-sm text-gray-500 mb-6">
                Todavía queda pendiente{" "}
                <span className="font-semibold text-carbon">
                  ${Number(resultado.deuda.saldo_pendiente).toFixed(2)}
                </span>{" "}
                con {deuda.persona}.
              </p>
            </>
          )}
          <button
            onClick={onGuardado}
            className="w-full bg-coral text-white font-semibold py-3 rounded-xl hover:bg-coral-dark transition-colors"
          >
            Listo
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onCerrar}>
      <div
        className="bg-white rounded-t-3xl sm:rounded-3xl p-6 w-full max-w-sm shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="flex items-center gap-2 text-lg font-semibold text-carbon">
            <HandCoins size={18} className="text-coral" />
            {verbo} {deuda.persona}
          </h3>
          <button
            onClick={onCerrar}
            className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-500"
          >
            <X size={18} />
          </button>
        </div>

        <div className="bg-gray-50 rounded-xl p-3 mb-4">
          <p className="text-xs text-gray-500">Saldo pendiente</p>
          <p className="text-lg font-bold text-carbon">${saldoPendiente.toFixed(2)}</p>
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
            <button
              type="button"
              onClick={() => setForm({ ...form, monto: String(saldoPendiente) })}
              className="text-xs text-coral font-medium mt-1"
            >
              Saldar todo (${saldoPendiente.toFixed(2)})
            </button>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Fecha</label>
            <input
              type="date"
              value={form.fecha}
              max={todayISO()}
              onChange={(e) => setForm({ ...form, fecha: e.target.value })}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:border-coral focus:outline-none text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Nota (opcional)</label>
            <input
              type="text"
              placeholder="ej. le di en efectivo"
              value={form.nota}
              onChange={(e) => setForm({ ...form, nota: e.target.value })}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:border-coral focus:outline-none text-sm"
            />
          </div>

                    <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              {deuda.tipo === "debo"
                ? "¿De qué cuenta sale el dinero? (opcional)"
                : "¿A qué cuenta entra el dinero? (opcional)"}
            </label>
            <select
              value={form.cuenta_id}
              onChange={(e) => setForm({ ...form, cuenta_id: e.target.value })}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:border-coral focus:outline-none text-sm bg-white"
            >
              <option value="">Sin afectar ninguna cuenta</option>
              {cuentas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre} (${Number(c.saldo_actual ?? c.saldo_inicial).toFixed(2)})
                </option>
              ))}
            </select>
            <p className="text-[10px] text-gray-400 mt-1">
              {deuda.tipo === "debo"
                ? "Si eliges una cuenta, el saldo bajará automáticamente."
                : "Si eliges una cuenta, el saldo subirá automáticamente."}
            </p>
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
            {cargando ? "Guardando..." : "Registrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
