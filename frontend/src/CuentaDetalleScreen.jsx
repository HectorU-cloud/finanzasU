import { useEffect, useState } from "react";
import { ArrowLeft, TrendingUp, CreditCard, Target, Wallet } from "lucide-react";
import { api } from "./api.js";

const ICONOS_TIPO = {
  ingreso: TrendingUp,
  pago_tarjeta: CreditCard,
  deposito_pote: Target,
  retiro_pote: Target,
};

const COLORES_TIPO = {
  ingreso: "text-emerald-600",
  pago_tarjeta: "text-coral",
  deposito_pote: "text-coral",
  retiro_pote: "text-emerald-600",
};

export default function CuentaDetalleScreen({ cuenta, onVolver }) {
  const [movimientos, setMovimientos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api.getMovimientosCuenta(cuenta.id)
      .then((d) => setMovimientos(d || []))
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
  }, [cuenta.id]);

  return (
    <div className="max-w-md mx-auto px-4 pb-28 pt-6">
      <button
        onClick={onVolver}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-carbon mb-4"
      >
        <ArrowLeft size={16} /> Volver a cuentas
      </button>

      {/* Header de cuenta */}
      <div className="bg-gradient-to-br from-violet-500 to-violet-700 rounded-3xl p-5 text-white shadow-xl mb-5">
        <div className="flex items-center gap-2 mb-2">
          <Wallet size={18} />
          <p className="text-xs opacity-80 uppercase">{cuenta.tipo}</p>
        </div>
        <h1 className="text-2xl font-bold mb-3">{cuenta.nombre}</h1>
        <p className="text-xs opacity-75">Saldo actual</p>
        <p className="text-3xl font-bold">
          ${Number(cuenta.saldo_actual ?? cuenta.saldo_inicial).toFixed(2)}
        </p>
      </div>

      <h2 className="text-base font-semibold text-carbon mb-3">
        Historial de movimientos
      </h2>

      {cargando ? (
        <p className="text-sm text-gray-400 text-center py-8">Cargando...</p>
      ) : movimientos.length === 0 ? (
        <div className="border-2 border-dashed border-gray-300 rounded-2xl p-8 text-center">
          <p className="text-sm text-gray-500">
            Sin movimientos todavía
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {movimientos.map((m, i) => {
            const Icono = ICONOS_TIPO[m.tipo] || Wallet;
            const color = COLORES_TIPO[m.tipo] || "text-gray-500";
            const positivo = Number(m.monto) >= 0;
            return (
              <div
                key={`${m.tipo}-${m.referencia_id}-${i}`}
                className="bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3"
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${positivo ? "bg-emerald-50" : "bg-coral/10"} shrink-0`}>
                  <Icono size={16} className={color} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-carbon truncate">
                    {m.descripcion || "Movimiento"}
                  </p>
                  <p className="text-xs text-gray-500">
                    {m.fecha}
                  </p>
                </div>
                <p className={`font-bold text-sm ${positivo ? "text-emerald-600" : "text-coral"}`}>
                  {positivo ? "+" : ""}${Number(m.monto).toFixed(2)}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2 mt-4">
          {error}
        </p>
      )}
    </div>
  );
}