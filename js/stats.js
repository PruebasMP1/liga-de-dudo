// ============================================================================
//  MOTOR DE ESTADÍSTICAS AVANZADAS — Liga de Dudo (Hito 4)
//  Módulo PURO (sin UI, sin almacenamiento). Agrega las estadísticas
//  detalladas de cada partida en totales de temporada por jugador.
//
//  Importante: estas estadísticas son DESCRIPTIVAS. No afectan los puntos del
//  ranking (eso lo decide scoring.js por supervivencia). Son una capa aparte.
//
//  Estructura de stats dentro de una Partida (todo opcional):
//    partida.stats = {
//      rondas: number,
//      porJugador: {
//        [jugadorId]: { dudosAcertados, dudosFallados,
//                       calzosLogrados, calzosFallados, dadosPerdidos }
//      }
//    }
// ============================================================================

/** Contador en blanco para un jugador en una partida. */
export function statsVacia() {
  return {
    dudosAcertados: 0,
    dudosFallados: 0,
    calzosLogrados: 0,
    calzosFallados: 0,
    dadosPerdidos: 0,
  };
}

const num = (v) => Number(v) || 0;

/** ¿El objeto de stats trae algún dato real (algo > 0)? Si no, no se guarda. */
export function statsTieneDatos(stats) {
  if (!stats) return false;
  if (num(stats.rondas) > 0) return true;
  return Object.values(stats.porJugador ?? {}).some(
    (s) =>
      num(s.dudosAcertados) +
        num(s.dudosFallados) +
        num(s.calzosLogrados) +
        num(s.calzosFallados) +
        num(s.dadosPerdidos) >
      0
  );
}

/**
 * Agrega las estadísticas de todas las partidas (que tengan stats) en totales
 * por jugador, más un resumen de temporada.
 *
 * @returns {{
 *   jugadores: Array,        // fila por jugador con totales y porcentajes derivados
 *   partidasConStats: number,
 *   totalRondas: number,
 *   promedioRondas: number
 * }}
 *
 * Derivados por jugador:
 *   dudosTotal, dudosPct (acertados/total, o null si no hubo dudos)
 *   calzosTotal, calzosPct (logrados/total, o null si no hubo calzos)
 *   dadosPerdidosProm (dados perdidos / partidas con stats jugadas)
 */
export function calcularEstadisticas(jugadores, partidas) {
  const nombreDe = (id) => jugadores.find((j) => j.id === id)?.nombre ?? id;

  const acc = new Map();
  let totalRondas = 0;
  let partidasConStats = 0;

  for (const p of partidas) {
    if (!statsTieneDatos(p.stats)) continue;
    partidasConStats++;
    totalRondas += num(p.stats.rondas);

    for (const [id, s] of Object.entries(p.stats.porJugador ?? {})) {
      if (!acc.has(id)) {
        acc.set(id, {
          jugadorId: id,
          partidas: 0,
          dudosAcertados: 0,
          dudosFallados: 0,
          calzosLogrados: 0,
          calzosFallados: 0,
          dadosPerdidos: 0,
        });
      }
      const a = acc.get(id);
      a.partidas += 1;
      a.dudosAcertados += num(s.dudosAcertados);
      a.dudosFallados += num(s.dudosFallados);
      a.calzosLogrados += num(s.calzosLogrados);
      a.calzosFallados += num(s.calzosFallados);
      a.dadosPerdidos += num(s.dadosPerdidos);
    }
  }

  const filas = [...acc.values()].map((a) => {
    const dudosTotal = a.dudosAcertados + a.dudosFallados;
    const calzosTotal = a.calzosLogrados + a.calzosFallados;
    return {
      ...a,
      nombre: nombreDe(a.jugadorId),
      dudosTotal,
      dudosPct: dudosTotal ? a.dudosAcertados / dudosTotal : null,
      calzosTotal,
      calzosPct: calzosTotal ? a.calzosLogrados / calzosTotal : null,
      dadosPerdidosProm: a.partidas ? a.dadosPerdidos / a.partidas : 0,
    };
  });

  // Orden por defecto: mejor puntería en dudos primero (los sin dudos al final).
  filas.sort(
    (x, y) =>
      (y.dudosPct ?? -1) - (x.dudosPct ?? -1) ||
      y.dudosTotal - x.dudosTotal ||
      x.nombre.localeCompare(y.nombre, "es")
  );

  return {
    jugadores: filas,
    partidasConStats,
    totalRondas,
    promedioRondas: partidasConStats ? totalRondas / partidasConStats : 0,
  };
}
