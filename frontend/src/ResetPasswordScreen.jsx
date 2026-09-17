import { useState } from "react";
import { KeyRound, CheckCircle2, AlertTriangle } from "lucide-react";
import { api } from "./api.js";

export default function ResetPasswordScreen({ token, onCompletado }) {
  const [form, setForm] = useState({ nueva: "", confirmar: "" });
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  const [exito, setExito] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!form.nueva || !form.confirmar) {
      setError("Completa todos los campos.");
      return;
    }
    if (form.nueva.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (form.nueva !== form.confirmar) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setCargando(true);
    try {
      await api.resetPassword(token, form.nueva);
      setExito(true);
      setTimeout(onCompletado, 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FEFAF5] via-[#FFE5E2] to-[#FF4F40] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto rounded-full bg-coral flex items-center justify-center shadow-2xl shadow-coral/40 mb-3">
            <KeyRound size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-carbon">Nueva contraseña</h1>
          <p className="text-sm text-gray-600 mt-1">
            Elige una contraseña segura para tu cuenta
          </p>
        </div>

        <div className="bg-white rounded-3xl shadow-xl p-6">
          {exito ? (
            <div className="text-center py-4">
              <CheckCircle2 size={48} className="text-emerald-500 mx-auto mb-3" />
              <p className="font-semibold text-carbon mb-1">
                ¡Contraseña actualizada!
              </p>
              <p className="text-sm text-gray-500">
                Redirigiendo al inicio de sesión...
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 flex items-start gap-2">
                <AlertTriangle size={14} className="text-amber-600 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-700">
                  Elige una contraseña que no hayas usado antes. Mínimo 6 caracteres.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">
                  Nueva contraseña
                </label>
                <input
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  value={form.nueva}
                  onChange={(e) => setForm({ ...form, nueva: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-coral focus:outline-none focus:ring-2 focus:ring-coral/20 text-sm transition-all"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">
                  Confirmar contraseña
                </label>
                <input
                  type="password"
                  placeholder="Repite tu contraseña"
                  value={form.confirmar}
                  onChange={(e) => setForm({ ...form, confirmar: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-coral focus:outline-none focus:ring-2 focus:ring-coral/20 text-sm transition-all"
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
                {cargando ? "Guardando..." : "Cambiar contraseña"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}