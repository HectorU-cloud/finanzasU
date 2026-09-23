import { useEffect, useState } from "react";
import { ArrowLeft, HandCoins, Pencil, Plus, Trash2, Download } from "lucide-react";
import { descargarArchivo } from "./utils/descargas.js";
import { api } from "./api.js";
import DeudaModal from "./DeudaModal.jsx";
import AbonarDeudaModal from "./AbonarDeudaModal.jsx";
import ConfirmModal from "./ConfirmModal.jsx";
import { SkeletonList } from "./Skeleton.jsx";
import EmptyState from "./EmptyState.jsx";

export default function DeudasScreen({ onVolver }) {
  const [tab, setTab] = useState("debo"); // "debo" | "me_deben" | "saldadas"
  const [deudas, setDeudas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [modalAbierto, setModalAbierto] = useState(false);
  const [deudaEditando, setDeudaEditando] = useState(null);
  const [deudaAAbonar, setDeudaAAbonar] = useState(null);
  const [deudaAEliminar, setDeudaAEliminar] = useState(null);
  const [exportando, setExportando] = useState(false);

  async function cargar() {
    setCargando(true);
    try {
      const d = await api.getDeudas(true); // trae activas + saldadas, filtramos en el cliente
      setDeudas(d || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  async function exportar() {
    setExportando(true);
    await descargarArchivo(api.exportarDeudas());
    setExportando(false);
  }

  useEffect(() => {
    cargar();
  }, []);

  async function confirmarEliminar() {
    if (!deudaAEliminar) return;
    try {
      await api.eliminarDeuda(deudaAEliminar.id);
      setDeudaAEliminar(null);
      await cargar();
    } catch (err) {
      setError(err.message);
      setDeudaAEliminar(null);
    }
  }

  const visibles = deudas.filter((d) =>
    tab === "saldadas" ? d.pagada : !d.pagada && d.tipo === tab
  );

  const totalDebo = deudas
    .filter((d) => !d.pagada && d.tipo === "debo")
    .reduce((acc, d) => acc + Number(d.saldo_pendiente), 0);
  const totalMeDeben = deudas
    .filter((d) => !d.pagada && d.tipo === "me_deben")
    .reduce((acc, d) => acc + Number(d.saldo_pendiente), 0);

  return (
    <div className="max-w-md mx-auto px-4 pb-28 pt-6">
      <header className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          {onVolver && (
            <button
              onClick={() => onVolver()}
              className="w-9 h-9 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-500"
            >
              <ArrowLeft size={18} />
            </button>
          )}
          <div>
            <h1 className="text-2xl font-bold text-carbon">Deudas</h1>
            <p className="text-sm text-gray-500">
              Debes ${totalDebo.toFixed(2)} · Te deben ${totalMeDeben.toFixed(2)}
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            setDeudaEditando(null);
            setModalAbierto(true);
          }}
          className="w-11 h-11 rounded-full bg-coral text-white flex items-center justify-center shadow-lg hover:bg-coral-dark transition-colors"
          title="Nueva deuda"
        >
          <Plus size={20} />
        </button>
      </header>

      <button
        onClick={exportar}
        disabled={exportando}
        className="w-full mb-4 py-2.5 rounded-xl border border-coral/30 bg-coral/5 text-coral font-semibold text-xs flex items-center justify-center gap-2 hover:bg-coral/10 transition-colors disabled:opacity-50"
      >
        <Download size={14} />
        {exportando ? "Generando CSV..." : "Descargar todas mis deudas"}
      </button>

      <div className="flex bg-gray-100 p-1 rounded-2xl mb-5">
        <button
          onClick={() => setTab("debo")}
          className={`flex-1 py-2 text-sm font-semibold rounded-xl transition-all ${
            tab === "debo" ? "bg-white text-coral shadow-sm" : "text-gray-500"
          }`}
        >
          Yo debo
        </button>
        <button
          onClick={() => setTab("me_deben")}
          className={`flex-1 py-2 text-sm font-semibold rounded-xl transition-all ${
            tab === "me_deben" ? "bg-white text-emerald-600 shadow-sm" : "text-gray-500"
          }`}
        >
          Me deben
        </button>
        <button
          onClick={() => setTab("saldadas")}
          className={`flex-1 py-2 text-sm font-semibold rounded-xl transition-all ${
            tab === "saldadas" ? "bg-white text-carbon shadow-sm" : "text-gray-500"
          }`}
        >
          Saldadas
        </button>
      </div>

      {cargando ? (
        <SkeletonList count={3} variant="card" />
      ) : visibles.length === 0 ? (
        <EmptyState
          icon={HandCoins}
          titulo={tab === "saldadas" ? "Nada saldado todavía" : "Nada por aquí"}
          mensaje={
            tab === "saldadas"
              ? "Cuando saldes una deuda aparecerá aquí."
              : "Registra deudas para llevar el control de quién te debe y a quién le debes."
          }
          accion={tab !== "saldadas" ? "+ Agregar deuda" : null}
          onAccion={tab !== "saldadas" ? () => {
            setDeudaEditando(null);
            setModalAbierto(true);
          } : null}
          colorIcono="ambar"
        />
      ) : (
        <div className="space-y-3">
          {visibles.map((d) => {
            const porcentaje = d.pagada
              ? 100
              : Math.min(
                  ((Number(d.monto_original) - Number(d.saldo_pendiente)) /
                    Number(d.monto_original)) *
                    100,
                  100
                );
            return (
              <div key={d.id} className="bg-white rounded-2xl p-4 shadow-sm">
                <div className="flex items-start justify-between mb-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-carbon text-sm truncate">{d.persona}</p>
                    {d.descripcion && (
                      <p className="text-xs text-gray-400 truncate">{d.descripcion}</p>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => {
                        setDeudaEditando(d);
                        setModalAbierto(true);
                      }}
                      className="w-7 h-7 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => setDeudaAEliminar(d)}
                      className="w-7 h-7 rounded-full hover:bg-red-50 flex items-center justify-center text-gray-400 hover:text-red-600"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                <p className="text-xs text-gray-500 mb-2">
                  {d.pagada ? (
                    <>Saldada — ${Number(d.monto_original).toFixed(2)} en total</>
                  ) : (
                    <>
                      ${Number(d.saldo_pendiente).toFixed(2)} pendiente de $
                      {Number(d.monto_original).toFixed(2)}
                    </>
                  )}
                </p>

                <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-3">
                  <div
                    className={`h-full transition-all ${
                      d.pagada
                        ? "bg-emerald-500"
                        : d.tipo === "debo"
                        ? "bg-coral"
                        : "bg-emerald-500"
                    }`}
                    style={{ width: `${porcentaje}%` }}
                  />
                </div>

                {!d.pagada && (
                  <button
                    onClick={() => setDeudaAAbonar(d)}
                    className="w-full py-2 rounded-lg bg-coral/10 text-coral text-xs font-semibold flex items-center justify-center gap-1"
                  >
                    <HandCoins size={13} />
                    {d.tipo === "debo" ? "Abonar" : "Registrar pago recibido"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2 mt-4">{error}</p>
      )}

      {modalAbierto && (
        <DeudaModal
          deuda={deudaEditando}
          onCerrar={() => {
            setModalAbierto(false);
            setDeudaEditando(null);
          }}
          onGuardado={() => {
            setModalAbierto(false);
            setDeudaEditando(null);
            cargar();
          }}
        />
      )}

      {deudaAAbonar && (
        <AbonarDeudaModal
          deuda={deudaAAbonar}
          onCerrar={() => setDeudaAAbonar(null)}
          onGuardado={() => {
            setDeudaAAbonar(null);
            cargar();
          }}
        />
      )}

      {deudaAEliminar && (
        <ConfirmModal
          titulo="Eliminar deuda"
          mensaje={`¿Eliminar el registro de "${deudaAEliminar.persona}"? Esto no se puede deshacer.`}
          textoConfirmar="Sí, eliminar"
          onConfirmar={confirmarEliminar}
          onCancelar={() => setDeudaAEliminar(null)}
        />
      )}
    </div>
  );
}
