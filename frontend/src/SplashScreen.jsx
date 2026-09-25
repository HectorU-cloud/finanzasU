import { useEffect, useState } from "react";
import { PiggyBank } from "lucide-react";

export default function SplashScreen({ usuario, onTerminar }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    // Duración total: 1800ms
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onTerminar, 300); // espera la animación de salida
    }, 1800);
    return () => clearTimeout(timer);
  }, [onTerminar]);

  const primerNombre = usuario?.nombre?.split(" ")[0] || "amigo";
  const inicial = usuario?.nombre?.[0]?.toUpperCase() || "?";

  return (
    <div
      className={`min-h-screen flex flex-col items-center justify-center px-6 transition-opacity duration-300 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
      style={{
        background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4338ca 100%)",
      }}
    >
      {/* Logo */}
      <div className="w-20 h-20 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center mb-8 shadow-2xl animate-toast">
        <PiggyBank size={40} className="text-white" />
      </div>

      {/* Avatar con inicial */}
      <div className="relative mb-6">
        <div className="w-24 h-24 rounded-full bg-coral flex items-center justify-center text-white text-4xl font-bold shadow-2xl animate-toast">
          {inicial}
        </div>
        <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-emerald-500 border-4 border-[#312e81] flex items-center justify-center">
          <span className="text-white text-xs">✓</span>
        </div>
      </div>

      {/* Bienvenida */}
      <p className="text-white/70 text-sm uppercase tracking-widest mb-2 animate-toast">
        Bienvenido de vuelta
      </p>
      <h1 className="text-4xl font-bold text-white text-center mb-12 animate-toast">
        {primerNombre}
      </h1>

      {/* Puntos de carga */}
      <div className="flex gap-1.5">
        {[0, 1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className="w-2 h-2 rounded-full bg-white/70"
            style={{
              animation: `pulse-dot 1.4s infinite ease-in-out`,
              animationDelay: `${i * 0.15}s`,
            }}
          />
        ))}
      </div>

      <p className="text-white/50 text-xs mt-6">
        Cargando tus finanzas...
      </p>

      {/* Estilos inline para la animación de los puntos */}
      <style>{`
        @keyframes pulse-dot {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.2); }
        }
      `}</style>
    </div>
  );
}