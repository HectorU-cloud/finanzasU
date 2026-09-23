import { useState } from "react";
import { Wallet, Sparkles, CheckCircle2, ChevronRight, SkipForward, Plus, ArrowLeft } from "lucide-react";
import CuentaModal from "./CuentaModal.jsx";

export default function OnboardingScreen({ usuario, onCompletado }) {
  const [paso, setPaso] = useState(0);
  const [modalCuenta, setModalCuenta] = useState(false);
  const [cuentaCreada, setCuentaCreada] = useState(false);

  const totalPasos = 3;

  const siguiente = () => setPaso((p) => Math.min(p + 1, totalPasos - 1));
  const anterior = () => setPaso((p) => Math.max(p - 1, 0));
  const saltar = () => onCompletado();

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg)" }}>
      {/* Barra de progreso + Saltar */}
      <div className="max-w-md mx-auto w-full px-6 pt-6">
        <div className="flex items-center justify-between mb-2">
          {paso > 0 ? (
            <button
              onClick={anterior}
              className="text-xs text-gray-500 hover:text-carbon flex items-center gap-1"
            >
              <ArrowLeft size={14} /> Atrás
            </button>
          ) : (
            <div />
          )}
          <button
            onClick={saltar}
            className="text-xs text-gray-500 hover:text-carbon flex items-center gap-1"
          >
            Saltar <SkipForward size={12} />
          </button>
        </div>

        {/* Puntitos de progreso */}
        <div className="flex gap-2 mb-8">
          {Array.from({ length: totalPasos }).map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-all ${
                i <= paso ? "bg-coral" : "bg-gray-200"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Contenido del paso */}
      <div className="flex-1 max-w-md mx-auto w-full px-6">
        {paso === 0 && <PasoBienvenida usuario={usuario} />}
        {paso === 1 && (
          <PasoCrearCuenta
            cuentaCreada={cuentaCreada}
            onAbrirModal={() => setModalCuenta(true)}
          />
        )}
        {paso === 2 && <PasoListo cuentaCreada={cuentaCreada} />}
      </div>

      {/* Botón inferior */}
      <div className="max-w-md mx-auto w-full px-6 pb-8">
        <button
          onClick={paso === totalPasos - 1 ? onCompletado : siguiente}
          className="w-full py-3.5 rounded-2xl bg-coral text-white font-semibold flex items-center justify-center gap-2 hover:bg-coral-dark transition-colors shadow-lg shadow-coral/30"
        >
          {paso === totalPasos - 1 ? "Ir a la app" : "Siguiente"}
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Modal para crear cuenta */}
      {modalCuenta && (
        <CuentaModal
          cuenta={null}
          onCerrar={() => setModalCuenta(false)}
          onGuardado={() => {
            setModalCuenta(false);
            setCuentaCreada(true);
            setTimeout(() => setPaso(2), 400);
          }}
        />
      )}
    </div>
  );
}

function PasoBienvenida({ usuario }) {
  return (
    <div className="text-center animate-toast">
      <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-coral to-rose-600 flex items-center justify-center shadow-2xl shadow-coral/40 mb-6">
        <Sparkles size={44} className="text-white" />
      </div>
      <h1 className="text-3xl font-bold text-carbon mb-3">
        ¡Hola, {usuario?.nombre?.split(" ")[0] || "amigo"}! 👋
      </h1>
      <p className="text-base text-gray-600 mb-4 max-w-xs mx-auto">
        Te vamos a acompañar a configurar tu app en menos de 2 minutos.
      </p>
      <p className="text-sm text-gray-400">
        Solo son 3 pasos rápidos. ¡Vamos!
      </p>
    </div>
  );
}

function PasoCrearCuenta({ cuentaCreada, onAbrirModal }) {
  return (
    <div className="text-center animate-toast">
      <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-violet-500 to-violet-700 flex items-center justify-center shadow-2xl shadow-violet-500/40 mb-6">
        <Wallet size={44} className="text-white" />
      </div>
      <h1 className="text-2xl font-bold text-carbon mb-3">
        {cuentaCreada ? "¡Cuenta creada!" : "Crea tu primera cuenta"}
      </h1>
      <p className="text-base text-gray-600 mb-8 max-w-xs mx-auto">
        {cuentaCreada
          ? "Tu cuenta está lista. Aquí guardarás y controlarás tu dinero."
          : "Aquí guardarás tu dinero: efectivo, ahorros, banco o cualquier otra."}
      </p>

      {!cuentaCreada && (
        <button
          onClick={onAbrirModal}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-white border-2 border-coral text-coral font-semibold hover:bg-coral hover:text-white transition-colors shadow-md"
        >
          <Plus size={18} />
          Crear cuenta
        </button>
      )}

      {cuentaCreada && (
        <div className="flex items-center justify-center gap-2 text-emerald-600 font-semibold">
          <CheckCircle2 size={20} />
          <span>¡Perfecto!</span>
        </div>
      )}
    </div>
  );
}

function PasoListo({ cuentaCreada }) {
  return (
    <div className="text-center animate-toast">
      <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-2xl shadow-emerald-500/40 mb-6">
        <CheckCircle2 size={44} className="text-white" />
      </div>
      <h1 className="text-2xl font-bold text-carbon mb-3">
        ¡Todo listo! 🎉
      </h1>
      <p className="text-base text-gray-600 mb-6 max-w-xs mx-auto">
        Ya puedes empezar a registrar tus gastos, ingresos y organizar tus finanzas.
      </p>

      {cuentaCreada && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 max-w-xs mx-auto">
          <p className="text-sm text-emerald-700">
            ✅ Tu primera cuenta está configurada
          </p>
        </div>
      )}

      <p className="text-xs text-gray-400 mt-6">
        Puedes cambiar estos datos en cualquier momento desde la app
      </p>
    </div>
  );
}