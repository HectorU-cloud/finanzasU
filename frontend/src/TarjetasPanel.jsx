import { useState } from "react";
import { ChevronDown, CreditCard, Pencil, Trash2, Check, X, Plus } from "lucide-react";
import { api } from "./api.js";

export default function TarjetasPanel({ tarjetas, onChange }) {
  const [abierto, setAbierto] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [borrador, setBorrador] = useState({ nombre: "", dia_corte: "" });
  const [nueva, setNueva] = useState({ nombre: "", dia_corte: "" });
  const [error, setError] = useState("");

  function empezarEdicion(t) {
    setEditandoId(t.id);
    setBorrador({ nombre: t.nombre, dia_corte: t.dia_corte });
  }

  async function guardarEdicion(id) {
    const dia = Number(borrador.dia_corte);
    if (!borrador.nombre.trim() || !dia || dia < 1 || dia > 31) {
      setError("Nombre y día de corte (1-31) son obligatorios.");
      return;
    }
    setError("");
    await api.actualizarTarjeta(id, { nombre: borrador.nombre.trim(), dia_corte: dia });
    setEditandoId(null);
    onChange();
  }

  async function eliminar(id) {
    await api.eliminarTarjeta(id);
    onChange();
  }

  async function agregar(e) {
    e.preventDefault();
    const dia = Number(nueva.dia_corte);
    if (!nueva.nombre.trim() || !dia || dia < 1 || dia > 31) {
      setError("Nombre y día de corte (1-31) son obligatorios.");
      return;
    }
    setError("");
    await api.crearTarjeta({ nombre: nueva.nombre.trim(), dia_corte: dia });
    setNueva({ nombre: "", dia_corte: "" });
    onChange();
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
                  <span className="corte-label">Corte día {t.dia_corte}</span>
                  <div className="acciones-tarjeta">
                    <button className="mini-btn" onClick={() => empezarEdicion(t)} title="Editar">
                      <Pencil size={15} />
                    </button>
                    <button
                      className="mini-btn peligro"
                      onClick={() => eliminar(t.id)}
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
