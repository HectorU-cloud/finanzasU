import { useState, useEffect, useCallback } from "react";
import {
  ChevronDown,
  Users,
  Plus,
  Copy,
  ArrowLeft,
  Check,
  ReceiptText,
} from "lucide-react";
import { api } from "./api.js";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function GruposPanel() {
  const [abierto, setAbierto] = useState(false);
  const [grupos, setGrupos] = useState([]);
  const [grupoActivo, setGrupoActivo] = useState(null); // objeto grupo o null
  const [nombreNuevo, setNombreNuevo] = useState("");
  const [codigoUnirse, setCodigoUnirse] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  const cargarGrupos = useCallback(async () => {
    const data = await api.getGrupos();
    setGrupos(data);
    return data;
  }, []);

  useEffect(() => {
    if (abierto) cargarGrupos().catch((e) => setError(e.message));
  }, [abierto, cargarGrupos]);

  async function crearGrupo(e) {
    e.preventDefault();
    if (!nombreNuevo.trim()) return;
    setError("");
    setCargando(true);
    try {
      const nuevo = await api.crearGrupo(nombreNuevo.trim());
      setNombreNuevo("");
      await cargarGrupos();
      setGrupoActivo(nuevo);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  async function unirseGrupo(e) {
    e.preventDefault();
    if (!codigoUnirse.trim()) return;
    setError("");
    setCargando(true);
    try {
      const grupo = await api.unirseGrupo(codigoUnirse.trim());
      setCodigoUnirse("");
      await cargarGrupos();
      setGrupoActivo(grupo);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="panel">
      <div className="panel-header" onClick={() => setAbierto((a) => !a)}>
        <span className="titulo">
          <Users size={16} />
          Grupos compartidos
        </span>
        <ChevronDown size={18} className={"chevron" + (abierto ? " abierto" : "")} />
      </div>

      {abierto && (
        <div className="panel-body">
          {grupoActivo ? (
            <DetalleGrupo
              grupo={grupoActivo}
              onVolver={() => setGrupoActivo(null)}
              onError={setError}
            />
          ) : (
            <>
              {grupos.length === 0 ? (
                <p className="vacio" style={{ padding: "8px 0" }}>
                  Todavía no perteneces a ningún grupo.
                </p>
              ) : (
                <div className="grupos-lista">
                  {grupos.map((g) => (
                    <button key={g.id} className="grupo-item" onClick={() => setGrupoActivo(g)}>
                      <span>{g.nombre}</span>
                      <span className="grupo-item-meta">{g.miembros.length} miembro(s)</span>
                    </button>
                  ))}
                </div>
              )}

              <div className="grupos-formularios">
                <form onSubmit={crearGrupo} className="agregar-tarjeta">
                  <input
                    type="text"
                    placeholder="Nombre del nuevo grupo"
                    value={nombreNuevo}
                    onChange={(e) => setNombreNuevo(e.target.value)}
                  />
                  <button type="submit" className="mini-btn" disabled={cargando} title="Crear grupo">
                    <Plus size={18} />
                  </button>
                </form>
                <form onSubmit={unirseGrupo} className="agregar-tarjeta">
                  <input
                    type="text"
                    placeholder="Código de invitación"
                    value={codigoUnirse}
                    onChange={(e) => setCodigoUnirse(e.target.value)}
                  />
                  <button type="submit" className="mini-btn" disabled={cargando} title="Unirme">
                    <Check size={18} />
                  </button>
                </form>
              </div>
            </>
          )}
          {error && <p className="error">{error}</p>}
        </div>
      )}
    </div>
  );
}

function DetalleGrupo({ grupo, onVolver, onError }) {
  const [saldos, setSaldos] = useState([]);
  const [gastos, setGastos] = useState([]);
  const [copiado, setCopiado] = useState(false);
  const [form, setForm] = useState({ fecha: todayISO(), monto: "", descripcion: "" });
  const [error, setError] = useState("");

  const cargar = useCallback(async () => {
    const [s, g] = await Promise.all([
      api.getSaldosGrupo(grupo.id),
      api.getGastosGrupo(grupo.id),
    ]);
    setSaldos(s);
    setGastos(g);
  }, [grupo.id]);

  useEffect(() => {
    cargar().catch((e) => onError(e.message));
  }, [cargar, onError]);

  function nombreDe(usuarioId) {
    return grupo.miembros.find((m) => m.usuario_id === usuarioId)?.usuario.nombre || "—";
  }

  async function copiarCodigo() {
    try {
      await navigator.clipboard.writeText(grupo.codigo_invitacion);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1500);
    } catch {
      // el navegador puede bloquear el portapapeles; no es crítico
    }
  }

  async function agregarGasto(e) {
    e.preventDefault();
    const monto = Number(form.monto);
    if (!form.fecha || !monto || monto <= 0) {
      setError("Completa fecha y un monto válido.");
      return;
    }
    setError("");
    try {
      await api.crearGastoCompartido({
        grupo_id: grupo.id,
        fecha: form.fecha,
        monto,
        descripcion: form.descripcion || null,
      });
      setForm({ fecha: todayISO(), monto: "", descripcion: "" });
      await cargar();
    } catch (err) {
      setError(err.message);
    }
  }

  async function marcarPagado(divisionId) {
    try {
      await api.marcarDivisionPagada(divisionId);
      await cargar();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <button className="volver-grupos" onClick={onVolver}>
        <ArrowLeft size={14} /> Todos los grupos
      </button>

      <div className="grupo-encabezado">
        <h3>{grupo.nombre}</h3>
        <button className="codigo-invitacion" onClick={copiarCodigo} title="Copiar código">
          {copiado ? <Check size={13} /> : <Copy size={13} />}
          {grupo.codigo_invitacion}
        </button>
      </div>

      <p className="corte-label" style={{ marginBottom: 10 }}>
        {grupo.miembros.map((m) => m.usuario.nombre).join(" · ")}
      </p>

      <div className="saldos-lista">
        {saldos.map((s) => (
          <div key={s.usuario_id} className="saldo-item">
            <span>{s.nombre}</span>
            <span className={Number(s.debe) < 0 ? "saldo-debe" : "saldo-favor"}>
              {Number(s.debe) < 0
                ? `debe $${Math.abs(s.debe).toFixed(2)}`
                : `le deben $${Number(s.debe).toFixed(2)}`}
            </span>
          </div>
        ))}
      </div>

      <form className="form-row" onSubmit={agregarGasto} style={{ marginTop: 14 }}>
        <div>
          <label>Fecha</label>
          <input
            type="date"
            value={form.fecha}
            onChange={(e) => setForm({ ...form, fecha: e.target.value })}
          />
        </div>
        <div>
          <label>Monto (se reparte en partes iguales)</label>
          <input
            type="number"
            step="0.01"
            placeholder="0.00"
            value={form.monto}
            onChange={(e) => setForm({ ...form, monto: e.target.value })}
          />
        </div>
      </form>
      <div style={{ marginBottom: 10 }}>
        <label>Descripción (opcional)</label>
        <input
          type="text"
          placeholder="ej. mercado"
          value={form.descripcion}
          onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
        />
      </div>
      {error && <p className="error">{error}</p>}
      <button className="submit" onClick={agregarGasto} type="button" style={{ marginBottom: 16 }}>
        <ReceiptText size={15} />
        Agregar gasto compartido
      </button>

      <p className="lista-titulo">Gastos del grupo</p>
      {gastos.length === 0 ? (
        <p className="vacio">Todavía no hay gastos compartidos.</p>
      ) : (
        <ul className="gastos">
          {gastos.map((g) => (
            <li key={g.id} style={{ flexDirection: "column", alignItems: "stretch", gap: 6 }}>
              <div className="detalle" style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <span className="linea1">
                  {g.fecha}
                  <span className="sep">·</span>
                  pagó {nombreDe(g.pagado_por_id)}
                </span>
                <span className="monto">${Number(g.monto).toFixed(2)}</span>
              </div>
              {g.descripcion && <span className="desc">{g.descripcion}</span>}
              <div className="divisiones-lista">
                {g.divisiones.map((d) => (
                  <span key={d.id} className={"division-chip" + (d.pagado ? " pagada" : "")}>
                    {nombreDe(d.usuario_id)}: ${Number(d.monto).toFixed(2)}
                    {!d.pagado && (
                      <button onClick={() => marcarPagado(d.id)} title="Marcar como pagado">
                        <Check size={11} />
                      </button>
                    )}
                  </span>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
