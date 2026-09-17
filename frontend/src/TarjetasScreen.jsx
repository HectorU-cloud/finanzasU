import { ArrowLeft, Plus } from "lucide-react";
import CardNetworkLogo from "./CardNetworkLogo.jsx";

const GRADIENTES = {
  "amex-verde": "linear-gradient(135deg, #0d5f4f 0%, #1a8a73 100%)",
  "visa-gold": "linear-gradient(135deg, #8c6b1f 0%, #d4ad4a 100%)",
  "mastercard-azul": "linear-gradient(135deg, #0f2a5c 0%, #1e4a8a 100%)",
  "diners-marron": "linear-gradient(135deg, #4a2a1a 0%, #7a4a2a 100%)",
  "negro-premium": "linear-gradient(135deg, #000 0%, #2a2a2a 100%)",
  "morado-moderno": "linear-gradient(135deg, #4a1d7a 0%, #7c3aed 100%)",
  clasico: "linear-gradient(135deg, #1a1523 0%, #2d2438 100%)",
};

export default function TarjetasScreen({
  tarjetas,
  onVolver,
  onAgregar,
  onVerTarjeta,
}) {
  return (
    <div className="max-w-md mx-auto px-4 pb-28 pt-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <button
          onClick={onVolver}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-carbon"
        >
          <ArrowLeft size={16} /> Volver
        </button>
        <button
          onClick={onAgregar}
          className="w-11 h-11 rounded-full bg-coral text-white flex items-center justify-center shadow-lg hover:bg-coral-dark transition-colors"
          title="Agregar tarjeta"
        >
          <Plus size={20} />
        </button>
      </div>

      <h1 className="text-2xl font-bold text-carbon mb-5">Mis tarjetas</h1>

      {!tarjetas || tarjetas.length === 0 ? (
        <div className="border-2 border-dashed border-gray-300 rounded-2xl p-8 text-center">
          <p className="text-sm text-gray-500 mb-3">Sin tarjetas todavía</p>
          <button
            onClick={onAgregar}
            className="bg-coral text-white font-semibold text-sm px-5 py-2.5 rounded-full"
          >
            + Agregar tarjeta
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {tarjetas.map((t) => {
            const gastado = Number(t.gastado_mes || 0);
            return (
              <div
                key={t.id}
                onClick={() => onVerTarjeta(t)}
                className="rounded-2xl p-5 text-white shadow-lg cursor-pointer active:scale-[0.98] transition-transform"
                style={{ background: GRADIENTES[t.tema || "clasico"] }}
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <p className="text-xs opacity-80">Gastado este ciclo</p>
                    <p className="text-2xl font-bold">${gastado.toFixed(2)}</p>
                  </div>
                  <span className="text-[10px] px-2 py-1 rounded-full bg-white/20">
                    {t.en_rojo ? "Excedido" : "Al día"}
                  </span>
                </div>
                <div className="flex justify-between items-end">
                  <span className="text-sm font-medium">{t.nombre}</span>
                  <div className="text-right">
                    <span className="text-xs opacity-75 block">
                      Corte día {t.dia_corte}
                    </span>
                    {t.red && (
                      <div className="mt-1">
                        <CardNetworkLogo red={t.red} size={22} color="#ffffff" />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
