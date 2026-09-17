import { Home, Wallet, TrendingUp, Users, History, User, Target } from "lucide-react";

const TABS = [
  { id: "home",     label: "Inicio",   icono: Home },
  { id: "cuentas",  label: "Cuentas",  icono: Wallet },
  { id: "ingresos", label: "Ingresos", icono: TrendingUp },
  { id: "potes",    label: "Pot",      icono: Target },
  { id: "pagos",    label: "Pagos",    icono: History },
  { id: "grupos",   label: "Grupos",   icono: Users },
  { id: "perfil",   label: "Perfil",   icono: User },
];

export default function BottomNav({ vista, onCambiar }) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40">
      <div className="max-w-md mx-auto px-2 pb-3">
        <div className="bg-carbon/95 backdrop-blur-md rounded-2xl shadow-2xl flex justify-around items-center py-2 px-1">
          {TABS.map((tab) => {
            const Icono = tab.icono;
            const activo = vista === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onCambiar(tab.id)}
                className={`flex flex-col items-center gap-0.5 px-1.5 py-1 rounded-xl transition-all ${
                  activo ? "text-coral" : "text-white/60"
                }`}
              >
                <Icono size={18} strokeWidth={activo ? 2.4 : 2} />
                <span className={`text-[9px] font-medium ${activo ? "font-semibold" : ""}`}>
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}