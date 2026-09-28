import {
  LayoutDashboard,
  CreditCard,
  ReceiptText,
  BarChart3,
  Settings,
  Wallet,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";

const navigation = [
  {
    id: "inicio",
    label: "Inicio",
    icon: LayoutDashboard,
  },
  {
    id: "tarjetas",
    label: "Tarjetas",
    icon: CreditCard,
  },
  {
    id: "movimientos",
    label: "Movimientos",
    icon: ReceiptText,
  },
  {
    id: "analisis",
    label: "Análisis",
    icon: BarChart3,
  },
];

export default function AppLayout({
  children,
  currentView = "inicio",
  onNavigate,
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  function handleNavigate(view) {
    onNavigate?.(view);
    setMobileMenuOpen(false);
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-logo">
            <Wallet size={20} />
          </div>

          <div>
            <strong>FinanzasU</strong>
            <span>Personal Finance</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;

            return (
              <button
                key={item.id}
                className={`nav-item ${isActive ? "active" : ""}`}
                onClick={() => handleNavigate(item.id)}
              >
                <Icon size={19} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <button
            className={`nav-item ${
              currentView === "configuracion" ? "active" : ""
            }`}
            onClick={() => handleNavigate("configuracion")}
          >
            <Settings size={19} />
            <span>Configuración</span>
          </button>
        </div>
      </aside>

      <header className="mobile-header">
        <div className="mobile-brand">
          <div className="sidebar-logo">
            <Wallet size={18} />
          </div>

          <strong>FinanzasU</strong>
        </div>

        <button
          className="mobile-menu-button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? <X size={21} /> : <Menu size={21} />}
        </button>
      </header>

      {mobileMenuOpen && (
        <div className="mobile-menu">
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;

            return (
              <button
                key={item.id}
                className={`mobile-nav-item ${
                  isActive ? "active" : ""
                }`}
                onClick={() => handleNavigate(item.id)}
              >
                <Icon size={20} />
                {item.label}
              </button>
            );
          })}

          <button
            className={`mobile-nav-item ${
              currentView === "configuracion" ? "active" : ""
            }`}
            onClick={() => handleNavigate("configuracion")}
          >
            <Settings size={20} />
            Configuración
          </button>
        </div>
      )}

      <main className="main-content">
        {children}
      </main>

      <nav className="bottom-navigation">
        <button
          className={`bottom-nav-item ${
            currentView === "inicio" ? "active" : ""
          }`}
          onClick={() => handleNavigate("inicio")}
        >
          <LayoutDashboard size={20} />
          <span>Inicio</span>
        </button>

        <button
          className={`bottom-nav-item ${
            currentView === "tarjetas" ? "active" : ""
          }`}
          onClick={() => handleNavigate("tarjetas")}
        >
          <CreditCard size={20} />
          <span>Tarjetas</span>
        </button>

        <button
          className="bottom-add-button"
          onClick={() => handleNavigate("movimientos")}
          title="Registrar gasto"
        >
          <ReceiptText size={22} />
        </button>

        <button
          className={`bottom-nav-item ${
            currentView === "analisis" ? "active" : ""
          }`}
          onClick={() => handleNavigate("analisis")}
        >
          <BarChart3 size={20} />
          <span>Análisis</span>
        </button>

        <button
          className={`bottom-nav-item ${
            currentView === "configuracion" ? "active" : ""
          }`}
          onClick={() => handleNavigate("configuracion")}
        >
          <Settings size={20} />
          <span>Ajustes</span>
        </button>
      </nav>
    </div>
  );
}