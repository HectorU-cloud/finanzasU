import { useState, useEffect, useCallback } from "react";
import { Wallet, PiggyBank, Plus, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { api } from "./api.js";
import TarjetasPanel from "./TarjetasPanel.jsx";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

const NOMBRES_MES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

export default function App() {
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

  useEffect(() => {
    cargarDatos().catch((e) => setError(e.message));
  }, [cargarDatos]);

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
      setError(err.message);
    }
  }

  async function handleDelete(id) {
    try {
      await api.eliminarGasto(id);
      await cargarDatos();
    } catch (err) {
      setError(err.message);
    }
  }

  const enRojo = resumen?.en_rojo ?? false;

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <span className="brand-icon">
            <Wallet size={18} />
          </span>
          <div>
            <h1>Control de gastos</h1>
            <p className="periodo">
              {NOMBRES_MES[periodo.mes - 1]} de {periodo.anio}
              {esMesActual && " · actual"}
            </p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button className="icon-btn" onClick={() => cambiarMes(-1)} title="Mes anterior">
            <ChevronLeft size={18} />
          </button>
          <button className="icon-btn" onClick={() => cambiarMes(1)} title="Mes siguiente">
            <ChevronRight size={18} />
          </button>
        </div>
      </header>

      <div className="cards">
        {resumen?.tarjetas.map((t) => (
          <div key={t.id} className={"card" + (t.en_rojo ? " rojo" : "")}>
            <div className="row-top">
              <span className="label">{t.nombre}</span>
              <span className="badge">{t.en_rojo ? "Excedido" : "Al día"}</span>
            </div>
            <p className="monto">${Number(t.gastado_mes).toFixed(2)}</p>
            <p className="corte">
              Corte día {t.dia_corte} · faltan {t.dias_para_corte} días
            </p>
          </div>
        ))}
      </div>

      <div className={"total-bar" + (enRojo ? " rojo" : "")}>
        <div>
          <div className="titulo">Total del mes (ambas tarjetas)</div>
        </div>
        <div className="monto">
          ${Number(resumen?.total_mes ?? 0).toFixed(2)}{" "}
          <span className="limite">/ ${Number(resumen?.limite ?? 350)}</span>
        </div>
      </div>

      <TarjetasPanel tarjetas={tarjetas} onChange={cargarDatos} />

      <div className="panel">
        <form className="gasto-form" onSubmit={handleSubmit}>
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

      <p className="lista-titulo">Gastos del mes</p>
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
  );
}
