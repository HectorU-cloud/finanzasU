// frontend/src/utils/fechas.js

/**
 * Calcula la fecha límite de pago de una tarjeta según su corte y día de pago.
 * 
 * Regla:
 * - Si las compras son antes del corte → cierran este mes.
 * - Si son después del corte → cierran el mes siguiente.
 * - El pago es el mismo mes del cierre si diaPago > diaCorte, si no, el mes siguiente.
 */
export function calcularVencimiento(diaCorte, diaPago) {
  const hoy = new Date();
  const diaHoy = hoy.getDate();
  const anio = hoy.getFullYear();
  const mes = hoy.getMonth(); // 0-indexed

  // PASO 1: ¿A qué ciclo pertenecen las compras actuales?
  let mesCorte = mes;
  let anioCorte = anio;
  if (diaHoy > diaCorte) {
    mesCorte++;
    if (mesCorte > 11) {
      mesCorte = 0;
      anioCorte++;
    }
  }

  // PASO 2: ¿Cuándo se paga ese ciclo?
  let mesPago = mesCorte;
  let anioPago = anioCorte;
  if (diaPago <= diaCorte) {
    mesPago++;
    if (mesPago > 11) {
      mesPago = 0;
      anioPago++;
    }
  }

  const fechaLimite = new Date(anioPago, mesPago, diaPago);
  const diasRestantes = Math.ceil(
    (fechaLimite.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24)
  );

  return {
    fechaLimite,
    diasRestantes,
    urgente: diasRestantes <= 2,
  };
}