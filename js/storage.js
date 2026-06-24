// ============================================================================
//  PERSISTENCIA LOCAL — guarda el estado en el navegador (localStorage).
//  Local-first: nada sale de tu dispositivo. Sin servidor, sin nube, gratis.
// ============================================================================

import { CONFIG_POR_DEFECTO } from "./scoring.js";

const CLAVE = "liga-de-dudo-v1";

export const ESTADO_INICIAL = {
  jugadores: [],   // { id, nombre, activo }
  partidas: [],    // { id, fecha, ordenEliminacion }
  configuracion: { ...CONFIG_POR_DEFECTO },
};

/** Lee el estado guardado; si no hay nada (o está corrupto) devuelve el inicial. */
export function cargarEstado() {
  try {
    const raw = localStorage.getItem(CLAVE);
    if (!raw) return structuredClone(ESTADO_INICIAL);
    const obj = JSON.parse(raw);
    return {
      jugadores: Array.isArray(obj.jugadores) ? obj.jugadores : [],
      partidas: Array.isArray(obj.partidas) ? obj.partidas : [],
      configuracion: { ...CONFIG_POR_DEFECTO, ...(obj.configuracion ?? {}) },
    };
  } catch (e) {
    console.error("No se pudo leer el estado, empezando de cero:", e);
    return structuredClone(ESTADO_INICIAL);
  }
}

/** Guarda el estado completo. */
export function guardarEstado(estado) {
  localStorage.setItem(CLAVE, JSON.stringify(estado));
}

/** Genera un id único simple (suficiente para uso local). */
export function idNuevo() {
  return (
    "id-" +
    Math.random().toString(36).slice(2, 10) +
    "-" +
    Date.now().toString(36)
  );
}
