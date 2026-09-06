import { useState, useEffect, useCallback } from "react";
import { api } from "./api.js";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function App() {
  const now = new Date();
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
      api.getGastos(now.getFullYear(), now.getMonth() + 1),
      api.getResumen(now.getFullYear(), now.getMonth() + 1),
    ]);
    setTarjetas(tarjetasData);
    setGastos(gastosData);
    setResumen(resumenData);
    setForm((f) => ({ ...f, tarjeta_id: f.tarjeta_id || tarjetasData[0]?.id || "" }));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    cargarDatos().catch((e) => setError(e.message));
  }, [cargarDatos]);

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
      <header>
        <h1>Control de gastos</h1>
        <p>{now.toLocaleString("es-EC", { month: "long", year: "numeric" })}</p>
      </header>

      <div className="cards">
        {resumen?.tarjetas.map((t) => (
          <div key={t.id} className={"card" + (t.en_rojo ? " rojo" : "")}>
            <p className="label">{t.nombre}</p>
            <p className="monto">${Number(t.gastado_mes).toFixed(2)}</p>
            <p className="corte">
              Corte día {t.dia_corte} · faltan {t.dias_para_corte} días
            </p>
          </div>
        ))}
      </div>

      <div className={"total-bar" + (enRojo ? " rojo" : "")}>
        <span>Total del mes (ambas tarjetas)</span>
        <span className="monto">
          ${Number(resumen?.total_mes ?? 0).toFixed(2)} / ${Number(resumen?.limite ?? 350)}
        </span>
      </div>

      <form className="gasto-form" onSubmit={handleSubmit}>
        <p className="titulo">Registrar gasto</p>
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
          Agregar gasto
        </button>
      </form>

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
                  <span className="fecha">{g.fecha}</span>
                  <span className="sep">·</span>
                  <span className="tarjeta">{tarjeta?.nombre}</span>
                  {g.descripcion && <span className="desc"> — {g.descripcion}</span>}
                </div>
                <div className="acciones">
                  <span className="monto">${Number(g.monto).toFixed(2)}</span>
                  <button onClick={() => handleDelete(g.id)}>quitar</button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
