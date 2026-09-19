import { useState } from "react";
import { ArrowLeft, Plus, AlertCircle } from "lucide-react";
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

const TARJETAS_LOGO = {
  "amex-verde": { fondo: "#e6f5ef", texto: "American Express" },
  "visa-gold": { fondo: "#fdf6e3", texto: "Visa Gold" },
  "mastercard-azul": { fondo: "#e6ecf7", texto: "Mastercard" },
  "diners-marron": { fondo: "#f5e9e0", texto: "Diners Club" },
  "negro-premium": { fondo: "#e8e8e8", texto: "Premium" },
  "morado-moderno": { fondo: "#f0e6fa", texto: "Morado" },
  clasico: { fondo: "#e8e8ec", texto: "Tarjeta" },
};

export default function TarjetasScreen({
  tarjetas,
  onVolver,
  onAgregar,
  onVerTarjeta,
  onPagar,
  embedded = false,   // <-- NUEVO
}) {
  const [tabActiva, setTabActiva] = useState("credito");

  const listaTarjetas = tarjetas || [];
  const totalConsumos = listaTarjetas.reduce((acc, t) => acc + Number(t.gastado_mes || 0), 0);
  const limiteTotal = 350 * Math.max(listaTarjetas.length, 1);
  const disponibleTotal = Math.max(limiteTotal - totalConsumos, 0);

  // Una tarjeta está "en corte generado" si ya pasó su día de corte
  const algunaEnCorte = listaTarjetas.some((t) => t.dias_para_corte === 0 || t.dias_para_corte < 0);
  const badgeTexto = algunaEnCorte ? "Corte generado" : "Al día";

  return (
    <div className={embedded ? "" : "max-w-md mx-auto px-4 pb-28 pt-6"}>
      {/* Header (solo si no está embebido) */}
      {!embedded && (
        <>
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

          <h1 className="text-3xl font-bold text-carbon mb-5">Tarjetas</h1>
        </>
      )}

      {/* Botón agregar cuando está embebido */}
      {embedded && (
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-carbon">Mis tarjetas</h2>
          <button
            onClick={onAgregar}
            className="w-9 h-9 rounded-full bg-coral text-white flex items-center justify-center shadow-md hover:bg-coral-dark transition-colors"
            title="Agregar tarjeta"
          >
            <Plus size={18} />
          </button>
        </div>
      )}

      {/* Segmented Control */}
      <div className="flex bg-gray-100 p-1 rounded-2xl mb-6">
        <button
          onClick={() => setTabActiva("credito")}
          className={`flex-1 py-2.5 text-sm font-semibold rounded-xl transition-all ${
            tabActiva === "credito"
              ? "bg-white text-coral shadow-sm"
              : "text-gray-500 hover:text-carbon"
          }`}
        >
          Tarjetas de crédito
        </button>
        <button
          onClick={() => setTabActiva("debito")}
          className={`flex-1 py-2.5 text-sm font-semibold rounded-xl transition-all ${
            tabActiva === "debito"
              ? "bg-white text-coral shadow-sm"
              : "text-gray-500 hover:text-carbon"
          }`}
        >
          Tarjetas de débito
        </button>
      </div>

      {tabActiva === "credito" ? (
        <>
          {listaTarjetas.length === 0 ? (
            <div className="border-2 border-dashed border-gray-300 rounded-2xl p-8 text-center mb-6">
              <p className="text-sm text-gray-500 mb-3">Sin tarjetas todavía</p>
              <button
                onClick={onAgregar}
                className="bg-coral text-white font-semibold text-sm px-5 py-2.5 rounded-full"
              >
                + Agregar tarjeta
              </button>
            </div>
          ) : (
            <>
              {/* Widget de Resumen */}
              <div className="rounded-3xl p-5 mb-6 bg-[#2a2a2a] text-white shadow-lg">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs tracking-widest text-gray-400 font-medium">
                    CONSUMOS A LA FECHA
                  </p>
                  <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full ${
                    algunaEnCorte
                      ? "bg-yellow-900/50 text-yellow-300"
                      : "bg-gray-700 text-gray-300"
                  }`}>
                    {badgeTexto}
                  </span>
                </div>

                <div className="flex items-center justify-between mb-6">
                  <p className="text-4xl font-bold tracking-tight">
                    ${totalConsumos.toFixed(2)}
                  </p>
                  <button
                    onClick={() => onPagar?.(listaTarjetas[0])}
                    className="px-5 py-2 rounded-full bg-white text-carbon text-sm font-semibold hover:bg-gray-100 transition-colors"
                  >
                    Pagar
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-1">
                      Disponible total
                    </p>
                    <p className="text-lg font-semibold">${disponibleTotal.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-1">
                      Por pagar
                    </p>
                    <p className="text-lg font-semibold">${totalConsumos.toFixed(2)}</p>
                  </div>
                </div>
              </div>

              {/* Carrusel horizontal de tarjetas */}
              <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide -mx-4 px-4">
                {listaTarjetas.map((t) => {
                  const gradiente = GRADIENTES[t.tema || "clasico"];
                  const infoTema = TARJETAS_LOGO[t.tema] || TARJETAS_LOGO.clasico;
                  return (
                    <div
                      key={t.id}
                      onClick={() => onVerTarjeta?.(t)}
                      className="shrink-0 w-[260px] snap-center rounded-2xl overflow-hidden shadow-lg cursor-pointer active:scale-[0.98] transition-transform"
                    >
                      {/* Fondo de la tarjeta */}
                      <div
                        className="h-40 relative flex items-center justify-center"
                        style={{ background: gradiente }}
                      >
                        {/* Logo de la red en marca de agua */}
                        {t.red && (
                          <div className="opacity-20 absolute">
                            <CardNetworkLogo red={t.red} size={90} color="#ffffff" />
                          </div>
                        )}
                        <div className="relative z-10 text-center text-white/90">
                          <p className="text-[10px] tracking-widest uppercase opacity-80">
                            {infoTema.texto}
                          </p>
                          <p className="text-2xl font-bold mt-1">
                            {t.nombre.split(" ").slice(0, 2).join(" ")}
                          </p>
                        </div>
                      </div>

                      {/* Parte inferior con consumo */}
                      <div className="bg-[#3a3a3a] px-4 py-3 flex items-center justify-between">
                        <div>
                          <p className="text-[10px] text-gray-400 mb-0.5">
                            Consumo a la fecha
                          </p>
                          <p className="text-white font-semibold">
                            ${Number(t.gastado_mes || 0).toFixed(2)}
                          </p>
                        </div>
                        {Number(t.gastado_mes) > 0 && (
                          <div className="w-6 h-6 rounded-full bg-yellow-400 flex items-center justify-center">
                            <AlertCircle size={14} className="text-yellow-900" />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Sección Adicionales */}
              <h2 className="text-lg font-semibold text-carbon mt-4 mb-3">Adicionales</h2>
              <div className="border-2 border-dashed border-gray-300 rounded-2xl p-8 text-center">
                <div className="flex justify-center mb-4">
                  <div className="relative">
                    <div className="w-16 h-10 rounded-md bg-yellow-100 transform -rotate-6 absolute -left-6 top-0 shadow" />
                    <div className="w-16 h-10 rounded-md bg-emerald-100 relative shadow z-10" />
                    <div className="absolute -bottom-1 -right-2 w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold">
                      !
                    </div>
                  </div>
                </div>
                <p className="text-carbon font-semibold text-sm mb-1">
                  No pudimos cargar tus tarjetas
                </p>
                <p className="text-xs text-gray-500">
                  Intenta nuevamente para ver tu información.
                </p>
              </div>
            </>
          )}
        </>
      ) : (
        <div className="border-2 border-dashed border-gray-300 rounded-2xl p-10 text-center">
          <p className="text-4xl mb-3">💳</p>
          <p className="text-carbon font-semibold text-sm mb-1">
            Tarjetas de débito
          </p>
          <p className="text-xs text-gray-500">
            Próximamente podrás gestionar tus tarjetas de débito aquí.
          </p>
        </div>
      )}
    </div>
  );
}