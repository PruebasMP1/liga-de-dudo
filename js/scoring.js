// ============================================================================
//  MOTOR DE PUNTUACIÓN — Liga de Dudo
//  Módulo PURO: no toca el DOM, no usa localStorage, no depende de la UI.
//  Se puede importar igual desde el navegador (<script type="module">) o
//  desde Node (tests). Toda la lógica de "cuántos puntos vale cada partida"
//  y "cómo queda el ranking" vive aquí, y solo aquí.
// ============================================================================

/**
 * Configuración por defecto del torneo.
 * - modoPuntos:         "podio" (DEFAULT) | "supervivencia".
 * - bonoVictoria:       puntos extra SOLO para el ganador (posición 1). Default 0.
 * - puntoParticipacion: puntos para todos por jugar (solo modo supervivencia). Default 0.
 * - metricaRanking:     "total" (suma, modelo campeonato) | "promedio".
 */
export const CONFIG_POR_DEFECTO = Object.freeze({
  modoPuntos: "podio",
  bonoVictoria: 0,
  puntoParticipacion: 0,
  metricaRanking: "total",
});

/**
 * Cuántos lugares puntúan en una mesa de N jugadores (modo "podio").
 * Regla: la mitad superior, redondeando hacia arriba.
 *   N=7 -> 4 ;  N=6 -> 3 ;  N=5 -> 3 ;  N=4 -> 2 ;  N=3 -> 2 ;  N=2 -> 1.
 */
export function lugaresQuePuntuan(N) {
  return Math.ceil(N / 2);
}

/**
 * Normaliza el orden de eliminación a una lista de "grupos".
 * Cada entrada del array puede ser:
 *   - un jugadorId (string)            -> eliminación individual
 *   - un array de jugadorIds           -> empate (eliminados a la vez)
 * Siempre devuelve un array de arrays, para tratar todo de forma uniforme.
 *
 * index 0 = primer eliminado (último lugar). último index = ganador.
 */
export function normalizarGrupos(ordenEliminacion) {
  return ordenEliminacion.map((entrada) =>
    Array.isArray(entrada) ? entrada.slice() : [entrada]
  );
}

/**
 * A partir del orden de eliminación calcula la posición final de cada jugador.
 *
 * Regla:
 *   - El primer eliminado ocupa la posición N (último lugar).
 *   - El último en pie ocupa la posición 1 (ganador).
 *   - Si hay empate (grupo de >1), todos reciben la posición PROMEDIADA
 *     (ranking fraccional) de los puestos que ocuparían.
 *
 * Devuelve { N, posiciones: [{ jugadorId, posicion }] }.
 */
export function calcularPosiciones(ordenEliminacion) {
  const grupos = normalizarGrupos(ordenEliminacion);
  const N = grupos.reduce((suma, g) => suma + g.length, 0);

  const posiciones = [];
  let cursor = N; // peor puesto disponible (empieza en N = último lugar).

  for (const grupo of grupos) {
    const tam = grupo.length;
    const posicionPromediada = cursor - (tam - 1) / 2;
    for (const jugadorId of grupo) {
      posiciones.push({ jugadorId, posicion: posicionPromediada });
    }
    cursor -= tam;
  }

  return { N, posiciones };
}

/**
 * Puntos que vale un PUESTO ENTERO p (1 = ganador, N = último) en una mesa de N.
 *
 * - "podio": solo puntúan los primeros M = ceil(N/2) lugares. El ganador vale N
 *            y baja de a 1 por puesto hasta el corte; el resto vale 0. Así, la
 *            mesa grande reparte más puntos y premia más arriba.
 *            (mesa 7: 7,6,5,4,0,0,0 ; mesa 4: 4,3,0,0)
 * - "supervivencia": ganas 1 punto por cada rival que dejas atrás: (N - p).
 *
 * Se le suma bonoVictoria si p === 1, y (solo en supervivencia) puntoParticipacion.
 */
function puntosDePuesto(p, N, cfg) {
  let puntos;
  if (cfg.modoPuntos === "supervivencia") {
    puntos = (N - p) + cfg.puntoParticipacion;
  } else {
    const M = lugaresQuePuntuan(N);
    puntos = p <= M ? (N - p + 1) : 0;
  }
  if (p === 1) puntos += cfg.bonoVictoria;
  return puntos;
}

/**
 * Puntos de UNA partida para cada jugador presente.
 *
 * Para repartir de forma justa los empates, cada grupo empatado recibe el
 * PROMEDIO de los puntos de los puestos enteros que ocupa (no el puntaje de la
 * posición promediada). Esto importa en "podio", donde el corte no es lineal:
 * un empate entre 4° y 5° en mesa de 7 reparte (4 + 0) / 2 = 2 a cada uno.
 *
 * Devuelve [{ jugadorId, posicion, puntos }].
 */
export function calcularPuntosPartida(ordenEliminacion, config = {}) {
  const cfg = { ...CONFIG_POR_DEFECTO, ...config };
  const grupos = normalizarGrupos(ordenEliminacion);
  const N = grupos.reduce((suma, g) => suma + g.length, 0);

  const resultado = [];
  let cursor = N; // peor puesto entero disponible.

  for (const grupo of grupos) {
    const tam = grupo.length;
    // Puestos enteros que ocupa el grupo: cursor, cursor-1, ..., cursor-tam+1.
    let sumaPos = 0;
    let sumaPts = 0;
    for (let k = 0; k < tam; k++) {
      const p = cursor - k;
      sumaPos += p;
      sumaPts += puntosDePuesto(p, N, cfg);
    }
    const posicion = sumaPos / tam;
    const puntos = sumaPts / tam;
    for (const jugadorId of grupo) {
      resultado.push({ jugadorId, posicion, puntos });
    }
    cursor -= tam;
  }

  return resultado;
}

/**
 * Ranking acumulado de la temporada.
 *
 * @param {Array} jugadores  [{ id, nombre, activo }]
 * @param {Array} partidas   [{ id, fecha, ordenEliminacion }]
 * @param {Object} config    configuración del torneo
 * @returns filas ordenadas: [{ jugadorId, nombre, PJ, total, promedio,
 *                              victorias, mejorPuesto, peorPuesto }]
 *
 * Orden:  por metricaRanking ("total" por defecto, o "promedio").
 * Desempates: 1) más victorias, 2) mejor promedio, 3) orden alfabético.
 */
export function calcularAcumulado(jugadores, partidas, config = {}) {
  const cfg = { ...CONFIG_POR_DEFECTO, ...config };
  const nombreDe = (id) =>
    jugadores.find((j) => j.id === id)?.nombre ?? id;

  const acc = new Map(); // jugadorId -> stats acumuladas

  for (const partida of partidas) {
    const resultados = calcularPuntosPartida(partida.ordenEliminacion, cfg);
    for (const r of resultados) {
      if (!acc.has(r.jugadorId)) {
        acc.set(r.jugadorId, {
          jugadorId: r.jugadorId,
          PJ: 0,
          total: 0,
          victorias: 0,
          mejorPuesto: Infinity,
          peorPuesto: -Infinity,
        });
      }
      const s = acc.get(r.jugadorId);
      s.PJ += 1;
      s.total += r.puntos;
      if (r.posicion === 1) s.victorias += 1;
      s.mejorPuesto = Math.min(s.mejorPuesto, r.posicion);
      s.peorPuesto = Math.max(s.peorPuesto, r.posicion);
    }
  }

  const filas = [...acc.values()].map((s) => ({
    ...s,
    nombre: nombreDe(s.jugadorId),
    promedio: s.PJ ? s.total / s.PJ : 0,
  }));

  filas.sort((a, b) => {
    const metA = cfg.metricaRanking === "promedio" ? a.promedio : a.total;
    const metB = cfg.metricaRanking === "promedio" ? b.promedio : b.total;
    if (metB !== metA) return metB - metA;                 // métrica principal
    if (b.victorias !== a.victorias) return b.victorias - a.victorias; // 1) victorias
    if (b.promedio !== a.promedio) return b.promedio - a.promedio;     // 2) promedio
    return a.nombre.localeCompare(b.nombre, "es");          // 3) alfabético
  });

  return filas;
}

// ----------------------------------------------------------------------------
//  Respaldo: exportar / importar TODO el estado como JSON.
//  Son funciones puras para poder testear el round-trip.
// ----------------------------------------------------------------------------

/** Convierte el estado completo a un string JSON legible. */
export function exportarEstado(estado) {
  return JSON.stringify(estado, null, 2);
}

/**
 * Reconstruye el estado desde un JSON (string u objeto), rellenando defaults
 * para que importar un respaldo viejo nunca rompa la app.
 */
export function importarEstado(json) {
  const obj = typeof json === "string" ? JSON.parse(json) : json;
  return {
    jugadores: Array.isArray(obj.jugadores) ? obj.jugadores : [],
    partidas: Array.isArray(obj.partidas) ? obj.partidas : [],
    configuracion: { ...CONFIG_POR_DEFECTO, ...(obj.configuracion ?? {}) },
  };
}
