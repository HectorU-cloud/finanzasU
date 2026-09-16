import { useEffect, useState } from "react";
import { Target, X } from "lucide-react";
import { api } from "./api.js";

export default function PoteModal({ pote, cuentas, onCerrar, onGuardado }) {
  const editando = Boolean(pote);
  const [emojis, setEmojis] = useState(["🏺"]);
  const [form, setForm] = useState({
    nombre: pote?.nombre || "",
    emoji: pote?.emoji || "🏺",
    meta: pote?.meta || "",
    cuenta_id: pote?.cuenta_id || cuentas[0]?.id || "",
  });
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    api.getEmojisPote()
      .then((d) => setEmojis(d.emojis || ["🏺"]))
      .catch(() => {});
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!form.nombre.trim()) {
      setError("Ponle un nombre al pote.");
      return;
    }
    const metaNum = Number(form.meta);
    if (!metaNum || metaNum <= 0) {
      setError("La meta debe ser mayor a 0.");
      return;
    }
    setCargando(true);
    try {
      const datos = {
        nombre: form.nombre.trim(),
        emoji: form.emoji,
        meta: metaNum,
        cuenta_id: Number(form.cuenta_id),
      };
      if (editando) {
        await api.actualizarPote(pote.id, {
          nombre: datos.nombre,
          emoji: datos.emoji,
          meta: datos.meta,
        });
      } else {
        await api.crearPote(datos);
      }
      onGuardado();
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onCerrar}>
      <div
        className="bg-white rounded-t-3xl sm:rounded-3xl p-6 w-full max-w-sm shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="flex items-center gap-2 text-lg font-semibold text-carbon">
            <Target size={18} className="text-coral" />
            {editando ? "Editar pote" : "Nuevo pote"}
          </h3>
          <button
            onClick={onCerrar}
            className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-500"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Nombre
            </label>
            <input
              type="text"
              placeholder="ej. Viaje a la playa"
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:border-coral focus:outline-none text-sm"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Emoji
            </label>
            <div className="grid grid-cols-8 gap-2">
              {emojis.map((em) => (
                <button
                  key={em}
                  type="button"
                  onClick={() => setForm({ ...form, emoji: em })}
                  className={`aspect-square rounded-lg text-xl flex items-center justify-center transition-all ${
                    form.emoji === em
                      ? "bg-coral/20 ring-2 ring-coral"
                      : "bg-gray-50 hover:bg-gray-100"
                  }`}
                >
                  {em}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Meta (monto a alcanzar)
            </label>
            <input
              type="number"
              step="0.01"
              placeholder="0.00"
              value={form.meta}
              onChange={(e) => setForm({ ...form, meta: e.target.value })}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:border-coral focus:outline-none text-sm"
            />
          </div>

          {!editando && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Cuenta asociada
              </label>
              <select
                value={form.cuenta_id}
                onChange={(e) => setForm({ ...form, cuenta_id: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:border-coral focus:outline-none text-sm bg-white"
              >
                {cuentas.length === 0 && <option value="">Sin cuentas</option>}
                {cuentas.map((c) => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </select>
              <p className="text-[10px] text-gray-400 mt-1">
                El dinero se guardará desde esta cuenta al depositar
              </p>
            </div>
          )}

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={cargando || (cuentas.length === 0 && !editando)}
            className="w-full bg-coral text-white font-semibold py-3 rounded-xl hover:bg-coral-dark transition-colors disabled:opacity-60"
          >
            {cargando ? "Guardando..." : editando ? "Guardar cambios" : "Crear pote"}
          </button>
        </form>
      </div>
    </div>
  );
}