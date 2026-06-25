// ============================================================================
//  TESTS DEL MOTOR — criterios de aceptación.
//  Sin dependencias: corre con `node tests/scoring.test.mjs`  (o `npm test`).
//
//  T1..T7  -> modo "supervivencia" (sistema original: 1 pto por rival superado)
//  P1..P5  -> modo "podio" (DEFAULT: solo puntúan los primeros ceil(N/2) lugares)
// ============================================================================

import assert from "node:assert/strict";
import {
  calcularPosiciones,
  calcularPuntosPartida,
  calcularAcumulado,
  exportarEstado,
  importarEstado,
  lugaresQuePuntuan,
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

// Modo supervivencia explícito para los tests T1..T5.
const SURV = { modoPuntos: "supervivencia" };

// Helpers para construir mesas de relleno -------------------------------------
const filas = (n, prefijo = "f") =>
  Array.from({ length: n }, (_, i) => `${prefijo}${i + 1}`);

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

// ===========================================================================
//  SUPERVIVENCIA (T1..T7)
// ===========================================================================
test("T1 (surv): ganador de 8 = 7; ganador de 4 = 3; 4° de 8 = 4 > ganar de 4", () => {
  const mesa8 = [...filas(7), "GANA8"];
  assert.equal(puntosDe(mesa8, "GANA8", SURV), 7);

  const mesa4 = [...filas(3, "g"), "GANA4"];
  assert.equal(puntosDe(mesa4, "GANA4", SURV), 3);

  const mesa8b = ["a", "b", "c", "d", "CUARTO", "e", "f", "g"];
  assert.equal(posicionDe(mesa8b, "CUARTO"), 4);
  assert.equal(puntosDe(mesa8b, "CUARTO", SURV), 4);
});

test("T2: primer eliminado = posición N; último en pie = posición 1", () => {
  const orden = ["A", "B", "C", "D", "E"]; // N=5; A primer eliminado, E ganador
  const { N, posiciones } = calcularPosiciones(orden);
  assert.equal(N, 5);
  assert.equal(posiciones.find((p) => p.jugadorId === "A").posicion, 5);
  assert.equal(posiciones.find((p) => p.jugadorId === "E").posicion, 1);
});

test("T3 (surv): por total, Pedro (19 en 3 PJ) lidera a Juan (6 en 2 PJ)", () => {
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
  const ranking = calcularAcumulado(jugadores, partidas, { ...SURV, metricaRanking: "total" });
  const pedro = ranking.find((r) => r.jugadorId === "PEDRO");
  const juan = ranking.find((r) => r.jugadorId === "JUAN");
  assert.equal(pedro.total, 19);
  assert.equal(pedro.PJ, 3);
  assert.equal(juan.total, 6);
  assert.equal(ranking[0].jugadorId, "PEDRO");
});

test("T4 (surv): promedio Pedro ≈ 6.33, Juan = 3.0; Pedro sigue arriba", () => {
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
  const ranking = calcularAcumulado(jugadores, partidas, { ...SURV, metricaRanking: "promedio" });
  const pedro = ranking.find((r) => r.jugadorId === "PEDRO");
  const juan = ranking.find((r) => r.jugadorId === "JUAN");
  assert.ok(Math.abs(pedro.promedio - 19 / 3) < 1e-9);
  assert.equal(juan.promedio, 3.0);
  assert.equal(ranking[0].jugadorId, "PEDRO");
});

test("T5 (surv): con bonoVictoria=3, ganar mesa de 4 = 6 > 4° de 8 = 4", () => {
  const mesa4 = [...filas(3, "g"), "GANA4"];
  assert.equal(puntosDe(mesa4, "GANA4", { ...SURV, bonoVictoria: 3 }), 6);
  const mesa8 = ["a", "b", "c", "d", "CUARTO", "e", "f", "g"];
  assert.equal(puntosDe(mesa8, "CUARTO", { ...SURV, bonoVictoria: 3 }), 4);
});

test("T6: exportar -> importar reconstruye exactamente el mismo estado", () => {
  const estado = {
    jugadores: [
      { id: "1", nombre: "Ana", activo: true },
      { id: "2", nombre: "Beto", activo: false },
    ],
    partidas: [{ id: "p1", fecha: "2026-06-23", ordenEliminacion: ["1", "2"] }],
    configuracion: {
      modoPuntos: "supervivencia",
      bonoVictoria: 3,
      puntoParticipacion: 1,
      metricaRanking: "promedio",
    },
  };
  const json = exportarEstado(estado);
  const reconstruido = importarEstado(json);
  assert.deepEqual(reconstruido, estado);
});

test("T7 (surv): empate entre dos jugadores -> misma posición y mismos puntos", () => {
  const orden = ["A", ["B", "C"], "D"]; // N=4
  const res = calcularPuntosPartida(orden, SURV);
  const b = res.find((r) => r.jugadorId === "B");
  const c = res.find((r) => r.jugadorId === "C");
  assert.equal(b.posicion, 2.5);
  assert.equal(c.posicion, 2.5);
  assert.equal(b.puntos, c.puntos);
  assert.equal(b.puntos, 4 - 2.5); // 1.5
});

// ===========================================================================
//  PODIO (P1..P5) — modo por defecto
// ===========================================================================
test("P1: lugaresQuePuntuan = mitad superior (ceil N/2)", () => {
  assert.equal(lugaresQuePuntuan(7), 4);
  assert.equal(lugaresQuePuntuan(6), 3);
  assert.equal(lugaresQuePuntuan(5), 3);
  assert.equal(lugaresQuePuntuan(4), 2);
  assert.equal(lugaresQuePuntuan(3), 2);
  assert.equal(lugaresQuePuntuan(2), 1);
});

test("P2: mesa de 7 -> 7,6,5,4 arriba; 5°,6°,7° = 0", () => {
  // a..f eliminados en ese orden, W gana. ranks: a=7,b=6,c=5,d=4,e=3,f=2,W=1
  const orden = ["a", "b", "c", "d", "e", "f", "W"];
  const pts = (id) => puntosDe(orden, id); // default = podio
  assert.equal(pts("W"), 7); // 1° = N
  assert.equal(pts("f"), 6); // 2°
  assert.equal(pts("e"), 5); // 3°
  assert.equal(pts("d"), 4); // 4° (último que puntúa)
  assert.equal(pts("c"), 0); // 5°
  assert.equal(pts("b"), 0); // 6°
  assert.equal(pts("a"), 0); // 7°
});

test("P3: mesa grande vale más y reparte más que mesa chica", () => {
  const mesa7 = ["a", "b", "c", "d", "e", "f", "W7"];
  const mesa4 = ["g", "h", "i", "W4"];
  // El ganador de 7 (7) vale más que el de 4 (4).
  assert.equal(puntosDe(mesa7, "W7"), 7);
  assert.equal(puntosDe(mesa4, "W4"), 4);
  assert.ok(puntosDe(mesa7, "W7") > puntosDe(mesa4, "W4"));
  // Total repartido: mesa7 = 7+6+5+4 = 22 ; mesa4 = 4+3 = 7.
  const suma = (orden) =>
    calcularPuntosPartida(orden).reduce((s, r) => s + r.puntos, 0);
  assert.equal(suma(mesa7), 22);
  assert.equal(suma(mesa4), 7);
  assert.ok(suma(mesa7) > suma(mesa4));
});

test("P4: empate justo en el corte se promedia (4°+5° de 7 -> 2 c/u)", () => {
  // grupo [c,d] cae cuando cursor=5 -> ocupa puestos 5 y 4 -> (0 + 4)/2 = 2.
  const orden = ["a", "b", ["c", "d"], "e", "f", "W"]; // N=7
  const res = calcularPuntosPartida(orden); // podio
  const c = res.find((r) => r.jugadorId === "c");
  const d = res.find((r) => r.jugadorId === "d");
  assert.equal(c.posicion, 4.5);
  assert.equal(c.puntos, 2);
  assert.equal(c.puntos, d.puntos);
  // Y un empate dentro del dinero (3°+4°) -> (5 + 4)/2 = 4.5 c/u.
  const orden2 = ["a", "b", "c", ["d", "e"], "f", "W"]; // [d,e] ocupa 4 y 3
  const res2 = calcularPuntosPartida(orden2);
  const d2 = res2.find((r) => r.jugadorId === "d");
  assert.equal(d2.puntos, 4.5);
});

test("P5: bonoVictoria solo al ganador en modo podio", () => {
  const orden = ["a", "b", "c", "d", "e", "f", "W"]; // mesa 7
  assert.equal(puntosDe(orden, "W", { bonoVictoria: 3 }), 10); // 7 + 3
  assert.equal(puntosDe(orden, "f", { bonoVictoria: 3 }), 6); // 2° sin bono
});

// ===========================================================================
console.log(`\nResultado: ${pasados} pasados, ${fallidos} fallidos\n`);
if (fallidos > 0) process.exit(1);
