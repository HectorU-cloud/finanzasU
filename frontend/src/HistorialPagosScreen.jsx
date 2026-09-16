import { useEffect, useState } from "react";
import { Receipt, Trash2, ArrowLeft } from "lucide-react";
import { api } from "./api.js";
import ConfirmModal from "./ConfirmModal.jsx";

const NOMBRES_MES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

export default function HistorialPagosScreen({ onVolver }) {
  const [pagos, setPagos] = useState([]);
  const [tarjetas, setTarjetas] = useState([]);
  const [cuentas, setCuentas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [pagoAEliminar, setPagoAEliminar] = useState(null);

  async function cargar() {
    setCargando(true);
    try {
      const [pagosData, tarjetasData, cuentasData] = await Promise.all([
        api.getPagosTarjeta(),
        api.getTarjetas(),
        api.getCuentas(),
      ]);
      setPagos(pagosData || []);
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

  async function confirmarEliminar() {
    if (!pagoAEliminar) return;
    try {
      await api.eliminarPagoTarjeta(pagoAEliminar.id);
      setPagoAEliminar(null);
      await cargar();
    } catch (err) {
      setError(err.message);
      setPagoAEliminar(null);
    }
  }

  const totalPagado = pagos.reduce((acc, p) => acc + Number(p.monto || 0), 0);

  return (
    <div className="max-w-md mx-auto px-4 pb-28 pt-6">
      <header className="flex items-center gap-3 mb-5">
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
            Total pagado: ${totalPagado.toFixed(2)}
          </p>
        </div>
      </header>

      {cargando ? (
        <p className="text-sm text-gray-400 text-center py-8">Cargando...</p>
      ) : pagos.length === 0 ? (
        <div className="border-2 border-dashed border-gray-300 rounded-2xl p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-coral/10 text-coral flex items-center justify-center mx-auto mb-3">
            <Receipt size={22} />
          </div>
          <p className="text-sm text-gray-600 mb-1 font-medium">Aún no hay pagos</p>
          <p className="text-xs text-gray-400">
            Cuando pagues una tarjeta, aparecerá aquí
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {pagos.map((p) => (
            <div
              key={p.id}
              className="bg-white rounded-2xl p-4 shadow-sm"
            >
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-xl bg-coral/10 text-coral flex items-center justify-center shrink-0">
                  <Receipt size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-carbon text-sm truncate">
                    {nombreTarjeta(p.tarjeta_id)}
                  </p>
                  <p className="text-xs text-gray-500 capitalize">
                    {NOMBRES_MES[p.mes_cerrado - 1]} {p.anio_cerrado} · desde {nombreCuenta(p.cuenta_id)}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Pagado el {p.fecha_pago}
                  </p>
                </div>
                <div className="text-right flex flex-col items-end gap-2">
                  <p className="font-bold text-carbon">
                    -${Number(p.monto).toFixed(2)}
                  </p>
                  <button
                    onClick={() => setPagoAEliminar(p)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:bg-red-50 hover:text-red-500"
                    title="Eliminar pago"
                  >
                    <Trash2 size={14} />
                  </button>
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
          titulo="Eliminar pago"
          mensaje={`¿Eliminar el pago de $${Number(pagoAEliminar.monto).toFixed(2)} a ${nombreTarjeta(pagoAEliminar.tarjeta_id)}? Los gastos volverán a quedar pendientes.`}
          textoConfirmar="Sí, eliminar"
          onConfirmar={confirmarEliminar}
          onCancelar={() => setPagoAEliminar(null)}
        />
      )}
    </div>
  );
}