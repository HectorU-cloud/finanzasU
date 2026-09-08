import { useState } from "react";
import { ChevronDown, CreditCard, Pencil, Trash2, Check, X, Plus } from "lucide-react";
import { api } from "./api.js";

const REDES = ["Visa", "Mastercard", "American Express", "Diners Club", "Otra"];

export default function TarjetasPanel({ tarjetas = [], onChange }) {
  const [abierto, setAbierto] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [borrador, setBorrador] = useState({ nombre: "", dia_corte: "", red: REDES[0] });
  const [nueva, setNueva] = useState({ nombre: "", dia_corte: "", red: REDES[0] });
  const [error, setError] = useState("");

  function empezarEdicion(t) {
    setEditandoId(t.id);
    setBorrador({ nombre: t.nombre, dia_corte: t.dia_corte, red: t.red || REDES[0] });
    setError("");
  }

  async function guardarEdicion(id) {
    const dia = Number(borrador.dia_corte);
    if (!borrador.nombre.trim() || !dia || dia < 1 || dia > 31) {
      setError("Nombre y día de corte (1-31) son obligatorios.");
      return;
    }
    setError("");
    try {
      await api.actualizarTarjeta(id, {
        nombre: borrador.nombre.trim(),
        dia_corte: dia,
        red: borrador.red,
      });
      setEditandoId(null);
      onChange();
    } catch (err) {
      setError(err.message);
    }
  }

  async function eliminar(id, nombre) {
    const ok = window.confirm(
      `¿Eliminar "${nombre}"? Esto también borra todos sus gastos registrados. Esta acción no se puede deshacer.`
    );
    if (!ok) return;
    try {
      await api.eliminarTarjeta(id);
      onChange();
    } catch (err) {
      setError(err.message);
    }
  }

  async function agregar(e) {
    e.preventDefault();
    const dia = Number(nueva.dia_corte);
    if (!nueva.nombre.trim() || !dia || dia < 1 || dia > 31) {
      setError("Nombre y día de corte (1-31) son obligatorios.");
      return;
    }
    setError("");
    try {
      await api.crearTarjeta({ nombre: nueva.nombre.trim(), dia_corte: dia, red: nueva.red });
      setNueva({ nombre: "", dia_corte: "", red: REDES[0] });
      onChange();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="panel">
      <div className="panel-header" onClick={() => setAbierto((a) => !a)}>
        <span className="titulo">
          <CreditCard size={16} />
          Gestionar tarjetas
        </span>
        <ChevronDown size={18} className={"chevron" + (abierto ? " abierto" : "")} />
      </div>

      {abierto && (
        <div className="panel-body">
          {tarjetas.map((t) => (
            <div className="tarjeta-row" key={t.id}>
              {editandoId === t.id ? (
                <>
                  <input
                    type="text"
                    value={borrador.nombre}
                    onChange={(e) => setBorrador({ ...borrador, nombre: e.target.value })}
                  />
                  <span className="corte-label">Corte día</span>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={borrador.dia_corte}
                    onChange={(e) => setBorrador({ ...borrador, dia_corte: e.target.value })}
                  />
                  <select
                    value={borrador.red}
                    onChange={(e) => setBorrador({ ...borrador, red: e.target.value })}
                    style={{ width: "auto" }}
                  >
                    {REDES.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                  <div className="acciones-tarjeta">
                    <button className="mini-btn" onClick={() => guardarEdicion(t.id)} title="Guardar">
                      <Check size={16} />
                    </button>
                    <button className="mini-btn" onClick={() => setEditandoId(null)} title="Cancelar">
                      <X size={16} />
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <span style={{ flex: 1, fontSize: 14 }}>{t.nombre}</span>
                  <span className="corte-label">{t.red || "Sin red"} · corte día {t.dia_corte}</span>
                  <div className="acciones-tarjeta">
                    <button className="mini-btn" onClick={() => empezarEdicion(t)} title="Editar">
                      <Pencil size={15} />
                    </button>
                    <button
                      className="mini-btn peligro"
                      onClick={() => eliminar(t.id, t.nombre)}
                      title="Eliminar (borra también sus gastos)"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}

          <form className="agregar-tarjeta" onSubmit={agregar}>
            <input
              type="text"
              placeholder="Nombre de la nueva tarjeta"
              value={nueva.nombre}
              onChange={(e) => setNueva({ ...nueva, nombre: e.target.value })}
            />
            <input
              type="number"
              min="1"
              max="31"
              placeholder="Corte"
              value={nueva.dia_corte}
              onChange={(e) => setNueva({ ...nueva, dia_corte: e.target.value })}
            />
            <select
              value={nueva.red}
              onChange={(e) => setNueva({ ...nueva, red: e.target.value })}
              style={{ width: "auto" }}
            >
              {REDES.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <button type="submit" className="mini-btn" title="Agregar tarjeta">
              <Plus size={18} />
            </button>
          </form>
          {error && <p className="error">{error}</p>}
        </div>
      )}
    </div>
  );
}
