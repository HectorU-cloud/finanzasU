import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";

// --- Limpieza de Service Workers viejos (PWA desactivada temporalmente) ---
// Este bloque desinstala cualquier Service Worker que se haya quedado
// pegado en el navegador de versiones anteriores de la app.
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then((registros) => {
    registros.forEach((registro) => {
      registro.unregister().then((exito) => {
        if (exito) console.log("Service Worker viejo desinstalado");
      });
    });
  });
  // También limpia las cachés guardadas por el SW.
  if ("caches" in window) {
    caches.keys().then((nombres) => {
      nombres.forEach((nombre) => caches.delete(nombre));
    });
  }
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);