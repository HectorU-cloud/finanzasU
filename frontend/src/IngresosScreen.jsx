import { useEffect, useState } from "react";
import { TrendingUp, Plus, MoreVertical, Pencil, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { api } from "./api.js";
import IngresoModal from "./IngresoModal.jsx";
import ConfirmModal from "./ConfirmModal.jsx";

const NOMBRES_MES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

export default function IngresosScreen({ ocultarHeader = false }) {
  const hoy = new Date();
  const [periodo, setPeriodo] = useState({
    anio: hoy.getFullYear(),
    mes: hoy.getMonth() + 1,
  });
  const [ingresos, setIngresos] = useState([]);
  const [cuentas, setCuentas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [ingresoEditando, setIngresoEditando] = useState(null);
  const [ingresoAEliminar, setIngresoAEliminar] = useState(null);
  const [menuAbiertoId, setMenuAbiertoId] = useState(null);
  const [error, setError] = useState("");

  async function cargar() {
    setCargando(true);
    try {
      const [ing, cuentasData] = await Promise.all([
        api.getIngresos(periodo.anio, periodo.mes),
        api.getCuentas(),
      ]);
      setIngresos(ing || []);
      setCuentas(cuentasData || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargar();
  }, [periodo]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    function cerrarSiEsFuera(e) {
      if (!e.target.closest(".acciones-menu-ingreso")) {
        setMenuAbiertoId(null);
      }
    }
    document.addEventListener("click", cerrarSiEsFuera);
    return () => document.removeEventListener("click", cerrarSiEsFuera);
  }, []);

  const total = ingresos.reduce((acc, i) => acc + Number(i.monto || 0), 0);

  function cambiarMes(delta) {
    setPeriodo((p) => {
      let mes = p.mes + delta;
      let anio = p.anio;
      if (mes > 12) { mes = 1; anio += 1; }
      else if (mes < 1) { mes = 12; anio -= 1; }
      return { anio, mes };
    });
  }

  function nombreCuenta(id) {
    return cuentas.find((c) => c.id === id)?.nombre || "—";
  }

  async function confirmarEliminar() {
    if (!ingresoAEliminar) return;
    try {
      await api.eliminarIngreso(ingresoAEliminar.id);
      setIngresoAEliminar(null);
      await cargar();
    } catch (err) {
      setError(err.message);
      setIngresoAEliminar(null);
    }
  }

  return (
    <div className={ocultarHeader ? "" : "max-w-md mx-auto px-4 pb-28 pt-6"}>
      {!ocultarHeader && (
        <header className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-carbon">Ingresos</h1>
          <p className="text-sm text-gray-500 capitalize">
            {NOMBRES_MES[periodo.mes - 1]} {periodo.anio}
          </p>
        </div>
        <button
          onClick={() => {
            setIngresoEditando(null);
            setModalAbierto(true);
          }}
          className="w-11 h-11 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-lg hover:bg-emerald-700 transition-colors"
          title="Agregar ingreso"
        >
          <Plus size={20} />
        </button>
      </header>
      )}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => cambiarMes(-1)}
          className="w-9 h-9 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50"
        >
          <ChevronLeft size={16} />
        </button>
        <div className="text-center">
          <p className="text-xs text-gray-500">Total del mes</p>
          <p className="text-2xl font-bold text-emerald-600">
            +${total.toFixed(2)}
          </p>
        </div>
        <button
          onClick={() => cambiarMes(1)}
          className="w-9 h-9 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {cargando ? (
        <p className="text-sm text-gray-400 text-center py-8">Cargando...</p>
      ) : ingresos.length === 0 ? (
        <div className="border-2 border-dashed border-gray-300 rounded-2xl p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3">
            <TrendingUp size={22} />
          </div>
          <p className="text-sm text-gray-600 mb-1 font-medium">Sin ingresos este mes</p>
          <p className="text-xs text-gray-400 mb-4">Registra tu primer ingreso</p>
          <button
            onClick={() => {
              setIngresoEditando(null);
              setModalAbierto(true);
            }}
            className="text-emerald-600 font-semibold text-sm"
            disabled={cuentas.length === 0}
          >
            + Registrar ingreso
          </button>
          {cuentas.length === 0 && (
            <p className="text-xs text-amber-600 mt-2">
              Primero crea una cuenta en la sección Cuentas
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {ingresos.map((i) => (
            <div
              key={i.id}
              className="bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3"
            >
              <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <TrendingUp size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-carbon text-sm truncate">
                  {i.descripcion || i.categoria || "Ingreso"}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {i.fecha} · {nombreCuenta(i.cuenta_id)}
                  {i.categoria && ` · ${i.categoria}`}
                </p>
              </div>
              <p className="font-bold text-emerald-600">
                +${Number(i.monto).toFixed(2)}
              </p>
              <div className="relative acciones-menu-ingreso">
                <button
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuAbiertoId(menuAbiertoId === i.id ? null : i.id);
                  }}
                >
                  <MoreVertical size={16} />
                </button>
                {menuAbiertoId === i.id && (
                  <div className="absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg min-w-[140px] overflow-hidden z-10">
                    <button
                      className="flex items-center gap-2 w-full px-3 py-2.5 text-left text-sm text-carbon hover:bg-gray-50"
                      onClick={() => {
                        setIngresoEditando(i);
                        setModalAbierto(true);
                        setMenuAbiertoId(null);
                      }}
                    >
                      <Pencil size={14} /> Editar
                    </button>
                    <button
                      className="flex items-center gap-2 w-full px-3 py-2.5 text-left text-sm text-red-600 hover:bg-red-50"
                      onClick={() => {
                        setIngresoAEliminar(i);
                        setMenuAbiertoId(null);
                      }}
                    >
                      <Trash2 size={14} /> Eliminar
                    </button>
                  </div>
                )}
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

      {modalAbierto && (
        <IngresoModal
          ingreso={ingresoEditando}
          cuentas={cuentas}
          onCerrar={() => {
            setModalAbierto(false);
            setIngresoEditando(null);
          }}
          onGuardado={() => {
            setModalAbierto(false);
            setIngresoEditando(null);
            cargar();
          }}
        />
      )}

      {ingresoAEliminar && (
        <ConfirmModal
          titulo="Eliminar ingreso"
          mensaje={`¿Eliminar el ingreso de $${Number(ingresoAEliminar.monto).toFixed(2)}? Esta acción no se puede deshacer.`}
          textoConfirmar="Sí, eliminar"
          onConfirmar={confirmarEliminar}
          onCancelar={() => setIngresoAEliminar(null)}
        />
      )}
    </div>
  );
}