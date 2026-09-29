import { useState } from "react";
import { ArrowLeft, Plus, AlertCircle } from "lucide-react";
import CardNetworkLogo from "./CardNetworkLogo.jsx";

// Un color sólido por tema, para el punto identificador de cada tarjeta.
const DOT_COLOR = {
  "amex-verde": "#10b981",
  "visa-gold": "#d4ad4a",
  "mastercard-azul": "#2563eb",
  "diners-marron": "#7a4a2a",
  "negro-premium": "#1a1a1a",
  "morado-moderno": "#7c3aed",
  clasico: "#2d2438",
};

export default function TarjetasScreen({
  tarjetas,
  onVolver,
  onAgregar,
  onVerTarjeta,
  onPagar,
  embedded = false,
}) {
  const [tabActiva, setTabActiva] = useState("credito");

  const todasLasTarjetas = Array.isArray(tarjetas) ? tarjetas : [];
  const tarjetasCredito = todasLasTarjetas.filter(
    (t) => (t.tipo || "credito") === "credito"
  );
  const tarjetasDebito = todasLasTarjetas.filter((t) => t.tipo === "debito");

  const totalConsumos = tarjetasCredito.reduce(
    (acc, t) => acc + Number(t.gastado_mes || 0),
    0
  );
  const limiteTotal = 350 * Math.max(tarjetasCredito.length, 1);
  const disponibleTotal = Math.max(limiteTotal - totalConsumos, 0);

  return (
    <div className={embedded ? "" : "max-w-md mx-auto px-4 pb-28 pt-6"}>
      {/* Header (solo si no está embebido) */}
      {!embedded && (
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={onVolver}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-carbon"
          >
            <ArrowLeft size={16} /> Volver
          </button>
          <button
            onClick={onAgregar}
            className="w-10 h-10 rounded-full bg-coral text-white flex items-center justify-center shadow-md hover:bg-coral-dark transition-colors"
            title="Agregar tarjeta"
          >
            <Plus size={18} />
          </button>
        </div>
      )}

      {/* Header embebido (dentro de Home) */}
      {embedded && (
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-semibold text-carbon">Mis tarjetas</h2>
            <p className="text-xs text-gray-500">
              {todasLasTarjetas.length}{" "}
              {todasLasTarjetas.length === 1 ? "tarjeta" : "tarjetas"}
            </p>
          </div>
          <button
            onClick={onAgregar}
            className="w-9 h-9 rounded-full bg-coral text-white flex items-center justify-center shadow-md hover:bg-coral-dark transition-colors"
            title="Agregar tarjeta"
          >
            <Plus size={16} />
          </button>
        </div>
      )}

      {!embedded && (
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-carbon">Tarjetas</h1>
        </div>
      )}

      {/* Segmented control */}
      <div className="flex bg-gray-100 p-1 rounded-2xl mb-6">
        <button
          onClick={() => setTabActiva("credito")}
          className={`flex-1 py-2.5 text-sm font-semibold rounded-xl transition-all ${
            tabActiva === "credito"
              ? "bg-white text-coral shadow-sm"
              : "text-gray-500 hover:text-carbon"
          }`}
        >
          Crédito
        </button>
        <button
          onClick={() => setTabActiva("debito")}
          className={`flex-1 py-2.5 text-sm font-semibold rounded-xl transition-all ${
            tabActiva === "debito"
              ? "bg-white text-coral shadow-sm"
              : "text-gray-500 hover:text-carbon"
          }`}
        >
          Débito
        </button>
      </div>

      {tabActiva === "credito" ? (
        <>
          {tarjetasCredito.length === 0 ? (
            <EmptyStateTarjetas
              titulo="Sin tarjetas de crédito"
              mensaje="Agrega tu primera tarjeta para llevar el control de tus consumos."
              onAgregar={onAgregar}
            />
          ) : (
            <>
              {/* Resumen limpio */}
              <div className="bg-white rounded-2xl p-5 shadow-sm mb-5 border border-gray-100">
                <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold mb-1.5">
                  Consumos a la fecha
                </p>
                <p className="text-4xl font-bold text-carbon mb-4 tabular-nums">
                  ${totalConsumos.toFixed(2)}
                </p>

                <div className="flex justify-between pt-4 border-t border-gray-100">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">
                      Disponible
                    </p>
                    <p className="text-base font-semibold text-emerald-600">
                      ${disponibleTotal.toFixed(2)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">
                      Por pagar
                    </p>
                    <p className="text-base font-semibold text-coral">
                      ${totalConsumos.toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Lista de tarjetas */}
              <div className="space-y-2.5">
                {tarjetasCredito.map((t) => (
                  <TarjetaRow
                    key={t.id}
                    tarjeta={t}
                    onVer={() => onVerTarjeta?.(t)}
                    onPagar={() => onPagar?.(t)}
                  />
                ))}
              </div>
            </>
          )}
        </>
      ) : (
        <>
          {tarjetasDebito.length === 0 ? (
            <EmptyStateTarjetas
              titulo="Sin tarjetas de débito"
              mensaje="Agrega una tarjeta de débito para controlar tus gastos directos."
              onAgregar={onAgregar}
            />
          ) : (
            <div className="space-y-2.5">
              {tarjetasDebito.map((t) => (
                <TarjetaRow
                  key={t.id}
                  tarjeta={t}
                  onVer={() => onVerTarjeta?.(t)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ============================================
   Componente: TarjetaRow
   Una fila limpia por cada tarjeta
   ============================================ */
function TarjetaRow({ tarjeta, onVer, onPagar }) {
  const esDebito = tarjeta.tipo === "debito";
  const gastado = Number(tarjeta.gastado_mes || 0);
  const limite = 350;
  const porcentaje = Math.min((gastado / limite) * 100, 100);
  const dotColor = DOT_COLOR[tarjeta.tema || "clasico"];

  // Info de corte (solo crédito)
  const dias = tarjeta.dias_para_corte;
  const urgente = !esDebito && dias !== undefined && dias !== null && dias <= 3;

  return (
    <button
      onClick={onVer}
      className="w-full bg-white rounded-2xl p-4 shadow-sm hover:shadow-md border border-gray-100 text-left transition-all active:scale-[0.99]"
    >
      {/* Fila superior: dot + nombre + monto */}
      <div className="flex items-start gap-3 mb-3">
        {/* Dot identificador */}
        <div
          className="w-2.5 h-2.5 rounded-full shrink-0 mt-1.5"
          style={{ background: dotColor }}
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <p className="font-semibold text-carbon text-sm truncate">
              {tarjeta.nombre}
            </p>
            {gastado > 0 && (
              <p className="font-bold text-carbon text-sm tabular-nums shrink-0">
                -${gastado.toFixed(2)}
              </p>
            )}
          </div>

          <p className="text-xs text-gray-500 truncate flex items-center gap-1.5">
            {tarjeta.red && (
              <span className="inline-flex items-center gap-1">
                <CardNetworkLogo
                  red={tarjeta.red}
                  size={12}
                  color="currentColor"
                />
              </span>
            )}
            <span className="text-gray-300">·</span>
            <span>{esDebito ? "Débito" : "Crédito"}</span>
            {!esDebito && tarjeta.dia_corte && (
              <>
                <span className="text-gray-300">·</span>
                <span>corte día {tarjeta.dia_corte}</span>
              </>
            )}
          </p>
        </div>
      </div>

      {/* Barra de progreso (solo crédito con gastos) */}
      {!esDebito && gastado > 0 && (
        <div className="mb-3">
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${
                urgente ? "bg-coral" : "bg-emerald-500"
              }`}
              style={{ width: `${porcentaje}%` }}
            />
          </div>
        </div>
      )}

      {/* Fila inferior: estado + acción */}
      <div className="flex items-center justify-between gap-2">
        {!esDebito ? (
          urgente ? (
            <span className="text-xs font-medium text-coral flex items-center gap-1">
              <AlertCircle size={12} />
              {dias < 0
                ? `Venció hace ${Math.abs(dias)}d`
                : dias === 0
                ? "Vence hoy"
                : `Vence en ${dias}d`}
            </span>
          ) : gastado > 0 && dias !== undefined && dias !== null ? (
            <span className="text-xs text-gray-500">
              Vence en {dias} día{dias !== 1 ? "s" : ""}
            </span>
          ) : (
            <span className="text-xs text-gray-400">Al día</span>
          )
        ) : (
          <span className="text-xs text-gray-400">
            {tarjeta.cuenta_id ? "Asociada a cuenta" : "Sin cuenta"}
          </span>
        )}

        {!esDebito && gastado > 0 && onPagar && (
          <span className="px-3 py-1.5 rounded-full bg-coral text-white text-xs font-semibold">
            Pagar
          </span>
        )}
      </div>
    </button>
  );
}

/* ============================================
   Componente: EmptyStateTarjetas
   ============================================ */
function EmptyStateTarjetas({ titulo, mensaje, onAgregar }) {
  return (
    <div className="border-2 border-dashed border-gray-200 rounded-2xl p-8 text-center">
      <div className="w-14 h-14 rounded-full bg-coral/10 text-coral flex items-center justify-center mx-auto mb-4">
        <Plus size={24} />
      </div>
      <p className="text-base font-semibold text-carbon mb-1">{titulo}</p>
      <p className="text-sm text-gray-500 mb-5 max-w-xs mx-auto">{mensaje}</p>
      <button
        onClick={onAgregar}
        className="px-5 py-2.5 rounded-full bg-coral text-white font-semibold text-sm hover:bg-coral-dark transition-colors"
      >
        + Agregar tarjeta
      </button>
    </div>
  );
}
