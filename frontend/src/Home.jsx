import { useEffect, useState } from "react";
import { Plus, TrendingUp, Users, Wallet } from "lucide-react";
import { api } from "./api.js";
import AlertasBanner from "./AlertasBanner.jsx";

const TIPO_ICONOS = {
  efectivo: Wallet,
  ahorros: TrendingUp,
  corriente: Wallet,
  inversion: TrendingUp,
  otra: Wallet,
};

const COLORES_CUENTA = {
  efectivo: "from-emerald-500 to-emerald-700",
  ahorros: "from-violet-500 to-violet-700",
  corriente: "from-blue-500 to-blue-700",
  inversion: "from-amber-500 to-amber-700",
  otra: "from-gray-500 to-gray-700",
};

export default function Home({ usuario, resumen, tarjetas, onIrACuentas, onPagarTarjeta, onVerTarjeta, onAgregarTarjeta }) {
  const [cuentas, setCuentas] = useState([]);
  const [cargandoCuentas, setCargandoCuentas] = useState(true);
  const [totalCuentasReal, setTotalCuentasReal] = useState(0);

  useEffect(() => {
    api.getCuentas()
      .then((d) => setCuentas(d || []))
      .catch(() => setCuentas([]))
      .finally(() => setCargandoCuentas(false));
  }, []);

  useEffect(() => {
    api.getResumenTotalCuentas()
      .then((d) => setTotalCuentasReal(d.total || 0))
      .catch(() => {});
  }, []);

  const totalCuentas = totalCuentasReal;
  const totalTarjetas = Number(resumen?.total_mes ?? 0);
  const saldoNeto = totalCuentas - totalTarjetas;

  return (
    <div className="max-w-md mx-auto px-4 pb-24 pt-6">
      {/* Header */}
      <header className="flex items-center justify-between mb-6">
        <div>
          <p className="text-sm text-gray-500">Buen día,</p>
          <h1 className="text-2xl font-bold text-carbon">{usuario?.nombre || "Hola"}</h1>
        </div>
        <div className="w-11 h-11 rounded-full bg-coral text-white flex items-center justify-center font-semibold text-lg">
          {usuario?.nombre?.[0]?.toUpperCase() || "?"}
        </div>
      </header>

      <AlertasBanner />

      {/* Saldo total */}
      <div className="mb-6">
        <p className="text-sm text-gray-500 mb-1">Saldo neto</p>
        <p className={`text-4xl font-bold ${saldoNeto < 0 ? "text-coral" : "text-carbon"}`}>
          ${saldoNeto.toFixed(2)}
        </p>
        <div className="flex gap-4 mt-2 text-sm">
          <span className="text-emerald-600">
            Cuentas: +${totalCuentas.toFixed(2)}
          </span>
          <span className="text-coral">
            Tarjetas: -${totalTarjetas.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Stack de tarjetas y cuentas */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-carbon">Mis tarjetas</h2>
          <button
            onClick={onIrACuentas}
            className="text-xs text-coral font-medium"
          >
            Ver todas
          </button>
        </div>
        <div className="space-y-3">
          {tarjetas && tarjetas.length > 0 ? (
            tarjetas.slice(0, 2).map((t) => (
                <div
                key={t.id}
                onClick={() => onVerTarjeta?.(t)}
                className="rounded-2xl p-5 text-white shadow-lg cursor-pointer active:scale-[0.98] transition-transform"
                style={{
                  background:
                    t.tema === "amex-verde"
                      ? "linear-gradient(135deg, #0d5f4f 0%, #1a8a73 100%)"
                      : t.tema === "visa-gold"
                      ? "linear-gradient(135deg, #8c6b1f 0%, #d4ad4a 100%)"
                      : t.tema === "mastercard-azul"
                      ? "linear-gradient(135deg, #0f2a5c 0%, #1e4a8a 100%)"
                      : t.tema === "diners-marron"
                      ? "linear-gradient(135deg, #4a2a1a 0%, #7a4a2a 100%)"
                      : t.tema === "negro-premium"
                      ? "linear-gradient(135deg, #000 0%, #2a2a2a 100%)"
                      : t.tema === "morado-moderno"
                      ? "linear-gradient(135deg, #4a1d7a 0%, #7c3aed 100%)"
                      : "linear-gradient(135deg, #1a1523 0%, #2d2438 100%)",
                }}
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <p className="text-xs opacity-80">Gastado este ciclo</p>
                    <p className="text-2xl font-bold">${Number(t.gastado_mes).toFixed(2)}</p>
                  </div>
                  <span className="text-[10px] px-2 py-1 rounded-full bg-white/20">
                    {t.en_rojo ? "Excedido" : "Al día"}
                  </span>
                </div>
                <div className="flex justify-between items-end mb-3">
                  <span className="text-sm font-medium">{t.nombre}</span>
                  <span className="text-xs opacity-75">Corte día {t.dia_corte}</span>
                </div>
                                {Number(t.gastado_mes) > 0 && onPagarTarjeta && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onPagarTarjeta(t);
                    }}
                    className="w-full py-2 rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs font-semibold transition-colors"
                  >
                    Pagar esta tarjeta
                  </button>
                )}
              </div>
            ))
          ) : (
            <div className="rounded-2xl border-2 border-dashed border-gray-300 p-6 text-center">
            <p className="text-sm text-gray-500 mb-3">Aún no tienes tarjetas</p>
            <button
              onClick={onAgregarTarjeta}
              className="bg-coral text-white font-semibold text-sm px-5 py-2.5 rounded-full hover:bg-coral-dark transition-colors"
            >
              + Agregar tarjeta
            </button>
          </div>
          )}
        </div>
      </section>

      {/* Cuentas */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-carbon">Mis cuentas</h2>
          <button
            onClick={onIrACuentas}
            className="w-7 h-7 rounded-full bg-coral text-white flex items-center justify-center"
            title="Agregar cuenta"
          >
            <Plus size={16} />
          </button>
        </div>
        {cargandoCuentas ? (
          <p className="text-sm text-gray-400">Cargando...</p>
        ) : cuentas.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-gray-300 p-6 text-center">
            <p className="text-sm text-gray-500 mb-2">Todavía no tienes cuentas</p>
            <button
              onClick={onIrACuentas}
              className="text-coral font-medium text-sm"
            >
              + Crear primera cuenta
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {cuentas.map((c) => {
              const Icono = TIPO_ICONOS[c.tipo] || Wallet;
              const gradiente = COLORES_CUENTA[c.tipo] || COLORES_CUENTA.otra;
              return (
                <div
                  key={c.id}
                  className="flex items-center gap-3 bg-white rounded-2xl p-4 shadow-sm"
                >
                  <div
                    className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradiente} flex items-center justify-center text-white`}
                  >
                    <Icono size={18} />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-carbon text-sm">{c.nombre}</p>
                    <p className="text-xs text-gray-500 capitalize">{c.tipo}</p>
                  </div>
                    <p className="font-semibold text-carbon">
                    ${Number(c.saldo_actual ?? c.saldo_inicial).toFixed(2)}</p>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
