import { useEffect, useState } from "react";
import { Target, Plus, ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import { api } from "./api.js";
import PoteModal from "./PoteModal.jsx";
import MovimientoPoteModal from "./MovimientoPoteModal.jsx";
import ConfirmModal from "./ConfirmModal.jsx";
import VerMovimientosPoteModal from "./VerMovimientosPoteModal.jsx";

export default function PotesScreen() {
  const [potes, setPotes] = useState([]);
  const [cuentas, setCuentas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [modalAbierto, setModalAbierto] = useState(false);
  const [poteEditando, setPoteEditando] = useState(null);
  const [poteAEliminar, setPoteAEliminar] = useState(null);
  const [movimiento, setMovimiento] = useState(null); // {pote, tipo}
  const [verMovimientos, setVerMovimientos] = useState(null);

  async function cargar() {
    setCargando(true);
    try {
      const [p, c] = await Promise.all([
        api.getPotes(),
        api.getCuentas(),
      ]);
      setPotes(p || []);
      setCuentas(c || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  async function confirmarEliminar() {
    if (!poteAEliminar) return;
    try {
      await api.eliminarPote(poteAEliminar.id);
      setPoteAEliminar(null);
      await cargar();
    } catch (err) {
      setError(err.message);
      setPoteAEliminar(null);
    }
  }

  const totalAhorrado = potes.reduce((acc, p) => acc + Number(p.saldo || 0), 0);

  return (
    <div className="max-w-md mx-auto px-4 pb-28 pt-6">
      <header className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-carbon">Mis Pot</h1>
          <p className="text-sm text-gray-500">
            Ahorrado: ${totalAhorrado.toFixed(2)}
          </p>
        </div>
        <button
          onClick={() => {
            setPoteEditando(null);
            setModalAbierto(true);
          }}
          className="w-11 h-11 rounded-full bg-coral text-white flex items-center justify-center shadow-lg hover:bg-coral-dark transition-colors"
          title="Nuevo pote"
        >
          <Plus size={20} />
        </button>
      </header>

      {cargando ? (
        <p className="text-sm text-gray-400 text-center py-8">Cargando...</p>
      ) : potes.length === 0 ? (
        <div className="border-2 border-dashed border-gray-300 rounded-2xl p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-coral/10 text-coral flex items-center justify-center mx-auto mb-3">
            <Target size={22} />
          </div>
          <p className="text-sm text-gray-600 mb-1 font-medium">Sin potes todavía</p>
          <p className="text-xs text-gray-400 mb-4">
            Crea uno para empezar a ahorrar
          </p>
          <button
            onClick={() => {
              setPoteEditando(null);
              setModalAbierto(true);
            }}
            className="text-coral font-semibold text-sm"
            disabled={cuentas.length === 0}
          >
            + Crear mi primer pot
          </button>
          {cuentas.length === 0 && (
            <p className="text-xs text-amber-600 mt-2">
              Primero crea una cuenta
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {potes.map((p) => {
            const porcentaje = Math.min((Number(p.saldo) / Number(p.meta)) * 100, 100);
            const completado = Number(p.saldo) >= Number(p.meta);
            return (
              <div
                key={p.id}
                onClick={() => setVerMovimientos(p)}
                className="bg-white rounded-2xl p-4 shadow-sm flex flex-col relative cursor-pointer active:scale-[0.98] transition-transform"
              >
                <div className="flex items-start justify-between mb-2">
                  <span className="text-3xl">{p.emoji}</span>
                </div>

                <p className="font-semibold text-carbon text-sm mb-1 truncate">
                  {p.nombre}
                </p>
                <p className="text-xs text-gray-500 mb-3">
                  ${Number(p.saldo).toFixed(2)} / ${Number(p.meta).toFixed(2)}
                </p>

                <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-3">
                  <div
                    className={`h-full transition-all ${
                      completado ? "bg-emerald-500" : "bg-coral"
                    }`}
                    style={{ width: `${porcentaje}%` }}
                  />
                </div>

                <div className="flex gap-1.5 mt-auto">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setMovimiento({ pote: p, tipo: "deposito" });
                    }}
                    className="flex-1 py-2 rounded-lg bg-emerald-50 text-emerald-600 text-xs font-semibold flex items-center justify-center gap-1"
                  >
                    <ArrowDownCircle size={12} /> Meter
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setMovimiento({ pote: p, tipo: "retiro" });
                    }}
                    disabled={Number(p.saldo) <= 0}
                    className="flex-1 py-2 rounded-lg bg-coral/10 text-coral text-xs font-semibold flex items-center justify-center gap-1 disabled:opacity-40"
                  >
                    <ArrowUpCircle size={12} /> Sacar
                  </button>
                </div>
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

      {modalAbierto && (
        <PoteModal
          pote={poteEditando}
          cuentas={cuentas}
          onCerrar={() => {
            setModalAbierto(false);
            setPoteEditando(null);
          }}
          onGuardado={() => {
            setModalAbierto(false);
            setPoteEditando(null);
            cargar();
          }}
        />
      )}

      {movimiento && (
        <MovimientoPoteModal
          pote={movimiento.pote}
          tipo={movimiento.tipo}
          onCerrar={() => setMovimiento(null)}
          onGuardado={() => {
            setMovimiento(null);
            cargar();
          }}
        />
      )}

      {poteAEliminar && (
        <ConfirmModal
          titulo="Eliminar pote"
          mensaje={`¿Eliminar "${poteAEliminar.nombre}"? El saldo ($${Number(poteAEliminar.saldo).toFixed(2)}) volverá a la cuenta.`}
          textoConfirmar="Sí, eliminar"
          onConfirmar={confirmarEliminar}
          onCancelar={() => setPoteAEliminar(null)}
        />
      )}

      {verMovimientos && (
        <VerMovimientosPoteModal
          pote={verMovimientos}
          onCerrar={() => setVerMovimientos(null)}
          onMeter={() => {
            const p = verMovimientos;
            setVerMovimientos(null);
            setMovimiento({ pote: p, tipo: "deposito" });
          }}
          onSacar={() => {
            const p = verMovimientos;
            setVerMovimientos(null);
            setMovimiento({ pote: p, tipo: "retiro" });
          }}
          onEditar={() => {
            const p = verMovimientos;
            setVerMovimientos(null);
            setPoteEditando(p);
            setModalAbierto(true);
          }}
          onEliminar={() => {
            const p = verMovimientos;
            setVerMovimientos(null);
            setPoteAEliminar(p);
          }}
        />
      )}
    </div>
  );
}