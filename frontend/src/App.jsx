import { useState, useEffect, useCallback } from "react";
import {
  PiggyBank, Plus, Trash2, ChevronLeft, ChevronRight, Download, Pencil,
} from "lucide-react";
import { api, hayTokenGuardado, setAuthToken } from "./api.js";
import TarjetasPanel from "./TarjetasPanel.jsx";
import GruposPanel from "./GruposPanel.jsx";
import CardCarousel from "./CardCarousel.jsx";
import AuthScreen from "./AuthScreen.jsx";
import CambiarPasswordModal from "./CambiarPasswordModal.jsx";
import ResumenCategorias from "./ResumenCategorias.jsx";
import EditarGastoModal from "./EditarGastoModal.jsx";

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
  } catch {
    // localStorage puede fallar en navegación privada; no es crítico
  }
}

export default function App() {
  const [usuario, setUsuario] = useState(null);
  const [verificandoSesion, setVerificandoSesion] = useState(true);

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

  function handleLogout() {
    setAuthToken(null);
    setUsuario(null);
  }

  const hoy = new Date();
  const [periodo, setPeriodo] = useState({ anio: hoy.getFullYear(), mes: hoy.getMonth() + 1 });
  const esMesActual = periodo.anio === hoy.getFullYear() && periodo.mes === hoy.getMonth() + 1;

  const [modalPassword, setModalPassword] = useState(false);
  const [gastoEditando, setGastoEditando] = useState(null);

  const [tarjetas, setTarjetas] = useState([]);
  const [gastos, setGastos] = useState([]);
  const [resumen, setResumen] = useState(null);
  const [categorias, setCategorias] = useState([]);
  const [filtroCategoria, setFiltroCategoria] = useState(null);

  const [form, setForm] = useState({
    fecha: todayISO(),
    tarjeta_id: leerUltima(ULTIMA_TARJETA_KEY),
    monto: "",
    descripcion: "",
    categoria: leerUltima(ULTIMA_CATEGORIA_KEY),
  });
  const [error, setError] = useState("");

  const cargarDatos = useCallback(async () => {
    const [tarjetasData, gastosData, resumenData, categoriasData] = await Promise.all([
      api.getTarjetas(),
      api.getGastos(periodo.anio, periodo.mes, filtroCategoria),
      api.getResumen(periodo.anio, periodo.mes),
      categorias.length > 0 ? Promise.resolve(categorias) : api.getCategorias(),
    ]);
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

  const [rangoExport, setRangoExport] = useState("mes");
  const [exportando, setExportando] = useState(false);

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
    } catch (err) {
      manejarError(err);
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

  if (!usuario) {
    return <AuthScreen onAutenticado={setUsuario} />;
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

      <CardCarousel tarjetas={resumen?.tarjetas} />

      <div className={"total-bar" + (enRojo ? " rojo" : "")}>
        <span className="titulo">Total del mes (todas las tarjetas)</span>
        <span className="monto">
          ${Number(resumen?.total_mes ?? 0).toFixed(2)}{" "}
          <span className="limite">/ ${Number(resumen?.limite ?? 350)}</span>
        </span>
      </div>

      <ResumenCategorias anio={periodo.anio} mes={periodo.mes} />

      <TarjetasPanel tarjetas={tarjetas} onChange={cargarDatos} />

      <GruposPanel usuarioId={usuario.id} />

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
          <button className="submit" type="submit">
            <Plus size={16} />
            Agregar gasto
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
                  <button className="mini-btn" onClick={() => setGastoEditando(g)} title="Editar">
                    <Pencil size={15} />
                  </button>
                  <button className="mini-btn peligro" onClick={() => handleDelete(g.id)} title="Quitar">
                    <Trash2 size={15} />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {modalPassword && (
        <CambiarPasswordModal onCerrar={() => setModalPassword(false)} />
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
    </div>
  );
}
