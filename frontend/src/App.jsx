import { useState, useEffect, useCallback, useRef, lazy, Suspense } from "react";
import {
  PiggyBank, Plus, Trash2, ChevronLeft, ChevronRight, Download, Pencil, MoreVertical,
} from "lucide-react";
import { api, hayTokenGuardado, setAuthToken } from "./api.js";
import { useToast } from "./ToastContext.jsx";

// === Eager: pantallas críticas que se ven al arranque ===
import AuthScreen from "./AuthScreen.jsx";
import Home from "./Home.jsx";
import BottomNav from "./BottomNav.jsx";
import SplashScreen from "./SplashScreen.jsx";
import ConfirmModal from "./ConfirmModal.jsx";
import CargandoPantalla from "./CargandoPantalla.jsx";
import SesionExpiradaScreen from "./SesionExpiradaScreen.jsx";
import BannerDemo from "./BannerDemo.jsx";

// === Lazy: pantallas y modales que se cargan bajo demanda ===
const TarjetasPanel = lazy(() => import("./TarjetasPanel.jsx"));
const GruposPanel = lazy(() => import("./GruposPanel.jsx"));
const CardCarousel = lazy(() => import("./CardCarousel.jsx"));
const CambiarPasswordModal = lazy(() => import("./CambiarPasswordModal.jsx"));
const ResumenCategorias = lazy(() => import("./ResumenCategorias.jsx"));
const EditarGastoModal = lazy(() => import("./EditarGastoModal.jsx"));
const CuentasScreen = lazy(() => import("./CuentasScreen.jsx"));
const IngresosScreen = lazy(() => import("./IngresosScreen.jsx"));
const PagarTarjetaModal = lazy(() => import("./PagarTarjetaModal.jsx"));
const HistorialPagosScreen = lazy(() => import("./HistorialPagosScreen.jsx"));
const TarjetaDetalleScreen = lazy(() => import("./TarjetaDetalleScreen.jsx"));
const PotesScreen = lazy(() => import("./PotesScreen.jsx"));
const DeudasScreen = lazy(() => import("./DeudasScreen.jsx"));
const SolicitarResetScreen = lazy(() => import("./SolicitarResetScreen.jsx"));
const ResetPasswordScreen = lazy(() => import("./ResetPasswordScreen.jsx"));
const TarjetasScreen = lazy(() => import("./TarjetasScreen.jsx"));
const MovimientosScreen = lazy(() => import("./MovimientosScreen.jsx"));
const PlanificarScreen = lazy(() => import("./PlanificarScreen.jsx"));
const CuentaDetalleScreen = lazy(() => import("./CuentaDetalleScreen.jsx"));
const ReportesScreen = lazy(() => import("./ReportesScreen.jsx"));
const OnboardingScreen = lazy(() => import("./OnboardingScreen.jsx"));
const RecurrentesScreen = lazy(() => import("./RecurrentesScreen.jsx"));
const CategoriasPanel = lazy(() => import("./CategoriasPanel.jsx"));
const CalendarioScreen = lazy(() => import("./CalendarioScreen.jsx"));
const GruposScreen = lazy(() => import("./GruposScreen.jsx"));
const BuscarScreen = lazy(() => import("./BuscarScreen.jsx"));
const EgresoCuentaModal = lazy(() => import("./EgresoCuentaModal.jsx"));

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

const NOMBRES_MES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

const ULTIMA_TARJETA_KEY = "finanzas_ultima_tarjeta";
const ULTIMA_CATEGORIA_KEY = "finanzas_ultima_categoria";

function leerUltima(key, fallback = "") {
  try {
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}

function guardarUltima(key, valor) {
  try {
    if (valor) localStorage.setItem(key, valor);
  } catch {}
}

function leerTokenResetDeUrl() {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token");
  if (window.location.pathname === "/reset" && token) {
    return token;
  }
  return null;
}

export default function App() {
  return (
    <Suspense fallback={<CargandoPantalla />}>
      <AppContent />
    </Suspense>
  );
}

function AppContent() {
  const [usuario, setUsuario] = useState(null);
  const [verificandoSesion, setVerificandoSesion] = useState(true);
  const [tema, setTema] = useState(() => {
    try {
      const guardado = localStorage.getItem("finanzas_tema");
      if (guardado) return guardado;
    } catch {}
    if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
      return "dark";
    }
    return "light";
  });

  const [vistaAuth, setVistaAuth] = useState(() => {
    if (leerTokenResetDeUrl()) return "reset-password";
    return "login";
  });
  const [tokenReset] = useState(() => leerTokenResetDeUrl());

  const hoy = new Date();
  const [periodo, setPeriodo] = useState({ anio: hoy.getFullYear(), mes: hoy.getMonth() + 1 });
  const esMesActual = periodo.anio === hoy.getFullYear() && periodo.mes === hoy.getMonth() + 1;
  const { showToast } = useToast();
  const [sesionExpirada, setSesionExpirada] = useState(false);

  const [modalPassword, setModalPassword] = useState(false);
  const [gastoEditando, setGastoEditando] = useState(null);
  const [gastoAEliminar, setGastoAEliminar] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [panelTarjetasAbierto, setPanelTarjetasAbierto] = useState(false);
  const [vista, setVista] = useState("home");
  const [vistaBuscar, setVistaBuscar] = useState(false);
  const [movimientosNav, setMovimientosNav] = useState({
    tab: "ingresos",
    anio: null,
    mes: null,
    nonce: 0,
  });
  const [egresoEditando, setEgresoEditando] = useState(null);
  const [modalEgresoAbierto, setModalEgresoAbierto] = useState(false);
  const [modalTarjetas, setModalTarjetas] = useState(false);
  const [vistaTarjetas, setVistaTarjetas] = useState(false);
  const [origenDetalle, setOrigenDetalle] = useState(null);
  

  const [tarjetas, setTarjetas] = useState([]);
  const [gastos, setGastos] = useState([]);
  const [resumen, setResumen] = useState(null);
  const [categorias, setCategorias] = useState([]);
  const [filtroCategoria, setFiltroCategoria] = useState(null);
  const [menuAbiertoId, setMenuAbiertoId] = useState(null);
  const [tarjetaAPagar, setTarjetaAPagar] = useState(null);
  const [tarjetaDetalle, setTarjetaDetalle] = useState(null);
  const [cuentaDetalle, setCuentaDetalle] = useState(null);
  const [rangoExportTodo, setRangoExportTodo] = useState("mes");
  const [exportandoTodo, setExportandoTodo] = useState(false);

  const [form, setForm] = useState({
    fecha: todayISO(),
    tarjeta_id: leerUltima(ULTIMA_TARJETA_KEY),
    monto: "",
    descripcion: "",
    categoria: leerUltima(ULTIMA_CATEGORIA_KEY),
  });
  const [error, setError] = useState("");
  const [rangoExport, setRangoExport] = useState("mes");
  const [exportando, setExportando] = useState(false);
  const [tabPlanificar, setTabPlanificar] = useState("potes");

  const peticionIdRef = useRef(0);

  const [mostrarOnboarding, setMostrarOnboarding] = useState(() => {
    try {
      return !localStorage.getItem("finanzas_onboarding_completado");
    } catch {
      return false;
    }
  });

  // Splash: solo para usuarios que YA completaron el onboarding
  // El splash solo se muestra tras login explícito o tras completar el onboarding,
// no al recargar la página con sesión activa.
const [mostrandoSplash, setMostrandoSplash] = useState(false);

  function completarOnboarding() {
    try {
      localStorage.setItem("finanzas_onboarding_completado", "true");
    } catch {}
    setMostrarOnboarding(false);
    setMostrandoSplash(true); // <-- Mostrar splash después del onboarding
  }


  useEffect(() => {
  if (!hayTokenGuardado()) {
    setVerificandoSesion(false);
    return;
  }
  api
    .yo()
    .then(setUsuario)
    .catch((err) => {
      setAuthToken(null);
      if (err?.unauthorized) {
        setSesionExpirada(true);
      }
    })
    .finally(() => setVerificandoSesion(false));
}, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", tema);
    try {
      localStorage.setItem("finanzas_tema", tema);
    } catch {}
  }, [tema]);

  function handleLogout() {
    setAuthToken(null);
    setUsuario(null);
  }

  const cargarDatos = useCallback(async () => {
    const miId = ++peticionIdRef.current;
    const [tarjetasData, gastosData, resumenData, categoriasData] = await Promise.all([
      api.getTarjetas(),
      api.getGastos(periodo.anio, periodo.mes, filtroCategoria),
      api.getResumen(periodo.anio, periodo.mes),
      categorias.length > 0 ? Promise.resolve(categorias) : api.getCategorias(),
    ]);
    if (peticionIdRef.current !== miId) return;
    setTarjetas(tarjetasData);
    setGastos(gastosData);
    setResumen(resumenData);
    if (categorias.length === 0 && categoriasData?.categorias) {
      setCategorias(categoriasData.categorias);
    }
    setForm((f) => ({
      ...f,
      tarjeta_id: tarjetasData.some((t) => t.id === Number(f.tarjeta_id))
        ? f.tarjeta_id
        : tarjetasData[0]?.id || "",
    }));
  }, [periodo, filtroCategoria]); // eslint-disable-line react-hooks/exhaustive-deps

  function manejarError(err) {
  setError(err.message);
  if (err.unauthorized) {
    setSesionExpirada(true);
  }
}

  useEffect(() => {
    if (!usuario) return;
    cargarDatos().catch(manejarError);
  }, [cargarDatos, usuario]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    function cerrarSiEsFuera(e) {
      if (!e.target.closest(".acciones-menu")) {
        setMenuAbiertoId(null);
      }
    }
    document.addEventListener("click", cerrarSiEsFuera);
    return () => document.removeEventListener("click", cerrarSiEsFuera);
  }, []);

  function cambiarMes(delta) {
    setPeriodo((p) => {
      let mes = p.mes + delta;
      let anio = p.anio;
      if (mes > 12) {
        mes = 1;
        anio += 1;
      } else if (mes < 1) {
        mes = 12;
        anio -= 1;
      }
      return { anio, mes };
    });
    setFiltroCategoria(null);
  }

  async function handleExport() {
    let desde, hasta;
    if (rangoExport === "dia") {
      desde = hasta = todayISO();
    } else if (rangoExport === "semana") {
      const fin = new Date();
      const inicio = new Date();
      inicio.setDate(fin.getDate() - 6);
      desde = inicio.toISOString().slice(0, 10);
      hasta = fin.toISOString().slice(0, 10);
    } else {
      const ultimoDia = new Date(periodo.anio, periodo.mes, 0).getDate();
      desde = `${periodo.anio}-${String(periodo.mes).padStart(2, "0")}-01`;
      hasta = `${periodo.anio}-${String(periodo.mes).padStart(2, "0")}-${ultimoDia}`;
    }

    setExportando(true);
    setError("");
    try {
      const { blob, filename } = await api.exportarGastos(desde, hasta, filtroCategoria);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      manejarError(err);
    } finally {
      setExportando(false);
    }
  }

  async function handleExportTodo() {
    let desde, hasta;
    const ahora = new Date();
    
    if (rangoExportTodo === "mesActual") {
      // Mes actual: del 1 al último día del mes actual
      const inicio = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
      const fin = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0);
      desde = inicio.toISOString().slice(0, 10);
      hasta = fin.toISOString().slice(0, 10);
    } else if (rangoExportTodo === "mesAnterior") {
      // Mes anterior completo
      const inicio = new Date(ahora.getFullYear(), ahora.getMonth() - 1, 1);
      const fin = new Date(ahora.getFullYear(), ahora.getMonth(), 0);
      desde = inicio.toISOString().slice(0, 10);
      hasta = fin.toISOString().slice(0, 10);
    } else if (rangoExportTodo === "3meses") {
      const inicio = new Date(ahora.getFullYear(), ahora.getMonth() - 3, 1);
      desde = inicio.toISOString().slice(0, 10);
      hasta = ahora.toISOString().slice(0, 10);
    } else if (rangoExportTodo === "anio") {
      const inicio = new Date(ahora.getFullYear(), 0, 1);
      desde = inicio.toISOString().slice(0, 10);
      hasta = ahora.toISOString().slice(0, 10);
    } else {
      desde = "2000-01-01";
      hasta = ahora.toISOString().slice(0, 10);
    }
    

    setExportandoTodo(true);
    try {
      const { blob, filename } = await api.exportarTodo(desde, hasta);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    } finally {
      setExportandoTodo(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (enviando) return;
    const montoNum = Number(form.monto);
    if (!form.fecha || !form.tarjeta_id || !form.monto || isNaN(montoNum) || montoNum <= 0) {
      setError("Completa fecha, tarjeta y un monto válido.");
      return;
    }
    if (form.fecha > todayISO()) {
      setError("La fecha no puede ser futura.");
      return;
    }
    if (montoNum > 100000) {
      setError("Ese monto parece demasiado alto. Revisa si escribiste bien la cifra.");
      return;
    }
    setError("");
    setEnviando(true);
    try {
      await api.crearGasto({
        tarjeta_id: Number(form.tarjeta_id),
        fecha: form.fecha,
        monto: montoNum,
        descripcion: form.descripcion || null,
        categoria: form.categoria || null,
      });
      guardarUltima(ULTIMA_TARJETA_KEY, form.tarjeta_id);
      guardarUltima(ULTIMA_CATEGORIA_KEY, form.categoria);
      setForm((f) => ({ ...f, monto: "", descripcion: "" }));
      await cargarDatos();
      showToast("Gasto agregado ✓");
    } catch (err) {
      manejarError(err);
    } finally {
      setEnviando(false);
    }
  }

  async function handleDelete(id) {
    try {
      await api.eliminarGasto(id);
      await cargarDatos();
      showToast("Gasto eliminado", "info");
    } catch (err) {
      manejarError(err);
    }
  }

  const enRojo = resumen?.en_rojo ?? false;

  if (verificandoSesion) {
    return (
      <div className="auth-wrap">
        <p style={{ color: "var(--ink-soft)", fontSize: 14 }}>Cargando...</p>
      </div>
    );
  }

  if (vistaAuth === "reset-password" && tokenReset) {
    return (
      <ResetPasswordScreen
        token={tokenReset}
        onCompletado={() => {
          window.history.replaceState({}, "", "/");
          setVistaAuth("login");
        }}
      />
    );
  }

  if (vistaAuth === "solicitar-reset") {
    return (
      <SolicitarResetScreen
        onVolver={() => {
          window.history.replaceState({}, "", "/");
          setVistaAuth("login");
        }}
      />
    );
  }

  if (sesionExpirada) {
  return (
    <SesionExpiradaScreen
      onVolverALogin={() => {
        setSesionExpirada(false);
        setUsuario(null);
        setAuthToken(null);
      }}
    />
  );
}

  if (vistaBuscar && usuario) {
  return (
    <BuscarScreen
      onVolver={() => setVistaBuscar(false)}
      onNavegar={(r) => {
        setVistaBuscar(false);

        if (r.tipo === "deuda") return setVista("deudas");
        if (r.tipo === "nota") return setVista("home");
        if (r.tipo === "pote") return setVista("planificar");

        // Movimientos: decidir el tab según el tipo
        let tab = "pagos";
        if (r.tipo === "gasto" || r.tipo === "egreso") tab = "gastos";
        else if (r.tipo === "ingreso") tab = "ingresos";

        setMovimientosNav((prev) => ({
          tab,
          anio: r.anio ?? null,
          mes: r.mes ?? null,
          nonce: prev.nonce + 1,
        }));
        setVista("movimientos");
      }}
    />
  );
}

  if (!usuario) {
  return (
    <AuthScreen
      onAutenticado={(u) => {
        setUsuario(u);
        try {
          if (localStorage.getItem("finanzas_onboarding_completado") === "true") {
            setMostrandoSplash(true);
          }
        } catch {}
      }}
      onSolicitarReset={() => {
        window.history.replaceState({}, "", "/");
        setVistaAuth("solicitar-reset");
      }}
    />
  );
}

  if (mostrarOnboarding) {
    return (
      <OnboardingScreen
        usuario={usuario}
        onCompletado={completarOnboarding}
      />
    );
  }

  // Splash: solo para usuarios existentes (que ya vieron el onboarding)
  if (mostrandoSplash) {
    return <SplashScreen usuario={usuario} onTerminar={() => setMostrandoSplash(false)} />;
  }

  if (vistaTarjetas) {
        return (
      <div className="min-h-screen bg-cream pb-24">
        {usuario?.es_demo && (
          <BannerDemo
            onCrearCuenta={() => {
              handleLogout();
              setVistaAuth("login");
            }}
            onCerrarSesion={handleLogout}
          />
        )}
        <TarjetasScreen
          tarjetas={resumen?.tarjetas}
          onVolver={() => setVistaTarjetas(false)}
          onAgregar={() => setModalTarjetas(true)}
          onPagar={(t) => setTarjetaAPagar(t)}   // <-- NUEVO
          onVerTarjeta={(t) => {
            setVistaTarjetas(false);
            setOrigenDetalle("tarjetas");
            setTarjetaDetalle(t);
          }}
        />

        {modalEgresoAbierto && (
          <EgresoCuentaModal
            egreso={egresoEditando}
            onCerrar={() => {
              setModalEgresoAbierto(false);
              setEgresoEditando(null);
            }}
            onGuardado={() => {
              setModalEgresoAbierto(false);
              setEgresoEditando(null);
              setMovimientosNav((p) => ({ ...p, nonce: p.nonce + 1 }));
            }}
          />
        )}

        {modalTarjetas && (
          <div
            className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4"
            onClick={() => setModalTarjetas(false)}
          >
            <div
              className="bg-white rounded-t-3xl sm:rounded-3xl p-5 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-carbon">Mis tarjetas</h3>
                <button
                  onClick={() => setModalTarjetas(false)}
                  className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-500"
                >
                  ✕
                </button>
              </div>
              <TarjetasPanel
                tarjetas={tarjetas}
                onChange={() => {
                  cargarDatos();
                }}
                abierto={true}
                onToggle={() => {}}
              />
            </div>
          </div>
        )}

        <BottomNav
          vista={vista}
          onCambiar={(nuevaVista) => {
            setVistaTarjetas(false);
            setVista(nuevaVista);
            setTarjetaDetalle(null);
          }}
        />
      </div>
    );
  }

  const VISTAS_CON_NAV = ["home", "cuentas", "movimientos", "planificar", "perfil", "potes", "grupos", "deudas", "reportes", "recurrentes", "calendario"];

  if (VISTAS_CON_NAV.includes(vista)) {
        return (
      <div className="min-h-screen bg-cream pb-24">
        {usuario?.es_demo && (
          <BannerDemo
            onCrearCuenta={() => {
              handleLogout();
              setVistaAuth("login");
            }}
            onCerrarSesion={handleLogout}
          />
        )}
        {vista === "home" && (
          <Home
            usuario={usuario}
            resumen={resumen}
            tarjetas={resumen?.tarjetas}
            onIrACuentas={() => setVista("cuentas")}
            onPagarTarjeta={(t) => setTarjetaAPagar(t)}
            onVerTarjeta={(t) => {setOrigenDetalle(null);setTarjetaDetalle(t);}}
            onVerTodasTarjetas={() => setVistaTarjetas(true)}
            onAgregarTarjeta={() => setModalTarjetas(true)}
            onIrAPotes={() => setVista("planificar")}
            onIrAMovimientos={() => setVista("movimientos")}
            onVerCuenta={(c) => setCuentaDetalle(c)}
            onIrADeudas={() => setVista("deudas")}
            onIrAReportes={() => setVista("reportes")}
            onIrARecurrentes={() => setVista("recurrentes")}    // <-- NUEVA
            onIrAPerfil={() => setVista("perfil")}                // <-- NUEVA
            onCerrarSesion={handleLogout}
            onIrACalendario={() => setVista("calendario")}        // <-- NUEVA
            onBuscar={() => setVistaBuscar(true)}
          />
        )}
        {vista === "cuentas" && <CuentasScreen onCambiarVista={setVista} />}
        
        {/* NUEVO: Pantalla que unifica Ingresos y Pagos */}
        {vista === "movimientos" && (
          <MovimientosScreen
            key={movimientosNav.nonce}
            tarjetas={tarjetas}
            tabInicial={movimientosNav.tab}
            anioInicial={movimientosNav.anio}
            mesInicial={movimientosNav.mes}
            onAbrirTarjeta={(tarjetaId, anio, mes) => {
              const tarjeta = tarjetas.find((t) => t.id === tarjetaId);
              if (tarjeta) {
                setOrigenDetalle(null);
                setTarjetaDetalle({ ...tarjeta, _anioInicial: anio, _mesInicial: mes });
              }
            }}
            onEditarEgreso={(egreso) => {
              setEgresoEditando(egreso);
              setModalEgresoAbierto(true);
            }}
            onNuevoEgreso={() => {
              setEgresoEditando(null);
              setModalEgresoAbierto(true);
            }}
          />
        )}
        {vista === "potes" && <PotesScreen onVolver={() => setVista("planificar")} />}
        {vista === "deudas" && <DeudasScreen onVolver={() => setVista("planificar")} />}
        {vista === "reportes" && (
          <ReportesScreen onVolver={() => setVista("home")} />
        )}
        {vista === "recurrentes" && (
          <RecurrentesScreen onVolver={() => setVista("home")} />
        )}
        {vista === "calendario" && (
          <CalendarioScreen onVolver={() => setVista("home")} />
        )}
        {vista === "grupos" && (
          <GruposScreen 
            usuarioId={usuario.id} 
            tarjetas={tarjetas} 
            onVolver={() => setVista("planificar")} 
          />
        )}
        
        {vista === "perfil" && (
          <div className="max-w-md mx-auto p-6">
            <div className="bg-white rounded-2xl p-6 text-center">
              <div className="w-16 h-16 rounded-full bg-coral text-white flex items-center justify-center text-2xl font-bold mx-auto mb-3">
                {usuario.nombre[0]?.toUpperCase()}
              </div>
              <h2 className="text-lg font-bold text-carbon">{usuario.nombre}</h2>
              <p className="text-sm text-gray-500 mb-5">{usuario.email}</p>
              <div className="space-y-2">
                <button
                  onClick={() => setTema(tema === "dark" ? "light" : "dark")}
                  className="w-full py-3 rounded-xl border border-gray-200 text-sm font-medium flex items-center justify-between px-4"
                >
                  <span className="text-carbon">
                    {tema === "dark" ? "🌙 Modo oscuro" : "☀️ Modo claro"}
                  </span>
                  <div
                    className={`w-11 h-6 rounded-full transition-colors relative ${
                      tema === "dark" ? "bg-coral" : "bg-gray-300"
                    }`}
                  >
                    <div
                      className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                        tema === "dark" ? "translate-x-[22px]" : "translate-x-0.5"
                      }`}
                    />
                  </div>
                </button>

                <button
                  onClick={() => setModalPassword(true)}
                  className="w-full py-3 rounded-xl border border-gray-200 text-sm font-medium text-carbon"
                >
                  Cambiar contraseña
                </button>

                {/* Exportar todo */}
                <div className="border border-gray-200 rounded-xl p-4 text-left">
                  <p className="text-xs font-semibold text-carbon mb-2">
                    📦 Exportar mis finanzas
                  </p>
                  <p className="text-[11px] text-gray-500 mb-3">
                    Descarga un ZIP con todos tus movimientos en CSV.
                  </p>
                  <div className="flex gap-2">
                    <select
                      value={rangoExportTodo}
                      onChange={(e) => setRangoExportTodo(e.target.value)}
                      className="flex-1 px-3 py-2 rounded-lg border border-gray-200 focus:border-coral focus:outline-none text-xs bg-white"
                    >
                      <option value="mesActual">Mes actual</option>
                      <option value="mesAnterior">Mes anterior</option>
                      <option value="3meses">Últimos 3 meses</option>
                      <option value="anio">Este año</option>
                      <option value="todo">Todo</option>
                    </select>
                    <button
                      onClick={handleExportTodo}
                      disabled={exportandoTodo}
                      className="px-4 py-2 rounded-lg bg-coral text-white text-xs font-semibold hover:bg-coral-dark transition-colors disabled:opacity-60"
                    >
                      {exportandoTodo ? "..." : "Descargar"}
                    </button>
                  </div>
                </div>

                <CategoriasPanel onCambio={cargarDatos} />

                <button
                  onClick={handleLogout}
                  className="w-full py-3 rounded-xl bg-coral text-white text-sm font-semibold"
                >
                  Cerrar sesión
                </button>
              </div>
            </div>
          </div>
        )}

        {tarjetaAPagar && (
          <PagarTarjetaModal
            tarjeta={tarjetaAPagar}
            onCerrar={() => setTarjetaAPagar(null)}
            onPagado={() => {
              setTarjetaAPagar(null);
              cargarDatos();
            }}
            onIrAHistorial={() => {
              setTarjetaAPagar(null);
              setVista("movimientos");
            }}
          />
        )}
        {tarjetaDetalle && (
          <TarjetaDetalleScreen
            tarjeta={tarjetaDetalle}
            onVolver={() => {
              setTarjetaDetalle(null);
              if (origenDetalle === "tarjetas") {
                setOrigenDetalle(null);
                setVistaTarjetas(true);
              }
            }}
            onCambio={() => cargarDatos()}
          />
        )}

        {cuentaDetalle && (
          <CuentaDetalleScreen
            cuenta={cuentaDetalle}
            onVolver={() => {
              setCuentaDetalle(null);
              setVista("cuentas");
            }}
          />
        )}

        {modalTarjetas && (
          <div
            className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4"
            onClick={() => setModalTarjetas(false)}
          >
            <div
              className="bg-white rounded-t-3xl sm:rounded-3xl p-5 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-carbon">Mis tarjetas</h3>
                <button
                  onClick={() => setModalTarjetas(false)}
                  className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-500"
                >
                  ✕
                </button>
              </div>
              <TarjetasPanel
                tarjetas={tarjetas}
                onChange={() => {
                  cargarDatos();
                }}
                abierto={true}
                onToggle={() => {}}
              />
            </div>
          </div>
        )}

        <BottomNav
          vista={vista}
          onCambiar={(nuevaVista) => {
            setVista(nuevaVista);
            setTarjetaDetalle(null);
          }}
        />
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <h1 className="wordmark">Control de gastos</h1>
          <p className="periodo">
            {NOMBRES_MES[periodo.mes - 1]} de {periodo.anio}
            {esMesActual && " · mes actual"}
          </p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
          <div className="quien-sesion">
            <span className="quien-nombre">Hola, {usuario.nombre}</span>
            <button className="cerrar-sesion" onClick={() => setModalPassword(true)}>
              Cambiar contraseña
            </button>
            <button className="cerrar-sesion" onClick={handleLogout}>
              Cerrar sesión
            </button>
          </div>
          <div className="mes-nav">
            <button className="icon-btn" onClick={() => cambiarMes(-1)} title="Mes anterior">
              <ChevronLeft size={16} />
            </button>
            <button className="icon-btn" onClick={() => cambiarMes(1)} title="Mes siguiente">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </header>

      <CardCarousel
        tarjetas={resumen?.tarjetas}
        onCrear={() => {
          setPanelTarjetasAbierto(true);
          document.getElementById("panel-tarjetas")?.scrollIntoView({ behavior: "smooth" });
        }}
      />

      <div className={"total-bar" + (enRojo ? " rojo" : "")}>
        <span className="titulo">Total del mes (todas las tarjetas)</span>
        <span className="monto">
          ${Number(resumen?.total_mes ?? 0).toFixed(2)}{" "}
          <span className="limite">/ ${Number(resumen?.limite ?? 350)}</span>
        </span>
      </div>

      <ResumenCategorias anio={periodo.anio} mes={periodo.mes} />

      <TarjetasPanel
        tarjetas={tarjetas}
        onChange={cargarDatos}
        abierto={panelTarjetasAbierto}
        onToggle={setPanelTarjetasAbierto}
      />

      <GruposPanel usuarioId={usuario.id} tarjetas={tarjetas} />

      <div className="panel">
        <form
          onSubmit={handleSubmit}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.target.blur();
            }
          }}
        >
          <p className="titulo">
            <PiggyBank size={16} />
            Registrar gasto
          </p>
          <div className="form-row">
            <div>
              <label>Fecha</label>
              <input
                type="date"
                value={form.fecha}
                max={todayISO()}
                min="2000-01-01"
                onChange={(e) => setForm({ ...form, fecha: e.target.value })}
              />
            </div>
            <div>
              <label>Tarjeta</label>
              <select
                value={form.tarjeta_id}
                onChange={(e) => setForm({ ...form, tarjeta_id: e.target.value })}
              >
                {tarjetas.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div>
              <label>Monto</label>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={form.monto}
                onChange={(e) => setForm({ ...form, monto: e.target.value })}
              />
            </div>
            <div>
              <label>Categoría</label>
              <select
                value={form.categoria}
                onChange={(e) => setForm({ ...form, categoria: e.target.value })}
              >
                <option value="">Sin categoría</option>
                {categorias.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div style={{ gridColumn: "1 / -1" }}>
              <label>Descripción (opcional)</label>
              <input
                type="text"
                placeholder="ej. almuerzo"
                value={form.descripcion}
                onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
              />
            </div>
          </div>
          {error && <p className="error">{error}</p>}
          <button className="submit" type="submit" disabled={enviando}>
            <Plus size={16} />
            {enviando ? "Agregando..." : "Agregar gasto"}
          </button>
        </form>
      </div>

      <div className="exportar-fila">
        <p className="lista-titulo" style={{ marginBottom: 0 }}>Gastos del mes</p>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <select value={rangoExport} onChange={(e) => setRangoExport(e.target.value)}>
            <option value="dia">Hoy</option>
            <option value="semana">Últimos 7 días</option>
            <option value="mes">
              {NOMBRES_MES[periodo.mes - 1]} {periodo.anio}
            </option>
          </select>
          <button className="icon-btn" onClick={handleExport} disabled={exportando} title="Descargar CSV">
            <Download size={15} />
          </button>
        </div>
      </div>

      {categorias.length > 0 && (
        <div className="filtros-categorias">
          <button
            className={"chip-filtro" + (filtroCategoria === null ? " activo" : "")}
            onClick={() => setFiltroCategoria(null)}
          >
            Todas
          </button>
          {categorias.map((c) => (
            <button
              key={c}
              className={"chip-filtro" + (filtroCategoria === c ? " activo" : "")}
              onClick={() => setFiltroCategoria(c)}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {gastos.length === 0 ? (
        <p className="vacio">
          {filtroCategoria
            ? `No hay gastos en la categoría "${filtroCategoria}".`
            : "Todavía no registras gastos este mes."}
        </p>
      ) : (
        <ul className="gastos">
          {gastos.map((g) => {
            const tarjeta = tarjetas.find((t) => t.id === g.tarjeta_id);
            return (
              <li key={g.id}>
                <div className="detalle">
                  <span className="linea1">
                    {g.fecha}
                    <span className="sep">·</span>
                    {tarjeta?.nombre}
                    {g.categoria && (
                      <>
                        <span className="sep">·</span>
                        <span className="cat-badge">{g.categoria}</span>
                      </>
                    )}
                  </span>
                  {g.descripcion && <span className="desc">{g.descripcion}</span>}
                </div>
                <div className="acciones">
                  <span className="monto">${Number(g.monto).toFixed(2)}</span>
                  <div className="acciones-menu">
                    <button
                      className="mini-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuAbiertoId(menuAbiertoId === g.id ? null : g.id);
                      }}
                      title="Más opciones"
                    >
                      <MoreVertical size={16} />
                    </button>
                    {menuAbiertoId === g.id && (
                      <div className="dropdown-menu">
                        <button
                          onClick={() => {
                            setGastoEditando(g);
                            setMenuAbiertoId(null);
                          }}
                        >
                          <Pencil size={14} /> Editar
                        </button>
                        <button
                          className="peligro"
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
              </li>
            );
          })}
        </ul>
      )}

      {modalPassword && (
        <CambiarPasswordModal onCerrar={() => setModalPassword(false)} onExito={handleLogout} />
      )}

      {gastoEditando && (
        <EditarGastoModal
          gasto={gastoEditando}
          tarjetas={tarjetas}
          categorias={categorias}
          onCerrar={() => setGastoEditando(null)}
          onGuardado={() => {
            setGastoEditando(null);
            cargarDatos();
          }}
        />
      )}

      {gastoAEliminar && (
        <ConfirmModal
          titulo="Eliminar gasto"
          mensaje={`¿Seguro que quieres eliminar el gasto de $${Number(gastoAEliminar.monto).toFixed(2)}${gastoAEliminar.categoria ? ` (${gastoAEliminar.categoria})` : ""}? Esta acción no se puede deshacer.`}
          textoConfirmar="Sí, eliminar"
          onConfirmar={async () => {
            await handleDelete(gastoAEliminar.id);
            setGastoAEliminar(null);
          }}
          onCancelar={() => setGastoAEliminar(null)}
        />
      )}
    </div>
  );
}