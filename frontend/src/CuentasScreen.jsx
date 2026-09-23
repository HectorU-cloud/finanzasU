import { useEffect, useState } from "react";
import { Wallet, TrendingUp, Plus, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { api } from "./api.js";
import CuentaModal from "./CuentaModal.jsx";
import ConfirmModal from "./ConfirmModal.jsx";
import CuentaDetalleScreen from "./CuentaDetalleScreen.jsx";
import { SkeletonList } from "./Skeleton.jsx";
import EmptyState from "./EmptyState.jsx";

const TIPO_ICONOS = {
  efectivo: Wallet,
  ahorros: TrendingUp,
  corriente: Wallet,
  inversion: TrendingUp,
  otra: Wallet,
};

const COLORES_CUENTA = {
  efectivo: "from-emerald-500 to-emerald-700",
  ahorros: "from-violet-500 to-violet-700",
  corriente: "from-blue-500 to-blue-700",
  inversion: "from-amber-500 to-amber-700",
  otra: "from-gray-500 to-gray-700",
};

export default function CuentasScreen({ onCambiarVista }) {
  const [cuentas, setCuentas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [cuentaEditando, setCuentaEditando] = useState(null);
  const [cuentaAEliminar, setCuentaAEliminar] = useState(null);
  const [menuAbiertoId, setMenuAbiertoId] = useState(null);
  const [error, setError] = useState("");
  const [cuentaDetalle, setCuentaDetalle] = useState(null);

  async function cargar() {
    setCargando(true);
    try {
      const data = await api.getCuentas();
      setCuentas(data || []);
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
      if (!e.target.closest(".acciones-menu-cuenta")) {
        setMenuAbiertoId(null);
      }
    }
    document.addEventListener("click", cerrarSiEsFuera);
    return () => document.removeEventListener("click", cerrarSiEsFuera);
  }, []);

  const total = cuentas.reduce((acc, c) => acc + Number(c.saldo_inicial || 0), 0);

  async function confirmarEliminar() {
    if (!cuentaAEliminar) return;
    try {
      await api.eliminarCuenta(cuentaAEliminar.id);
      setCuentaAEliminar(null);
      await cargar();
    } catch (err) {
      setError(err.message);
      setCuentaAEliminar(null);
    }
  }

  // Si hay una cuenta seleccionada, muestra el detalle
  if (cuentaDetalle) {
    return (
      <CuentaDetalleScreen
        cuenta={cuentaDetalle}
        onVolver={() => setCuentaDetalle(null)}
      />
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 pb-28 pt-6">
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-carbon">Mis cuentas</h1>
          <p className="text-sm text-gray-500">Total: ${total.toFixed(2)}</p>
        </div>
        <button
          onClick={() => {
            setCuentaEditando(null);
            setModalAbierto(true);
          }}
          className="w-11 h-11 rounded-full bg-coral text-white flex items-center justify-center shadow-lg hover:bg-coral-dark transition-colors"
          title="Agregar cuenta"
        >
          <Plus size={20} />
        </button>
      </header>

      {cargando ? (
        <SkeletonList count={3} variant="card" />
            ) : cuentas.length === 0 ? (
        <EmptyState
          icon={Wallet}
          titulo="Sin cuentas todavía"
          mensaje="Crea tu primera cuenta para llevar el control de tu dinero."
          accion="+ Crear primera cuenta"
          onAccion={() => {
            setCuentaEditando(null);
            setModalAbierto(true);
          }}
          colorIcono="coral"
        />
      ) : (
        <div className="space-y-3">
          {cuentas.map((c) => {
            const Icono = TIPO_ICONOS[c.tipo] || Wallet;
            const gradiente = COLORES_CUENTA[c.tipo] || COLORES_CUENTA.otra;
            return (
              <div
                key={c.id}
                onClick={() => setCuentaDetalle(c)}
                className="bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3 cursor-pointer active:scale-[0.99] transition-transform"
              >
                <div
                  className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradiente} flex items-center justify-center text-white shrink-0`}
                >
                  <Icono size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-carbon text-sm truncate">
                    {c.nombre}
                  </p>
                  <p className="text-xs text-gray-500 capitalize">{c.tipo}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-carbon">
                    ${Number(c.saldo_actual ?? c.saldo_inicial).toFixed(2)}
                  </p>
                </div>
                <div className="relative acciones-menu-cuenta">
                  <button
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuAbiertoId(menuAbiertoId === c.id ? null : c.id);
                    }}
                  >
                    <MoreVertical size={16} />
                  </button>
                  {menuAbiertoId === c.id && (
                    <div className="absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg min-w-[140px] overflow-hidden z-10">
                      <button
                        className="flex items-center gap-2 w-full px-3 py-2.5 text-left text-sm text-carbon hover:bg-gray-50"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCuentaEditando(c);
                          setModalAbierto(true);
                          setMenuAbiertoId(null);
                        }}
                      >
                        <Pencil size={14} /> Editar
                      </button>
                      <button
                        className="flex items-center gap-2 w-full px-3 py-2.5 text-left text-sm text-red-600 hover:bg-red-50"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCuentaAEliminar(c);
                          setMenuAbiertoId(null);
                        }}
                      >
                        <Trash2 size={14} /> Eliminar
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {error && (
        <div className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-3 mt-4">
          <p>{error}</p>
          {onCambiarVista && error.includes("pagos de tarjeta") && (
            <button
              onClick={() => onCambiarVista("pagos")}
              className="mt-2 text-xs font-semibold text-coral underline"
            >
              Ir a Pagos →
            </button>
          )}
          {onCambiarVista && error.includes("ingresos registrados") && (
            <button
              onClick={() => onCambiarVista("ingresos")}
              className="mt-2 text-xs font-semibold text-coral underline"
            >
              Ir a Ingresos →
            </button>
          )}
        </div>
      )}

      {modalAbierto && (
        <CuentaModal
          cuenta={cuentaEditando}
          onCerrar={() => {
            setModalAbierto(false);
            setCuentaEditando(null);
          }}
          onGuardado={() => {
            setModalAbierto(false);
            setCuentaEditando(null);
            cargar();
          }}
        />
      )}

      {cuentaAEliminar && (
        <ConfirmModal
          titulo="Eliminar cuenta"
          mensaje={`¿Eliminar "${cuentaAEliminar.nombre}"? Esta acción no se puede deshacer.`}
          textoConfirmar="Sí, eliminar"
          onConfirmar={confirmarEliminar}
          onCancelar={() => setCuentaAEliminar(null)}
        />
      )}
    </div>
  );
}