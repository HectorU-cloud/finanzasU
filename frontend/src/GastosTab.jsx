import { useEffect, useState } from "react";
import { CreditCard, Receipt, ChevronLeft, ChevronRight, Download, Plus } from "lucide-react";
import { descargarArchivo } from "./utils/descargas.js";
import { api } from "./api.js";
import { useToast } from "./ToastContext.jsx";
import { SkeletonList } from "./Skeleton.jsx";
import EmptyState from "./EmptyState.jsx";

const NOMBRES_MES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

export default function GastosTab({
  tarjetas = [],
  anioInicial = null,
  mesInicial = null,
  onAbrirTarjeta,
  onEditarEgreso,
  onNuevoEgreso,
}) {
  const hoy = new Date();
  const [periodo, setPeriodo] = useState({
    anio: anioInicial ?? hoy.getFullYear(),
    mes: mesInicial ?? hoy.getMonth() + 1,
  });
  const [gastos, setGastos] = useState([]);
  const [egresos, setEgresos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [exportando, setExportando] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    setCargando(true);
    setError("");
    Promise.all([
      api.getGastos(periodo.anio, periodo.mes).catch(() => []),
      api.getEgresosCuenta(periodo.anio, periodo.mes).catch(() => []),
    ])
      .then(([g, e]) => {
        setGastos(Array.isArray(g) ? g : []);
        setEgresos(Array.isArray(e) ? e : []);
      })
      .catch((err) => setError(err.message))
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

  function nombreTarjeta(id) {
    return tarjetas.find((t) => t.id === id)?.nombre || "—";
  }

  async function exportar() {
    const ultimoDia = new Date(periodo.anio, periodo.mes, 0).getDate();
    const desde = `${periodo.anio}-${String(periodo.mes).padStart(2, "0")}-01`;
    const hasta = `${periodo.anio}-${String(periodo.mes).padStart(2, "0")}-${ultimoDia}`;
    setExportando(true);
    try {
      await descargarArchivo(api.exportarGastos(desde, hasta));
      showToast("CSV descargado ✓");
    } catch (err) {
      showToast("No se pudo descargar: " + err.message, "error");
    } finally {
      setExportando(false);
    }
  }

  // Unificar y ordenar por fecha descendente
  const movimientos = [
    ...gastos.map((g) => ({ ...g, _tipo: "tarjeta" })),
    ...egresos.map((e) => ({ ...e, _tipo: "cuenta" })),
  ].sort((a, b) => (a.fecha < b.fecha ? 1 : -1));

  const total = movimientos.reduce((acc, m) => acc + Number(m.monto || 0), 0);

  return (
    <div>
      {/* Navegación de mes */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => cambiarMes(-1)}
          className="w-9 h-9 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50"
        >
          <ChevronLeft size={16} />
        </button>
        <div className="text-center">
          <p className="text-xs text-gray-500">Total del mes</p>
          <p className="text-2xl font-bold text-coral">
            -${total.toFixed(2)}
          </p>
        </div>
        <button
          onClick={() => cambiarMes(1)}
          className="w-9 h-9 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Botón registrar gasto directo */}
      <button
        onClick={() => onNuevoEgreso?.()}
        className="w-full mb-3 py-3 rounded-2xl bg-coral text-white font-semibold text-sm flex items-center justify-center gap-2 hover:bg-coral-dark transition-colors"
      >
        <Plus size={16} /> Registrar gasto directo
      </button>

      {/* Botón exportar CSV */}
      <button
        onClick={exportar}
        disabled={exportando}
        className="w-full mb-4 py-2.5 rounded-xl border border-coral/30 bg-coral/5 text-coral font-semibold text-xs flex items-center justify-center gap-2 hover:bg-coral/10 transition-colors disabled:opacity-50"
      >
        <Download size={14} />
        {exportando ? "Generando CSV..." : `Descargar CSV de ${NOMBRES_MES[periodo.mes - 1]}`}
      </button>

      {cargando ? (
        <SkeletonList count={4} variant="card" />
      ) : movimientos.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          titulo="Sin gastos este mes"
          mensaje="Cuando registres gastos aparecerán aquí."
          colorIcono="coral"
        />
      ) : (
        <div className="space-y-2">
          {movimientos.map((m) => {
            const esTarjeta = m._tipo === "tarjeta";
            return (
              <button
                key={`${m._tipo}-${m.id}`}
                onClick={() => {
                  if (esTarjeta) {
                    onAbrirTarjeta?.(m.tarjeta_id, periodo.anio, periodo.mes);
                  } else {
                    onEditarEgreso?.(m);
                  }
                }}
                className="w-full bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3 text-left hover:bg-gray-50 active:scale-[0.99] transition-transform"
              >
                <div
                  className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                    esTarjeta
                      ? "bg-coral/10 text-coral"
                      : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {esTarjeta ? <CreditCard size={18} /> : <Receipt size={18} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-carbon text-sm truncate">
                    {m.descripcion || m.categoria || "Gasto"}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {m.fecha} · {esTarjeta ? nombreTarjeta(m.tarjeta_id) : "Cuenta directa"}
                    {m.categoria && ` · ${m.categoria}`}
                  </p>
                </div>
                <p className="font-bold text-coral whitespace-nowrap">
                  -${Number(m.monto).toFixed(2)}
                </p>
              </button>
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