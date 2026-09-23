import { useEffect, useState, useCallback } from "react";
import { ArrowLeft, Plus, ChevronLeft, ChevronRight, CreditCard, MoreVertical, Pencil, Trash2, CheckCircle2, X, Download } from "lucide-react";
import { descargarArchivo } from "./utils/descargas.js";
import { api } from "./api.js";
import CardNetworkLogo from "./CardNetworkLogo.jsx";
import EditarGastoModal from "./EditarGastoModal.jsx";
import ConfirmModal from "./ConfirmModal.jsx";
import PagarTarjetaModal from "./PagarTarjetaModal.jsx";
import { calcularVencimiento } from "./utils/fechas.js";
import { useToast } from "./ToastContext.jsx";
import { SkeletonList } from "./Skeleton.jsx";
import EmptyState from "./EmptyState.jsx";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

const NOMBRES_MES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

const ULTIMA_CATEGORIA_KEY = "finanzas_ultima_categoria";

function leerUltima(key, fallback = "") {
  try { return localStorage.getItem(key) || fallback; } catch { return fallback; }
}
function guardarUltima(key, valor) {
  try { if (valor) localStorage.setItem(key, valor); } catch {}
}

const GRADIENTES = {
  "amex-verde":       "linear-gradient(135deg, #0d5f4f 0%, #1a8a73 100%)",
  "visa-gold":        "linear-gradient(135deg, #8c6b1f 0%, #d4ad4a 100%)",
  "mastercard-azul":  "linear-gradient(135deg, #0f2a5c 0%, #1e4a8a 100%)",
  "diners-marron":    "linear-gradient(135deg, #4a2a1a 0%, #7a4a2a 100%)",
  "negro-premium":    "linear-gradient(135deg, #000 0%, #2a2a2a 100%)",
  "morado-moderno":   "linear-gradient(135deg, #4a1d7a 0%, #7c3aed 100%)",
  "clasico":          "linear-gradient(135deg, #1a1523 0%, #2d2438 100%)",
};

export default function TarjetaDetalleScreen({ tarjeta, onVolver, onCambio }) {
  const hoy = new Date();
  const [periodo, setPeriodo] = useState({ anio: hoy.getFullYear(), mes: hoy.getMonth() + 1 });
  const [gastos, setGastos] = useState([]);
  const [estado, setEstado] = useState(null);
  const [categorias, setCategorias] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [exito, setExito] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [menuAbiertoId, setMenuAbiertoId] = useState(null);
  const [gastoEditando, setGastoEditando] = useState(null);
  const [gastoAEliminar, setGastoAEliminar] = useState(null);
  const [pagarAbierto, setPagarAbierto] = useState(false);
  const [formAbierto, setFormAbierto] = useState(false);
  const [form, setForm] = useState({
    fecha: todayISO(),
    monto: "",
    descripcion: "",
    categoria: leerUltima(ULTIMA_CATEGORIA_KEY),
  });
  const [exportando, setExportando] = useState(false);
  const { showToast } = useToast();

  const esDebito = tarjeta.tipo === "debito";


  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const promesas = [
        api.getGastos(periodo.anio, periodo.mes, null, tarjeta.id),
        categorias.length > 0 ? Promise.resolve({ categorias }) : api.getCategorias(),
      ];
      // Solo pedir estado de pago si es crédito
      if (!esDebito) {
        promesas.push(api.getEstadoPagoTarjeta(tarjeta.id, periodo.anio, periodo.mes));
      }

      const resultados = await Promise.all(promesas);
      setGastos(resultados[0] || []);
      if (categorias.length === 0 && resultados[1]?.categorias) {
        setCategorias(resultados[1].categorias);
      }
      if (!esDebito) {
        setEstado(resultados[2]);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }, [periodo, tarjeta.id, esDebito]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    cargar();
  }, [cargar]);

  useEffect(() => {
    function cerrarSiEsFuera(e) {
      if (!e.target.closest(".acciones-menu-detalle")) setMenuAbiertoId(null);
    }
    document.addEventListener("click", cerrarSiEsFuera);
    return () => document.removeEventListener("click", cerrarSiEsFuera);
  }, []);

  function cambiarMes(delta) {
    setPeriodo((p) => {
      let mes = p.mes + delta;
      let anio = p.anio;
      if (mes > 12) { mes = 1; anio += 1; }
      else if (mes < 1) { mes = 12; anio -= 1; }
      return { anio, mes };
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (enviando) return;
    const montoNum = Number(form.monto);
    if (!form.fecha || !form.monto || isNaN(montoNum) || montoNum <= 0) {
      setError("Completa fecha y un monto válido.");
      return;
    }
    if (form.fecha > todayISO()) {
      setError("La fecha no puede ser futura.");
      return;
    }
    setError("");
    setEnviando(true);
    try {
      await api.crearGasto({
        tarjeta_id: tarjeta.id,
        fecha: form.fecha,
        monto: montoNum,
        descripcion: form.descripcion || null,
        categoria: form.categoria || null,
      });
      guardarUltima(ULTIMA_CATEGORIA_KEY, form.categoria);
      setForm((f) => ({ ...f, monto: "", descripcion: "" }));
      setFormAbierto(false);
      await cargar();
      showToast("Gasto agregado ✓");
      onCambio?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  async function exportar() {
    const ultimoDia = new Date(periodo.anio, periodo.mes, 0).getDate();
    const desde = `${periodo.anio}-${String(periodo.mes).padStart(2, "0")}-01`;
    const hasta = `${periodo.anio}-${String(periodo.mes).padStart(2, "0")}-${ultimoDia}`;
    setExportando(true);
    await descargarArchivo(api.exportarTarjeta(tarjeta.id, desde, hasta));
    setExportando(false);
  }

  async function handleDelete(id) {
    try {
      await api.eliminarGasto(id);
      await cargar();
      onCambio?.();
    } catch (err) {
      setError(err.message);
    }
  }

  const gradiente = GRADIENTES[tarjeta.tema || "clasico"];
  const totalMes = gastos.reduce((acc, g) => acc + Number(g.monto || 0), 0);

  // Solo calcular vencimiento si es crédito (débito no tiene corte/pago)
  const vencimiento = !esDebito
    ? calcularVencimiento(tarjeta.dia_corte, tarjeta.dia_pago || 15)
    : { fechaLimite: null, diasRestantes: 0, urgente: false };
  const { fechaLimite, diasRestantes, urgente } = vencimiento;

  return (
    <div className="fixed inset-0 z-40 bg-cream overflow-y-auto">
      <div className="max-w-md mx-auto px-4 pb-28 pt-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={onVolver}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-carbon"
          >
            <ArrowLeft size={16} /> Volver
          </button>
        </div>

        {/* Card de tarjeta */}
        <div
          className="rounded-3xl p-5 text-white shadow-xl mb-5"
          style={{ background: gradiente }}
        >
          <div className="flex justify-between items-start mb-3">
            <div>
              <p className="text-xs opacity-75 mb-1">
                {esDebito ? "Gastado este mes" : "Gastado este ciclo"}
              </p>
              <p className="text-3xl font-bold">${totalMes.toFixed(2)}</p>
            </div>
            {tarjeta.red && (
              <CardNetworkLogo red={tarjeta.red} size={32} color="#ffffff" />
            )}
          </div>
          <div className="flex justify-between items-end text-xs opacity-90">
            <span className="font-medium">{tarjeta.nombre}</span>
            <span>
              {esDebito ? "Tarjeta de débito" : `Corte día ${tarjeta.dia_corte}`}
            </span>
          </div>
        </div>

        {/* Estado de pago (solo crédito) */}
        {!esDebito && estado && estado.total_gastos > 0 && (
          <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-carbon">
                Estado de pago
              </p>
              {estado.cerrado && (
                <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                  <CheckCircle2 size={12} /> Pagado
                </span>
              )}
            </div>

            <div className="flex justify-between text-xs mb-3">
              <div>
                <p className="text-gray-400">Pagado</p>
                <p className="font-semibold text-emerald-600">
                  ${Number(estado.total_pagado).toFixed(2)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-gray-400">Pendiente</p>
                <p className="font-semibold text-coral">
                  ${Number(estado.pendiente).toFixed(2)}
                </p>
              </div>
            </div>

            {/* Fecha límite de pago */}
            {estado.pendiente > 0 && (
              <div
                className={`rounded-xl px-3 py-2 mb-3 flex items-center justify-between text-xs font-medium ${
                  urgente
                    ? "bg-red-50 text-red-600 border border-red-200"
                    : "bg-blue-50 text-blue-600 border border-blue-200"
                }`}
              >
                <span>
                  {diasRestantes < 0
                    ? `Venció hace ${Math.abs(diasRestantes)} día${Math.abs(diasRestantes) !== 1 ? "s" : ""}`
                    : diasRestantes === 0
                    ? "Vence hoy"
                    : `Pagar hasta el ${fechaLimite.toLocaleDateString("es-ES", {
                        day: "numeric",
                        month: "long",
                      })}`}
                </span>
                <span className="font-bold">
                  {diasRestantes >= 0 && `${diasRestantes}d`}
                </span>
              </div>
            )}

            <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-3">
              <div
                className="h-full bg-emerald-500 transition-all"
                style={{ width: `${Math.min(estado.porcentaje_pagado, 100)}%` }}
              />
            </div>

            {!estado.cerrado && (
              <button
                onClick={() => setPagarAbierto(true)}
                className="w-full bg-coral text-white font-semibold py-2.5 rounded-xl hover:bg-coral-dark transition-colors text-sm"
              >
                Pagar esta tarjeta
              </button>
            )}
          </div>
        )}

        {/* Navegación mes */}
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => cambiarMes(-1)}
            className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50"
          >
            <ChevronLeft size={14} />
          </button>
          <p className="text-sm font-medium text-carbon capitalize">
            {NOMBRES_MES[periodo.mes - 1]} {periodo.anio}
          </p>
          <button
            onClick={() => cambiarMes(1)}
            className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50"
          >
            <ChevronRight size={14} />
          </button>
        </div>

        <button
        onClick={exportar}
        disabled={exportando}
        className="w-full mb-4 py-2.5 rounded-xl border border-coral/30 bg-coral/5 text-coral font-semibold text-xs flex items-center justify-center gap-2 hover:bg-coral/10 transition-colors disabled:opacity-50"
      >
        <Download size={14} />
        {exportando
          ? "Generando CSV..."
          : `Descargar CSV de ${NOMBRES_MES[periodo.mes - 1]}`}
      </button>

        {/* Botón agregar gasto */}
        <button
        onClick={() => setFormAbierto((v) => !v)}
        className={`w-full font-semibold py-3 rounded-2xl transition-colors flex items-center justify-center gap-2 mb-4 ${
          formAbierto
            ? "bg-gray-200 text-carbon hover:bg-gray-300"
            : "bg-coral text-white hover:bg-coral-dark"
        }`}
      >
          {formAbierto ? <X size={16} /> : <Plus size={16} />}
          {formAbierto ? "Cancelar" : "Agregar gasto a esta tarjeta"}
        </button>

        {/* Formulario */}
        {formAbierto && (
          <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Fecha</label>
                  <input
                    type="date"
                    value={form.fecha}
                    max={todayISO()}
                    min="2000-01-01"
                    onChange={(e) => setForm({ ...form, fecha: e.target.value })}
                    className="w-full px-2.5 py-2 rounded-xl border border-gray-200 focus:border-coral focus:outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Monto</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={form.monto}
                    onChange={(e) => setForm({ ...form, monto: e.target.value })}
                    className="w-full px-2.5 py-2 rounded-xl border border-gray-200 focus:border-coral focus:outline-none text-sm"
                    autoFocus
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Categoría</label>
                <select
                  value={form.categoria}
                  onChange={(e) => setForm({ ...form, categoria: e.target.value })}
                  className="w-full px-2.5 py-2 rounded-xl border border-gray-200 focus:border-coral focus:outline-none text-sm bg-white"
                >
                  <option value="">Sin categoría</option>
                  {categorias.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Descripción (opcional)</label>
                <input
                  type="text"
                  placeholder="ej. almuerzo"
                  value={form.descripcion}
                  onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                  className="w-full px-2.5 py-2 rounded-xl border border-gray-200 focus:border-coral focus:outline-none text-sm"
                />
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</p>
              )}


              <button
                type="submit"
                disabled={enviando}
                className="w-full bg-coral text-white font-semibold py-2.5 rounded-xl hover:bg-coral-dark transition-colors disabled:opacity-60"
              >
                {enviando ? "Agregando..." : "Agregar gasto"}
              </button>
            </form>
          </div>
        )}

        {/* Lista de gastos */}
        <p className="text-sm font-semibold text-carbon mb-2">
          Gastos del mes ({gastos.length})
        </p>

        {cargando ? (
        <SkeletonList count={4} variant="card" />
        ) : gastos.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          titulo={`Sin gastos en ${NOMBRES_MES[periodo.mes - 1]}`}
          mensaje="Registra tu primer gasto para verlo aquí."
          accion="+ Agregar gasto"
          onAccion={() => setFormAbierto(true)}
          colorIcono="coral"
        />
      ) : (
          <div className="space-y-2">
            {gastos.map((g) => (
              <div
                key={g.id}
                className="bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-carbon text-sm truncate">
                    {g.descripcion || "Sin descripción"}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {g.fecha}
                    {g.categoria && ` · ${g.categoria}`}
                  </p>
                </div>
                <p className="font-bold text-carbon">
                  ${Number(g.monto).toFixed(2)}
                </p>
                <div className="relative acciones-menu-detalle">
                  <button
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuAbiertoId(menuAbiertoId === g.id ? null : g.id);
                    }}
                  >
                    <MoreVertical size={16} />
                  </button>
                  {menuAbiertoId === g.id && (
                    <div className="absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg min-w-[140px] overflow-hidden z-10">
                      <button
                        className="flex items-center gap-2 w-full px-3 py-2.5 text-left text-sm text-carbon hover:bg-gray-50"
                        onClick={() => {
                          setGastoEditando(g);
                          setMenuAbiertoId(null);
                        }}
                      >
                        <Pencil size={14} /> Editar
                      </button>
                      <button
                        className="flex items-center gap-2 w-full px-3 py-2.5 text-left text-sm text-red-600 hover:bg-red-50"
                        onClick={() => {
                          setGastoAEliminar(g);
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

        {/* Modales */}
        {gastoEditando && (
          <EditarGastoModal
            gasto={gastoEditando}
            tarjetas={[{ id: tarjeta.id, nombre: tarjeta.nombre }]}
            categorias={categorias}
            onCerrar={() => setGastoEditando(null)}
            onGuardado={() => {
              setGastoEditando(null);
              cargar();
              onCambio?.();
            }}
          />
        )}

        {gastoAEliminar && (
          <ConfirmModal
            titulo="Eliminar gasto"
            mensaje={`¿Eliminar el gasto de $${Number(gastoAEliminar.monto).toFixed(2)}? Esta acción no se puede deshacer.`}
            textoConfirmar="Sí, eliminar"
            onConfirmar={async () => {
              await handleDelete(gastoAEliminar.id);
              setGastoAEliminar(null);
            }}
            onCancelar={() => setGastoAEliminar(null)}
          />
        )}

        {pagarAbierto && !esDebito && (
          <PagarTarjetaModal
            tarjeta={tarjeta}
            onCerrar={() => setPagarAbierto(false)}
            onPagado={() => {
              setPagarAbierto(false);
              cargar();
              onCambio?.();
            }}
          />
        )}
      </div>
    </div>
  );
}