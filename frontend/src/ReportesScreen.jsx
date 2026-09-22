import { useEffect, useState } from "react";
import { ArrowLeft, TrendingUp, TrendingDown, BarChart3, Calendar } from "lucide-react";
import { api } from "./api.js";

export default function ReportesScreen({ onVolver }) {
  const hoy = new Date();
  const [meses, setMeses] = useState(6);
  const [data, setData] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setCargando(true);
    api.getReporteMensual(hoy.getFullYear(), hoy.getMonth() + 1, meses)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
  }, [meses]); // eslint-disable-line react-hooks/exhaustive-deps

  if (cargando) {
    return (
      <div className="max-w-md mx-auto px-4 pb-28 pt-6">
        <button
          onClick={onVolver}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-carbon mb-4"
        >
          <ArrowLeft size={16} /> Volver
        </button>
        <p className="text-sm text-gray-400 text-center py-12">Cargando...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-md mx-auto px-4 pb-28 pt-6">
        <button
          onClick={onVolver}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-carbon mb-4"
        >
          <ArrowLeft size={16} /> Volver
        </button>
        <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</p>
      </div>
    );
  }

  const { meses: datos, total_ingresos, total_gastos, total_balance, mes_mayor_gasto } = data;
  const maxValor = Math.max(
    ...datos.map((m) => Math.max(m.ingresos, m.total_gastos)),
    1 // para evitar división por 0
  );

  return (
    <div className="max-w-md mx-auto px-4 pb-28 pt-6">
      <button
        onClick={onVolver}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-carbon mb-4"
      >
        <ArrowLeft size={16} /> Volver
      </button>

      <h1 className="text-3xl font-bold text-carbon mb-2">Reportes</h1>
      <p className="text-sm text-gray-500 mb-5">
        Comparativa de tus finanzas
      </p>

      {/* Selector de rango */}
      <div className="flex bg-gray-100 p-1 rounded-2xl mb-6">
        {[3, 6, 12].map((n) => (
          <button
            key={n}
            onClick={() => setMeses(n)}
            className={`flex-1 py-2 text-xs sm:text-sm font-semibold rounded-xl transition-all whitespace-nowrap ${
              meses === n
                ? "bg-white text-coral shadow-sm"
                : "text-gray-500 hover:text-carbon"
            }`}
          >
            {n} meses
          </button>
        ))}
      </div>

      {/* Resumen general */}
      <div className="bg-[#2a2a2a] rounded-3xl p-5 text-white mb-6 shadow-lg">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 size={18} className="text-coral" />
          <p className="text-xs uppercase tracking-wider opacity-75">
            Resumen {meses} meses
          </p>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp size={16} className="text-emerald-400" />
              <span className="text-sm opacity-90">Ingresos</span>
            </div>
            <span className="text-lg font-bold text-emerald-400">
              +${total_ingresos.toFixed(2)}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingDown size={16} className="text-coral" />
              <span className="text-sm opacity-90">Gastos</span>
            </div>
            <span className="text-lg font-bold text-coral">
              -${total_gastos.toFixed(2)}
            </span>
          </div>

          <div className="border-t border-white/20 pt-3 flex items-center justify-between">
            <span className="text-sm font-medium">Balance</span>
            <span
              className={`text-2xl font-bold ${
                total_balance >= 0 ? "text-emerald-400" : "text-coral"
              }`}
            >
              {total_balance >= 0 ? "+" : ""}${total_balance.toFixed(2)}
            </span>
          </div>
        </div>

        {mes_mayor_gasto && mes_mayor_gasto.total_gastos > 0 && (
          <div className="mt-4 pt-4 border-t border-white/20 text-xs opacity-75">
            💡 Mes con más gastos:{" "}
            <span className="font-semibold">
              {mes_mayor_gasto.nombre_mes} {mes_mayor_gasto.anio}
            </span>{" "}
            (${mes_mayor_gasto.total_gastos.toFixed(2)})
          </div>
        )}
      </div>

      {/* Comparativa mes a mes */}
      <h2 className="text-base font-semibold text-carbon mb-3">
        Mes a mes
      </h2>

      <div className="space-y-3">
        {datos.map((m) => (
          <MesCard key={`${m.anio}-${m.mes}`} mes={m} maxValor={maxValor} />
        ))}
      </div>
    </div>
  );
}

function MesCard({ mes, maxValor }) {
  const pctIngresos = (mes.ingresos / maxValor) * 100;
  const pctGastos = (mes.total_gastos / maxValor) * 100;

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Calendar size={14} className="text-gray-400" />
          <p className="text-sm font-semibold text-carbon">
            {mes.nombre_mes} {mes.anio}
          </p>
        </div>
        <span
          className={`text-xs font-bold px-2 py-0.5 rounded-full ${
            mes.balance >= 0
              ? "bg-emerald-50 text-emerald-600"
              : "bg-red-50 text-red-600"
          }`}
        >
          {mes.balance >= 0 ? "+" : ""}${mes.balance.toFixed(2)}
        </span>
      </div>

      {/* Ingresos */}
      <div className="mb-2">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-gray-500">Ingresos</span>
          <span className="font-semibold text-emerald-600">
            +${mes.ingresos.toFixed(2)}
          </span>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-500 transition-all"
            style={{ width: `${pctIngresos}%` }}
          />
        </div>
      </div>

      {/* Gastos */}
      <div>
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-gray-500">Gastos</span>
          <span className="font-semibold text-coral">
            -${mes.total_gastos.toFixed(2)}
          </span>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-coral transition-all"
            style={{ width: `${pctGastos}%` }}
          />
        </div>
      </div>
    </div>
  );
}