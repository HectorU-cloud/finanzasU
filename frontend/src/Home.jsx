import { useEffect, useState } from "react";
import { Plus, TrendingUp, TrendingDown, Wallet, Eye, EyeOff, ArrowRightLeft, PiggyBank, CreditCard, StickyNote, Trash2, HandCoins, Palette, PieChart, Calendar, Target, Sparkles, AlertCircle, User, LogOut, Menu } from "lucide-react";
import { api } from "./api.js";
import AlertasBanner from "./AlertasBanner.jsx";
import TarjetasScreen from "./TarjetasScreen.jsx";
import { calcularVencimiento } from "./utils/fechas.js";
import { SkeletonLine, SkeletonList } from "./Skeleton.jsx";
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

const COLORES_NOTA = {
  rosa:     { header: "from-pink-600 to-rose-600",    bg: "bg-rose-50",    border: "border-rose-200" },
  amarillo: { header: "from-yellow-500 to-amber-500", bg: "bg-amber-50",   border: "border-amber-200" },
  verde:    { header: "from-emerald-500 to-teal-600", bg: "bg-emerald-50", border: "border-emerald-200" },
  azul:     { header: "from-blue-500 to-indigo-600",  bg: "bg-blue-50",    border: "border-blue-200" },
  morado:   { header: "from-purple-500 to-violet-600",bg: "bg-purple-50",  border: "border-purple-200" },
};

const INSIGHT_ICONOS = {
  "trending-up": TrendingUp,
  "trending-down": TrendingDown,
  "pie-chart": PieChart,
  "calendar": Calendar,
  "target": Target,
  "sparkles": Sparkles,
  "hand-coins": HandCoins,
  "wallet": Wallet,
};

const INSIGHT_COLORES = {
  rojo: {
    bg: "bg-red-50",
    border: "border-red-200",
    text: "text-red-700",
    icon: "text-red-500",
    iconBg: "bg-red-100",
  },
  verde: {
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    text: "text-emerald-700",
    icon: "text-emerald-500",
    iconBg: "bg-emerald-100",
  },
  azul: {
    bg: "bg-blue-50",
    border: "border-blue-200",
    text: "text-blue-700",
    icon: "text-blue-500",
    iconBg: "bg-blue-100",
  },
  amarillo: {
    bg: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-700",
    icon: "text-amber-500",
    iconBg: "bg-amber-100",
  },
  morado: {
    bg: "bg-purple-50",
    border: "border-purple-200",
    text: "text-purple-700",
    icon: "text-purple-500",
    iconBg: "bg-purple-100",
  },
};

function formatearFecha() {
  const hoy = new Date();
  const opciones = { weekday: 'long', day: 'numeric' };
  const texto = hoy.toLocaleDateString('es-ES', opciones);
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function InsightCard({ insight }) {
  const Icono = INSIGHT_ICONOS[insight.icono] || Sparkles;
  const colores = INSIGHT_COLORES[insight.color] || INSIGHT_COLORES.azul;

  return (
    <div
      className={`rounded-2xl border p-4 flex items-start gap-3 ${colores.bg} ${colores.border}`}
    >
      <div
        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${colores.iconBg}`}
      >
        <Icono size={18} className={colores.icon} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold mb-1 ${colores.text}`}>
          {insight.titulo}
        </p>
        <p className="text-xs text-gray-600">{insight.mensaje}</p>
      </div>
    </div>
  );
}

export default function Home({ 
  usuario, 
  resumen, 
  tarjetas, 
  onIrACuentas, 
  onPagarTarjeta, 
  onVerTarjeta, 
  onVerTodasTarjetas, 
  onAgregarTarjeta,
  onIrAPotes,
  onIrAMovimientos,
  onVerCuenta,
  onIrADeudas,
  onIrAReportes,
  onIrARecurrentes,   // <-- NUEVA
  onIrAPerfil,        // <-- NUEVA
  onCerrarSesion,     // <-- NUEVA
}) {
  const [cuentas, setCuentas] = useState([]);
  const [cargandoCuentas, setCargandoCuentas] = useState(true);
  const [tabActiva, setTabActiva] = useState("destacado");
  const [saldoVisible, setSaldoVisible] = useState(true);

  const [notas, setNotas] = useState([]);
  const [cargandoNotas, setCargandoNotas] = useState(true);
  const [deudas, setDeudas] = useState([]);
  const [cargandoDeudas, setCargandoDeudas] = useState(true);
  const [insights, setInsights] = useState([]);
  const [cargandoInsights, setCargandoInsights] = useState(true);
  const [menuUsuarioAbierto, setMenuUsuarioAbierto] = useState(false);


  useEffect(() => {
    function cerrarSiEsFuera(e) {
      if (!e.target.closest(".menu-usuario")) {
        setMenuUsuarioAbierto(false);
      }
    }
    document.addEventListener("click", cerrarSiEsFuera);
    return () => document.removeEventListener("click", cerrarSiEsFuera);
  }, []);

  useEffect(() => {
    api.getCuentas()
      .then((d) => setCuentas(Array.isArray(d) ? d : []))
      .catch(() => setCuentas([]))
      .finally(() => setCargandoCuentas(false));
  }, []);

  useEffect(() => {
    api.getDeudas()
      .then((d) => setDeudas(Array.isArray(d) ? d : []))
      .catch(() => setDeudas([]))
      .finally(() => setCargandoDeudas(false));
  }, []);

  useEffect(() => {
    api.getInsights()
      .then((d) => {
        const lista = Array.isArray(d?.insights) ? d.insights : [];
        setInsights(lista);
      })
      .catch(() => setInsights([]))
      .finally(() => setCargandoInsights(false));
  }, []);

  useEffect(() => {
    api.getNotas()
      .then((d) => setNotas(Array.isArray(d) ? d : []))
      .catch(() => setNotas([]))
      .finally(() => setCargandoNotas(false));
  }, []);

  async function crearNota(color = "rosa") {
    try {
      const nueva = await api.crearNota("", color);
      setNotas((prev) => [nueva, ...prev]);
    } catch (err) {
      console.error(err);
    }
  }

  async function actualizarNota(id, contenido, color = null) {
    try {
      const actualizada = await api.actualizarNota(id, contenido, color);
      setNotas((prev) => prev.map((n) => (n.id === id ? actualizada : n)));
    } catch (err) {
      console.error(err);
    }
  }

  async function eliminarNota(id) {
    try {
      await api.eliminarNota(id);
      setNotas((prev) => prev.filter((n) => n.id !== id));
    } catch (err) {
      console.error(err);
    }
  }

  const cuentaDestacada = cuentas.find((c) => c.fijada === 1 || c.fijada === true) || cuentas[0];

  const tarjetasPagar = (resumen?.tarjetas || []).filter(
    (t) => Number(t.gastado_mes) > 0 && (t.tipo || "credito") === "credito"
  );

  const deudasActivas = deudas.filter((d) => !d.pagada);
  const totalDebo = deudasActivas
    .filter((d) => d.tipo === "debo")
    .reduce((acc, d) => acc + Number(d.saldo_pendiente), 0);
  const totalMeDeben = deudasActivas
    .filter((d) => d.tipo === "me_deben")
    .reduce((acc, d) => acc + Number(d.saldo_pendiente), 0);

  return (
    <div className="max-w-md mx-auto px-4 pb-24 pt-6">
      {/* Header con fecha y avatar */}
      <header className="flex items-center justify-between mb-5">
        <h1 className="text-3xl font-bold text-carbon">{formatearFecha()}</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={onIrAReportes}
            className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-coral/10 hover:text-coral transition-colors"
            title="Ver reportes"
          >
            <TrendingUp size={18} />
          </button>

          {/* Avatar con menú desplegable */}
          <div className="relative menu-usuario">
            <button
              onClick={() => setMenuUsuarioAbierto(!menuUsuarioAbierto)}
              className="w-10 h-10 rounded-full bg-coral text-white flex items-center justify-center font-semibold text-sm hover:opacity-90 transition-opacity"
              title="Menú de usuario"
            >
              {usuario?.nombre?.[0]?.toUpperCase() || "?"}
            </button>

            {menuUsuarioAbierto && (
              <div
                className="absolute top-full right-0 mt-2 w-56 rounded-2xl shadow-2xl overflow-hidden z-50 animate-toast"
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                }}
              >
                {/* Header con nombre y email */}
                <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
                  <p className="text-sm font-semibold text-carbon truncate">
                    {usuario?.nombre}
                  </p>
                  <p className="text-xs text-gray-500 truncate">{usuario?.email}</p>
                </div>

                {/* Opciones */}
                <button
                  onClick={() => {
                    setMenuUsuarioAbierto(false);
                    onIrAPerfil?.();
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm text-carbon hover:bg-gray-50 transition-colors"
                >
                  <User size={16} className="text-gray-500" />
                  Mi perfil
                </button>

                <button
                  onClick={() => {
                    setMenuUsuarioAbierto(false);
                    onIrARecurrentes?.();
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm text-carbon hover:bg-gray-50 transition-colors"
                >
                  <Calendar size={16} className="text-gray-500" />
                  Transacciones recurrentes
                </button>

                <div style={{ borderTop: "1px solid var(--border)" }}>
                  <button
                    onClick={() => {
                      setMenuUsuarioAbierto(false);
                      onCerrarSesion?.();
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <LogOut size={16} />
                    Cerrar sesión
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Tabs superiores */}
      <div className="flex bg-gray-100 p-1 rounded-2xl mb-5">
        {["destacado", "productos", "parati"].map((tab) => (
          <button
            key={tab}
            onClick={() => setTabActiva(tab)}
            className={`flex-1 py-2.5 text-sm font-semibold rounded-xl transition-all capitalize ${
              tabActiva === tab
                ? "bg-white text-coral shadow-sm"
                : "text-gray-500 hover:text-carbon"
            }`}
          >
            {tab === "destacado" ? "Destacado" : tab === "productos" ? "Mis Productos" : "Para ti"}
          </button>
        ))}
      </div>

      <AlertasBanner />

      {tabActiva === "destacado" && (
        <>
          {/* Tarjeta Hero - Cuenta Destacada */}
          {cuentaDestacada ? (
            <div
              onClick={() => onVerCuenta?.(cuentaDestacada)}
              className="rounded-3xl p-6 text-white shadow-xl mb-5 relative overflow-hidden cursor-pointer active:scale-[0.99] transition-transform"
              style={{ background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4338ca 100%)" }}
            >
              <div className="flex justify-between items-start mb-8">
                <div>
                  <p className="text-xs opacity-75 uppercase tracking-wider mb-1">
                    Cuenta de {cuentaDestacada.tipo}
                  </p>
                  <p className="text-sm font-mono opacity-90">
                    {cuentaDestacada.numero_cuenta || cuentaDestacada.id.toString().padStart(10, "0")}
                  </p>
                </div>
                <span className="text-3xl">🏦</span>
              </div>

              <div className="mb-4">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-xs opacity-75 uppercase tracking-wider">Disponible</p>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSaldoVisible(!saldoVisible);
                    }}
                    className="opacity-75 hover:opacity-100"
                  >
                    {saldoVisible ? <Eye size={14} /> : <EyeOff size={14} />}
                  </button>
                </div>
                <p className="text-4xl font-bold">
                  {saldoVisible
                    ? `$${Number(cuentaDestacada.saldo_actual ?? cuentaDestacada.saldo_inicial).toFixed(2)}`
                    : "••••••"}
                </p>
              </div>

              <div className="flex justify-between items-end">
                <div className="min-w-0 flex-1">
                  {cuentaDestacada.titular && (
                    <>
                      <p className="text-[10px] opacity-60 uppercase tracking-wider">
                        Titular
                      </p>
                      <p className="text-sm font-medium truncate">
                        {cuentaDestacada.titular}
                      </p>
                    </>
                  )}
                </div>
                <div className="flex gap-3 shrink-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onIrAMovimientos();
                    }}
                    className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm hover:bg-white/30 transition-colors"
                  >
                    <ArrowRightLeft size={18} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onIrAPotes();
                    }}
                    className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm hover:bg-white/30 transition-colors"
                  >
                    <PiggyBank size={18} />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-3xl border-2 border-dashed border-gray-300 p-8 text-center mb-5">
              <p className="text-sm text-gray-500 mb-3">No tienes cuentas destacadas</p>
              <button onClick={onIrACuentas} className="text-coral font-semibold text-sm">
                + Crear cuenta
              </button>
            </div>
          )}

          {/* Widget de Tarjetas por pagar */}
          {tarjetasPagar.length > 0 && (
            <div className="mb-5">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-1">
                Por pagar
              </p>
              <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide -mx-4 px-4">
                {tarjetasPagar.map((t) => {
                  const { fechaLimite, diasRestantes, urgente } =
                    calcularVencimiento(t.dia_corte, t.dia_pago || 15);
                  return (
                    <div
                      key={t.id}
                      className="shrink-0 w-[300px] snap-center rounded-2xl p-4 flex items-center gap-3 shadow-sm"
                      style={{
                        background: "var(--surface)",
                        border: `1.5px solid ${urgente ? "#ef4444" : "var(--border)"}`,
                      }}
                    >
                      <div
                        className={`w-12 h-12 rounded-full flex items-center justify-center text-white shrink-0 ${
                          urgente ? "bg-red-500" : "bg-blue-600"
                        }`}
                      >
                        <CreditCard size={22} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-carbon text-sm truncate">
                          {t.nombre}
                        </p>
                        <p className="text-xs text-gray-500">
                          Por pagar: ${Number(t.gastado_mes).toFixed(2)}
                        </p>
                        <p
                          className={`text-xs font-medium mt-0.5 ${
                            urgente ? "text-red-500" : "text-blue-600"
                          }`}
                        >
                          {diasRestantes < 0
                            ? `Venció hace ${Math.abs(diasRestantes)} día${Math.abs(diasRestantes) !== 1 ? "s" : ""}`
                            : diasRestantes === 0
                            ? "Vence hoy"
                            : `Pagar hasta: ${fechaLimite.toLocaleDateString("es-ES", { day: "numeric", month: "long" })} · ${diasRestantes}d`}
                        </p>
                      </div>
                      <button
                        onClick={() => onPagarTarjeta?.(t)}
                        className={`px-3.5 py-2 rounded-full text-xs font-semibold transition-colors ${
                          urgente
                            ? "bg-red-500 text-white hover:bg-red-600"
                            : "bg-coral text-white hover:bg-coral-dark"
                        }`}
                      >
                        Pagar
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Widget de Deudas */}
          {deudasActivas.length > 0 && (
            <button
              onClick={onIrADeudas}
              className="w-full rounded-2xl p-4 mb-5 text-left shadow-sm hover:shadow-md transition-shadow"
              style={{
                background: "linear-gradient(135deg, #7c2d12 0%, #c2410c 100%)",
              }}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center text-white">
                  <HandCoins size={20} />
                </div>
                <span className="text-white text-2xl font-bold">
                  {deudasActivas.length}
                </span>
              </div>
              <p className="text-white/80 text-[10px] uppercase tracking-wider mb-1">
                Deudas activas
              </p>
              <div className="flex gap-3 text-white text-xs">
                {totalDebo > 0 && (
                  <span>Debes ${totalDebo.toFixed(2)}</span>
                )}
                {totalDebo > 0 && totalMeDeben > 0 && <span className="opacity-50">·</span>}
                {totalMeDeben > 0 && (
                  <span>Te deben ${totalMeDeben.toFixed(2)}</span>
                )}
              </div>
            </button>
          )}

          {/* Widget de Notas */}
          <div className="rounded-2xl overflow-hidden mb-5 shadow-sm">
            <div className="bg-gradient-to-r from-pink-600 to-rose-600 px-4 py-2 flex items-center justify-between">
              <p className="text-white text-xs font-semibold flex items-center gap-1.5">
                <StickyNote size={12} /> Notas
              </p>
              <button
                onClick={() => crearNota("rosa")}
                className="text-white/80 hover:text-white transition-colors"
                title="Nueva nota"
              >
                <Plus size={16} />
              </button>
            </div>
            <div className="p-3 grid grid-cols-2 gap-2" style={{ background: "var(--surface)" }}>
              {cargandoNotas ? (
                <>
                  <SkeletonLine width="100%" height="60px" />
                  <SkeletonLine width="100%" height="60px" />
                </>
              ) : notas.length === 0 ? (
                <button
                  onClick={() => crearNota("rosa")}
                  className="w-full text-left text-sm text-gray-400 py-3 hover:text-coral transition-colors flex items-center gap-2"
                >
                  <Plus size={16} /> Agregar nota
                </button>
              ) : (
                notas.map((n) => (
                  <NotaItem
                    key={n.id}
                    nota={n}
                    onGuardar={(contenido, color) => actualizarNota(n.id, contenido, color)}
                    onEliminar={() => eliminarNota(n.id)}
                  />
                ))
              )}
            </div>
          </div>
        </>
      )}

      {tabActiva === "productos" && (
        <TarjetasScreen
          tarjetas={tarjetas}
          embedded={true}
          onAgregar={onAgregarTarjeta}
          onPagar={onPagarTarjeta}
          onVerTarjeta={onVerTarjeta}
          onVolver={() => {}}
        />
      )}

      {tabActiva === "parati" && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles size={18} className="text-coral" />
            <h2 className="text-lg font-semibold text-carbon">Para ti</h2>
          </div>

          {cargandoInsights ? (
            <p className="text-sm text-gray-400 text-center py-8">Cargando...</p>
          ) : !Array.isArray(insights) || insights.length === 0 ? (
            <EmptyState
              icon={Sparkles}
              titulo="Aún no hay insights"
              mensaje="Registra tus primeros gastos e ingresos para ver análisis personalizados."
              colorIcono="morado"
            />
          ) : (
            insights.map((insight, i) => (
              <InsightCard key={i} insight={insight} />
            ))
          )}
        </div>
      )}
    </div>
  );
}

function NotaItem({ nota, onGuardar, onEliminar }) {
  const [contenido, setContenido] = useState(nota.contenido);
  const [color, setColor] = useState(nota.color || "rosa");
  const [guardando, setGuardando] = useState(false);
  const [selectorAbierto, setSelectorAbierto] = useState(false);

  useEffect(() => {
    setContenido(nota.contenido);
    setColor(nota.color || "rosa");
  }, [nota.contenido, nota.color]);

  const colores = COLORES_NOTA[color] || COLORES_NOTA.rosa;

  async function handleBlur() {
    if (contenido === nota.contenido && color === (nota.color || "rosa")) return;
    setGuardando(true);
    await onGuardar(contenido, color);
    setGuardando(false);
  }

  async function cambiarColor(nuevoColor) {
    setColor(nuevoColor);
    setSelectorAbierto(false);
    setGuardando(true);
    await onGuardar(contenido, nuevoColor);
    setGuardando(false);
  }

  return (
    <div className={`rounded-xl overflow-hidden border ${colores.border} flex flex-col h-full`}>
      {/* Header con color + selector */}
      <div className={`bg-gradient-to-r ${colores.header} px-2 py-1 flex items-center justify-between`}>
        <button
          type="button"
          onClick={() => setSelectorAbierto(!selectorAbierto)}
          className="text-white/80 hover:text-white transition-colors flex items-center gap-1"
          title="Cambiar color"
        >
          <Palette size={13} />
        </button>
        <button
          type="button"
          onClick={onEliminar}
          className="text-white/80 hover:text-white transition-colors"
          title="Eliminar nota"
        >
          <Trash2 size={12} />
        </button>
      </div>

      {/* Selector de color */}
      {selectorAbierto && (
        <div className="flex justify-around p-1.5 bg-white border-b" style={{ borderColor: "var(--border)" }}>
          {Object.entries(COLORES_NOTA).map(([key, val]) => (
            <button
              key={key}
              type="button"
              onClick={() => cambiarColor(key)}
              className={`w-5 h-5 rounded-full bg-gradient-to-br ${val.header} ${color === key ? "ring-2 ring-offset-1 ring-carbon" : ""}`}
            />
          ))}
        </div>
      )}

      <div className="p-2 flex-1" style={{ background: "var(--surface)" }}>
        <textarea
          value={contenido}
          onChange={(e) => setContenido(e.target.value)}
          onBlur={handleBlur}
          placeholder="Escribe una nota..."
          className="w-full text-sm font-serif italic text-carbon bg-transparent resize-none focus:outline-none"
          rows={2}
          maxLength={500}
        />
        <p className="text-[9px] text-gray-400 mt-1">
          {new Date(nota.actualizado_en || nota.creado_en).toLocaleDateString("es-ES", {
            day: "numeric",
            month: "short",
          })}
          {guardando && " · g..."}
        </p>
      </div>
    </div>
  );
}