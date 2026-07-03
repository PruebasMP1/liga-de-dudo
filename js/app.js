// ============================================================================
//  UI — Liga de Dudo (SPA mobile-first, español de Chile).
//  Toda la lógica de puntos vive en scoring.js; aquí solo pintamos y guardamos.
// ============================================================================

import {
  calcularPosiciones,
  calcularPuntosPartida,
  calcularAcumulado,
  exportarEstado,
  importarEstado,
  lugaresQuePuntuan,
} from "./scoring.js";
import {
  calcularEstadisticas,
  statsVacia,
  statsTieneDatos,
} from "./stats.js";
import { cargarEstado, guardarEstado, idNuevo } from "./storage.js";
import { nubeActiva, cargarDeNube, guardarEnNube } from "./nube.js";

// ---- Estado global ---------------------------------------------------------
let estado = cargarEstado();
let tab = "ranking";

// ---- Estado de sincronización con la nube ----------------------------------
let ultimaSync = null;   // marca de tiempo del último estado que tenemos de la nube
let syncMsg = "";        // texto que se muestra en la barra de sync
let pushTimer = null;    // debounce para no golpear la nube en cada tecla

// Borrador de la partida en curso (no se guarda hasta confirmar).
//   fecha:    "YYYY-MM-DD"
//   presentes: [jugadorId]
//   orden:    (jugadorId | jugadorId[])[]  -> index 0 = primer eliminado
let borrador = null;

// Id de la partida que estamos editando (null si es nueva).
let editandoPartidaId = null;

const $ = (sel) => document.querySelector(sel);
const app = $("#app");

// ---- Utilidades -------------------------------------------------------------
const hoyISO = () => new Date().toISOString().slice(0, 10);
const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
const fmt = (n) =>
  Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, "");
const nombreDe = (id) => estado.jugadores.find((j) => j.id === id)?.nombre ?? "¿?";
const flatten = (orden) => orden.flatMap((e) => (Array.isArray(e) ? e : [e]));

function persistir() {
  guardarEstado(estado);          // siempre guarda local (rápido y offline)
  programarPushNube();            // y sube a la nube si está activa
}

// Sube el estado a la nube tras un pequeño retardo (evita muchas escrituras).
function programarPushNube() {
  if (!nubeActiva()) return;
  syncMsg = "⏳ Guardando…";
  actualizarBarra();
  clearTimeout(pushTimer);
  pushTimer = setTimeout(async () => {
    try {
      ultimaSync = await guardarEnNube(estado);
      syncMsg = "☁ Guardado en la nube";
    } catch (e) {
      console.error(e);
      syncMsg = "⚠ Sin conexión (guardado local)";
    }
    actualizarBarra();
  }, 600);
}

// Trae el estado de la nube. Si hay algo más nuevo y no estamos editando,
// lo adopta y vuelve a pintar. forzar=true adopta aunque estemos en reposo.
async function sincronizar(forzar = false) {
  if (!nubeActiva()) return;
  syncMsg = "⏳ Sincronizando…";
  actualizarBarra();
  try {
    const res = await cargarDeNube();
    if (res && res.estado && res.updatedAt !== ultimaSync) {
      const editando = borrador || ordenEnEdicion;
      if (forzar || !editando) {
        estado = importarEstado(res.estado);
        guardarEstado(estado);
        ultimaSync = res.updatedAt;
        syncMsg = "☁ Actualizado desde la nube";
        render();
        return;
      }
    }
    syncMsg = "☁ Al día";
  } catch (e) {
    console.error(e);
    syncMsg = "⚠ Sin conexión";
  }
  actualizarBarra();
}

// ============================================================================
//  RENDER PRINCIPAL
// ============================================================================
function render() {
  app.innerHTML = `
    <nav class="tabs">
      ${tabBtn("ranking", "🏆 Ranking")}
      ${tabBtn("nueva", "🎲 Nueva")}
      ${tabBtn("stats", "📊 Stats")}
      ${tabBtn("historial", "📜 Historial")}
      ${tabBtn("jugadores", "👥 Jugadores")}
      ${tabBtn("respaldo", "💾 Respaldo")}
    </nav>
    ${barraSyncHTML()}
    <main class="contenido">${vista()}</main>
  `;
}

// Barra fina que muestra el estado de la nube (solo si la nube está activa).
function barraSyncHTML() {
  if (!nubeActiva()) return "";
  return `<div id="sync-bar" class="sync-bar">
    <span id="sync-msg">${syncMsg || "☁ Nube compartida"}</span>
    <button id="btn-sync" class="btn-min">🔄 Sincronizar</button>
  </div>`;
}

// Actualiza solo el texto de la barra sin re-render completo (no molesta inputs).
function actualizarBarra() {
  const el = document.getElementById("sync-msg");
  if (el) el.textContent = syncMsg || "☁ Nube compartida";
}

const tabBtn = (id, txt) =>
  `<button class="tab ${tab === id ? "activo" : ""}" data-tab="${id}">${txt}</button>`;

function vista() {
  switch (tab) {
    case "jugadores": return vistaJugadores();
    case "nueva": return vistaNueva();
    case "ranking": return vistaRanking();
    case "stats": return vistaStats();
    case "historial": return vistaHistorial();
    case "respaldo": return vistaRespaldo();
    default: return vistaRanking();
  }
}

// ============================================================================
//  JUGADORES
// ============================================================================
function vistaJugadores() {
  const activos = estado.jugadores.filter((j) => j.activo);
  const archivados = estado.jugadores.filter((j) => !j.activo);

  const item = (j) => `
    <li class="fila-jugador ${j.activo ? "" : "archivado"}">
      <input class="inp-nombre" data-edit-jugador="${j.id}" value="${esc(j.nombre)}" />
      <div class="acciones">
        <button class="btn-min" data-toggle-jugador="${j.id}">
          ${j.activo ? "Archivar" : "Reactivar"}
        </button>
      </div>
    </li>`;

  return `
    <section>
      <h2>Jugadores</h2>
      <div class="agregar">
        <input id="nuevo-jugador" placeholder="Nombre del jugador" />
        <button class="btn" id="btn-agregar-jugador">Agregar</button>
      </div>
      <h3>Activos (${activos.length})</h3>
      <ul class="lista">${activos.map(item).join("") || "<li class='vacio'>Sin jugadores activos.</li>"}</ul>
      ${
        archivados.length
          ? `<h3>Archivados (${archivados.length})</h3>
             <ul class="lista">${archivados.map(item).join("")}</ul>
             <p class="nota">Se archivan (no se borran) para no romper el historial.</p>`
          : ""
      }
    </section>`;
}

// ============================================================================
//  NUEVA PARTIDA (flujo en vivo)
// ============================================================================
function vistaNueva() {
  const activos = estado.jugadores.filter((j) => j.activo);
  if (activos.length < 2) {
    return `<section><h2>Nueva partida</h2>
      <p class="vacio">Necesitas al menos 2 jugadores activos. Anda a la pestaña 👥 Jugadores.</p>
    </section>`;
  }

  // Paso 1: elegir fecha y presentes.
  if (!borrador) {
    return `
      <section>
        <h2>Nueva partida</h2>
        <label class="campo">Fecha
          <input type="date" id="fecha-partida" value="${hoyISO()}" />
        </label>
        <h3>¿Quiénes juegan?</h3>
        <ul class="lista seleccion">
          ${activos
            .map(
              (j) => `
            <li>
              <label class="check">
                <input type="checkbox" class="chk-presente" value="${j.id}" />
                <span>${esc(j.nombre)}</span>
              </label>
            </li>`
            )
            .join("")}
        </ul>
        <button class="btn grande" id="btn-empezar">Empezar partida ▶</button>
      </section>`;
  }

  // Paso 2: juego en vivo (tocar al eliminado).
  const enPie = borrador.presentes.filter((id) => !flatten(borrador.orden).includes(id));
  const N = borrador.presentes.length;

  return `
    <section>
      <h2>Partida en vivo</h2>
      <p class="sub">Fecha: ${esc(borrador.fecha)} · ${N} jugadores · toca al que se queda sin dados.</p>

      <h3>En pie (${enPie.length})</h3>
      <ul class="lista grilla">
        ${enPie
          .map(
            (id) => `
          <li>
            <button class="jugador-vivo" data-eliminar="${id}">
              ${esc(nombreDe(id))}
            </button>
          </li>`
          )
          .join("")}
      </ul>
      ${
        enPie.length <= 1
          ? `<p class="ganador-msg">🏆 Ganador: <b>${esc(nombreDe(enPie[0]))}</b></p>`
          : ""
      }

      ${
        borrador.orden.length
          ? `<h3>Eliminados (en orden)</h3>
             <ol class="lista orden-elim">
               ${borrador.orden
                 .map((e, i) => {
                   const ids = Array.isArray(e) ? e : [e];
                   const etiqueta = ids.map(nombreDe).map(esc).join(" = ");
                   return `<li><span class="num">${i + 1}°</span> ${etiqueta}</li>`;
                 })
                 .join("")}
             </ol>
             <button class="btn-min" id="btn-deshacer">↩ Deshacer última</button>`
          : ""
      }

      <div class="botonera">
        <button class="btn secundario" id="btn-cancelar-partida">Cancelar</button>
        <button class="btn grande" id="btn-revisar" ${enPie.length > 1 ? "disabled" : ""}>
          Revisar y guardar ▶
        </button>
      </div>
    </section>`;
}

// Editor de orden (revisar antes de guardar, o editar una partida existente).
function vistaEditorOrden(orden, contexto) {
  const { N, posiciones } = calcularPosiciones(orden);
  const puntos = calcularPuntosPartida(orden, estado.configuracion);
  const posDe = (id) => posiciones.find((p) => p.jugadorId === id).posicion;
  const ptsDe = (id) => puntos.find((p) => p.jugadorId === id).puntos;

  const filasHtml = orden
    .map((entrada, i) => {
      const ids = Array.isArray(entrada) ? entrada : [entrada];
      const detalle = ids
        .map(
          (id) =>
            `<span class="chip">${esc(nombreDe(id))} · pos ${fmt(posDe(id))} · ${fmt(ptsDe(id))} pts</span>`
        )
        .join("");
      return `
        <li class="fila-orden">
          <div class="orden-info">
            <span class="num">${i + 1}°</span>
            <div class="chips">${detalle}</div>
          </div>
          <div class="orden-ctrl">
            <button class="btn-min" data-mover="${i}" data-dir="-1" ${i === 0 ? "disabled" : ""}>↑</button>
            <button class="btn-min" data-mover="${i}" data-dir="1" ${i === orden.length - 1 ? "disabled" : ""}>↓</button>
            ${i > 0 ? `<button class="btn-min" data-unir="${i}">＝ unir ↑</button>` : ""}
            ${ids.length > 1 ? `<button class="btn-min" data-separar="${i}">⊟ separar</button>` : ""}
          </div>
        </li>`;
    })
    .join("");

  return `
    <section>
      <h2>${contexto.titulo}</h2>
      <p class="sub">Mesa de ${N}. Orden: 1° = primer eliminado (último lugar), ${orden.length}° = ganador.</p>
      ${
        estado.configuracion.modoPuntos === "podio"
          ? `<p class="nota">🏅 Modo Podio: puntúan los primeros <b>${lugaresQuePuntuan(N)}</b> lugares (el ganador vale ${N} pts); el resto suma 0.</p>`
          : ""
      }
      <p class="nota">Usa ↑/↓ para corregir el orden. "Unir ↑" marca empate con el de arriba; "separar" deshace el empate.</p>
      <ol class="lista editor-orden">${filasHtml}</ol>
      ${seccionStatsEditor(orden)}
      <div class="botonera">
        <button class="btn secundario" id="btn-editor-cancelar">Cancelar</button>
        <button class="btn grande" id="btn-editor-guardar">${contexto.textoGuardar}</button>
      </div>
    </section>`;
}

// Sección OPCIONAL para registrar estadísticas avanzadas de la partida.
function seccionStatsEditor(orden) {
  if (!statsEnEdicion) return "";
  const ids = flatten(orden);
  const inp = (id, campo) =>
    `<input type="number" min="0" inputmode="numeric" class="stat-inp"
       data-stat="${id}" data-campo="${campo}"
       value="${statsEnEdicion.porJugador[id]?.[campo] ?? 0}" />`;

  const filas = ids
    .map(
      (id) => `
      <tr>
        <td class="nombre">${esc(nombreDe(id))}</td>
        <td>${inp(id, "dudosAcertados")}</td>
        <td>${inp(id, "dudosFallados")}</td>
        <td>${inp(id, "calzosLogrados")}</td>
        <td>${inp(id, "calzosFallados")}</td>
        <td>${inp(id, "dadosPerdidos")}</td>
      </tr>`
    )
    .join("");

  return `
    <details class="ajustes" ${statsTieneDatos(statsEnEdicion) ? "open" : ""}>
      <summary>📊 Estadísticas avanzadas (opcional)</summary>
      <label class="campo">Rondas de la partida
        <input type="number" min="0" inputmode="numeric" id="stat-rondas"
               value="${statsEnEdicion.rondas ?? 0}" />
      </label>
      <p class="nota">Por jugador: dudos acertados/fallados, calzos logrados/fallados y dados perdidos. Déjalo en cero si esta noche no llevas el detalle.</p>
      <div class="tabla-wrap">
        <table class="tabla-stats-editor">
          <thead>
            <tr><th>Jugador</th><th>Dudo ✓</th><th>Dudo ✗</th><th>Calzo ✓</th><th>Calzo ✗</th><th>Dados ⚀</th></tr>
          </thead>
          <tbody>${filas}</tbody>
        </table>
      </div>
    </details>`;
}

// ============================================================================
//  RANKING ACUMULADO
// ============================================================================
function vistaRanking() {
  const cfg = estado.configuracion;

  // Filtro por rango de fechas (temporada).
  const partidas = filtrarPartidasPorFecha(estado.partidas);
  const jugadoresConJuego = calcularAcumulado(estado.jugadores, partidas, cfg);

  const filas = jugadoresConJuego
    .map(
      (r, i) => `
      <tr>
        <td class="pos">${i + 1}</td>
        <td class="nombre">${esc(r.nombre)} ${r.jugadorId && !estado.jugadores.find(j=>j.id===r.jugadorId)?.activo ? "<span class='tag'>arch.</span>" : ""}</td>
        <td>${r.PJ}</td>
        <td class="${cfg.metricaRanking === "total" ? "destacado" : ""}">${fmt(r.total)}</td>
        <td class="${cfg.metricaRanking === "promedio" ? "destacado" : ""}">${fmt(r.promedio)}</td>
        <td>${r.victorias}</td>
        <td>${fmt(r.mejorPuesto)} / ${fmt(r.peorPuesto)}</td>
      </tr>`
    )
    .join("");

  return `
    <section>
      <h2>Ranking de temporada</h2>

      <div class="config-bar">
        <div class="toggle">
          <span>Puntaje:</span>
          <button class="pill ${cfg.modoPuntos === "podio" ? "on" : ""}" data-modo="podio">🏅 Podio</button>
          <button class="pill ${cfg.modoPuntos === "supervivencia" ? "on" : ""}" data-modo="supervivencia">Supervivencia</button>
        </div>
        <div class="toggle">
          <span>Ordenar por:</span>
          <button class="pill ${cfg.metricaRanking === "total" ? "on" : ""}" data-metrica="total">Total</button>
          <button class="pill ${cfg.metricaRanking === "promedio" ? "on" : ""}" data-metrica="promedio">Promedio</button>
        </div>
      </div>

      <details class="ajustes">
        <summary>⚙ Ajustes de puntaje y temporada</summary>
        <div class="campos">
          <label class="campo">Bono victoria
            <input type="number" id="cfg-bono" min="0" step="1" value="${cfg.bonoVictoria}" />
          </label>
          <label class="campo">Punto participación
            <input type="number" id="cfg-part" min="0" step="1" value="${cfg.puntoParticipacion}" />
          </label>
          <label class="campo">Desde
            <input type="date" id="cfg-desde" value="${cfg.filtroDesde ?? ""}" />
          </label>
          <label class="campo">Hasta
            <input type="date" id="cfg-hasta" value="${cfg.filtroHasta ?? ""}" />
          </label>
        </div>
        <button class="btn-min" id="btn-limpiar-fechas">Quitar filtro de fechas</button>
      </details>

      ${
        filas
          ? `<div class="tabla-wrap">
              <table class="tabla-ranking">
                <thead>
                  <tr><th>#</th><th>Jugador</th><th>PJ</th><th>Total</th><th>Prom.</th><th>🏆</th><th>Mejor/Peor</th></tr>
                </thead>
                <tbody>${filas}</tbody>
              </table>
            </div>
            <p class="nota">${
              cfg.modoPuntos === "podio"
                ? "<b>🏅 Podio:</b> en cada mesa solo puntúan los primeros lugares (la mitad superior). El ganador vale N puntos en una mesa de N, así que ganar/colocar en mesa grande rinde más."
                : "<b>Supervivencia:</b> ganas 1 punto por cada rival que dejas atrás; casi todos suman algo."
            } Se muestran <b>total</b> y <b>promedio</b> siempre, aunque ordenes por uno.</p>`
          : `<p class="vacio">Aún no hay partidas en este rango. Registra una en 🎲 Nueva.</p>`
      }

      ${vistaSubtotalesPorNoche(partidas)}
    </section>`;
}

function vistaSubtotalesPorNoche(partidas) {
  const fechas = [...new Set(partidas.map((p) => p.fecha))].sort().reverse();
  if (fechas.length < 1) return "";
  const bloques = fechas
    .map((f) => {
      const delDia = partidas.filter((p) => p.fecha === f);
      const ranking = calcularAcumulado(estado.jugadores, delDia, estado.configuracion);
      const lineas = ranking
        .map((r) => `<li>${esc(r.nombre)} — ${fmt(r.total)} pts (${r.PJ} PJ)</li>`)
        .join("");
      return `<details class="noche"><summary>${esc(f)} · ${delDia.length} partidas</summary><ul class="lista">${lineas}</ul></details>`;
    })
    .join("");
  return `<details class="ajustes"><summary>📅 Subtotales por noche</summary>${bloques}</details>`;
}

function filtrarPartidasPorFecha(partidas) {
  const { filtroDesde, filtroHasta } = estado.configuracion;
  return partidas.filter((p) => {
    if (filtroDesde && p.fecha < filtroDesde) return false;
    if (filtroHasta && p.fecha > filtroHasta) return false;
    return true;
  });
}

// ============================================================================
//  ESTADÍSTICAS AVANZADAS (Hito 4) — vista de temporada
// ============================================================================
function vistaStats() {
  const partidas = filtrarPartidasPorFecha(estado.partidas);
  const r = calcularEstadisticas(estado.jugadores, partidas);

  if (!r.partidasConStats) {
    return `
      <section>
        <h2>Estadísticas avanzadas</h2>
        <p class="vacio">Todavía no hay partidas con estadísticas en este rango.</p>
        <p class="nota">Al guardar o editar una partida, abre <b>📊 Estadísticas avanzadas (opcional)</b> y anota dudos, calzos, dados perdidos y rondas. Aquí se acumulan por temporada. No afectan los puntos del ranking.</p>
      </section>`;
  }

  const pct = (v) => (v === null ? "—" : Math.round(v * 100) + "%");
  const filas = r.jugadores
    .map(
      (j) => `
      <tr>
        <td class="nombre">${esc(j.nombre)}</td>
        <td>${j.dudosAcertados}/${j.dudosFallados} <span class="destacado">${pct(j.dudosPct)}</span></td>
        <td>${j.calzosLogrados}/${j.calzosFallados} <span class="destacado">${pct(j.calzosPct)}</span></td>
        <td>${j.dadosPerdidos} <span class="suave2">(${fmt(j.dadosPerdidosProm)}/p)</span></td>
        <td>${j.partidas}</td>
      </tr>`
    )
    .join("");

  return `
    <section>
      <h2>Estadísticas avanzadas</h2>
      <p class="sub">${r.partidasConStats} partidas con datos · ${r.totalRondas} rondas en total · ${fmt(r.promedioRondas)} rondas/partida en promedio.</p>
      <div class="tabla-wrap">
        <table class="tabla-ranking">
          <thead>
            <tr><th>Jugador</th><th>Dudos ✓/✗</th><th>Calzos ✓/✗</th><th>Dados ⚀</th><th>Part.</th></tr>
          </thead>
          <tbody>${filas}</tbody>
        </table>
      </div>
      <p class="nota">"Dudos ✓/✗" = acertados/fallados y su % de acierto. "Calzos ✓/✗" = logrados/fallados y su %. "Dados ⚀" = dados perdidos totales (y promedio por partida). Estas cifras son descriptivas: <b>no</b> cambian los puntos del ranking.</p>
    </section>`;
}

// ============================================================================
//  HISTORIAL
// ============================================================================
function vistaHistorial() {
  const partidas = [...estado.partidas].sort((a, b) =>
    b.fecha.localeCompare(a.fecha)
  );
  if (!partidas.length) {
    return `<section><h2>Historial</h2><p class="vacio">Todavía no hay partidas.</p></section>`;
  }
  const item = (p) => {
    const { N } = calcularPosiciones(p.ordenEliminacion);
    const ganador = p.ordenEliminacion[p.ordenEliminacion.length - 1];
    const ganadorTxt = (Array.isArray(ganador) ? ganador : [ganador]).map(nombreDe).map(esc).join(" = ");
    const detalle = p.ordenEliminacion
      .map((e, i) => {
        const ids = Array.isArray(e) ? e : [e];
        return `${i + 1}° ${ids.map(nombreDe).map(esc).join(" = ")}`;
      })
      .reverse()
      .join(" · ");
    return `
      <li class="fila-partida">
        <div class="cab">
          <span><b>${esc(p.fecha)}</b> · mesa de ${N} · 🏆 ${ganadorTxt}</span>
          <div class="acciones">
            <button class="btn-min" data-editar-partida="${p.id}">Editar</button>
            <button class="btn-min peligro" data-borrar-partida="${p.id}">Borrar</button>
          </div>
        </div>
        <div class="detalle">${detalle}</div>
      </li>`;
  };
  return `<section><h2>Historial (${partidas.length})</h2>
    <ul class="lista">${partidas.map(item).join("")}</ul></section>`;
}

// ============================================================================
//  RESPALDO (export / import JSON)
// ============================================================================
function vistaRespaldo() {
  return `
    <section>
      <h2>Respaldo</h2>
      <p class="nota">Todo se guarda solo en este dispositivo. Exporta un archivo JSON para respaldar o pasar los datos a otro celular/PC.</p>
      <div class="botonera col">
        <button class="btn grande" id="btn-exportar">⬇ Exportar (descargar JSON)</button>
        <label class="btn grande secundario" for="archivo-importar">⬆ Importar (cargar JSON)</label>
        <input type="file" id="archivo-importar" accept="application/json,.json" hidden />
      </div>
      <p class="nota">Importar <b>reemplaza</b> todos los datos actuales por los del archivo.</p>
    </section>`;
}

// ============================================================================
//  EVENTOS (delegación de clicks + inputs)
// ============================================================================
app.addEventListener("click", (e) => {
  const t = e.target;

  // Navegación de pestañas
  const tabId = t.closest("[data-tab]")?.dataset.tab;
  if (tabId) {
    tab = tabId;
    if (tab !== "nueva") borrador = null;
    editandoPartidaId = null;
    ordenEnEdicion = null;
    statsEnEdicion = null;
    return render();
  }

  // ---- Jugadores ----
  if (t.id === "btn-agregar-jugador") return agregarJugador();
  const tog = t.closest("[data-toggle-jugador]")?.dataset.toggleJugador;
  if (tog) return toggleJugador(tog);

  // ---- Nueva partida ----
  if (t.id === "btn-empezar") return empezarPartida();
  const elim = t.closest("[data-eliminar]")?.dataset.eliminar;
  if (elim) return eliminarEnVivo(elim);
  if (t.id === "btn-deshacer") return deshacerEliminacion();
  if (t.id === "btn-cancelar-partida") { borrador = null; return render(); }
  if (t.id === "btn-revisar") return revisarPartida();

  // ---- Editor de orden ----
  const mover = t.closest("[data-mover]");
  if (mover) return moverEnOrden(+mover.dataset.mover, +mover.dataset.dir);
  const unir = t.closest("[data-unir]")?.dataset.unir;
  if (unir !== undefined) return unirEmpate(+unir);
  const separar = t.closest("[data-separar]")?.dataset.separar;
  if (separar !== undefined) return separarEmpate(+separar);
  if (t.id === "btn-editor-cancelar") return cancelarEditor();
  if (t.id === "btn-editor-guardar") return guardarDesdeEditor();

  // ---- Ranking ----
  const modo = t.closest("[data-modo]")?.dataset.modo;
  if (modo) { estado.configuracion.modoPuntos = modo; persistir(); return render(); }
  const met = t.closest("[data-metrica]")?.dataset.metrica;
  if (met) { estado.configuracion.metricaRanking = met; persistir(); return render(); }
  if (t.id === "btn-limpiar-fechas") {
    delete estado.configuracion.filtroDesde;
    delete estado.configuracion.filtroHasta;
    persistir(); return render();
  }

  // ---- Historial ----
  const editarP = t.closest("[data-editar-partida]")?.dataset.editarPartida;
  if (editarP) return editarPartida(editarP);
  const borrarP = t.closest("[data-borrar-partida]")?.dataset.borrarPartida;
  if (borrarP) return borrarPartida(borrarP);

  // ---- Respaldo ----
  if (t.id === "btn-exportar") return exportar();

  // ---- Sincronización ----
  if (t.id === "btn-sync") return sincronizar(true);
});

app.addEventListener("change", (e) => {
  const t = e.target;
  if (t.id === "cfg-bono") { estado.configuracion.bonoVictoria = Math.max(0, +t.value || 0); persistir(); return render(); }
  if (t.id === "cfg-part") { estado.configuracion.puntoParticipacion = Math.max(0, +t.value || 0); persistir(); return render(); }
  if (t.id === "cfg-desde") { estado.configuracion.filtroDesde = t.value || undefined; persistir(); return render(); }
  if (t.id === "cfg-hasta") { estado.configuracion.filtroHasta = t.value || undefined; persistir(); return render(); }
  if (t.id === "archivo-importar") return importar(t.files[0]);

  // ---- Stats del editor (no re-renderiza: solo actualiza el modelo) ----
  if (t.id === "stat-rondas" && statsEnEdicion) {
    statsEnEdicion.rondas = Math.max(0, +t.value || 0);
    return;
  }
  const sId = t.dataset?.stat;
  if (sId && statsEnEdicion) {
    const campo = t.dataset.campo;
    statsEnEdicion.porJugador[sId][campo] = Math.max(0, +t.value || 0);
    return;
  }
});

app.addEventListener("blur", (e) => {
  const id = e.target.dataset?.editJugador;
  if (id) {
    const nombre = e.target.value.trim();
    const j = estado.jugadores.find((x) => x.id === id);
    if (j && nombre) { j.nombre = nombre; persistir(); }
  }
}, true);

// Enter para agregar jugador
app.addEventListener("keydown", (e) => {
  if (e.target.id === "nuevo-jugador" && e.key === "Enter") agregarJugador();
});

// ============================================================================
//  ACCIONES — Jugadores
// ============================================================================
function agregarJugador() {
  const inp = $("#nuevo-jugador");
  const nombre = inp.value.trim();
  if (!nombre) return;
  estado.jugadores.push({ id: idNuevo(), nombre, activo: true });
  persistir();
  render();
  $("#nuevo-jugador")?.focus();
}

function toggleJugador(id) {
  const j = estado.jugadores.find((x) => x.id === id);
  if (j) { j.activo = !j.activo; persistir(); render(); }
}

// ============================================================================
//  ACCIONES — Nueva partida
// ============================================================================
function empezarPartida() {
  const fecha = $("#fecha-partida").value || hoyISO();
  const presentes = [...document.querySelectorAll(".chk-presente:checked")].map((c) => c.value);
  if (presentes.length < 2) {
    alert("Marca al menos 2 jugadores presentes.");
    return;
  }
  borrador = { fecha, presentes, orden: [] };
  render();
}

function eliminarEnVivo(id) {
  borrador.orden.push(id);
  render();
}

function deshacerEliminacion() {
  borrador.orden.pop();
  render();
}

function revisarPartida() {
  // Completar el orden con el ganador (el único en pie restante).
  const enPie = borrador.presentes.filter((id) => !flatten(borrador.orden).includes(id));
  const ordenCompleto = [...borrador.orden, ...enPie]; // enPie tiene 0 o 1 elemento
  editandoPartidaId = null;
  borrador.orden = ordenCompleto;
  statsEnEdicion = prepararStats(ordenCompleto, null);
  renderEditor(ordenCompleto, {
    titulo: "Revisar partida",
    textoGuardar: "✓ Guardar partida",
  });
}

// ============================================================================
//  ACCIONES — Editor de orden (compartido por revisar y editar)
// ============================================================================
let ordenEnEdicion = null;
let editorContexto = null;
let statsEnEdicion = null; // { rondas, porJugador: { [id]: {...} } } o null

// Crea/normaliza el objeto de stats para los participantes de una partida,
// reutilizando lo ya registrado si existe.
function prepararStats(orden, existente) {
  const ids = flatten(orden);
  const porJugador = {};
  for (const id of ids) {
    const prev = existente?.porJugador?.[id];
    porJugador[id] = { ...statsVacia(), ...(prev ?? {}) };
  }
  return { rondas: Number(existente?.rondas) || 0, porJugador };
}

function renderEditor(orden, contexto) {
  ordenEnEdicion = orden.map((e) => (Array.isArray(e) ? e.slice() : e));
  editorContexto = contexto;
  app.innerHTML = `
    <nav class="tabs">
      ${tabBtn("ranking", "🏆 Ranking")}
      ${tabBtn("nueva", "🎲 Nueva")}
      ${tabBtn("stats", "📊 Stats")}
      ${tabBtn("historial", "📜 Historial")}
      ${tabBtn("jugadores", "👥 Jugadores")}
      ${tabBtn("respaldo", "💾 Respaldo")}
    </nav>
    <main class="contenido">${vistaEditorOrden(ordenEnEdicion, contexto)}</main>`;
}

function refrescarEditor() {
  $(".contenido").innerHTML = vistaEditorOrden(ordenEnEdicion, editorContexto);
}

function moverEnOrden(i, dir) {
  const j = i + dir;
  if (j < 0 || j >= ordenEnEdicion.length) return;
  [ordenEnEdicion[i], ordenEnEdicion[j]] = [ordenEnEdicion[j], ordenEnEdicion[i]];
  refrescarEditor();
}

function unirEmpate(i) {
  // Une el slot i con el anterior (i-1) en un mismo grupo de empate.
  if (i <= 0) return;
  const a = ordenEnEdicion[i - 1];
  const b = ordenEnEdicion[i];
  const grupo = [...(Array.isArray(a) ? a : [a]), ...(Array.isArray(b) ? b : [b])];
  ordenEnEdicion.splice(i - 1, 2, grupo);
  refrescarEditor();
}

function separarEmpate(i) {
  const grupo = ordenEnEdicion[i];
  if (!Array.isArray(grupo)) return;
  ordenEnEdicion.splice(i, 1, ...grupo);
  refrescarEditor();
}

function cancelarEditor() {
  ordenEnEdicion = null;
  editorContexto = null;
  statsEnEdicion = null;
  if (editandoPartidaId) { editandoPartidaId = null; tab = "historial"; }
  else { borrador = null; tab = "nueva"; }
  render();
}

function guardarDesdeEditor() {
  // Adjuntar stats solo si trae datos reales (si no, la partida queda "limpia").
  const stats = statsTieneDatos(statsEnEdicion) ? statsEnEdicion : undefined;

  if (editandoPartidaId) {
    const p = estado.partidas.find((x) => x.id === editandoPartidaId);
    if (p) {
      p.ordenEliminacion = ordenEnEdicion;
      if (stats) p.stats = stats;
      else delete p.stats;
    }
    editandoPartidaId = null;
    tab = "historial";
  } else {
    const partida = {
      id: idNuevo(),
      fecha: borrador.fecha,
      ordenEliminacion: ordenEnEdicion,
    };
    if (stats) partida.stats = stats;
    estado.partidas.push(partida);
    borrador = null;
    tab = "ranking";
  }
  ordenEnEdicion = null;
  editorContexto = null;
  statsEnEdicion = null;
  persistir();
  render();
}

// ============================================================================
//  ACCIONES — Historial
// ============================================================================
function editarPartida(id) {
  const p = estado.partidas.find((x) => x.id === id);
  if (!p) return;
  editandoPartidaId = id;
  statsEnEdicion = prepararStats(p.ordenEliminacion, p.stats);
  renderEditor(p.ordenEliminacion, {
    titulo: `Editar partida (${p.fecha})`,
    textoGuardar: "✓ Guardar cambios",
  });
}

function borrarPartida(id) {
  const p = estado.partidas.find((x) => x.id === id);
  if (!p) return;
  if (!confirm(`¿Borrar la partida del ${p.fecha}? Se recalcula el ranking.`)) return;
  estado.partidas = estado.partidas.filter((x) => x.id !== id);
  persistir();
  render();
}

// ============================================================================
//  ACCIONES — Respaldo
// ============================================================================
function exportar() {
  const json = exportarEstado(estado);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `liga-de-dudo-${hoyISO()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importar(archivo) {
  if (!archivo) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      estado = importarEstado(reader.result);
      persistir();
      tab = "ranking";
      render();
      alert("Respaldo importado correctamente.");
    } catch (err) {
      alert("No se pudo leer el archivo: " + err.message);
    }
  };
  reader.readAsText(archivo);
}

// ---- Arranque --------------------------------------------------------------
render();

if (nubeActiva()) {
  (async () => {
    try {
      const res = await cargarDeNube();
      const remotoTieneDatos =
        res && res.estado &&
        ((res.estado.jugadores?.length ?? 0) > 0 || (res.estado.partidas?.length ?? 0) > 0);
      if (remotoTieneDatos) {
        // La nube manda: adoptamos lo compartido.
        estado = importarEstado(res.estado);
        guardarEstado(estado);
        ultimaSync = res.updatedAt;
        syncMsg = "☁ Cargado desde la nube";
        render();
      } else {
        // Nube vacía: subimos lo que haya local para crear la liga compartida.
        ultimaSync = await guardarEnNube(estado);
        syncMsg = "☁ Nube lista";
        actualizarBarra();
      }
    } catch (e) {
      console.error(e);
      syncMsg = "⚠ Sin conexión (modo local)";
      actualizarBarra();
    }
    // Refresco automático cada 15s mientras la pestaña esté visible.
    setInterval(() => {
      if (document.visibilityState === "visible") sincronizar();
    }, 15000);
  })();
}
