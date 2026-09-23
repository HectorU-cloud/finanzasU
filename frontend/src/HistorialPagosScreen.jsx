import { useEffect, useState } from "react";
import { Receipt, Trash2, ArrowLeft, Plus, CreditCard, Download } from "lucide-react";
import { descargarArchivo } from "./utils/descargas.js";
import { api } from "./api.js";
import ConfirmModal from "./ConfirmModal.jsx";
import EgresoCuentaModal from "./EgresoCuentaModal.jsx";
import { SkeletonList } from "./Skeleton.jsx";
import EmptyState from "./EmptyState.jsx";

const NOMBRES_MES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

export default function HistorialPagosScreen({ onVolver, ocultarHeader = false }) {
  const [pagos, setPagos] = useState([]);
  const [egresos, setEgresos] = useState([]);
  const [tarjetas, setTarjetas] = useState([]);
  const [cuentas, setCuentas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [pagoAEliminar, setPagoAEliminar] = useState(null);
  const [egresoEditando, setEgresoEditando] = useState(null);
  const [modalEgreso, setModalEgreso] = useState(false);
  const [exportando, setExportando] = useState(false);

  async function cargar() {
    setCargando(true);
    try {
      const [pagosData, egresosData, tarjetasData, cuentasData] = await Promise.all([
        api.getPagosTarjeta(),
        api.getEgresosCuenta(),
        api.getTarjetas(),
        api.getCuentas(),
      ]);
      setPagos(pagosData || []);
      setEgresos(egresosData || []);
      setTarjetas(tarjetasData || []);
      setCuentas(cuentasData || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  function nombreTarjeta(id) {
    return tarjetas.find((t) => t.id === id)?.nombre || "—";
  }

  function nombreCuenta(id) {
    return cuentas.find((c) => c.id === id)?.nombre || "—";
  }

  // Unificamos y ordenamos por fecha
  const movimientos = [
    ...pagos.map((p) => ({
      tipo: "tarjeta",
      id: `p-${p.id}`,
      fecha: p.fecha_pago,
      monto: Number(p.monto),
      titulo: `Pago a ${nombreTarjeta(p.tarjeta_id)}`,
      subtitulo: `${NOMBRES_MES[p.mes_cerrado - 1]} ${p.anio_cerrado} · desde ${nombreCuenta(p.cuenta_id)}`,
      data: p,
    })),
    ...egresos.map((e) => ({
      tipo: "egreso",
      id: `e-${e.id}`,
      fecha: e.fecha,
      monto: Number(e.monto),
      titulo: e.descripcion || e.categoria || "Gasto directo",
      subtitulo: `${nombreCuenta(e.cuenta_id)}${e.categoria ? ` · ${e.categoria}` : ""}`,
      data: e,
    })),
  ].sort((a, b) => (a.fecha < b.fecha ? 1 : -1));

  const totalPagado = movimientos.reduce((acc, m) => acc + m.monto, 0);

  async function confirmarEliminar() {
    if (!pagoAEliminar) return;
    try {
      if (pagoAEliminar.tipo === "tarjeta") {
        await api.eliminarPagoTarjeta(pagoAEliminar.data.id);
      } else {
        await api.eliminarEgresoCuenta(pagoAEliminar.data.id);
      }
      setPagoAEliminar(null);
      await cargar();
    } catch (err) {
      setError(err.message);
      setPagoAEliminar(null);
    }
  }

  async function exportar() {
    const ahora = new Date();
    const haceTresMeses = new Date(ahora.getFullYear(), ahora.getMonth() - 3, 1);
    const desde = haceTresMeses.toISOString().slice(0, 10);
    const hasta = ahora.toISOString().slice(0, 10);
    setExportando(true);
    await descargarArchivo(api.exportarPagos(desde, hasta));
    setExportando(false);
  }

  return (
    <div className={ocultarHeader ? "" : "max-w-md mx-auto px-4 pb-28 pt-6"}>
      {!ocultarHeader && (
        <header className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            {onVolver && (
              <button
                onClick={onVolver}
                className="w-9 h-9 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-500"
              >
                <ArrowLeft size={18} />
              </button>
            )}
            <div>
              <h1 className="text-2xl font-bold text-carbon">Historial de pagos</h1>
              <p className="text-sm text-gray-500">
                Total: ${totalPagado.toFixed(2)}
              </p>
            </div>
          </div>
        </header>
      )}

      {/* Botón agregar gasto directo */}
      <button
        onClick={() => {
          setEgresoEditando(null);
          setModalEgreso(true);
        }}
        className="w-full mb-4 py-3 rounded-2xl bg-coral text-white font-semibold text-sm flex items-center justify-center gap-2 hover:bg-coral-dark transition-colors"
      >
        <Plus size={16} /> Registrar gasto directo
      </button>

      {/* Botón Descargar CSV */} 

      <button
        onClick={exportar}
        disabled={exportando}
        className="w-full mb-4 py-2.5 rounded-xl border border-coral/30 bg-coral/5 text-coral font-semibold text-xs flex items-center justify-center gap-2 hover:bg-coral/10 transition-colors disabled:opacity-50"
      >
        <Download size={14} />
        {exportando ? "Generando CSV..." : "Descargar CSV (últimos 3 meses)"}
      </button>

      {cargando ? (
      <SkeletonList count={3} variant="card" />
      ) : movimientos.length === 0 ? (
        <EmptyState
          icon={Receipt}
          titulo="Aún no hay pagos"
          mensaje="Cuando pagues una tarjeta o registres un gasto directo, aparecerá aquí."
          colorIcono="coral"
        />
      ) : (
        <div className="space-y-3">
          {movimientos.map((m) => (
            <div key={m.id} className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div
                  className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                    m.tipo === "tarjeta"
                      ? "bg-coral/10 text-coral"
                      : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {m.tipo === "tarjeta" ? <Receipt size={18} /> : <CreditCard size={18} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-carbon text-sm truncate">{m.titulo}</p>
                  <p className="text-xs text-gray-500 capitalize truncate">{m.subtitulo}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{m.fecha}</p>
                </div>
                <div className="text-right flex flex-col items-end gap-2">
                  <p className="font-bold text-carbon">-${m.monto.toFixed(2)}</p>
                  <div className="flex gap-1">
                    {m.tipo === "egreso" && (
                      <button
                        onClick={() => {
                          setEgresoEditando(m.data);
                          setModalEgreso(true);
                        }}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-carbon"
                        title="Editar"
                      >
                        ✎
                      </button>
                    )}
                    <button
                      onClick={() => setPagoAEliminar(m)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:bg-red-50 hover:text-red-500"
                      title="Eliminar"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2 mt-4">
          {error}
        </p>
      )}

      {pagoAEliminar && (
        <ConfirmModal
          titulo={pagoAEliminar.tipo === "tarjeta" ? "Eliminar pago" : "Eliminar gasto directo"}
          mensaje={
            pagoAEliminar.tipo === "tarjeta"
              ? `¿Eliminar el pago de $${pagoAEliminar.monto.toFixed(2)} a ${pagoAEliminar.titulo.replace("Pago a ", "")}? Los gastos volverán a quedar pendientes.`
              : `¿Eliminar el gasto de $${pagoAEliminar.monto.toFixed(2)} (${pagoAEliminar.titulo})? El dinero volverá a la cuenta.`
          }
          textoConfirmar="Sí, eliminar"
          onConfirmar={confirmarEliminar}
          onCancelar={() => setPagoAEliminar(null)}
        />
      )}

      {modalEgreso && (
        <EgresoCuentaModal
          egreso={egresoEditando}
          onCerrar={() => {
            setModalEgreso(false);
            setEgresoEditando(null);
          }}
          onGuardado={() => {
            setModalEgreso(false);
            setEgresoEditando(null);
            cargar();
          }}
        />
      )}
    </div>
  );
}