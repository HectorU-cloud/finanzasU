import { useState } from "react";
import { api, setAuthToken } from "./api.js";

export default function AuthScreen({ onAutenticado }) {
  const [modo, setModo] = useState("login"); // "login" | "registro"
  const [form, setForm] = useState({ nombre: "", email: "", password: "" });
  const [confirmar, setConfirmar] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  function validar() {
    if (!form.email.trim() || !form.password) {
      return "Correo y contraseña son obligatorios.";
    }
    if (modo === "registro") {
      if (!form.nombre.trim()) return "Escribe tu nombre.";
      if (form.password.length < 6) return "La contraseña debe tener al menos 6 caracteres.";
      if (form.password !== confirmar) return "Las contraseñas no coinciden.";
    }
    return "";
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const mensaje = validar();
    if (mensaje) {
      setError(mensaje);
      return;
    }
    setError("");
    setCargando(true);
    try {
      const datos =
        modo === "registro"
          ? await api.registro({ nombre: form.nombre.trim(), email: form.email.trim(), password: form.password })
          : await api.login({ email: form.email.trim(), password: form.password });
      setAuthToken(datos.access_token);
      onAutenticado(datos.usuario);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  function cambiarModo(nuevoModo) {
    setModo(nuevoModo);
    setError("");
    setConfirmar("");
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-brand">
          <h1>Control de gastos</h1>
          <p>Tus finanzas, sin depender de nadie más.</p>
        </div>

        <div className="auth-tabs">
          <button
            type="button"
            className={"auth-tab" + (modo === "login" ? " activo" : "")}
            onClick={() => cambiarModo("login")}
          >
            Iniciar sesión
          </button>
          <button
            type="button"
            className={"auth-tab" + (modo === "registro" ? " activo" : "")}
            onClick={() => cambiarModo("registro")}
          >
            Crear cuenta
          </button>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {modo === "registro" && (
            <div>
              <label>Nombre</label>
              <input
                type="text"
                placeholder="Tu nombre"
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              />
            </div>
          )}
          <div>
            <label>Correo</label>
            <input
              type="email"
              placeholder="tu@correo.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div>
            <label>Contraseña</label>
            <input
              type="password"
              placeholder={modo === "registro" ? "Mínimo 6 caracteres" : "Tu contraseña"}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>
          {modo === "registro" && (
            <div>
              <label>Confirmar contraseña</label>
              <input
                type="password"
                placeholder="Repite tu contraseña"
                value={confirmar}
                onChange={(e) => setConfirmar(e.target.value)}
              />
            </div>
          )}

          {error && <p className="error">{error}</p>}

          <button className="submit" type="submit" disabled={cargando} style={{ width: "100%", justifyContent: "center" }}>
            {cargando ? "Un momento..." : modo === "registro" ? "Crear cuenta" : "Entrar"}
          </button>
        </form>

        {modo === "login" ? (
          <p className="auth-switch">
            ¿No tienes cuenta?{" "}
            <button type="button" onClick={() => cambiarModo("registro")}>
              Regístrate
            </button>
          </p>
        ) : (
          <p className="auth-switch">
            ¿Ya tienes cuenta?{" "}
            <button type="button" onClick={() => cambiarModo("login")}>
              Inicia sesión
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
