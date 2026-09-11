import { useState } from "react";
import { KeyRound, X } from "lucide-react";
import { api } from "./api.js";

export default function CambiarPasswordModal({ onCerrar }) {
  const [form, setForm] = useState({ actual: "", nueva: "", confirmar: "" });
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  const [exito, setExito] = useState(false);

  async function handleSubmit(e) {
    <form onSubmit={handleSubmit} className="auth-form" onKeyDown={(e) => {
  if (e.key === "Escape") onCerrar();
}}>
    e.preventDefault();
    setError("");
    if (!form.actual || !form.nueva) {
      setError("Completa todos los campos.");
      return;
    }
    if (form.nueva.length < 6) {
      setError("La nueva contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (form.nueva !== form.confirmar) {
      setError("Las contraseñas nuevas no coinciden.");
      return;
    }
    setCargando(true);
    try {
      await api.cambiarPassword({
        password_actual: form.actual,
        password_nueva: form.nueva,
      });
      setExito(true);
      setTimeout(onCerrar, 1500);
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
          <h3>
            <KeyRound size={16} /> Cambiar contraseña
          </h3>
          <button className="mini-btn" onClick={onCerrar} title="Cerrar">
            <X size={16} />
          </button>
        </div>
        {exito ? (
          <p style={{ color: "var(--accent)", fontSize: 14, margin: "20px 0" }}>
            ✅ Contraseña actualizada correctamente.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="auth-form">
            <div>
              <label>Contraseña actual</label>
              <input
                type="password"
                value={form.actual}
                onChange={(e) => setForm({ ...form, actual: e.target.value })}
              />
            </div>
            <div>
              <label>Nueva contraseña</label>
              <input
                type="password"
                value={form.nueva}
                onChange={(e) => setForm({ ...form, nueva: e.target.value })}
              />
            </div>
            <div>
              <label>Confirmar nueva contraseña</label>
              <input
                type="password"
                value={form.confirmar}
                onChange={(e) => setForm({ ...form, confirmar: e.target.value })}
              />
            </div>
            {error && <p className="error">{error}</p>}
            <button className="submit" type="submit" disabled={cargando} style={{ width: "100%", justifyContent: "center" }}>
              {cargando ? "Guardando..." : "Cambiar contraseña"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
