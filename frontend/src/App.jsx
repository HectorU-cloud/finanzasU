import { useState, useEffect, useCallback } from "react";
import {PiggyBank, Plus, Trash2, ChevronLeft, ChevronRight, Download, TrendingDown, CreditCard, ReceiptText,} from "lucide-react";
import { api, hayTokenGuardado, setAuthToken } from "./api.js";
import TarjetasPanel from "./TarjetasPanel.jsx";
import CardCarousel from "./CardCarousel.jsx";
import AppLayout from "./components/layout/AppLayout.jsx";
import AuthScreen from "./AuthScreen.jsx";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

const NOMBRES_MES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

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

  const [currentView, setCurrentView] = useState("inicio");
  const hoy = new Date();
  const [periodo, setPeriodo] = useState({ anio: hoy.getFullYear(), mes: hoy.getMonth() + 1 });
  const esMesActual = periodo.anio === hoy.getFullYear() && periodo.mes === hoy.getMonth() + 1;

  const [tarjetas, setTarjetas] = useState([]);
  const [gastos, setGastos] = useState([]);
  const [resumen, setResumen] = useState(null);
  const [form, setForm] = useState({
    fecha: todayISO(),
    tarjeta_id: "",
    monto: "",
    descripcion: "",
  });
  const [error, setError] = useState("");

  const cargarDatos = useCallback(async () => {
    const [tarjetasData, gastosData, resumenData] = await Promise.all([
      api.getTarjetas(),
      api.getGastos(periodo.anio, periodo.mes),
      api.getResumen(periodo.anio, periodo.mes),
    ]);
    setTarjetas(tarjetasData);
    setGastos(gastosData);
    setResumen(resumenData);
    setForm((f) => ({
      ...f,
      tarjeta_id: tarjetasData.some((t) => t.id === Number(f.tarjeta_id))
        ? f.tarjeta_id
        : tarjetasData[0]?.id || "",
    }));
  }, [periodo]); // eslint-disable-line react-hooks/exhaustive-deps

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
      const { blob, filename } = await api.exportarGastos(desde, hasta);
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
    setError("");
    try {
      await api.crearGasto({
        tarjeta_id: Number(form.tarjeta_id),
        fecha: form.fecha,
        monto: montoNum,
        descripcion: form.descripcion || null,
      });
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

  function renderPlaceholder(title, description) {
  return (
    <div className="dashboard">
      <section className="page-placeholder">
        <span className="section-kicker">FINANZASU</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </section>
    </div>
  );
}

  return (
    <>
    <div className="app-topbar">
      <span className="quien">Hola, {usuario.nombre}</span>
      <button onClick={handleLogout}>Cerrar sesión</button>
    </div>
    <AppLayout
    currentView={currentView}
    onNavigate={setCurrentView}
    >
      {currentView === "inicio" && (
      <div className="dashboard">
        <header className="dashboard-header">
  <div>
    <p className="eyebrow">
      {NOMBRES_MES[periodo.mes - 1]} de {periodo.anio}
      {esMesActual && " · Mes actual"}
    </p>

    <h1>
      Hola, Héctor <span>👋</span>
    </h1>

    <p className="dashboard-subtitle">
      Aquí tienes un resumen de tus finanzas.
    </p>
  </div>

  <div className="month-navigation">
    <button
      className="icon-btn"
      onClick={() => cambiarMes(-1)}
      title="Mes anterior"
    >
      <ChevronLeft size={18} />
    </button>

    <button
      className="icon-btn"
      onClick={() => cambiarMes(1)}
      title="Mes siguiente"
    >
      <ChevronRight size={18} />
    </button>
  </div>
</header>

        <CardCarousel tarjetas={resumen?.tarjetas} />

        <section className={`financial-overview ${enRojo ? "danger" : ""}`}>
  <div className="overview-content">

    <div className="overview-header">
      <div className="overview-icon">
        <TrendingDown size={22} />
      </div>

      <span>
        {enRojo
          ? "Has superado tu límite mensual"
          : "Tus gastos del mes"}
      </span>
    </div>

    <div className="overview-amount">
      ${Number(resumen?.total_mes ?? 0).toFixed(2)}
    </div>

    <div className="overview-footer">
      <div className="budget-progress">
        <div
          className="budget-progress-fill"
          style={{
            width: `${Math.min(
              (Number(resumen?.total_mes ?? 0) /
                Number(resumen?.limite ?? 350)) *
                100,
              100
            )}%`,
          }}
        />
      </div>

      <p>
        Límite mensual:
        <strong>
          ${Number(resumen?.limite ?? 350).toFixed(2)}
        </strong>
      </p>
    </div>

  </div>

  <div className="overview-decoration" />
</section>

<section className="quick-stats">

  <div className="quick-stat-card">
    <div className="quick-stat-icon purple">
      <CreditCard size={20} />
    </div>

    <div>
      <span>Tarjetas activas</span>
      <strong>{tarjetas.length}</strong>
    </div>
  </div>

  <div className="quick-stat-card">
    <div className="quick-stat-icon blue">
      <ReceiptText size={20} />
    </div>

    <div>
      <span>Movimientos</span>
      <strong>{gastos.length}</strong>
    </div>
  </div>

</section>

        <TarjetasPanel tarjetas={tarjetas} onChange={cargarDatos} />

        <section className="expense-form-card">
  <div className="expense-form-header">
    <div>
      <span className="section-kicker">NUEVO MOVIMIENTO</span>
      <h2>Registrar gasto</h2>
      <p>Agrega una compra a tus gastos del mes.</p>
    </div>

    <div className="expense-form-icon">
      <PiggyBank size={21} />
    </div>
  </div>

  <form className="expense-form" onSubmit={handleSubmit}>
    <div className="amount-field">
      <label htmlFor="monto">Monto</label>

      <div className="amount-input-wrapper">
        <span>$</span>

        <input
          id="monto"
          type="number"
          min="0"
          step="0.01"
          inputMode="decimal"
          placeholder="0.00"
          value={form.monto}
          onChange={(e) =>
            setForm({ ...form, monto: e.target.value })
          }
        />
      </div>
    </div>

    <div className="expense-form-grid">
      <div className="modern-field">
        <label htmlFor="fecha">Fecha</label>

        <input
          id="fecha"
          type="date"
          value={form.fecha}
          onChange={(e) =>
            setForm({ ...form, fecha: e.target.value })
          }
        />
      </div>

      <div className="modern-field">
        <label htmlFor="tarjeta">Tarjeta</label>

        <select
          id="tarjeta"
          value={form.tarjeta_id}
          onChange={(e) =>
            setForm({ ...form, tarjeta_id: e.target.value })
          }
        >
          {tarjetas.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nombre}
            </option>
          ))}
        </select>
      </div>
    </div>

    <div className="modern-field">
      <label htmlFor="descripcion">
        Descripción
        <span>Opcional</span>
      </label>

      <input
        id="descripcion"
        type="text"
        placeholder="Ej. almuerzo, gasolina, supermercado..."
        value={form.descripcion}
        onChange={(e) =>
          setForm({ ...form, descripcion: e.target.value })
        }
      />
    </div>

    {error && (
      <div className="expense-form-error">
        {error}
      </div>
    )}

    <button className="expense-submit" type="submit">
      <Plus size={18} />
      Registrar gasto
    </button>
  </form>
</section>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 10,
          }}
        >
          <p className="lista-titulo" style={{ marginBottom: 0 }}>
            Gastos del mes
          </p>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <select
              value={rangoExport}
              onChange={(e) => setRangoExport(e.target.value)}
              style={{ width: "auto", fontSize: 12, padding: "6px 8px" }}
            >
              <option value="dia">Hoy</option>
              <option value="semana">Últimos 7 días</option>
              <option value="mes">
                {NOMBRES_MES[periodo.mes - 1]} {periodo.anio}
              </option>
            </select>
            <button
              className="icon-btn"
              onClick={handleExport}
              disabled={exportando}
              title="Descargar CSV"
            >
              <Download size={16} />
            </button>
          </div>
        </div>
        {gastos.length === 0 ? (
          <p className="vacio">Todavía no registras gastos este mes.</p>
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
                    </span>
                    {g.descripcion && <span className="desc">{g.descripcion}</span>}
                  </div>
                  <div className="acciones">
                    <span className="monto">${Number(g.monto).toFixed(2)}</span>
                    <button className="mini-btn peligro" onClick={() => handleDelete(g.id)} title="Quitar">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      )}
      {currentView === "tarjetas" &&
    renderPlaceholder(
      "Mis tarjetas",
      "Administra tus tarjetas, días de corte y configuración."
    )}

  {currentView === "movimientos" &&
    renderPlaceholder(
      "Movimientos",
      "Consulta, registra y administra todos tus gastos."
    )}

  {currentView === "analisis" &&
    renderPlaceholder(
      "Análisis",
      "Aquí veremos cómo se distribuyen y evolucionan tus gastos."
    )}
    </AppLayout>
    </>
  );
}
