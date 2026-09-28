import { LogIn, ShieldAlert } from "lucide-react";

export default function SesionExpiradaScreen({ onVolverALogin }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FEFAF5] via-[#FFE5E2] to-[#FF4F40] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-3xl shadow-xl p-8 text-center">
          <div className="w-20 h-20 mx-auto rounded-full bg-amber-100 flex items-center justify-center mb-5">
            <ShieldAlert size={40} className="text-amber-600" />
          </div>

          <h1 className="text-2xl font-bold text-carbon mb-2">
            Tu sesión expiró
          </h1>
          <p className="text-sm text-gray-500 mb-6">
            Por seguridad cerramos tu sesión después de un tiempo de inactividad.
            Vuelve a iniciar sesión para continuar donde lo dejaste.
          </p>

          <button
            onClick={onVolverALogin}
            className="w-full bg-coral text-white font-semibold py-3.5 rounded-xl hover:bg-coral-dark transition-colors flex items-center justify-center gap-2 shadow-lg shadow-coral/30"
          >
            <LogIn size={18} />
            Volver a iniciar sesión
          </button>
        </div>
      </div>
    </div>
  );
}