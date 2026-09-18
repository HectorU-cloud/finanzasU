import { useState, useEffect, useCallback, useRef } from "react";
import {
  PiggyBank, Plus, Trash2, ChevronLeft, ChevronRight, Download, Pencil, MoreVertical,
} from "lucide-react";
import { api, hayTokenGuardado, setAuthToken } from "./api.js";
import TarjetasPanel from "./TarjetasPanel.jsx";
import GruposPanel from "./GruposPanel.jsx";
import CardCarousel from "./CardCarousel.jsx";
import AuthScreen from "./AuthScreen.jsx";
import CambiarPasswordModal from "./CambiarPasswordModal.jsx";
import ResumenCategorias from "./ResumenCategorias.jsx";
import EditarGastoModal from "./EditarGastoModal.jsx";
import ConfirmModal from "./ConfirmModal.jsx";
import Home from "./Home.jsx";
import BottomNav from "./BottomNav.jsx";
import CuentasScreen from "./CuentasScreen.jsx";
import IngresosScreen from "./IngresosScreen.jsx";
import PagarTarjetaModal from "./PagarTarjetaModal.jsx";
import HistorialPagosScreen from "./HistorialPagosScreen.jsx";
import TarjetaDetalleScreen from "./TarjetaDetalleScreen.jsx";
import PotesScreen from "./PotesScreen.jsx";
import SolicitarResetScreen from "./SolicitarResetScreen.jsx";
import ResetPasswordScreen from "./ResetPasswordScreen.jsx";
import TarjetasScreen from "./TarjetasScreen.jsx";
import MovimientosScreen from "./MovimientosScreen.jsx";

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

  const [modalPassword, setModalPassword] = useState(false);
  const [gastoEditando, setGastoEditando] = useState(null);
  const [gastoAEliminar, setGastoAEliminar] = useState(null);
  const [exito, setExito] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [panelTarjetasAbierto, setPanelTarjetasAbierto] = useState(false);
  const [vista, setVista] = useState("home");
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

  const peticionIdRef = useRef(0);

  function mostrarExito(mensaje) {
    setExito(mensaje);
    setTimeout(() => setExito(""), 2500);
  }

  useEffect(() => {
    if (!hayTokenGuardado()) {
      setVerificandoSesion(false);
      return;
    }
    api
      .yo()
      .then(setUsuario)
      .catch(() => setAuthToken(null))
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
    if (err.unauthorized) handleLogout();
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
      mostrarExito("Gasto agregado ✓");
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

  if (!usuario) {
    return (
      <AuthScreen
        onAutenticado={setUsuario}
        onSolicitarReset={() => {
          window.history.replaceState({}, "", "/");
          setVistaAuth("solicitar-reset");
        }}
      />
    );
  }

  if (vistaTarjetas) {
    return (
      <div className="min-h-screen bg-cream pb-24">
        <TarjetasScreen
          tarjetas={resumen?.tarjetas}
          onVolver={() => setVistaTarjetas(false)}
          onAgregar={() => setModalTarjetas(true)}
          onVerTarjeta={(t) => {
            setVistaTarjetas(false);
            setOrigenDetalle("tarjetas");
            setTarjetaDetalle(t);
          }}
        />

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

  const VISTAS_CON_NAV = ["home", "cuentas", "movimientos", "planificar", "perfil", "potes", "grupos"];

  if (VISTAS_CON_NAV.includes(vista)) {
    return (
      <div className="min-h-screen bg-cream pb-24">
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
          />
        )}
        {vista === "cuentas" && <CuentasScreen onCambiarVista={setVista} />}
        
        {/* NUEVO: Pantalla que unifica Ingresos y Pagos */}
        {vista === "movimientos" && <MovimientosScreen />}
        
        {/* TEMPORAL: Puente hacia Pot y Grupos hasta que armemos Planificar */}
        {vista === "planificar" && (
          <div className="max-w-md mx-auto p-6 pt-10">
            <h1 className="text-2xl font-bold text-carbon mb-6">Planificar</h1>
            <div className="bg-white rounded-2xl p-5 shadow-sm space-y-3">
              <p className="text-sm text-gray-500 mb-4">
                Aquí vivirán tus metas de ahorro (Pot), tus Grupos y Alertas.
                Mientras tanto, puedes acceder a ellos desde aquí:
              </p>
              <button
                onClick={() => setVista("potes")}
                className="w-full py-3 rounded-xl bg-coral text-white font-semibold text-sm"
              >
                Ir a mis Pot
              </button>
              <button
                onClick={() => setVista("grupos")}
                className="w-full py-3 rounded-xl border border-gray-200 text-carbon font-semibold text-sm"
              >
                Ir a mis Grupos
              </button>
            </div>
          </div>
        )}

        {vista === "potes" && <PotesScreen onVolver={() => setVista("planificar")} />}
        {vista === "grupos" && (
          <div className="max-w-md mx-auto p-6">
            <GruposPanel 
              usuarioId={usuario.id} 
              tarjetas={tarjetas} 
              onVolver={() => setVista("planificar")} 
            />
          </div>
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
          {exito && <p className="exito">{exito}</p>}
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