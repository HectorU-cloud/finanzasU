import { useState } from "react";
import { Wallet, X } from "lucide-react";
import { api } from "./api.js";

const TIPOS = [
  { valor: "efectivo",  nombre: "Efectivo" },
  { valor: "ahorros",   nombre: "Ahorros" },
  { valor: "corriente", nombre: "Corriente" },
  { valor: "inversion", nombre: "Inversión" },
  { valor: "otra",      nombre: "Otra" },
];

export default function CuentaModal({ cuenta, onCerrar, onGuardado }) {
  const editando = Boolean(cuenta);
  const [form, setForm] = useState({
    nombre: cuenta?.nombre || "",
    tipo: cuenta?.tipo || "ahorros",
    saldo_inicial: cuenta?.saldo_inicial ?? "",
    fijada: cuenta?.fijada === 1 || cuenta?.fijada === true,
    numero_cuenta: cuenta?.numero_cuenta || "",
  });
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!form.nombre.trim()) {
      setError("Ponle un nombre a la cuenta.");
      return;
    }
    const saldoNum = Number(form.saldo_inicial);

    if (saldoNum > 1000000) {
      setError("El saldo no puede ser mayor a 1,000,000");
      return;
    }

    if (form.numero_cuenta && form.numero_cuenta.length !== 10) {
      setError("El número de cuenta debe tener exactamente 10 dígitos.");
      return;
    }

    if (isNaN(saldoNum) || saldoNum < 0) {
      setError("El saldo debe ser un número mayor o igual a 0.");
      return;
    }
    setCargando(true);
    try {
      const datos = {
        nombre: form.nombre.trim(),
        tipo: form.tipo,
        saldo_inicial: saldoNum,
        fijada: form.fijada,
        numero_cuenta: form.numero_cuenta || null,
      };
      if (editando) {
        await api.actualizarCuenta(cuenta.id, datos);
      } else {
        await api.crearCuenta(datos);
      }
      onGuardado();
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onCerrar}>
      <div
        className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="flex items-center gap-2 text-lg font-semibold text-carbon">
            <Wallet size={18} />
            {editando ? "Editar cuenta" : "Nueva cuenta"}
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
              Nombre
            </label>
            <input
              type="text"
              placeholder="ej. Ahorros Guayaquil"
              value={form.nombre}
              onChange={(e) => {
              const soloLetrasYNumeros = e.target.value.replace(/[^a-zA-Z0-9 áéíóúÁÉÍÓÚñÑ]/g, "");
              setForm({ ...form, nombre: soloLetrasYNumeros });
              }}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:border-coral focus:outline-none text-sm"
            />
          </div>

          {/* NUEVO: Número de cuenta */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Número de cuenta (10 dígitos)
            </label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={10}
              placeholder="ej. 2001536970"
              value={form.numero_cuenta}
              onChange={(e) => {
                const soloNumeros = e.target.value.replace(/\D/g, "");
                setForm({ ...form, numero_cuenta: soloNumeros });
              }}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:border-coral focus:outline-none text-sm font-mono tracking-widest"
            />
            <p className="text-[10px] text-gray-400 mt-1">
              Opcional. Solo números, exactamente 10 dígitos.
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Tipo
            </label>
            <select
              value={form.tipo}
              onChange={(e) => setForm({ ...form, tipo: e.target.value })}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:border-coral focus:outline-none text-sm bg-white"
            >
              {TIPOS.map((t) => (
                <option key={t.valor} value={t.valor}>{t.nombre}</option>
              ))}
            </select>
            <p className="text-[10px] text-gray-400 mt-1">
              "Efectivo" para dinero físico. "Otra" para plataformas digitales (PayPal, Binance, etc).
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Saldo actual
            </label>
            <input
              type="number"
              step="0.01"
              placeholder="0.00"
              value={form.saldo_inicial}
              onChange={(e) => setForm({ ...form, saldo_inicial: e.target.value })}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:border-coral focus:outline-none text-sm"
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={form.fijada}
              onChange={(e) => setForm({ ...form, fijada: e.target.checked })}
              className="w-4 h-4 accent-coral"
            />
            <span className="text-sm text-gray-700">
              Destacar en la pantalla de inicio
            </span>
          </label>

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
            {cargando ? "Guardando..." : editando ? "Guardar cambios" : "Crear cuenta"}
          </button>
        </form>
      </div>
    </div>
  );
}