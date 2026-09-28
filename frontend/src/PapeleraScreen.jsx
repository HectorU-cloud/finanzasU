import { useEffect, useState } from "react";
import { ArrowLeft, Trash2, RotateCcw, Inbox } from "lucide-react";
import { api } from "./api.js";
import { useToast } from "./ToastContext.jsx";
import ConfirmModal from "./ConfirmModal.jsx";
import { SkeletonList } from "./Skeleton.jsx";
import EmptyState from "./EmptyState.jsx";

const ICONOS = {
  nota: { emoji: "📝", color: "bg-pink-100 text-pink-600" },
  pote: { emoji: "🏺", color: "bg-purple-100 text-purple-600" },
  deuda: { emoji: "💸", color: "bg-orange-100 text-orange-600" },
  grupo: { emoji: "👥", color: "bg-blue-100 text-blue-600" },
};

const NOMBRES_TIPO = {
  nota: "Nota",
  pote: "Pote",
  deuda: "Deuda",
  grupo: "Grupo",
};

const DIAS_RETENCION = 30;

function formatearTiempo(isoString) {
  if (!isoString) return "";
  const fecha = new Date(isoString);
  const ahora = new Date();
  const diffMs = ahora - fecha;
  const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHoras = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMin = Math.floor(diffMs / (1000 * 60));

  if (diffMin < 1) return "hace instantes";
  if (diffMin < 60) return `hace ${diffMin} min`;
  if (diffHoras < 24) return `hace ${diffHoras} h`;
  if (diffDias === 1) return "hace 1 día";
  return `hace ${diffDias} días`;
}

function diasRestantes(isoString) {
  if (!isoString) return DIAS_RETENCION;
  const fecha = new Date(isoString);
  const ahora = new Date();
  const diffDias = Math.floor((ahora - fecha) / (1000 * 60 * 60 * 24));
  return Math.max(0, DIAS_RETENCION - diffDias);
}

export default function PapeleraScreen({ onVolver, onRestaurado }) {
  const [items, setItems] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [itemAEliminar, setItemAEliminar] = useState(null);
  const { showToast } = useToast();

  async function cargar() {
    setCargando(true);
    setError("");
    try {
      const d = await api.getPapelera();
      setItems(d.items || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  async function restaurar(item) {
    try {
      if (item.tipo === "nota") await api.restaurarNota(item.id);
      else if (item.tipo === "pote") await api.restaurarPote(item.id);
      else if (item.tipo === "deuda") await api.restaurarDeuda(item.id);
      else if (item.tipo === "grupo") await api.restaurarGrupo(item.id);

      setItems((prev) => prev.filter((i) => !(i.id === item.id && i.tipo === item.tipo)));
      showToast(`${NOMBRES_TIPO[item.tipo]} restaurada ✓`);
      onRestaurado?.();
    } catch (err) {
      showToast("No se pudo restaurar: " + err.message, "error");
    }
  }

  async function eliminarDefinitivo() {
    if (!itemAEliminar) return;
    const item = itemAEliminar;
    try {
      if (item.tipo === "nota") await api.eliminarNotaDefinitivo(item.id);
      else if (item.tipo === "pote") await api.eliminarPoteDefinitivo(item.id);
      else if (item.tipo === "deuda") await api.eliminarDeudaDefinitivo(item.id);
      else if (item.tipo === "grupo") await api.eliminarGrupoDefinitivo(item.id);

      setItems((prev) => prev.filter((i) => !(i.id === item.id && i.tipo === item.tipo)));
      setItemAEliminar(null);
      showToast("Eliminado definitivamente", "info");
      onRestaurado?.();
    } catch (err) {
      showToast("No se pudo eliminar: " + err.message, "error");
      setItemAEliminar(null);
    }
  }

  return (
    <div className="fixed inset-0 z-40 bg-cream overflow-y-auto">
      <div className="max-w-md mx-auto px-4 pb-28 pt-6">
        <div className="flex items-center gap-3 mb-5">
          <button
            onClick={onVolver}
            className="w-9 h-9 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-500 shrink-0"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-carbon">Papelera</h1>
            <p className="text-xs text-gray-500">
              Se borran definitivamente a los {DIAS_RETENCION} días
            </p>
          </div>
        </div>

        {cargando ? (
          <SkeletonList count={3} variant="card" />
        ) : error ? (
          <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">
            {error}
          </p>
        ) : items.length === 0 ? (
          <EmptyState
            icon={Inbox}
            titulo="Papelera vacía"
            mensaje="Los elementos que elimines aparecerán aquí por 30 días antes de borrarse definitivamente."
            colorIcono="coral"
          />
        ) : (
          <div className="space-y-2">
            {items.map((item) => {
              const icono = ICONOS[item.tipo] || ICONOS.nota;
              const dias = diasRestantes(item.eliminado_en);
              return (
                <div
                  key={`${item.tipo}-${item.id}`}
                  className="bg-white rounded-2xl p-4 shadow-sm"
                >
                  <div className="flex items-start gap-3 mb-3">
                    <div
                      className={`w-11 h-11 rounded-xl flex items-center justify-center text-lg shrink-0 ${icono.color}`}
                    >
                      {icono.emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-carbon text-sm truncate">
                        {item.titulo}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {item.subtitulo}
                      </p>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        Eliminado {formatearTiempo(item.eliminado_en)}
                        {dias > 0 && ` · quedan ${dias} día${dias !== 1 ? "s" : ""}`}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => restaurar(item)}
                      className="flex-1 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-emerald-700 transition-colors"
                    >
                      <RotateCcw size={12} /> Restaurar
                    </button>
                    <button
                      onClick={() => setItemAEliminar(item)}
                      className="flex-1 py-2 rounded-xl border border-red-200 text-red-600 text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 size={12} /> Borrar ahora
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {itemAEliminar && (
        <ConfirmModal
          titulo="Borrar definitivamente"
          mensaje={`¿Borrar "${itemAEliminar.titulo}"? Esta acción no se puede deshacer y se perderán todos los datos asociados.`}
          textoConfirmar="Sí, borrar"
          onConfirmar={eliminarDefinitivo}
          onCancelar={() => setItemAEliminar(null)}
        />
      )}
    </div>
  );
}