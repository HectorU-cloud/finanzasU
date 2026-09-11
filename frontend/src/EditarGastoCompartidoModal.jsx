import { useState } from "react";
import { Pencil, X } from "lucide-react";
import { api } from "./api.js";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function EditarGastoCompartidoModal({
  grupoId,
  gasto,
  categorias,
  onCerrar,
  onGuardado,
}) {
  const [form, setForm] = useState({
    fecha: gasto.fecha,
    monto: gasto.monto,
    descripcion: gasto.descripcion || "",
    categoria: gasto.categoria || "",
  });
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    const montoNum = Number(form.monto);
    if (!form.fecha || !montoNum || montoNum <= 0) {
      setError("Completa fecha y un monto válido.");
      return;
    }
    if (form.fecha > todayISO()) {
      setError("La fecha no puede ser futura.");
      return;
    }
    setCargando(true);
    try {
      await api.actualizarGastoCompartido(grupoId, gasto.id, {
        fecha: form.fecha,
        monto: montoNum,
        descripcion: form.descripcion || null,
        categoria: form.categoria || null,
      });
      onGuardado();
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onCerrar}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3><Pencil size={16} /> Editar gasto compartido</h3>
          <button className="mini-btn" onClick={onCerrar} title="Cerrar">
            <X size={16} />
          </button>
        </div>
        <form
          onSubmit={handleSubmit}
          className="auth-form"
          onKeyDown={(e) => {
            if (e.key === "Escape") onCerrar();
          }}
        >
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
            <label>Monto total</label>
            <input
              type="number"
              step="0.01"
              value={form.monto}
              onChange={(e) => setForm({ ...form, monto: e.target.value })}
            />
            <p style={{ fontSize: 11, color: "var(--ink-faint)", marginTop: 4 }}>
              Si cambias el monto, las divisiones se recalculan equitativamente.
            </p>
          </div>
          <div>
            <label>Categoría (opcional)</label>
            <select
              value={form.categoria}
              onChange={(e) => setForm({ ...form, categoria: e.target.value })}
            >
              <option value="">Sin categoría</option>
              {categorias.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label>Descripción (opcional)</label>
            <input
              type="text"
              value={form.descripcion}
              onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
            />
          </div>
          {error && <p className="error">{error}</p>}
          <button
            className="submit"
            type="submit"
            disabled={cargando}
            style={{ width: "100%", justifyContent: "center" }}
          >
            {cargando ? "Guardando..." : "Guardar cambios"}
          </button>
        </form>
      </div>
    </div>
  );
}
