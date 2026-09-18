import { useState } from "react";
import { KeyRound, X, Eye, EyeOff } from "lucide-react";
import { api } from "./api.js";

export default function CambiarPasswordModal({ onCerrar, onExito }) {
  const [form, setForm] = useState({ actual: "", nueva: "", confirmar: "" });
  const [error, setError] = useState("");
  const [mostrarActual, setMostrarActual] = useState(false);
  const [mostrarNueva, setMostrarNueva] = useState(false);
  const [mostrarConfirmar, setMostrarConfirmar] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [exito, setExito] = useState(false);

  async function handleSubmit(e) {
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
      setTimeout(onExito, 1500);
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
            ✅ Contraseña actualizada. Cerrando sesión para que ingreses con la nueva...
          </p>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="auth-form"
            onKeyDown={(e) => {
              if (e.key === "Escape") onCerrar();
            }}
          >
            <div>
              <label>Contraseña actual</label>
              <div className="relative">
                <input
                  type={mostrarActual ? "text" : "password"}
                  value={form.actual}
                  onChange={(e) => setForm({ ...form, actual: e.target.value })}
                  className="w-full px-3 py-2.5 pr-10 rounded-xl border border-gray-200 focus:border-coral focus:outline-none text-sm"
                />
                <button
                  type="button"
                  onClick={() => setMostrarActual(!mostrarActual)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-coral transition-colors"
                  tabIndex={-1}
                >
                  {mostrarActual ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div>
              <label>Nueva contraseña</label>
              <div className="relative">
                <input
                  type={mostrarNueva ? "text" : "password"}
                  value={form.nueva}
                  onChange={(e) => setForm({ ...form, nueva: e.target.value })}
                  className="w-full px-3 py-2.5 pr-10 rounded-xl border border-gray-200 focus:border-coral focus:outline-none text-sm"
                />
                <button
                  type="button"
                  onClick={() => setMostrarNueva(!mostrarNueva)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-coral transition-colors"
                  tabIndex={-1}
                >
                  {mostrarNueva ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div>
              <label>Confirmar nueva contraseña</label>
              <div className="relative">
                <input
                  type={mostrarConfirmar ? "text" : "password"}
                  value={form.confirmar}
                  onChange={(e) => setForm({ ...form, confirmar: e.target.value })}
                  className="w-full px-3 py-2.5 pr-10 rounded-xl border border-gray-200 focus:border-coral focus:outline-none text-sm"
                />
                <button
                  type="button"
                  onClick={() => setMostrarConfirmar(!mostrarConfirmar)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-coral transition-colors"
                  tabIndex={-1}
                >
                  {mostrarConfirmar ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            {error && <p className="error">{error}</p>}
            <button
              className="submit"
              type="submit"
              disabled={cargando}
              style={{ width: "100%", justifyContent: "center" }}
            >
              {cargando ? "Guardando..." : "Cambiar contraseña"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}