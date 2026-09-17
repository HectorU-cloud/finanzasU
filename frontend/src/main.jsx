import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";

// --- Limpieza única de Service Workers viejos ---
// Cuando la PWA estuvo desactivada, algunos navegadores se quedaron con un
// Service Worker o caché vieja pegada. Esto la limpia UNA sola vez por
// navegador (marcado con localStorage) para no interferir con el Service
// Worker nuevo que la PWA vuelve a registrar normalmente después.
if ("serviceWorker" in navigator && !localStorage.getItem("sw_cleanup_v2")) {
  navigator.serviceWorker.getRegistrations().then((registros) => {
    registros.forEach((registro) => {
      registro.unregister().then((exito) => {
        if (exito) console.log("Service Worker viejo desinstalado");
      });
    });
  });
  if ("caches" in window) {
    caches.keys().then((nombres) => {
      nombres.forEach((nombre) => caches.delete(nombre));
    });
  }
  try {
    localStorage.setItem("sw_cleanup_v2", "1");
  } catch {
    // si localStorage falla, no es crítico: en el peor caso se reintenta la próxima carga
  }
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);