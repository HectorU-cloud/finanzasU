import { useEffect, useState } from "react";
import {
  X,
  ArrowDownCircle,
  ArrowUpCircle,
  Pencil,
  Trash2,
} from "lucide-react";
import { api } from "./api.js";

export default function VerMovimientosPoteModal({
  pote,
  onCerrar,
  onMeter,
  onSacar,
  onEditar,
  onEliminar,
}) {
  const [movimientos, setMovimientos] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    api.getMovimientosPote(pote.id)
      .then((d) => setMovimientos(d || []))
      .catch(() => {})
      .finally(() => setCargando(false));
  }, [pote.id]);

  const porcentaje = Math.min((Number(pote.saldo) / Number(pote.meta)) * 100, 100);
  const completado = Number(pote.saldo) >= Number(pote.meta);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onCerrar}
    >
      <div
        className="bg-white rounded-t-3xl sm:rounded-3xl p-6 w-full max-w-sm shadow-2xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-3xl shrink-0">{pote.emoji}</span>
            <div className="min-w-0">
              <h3 className="text-lg font-semibold text-carbon truncate">
                {pote.nombre}
              </h3>
            </div>
          </div>
          <button
            onClick={onCerrar}
            className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-500 shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {/* Saldo y progreso */}
        <div className="bg-gray-50 rounded-2xl p-4 mb-4">
          <p className="text-xs text-gray-500 mb-1">Saldo actual</p>
          <p className="text-3xl font-bold text-carbon mb-3">
            ${Number(pote.saldo).toFixed(2)}
          </p>
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs text-gray-500">
              Meta: ${Number(pote.meta).toFixed(2)}
            </span>
            <span
              className={`text-xs font-semibold ${
                completado ? "text-emerald-600" : "text-coral"
              }`}
            >
              {porcentaje.toFixed(0)}%
            </span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${
                completado ? "bg-emerald-500" : "bg-coral"
              }`}
              style={{ width: `${porcentaje}%` }}
            />
          </div>
        </div>

        {/* Botones Meter / Sacar */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <button
            onClick={onMeter}
            className="py-3 rounded-xl bg-emerald-600 text-white font-semibold text-sm flex items-center justify-center gap-2 hover:bg-emerald-700 transition-colors"
          >
            <ArrowDownCircle size={16} /> Meter
          </button>
          <button
            onClick={onSacar}
            disabled={Number(pote.saldo) <= 0}
            className="py-3 rounded-xl bg-coral text-white font-semibold text-sm flex items-center justify-center gap-2 hover:bg-coral-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ArrowUpCircle size={16} /> Sacar
          </button>
        </div>

        {/* Botones Editar / Eliminar */}
        <div className="grid grid-cols-2 gap-2 mb-5">
          <button
            onClick={onEditar}
            className="py-2.5 rounded-xl border border-gray-200 text-carbon font-medium text-sm flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors"
          >
            <Pencil size={14} /> Editar
          </button>
          <button
            onClick={onEliminar}
            className="py-2.5 rounded-xl border border-red-200 text-red-600 font-medium text-sm flex items-center justify-center gap-2 hover:bg-red-50 transition-colors"
          >
            <Trash2 size={14} /> Eliminar
          </button>
        </div>

        {/* Historial */}
        <p className="text-xs font-semibold text-gray-500 uppercase mb-2">
          Historial
        </p>

        {cargando ? (
          <p className="text-sm text-gray-400 text-center py-4">Cargando...</p>
        ) : movimientos.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">
            Sin movimientos aún
          </p>
        ) : (
          <div className="space-y-2 overflow-y-auto flex-1">
            {movimientos.map((m) => {
              const esDeposito = Number(m.monto) > 0;
              return (
                <div
                  key={m.id}
                  className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-b-0"
                >
                  {esDeposito ? (
                    <ArrowDownCircle size={16} className="text-emerald-600 shrink-0" />
                  ) : (
                    <ArrowUpCircle size={16} className="text-coral shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-carbon truncate">
                      {m.descripcion || (esDeposito ? "Depósito" : "Retiro")}
                    </p>
                    <p className="text-xs text-gray-400">{m.fecha}</p>
                  </div>
                  <p
                    className={`font-semibold text-sm shrink-0 ${
                      esDeposito ? "text-emerald-600" : "text-coral"
                    }`}
                  >
                    {esDeposito ? "+" : ""}${Number(m.monto).toFixed(2)}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}