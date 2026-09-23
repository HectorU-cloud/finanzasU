import { useEffect, useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Scale } from "lucide-react";
import { api } from "./api.js";
import { SkeletonList } from "./Skeleton.jsx";
import EmptyState from "./EmptyState.jsx";

const COLORES = {
  verde: "bg-emerald-500",
  rojo: "bg-red-500",
  azul: "bg-blue-500",
  morado: "bg-purple-500",
  naranja: "bg-orange-500",
  amarillo: "bg-amber-400",
};

const DIAS_SEMANA = ["L", "M", "M", "J", "V", "S", "D"];

export default function CalendarioScreen({ onVolver }) {
  const hoy = new Date();
  const [periodo, setPeriodo] = useState({
    anio: hoy.getFullYear(),
    mes: hoy.getMonth() + 1,
  });
  const [data, setData] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setCargando(true);
    api.getCalendario(periodo.anio, periodo.mes)
      .then((d) => {
        if (d && Array.isArray(d.dias)) {
          setData(d);
        } else {
          setError("Respuesta inválida del servidor");
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
  }, [periodo]);

  function cambiarMes(delta) {
    setPeriodo((p) => {
      let mes = p.mes + delta;
      let anio = p.anio;
      if (mes > 12) { mes = 1; anio += 1; }
      else if (mes < 1) { mes = 12; anio -= 1; }
      return { anio, mes };
    });
  }

  // Calcular padding: días vacíos antes del 1
  const primerDiaSemana = (() => {
    const d = new Date(periodo.anio, periodo.mes - 1, 1).getDay();
    return (d + 6) % 7; // Lunes=0
  })();

  return (
    <div className="max-w-md mx-auto px-4 pb-28 pt-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <button
          onClick={onVolver}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-carbon"
        >
          <ArrowLeft size={16} /> Volver
        </button>
      </div>

      <h1 className="text-3xl font-bold text-carbon mb-5">Calendario</h1>

      {/* Navegación de mes */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => cambiarMes(-1)}
          className="w-9 h-9 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50"
        >
          <ChevronLeft size={16} />
        </button>
        <p className="text-base font-semibold text-carbon capitalize">
          {data?.nombre_mes || ""} {periodo.anio}
        </p>
        <button
          onClick={() => cambiarMes(1)}
          className="w-9 h-9 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {cargando ? (
        <SkeletonList count={3} variant="card" />
      ) : error ? (
        <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</p>
      ) : !data || data.dias.every((d) => d.movimientos.length === 0) ? (
        <EmptyState
          icon={Scale}
          titulo="Sin movimientos este mes"
          mensaje="Cuando registres gastos o ingresos, aparecerán aquí."
          colorIcono="azul"
        />
      ) : (
        <>
          {/* Resumen del mes */}
          <div
            className="rounded-2xl p-4 mb-5 shadow-sm"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
          >
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">
                  Ingresos
                </p>
                <p className="text-sm font-bold text-emerald-600">
                  +${Number(data.total_ingresos).toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">
                  Gastos
                </p>
                <p className="text-sm font-bold text-coral">
                  -${Number(data.total_gastos).toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">
                  Balance
                </p>
                <p
                  className={`text-sm font-bold ${
                    data.balance >= 0 ? "text-emerald-600" : "text-coral"
                  }`}
                >
                  {data.balance >= 0 ? "+" : ""}${Number(data.balance).toFixed(2)}
                </p>
              </div>
            </div>
          </div>

          {/* Días de la semana */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {DIAS_SEMANA.map((d, i) => (
              <div
                key={i}
                className="text-center text-[10px] font-semibold text-gray-400 uppercase"
              >
                {d}
              </div>
            ))}
          </div>

          {/* Grid del calendario */}
          <div className="grid grid-cols-7 gap-1">
            {/* Celdas vacías al inicio */}
            {Array.from({ length: primerDiaSemana }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}

            {/* Días del mes */}
            {data.dias.map((d) => (
              <DiaCelda key={d.dia} dia={d} />
            ))}
          </div>

          {/* Leyenda */}
          <div className="mt-5 p-3 rounded-xl" style={{ background: "var(--surface-alt)" }}>
            <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-2">
              Leyenda
            </p>
            <div className="grid grid-cols-3 gap-y-1.5 gap-x-2 text-[10px] text-gray-600">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Ingreso
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                Gasto
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                Pago tarjeta
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-purple-500" />
                Pote
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-orange-500" />
                Deuda
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                Recurrente
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function DiaCelda({ dia }) {
  const tieneMovs = dia.movimientos.length > 0;

  // Tomar hasta 4 colores únicos
  const colores = [];
  for (const m of dia.movimientos) {
    if (!colores.includes(m.color) && colores.length < 4) {
      colores.push(m.color);
    }
  }

  return (
    <div
      className={`aspect-square rounded-lg p-1 flex flex-col items-center justify-start text-[10px] relative transition-all ${
        dia.es_hoy ? "ring-2 ring-coral font-bold" : ""
      }`}
      style={{
        background: tieneMovs
          ? dia.es_futuro
            ? "var(--surface-alt)"
            : "var(--surface)"
          : "transparent",
        border: tieneMovs ? "1px solid var(--border)" : "none",
        opacity: dia.es_futuro && tieneMovs ? 0.75 : 1,
      }}
      title={
        tieneMovs
          ? dia.movimientos.map((m) => m.titulo).join(", ")
          : undefined
      }
    >
      <span
        className={
          dia.es_hoy
            ? "text-coral"
            : dia.es_futuro
            ? "text-gray-400"
            : "text-carbon"
        }
      >
        {dia.dia}
      </span>
      {tieneMovs && (
        <div className="flex flex-wrap gap-0.5 justify-center mt-0.5 max-w-full">
          {colores.map((c, i) => (
            <span
              key={i}
              className={`w-1.5 h-1.5 rounded-full ${COLORES[c] || "bg-gray-400"}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}