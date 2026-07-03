// ============================================================================
//  CAPA DE NUBE — sincroniza el estado con Supabase (REST, sin dependencias).
//
//  Modelo simple: UNA fila compartida en la tabla "liga" guarda todo el estado
//  (jugadores, partidas, configuración) como JSON. Todos leen y escriben esa
//  misma fila -> todos ven lo mismo. Último que guarda, gana (suficiente para
//  un grupo de amigos).
//
//  Si no hay configuración de nube, todo queda deshabilitado y la app funciona
//  100% local.
// ============================================================================

import { SUPABASE_URL, SUPABASE_ANON_KEY, LIGA_ID } from "./config.js";

/** ¿Está configurada la nube? */
export function nubeActiva() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

function headers(extra = {}) {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    ...extra,
  };
}

/**
 * Lee la liga desde la nube.
 * @returns {Promise<{estado: object|null, updatedAt: string|null} | null>}
 *   null si la nube no está activa; estado=null si aún no hay fila creada.
 */
export async function cargarDeNube() {
  if (!nubeActiva()) return null;
  const url = `${SUPABASE_URL}/rest/v1/liga?id=eq.${encodeURIComponent(LIGA_ID)}&select=estado,updated_at`;
  const r = await fetch(url, { headers: headers() });
  if (!r.ok) throw new Error("Error al leer la nube: HTTP " + r.status);
  const filas = await r.json();
  if (!filas.length) return { estado: null, updatedAt: null };
  return { estado: filas[0].estado, updatedAt: filas[0].updated_at };
}

/**
 * Guarda (upsert) todo el estado en la nube.
 * @returns {Promise<string|null>} la marca de tiempo guardada, o null si no hay nube.
 */
export async function guardarEnNube(estado) {
  if (!nubeActiva()) return null;
  const updated_at = new Date().toISOString();
  const r = await fetch(`${SUPABASE_URL}/rest/v1/liga`, {
    method: "POST",
    headers: headers({
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    }),
    body: JSON.stringify([{ id: LIGA_ID, estado, updated_at }]),
  });
  if (!r.ok) throw new Error("Error al guardar en la nube: HTTP " + r.status);
  return updated_at;
}
