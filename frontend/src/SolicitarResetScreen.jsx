import { useState } from "react";
import { ArrowLeft, Mail, CheckCircle2 } from "lucide-react";
import { api } from "./api.js";

export default function SolicitarResetScreen({ onVolver }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  const [exito, setExito] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!email.trim()) {
      setError("Escribe tu correo.");
      return;
    }
    setCargando(true);
    try {
      await api.solicitarReset(email.trim());
      setExito(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FEFAF5] via-[#FFE5E2] to-[#FF4F40] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <button
          onClick={onVolver}
          className="flex items-center gap-1.5 text-sm text-carbon/70 hover:text-carbon mb-6"
        >
          <ArrowLeft size={16} /> Volver al login
        </button>

        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto rounded-full bg-coral flex items-center justify-center shadow-2xl shadow-coral/40 mb-3">
            <Mail size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-carbon">Recupera tu cuenta</h1>
          <p className="text-sm text-gray-600 mt-1">
            Te enviaremos un enlace para crear una nueva contraseña
          </p>
        </div>

        <div className="bg-white rounded-3xl shadow-xl p-6">
          {exito ? (
            <div className="text-center py-4">
              <CheckCircle2 size={48} className="text-emerald-500 mx-auto mb-3" />
              <p className="font-semibold text-carbon mb-2">
                Revisa tu correo
              </p>
              <p className="text-sm text-gray-500 mb-5">
                Si <strong>{email}</strong> está registrado, recibirás un enlace en los próximos minutos. Revisa también tu carpeta de spam.
              </p>
              <button
                onClick={onVolver}
                className="w-full bg-coral text-white font-semibold py-3 rounded-xl hover:bg-coral-dark transition-colors"
              >
                Volver al login
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">
                  Correo electrónico
                </label>
                <input
                  type="email"
                  placeholder="tu@correo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-coral focus:outline-none focus:ring-2 focus:ring-coral/20 text-sm transition-all"
                  autoFocus
                />
              </div>

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
                {cargando ? "Enviando..." : "Enviar enlace de recuperación"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}