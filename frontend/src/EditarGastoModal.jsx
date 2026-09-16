import { useState } from "react";
import { Pencil, X } from "lucide-react";
import { api } from "./api.js";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function EditarGastoModal({ gasto, tarjetas, categorias, onCerrar, onGuardado }) {
  const [form, setForm] = useState({
    fecha: gasto.fecha,
    tarjeta_id: gasto.tarjeta_id,
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
      await api.actualizarGasto(gasto.id, {
        fecha: form.fecha,
        tarjeta_id: Number(form.tarjeta_id),
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
          <h3><Pencil size={16} /> Editar gasto</h3>
          <button className="mini-btn" onClick={onCerrar} title="Cerrar">
            <X size={16} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="auth-form" onKeyDown={(e) => {
          if (e.key === "Escape") onCerrar();
        }}>
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
                <option key={t.id} value={t.id}>{t.nombre}</option>
              ))}
            </select>
          </div>
          <div>
            <label>Monto</label>
            <input
              type="number"
              step="0.01"
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
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label>Descripción</label>
            <input
              type="text"
              value={form.descripcion}
              onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
            />
          </div>
          {error && <p className="error">{error}</p>}
          <button className="submit" type="submit" disabled={cargando} style={{ width: "100%", justifyContent: "center" }}>
            {cargando ? "Guardando..." : "Guardar cambios"}
          </button>
        </form>
      </div>
    </div>
  );
}
