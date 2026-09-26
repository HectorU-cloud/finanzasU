import { useEffect, useRef, useState } from "react";
import { api, setAuthToken } from "./api.js";
import { PiggyBank, Eye, EyeOff } from "lucide-react";

export default function AuthScreen({ onAutenticado, onSolicitarReset }) {
  const [modo, setModo] = useState("login");
  const [form, setForm] = useState({ nombre: "", email: "", password: "" });
  const [confirmar, setConfirmar] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [mostrarConfirmar, setMostrarConfirmar] = useState(false);
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const googleButtonRef = useRef(null);

  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId || !googleButtonRef.current) return;

    let cancelado = false;

    const inicializarGoogle = () => {
      if (cancelado || !window.google?.accounts?.id || !googleButtonRef.current) return;
      googleButtonRef.current.innerHTML = "";
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async (response) => {
          setError("");
          setCargando(true);
          try {
            const datos = await api.loginGoogle(response.credential);
            setAuthToken(datos.access_token);
            onAutenticado(datos.usuario);
          } catch (err) {
            setError(err.message);
          } finally {
            setCargando(false);
          }
        },
      });
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: "outline",
        size: "large",
        width: 320,
        text: "continue_with",
        shape: "pill",
        logo_alignment: "left",
      });
    };

    if (window.google?.accounts?.id) {
      inicializarGoogle();
    } else {
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.onload = inicializarGoogle;
      document.head.appendChild(script);
    }

    return () => {
      cancelado = true;
      if (googleButtonRef.current) googleButtonRef.current.innerHTML = "";
    };
  }, [onAutenticado]);

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
    <div className="min-h-screen bg-gradient-to-br from-[#FEFAF5] via-[#FFE5E2] to-[#FF4F40] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 mx-auto rounded-full bg-coral flex items-center justify-center shadow-2xl shadow-coral/40 mb-4">
            <PiggyBank size={38} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-carbon">Control de gastos</h1>
          <p className="text-sm text-gray-600 mt-1">Tus finanzas, sin depender de nadie más.</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-xl p-6">
          {/* Google */}
          {googleClientId && (
            <>
              <div className="mb-5 flex justify-center">
                <div ref={googleButtonRef} className="min-h-[40px]" aria-label="Continuar con Google" />
              </div>

              <div className="flex items-center gap-3 mb-5">
                <div className="h-px bg-gray-200 flex-1" />
                <span className="text-xs text-gray-400">o continúa con tu correo</span>
                <div className="h-px bg-gray-200 flex-1" />
              </div>
            </>
          )}

          {/* Tabs */}
          <div className="flex gap-4 mb-6 border-b border-gray-200">
            <button
              type="button"
              onClick={() => cambiarModo("login")}
              className={`pb-3 text-sm font-semibold transition-colors ${
                modo === "login"
                  ? "text-carbon border-b-2 border-coral"
                  : "text-gray-400"
              }`}
            >
              Iniciar sesión
            </button>
            <button
              type="button"
              onClick={() => cambiarModo("registro")}
              className={`pb-3 text-sm font-semibold transition-colors ${
                modo === "registro"
                  ? "text-carbon border-b-2 border-coral"
                  : "text-gray-400"
              }`}
            >
              Crear cuenta
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {modo === "registro" && (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">
                  Nombre
                </label>
                <input
                  type="text"
                  placeholder="Tu nombre"
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-coral focus:outline-none focus:ring-2 focus:ring-coral/20 text-sm transition-all"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">
                Correo
              </label>
              <input
                type="email"
                placeholder="tu@correo.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-coral focus:outline-none focus:ring-2 focus:ring-coral/20 text-sm transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">
                Contraseña
              </label>
              <div className="relative">
                <input
                  type={mostrarPassword ? "text" : "password"}
                  placeholder={modo === "registro" ? "Mínimo 6 caracteres" : "Tu contraseña"}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-coral focus:outline-none focus:ring-2 focus:ring-coral/20 text-sm transition-all"
                />
                <button
                  type="button"
                  onClick={() => setMostrarPassword(!mostrarPassword)}
                  className="absolute right-3 top-3 text-gray-400 hover:text-coral"
                >
                  {mostrarPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {modo === "registro" && (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">
                  Confirmar contraseña
                </label>
                <div className="relative">
                  <input
                    type={mostrarConfirmar ? "text" : "password"}
                    placeholder="Repite tu contraseña"
                    value={confirmar}
                    onChange={(e) => setConfirmar(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-coral focus:outline-none focus:ring-2 focus:ring-coral/20 text-sm transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarConfirmar(!mostrarConfirmar)}
                    className="absolute right-3 top-3 text-gray-400 hover:text-coral"
                  >
                    {mostrarConfirmar ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={cargando}
              className="w-full bg-coral text-white font-semibold py-3.5 rounded-xl hover:bg-coral-dark transition-all shadow-lg shadow-coral/30 disabled:opacity-60 disabled:shadow-none"
            >
              {cargando ? "Un momento..." : modo === "registro" ? "Crear cuenta" : "Entrar"}
            </button>

            {modo === "login" && onSolicitarReset && (
              <div className="text-center">
                <button
                  type="button"
                  onClick={onSolicitarReset}
                  className="text-xs text-gray-500 hover:text-coral font-medium transition-colors"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
            )}
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-gray-600 mt-6">
          {modo === "login" ? (
            <>
              ¿No tienes cuenta?{" "}
              <button
                type="button"
                onClick={() => cambiarModo("registro")}
                className="text-coral font-semibold"
              >
                Regístrate
              </button>
            </>
          ) : (
            <>
              ¿Ya tienes cuenta?{" "}
              <button
                type="button"
                onClick={() => cambiarModo("login")}
                className="text-coral font-semibold"
              >
                Inicia sesión
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}