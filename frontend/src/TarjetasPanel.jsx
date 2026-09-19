import { useState, useEffect } from "react";
import { ChevronDown, CreditCard, Pencil, Trash2, Check, X, Plus, MoreVertical } from "lucide-react";
import { api } from "./api.js";
import ConfirmModal from "./ConfirmModal.jsx";
import CardNetworkLogo from "./CardNetworkLogo.jsx";

const TEMAS = [
  { valor: "clasico", nombre: "Clásico (oscuro)" },
  { valor: "amex-verde", nombre: "Amex verde" },
  { valor: "visa-gold", nombre: "Visa Gold" },
  { valor: "mastercard-azul", nombre: "Mastercard azul" },
  { valor: "diners-marron", nombre: "Diners marrón" },
  { valor: "negro-premium", nombre: "Negro Premium" },
  { valor: "morado-moderno", nombre: "Morado moderno" },
];

const REDES = ["Visa", "Mastercard", "American Express", "Diners Club", "Otra"];

export default function TarjetasPanel({ tarjetas = [], onChange, abierto, onToggle }) {
  const [editandoId, setEditandoId] = useState(null);
  const [borrador, setBorrador] = useState({
    nombre: "",
    dia_corte: "",
    dia_pago: "",
    red: REDES[0],
    tema: "clasico",
  });
  const [nueva, setNueva] = useState({
    nombre: "",
    dia_corte: "",
    dia_pago: "",
    red: REDES[0],
    tema: "clasico",
  });
  const [error, setError] = useState("");
  const [menuAbiertoId, setMenuAbiertoId] = useState(null);
  const [tarjetaAEliminar, setTarjetaAEliminar] = useState(null);
  const [enviando, setEnviando] = useState(false);

  // Cerrar el menú al hacer clic fuera
  useEffect(() => {
    function cerrarSiEsFuera(e) {
      if (!e.target.closest(".acciones-menu")) {
        setMenuAbiertoId(null);
      }
    }
    document.addEventListener("click", cerrarSiEsFuera);
    return () => document.removeEventListener("click", cerrarSiEsFuera);
  }, []);

  function empezarEdicion(t) {
    setEditandoId(t.id);
    setBorrador({
      nombre: t.nombre,
      dia_corte: t.dia_corte,
      dia_pago: t.dia_pago || "",
      red: t.red || REDES[0],
      tema: t.tema || "clasico",
    });
    setError("");
    setMenuAbiertoId(null);
  }

  async function guardarEdicion(id) {
    const dia = Number(borrador.dia_corte);
    if (!borrador.nombre.trim() || !dia || dia < 1 || dia > 31) {
      setError("Nombre y día de corte (1-31) son obligatorios.");
      return;
    }
    const diaPagoNum = Number(borrador.dia_pago);
    if (borrador.dia_pago && (isNaN(diaPagoNum) || diaPagoNum < 1 || diaPagoNum > 31)) {
      setError("El día de pago debe estar entre 1 y 31.");
      return;
    }
    setError("");
    try {
      await api.actualizarTarjeta(id, {
        nombre: borrador.nombre.trim(),
        dia_corte: dia,
        dia_pago: diaPagoNum || null,
        red: borrador.red,
        tema: borrador.tema,
      });
      setEditandoId(null);
      onChange();
    } catch (err) {
      setError(err.message);
    }
  }

  async function confirmarEliminar() {
    if (!tarjetaAEliminar) return;
    try {
      await api.eliminarTarjeta(tarjetaAEliminar.id);
      setTarjetaAEliminar(null);
      onChange();
    } catch (err) {
      setError(err.message);
      setTarjetaAEliminar(null);
    }
  }

  async function agregar(e) {
    e.preventDefault();
    if (enviando) return;
    const dia = Number(nueva.dia_corte);
    if (!nueva.nombre.trim() || !dia || dia < 1 || dia > 31) {
      setError("Nombre y día de corte (1-31) son obligatorios.");
      return;
    }
    const diaPagoNum = Number(nueva.dia_pago);
    if (nueva.dia_pago && (isNaN(diaPagoNum) || diaPagoNum < 1 || diaPagoNum > 31)) {
      setError("El día de pago debe estar entre 1 y 31.");
      return;
    }
    setError("");
    setEnviando(true);
    try {
      await api.crearTarjeta({
        nombre: nueva.nombre.trim(),
        dia_corte: dia,
        dia_pago: diaPagoNum || null,
        red: nueva.red,
        tema: nueva.tema,
      });
      setNueva({ nombre: "", dia_corte: "", dia_pago: "", red: REDES[0], tema: "clasico" });
      onChange();
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="panel" id="panel-tarjetas">
      <div className="panel-header" onClick={() => onToggle(!abierto)}>
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
                  <span className="corte-label">Pago día</span>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    placeholder="—"
                    value={borrador.dia_pago}
                    onChange={(e) => setBorrador({ ...borrador, dia_pago: e.target.value })}
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
                  <select
                    value={borrador.tema}
                    onChange={(e) => setBorrador({ ...borrador, tema: e.target.value })}
                    style={{ width: "auto" }}
                    title="Estilo de tarjeta"
                  >
                    {TEMAS.map((t) => (
                      <option key={t.valor} value={t.valor}>{t.nombre}</option>
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
                  <span className="corte-label" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    {t.red && <CardNetworkLogo red={t.red} size={18} color="var(--ink-soft)" />}
                    <span>
                      corte {t.dia_corte}
                      {t.dia_pago ? ` · pago ${t.dia_pago}` : ""}
                    </span>
                  </span>
                  <div className="acciones-menu">
                    <button
                      className="mini-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuAbiertoId(menuAbiertoId === t.id ? null : t.id);
                      }}
                      title="Más opciones"
                    >
                      <MoreVertical size={16} />
                    </button>
                    {menuAbiertoId === t.id && (
                      <div className="dropdown-menu">
                        <button onClick={() => empezarEdicion(t)}>
                          <Pencil size={14} /> Editar
                        </button>
                        <button
                          className="peligro"
                          onClick={() => {
                            setTarjetaAEliminar(t);
                            setMenuAbiertoId(null);
                          }}
                        >
                          <Trash2 size={14} /> Eliminar
                        </button>
                      </div>
                    )}
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
            <input
              type="number"
              min="1"
              max="31"
              placeholder="Pago"
              value={nueva.dia_pago}
              onChange={(e) => setNueva({ ...nueva, dia_pago: e.target.value })}
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
            <select
              value={nueva.tema}
              onChange={(e) => setNueva({ ...nueva, tema: e.target.value })}
              style={{ width: "auto" }}
              title="Estilo de tarjeta"
            >
              {TEMAS.map((t) => (
                <option key={t.valor} value={t.valor}>{t.nombre}</option>
              ))}
            </select>
            <button type="submit" className="mini-btn" title="Agregar tarjeta" disabled={enviando}>
              <Plus size={18} />
            </button>
          </form>
          {error && <p className="error">{error}</p>}
        </div>
      )}

      {tarjetaAEliminar && (
        <ConfirmModal
          titulo="Eliminar tarjeta"
          mensaje={`¿Eliminar "${tarjetaAEliminar.nombre}"? Esto también borra todos sus gastos registrados. Esta acción no se puede deshacer.`}
          textoConfirmar="Sí, eliminar"
          onConfirmar={confirmarEliminar}
          onCancelar={() => setTarjetaAEliminar(null)}
        />
      )}
    </div>
  );
}