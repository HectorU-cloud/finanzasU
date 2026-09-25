import { useState } from "react";
import { Users, X, Plus, Check } from "lucide-react";
import { api } from "./api.js";

export default function GrupoModal({ onCerrar, onCreado }) {
  const [tab, setTab] = useState("crear");
  const [nombre, setNombre] = useState("");
  const [codigo, setCodigo] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  async function handleCrear(e) {
    e.preventDefault();
    setError("");
    if (!nombre.trim()) {
      setError("Ponle un nombre al grupo.");
      return;
    }
    setCargando(true);
    try {
      const nuevo = await api.crearGrupo(nombre.trim());
      onCreado(nuevo);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  async function handleUnirse(e) {
    e.preventDefault();
    setError("");
    if (!codigo.trim()) {
      setError("Ingresa un código de invitación.");
      return;
    }
    setCargando(true);
    try {
      const grupo = await api.unirseGrupo(codigo.trim());
      onCreado(grupo);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onCerrar}
    >
      <div
        className="rounded-t-3xl sm:rounded-3xl p-6 w-full max-w-sm shadow-2xl"
        style={{ background: "var(--surface)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="flex items-center gap-2 text-lg font-semibold text-carbon">
            <Users size={18} className="text-coral" />
            Nuevo grupo
          </h3>
          <button
            onClick={onCerrar}
            className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-500"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex bg-gray-100 p-1 rounded-2xl mb-5">
          <button
            onClick={() => { setTab("crear"); setError(""); }}
            className={`flex-1 py-2 text-sm font-semibold rounded-xl transition-all ${
              tab === "crear" ? "bg-white text-coral shadow-sm" : "text-gray-500"
            }`}
          >
            Crear
          </button>
          <button
            onClick={() => { setTab("unirse"); setError(""); }}
            className={`flex-1 py-2 text-sm font-semibold rounded-xl transition-all ${
              tab === "unirse" ? "bg-white text-coral shadow-sm" : "text-gray-500"
            }`}
          >
            Unirme
          </button>
        </div>

        {tab === "crear" ? (
          <form onSubmit={handleCrear} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Nombre del grupo
              </label>
              <input
                type="text"
                placeholder="ej. Gastos en pareja"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:border-coral focus:outline-none text-sm"
                autoFocus
              />
              <p className="text-[10px] text-gray-400 mt-1">
                Podrás invitar a otros con un código único.
              </p>
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={cargando}
              className="w-full bg-coral text-white font-semibold py-3 rounded-xl hover:bg-coral-dark transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
            >
              <Plus size={16} />
              {cargando ? "Creando..." : "Crear grupo"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleUnirse} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Código de invitación
              </label>
              <input
                type="text"
                placeholder="Pega el código aquí"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:border-coral focus:outline-none text-sm font-mono tracking-wider"
                autoFocus
              />
              <p className="text-[10px] text-gray-400 mt-1">
                Pídele el código a quien creó el grupo.
              </p>
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={cargando}
              className="w-full bg-coral text-white font-semibold py-3 rounded-xl hover:bg-coral-dark transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
            >
              <Check size={16} />
              {cargando ? "Uniéndome..." : "Unirme al grupo"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}