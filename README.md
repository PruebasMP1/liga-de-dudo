# 🎲 Liga de Dudo

App web para llevar el **ranking acumulado** de las noches de dudo de un grupo de amigos.
No modela la mecánica del dudo: solo registra el **orden de eliminación** de cada partida
y, con eso, calcula los puntos. **Mobile-first, en español, 100 % local y gratis** (sin
servidor, sin cuentas, sin nube).

## Cómo correr

No necesita instalar nada ni pagar nada.

- **Opción simple:** abre `index.html` con doble clic en tu navegador.
- **Opción recomendada** (algunos navegadores bloquean módulos JS abiertos como archivo):
  levanta un servidor local gratuito desde la carpeta del proyecto:

  ```bash
  # con Python (ya viene en Windows/Mac):
  python -m http.server 8500
  # luego abre:  http://localhost:8500
  ```

Para usarla en el celular durante la noche: déjala abierta en el navegador del teléfono.
Los datos se guardan en ese mismo dispositivo (`localStorage`).

## Cómo respaldar / restaurar

- Pestaña **💾 Respaldo → Exportar**: descarga un archivo `liga-de-dudo-AAAA-MM-DD.json`
  con TODO (jugadores, partidas, configuración).
- **Importar**: carga ese JSON en otro celular/PC para traspasar o restaurar los datos.
  Importar **reemplaza** los datos actuales.

## Cómo se cuentan los puntos

Hay **dos modos** seleccionables en el ranking (toggle **Puntaje**). El bono de victoria
(`bonoVictoria`, extra solo para el ganador) aplica a ambos.

### 🏅 Podio escalado (DEFAULT) — depende del nº de jugadores

Idea: en cada mesa **solo puntúan los primeros lugares**, y una mesa más grande reparte
más puntos y premia más arriba.

- Puntúan los primeros **M = ceil(N/2)** lugares (la mitad superior); el resto suma **0**.
- El **ganador vale N puntos** en una mesa de N, y baja de a 1 por puesto hasta el corte.

| Mesa | 1° | 2° | 3° | 4° | 5°+ | Lugares que puntúan |
|------|----|----|----|----|-----|---------------------|
| de 7 | **7** | 6 | 5 | 4 | 0 | 4 |
| de 6 | **6** | 5 | 4 | 0 | 0 | 3 |
| de 4 | **4** | 3 | 0 | 0 | 0 | 2 |

Así, ganar/colocar en una mesa de 7 (reparte 7+6+5+4 = 22) rinde mucho más que en una de 4
(reparte 4+3 = 7). Los empates en el borde del corte se promedian de forma justa (ej. un
empate entre 4° y 5° en mesa de 7 da (4+0)/2 = 2 a cada uno).

### Supervivencia (modo alternativo)

**Ganas 1 punto por cada rival que dejas atrás:** `puntos = (N − posición)`. Casi todos
suman algo (solo el primer eliminado queda en 0) y la mesa grande igual vale más, pero de
forma más suave. Acepta además `puntoParticipación` (puntos para todos por jugar).

> Diferencia clave: en **Podio** un mid-table de mesa grande queda en 0 (solo cuentan los
> primeros); en **Supervivencia** casi todos suman. Elige el que sientas más justo para tu
> grupo con el toggle del ranking.

## Ranking por suma vs. por promedio (y por qué importa la asistencia)

El ranking de temporada se puede ordenar por dos métricas (siempre se muestran **ambas**
columnas):

- **Total (suma) — default.** Modelo campeonato / F1: premia el tamaño de mesa, el buen
  puesto **y la asistencia** (más noches jugadas = más puntos acumulados). Como los puntos
  escalan con `N`, **la asistencia influye en el ranking de forma intencional**.
- **Promedio (total ÷ PJ).** Neutraliza la asistencia: quien juega poco pero la rompe en
  mesas grandes puede liderar. Sirve para distinguir **"el mejor"** (promedio) de **"el más
  constante"** (suma).

Desempates: 1) más victorias, 2) mejor promedio, 3) orden alfabético.

## Estadísticas avanzadas de dudo (Hito 4)

Además de los puntos, cada partida puede llevar (de forma **opcional**) un registro
detallado, 100 % local y gratis:

- **Dudos** acertados / fallados por jugador (y su % de acierto).
- **Calzos** logrados / fallados por jugador (y su % de éxito).
- **Dados perdidos** por jugador (total y promedio por partida).
- **Rondas** que duró la partida.

Cómo registrarlas: al **guardar una partida nueva** o al **editar** una del historial,
abre la sección desplegable **"📊 Estadísticas avanzadas (opcional)"** y anota los
contadores. Si esa noche no llevas el detalle, déjalo en cero y la partida queda "limpia".

Dónde verlas: pestaña **📊 Stats**, que acumula todo por temporada (respeta el filtro de
fechas del ranking) y muestra una tabla por jugador más un resumen de rondas.

> **Importante:** estas estadísticas son **descriptivas**. NO cambian los puntos del
> ranking, que se siguen calculando solo por supervivencia (orden de eliminación). Por eso
> el mejor "duelista" del grupo puede igual ir abajo en puntos si lo eliminan temprano.

## Estructura del proyecto

```
liga-de-dudo/
├── index.html              # app (SPA)
├── css/styles.css
├── js/
│   ├── scoring.js          # MOTOR PURO de puntuación (sin UI, testeable)
│   ├── stats.js            # MOTOR PURO de estadísticas avanzadas (Hito 4)
│   ├── storage.js          # persistencia en localStorage
│   └── app.js              # interfaz / pantallas
├── tests/
│   ├── scoring.test.mjs    # tests del motor de puntos (T1..T7)
│   └── stats.test.mjs      # tests del motor de estadísticas (E1..E4)
└── package.json
```

El **motor de puntuación** (`js/scoring.js`) es un módulo puro, separado de la interfaz, y
es el único lugar donde se calculan posiciones, puntos y ranking. La UI nunca ingresa
puntos a mano: los recalcula desde el motor al guardar o editar.

## Tests

```bash
npm test          # o:  node tests/scoring.test.mjs
```

Cubren los criterios de aceptación del motor de puntos **T1–T7** (la mesa grande vale más,
orden→posiciones, suma premia asistencia+tamaño, promedio neutraliza asistencia, bono de
victoria, respaldo ida y vuelta, empates con posición promediada) y del motor de
estadísticas **E1–E4** (detección de datos, agregación por jugador, porcentajes derivados,
y que las partidas sin stats se ignoran).

## Pantallas

1. **👥 Jugadores** — agregar, renombrar, archivar (no se borran, para no romper historial).
2. **🎲 Nueva** — eliges fecha y presentes; durante el juego tocas a cada eliminado; el
   último sin tocar es el ganador. Antes de guardar puedes corregir el orden y marcar
   empates.
3. **🏆 Ranking** — tabla ordenable (total/promedio), filtro por fechas (temporada) y
   subtotales por noche.
4. **📊 Stats** — estadísticas avanzadas acumuladas por temporada (dudos, calzos, dados
   perdidos, rondas).
5. **📜 Historial** — todas las partidas con su detalle; editar o borrar (recalcula todo).
6. **💾 Respaldo** — exportar/importar JSON.

## Fuera de alcance (por ahora)

- **Mecánica del dudo en sí** (apuestas, dudos, calzos, comodines, ronda obligada): la app
  no la modela; solo registra el resultado (orden de eliminación) y, opcionalmente, los
  contadores de estadísticas.
- **Sincronización en la nube / multi-dispositivo** (el otro camino del Hito 4): hoy el
  traspaso entre dispositivos se hace con Exportar/Importar JSON. La sincronización
  automática queda pendiente.
