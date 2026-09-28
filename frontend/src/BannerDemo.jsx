import { Sparkles, X } from "lucide-react";
import { useState } from "react";

export default function BannerDemo({ onCrearCuenta, onCerrarSesion }) {
  const [cerrado, setCerrado] = useState(false);

  if (cerrado) return null;

  return (
    <div className="bg-gradient-to-r from-coral to-rose-500 text-white px-4 py-2.5 flex items-center gap-3 text-xs shadow-md relative z-30">
      <Sparkles size={14} className="shrink-0" />
      <p className="flex-1 font-medium">
        Estás en <strong>modo demo</strong>. Los datos se borrarán en 24h.
      </p>
      <button
        onClick={onCrearCuenta}
        className="shrink-0 bg-white text-coral font-bold px-3 py-1 rounded-full text-[11px] hover:bg-coral hover:text-white transition-colors"
      >
        Crear mi cuenta
      </button>
      <button
        onClick={() => setCerrado(true)}
        className="shrink-0 opacity-70 hover:opacity-100"
        title="Cerrar banner"
      >
        <X size={14} />
      </button>
    </div>
  );
}