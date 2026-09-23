import { useEffect, useState } from "react";
import { ArrowLeft, Plus, Calendar, Trash2, Pause, Play, MoreVertical, RefreshCw } from "lucide-react";
import { api } from "./api.js";
import ConfirmModal from "./ConfirmModal.jsx";
import RecurrenteModal from "./RecurrenteModal.jsx";

export default function RecurrentesScreen({ onVolver }) {
  const [recurrentes, setRecurrentes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState(null);
  const [aEliminar, setAEliminar] = useState(null);
  const [menuAbierto, setMenuAbierto] = useState(null);
  const [procesando, setProcesando] = useState(false);

  async function cargar() {
    setCargando(true);
    try {
      const d = await api.getRecurrentes();
      setRecurrentes(Array.isArray(d) ? d : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  useEffect(() => {
    function cerrarSiEsFuera(e) {
      if (!e.target.closest(".menu-recurrente")) setMenuAbierto(null);
    }
    document.addEventListener("click", cerrarSiEsFuera);
    return () => document.removeEventListener("click", cerrarSiEsFuera);
  }, []);

  async function toggleActiva(rec) {
    try {
      await api.actualizarRecurrente(rec.id, { activa: !rec.activa });
      await cargar();
    } catch (err) {
      setError(err.message);
    }
    setMenuAbierto(null);
  }

  async function confirmarEliminar() {
    if (!aEliminar) return;
    try {
      await api.eliminarRecurrente(aEliminar.id);
      setAEliminar(null);
      await cargar();
    } catch (err) {
      setError(err.message);
      setAEliminar(null);
    }
  }

  async function procesarAhora() {
    setProcesando(true);
    try {
      const res = await api.procesarRecurrentes();
      if (res.cantidad > 0) {
        setError("");
        alert(`✅ ${res.cantidad} transacción(es) procesada(s)`);
        await cargar();
      } else {
        alert("No había transacciones para procesar hoy.");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setProcesando(false);
    }
  }

  function tipoTexto(tipo) {
    if (tipo === "ingreso") return "Ingreso";
    if (tipo === "gasto_cuenta") return "Gasto";
    if (tipo === "gasto_tarjeta") return "Gasto tarjeta";
    return tipo;
  }

  return (
    <div className="max-w-md mx-auto px-4 pb-28 pt-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <button
            onClick={onVolver}
            className="w-9 h-9 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-500"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-carbon">Recurrentes</h1>
            <p className="text-sm text-gray-500">
              {recurrentes.length} configurada{recurrentes.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            setEditando(null);
            setModalAbierto(true);
          }}
          className="w-11 h-11 rounded-full bg-coral text-white flex items-center justify-center shadow-lg hover:bg-coral-dark transition-colors"
          title="Nueva recurrente"
        >
          <Plus size={20} />
        </button>
      </div>

      {cargando ? (
        <p className="text-sm text-gray-400 text-center py-8">Cargando...</p>
      ) : recurrentes.length === 0 ? (
        <div
          className="border-2 border-dashed rounded-2xl p-8 text-center"
          style={{ borderColor: "var(--border)" }}
        >
          <div className="w-16 h-16 rounded-full bg-coral/10 text-coral flex items-center justify-center mx-auto mb-4">
            <Calendar size={28} />
          </div>
          <p className="text-base font-semibold text-carbon mb-1">
            Sin recurrentes todavía
          </p>
          <p className="text-sm text-gray-500 mb-5">
            Configura tu sueldo, cuotas o suscripciones para que se registren automáticamente.
          </p>
          <button
            onClick={() => {
              setEditando(null);
              setModalAbierto(true);
            }}
            className="px-5 py-2.5 rounded-full bg-coral text-white font-semibold text-sm"
          >
            + Crear mi primera recurrente
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {recurrentes.map((rec) => (
            <div
              key={rec.id}
              className="rounded-2xl p-4 shadow-sm"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                opacity: rec.activa ? 1 : 0.6,
              }}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                        rec.tipo === "ingreso"
                          ? "bg-emerald-500/15 text-emerald-600"
                          : "bg-red-500/15 text-red-600"
                      }`}
                    >
                      {tipoTexto(rec.tipo)}
                    </span>
                    {!rec.activa && (
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-gray-500/15 text-gray-500">
                        Pausada
                      </span>
                    )}
                  </div>
                  <p className="font-semibold text-carbon text-sm truncate">
                    {rec.nombre}
                  </p>
                  <p className="text-xs text-gray-500">
                    ${Number(rec.monto_total).toFixed(2)} / {rec.frecuencia}
                  </p>
                </div>
                <div className="relative menu-recurrente">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuAbierto(menuAbierto === rec.id ? null : rec.id);
                    }}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100"
                  >
                    <MoreVertical size={16} />
                  </button>
                  {menuAbierto === rec.id && (
                    <div className="absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg min-w-[160px] overflow-hidden z-10">
                      <button
                        className="flex items-center gap-2 w-full px-3 py-2.5 text-left text-sm text-carbon hover:bg-gray-50"
                        onClick={() => toggleActiva(rec)}
                      >
                        {rec.activa ? (
                          <>
                            <Pause size={14} /> Pausar
                          </>
                        ) : (
                          <>
                            <Play size={14} /> Reanudar
                          </>
                        )}
                      </button>
                      <button
                        className="flex items-center gap-2 w-full px-3 py-2.5 text-left text-sm text-red-600 hover:bg-red-50"
                        onClick={() => {
                          setAEliminar(rec);
                          setMenuAbierto(null);
                        }}
                      >
                        <Trash2 size={14} /> Eliminar
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Pagos programados */}
              <div className="mt-3 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
                <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-2">
                  Pagos programados
                </p>
                <div className="space-y-1">
                  {rec.pagos.map((p) => {
                    const montoPago = (Number(rec.monto_total) * Number(p.porcentaje)) / 100;
                    return (
                      <div
                        key={p.id}
                        className="flex items-center justify-between text-xs"
                      >
                        <span className="text-gray-500">
                          {p.etiqueta || `Día ${p.dia_del_mes === 0 ? "último" : p.dia_del_mes}`}
                          {" · "}
                          {Number(p.porcentaje).toFixed(0)}%
                        </span>
                        <span className="font-semibold text-carbon">
                          ${montoPago.toFixed(2)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}

          {/* Botón "Procesar ahora" para pruebas */}
          <button
            onClick={procesarAhora}
            disabled={procesando}
            className="w-full py-3 rounded-2xl border flex items-center justify-center gap-2 text-xs font-semibold transition-colors disabled:opacity-50"
            style={{
              borderColor: "var(--border)",
              color: "var(--ink-soft)",
            }}
            title="Fuerza el procesamiento de las recurrentes de hoy"
          >
            <RefreshCw size={14} className={procesando ? "animate-spin" : ""} />
            {procesando ? "Procesando..." : "Procesar recurrentes de hoy"}
          </button>
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2 mt-4">
          {error}
        </p>
      )}

      {modalAbierto && (
        <RecurrenteModal
          recurrente={editando}
          onCerrar={() => {
            setModalAbierto(false);
            setEditando(null);
          }}
          onGuardado={() => {
            setModalAbierto(false);
            setEditando(null);
            cargar();
          }}
        />
      )}

      {aEliminar && (
        <ConfirmModal
          titulo="Eliminar recurrente"
          mensaje={`¿Eliminar "${aEliminar.nombre}"? Los pagos ya procesados no se borran, pero dejará de ejecutarse.`}
          textoConfirmar="Sí, eliminar"
          onConfirmar={confirmarEliminar}
          onCancelar={() => setAEliminar(null)}
        />
      )}
    </div>
  );
}