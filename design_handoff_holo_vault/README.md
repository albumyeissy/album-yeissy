# Handoff: Rediseño "Holo Vault" — Álbum Yeissy

## Overview
Rediseño visual completo de **Álbum Yeissy**, una app de álbum de cromos para un grupo de amigos (JC, Sergio, Coke, Noel, Juanma, Robert). La dirección elegida se llama **"Holo Vault"**: tema oscuro premium tipo *trading card game* (Pokémon/NBA moderno), con cromos holográficos que reflejan al mover el dedo/ratón, marcos de rareza con brillo, flip 3D, y una economía de monedas.

La app cubre 8 vistas: **Feed (Grupo), Álbum, Detalle de cromo, Sobres, Ruleta, Tienda, Cambios (intercambios), Ranking y Perfil**.

> Tu app real es **Next.js (App Router) + Firebase** (proyecto `album-yeissy`). Este paquete es la **referencia de diseño**; hay que recrearlo en tu entorno real, no copiar el HTML tal cual.

---

## About the Design Files
Los archivos de este bundle son **referencias de diseño hechas en HTML** — un prototipo que muestra el aspecto y el comportamiento deseados, **no código de producción para copiar directamente**.

El prototipo está hecho con React (vía Babel en el navegador) repartido en varios archivos `.jsx`. La tarea es **recrear estas pantallas en el codebase real (Next.js + React + Firebase)** usando los patrones del proyecto: componentes en `app/` y `components/`, estado con hooks de React, datos desde Firestore en vez de los arrays de ejemplo, y CSS/Tailwind del proyecto (el prototipo usa CSS plano con variables, fácilmente portable a Tailwind o CSS Modules).

Todos los textos, colores y medidas de este README provienen del prototipo y deben respetarse.

---

## Fidelity
**Alta fidelidad (hifi).** Colores, tipografía, espaciado e interacciones son finales. Recrea la UI fielmente con las librerías y patrones que ya uses. Lo único que es *placeholder* son las **fotos de los cromos** (ahora un recuadro rayado con las iniciales del jugador) — ahí van las fotos reales de cada amigo.

---

## Design Tokens

### Colores base (tema oscuro, 3 variantes de fondo)
El prototipo soporta 3 fondos. El **por defecto es "azul"**. Definidos en OKLCH:

| Token | Azul (default) | Carbón | Morado |
|---|---|---|---|
| `--bg` (fondo app) | `oklch(0.17 0.025 265)` | `oklch(0.16 0.004 265)` | `oklch(0.16 0.03 300)` |
| `--bg2` (fondo elevado) | `oklch(0.21 0.03 265)` | `oklch(0.2 0.006 265)` | `oklch(0.2 0.04 300)` |
| `--surface` (tarjetas) | `oklch(0.245 0.035 265)` | `oklch(0.235 0.008 265)` | `oklch(0.235 0.045 300)` |
| `--line` (bordes) | `oklch(0.36 0.05 265)` | `oklch(0.34 0.01 265)` | `oklch(0.36 0.06 300)` |
| `--text` | `oklch(0.95 0.012 265)` | `oklch(0.95 0.005 265)` | `oklch(0.95 0.015 300)` |
| `--muted` (texto 2º) | `oklch(0.68 0.03 265)` | `oklch(0.66 0.012 265)` | `oklch(0.69 0.035 300)` |

- **Acento por defecto:** `#39d6e8` (cian). Opciones en Tweaks: `#39d6e8`, `#f06ec0` (magenta), `#5ee08a` (verde), `#e8c64a` (oro), `#9b7bff` (violeta).
- **Texto sobre acento:** `#06121a` (casi negro azulado).
- **Oro (monedas, mega sobre, badges legendarios):** `oklch(0.83 0.13 85)`.

### Colores de RAREZA (el sistema central)
Cinco niveles, cada uno con color y "soft" (versión apagada):

| Rareza | Etiqueta | `color` | `soft` |
|---|---|---|---|
| `comun` | COMÚN | `oklch(0.74 0.03 265)` | `oklch(0.5 0.04 265)` |
| `raro` | RARO | `oklch(0.76 0.15 230)` | `oklch(0.5 0.13 230)` |
| `epico` | ÉPICO | `oklch(0.72 0.2 300)` | `oklch(0.5 0.18 300)` |
| `legendario` | LEGENDARIO | `oklch(0.83 0.13 85)` | `oklch(0.6 0.13 85)` |
| `mitico` | MÍTICO | `oklch(0.68 0.22 18)` | `oklch(0.5 0.2 18)` |

El color de rareza se inyecta como variable CSS `--rc` en cada cromo y se usa para el borde, el resplandor (`box-shadow`), los puntos y los acentos.

### Tipografía
- **Titulares / displays:** `Chakra Petch` (700). Alternativas en Tweaks: `Space Grotesk`, `Oswald`. Variable `--head-font`.
- **Texto / cuerpo:** `Space Grotesk` (400–700).
- **Monoespaciada (números de cromo, etiquetas, kickers):** `IBM Plex Mono` (500/600).
- Importadas de Google Fonts.

Escala (px): h1 = 32 / titulares de tarjeta 22–26 / cuerpo 13–14 / etiquetas 10–12 / micro-labels 8–9. `-webkit-font-smoothing:antialiased`.

### Espaciado, radios, sombras
- Padding de pantalla: `6px 18px 0`. "Pad" inferior bajo el contenido scroll: `96px` (para no quedar tras la nav).
- Radios: tarjetas grandes `16–19px`, cromos `13–19px`, chips/botones `9–13px`, píldoras `99px`.
- Resplandor de rareza (cromo grande): `inset 0 0 0 1.5px var(--rc), 0 0 calc(46px*var(--glow)) -6px var(--rc)` donde `--glow` ∈ [0,1] (default 0.8).
- Sombra de elevación cromo: `0 26px 60px -22px rgba(0,0,0,.85)`.

---

## Estructura de navegación
**Barra inferior fija (5 ítems)** con efecto *glass* (`backdrop-filter: blur(18px) saturate(160%)`, fondo `color-mix(in oklch, var(--bg) 80%, transparent)`):

`Grupo` · `Álbum` · **`Conseguir`** (botón central destacado, tipo FAB) · `Cambios` · `Perfil`

- El ítem central **Conseguir** es un círculo de 50px con gradiente del acento, elevado `-22px` sobre la barra. Sus iconos son color `#06121a`.
- **Conseguir** abre un *hub* con un **control segmentado de 3 pestañas**: `Sobres` · `Ruleta` · `Tienda`.
- Pestaña inicial al abrir la app: **Grupo (Feed)**.

---

## Screens / Views

### 1. Grupo (Feed) — pantalla inicial
- **Propósito:** ver la actividad reciente del grupo y, en un segmento, el ranking.
- **Header:** kicker "ÁLBUM YEISSY" (mono, cian, letter-spacing .22em) + h1 "El grupo" + **píldora de monedas** a la derecha (saldo, ícono `◉` dorado).
- **Control segmentado** (2 opciones): "Actividad" / "Ranking". El activo va con fondo de acento y texto `#06121a`.
- **Actividad:** lista de filas. Cada fila = avatar circular (color por `hue` del amigo) + texto ("**Coke** sacó a **Robert**") + tiempo (mono, muted) + chip de la derecha según tipo:
  - `pull` → mini-cromo con iniciales y color de rareza.
  - `wheel` → `◉`, `trade` → `⇄`, `complete` → `✓`, `join` → `🎉`.
- **Ranking (segmento):** ver vista 9 (mismo componente `RankingBody`).

### 2. Álbum
- **Propósito:** ver toda la colección, qué tienes y qué te falta.
- **Header:** kicker "TEMPORADA 1" + h1 "Álbum Yeissy" + **anillo de progreso** SVG a la derecha (muestra %).
- **Barra de progreso** horizontal + contador `N/Total` (ej. "12/20").
- **Chips de filtro** (scroll horizontal): "Todos", "Tengo", "Faltan", "Repes" — cada uno con su recuento. Activo = fondo acento.
- **Cuadrícula 3 columnas**, gap 11px. Cada celda (`aspect-ratio:.72`, radio 13px):
  - **Poseído:** gradiente de surface, borde+resplandor con color de rareza, número `#NN` arriba-izq (mono), badge "NUEVO" (acento) si recién conseguido, badge "×N" si tienes repes, foto (iniciales) y pie con nombre + punto de color de rareza. Efecto **holo** al pasar el puntero.
  - **Vacío:** fondo `--bg2`, borde discontinuo, "#NN" + "POR CONSEGUIR".
- **Tap** en una celda → abre el Detalle (vista 3).

### 3. Detalle de cromo (overlay modal)
- **Propósito:** ver el cromo grande, girarlo, y actuar (proponer cambio / buscar).
- Overlay a pantalla completa: fondo `rgba(6,10,22,.78)` + `backdrop-filter: blur(14px)`. Botón ✕ arriba-derecha.
- **Cromo grande (ancho 258px, ratio 1/0.7):**
  - **Cara frontal:** número `#NN` (color rareza) + chip de rareza arriba; foto (iniciales gigantes 76px con patrón de rayas diagonales en color de rareza) con etiqueta de **variante** (BASE/ACCIÓN/LEYENDA/ESPECIAL) y "foto"; nombre (Chakra Petch 25px); mote en cursiva; **stats** (RISAS / SALSEO / AGUANTE) como barras con valor 0–100.
  - **Cara trasera:** logo "HOLO VAULT", número, nombre, chip de rareza, un *fact* (frase divertida del personaje), y "TEMPORADA 1 · ÁLBUM YEISSY".
  - **Holo:** al mover el puntero, la carta hace tilt 3D (`perspective(1100px) rotateX/Y`) y un foil holográfico (`mix-blend-mode: color-dodge`, gradientes arcoíris) sigue al cursor. Intensidad por `--foil` (default .85).
  - **Flip:** al tocar la carta gira en Y (transición .7s). ⚠️ Detalle técnico abajo.
- **Meta** debajo: Variante / Rareza / Estado ("En tu álbum", "Tienes N · M repes", o "Te falta").
- **CTA contextual:**
  - Si tienes repes → botón "Proponer cambio con esta repe".
  - Si te falta → botón "Buscar cambio · pídela al grupo".
  - Si la tienes sin repes → "✓ Pegada en el álbum".

### 4. Sobres (dentro del hub Conseguir)
- **Dos tipos de sobre** como tarjetas horizontales:
  - **Sobre diario:** 4 cromos, gratis. Muestra "N disponibles hoy" o "Vuelve mañana".
  - **Mega sobre PRO:** 5 cromos, ¡legendaria garantizada! Borde/resplandor oro.
- **Flujo de apertura (toma toda la pantalla):**
  1. **Shake:** el sobre grande tiembla (animación `packShake` en bucle) con foil animado. Texto "TOCA PARA ABRIR".
  2. **Reveal:** las cartas se revelan **una a una**. Empiezan **boca abajo** ("toca para revelar"); al tocar, giran a la cara del jugador. Contador "i / N". Si la carta es legendaria/mítica → **confeti** + temblor de pantalla + estallido con el nombre de la rareza + "¡NUEVO!" si no la tenías.
  3. **Summary:** rejilla con el botín; botón "Añadir al álbum" (que de verdad marca los cromos como poseídos / suma repes).
- **Probabilidades** (pesos): diario → común 50, raro 30, épico 14, legendario 5, mítico 1. Mega → raro 30, épico 35, legendario 28, mítico 7 (y fuerza al menos una ≥legendaria).

### 5. Ruleta (dentro del hub Conseguir)
- **Rueda SVG de 8 segmentos** (280px), puntero ▼ arriba, hub central `◉`.
- Premios (etiqueta visible en cada gajo): `+50`, `SOBRE`, `+20`, `ÉPICO`, `+100`, `+10`, `LEGEND.`, `+30`. Cada gajo coloreado según el tipo de premio.
- **1 giro gratis al día**; después **40 monedas** por tirada.
- **Giro:** rota 5–6 vueltas + offset al gajo ganador, `transition: transform 4.1s cubic-bezier(.16,.84,.3,1)`. Al parar muestra "¡PREMIO!" con el resultado.
- **Efectos:** premio `coins` suma monedas; `card` añade un cromo de esa rareza al álbum; `pack` da un sobre.

### 6. Tienda (dentro del hub Conseguir)
- **Rejilla 2 columnas** de productos. Cada tarjeta: visual (ícono temático con gradiente), nombre, descripción, botón de compra con precio `◉ N`. Badge "POPULAR"/"PRO" arriba-derecha en algunos.
- Productos: **Pack de 3 sobres** (120), **Mega sobre PRO** (300, POPULAR), **Elige un cromo** (500, PRO), **Bolsa de monedas** (+250, "Gratis hoy" — IAP simulada), **Marco animado** (200), **Hueco extra** (80).
- Comprar **descuenta monedas** y muestra un *toast* de confirmación; si no llega el saldo, avisa.

### 7. Cambios (intercambios)
- **Control segmentado:** "Recibidas" (con contador) / "Proponer".
- **Recibidas:** tarjetas de propuesta. Cabecera con avatar + "**Nombre** te propone un cambio". Cuerpo: cromo que te da `⇄` cromo que le das. Acciones "Rechazar" / "Aceptar" (con toast).
- **Proponer:** carrusel "TÚ DAS" (tus repes, seleccionable), `⇅`, carrusel "TÚ PIDES" (cromos que te faltan). Botón "Enviar propuesta al grupo".

### 8. Perfil
- **Tarjeta de perfil:** avatar grande (gradiente por hue), nombre, mote, "2º del grupo · Temporada 1".
- **Rejilla de 6 tiles** de stats: Completado %, Cromos N/Total, Repes, Legendarias, Sobres abiertos, Racha ("7 días 🔥").
- **"TUS MEJORES CROMOS":** 3 mini-cards de las rarezas más altas.
- Botón "Cerrar sesión".

### 9. Ranking (componente `RankingBody`, usado en el segmento del Feed)
- **Podio** de los 3 primeros (orden visual 2-1-3), el #1 más grande con corona ♛ y resplandor de acento.
- **Lista** del resto: posición, avatar, nombre, barra de %, % y nº de legendarias (✦). El usuario (`ME`) va resaltado con borde de acento.

---

## Interactions & Behavior
- **Holo / tilt:** un hook `useHolo(enabled)` escucha `pointermove` sobre el cromo, calcula posición relativa (`--mx`,`--my`) y, si `enabled`, aplica `--rx`/`--ry` para el tilt 3D. En `pointerleave` resetea. El foil es un overlay con `mix-blend-mode: color-dodge` y opacidad ligada a `--foil`.
- **Flip 3D del cromo:** ver nota técnica.
- **Animaciones clave** (keyframes): `packShake` (1.4s bucle), `tapPulse`, `revealPop` (cubic-bezier(.2,1.3,.4,1)), `burstIn`, `screenShake` (.55s), `confettiFall`, `foilSweep`, `toastIn`.
- **Tienda/Ruleta:** modifican el saldo de monedas de forma optimista en cliente.
- **Sobres:** "Añadir al álbum" muta el estado de los cromos (owned/dupes/isNew).
- **Navegación:** cambio de pestaña instantáneo (sin router; en Next.js usar rutas o estado según prefieras).

## State Management
En el prototipo, el componente `App` mantiene:
- `tab` — pestaña activa ("feed" | "album" | "conseguir" | "cambios" | "perfil"). Default "feed".
- `detail` — cromo abierto en el overlay (o null).
- `cards` — copia mutable del array de cromos (owned, dupes, isNew).
- `coins` — saldo de monedas (empieza en 340).
- Tweaks (acento, fondo, foil, glow, tilt, fuente) — solo para el prototipo; **no portar** salvo que quieras un selector de tema.

**En tu app:** `cards`, `coins`, propuestas de cambio, feed y ranking vienen de **Firestore**. La colección de cromos del set es estática (definición del álbum); lo poseído/repes es por usuario. Los "pulls" de sobres/ruleta deberían resolverse en backend (Cloud Function) para evitar trampas, no en cliente.

## Modelo de datos (referencia, ver `hv-data.jsx`)
- **Amigo:** `{ key, name, mote, hue (0–360 para el color del avatar), fact }`.
- **Cromo:** `{ id, num, who, name, mote, hue, fact, variant ('BASE'|'ACCIÓN'|'LEYENDA'|'ESPECIAL'), rarity, stats:{risas,salseo,aguante}, owned, dupes, isNew }`.
- Cada amigo tiene 3 variantes (BASE/ACCIÓN/LEYENDA) + 2 cartas especiales del set ("EL GRUPO" mítica, "LA RESACA" común). 20 cromos en total en el ejemplo.
- **Ranking:** `{ who, pct, cromos, legendarias, sobres }`.
- **Feed:** `{ id, who, t, type, text, cardId?, rarity?, with?, pct? }`.
- **Premios ruleta:** `WHEEL[]`. **Productos tienda:** `SHOP[]`.

## ⚠️ Nota técnica importante: flip 3D + foil
`mix-blend-mode` en el foil **aplana el contexto 3D** y rompe `backface-visibility:hidden` (la cara trasera "traspasa"). Solución usada: además de `backface-visibility:hidden`, se conmuta la **opacidad de cada cara a la mitad del giro** con una transición retardada:
```css
.hv-face{ backface-visibility:hidden; transition: opacity 0s linear .35s; }
.hv-card-inner:not(.flipped) .hv-back{ opacity:0; }
.hv-card-inner.flipped .hv-front{ opacity:0; }
```
Replícalo si reusas el efecto holo + flip.

## Assets
- **Fotos de cromos:** PLACEHOLDER (iniciales + rayas). Sustituir por fotos reales de cada amigo (recomendado: cuadradas, recorte de cara/torso).
- **Iconos:** SVG inline simples (nav, ✕). Sin librería externa.
- **Fuentes:** Google Fonts (Chakra Petch, Space Grotesk, IBM Plex Mono, Oswald).
- Sin imágenes ráster en el diseño.

## Files (en este bundle)
- `HoloVault.html` — entry point del prototipo (todo el CSS está aquí, en `<style>`).
- `hv-data.jsx` — datos de ejemplo + modelo (amigos, cromos, rarezas, ranking, feed, ruleta, tienda).
- `hv-cromo.jsx` — `useHolo`, `Cromo` (flip), `MiniCromo`, `CromoDetail`, chips/stats.
- `hv-album.jsx` — `AlbumScreen`, `RankingScreen`/`RankingBody`, `PerfilScreen`, `ProgressRing`.
- `hv-sobres.jsx` — `SobresScreen` (apertura), `CambiosScreen` (intercambios), confeti, probabilidades.
- `hv-extra.jsx` — `RuletaScreen`, `TiendaScreen`, `FeedScreen`, `GetHub`, `CoinPill`.
- `hv-app.jsx` — shell, navegación, estado, panel de Tweaks.
- `ios-frame.jsx` / `tweaks-panel.jsx` — andamiaje del prototipo (marco de iPhone y panel de ajustes). **No portar** — son solo para visualizar.

## Cómo usarlo con Claude Code
1. Copia la carpeta `design_handoff_holo_vault/` dentro de tu repo `album-yeissy`.
2. Abre Claude Code en el repo y dile algo como:
   > "Lee `design_handoff_holo_vault/README.md` y los `.jsx` de referencia. Reimplementa el rediseño 'Holo Vault' en mi app Next.js + Firebase, empezando por el Álbum y el Detalle de cromo. Usa mis componentes y mi conexión a Firestore existentes; los datos del prototipo son de ejemplo."
3. Itera pantalla a pantalla (Álbum → Detalle → Sobres → Ruleta → Tienda → Feed/Ranking → Cambios → Perfil).
