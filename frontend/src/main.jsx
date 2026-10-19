import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { ToastProvider } from "./ToastContext.jsx";
import "./index.css";

// --- Limpieza de Service Workers viejos (PWA desactivada temporalmente) ---
// Este bloque desinstala cualquier Service Worker que se haya quedado
// pegado en el navegador de versiones anteriores de la app.

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </React.StrictMode>
);