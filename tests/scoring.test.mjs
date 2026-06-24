// ============================================================================
//  TESTS DEL MOTOR — criterios de aceptación T1..T7.
//  Sin dependencias: corre con `node tests/scoring.test.mjs`  (o `npm test`).
// ============================================================================

import assert from "node:assert/strict";
import {
  calcularPosiciones,
  calcularPuntosPartida,
  calcularAcumulado,
  exportarEstado,
  importarEstado,
} from "../js/scoring.js";

let pasados = 0;
let fallidos = 0;

function test(nombre, fn) {
  try {
    fn();
    pasados++;
    console.log(`  ✓ ${nombre}`);
  } catch (err) {
    fallidos++;
    console.error(`  ✗ ${nombre}`);
    console.error(`      ${err.message}`);
  }
}

// Helpers para construir mesas de relleno -------------------------------------
const filas = (n, prefijo = "f") =>
  Array.from({ length: n }, (_, i) => `${prefijo}${i + 1}`);

// Devuelve los puntos de un jugadorId en una partida.
function puntosDe(orden, jugadorId, config) {
  const r = calcularPuntosPartida(orden, config).find(
    (x) => x.jugadorId === jugadorId
  );
  return r ? r.puntos : null;
}
function posicionDe(orden, jugadorId) {
  return calcularPosiciones(orden).posiciones.find(
    (x) => x.jugadorId === jugadorId
  ).posicion;
}

console.log("\nLiga de Dudo — tests del motor de puntuación\n");

// ---------------------------------------------------------------------------
// T1 — mesa grande vale más
// ---------------------------------------------------------------------------
test("T1: ganador de 8 = 7 pts; ganador de 4 = 3 pts; 4° de 8 = 4 > ganar de 4", () => {
  // Mesa de 8: index 0 = primer eliminado, último = ganador.
  const mesa8 = [...filas(7), "GANA8"]; // GANA8 es el último en pie
  assert.equal(puntosDe(mesa8, "GANA8"), 7);

  const mesa4 = [...filas(3, "g"), "GANA4"];
  assert.equal(puntosDe(mesa4, "GANA4"), 3);

  // 4° de 8 -> posición 4 -> puntos 8-4 = 4. posición 4 = index N-4 = 4.
  const mesa8b = ["a", "b", "c", "d", "CUARTO", "e", "f", "g"];
  assert.equal(posicionDe(mesa8b, "CUARTO"), 4);
  assert.equal(puntosDe(mesa8b, "CUARTO"), 4);

  assert.ok(4 > 3, "sobrevivir 4° de 8 supera a ganar mesa de 4");
});

// ---------------------------------------------------------------------------
// T2 — orden -> posiciones
// ---------------------------------------------------------------------------
test("T2: primer eliminado = posición N; último en pie = posición 1", () => {
  const orden = ["A", "B", "C", "D", "E"]; // N=5; A primer eliminado, E ganador
  const { N, posiciones } = calcularPosiciones(orden);
  assert.equal(N, 5);
  assert.equal(posiciones.find((p) => p.jugadorId === "A").posicion, 5);
  assert.equal(posiciones.find((p) => p.jugadorId === "E").posicion, 1);
});

// ---------------------------------------------------------------------------
// T3 — suma premia asistencia + tamaño de mesa
// ---------------------------------------------------------------------------
test("T3: por total, Pedro (19 en 3 PJ) lidera a Juan (6 en 2 PJ)", () => {
  const jugadores = [
    { id: "PEDRO", nombre: "Pedro", activo: true },
    { id: "JUAN", nombre: "Juan", activo: true },
  ];

  // Pedro gana 2 mesas de 8 (7 pts c/u) y sale 3° en otra (5 pts).
  const ganaMesa8 = (id) => [...filas(7), id]; // id ganador (pos 1 -> 7 pts)
  // 3° de 8 -> posición 3 -> index 8-3 = 5.
  const tercerMesa8 = (id) => {
    const arr = filas(7);
    arr.splice(5, 0, id); // queda en index 5 dentro de un array de 8
    return arr;
  };

  const partidas = [
    { id: "p1", fecha: "2026-01-01", ordenEliminacion: ganaMesa8("PEDRO") },
    { id: "p2", fecha: "2026-01-01", ordenEliminacion: ganaMesa8("PEDRO") },
    { id: "p3", fecha: "2026-01-02", ordenEliminacion: tercerMesa8("PEDRO") },
    { id: "p4", fecha: "2026-01-03", ordenEliminacion: [...filas(3, "g"), "JUAN"] },
    { id: "p5", fecha: "2026-01-03", ordenEliminacion: [...filas(3, "h"), "JUAN"] },
  ];

  const ranking = calcularAcumulado(jugadores, partidas, { metricaRanking: "total" });
  const pedro = ranking.find((r) => r.jugadorId === "PEDRO");
  const juan = ranking.find((r) => r.jugadorId === "JUAN");

  assert.equal(pedro.total, 19);
  assert.equal(pedro.PJ, 3);
  assert.equal(juan.total, 6);
  assert.equal(juan.PJ, 2);
  assert.equal(ranking[0].jugadorId, "PEDRO"); // lidera por total
});

// ---------------------------------------------------------------------------
// T4 — promedio neutraliza asistencia
// ---------------------------------------------------------------------------
test("T4: promedio Pedro ≈ 6.33, Juan = 3.0; Pedro sigue arriba", () => {
  const jugadores = [
    { id: "PEDRO", nombre: "Pedro", activo: true },
    { id: "JUAN", nombre: "Juan", activo: true },
  ];
  const ganaMesa8 = (id) => [...filas(7), id];
  const tercerMesa8 = (id) => {
    const arr = filas(7);
    arr.splice(5, 0, id);
    return arr;
  };
  const partidas = [
    { id: "p1", fecha: "x", ordenEliminacion: ganaMesa8("PEDRO") },
    { id: "p2", fecha: "x", ordenEliminacion: ganaMesa8("PEDRO") },
    { id: "p3", fecha: "x", ordenEliminacion: tercerMesa8("PEDRO") },
    { id: "p4", fecha: "x", ordenEliminacion: [...filas(3, "g"), "JUAN"] },
    { id: "p5", fecha: "x", ordenEliminacion: [...filas(3, "h"), "JUAN"] },
  ];
  const ranking = calcularAcumulado(jugadores, partidas, { metricaRanking: "promedio" });
  const pedro = ranking.find((r) => r.jugadorId === "PEDRO");
  const juan = ranking.find((r) => r.jugadorId === "JUAN");

  assert.ok(Math.abs(pedro.promedio - 19 / 3) < 1e-9);
  assert.equal(juan.promedio, 3.0);
  assert.equal(ranking[0].jugadorId, "PEDRO");
});

// ---------------------------------------------------------------------------
// T5 — bono de victoria
// ---------------------------------------------------------------------------
test("T5: con bonoVictoria=3, ganar mesa de 4 = 6 > 4° de 8 = 4", () => {
  const mesa4 = [...filas(3, "g"), "GANA4"];
  assert.equal(puntosDe(mesa4, "GANA4", { bonoVictoria: 3 }), 6);

  const mesa8 = ["a", "b", "c", "d", "CUARTO", "e", "f", "g"];
  // El bono NO aplica al 4°, solo al ganador.
  assert.equal(puntosDe(mesa8, "CUARTO", { bonoVictoria: 3 }), 4);
  assert.ok(6 > 4);
});

// ---------------------------------------------------------------------------
// T6 — respaldo: exportar -> importar reconstruye el mismo estado
// ---------------------------------------------------------------------------
test("T6: exportar -> importar reconstruye exactamente el mismo estado", () => {
  const estado = {
    jugadores: [
      { id: "1", nombre: "Ana", activo: true },
      { id: "2", nombre: "Beto", activo: false },
    ],
    partidas: [
      { id: "p1", fecha: "2026-06-23", ordenEliminacion: ["1", "2"] },
    ],
    configuracion: { bonoVictoria: 3, puntoParticipacion: 1, metricaRanking: "promedio" },
  };
  const json = exportarEstado(estado);
  const reconstruido = importarEstado(json);
  assert.deepEqual(reconstruido, estado);
});

// ---------------------------------------------------------------------------
// T7 — empate (raro): posición promediada -> mismos puntos
// ---------------------------------------------------------------------------
test("T7: empate entre dos jugadores -> misma posición y mismos puntos", () => {
  // Mesa de 4: A primer eliminado, luego B y C empatan, D gana.
  const orden = ["A", ["B", "C"], "D"]; // N=4
  const res = calcularPuntosPartida(orden);
  const b = res.find((r) => r.jugadorId === "B");
  const c = res.find((r) => r.jugadorId === "C");

  assert.equal(b.posicion, 2.5); // promedio de los puestos 3 y 2
  assert.equal(c.posicion, 2.5);
  assert.equal(b.puntos, c.puntos);
  assert.equal(b.puntos, 4 - 2.5); // 1.5
});

// ---------------------------------------------------------------------------
console.log(`\nResultado: ${pasados} pasados, ${fallidos} fallidos\n`);
if (fallidos > 0) process.exit(1);
