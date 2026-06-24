// ============================================================================
//  TESTS del motor de ESTADÍSTICAS AVANZADAS (Hito 4).
//  Corre con:  node tests/stats.test.mjs   (o  npm test)
// ============================================================================

import assert from "node:assert/strict";
import {
  statsVacia,
  statsTieneDatos,
  calcularEstadisticas,
} from "../js/stats.js";

let pasados = 0;
let fallidos = 0;
function test(nombre, fn) {
  try {
    fn();
    pasados++;
    console.log(`  ✓ ${nombre}`);
  } catch (err) {
    fallidos++;
    console.error(`  ✗ ${nombre}\n      ${err.message}`);
  }
}

const jugadores = [
  { id: "A", nombre: "Ana", activo: true },
  { id: "B", nombre: "Beto", activo: true },
];

console.log("\nLiga de Dudo — tests de estadísticas avanzadas\n");

// E1 — statsVacia / statsTieneDatos
test("E1: statsVacia está en cero y statsTieneDatos lo detecta", () => {
  const v = statsVacia();
  assert.equal(v.dudosAcertados, 0);
  assert.equal(statsTieneDatos({ rondas: 0, porJugador: { A: statsVacia() } }), false);
  assert.equal(
    statsTieneDatos({ rondas: 0, porJugador: { A: { ...statsVacia(), dudosAcertados: 1 } } }),
    true
  );
  assert.equal(statsTieneDatos({ rondas: 5, porJugador: {} }), true);
  assert.equal(statsTieneDatos(undefined), false);
});

// E2 — agrega totales por jugador a lo largo de varias partidas
test("E2: suma dudos/calzos/dados por jugador en varias partidas", () => {
  const partidas = [
    {
      id: "p1",
      fecha: "2026-06-01",
      ordenEliminacion: ["A", "B"],
      stats: {
        rondas: 7,
        porJugador: {
          A: { dudosAcertados: 2, dudosFallados: 1, calzosLogrados: 1, calzosFallados: 0, dadosPerdidos: 5 },
          B: { dudosAcertados: 0, dudosFallados: 2, calzosLogrados: 0, calzosFallados: 1, dadosPerdidos: 3 },
        },
      },
    },
    {
      id: "p2",
      fecha: "2026-06-01",
      ordenEliminacion: ["B", "A"],
      stats: {
        rondas: 9,
        porJugador: {
          A: { dudosAcertados: 1, dudosFallados: 0, calzosLogrados: 0, calzosFallados: 1, dadosPerdidos: 2 },
          B: { dudosAcertados: 3, dudosFallados: 1, calzosLogrados: 2, calzosFallados: 0, dadosPerdidos: 5 },
        },
      },
    },
  ];

  const r = calcularEstadisticas(jugadores, partidas);
  const ana = r.jugadores.find((x) => x.jugadorId === "A");
  const beto = r.jugadores.find((x) => x.jugadorId === "B");

  assert.equal(ana.dudosAcertados, 3);
  assert.equal(ana.dudosFallados, 1);
  assert.equal(ana.dudosTotal, 4);
  assert.equal(ana.dadosPerdidos, 7);
  assert.equal(beto.calzosLogrados, 2);
  assert.equal(beto.dadosPerdidos, 8);

  assert.equal(r.partidasConStats, 2);
  assert.equal(r.totalRondas, 16);
  assert.equal(r.promedioRondas, 8);
});

// E3 — porcentajes derivados (y null cuando no hubo intentos)
test("E3: porcentaje de dudos = acertados/total; null si no hubo dudos", () => {
  const partidas = [
    {
      id: "p1",
      fecha: "x",
      ordenEliminacion: ["A", "B"],
      stats: {
        rondas: 4,
        porJugador: {
          A: { dudosAcertados: 3, dudosFallados: 1, calzosLogrados: 0, calzosFallados: 0, dadosPerdidos: 1 },
          B: statsVacia(), // B no hizo nada -> pero hay rondas, así que la partida cuenta
        },
      },
    },
  ];
  const r = calcularEstadisticas(jugadores, partidas);
  const ana = r.jugadores.find((x) => x.jugadorId === "A");
  const beto = r.jugadores.find((x) => x.jugadorId === "B");

  assert.equal(ana.dudosPct, 0.75); // 3 de 4
  assert.equal(ana.dadosPerdidosProm, 1);
  assert.equal(beto.dudosPct, null); // sin dudos -> null (no 0/0)
  assert.equal(beto.calzosPct, null);
});

// E4 — partidas sin stats se ignoran en la agregación
test("E4: partidas sin stats no cuentan", () => {
  const partidas = [
    { id: "p1", fecha: "x", ordenEliminacion: ["A", "B"] }, // sin stats
    {
      id: "p2",
      fecha: "x",
      ordenEliminacion: ["B", "A"],
      stats: {
        rondas: 6,
        porJugador: { A: { ...statsVacia(), dudosAcertados: 2 } },
      },
    },
  ];
  const r = calcularEstadisticas(jugadores, partidas);
  assert.equal(r.partidasConStats, 1);
  assert.equal(r.totalRondas, 6);
  const ana = r.jugadores.find((x) => x.jugadorId === "A");
  assert.equal(ana.partidas, 1);
  assert.equal(ana.dudosAcertados, 2);
});

console.log(`\nResultado: ${pasados} pasados, ${fallidos} fallidos\n`);
if (fallidos > 0) process.exit(1);
