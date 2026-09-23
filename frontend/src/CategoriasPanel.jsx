import { useEffect, useState } from "react";
import { Plus, Trash2, Tags } from "lucide-react";
import { api } from "./api.js";

export default function CategoriasPanel() {
  const [tipo, setTipo] = useState("gasto");
  const [categorias, setCategorias] = useState([]);
  const [nombre, setNombre] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  async function cargar() {
    setError("");
    try {
      setCategorias(await api.getCategoriasPersonalizadas(tipo));
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => { cargar(); }, [tipo]);

  async function crear(e) {
    e.preventDefault();
    if (!nombre.trim()) return;
    setCargando(true);
    setError("");
    try {
      await api.crearCategoriaPersonalizada({ nombre: nombre.trim(), tipo });
      setNombre("");
      await cargar();
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  async function eliminar(id) {
    if (!window.confirm("¿Eliminar esta categoría? Los movimientos existentes conservarán su nombre.")) return;
    try {
      await api.eliminarCategoriaPersonalizada(id);
      await cargar();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="border border-gray-200 rounded-xl p-4 text-left">
      <div className="flex items-center gap-2 mb-1">
        <Tags size={16} className="text-coral" />
        <p className="text-xs font-semibold text-carbon">Mis categorías</p>
      </div>
      <p className="text-[11px] text-gray-500 mb-3">
        Crea categorías propias para organizar tus gastos e ingresos.
      </p>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <button
          onClick={() => setTipo("gasto")}
          className={`py-2 rounded-lg text-xs font-semibold border ${tipo === "gasto" ? "bg-coral text-white border-coral" : "border-gray-200 text-gray-600"}`}
        >Gastos</button>
        <button
          onClick={() => setTipo("ingreso")}
          className={`py-2 rounded-lg text-xs font-semibold border ${tipo === "ingreso" ? "bg-emerald-600 text-white border-emerald-600" : "border-gray-200 text-gray-600"}`}
        >Ingresos</button>
      </div>

      <form onSubmit={crear} className="flex gap-2 mb-3">
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          maxLength={50}
          placeholder={tipo === "gasto" ? "Ej. Mascotas" : "Ej. Bonificación"}
          className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-xs focus:border-coral focus:outline-none"
        />
        <button
          disabled={cargando || !nombre.trim()}
          className="w-10 rounded-lg bg-coral text-white flex items-center justify-center disabled:opacity-50"
          title="Agregar categoría"
        ><Plus size={16} /></button>
      </form>

      {error && <p className="text-xs text-red-500 mb-2">{error}</p>}

      {categorias.length === 0 ? (
        <p className="text-[11px] text-gray-400">Todavía no tienes categorías personalizadas.</p>
      ) : (
        <div className="space-y-1.5">
          {categorias.map((cat) => (
            <div key={cat.id} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
              <span className="text-xs text-carbon">{cat.nombre}</span>
              <button onClick={() => eliminar(cat.id)} className="text-gray-400 hover:text-red-500 p-1" title="Eliminar">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
