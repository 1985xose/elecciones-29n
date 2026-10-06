"use strict";
const D = {};
const DIA = 86400000;
const fmt1 = new Intl.NumberFormat("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const fmt0 = new Intl.NumberFormat("es-ES");
const fFecha = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short" });
const fFechaLarga = new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long" });
const $ = (s) => document.querySelector(s);
function el(tag, attrs = {}, ...hijos) {
  const e = tag === "svg" ? document.createElementNS("http://www.w3.org/2000/svg", "svg") : document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === "style" && typeof v === "object") { for (const [sk, sv] of Object.entries(v)) sk.startsWith("--") ? e.style.setProperty(sk, sv) : (e.style[sk] = sv); }
    else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
    else if (k === "html") e.innerHTML = v;
    else e.setAttribute(k, v === true ? "" : v);
  }
  for (const h of hijos.flat()) if (h != null && h !== false) e.append(h.nodeType ? h : String(h));
  return e;
}
const color = (k) => D.config.partidos[k]?.color || "#8A93A3";
const nombre = (k) => D.config.partidos[k]?.nombre || k;
const hoy = () => new Date(new Date().toISOString().slice(0, 10) + "T12:00:00Z");
const fechaD = (s) => new Date(s + "T12:00:00Z");
const r100 = (p) => Math.round(p * 100);
const deCada100 = (p) => `${r100(p)} de cada 100`;
const pct = (p) => `${r100(p)} de 100`;
const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
const VOTOS_VALIDOS = 24688087; // votos válidos del 23J
function puntosTexto(n) {
  const v = Math.round(Math.abs(n) * VOTOS_VALIDOS / 100 / 10000) * 10000;
  const refs = [[200000, "Vitoria"], [270000, "Gijón"], [330000, "Córdoba"], [450000, "Bilbao y Murcia juntas"], [580000, "Málaga"], [690000, "Sevilla"], [800000, "Valencia"], [1100000, "Sevilla y Zaragoza juntas"], [1650000, "Barcelona"], [2400000, "Barcelona y Valencia juntas"], [3300000, "Madrid"]];
  const ref = refs.reduce((a, b) => Math.abs(b[0] - v) < Math.abs(a[0] - v) ? b : a);
  return `${fmt1.format(Math.abs(n))} puntos, unos ${fmt0.format(v)} votantes, más o menos la población de ${ref[1]}`;
}
const signo = (d) => (d > 0 ? "+" : "−") + fmt1.format(Math.abs(d));
const ordenar = (o) => Object.keys(o).sort((a, b) => o[b] - o[a]);
const lista = (arr) => arr.length <= 1 ? arr.join("") : arr.slice(0, -1).join(", ") + " y " + arr[arr.length - 1];
function hace(iso) {
  if (!iso) return "";
  const m = Math.round((Date.now() - new Date(iso)) / 60000);
  if (m < 60) return `hace ${Math.max(m, 1)} min`;
  if (m < 1440) return `hace ${Math.round(m / 60)} h`;
  return `hace ${Math.round(m / 1440)} d`;
}
async function cargar(n) { try { const r = await fetch(`data/${n}.json?v=${Date.now()}`); return r.ok ? await r.json() : null; } catch { return null; } }
function escenario(id) { return D.prob?.escenarios?.[id]; }
const nombreEsc = (e) => (D.config.escenarios.find((x) => x.id === e.id) || {}).corto || lista(e.partidos.map(nombre));

/* ---------- Pestañas ---------- */
function activarPestana(id) {
  const ids = ["hoy", "mapa", "encuestas", "simulador", "noticias"];
  if (!ids.includes(id)) id = "hoy";
  for (const i of ids) document.getElementById(i).hidden = i !== id;
  document.querySelectorAll(".pestanas a").forEach((a) => a.classList.toggle("activa", a.dataset.tab === id));
  window.scrollTo({ top: 0 });
  if (id === "encuestas" && !graficoTendencia && D.listo) pintarTendencia();
}
window.addEventListener("hashchange", () => activarPestana(location.hash.slice(1)));

/* ---------- Media ---------- */
function calcMedia(fecha = hoy(), ventana = 30) {
  return Media.calcMedia(D.encuestas?.encuestas || [], fecha, { ventana, incluirCIS: $("#incluir-cis")?.checked, ranking: D.fiabilidad?.ranking, sesgos: D.analisis?.sesgos });
}

/* Patrón de colores de una coalición según el peso de cada partido en escaños (p. ej. 2 PP por cada Vox) */
function coloresCoalicion(e, total) {
  const peso = e.partidos.filter((k) => (total[k] || 0) > 0).map((k) => ({ k, n: total[k] })).sort((a, b) => b.n - a.n).slice(0, 3);
  if (!peso.length) return [color(e.partidos[0])];
  const suma = peso.reduce((a, x) => a + x.n, 0), out = [];
  for (const x of peso) for (let i = 0; i < Math.max(1, Math.round(10 * x.n / suma)); i++) out.push(color(x.k));
  // intercalar para que no salgan en bloques
  const res = []; const colas = peso.map((x) => ({ c: color(x.k), n: Math.max(1, Math.round(10 * x.n / suma)) }));
  while (res.length < 10) { for (const q of colas) if (q.n > 0 && res.length < 10) { res.push(q.c); q.n--; } if (colas.every((q) => q.n <= 0)) break; }
  return res.length ? res : out;
}
/* ---------- Gráfico de 100 personas ---------- */
function waffle(cont, leyendaCont, partes) {
  // partes: [{p, color, nombre}] sumando 1
  const celdas = [];
  let acum = 0;
  for (const x of partes) { const n = Math.round((acum + x.p) * 100) - Math.round(acum * 100);
    for (let i = 0; i < n; i++) celdas.push(x.colores ? x.colores[i % x.colores.length] : x.color); acum += x.p; }
  while (celdas.length < 100) celdas.push("#D7DCE3");
  let svg = `<svg viewBox="0 0 200 200" role="img" aria-label="Cien veces que se repiten las elecciones">`;
  celdas.slice(0, 100).forEach((c, i) => { const x = (i % 10) * 20 + 2, y = Math.floor(i / 10) * 20 + 2; svg += `<rect x="${x}" y="${y}" width="16" height="16" rx="4" fill="${c}"/>`; });
  cont.innerHTML = svg + "</svg>";
  leyendaCont.replaceChildren(...partes.filter((x) => x.p >= 0.005).map((x) => el("span", {}, el("i", { style: { background: x.colores ? `linear-gradient(90deg, ${x.colores[0]} 50%, ${x.colores[x.colores.length - 1]} 50%)` : x.color } }), `${x.nombre}, ${r100(x.p)} de cada 100`)));
}

/* ---------- Hemiciclo ---------- */
function hemiciclo(cont, escanos, filas = 12) {
  const orden = D.config.orden_hemiciclo;
  const claves = Object.keys(escanos).filter((k) => escanos[k] > 0).sort((a, b) => (orden.indexOf(a) + 1 || 99) - (orden.indexOf(b) + 1 || 99));
  const total = claves.reduce((s, k) => s + escanos[k], 0);
  if (!total) { cont.replaceChildren(); return; }
  const r0 = 0.4, radios = [];
  for (let i = 0; i < filas; i++) radios.push(r0 + (1 - r0) * i / (filas - 1));
  const sumR = radios.reduce((a, b) => a + b, 0);
  const porFila = radios.map((r) => Math.round(total * r / sumR));
  porFila[filas - 1] += total - porFila.reduce((a, b) => a + b, 0);
  const asientos = [];
  radios.forEach((r, i) => { for (let j = 0; j < porFila[i]; j++) { const a = Math.PI * (1 - (porFila[i] === 1 ? 0.5 : j / (porFila[i] - 1))); asientos.push({ x: r * Math.cos(a), y: r * Math.sin(a), a }); } });
  asientos.sort((p, q) => q.a - p.a || Math.hypot(p.x, p.y) - Math.hypot(q.x, q.y));
  const colores = [];
  for (const k of claves) for (let i = 0; i < escanos[k]; i++) colores.push(color(k));
  const rp = (1 - r0) / (filas - 1) * 0.42, E = 100;
  let svg = `<svg viewBox="-110 -108 220 128" role="img" aria-label="Hemiciclo de ${total} escaños">`;
  asientos.forEach((s, i) => { svg += `<circle cx="${(s.x * E).toFixed(1)}" cy="${(-s.y * E).toFixed(1)}" r="${(rp * E).toFixed(1)}" fill="${colores[i] || "var(--linea)"}"/>`; });
  svg += `<line x1="0" y1="-106" x2="0" y2="${-r0 * E + 6}" stroke="var(--bronce)" stroke-width="1.2" stroke-dasharray="2 2"/>`;
  svg += `<text x="0" y="16" text-anchor="middle" font-size="12" font-weight="700" fill="var(--tinta)">176 para la mayoría</text></svg>`;
  cont.innerHTML = svg;
}
const leyenda = (cont, escanos, extra) => cont.replaceChildren(...ordenar(escanos).filter((k) => escanos[k] > 0).map((k) => el("span", {}, el("i", { class: "punto", style: { background: color(k) } }), `${nombre(k)} ${escanos[k]}`, extra ? extra(k) : null)));

/* ---------- Hoy, las preguntas ---------- */
let graficoHistorial, graficoTendencia, graficoAtencion;
function pintarHoy(m, m7, proy) {
  const dias = Math.round((fechaD(D.config.eleccion.fecha) - hoy()) / DIA);
  $("#cuenta").innerHTML = dias > 1 ? `faltan <strong>${dias} días</strong>` : dias === 1 ? "se vota <strong>mañana</strong>" : dias === 0 ? "se vota <strong>hoy</strong>" : "elecciones celebradas";
  const P = D.prob, der = escenario(D.config.principales.derecha), izq = escenario(D.config.principales.izquierda);
  const o = ordenar(m.media);

  // 0. El resumen de hoy, cada línea lleva a lo que anuncia
  $("#resumen-titulo").replaceChildren("El resumen de hoy ", el("span", { class: "fecha" }, new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long" }).format(new Date())));
  const ICO = { urna: "M4 10h16v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1zM7 4h10l2 4H5zM9 13v2h6v-2z", congreso: "M12 3 2 10h3v9h14v-9h3zm-3 8h2v6H9zm4 0h2v6h-2z", encuesta: "M4 20V9h3v11zm6.5 0V4h3v16zM17 20v-6h3v6z", noticia: "M4 4h13a2 2 0 0 1 2 2v13H5a1 1 0 0 1-1-1zm2 3v2h9V7zm0 4v2h9v-2zm0 4v2h6v-2z", mapa: "M9 3 3 5.5v15L9 18l6 2.5 6-2.5v-15L15 6zM9 5.2v10.6l6 2.4V7.6z" };
  const fila = (ico, texto, sub, accion) => el("li", {}, el(typeof accion === "string" ? "a" : "button", typeof accion === "string" ? { class: "enlace-resumen", href: accion, target: "_blank", rel: "noopener" } : { class: "enlace-resumen", type: "button", onclick: accion },
    el("svg", { viewBox: "0 0 24 24", html: `<path d="${ICO[ico]}"/>` }), el("span", {}, texto, sub ? el("small", {}, sub) : null), el("svg", { class: "flecha", viewBox: "0 0 24 24", html: '<path d="M9 5l7 7-7 7-1.4-1.4L13.2 12 7.6 6.4z"/>' })));
  const ir = (sel) => () => { const t = $(sel); t.scrollIntoView({ behavior: "smooth", block: "center" }); t.classList.add("destacada"); setTimeout(() => t.classList.remove("destacada"), 2500); };
  const resumen = [];
  if (o.length) resumen.push(fila("urna", `${nombre(o[0])} va primero con ${Math.round(m.media[o[0]])} de cada 100 votos, ${Math.round(m.media[o[0]] - m.media[o[1]])} más que ${nombre(o[1])}.`, "Ver la media de encuestas", ir("#g-ganando")));
  if (P && der && izq) { const fav = der.p >= izq.p ? der : izq; resumen.push(fila("congreso", `${cap(nombreEsc(fav))} ${fav.partidos.length > 1 ? "suman" : "suma"} mayoría en ${deCada100(fav.p)} de las simulaciones. Nadie suma en ${deCada100(P.bloqueo)}.`, "Ver quién gobernaría", ir("#g-waffle"))); }
  const uu = D.analisis?.ultimas?.[0];
  if (uu) resumen.push(fila("encuesta", `Última encuesta, ${uu.empresa}${uu.encargo ? ` para ${uu.encargo}` : ""}, del ${fFecha.format(fechaD(uu.fin))}, ${uu.veredicto === "ruido" ? "sin novedades" : uu.veredicto === "leve" ? "con algún movimiento" : "con una novedad de verdad"}.`, uu.texto, () => { location.hash = "#encuestas"; setTimeout(ir(`#enc-${CSS.escape(uu.id)}`), 150); }));
  const pol0 = D.noticias?.polemicas?.[0];
  if (pol0) resumen.push(fila("noticia", pol0.titulo, `Polémica del día, ${nombre(pol0.partido)}, ${pol0.fuente}`, pol0.enlace));
  const aire0 = P ? [...P.provincias].sort((a, b) => b.en_el_aire - a.en_el_aire)[0] : null;
  if (aire0 && aire0.disputa) resumen.push(fila("mapa", `La provincia más reñida es ${aire0.nombre}, ${nombre(aire0.disputa.tiene)} y ${nombre(aire0.disputa.quiere)} se disputan el último asiento.`, "Ver el mapa", () => { mapa.sel = aire0.nombre; mapa.vista = "filo"; document.querySelectorAll(".conmutador button").forEach((x) => x.setAttribute("aria-pressed", x.dataset.vista === "filo" ? "true" : "false")); pintarMapa(mapa.proy); location.hash = "#mapa"; }));
  $("#resumen").replaceChildren(...resumen);

  // 1. ¿Quién va ganando?
  if (o.length) {
    $("#r-ganando").replaceChildren(el("b", {}, `${nombre(o[0])}.`), ` De cada 100 votos sacaría ${Math.round(m.media[o[0]])}, ${nombre(o[1])} ${Math.round(m.media[o[1]])} y ${nombre(o[2])} ${Math.round(m.media[o[2]])}.`);
    const max = m.media[o[0]];
    $("#g-ganando").replaceChildren(...o.slice(0, 3).map((k) => { const d = m7.media[k] != null ? m.media[k] - m7.media[k] : 0;
      return el("div", { class: "bg" }, el("div", { class: "nom" }, el("i", { class: "punto", style: { background: color(k) } }), nombre(k)),
        el("div", { class: "num" }, Math.round(m.media[k]), el("small", {}, Math.abs(d) >= 0.2 ? `${d > 0 ? "sube" : "baja"} ${fmt1.format(Math.abs(d))}` : "igual que la semana pasada")),
        el("div", { class: "pista" }, el("i", { style: { width: `${m.media[k] / max * 100}%`, background: color(k) } }))); }));
    $("#g-resto").replaceChildren(...o.slice(3).filter((k) => m.media[k] >= 0.5).map((k) => el("span", {}, el("i", { class: "punto", style: { background: color(k) } }), `${nombre(k)} ${fmt1.format(m.media[k])}`)));
    $("#como-ganando").textContent = `Hoy entran ${m.usadas.length} encuestas: ${lista(m.usadas.map((e) => `${e.empresa_base} (${fFecha.format(fechaD(e.fin))})`))}.`;
  } else $("#r-ganando").textContent = "Todavía no hay encuestas cargadas. La primera actualización tarda unos minutos.";

  // 2. ¿Quién va a gobernar?
  const esc = D.resultados?.escanos || proy.total;
  hemiciclo($("#hemiciclo"), esc, 10);
  leyenda($("#leyenda"), esc);
  if (P && der && izq) {
    const fav = der.p >= izq.p ? der : izq, otro = fav === der ? izq : der;
    const nFav = nombreEsc(fav), nOtro = nombreEsc(otro);
    let frase;
    if (fav.p >= 0.85) frase = [el("b", {}, `Casi seguro, ${nFav}${fav.partidos.length > 1 ? " juntos" : ""}.`), ` Hemos repetido las elecciones ${fmt0.format(P.simulaciones)} veces con el margen de error de las encuestas y en ${deCada100(fav.p)} suman mayoría.`];
    else if (fav.p >= 0.5) frase = [el("b", {}, `Lo más probable, ${nFav}${fav.partidos.length > 1 ? " juntos" : ""}.`), ` En ${deCada100(fav.p)} de nuestras simulaciones suman mayoría, pero en ${deCada100(1 - fav.p)} no.`];
    else frase = [el("b", {}, "Nadie lo tiene claro."), ` ${cap(nFav)} llegan a la mayoría en ${deCada100(fav.p)}, ${nOtro} en ${deCada100(otro.p)}.`];
    frase.push(` ${cap(nOtro)} ${otro.p < 0.005 ? "no llegan casi nunca" : `llegan en ${deCada100(otro.p)}`}. En ${deCada100(P.bloqueo)} nadie suma y habría que negociar.`);
    $("#r-gobernar").replaceChildren(...frase);
    waffle($("#g-waffle"), $("#g-waffle-ley"), [{ p: der.p, colores: coloresCoalicion(der, proy.total), nombre: nombreEsc(der) }, { p: P.bloqueo, color: "#8A93A3", nombre: "Nadie suma" }, { p: izq.p, colores: coloresCoalicion(izq, proy.total), nombre: nombreEsc(izq) }]);
    $("#compartir").hidden = false;
    const op = Object.keys(P.partidos).sort((a, b) => P.partidos[b].p50 - P.partidos[a].p50).filter((k) => P.partidos[k].p90 > 0).slice(0, 7), MAX = 240;
    $("#abanicos").replaceChildren(...op.map((k) => { const x = P.partidos[k];
      return el("div", { class: "abanico" }, el("span", { class: "nom" }, nombre(k)), el("div", { class: "pista" }, el("div", { class: "m176" }),
        el("div", { class: "rango", style: { left: `${x.p10 / MAX * 100}%`, width: `${(x.p90 - x.p10) / MAX * 100}%`, background: color(k) } }),
        el("div", { class: "mediana", style: { left: `calc(${x.p50 / MAX * 100}% - 2px)`, background: color(k) } }),
        el("span", { class: "num", style: { left: `calc(${x.p90 / MAX * 100}% + 8px)` } }, `${x.p10} a ${x.p90}`))); }),
      el("div", { class: "eje" }, ...[0, 50, 100, 150, 176, 200].map((v) => el("span", { style: { left: `${v / MAX * 100}%`, color: v === 176 ? "var(--bronce)" : null, fontWeight: v === 176 ? 700 : null } }, v))));
    const primero = Object.entries(P.partidos).sort((a, b) => b[1].p_primero - a[1].p_primero)[0];
    const tramos = [der, izq].filter((e) => e.margen != null).map((e) => e.margen > 0 ? `a ${nombreEsc(e)} les faltan ${puntosTexto(e.margen)}, para que la mayoría sea más probable que improbable` : `a ${nombreEsc(e)} les sobran ${puntosTexto(-e.margen)} de margen`);
    $("#como-gobernar").textContent = `${nombre(primero[0])} es el partido más votado en ${deCada100(primero[1].p_primero)}. ${tramos.length ? tramos.join(", y ") + "." : ""} ${fav.bisagra?.length ? `La provincia que decide, donde cae el asiento 176 de ${nombreEsc(fav)} más veces, es ${fav.bisagra[0].nombre}.` : ""}`;
    const bt = P.backtest;
    if (bt) { const real = bt.resultado_escanos, pv = (real.PP || 0) + (real.Vox || 0), f6 = bt.fechas[bt.fechas.length - 1], f54 = bt.fechas[0];
      $("#backtest").replaceChildren(el("p", {}, el("b", {}, "¿Y acierta esto? "), `Lo probamos con 2023. A ${f54.dias} días del 23J, con las encuestas de entonces, este modelo habría dicho que PP y Vox llegaban a la mayoría ${deCada100(f54.escenarios.pp_vox.p)}. A ${f6.dias} días, ${deCada100(f6.escenarios.pp_vox.p)}. Se quedaron en ${pv} asientos. Es decir, se habría equivocado de lado, pero dejando claro que no era seguro. Las encuestas españolas suelen quedarse cortas con el PSOE y eso ya lo tenemos en cuenta.`)); }
  } else {
    $("#r-gobernar").textContent = o.length ? `Si se votara hoy, ${nombre(ordenar(esc)[0])} sacaría ${esc[ordenar(esc)[0]]} asientos. Las probabilidades se calculan en la próxima actualización.` : "";
  }

  // Senado
  if (P?.senado) {
    const sen = Object.entries(P.senado).filter(([, v]) => v.p50 > 0).sort((a, b) => b[1].p50 - a[1].p50);
    if (sen.length) { const [k1, v1] = sen[0];
      $("#r-senado").replaceChildren(el("b", {}, v1.p_mayoria >= 0.5 ? `${nombre(k1)} tendría mayoría absoluta en el Senado en ${deCada100(v1.p_mayoria)}.` : `Nadie tiene asegurada la mayoría del Senado.`), ` ${nombre(k1)} sacaría entre ${v1.p10} y ${v1.p90} de los 208 senadores que se eligen${sen[1] ? `, ${nombre(sen[1][0])} entre ${sen[1][1].p10} y ${sen[1][1].p90}` : ""}.`);
      $("#g-senado").replaceChildren(...sen.slice(0, 5).map(([k, v]) => el("div", { class: "bg" }, el("div", { class: "nom" }, el("i", { class: "punto", style: { background: color(k) } }), nombre(k)), el("div", { class: "num" }, v.p50, el("small", {}, ` senadores`)), el("div", { class: "pista" }, el("i", { style: { width: `${v.p50 / 208 * 100}%`, background: color(k) } })))));
    }
  } else { $("#r-senado").textContent = "Se calcula en la próxima actualización."; }

  // 3. ¿Ha cambiado algo?
  const cambios = Object.keys(m.media).filter((k) => m7.media[k] != null && m.media[k] >= 2).map((k) => ({ k, d: m.media[k] - m7.media[k] })).sort((a, b) => Math.abs(b.d) - Math.abs(a.d));
  const fuertes = cambios.filter((x) => Math.abs(x.d) >= 0.3);
  const u = D.analisis?.ultimas?.[0];
  let fr = fuertes.length ? `${fuertes.length === 1 ? "Un poco." : "Algo."} ${lista(fuertes.slice(0, 3).map((x) => `${nombre(x.k)} ${x.d > 0 ? "sube" : "baja"} ${fmt1.format(Math.abs(x.d))} puntos`))}.` : (cambios.length ? "Poco. Ningún partido se mueve más de tres décimas en la media." : "Aún no hay datos.");
  if (u) fr += ` La última encuesta es de ${u.empresa}, del ${fFecha.format(fechaD(u.fin))}, y ${u.veredicto === "ruido" ? "dice más o menos lo mismo que las demás" : u.veredicto === "leve" ? "se sale un poco de lo habitual en esa empresa" : "trae un cambio de verdad respecto a lo que suele dar esa empresa"}.`;
  $("#r-cambios").textContent = fr;
  $("#g-cambios").replaceChildren(...cambios.slice(0, 4).map((x) => el("div", { class: "cambio" }, el("span", { class: "nom" }, el("i", { class: "punto", style: { background: color(x.k) } }), nombre(x.k)),
    el("span", { class: `d ${Math.abs(x.d) < 0.1 ? "" : x.d > 0 ? "sube" : "baja"}` }, Math.abs(x.d) < 0.1 ? "igual" : signo(x.d)), el("span", { class: "m" }, `${fmt1.format(m7.media[x.k])} hace una semana, ${fmt1.format(m.media[x.k])} hoy`))));
  pintarHistorial();

  // 4. ¿Valen lo mismo todos los votos?
  const esc2 = D.resultados?.escanos || proy.total;
  const utiles = (k) => { let con = 0, sin = 0, provCon = 0, provSin = 0;
    for (const pr of proy.provincias) { const v = (pr.cuotas[k] || 0) * pr.n; if (!v) continue; if (pr.escanos[k]) { con += v; provCon++; } else { sin += v; provSin++; } }
    return { util: con / (con + sin || 1), provCon, provSin }; };
  const partidosC = ordenar(m.media).filter((k) => m.media[k] >= 1.2).map((k) => ({ k, ...utiles(k) })).sort((a, b) => b.util - a.util);
  if (partidosC.length > 2) {
    const a = partidosC[0], z = partidosC[partidosC.length - 1];
    $("#r-coste").replaceChildren(el("b", {}, "No."), ` De cada 100 votos a ${nombre(a.k)}, ${r100(a.util)} sirven para elegir a un diputado. De cada 100 votos a ${nombre(z.k)}, ${z.util > 0 ? `solo ${r100(z.util)}` : "ninguno"}, ${z.provCon ? `los demás se pierden en las ${z.provSin} provincias donde no consigue asiento` : `se pierden todos porque no llega a asiento en ninguna provincia`}.`);
    $("#g-coste").replaceChildren(...partidosC.map((x) => el("div", { class: "bg" }, el("div", { class: "nom" }, el("i", { class: "punto", style: { background: color(x.k) } }), nombre(x.k)),
      el("div", { class: "num" }, r100(x.util), el("small", {}, ` de cada 100 eligen`)),
      el("div", { class: "pista doble" }, el("i", { style: { width: `${r100(x.util)}%`, background: color(x.k) } })))));
    // Reparto proporcional puro (restos mayores) con todos los partidos con voto
    const conVoto = ordenar(m.media).filter((k) => m.media[k] > 0), suma = conVoto.reduce((s, k) => s + m.media[k], 0);
    const cuo = conVoto.map((k) => ({ k, q: m.media[k] / suma * 350 }));
    const prop = {}; let asignados = 0;
    for (const x of cuo) { prop[x.k] = Math.floor(x.q); asignados += prop[x.k]; }
    for (const x of cuo.sort((a, b) => (b.q - Math.floor(b.q)) - (a.q - Math.floor(a.q))).slice(0, 350 - asignados)) prop[x.k]++;
    const comp = ordenar(esc2).filter((k) => esc2[k] > 0 || prop[k] >= 1).map((k) => ({ k, real: esc2[k] || 0, prop: prop[k] || 0 })).sort((a, b) => b.real - a.real);
    const mayor = [...comp].sort((a, b) => (b.real - b.prop) - (a.real - a.prop))[0], menor = [...comp].sort((a, b) => (a.real - a.prop) - (b.real - b.prop))[0];
    $("#r-proporcional").textContent = `Si los 350 asientos se repartieran en proporción al voto de toda España, ${nombre(mayor.k)} tendría ${mayor.prop} en vez de ${mayor.real}, y ${nombre(menor.k)} tendría ${menor.prop} en vez de ${menor.real}.`;
    $("#g-proporcional").replaceChildren(...comp.map((x) => { const d = x.real - x.prop;
      return el("div", { class: "prop" }, el("span", { class: "nom" }, el("i", { class: "punto", style: { background: color(x.k) } }), nombre(x.k)), el("span", { class: "n" }, x.real), el("span", { class: "vs" }, `tendrá, y ${x.prop} si todo valiera igual`), el("span", { class: `d ${d > 0 ? "sube" : d < 0 ? "baja" : ""}` }, d ? `${d > 0 ? "+" : "−"}${Math.abs(d)}` : "=")); }));
    const expl = partidosC.filter((x) => x.util < 0.6 || x.util > 0.9).slice(0, 5);
    $("#g-perdidos").replaceChildren(el("p", {}, el("b", {}, "Los casos más claros")), ...expl.map((x) => el("div", { class: "perdido" }, el("b", {}, el("i", { class: "punto", style: { background: color(x.k) } }), nombre(x.k)),
      el("span", { class: "v" }, `${r100(1 - x.util)} % de sus votos se pierden`),
      el("span", { class: "m" }, x.provCon ? `Saca asiento en ${x.provCon} ${x.provCon === 1 ? "provincia" : "provincias"} y se queda a cero en ${x.provSin}.` : `Con unos ${fmt0.format(Math.round(m.media[x.k] * VOTOS_VALIDOS / 100 / 10000) * 10000)} votos no saca ningún asiento.`))));
  }

  // 5. Mi provincia
  pintarMiProvincia(proy);

  // 5. Titulares
  const tit = (n) => el("a", { class: "titular-n", href: n.enlace, target: "_blank", rel: "noopener" }, n.partido ? el("span", { class: "tag", style: { background: color(n.partido) } }, nombre(n.partido)) : null, n.titulo, el("span", { class: "m" }, `${n.fuente} ${hace(n.fecha)}`));
  $("#titulares").replaceChildren(...(D.noticias?.generales || []).slice(0, 4).map(tit), ...(D.noticias?.polemicas || []).slice(0, 2).map(tit));
  $("#titulares-todos").replaceChildren(...(D.noticias?.generales || []).map(tit));
  $("#polemicas-todas").replaceChildren(...((D.noticias?.polemicas || []).length ? D.noticias.polemicas.map(tit) : [el("p", { class: "vacio" }, "Se recogen en la próxima actualización.")]));

  // 6. Fechas
  const ag = D.agenda || [], sig = ag.find((x) => fechaD(x.fin || x.fecha) >= hoy());
  $("#r-fechas").textContent = `Se vota el domingo 29 de noviembre${dias > 0 ? `, dentro de ${dias} días` : ""}. ${sig ? `Lo siguiente en el calendario, ${sig.titulo.toLowerCase()}, ${sig.fin ? `del ${fFecha.format(fechaD(sig.fecha))} al ${fFecha.format(fechaD(sig.fin))}` : `el ${fFechaLarga.format(fechaD(sig.fecha))}`}.` : ""}`;
  $("#agenda").replaceChildren(...ag.map((x) => { const fin = fechaD(x.fin || x.fecha);
    return el("li", { class: fin < hoy() ? "pasado" : x === sig ? "siguiente" : null }, el("span", { class: "dia" }, x.fin ? `${fFecha.format(fechaD(x.fecha))} al ${fFecha.format(fin)}` : fFecha.format(fechaD(x.fecha))), el("span", {}, x.titulo, x.detalle ? el("span", { class: "det" }, x.detalle) : null)); }));
}
function antes2023(p) {
  const b = D.base.provincias.find((x) => x.nombre === p.nombre);
  if (!b?.esc_reales_2023) return "";
  const r = b.esc_reales_2023, ks = new Set([...Object.keys(r), ...Object.keys(p.escanos)]);
  const dif = [...ks].map((k) => ({ k, d: (p.escanos[k] || 0) - (r[k] || 0) })).filter((x) => x.d);
  return dif.length ? ` Respecto a 2023, ${lista(dif.map((x) => `${nombre(x.k)} ${x.d > 0 ? "gana" : "pierde"} ${Math.abs(x.d)}`))}.` : " Es el mismo reparto que en 2023.";
}
function fraseProvincia(p, conReparto = true) {
  const o = ordenar(p.escanos);
  const reparto = lista(o.map((k) => `${p.escanos[k]} para ${nombre(k)}`));
  let f = conReparto ? `En ${p.nombre} se reparten ${p.n} asientos, ${reparto}.${antes2023(p)} ` : "";
  if (p.aspirante) { const falta = Math.max(p.aspirante.falta, 0), votos = Math.round(falta / 100 * (p.n / 350) * VOTOS_VALIDOS / 100) * 100;
    const renido = votos < 5000 ? "muy reñido" : votos < 12000 ? "reñido" : null;
    f += renido ? `El último asiento está ${renido}, lo tiene ${nombre(p.ultimo.p)} y ${nombre(p.aspirante.p)} se lo quitaría con unos ${fmt0.format(votos)} votos más.` : `El último asiento lo tiene bastante claro ${nombre(p.ultimo.p)}, ${nombre(p.aspirante.p)} necesitaría unos ${fmt0.format(votos)} votos más para quitárselo.`; }
  return f;
}
function pintarMiProvincia(proy) {
  const sel = $("#mi-provincia");
  if (!sel.options.length) {
    sel.append(el("option", { value: "" }, "Elige una"), ...proy.provincias.map((p) => p.nombre).sort((a, b) => a.localeCompare(b, "es")).map((n) => el("option", { value: n }, n)));
    try { sel.value = localStorage.getItem("mi-provincia") || ""; } catch {}
    sel.addEventListener("change", () => { try { localStorage.setItem("mi-provincia", sel.value); } catch {} mapa.sel = sel.value; pintarMiProvincia(proyActual); if (mapa.proy) pintarMapa(mapa.proy); });
  }
  const p = proy.provincias.find((x) => x.nombre === sel.value);
  $("#r-provincia").textContent = p ? fraseProvincia(p) : "Elige tu provincia y te contamos cómo quedaría.";
  $("#g-provincia").replaceChildren(...(p ? ordenar(p.escanos).map((k) => el("span", { class: "chip", style: { background: color(k) } }, `${nombre(k)} ${p.escanos[k]}`)) : []));
}
function pintarHistorial() {
  const h = D.historial, der = escenario(D.config.principales.derecha), izq = escenario(D.config.principales.izquierda);
  const cont = $("#grafico-historial").parentElement;
  if (!h?.length || h.length < 3 || !der || !izq) { cont.style.display = "none"; return; }
  cont.style.display = "";
  graficoHistorial?.destroy();
  graficoHistorial = new Chart($("#grafico-historial"), { type: "line",
    data: { labels: h.map((x) => fFecha.format(fechaD(x.fecha))), datasets: [
      { label: `${nombreEsc(der)} suman mayoría`, data: h.map((x) => r100(x.escenarios[der.id])), borderColor: color("PP"), backgroundColor: color("PP"), borderWidth: 3, pointRadius: h.length < 20 ? 3 : 0, tension: .3 },
      { label: `${nombreEsc(izq)} suman mayoría`, data: h.map((x) => r100(x.escenarios[izq.id])), borderColor: color("PSOE"), backgroundColor: color("PSOE"), borderWidth: 3, pointRadius: h.length < 20 ? 3 : 0, tension: .3 },
      { label: "Nadie suma", data: h.map((x) => r100(x.bloqueo)), borderColor: "#8A93A3", backgroundColor: "#8A93A3", borderWidth: 2, pointRadius: h.length < 20 ? 3 : 0, tension: .3 }] },
    options: { ...opciones(" de cada 100"), scales: { ...opciones("").scales, y: { ...opciones("").scales.y, min: 0, max: 100 } } } });
}
function opciones(suf) {
  const css = getComputedStyle(document.documentElement), gris = css.getPropertyValue("--gris").trim(), linea = css.getPropertyValue("--linea").trim();
  return { responsive: true, maintainAspectRatio: false, interaction: { mode: "index", intersect: false },
    plugins: { legend: { position: "bottom", labels: { color: gris, boxWidth: 10, boxHeight: 10, usePointStyle: true } }, tooltip: { callbacks: { label: (c) => `${c.dataset.label} ${c.parsed.y == null ? "–" : fmt1.format(c.parsed.y)}${suf}` } } },
    scales: { x: { ticks: { color: gris, maxRotation: 0, autoSkipPadding: 18 }, grid: { display: false } }, y: { beginAtZero: true, ticks: { color: gris }, grid: { color: linea } } } };
}

/* ---------- Encuestas ---------- */
function pintarEncuestas(m, m7, proy) {
  const o = ordenar(m.media).filter((k) => m.media[k] >= 0.5);
  const max = Math.max(...o.map((k) => m.media[k]), 1);
  $("#lista-partidos").replaceChildren(...o.map((k) => { const d = m7.media[k] != null ? m.media[k] - m7.media[k] : 0;
    return el("div", { class: "fila-p" }, el("div", { class: "nom" }, el("i", { class: "punto", style: { background: color(k) } }), nombre(k)),
      el("div", { class: "pct" }, `${fmt1.format(m.media[k])}`, el("small", { class: Math.abs(d) >= 0.1 ? (d > 0 ? "sube" : "baja") : "" }, Math.abs(d) >= 0.1 ? signo(d) : "")),
      el("div", { class: "barra" }, el("i", { style: { width: `${m.media[k] / max * 100}%`, background: color(k) } })),
      el("div", { class: "esc" }, `de cada 100 votos, ${D.prob?.partidos?.[k] ? `entre ${D.prob.partidos[k].p10} y ${D.prob.partidos[k].p90} asientos` : `${proy.total[k] || 0} asientos`}`)); }));
  const usadas = new Set(m.usadas.map((e) => e.id));
  $("#tarjetas-encuestas").replaceChildren(...(D.encuestas?.encuestas || []).slice(0, 12).map((e) => {
    const an = D.analisis?.ultimas?.find((x) => x.id === e.id), nota = D.analisis?.notas?.find((x) => x.clave === e.clave), oe = ordenar(e.pct);
    const dif = e.pct[oe[0]] - e.pct[oe[1]];
    const fiable = nota ? (nota.letra === "A" || nota.letra === "B" ? "Es una empresa que ha acertado bastante en el pasado" : nota.letra === "C" || nota.letra === "D" ? "Es una empresa que ha fallado más de la cuenta en el pasado" : "No sabemos cuánto acierta, no hizo encuestas antes de las últimas elecciones") : "";
    const ver = an ? (an.veredicto === "ruido" ? "y dice más o menos lo mismo que las demás." : an.veredicto === "leve" ? "y se sale un poco de lo habitual en ella." : "y trae un cambio de verdad respecto a lo que suele dar.") : ".";
    return el("div", { class: "tarjeta", id: `enc-${e.id}`, style: usadas.has(e.id) ? null : { opacity: .75 } },
      el("div", { class: "cab" }, el("b", {}, e.empresa_base, e.encargo ? ` para ${e.encargo}` : "", nota && nota.letra !== "–" ? el("span", { class: "nota", title: nota.texto }, nota.letra) : null,
        an ? el("span", { class: `veredicto ${an.veredicto}` }, an.veredicto === "ruido" ? "nada nuevo" : an.veredicto === "leve" ? "algo se mueve" : "novedad") : null),
        el("span", {}, fFecha.format(fechaD(e.fin)))),
      el("p", { class: "ver" }, `Dice que gana ${nombre(oe[0])} por ${fmt1.format(dif)} puntos. ${fiable}${fiable ? " " : ""}${ver}${e.muestra ? ` Preguntó a ${fmt0.format(e.muestra)} personas.` : ""}`),
      el("div", { class: "chips" }, ...oe.slice(0, 6).map((k) => el("span", { class: "chip", style: { background: color(k) } }, `${nombre(k)} ${fmt1.format(e.pct[k])}`))));
  }));
  if (D.encuestas) $("#fuente-encuestas").replaceChildren("Las atenuadas no entran en la media de hoy por ser antiguas o por haber otra más reciente de la misma empresa. Fuente ", el("a", { href: D.encuestas.fuente, target: "_blank", rel: "noopener" }, "Wikipedia"), `, actualizado ${hace(D.encuestas.actualizado)}.`);
  graficoTendencia?.destroy(); graficoTendencia = null;
  if (!$("#encuestas").hidden) pintarTendencia();
}
function pintarTendencia() {
  const m = calcMedia(), o = ordenar(m.media).filter((k) => m.media[k] >= 1.5).slice(0, 7), puntos = [];
  for (let t = fechaD("2023-09-03"); t <= hoy(); t = new Date(+t + 7 * DIA)) puntos.push(t);
  if (puntos[puntos.length - 1] < hoy()) puntos.push(hoy());
  const series = {};
  for (const t of puntos) { const mm = calcMedia(t, 28).media; for (const k of o) (series[k] ||= []).push(mm[k] != null ? +mm[k].toFixed(2) : null); }
  graficoTendencia?.destroy();
  graficoTendencia = new Chart($("#grafico-tendencia"), { type: "line", data: { labels: puntos.map((t) => t.getUTCMonth() === 0 && t.getUTCDate() <= 7 ? String(t.getUTCFullYear()) : fFecha.format(t)),
    datasets: o.map((k) => ({ label: nombre(k), data: series[k], borderColor: color(k), backgroundColor: color(k), borderWidth: 3, pointRadius: 0, tension: .3, spanGaps: true })) }, options: opciones(" de cada 100 votos") });
}

/* ---------- Mapa de teselas ---------- */
const TESELAS = { "A Coruña": [0, 0], "Lugo": [1, 0], "Asturias": [2, 0], "Cantabria": [3, 0], "Bizkaia": [4, 0], "Gipuzkoa": [5, 0],
  "Pontevedra": [0, 1], "Ourense": [1, 1], "León": [2, 1], "Palencia": [3, 1], "Burgos": [4, 1], "Álava": [5, 1], "Navarra": [6, 1], "Huesca": [8, 1], "Lleida": [9, 1], "Girona": [10, 1],
  "Zamora": [2, 2], "Valladolid": [3, 2], "La Rioja": [4, 2], "Soria": [5, 2], "Zaragoza": [7, 2], "Barcelona": [10, 2],
  "Salamanca": [2, 3], "Ávila": [3, 3], "Segovia": [4, 3], "Guadalajara": [5, 3], "Teruel": [7, 3], "Tarragona": [9, 3],
  "Cáceres": [2, 4], "Madrid": [4, 4], "Cuenca": [6, 4], "Castellón": [8, 4],
  "Badajoz": [2, 5], "Toledo": [4, 5], "Ciudad Real": [5, 5], "Albacete": [6, 5], "Valencia": [8, 5], "Baleares": [10, 5],
  "Huelva": [1, 6], "Sevilla": [2, 6], "Córdoba": [3, 6], "Jaén": [4, 6], "Murcia": [6, 6], "Alicante": [8, 6],
  "Cádiz": [2, 7], "Málaga": [3, 7], "Granada": [4, 7], "Almería": [5, 7],
  "Ceuta": [2, 8], "Melilla": [4, 8], "Santa Cruz de Tenerife": [8, 8], "Las Palmas": [9, 8] };
const ABREV = { "A Coruña": "COR", "Lugo": "LUG", "Asturias": "AST", "Cantabria": "CAN", "Bizkaia": "BIZ", "Gipuzkoa": "GIP", "Pontevedra": "PON", "Ourense": "OUR", "León": "LEO", "Palencia": "PAL", "Burgos": "BUR", "Álava": "ALA", "Navarra": "NAV", "Huesca": "HUE", "Lleida": "LLE", "Girona": "GIR", "Zamora": "ZAM", "Valladolid": "VLL", "La Rioja": "RIO", "Soria": "SOR", "Zaragoza": "ZGZ", "Barcelona": "BCN", "Salamanca": "SAL", "Ávila": "AVI", "Segovia": "SEG", "Guadalajara": "GUA", "Teruel": "TER", "Tarragona": "TAR", "Cáceres": "CAC", "Madrid": "MAD", "Cuenca": "CUE", "Castellón": "CAS", "Badajoz": "BAD", "Toledo": "TOL", "Ciudad Real": "CRE", "Albacete": "ALB", "Valencia": "VAL", "Baleares": "BAL", "Huelva": "HUV", "Sevilla": "SEV", "Córdoba": "COR", "Jaén": "JAE", "Murcia": "MUR", "Alicante": "ALI", "Cádiz": "CAD", "Málaga": "MAL", "Granada": "GRA", "Almería": "ALM", "Ceuta": "CEU", "Melilla": "MEL", "Santa Cruz de Tenerife": "TFE", "Las Palmas": "LPA" };
ABREV["Córdoba"] = "CBA";
const mapa = { vista: "ganador", sel: null, proy: null };

function colorProvincia(p) {
  const pp = D.prob?.provincias?.find((x) => x.nombre === p.nombre);
  const gan = ordenar(p.escanos)[0];
  if (mapa.vista === "filo") {
    const a = pp ? pp.en_el_aire : (p.aspirante ? Math.max(0, 1 - p.aspirante.falta / 4) : 0);
    // los dos partidos que se disputan el último asiento, por frecuencia en las simulaciones o por el reparto central
    const dos = pp && pp.disputa ? [pp.disputa.tiene, pp.disputa.quiere] : (p.ultimo && p.aspirante ? [p.ultimo.p, p.aspirante.p] : []);
    const id = "g" + p.nombre.replace(/[^a-z]/gi, "");
    const grad = dos.length === 2 ? `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="50%" stop-color="${color(dos[0])}"/><stop offset="50%" stop-color="${color(dos[1])}"/></linearGradient>` : "";
    return { fill: dos.length === 2 ? `url(#${id})` : "var(--linea)", op: Math.max(.15, Math.min(1, a * 1.4)), txt: "var(--tinta)", etiqueta: dos.length === 2 && p.n >= 4 ? `${nombre(dos[0])}·${nombre(dos[1])}` : "", grad, clase: "etq", tam: 21 };
  }
  const empate = gan && ordenar(p.escanos).length > 1 && p.escanos[gan] === p.escanos[ordenar(p.escanos)[1]];
  return { fill: gan ? color(gan) : "var(--linea)", op: empate ? .6 : 1, txt: "#fff", etiqueta: String(p.n) };
}
function dibujarMapa(proy, opciones = {}) {
  // opciones: {vista, sel, resaltar: Set de provincias con borde, colorear: (p)=>{fill,op,...}}
  const G = D.mapa, vista = opciones.vista || mapa.vista, sel = opciones.sel ?? mapa.sel, resaltar = opciones.resaltar || new Set();
  const guardada = mapa.vista; mapa.vista = vista;
  const cols = proy.provincias.map((p) => [p, colorProvincia(p)]);
  mapa.vista = guardada;
  let svg;
  if (G) {
    svg = `<svg viewBox="${G.viewBox}" role="img" aria-label="Mapa de España por provincias"><defs>${cols.map(([, c]) => c.grad || "").join("")}</defs>`;
    const r = G.recuadro_canarias; svg += `<rect class="recuadro" x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="8"/>`;
    for (const [p, c] of cols) {
      const g = G.provincias[p.nombre]; if (!g) continue;
      svg += `<g class="prov${sel === p.nombre ? " sel" : ""}${resaltar.has(p.nombre) ? " cambia" : ""}" data-p="${p.nombre}">`;
      svg += g.circulo ? `<circle class="prov" cx="${g.cx}" cy="${g.cy}" r="14" fill="${c.fill}" fill-opacity="${c.op}"/>` : `<path d="${g.d}" fill="${c.fill}" fill-opacity="${c.op}"/>`;
      if (!g.circulo && c.etiqueta) svg += `<text class="${c.clase || ""}" x="${g.cx}" y="${g.cy + 6}" text-anchor="middle" font-size="${c.tam || 22}" font-weight="700" fill="${c.txt}">${c.etiqueta}</text>`;
      else if (g.circulo && vista !== "filo") svg += `<text x="${g.cx}" y="${g.cy + 5}" text-anchor="middle" font-size="14" font-weight="700" fill="${c.txt}">${c.etiqueta}</text>`;
      svg += "</g>";
    }
    svg += "</svg>";
  } else {
    const T = 44, Gp = 4;
    svg = `<svg viewBox="0 0 ${11 * (T + Gp)} ${9 * (T + Gp)}" role="img" aria-label="Mapa de provincias">`;
    for (const [p, c] of cols) {
      const [x, y] = TESELAS[p.nombre] || [0, 0];
      svg += `<g class="prov tesela${sel === p.nombre ? " sel" : ""}${resaltar.has(p.nombre) ? " cambia" : ""}" data-p="${p.nombre}"><rect x="${x * (T + Gp)}" y="${y * (T + Gp)}" width="${T}" height="${T}" fill="${c.fill}" fill-opacity="${c.op}"/><text x="${x * (T + Gp) + T / 2}" y="${y * (T + Gp) + 18}" text-anchor="middle" font-size="11" font-weight="700" fill="${c.txt}">${ABREV[p.nombre]}</text><text x="${x * (T + Gp) + T / 2}" y="${y * (T + Gp) + 34}" text-anchor="middle" font-size="12" fill="${c.txt}">${c.etiqueta}</text></g>`;
    }
    svg += "</svg>";
  }
  return svg;
}
function pintarMapa(proy) {
  mapa.proy = proy;
  const svg = dibujarMapa(proy);
  $("#mapa-svg").innerHTML = svg;
  $("#mapa-svg").querySelectorAll("g.prov").forEach((g) => g.addEventListener("click", () => { mapa.sel = g.dataset.p; try { localStorage.setItem("mi-provincia", mapa.sel); } catch {} pintarMapa(mapa.proy); }));
  $("#mapa-pista").textContent = mapa.vista === "ganador" ? "Cada provincia lleva el color del partido que más asientos sacaría en ella, y el número de asientos que reparte. Si está más clara es que hay empate. Toca una para ver el detalle." : "Cada provincia lleva los dos colores de los partidos que más veces se disputan su último asiento, y sus nombres. Cuanto más intensa, más veces se decide ese asiento por menos de un punto. Las casi blancas están decididas.";
  const p = proy.provincias.find((x) => x.nombre === mapa.sel);
  $("#ficha-provincia").replaceChildren(...(p ? [el("div", { class: "ficha" }, el("h3", {}, `${p.nombre}, ${p.n} asientos`),
    el("div", { class: "chips" }, ...ordenar(p.escanos).map((k) => el("span", { class: "chip", style: { background: color(k) } }, `${nombre(k)} ${p.escanos[k]}`))),
    el("p", {}, (p.aspirante ? fraseProvincia(p, false) : "") + antes2023(p)),
    (() => { const pp = D.prob?.provincias?.find((x) => x.nombre === p.nombre); return pp ? el("p", { class: "fuente" }, `En ${r100(pp.en_el_aire)} de cada 100 simulaciones el último asiento se decide por menos de 10.000 votos${pp.disputa ? `, y lo más frecuente es que se lo disputen ${nombre(pp.disputa.tiene)} y ${nombre(pp.disputa.quiere)}` : ""}.`) : null; })(),
    el("details", { class: "como" }, el("summary", {}, "¿Cómo se reparten estos asientos?"),
      el("p", {}, "Con la ley D'Hondt. El voto de cada partido se divide entre 1, 2, 3… y los asientos van a los números más altos. Los marcados en color son los que se llevan asiento. Solo entran los partidos con al menos el 3 % del voto de la provincia."),
      tablaDhondt(p)))] : []));
  const aj = D.prob ? [...D.prob.provincias].sort((a, b) => b.en_el_aire - a.en_el_aire).slice(0, 5).map((pp) => ({ x: proy.provincias.find((q) => q.nombre === pp.nombre), pp }))
    : [...proy.provincias].filter((x) => x.aspirante).sort((a, b) => a.aspirante.falta - b.aspirante.falta).slice(0, 5).map((x) => ({ x }));
  $("#ajustadas").replaceChildren(...aj.map(({ x, pp }) => el("button", { class: "ajustada", type: "button", onclick: () => { mapa.sel = x.nombre; pintarMapa(mapa.proy); $("#ficha-provincia").scrollIntoView({ behavior: "smooth", block: "center" }); } },
    el("b", {}, x.nombre), el("span", { class: "pts" }, pp ? `por menos de 10.000 votos en ${r100(pp.en_el_aire)} de cada 100` : `a ${fmt1.format(Math.max(x.aspirante.falta, 0))} puntos`),
    el("span", { class: "m" }, pp?.disputa ? `Se lo disputan ${nombre(pp.disputa.tiene)} y ${nombre(pp.disputa.quiere)}. ${x.aspirante ? `Hoy lo tiene ${nombre(x.ultimo.p)} por unos ${fmt0.format(Math.round(Math.max(x.aspirante.falta, 0) / 100 * (x.n / 350) * VOTOS_VALIDOS / 100) * 100)} votos.` : ""}` : (x.aspirante ? `El último asiento es de ${nombre(x.ultimo.p)} y se lo disputa ${nombre(x.aspirante.p)}` : "")))));
}
function tablaDhondt(p) {
  const partidos = ordenar(p.cuotas).filter((k) => p.cuotas[k] >= Modelo.UMBRAL);
  const maxDiv = Math.min(p.n, Math.max(1, ...partidos.map((k) => (p.escanos[k] || 0) + 1)));
  const todos = [];
  for (const k of partidos) for (let d = 1; d <= maxDiv; d++) todos.push({ k, d, q: p.cuotas[k] / d });
  todos.sort((a, b) => b.q - a.q);
  const gana = new Set(todos.slice(0, p.n).map((c) => `${c.k}/${c.d}`));
  return el("table", { class: "dhondt" }, el("thead", {}, el("tr", {}, el("th", {}, "Partido"), el("th", {}, "voto"), ...Array.from({ length: maxDiv }, (_, i) => el("th", {}, `÷${i + 1}`)))),
    el("tbody", {}, ...partidos.map((k) => el("tr", {}, el("td", {}, nombre(k)), el("td", {}, fmt1.format(p.cuotas[k])),
      ...Array.from({ length: maxDiv }, (_, i) => { const g = gana.has(`${k}/${i + 1}`); return el("td", { class: g ? "gana" : null, style: g ? { background: color(k) } : null }, fmt1.format(p.cuotas[k] / (i + 1))); })))));
}
document.querySelectorAll(".conmutador button").forEach((b) => b.addEventListener("click", () => {
  mapa.vista = b.dataset.vista;
  document.querySelectorAll(".conmutador button").forEach((x) => x.setAttribute("aria-pressed", x === b ? "true" : "false"));
  pintarMapa(mapa.proy);
}));

/* ---------- ¿Y si…? ---------- */
const sim = { valores: {}, seleccion: new Set(), situacion: "media" };
const DERECHA = ["PP", "Vox", "SALF", "UPN"], IZQUIERDA = ["PSOE", "Sumar", "Podemos", "AA"];
function situaciones(base) {
  const s = [{ id: "media", titulo: "Como van las encuestas", detalle: "la media de hoy", f: (m) => m }];
  const mover = (m, de, a, pts) => { const r = { ...m }; if (r[de] != null && r[a] != null) { const q = Math.min(pts, r[de]); r[de] -= q; r[a] += q; } return r; };
  const trasvase = (m, pts) => { const r = { ...m }, der = DERECHA.filter((k) => r[k] > 0), izq = IZQUIERDA.filter((k) => r[k] > 0), sd = der.reduce((a, k) => a + r[k], 0), si = izq.reduce((a, k) => a + r[k], 0); for (const k of der) r[k] = Math.max(0, r[k] + pts * r[k] / sd); for (const k of izq) r[k] = Math.max(0, r[k] - pts * r[k] / si); return r; };
  if (base.Vox && base.PP) s.push({ id: "vox", titulo: "Vox le quita 3 puntos al PP", detalle: `${puntosTexto(3)}, cambian de partido dentro de la derecha`, f: (m) => mover(m, "PP", "Vox", 3) });
  if (base.Vox && base.PP) s.push({ id: "pp", titulo: "El PP recupera 3 puntos de Vox", detalle: "voto útil hacia el PP, el mismo trasvase al revés", f: (m) => mover(m, "Vox", "PP", 3) });
  s.push({ id: "izq3", titulo: "La izquierda remonta 3 puntos", detalle: `${puntosTexto(3)}, pasan de la derecha a la izquierda, como en 2023`, f: (m) => trasvase(m, -3) });
  s.push({ id: "der3", titulo: "La derecha sube 3 puntos más", detalle: "si las encuestas se quedan cortas con la derecha", f: (m) => trasvase(m, 3) });
  if (base.Sumar != null && base.Podemos != null) s.push({ id: "union", titulo: "Sumar y Podemos van juntos", detalle: "una sola lista a la izquierda", f: (m) => { const r = { ...m }; r.Sumar = (r.Sumar || 0) + (r.Podemos || 0); delete r.Podemos; return r; } });
  if (base.PSOE && base.Sumar) s.push({ id: "psoe", titulo: "El PSOE absorbe 3 puntos de Sumar", detalle: "voto útil a la izquierda", f: (m) => mover(m, "Sumar", "PSOE", 3) });
  return s;
}
function pintarSimulador(m, proyBase) {
  sim.base = { ...m.media }; sim.valores = { ...m.media }; sim.proyBase = proyBase; sim.situacion = "media";
  $("#swing").value = 0; $("#swing-out").textContent = "Como la media de encuestas";
  const sits = situaciones(sim.base);
  $("#situaciones").replaceChildren(...sits.map((x) => el("button", { class: "situacion", type: "button", "aria-pressed": sim.situacion === x.id ? "true" : "false", onclick: () => {
    sim.situacion = x.id; sim.valores = x.f({ ...sim.base }); document.querySelectorAll(".situacion").forEach((b) => b.setAttribute("aria-pressed", b === b ? "false" : "false")); 
    document.querySelectorAll(".situacion").forEach((b, i) => b.setAttribute("aria-pressed", sits[i].id === x.id ? "true" : "false"));
    pintarControles(); recalcularSim(); probabilidadSim(); } }, x.titulo, el("small", {}, x.detalle))));
  pintarControles();
  recalcularSim();
  probabilidadSim();
}
function pintarControles() {
  const o = ordenar(sim.base).filter((k) => sim.base[k] >= 0.3);
  $("#sim-controles").replaceChildren(...o.map((k) => { const out = el("output", {}, fmt1.format(sim.valores[k] || 0));
    return el("label", { class: "deslizador" }, el("span", {}, el("i", { class: "punto", style: { background: color(k) } }), " ", nombre(k)),
      el("input", { type: "range", min: 0, max: 45, step: 0.1, value: (sim.valores[k] || 0).toFixed(1), "aria-label": `Voto de ${nombre(k)}`, style: { accentColor: color(k) },
        oninput: (ev) => { sim.valores[k] = +ev.target.value; out.textContent = fmt1.format(sim.valores[k]); programarSim(); }, onchange: () => probabilidadSim() }), out); }),
    el("button", { class: "boton", type: "button", onclick: () => pintarSimulador({ media: sim.base }, sim.proyBase) }, "Volver a la media de encuestas"));
}
$("#swing").addEventListener("input", (ev) => {
  const s = +ev.target.value, der = DERECHA.filter((k) => sim.base[k] > 0), izq = IZQUIERDA.filter((k) => sim.base[k] > 0);
  const sd = der.reduce((a, k) => a + sim.base[k], 0), si = izq.reduce((a, k) => a + sim.base[k], 0);
  sim.valores = { ...sim.base };
  for (const k of der) sim.valores[k] = Math.max(0, sim.base[k] + s * sim.base[k] / sd);
  for (const k of izq) sim.valores[k] = Math.max(0, sim.base[k] - s * sim.base[k] / si);
  $("#swing-out").textContent = s === 0 ? "Como la media de encuestas" : `${puntosTexto(s)}, pasan ${s > 0 ? "de la izquierda a la derecha" : "de la derecha a la izquierda"}`;
  pintarControles(); programarSim();
});
$("#swing").addEventListener("change", () => probabilidadSim());
let simPendiente = false;
function programarSim() { if (!simPendiente) { simPendiente = true; requestAnimationFrame(() => { simPendiente = false; recalcularSim(); }); } }
function recalcularSim() {
  const proy = Modelo.proyectar(sim.valores, D.base);
  hemiciclo($("#sim-hemiciclo"), proy.total, 10);
  leyenda($("#sim-leyenda"), proy.total, (k) => { const d = proy.total[k] - (sim.proyBase.total[k] || 0); return d ? el("small", { class: d > 0 ? "sube" : "baja" }, ` ${d > 0 ? "+" : "−"}${Math.abs(d)}`) : null; });
  for (const k of [...sim.seleccion]) if (!proy.total[k]) sim.seleccion.delete(k);
  const suma = [...sim.seleccion].reduce((s, k) => s + (proy.total[k] || 0), 0);
  $("#pactos").replaceChildren(el("p", { class: "pie-bloque", style: { width: "100%", margin: "0 0 4px" } }, "Toca partidos para sumar sus asientos y ver si llegan a 176."), ...ordenar(proy.total).filter((k) => proy.total[k] > 0).map((k) => el("button", { class: "pacto", type: "button", "aria-pressed": sim.seleccion.has(k) ? "true" : "false",
    onclick: () => { sim.seleccion.has(k) ? sim.seleccion.delete(k) : sim.seleccion.add(k); recalcularSim(); } }, el("i", { class: "punto", style: { background: color(k) } }), `${nombre(k)} ${proy.total[k]}`)),
    el("div", { class: "suma-pacto" }, sim.seleccion.size ? (suma >= 176 ? `Suman ${suma}. Llegan a la mayoría.` : `Suman ${suma}. Les faltan ${176 - suma}.`) : "",
      el("div", { class: "medidor" }, el("div", { class: "lleno", style: { width: `${suma / 350 * 100}%` } }), el("div", { class: "meta" }))));
  sim.ultimaProy = proy;
  pintarMapaSim();
}
function pintarMapaSim() {
  const proy = sim.ultimaProy, cambian = new Map();
  proy.provincias.forEach((p, i) => { const a = sim.proyBase.provincias[i].escanos, b = p.escanos;
    const dif = [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((k) => (a[k] || 0) !== (b[k] || 0)).map((k) => ({ k, d: (b[k] || 0) - (a[k] || 0) }));
    if (dif.length) cambian.set(p.nombre, dif); });
  $("#sim-mapa").innerHTML = dibujarMapa(proy, { vista: "ganador", sel: sim.sel, resaltar: new Set(cambian.keys()) });
  $("#sim-mapa").querySelectorAll("g.prov").forEach((g) => g.addEventListener("click", () => { sim.sel = g.dataset.p; pintarMapaSim(); }));
  $("#sim-cambios").textContent = cambian.size ? `Cambiarían ${cambian.size} provincias, las que tienen el borde marcado. Toca una para ver su reparto.` : (sim.situacion === "media" ? "Toca una provincia para ver cómo quedaría." : "Con estos datos ninguna provincia cambia de reparto.");
  const p = proy.provincias.find((x) => x.nombre === sim.sel), dif = cambian.get(sim.sel);
  $("#sim-ficha").replaceChildren(...(p ? [el("div", { class: "ficha" }, el("h3", {}, `${p.nombre}, ${p.n} asientos`),
    el("div", { class: "chips" }, ...ordenar(p.escanos).map((k) => el("span", { class: "chip", style: { background: color(k) } }, `${nombre(k)} ${p.escanos[k]}`))),
    el("p", {}, dif ? `Cambia respecto a hoy: ${lista(dif.map((x) => `${nombre(x.k)} ${x.d > 0 ? "gana" : "pierde"} ${Math.abs(x.d)}`))}.` : "Queda igual que con la media de encuestas de hoy."))] : []));
}
function probabilidadSim() {
  const P = D.prob; const der = escenario(D.config.principales.derecha), izq = escenario(D.config.principales.izquierda);
  if (!P?.sigmas || !der || !izq) { $("#r-sim").textContent = sim.ultimaProy ? `${nombre(ordenar(sim.ultimaProy.total)[0])} sacaría ${sim.ultimaProy.total[ordenar(sim.ultimaProy.total)[0]]} asientos.` : ""; return; }
  const N = 600, BL = { d: ["PP", "Vox", "SALF", "UPN"], i: ["PSOE", "Sumar", "Podemos", "AA"] };
  const bloque = (k) => BL.d.includes(k) ? "d" : BL.i.includes(k) ? "i" : "t";
  const rn = () => { let u = 0, v = 0; while (u === 0) u = Math.random(); v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  let cd = 0, ci = 0;
  const claves = Object.keys(sim.valores).filter((k) => sim.valores[k] > 0);
  for (let i = 0; i < N; i++) {
    const z = { d: rn(), i: rn(), t: rn() }, zt = rn(), m = {};
    for (const k of claves) { const b = bloque(k); m[k] = Math.max(0, sim.valores[k] + (P.sigmas[k] || 0.06 * sim.valores[k]) * (0.55 * z[b] + 0.835 * rn() + 0.35 * (b === "d" ? 1 : b === "i" ? -1 : 0) * zt)); }
    const t = Modelo.proyectar(m, D.base).total;
    if (der.partidos.reduce((a, k) => a + (t[k] || 0), 0) >= 176) cd++;
    if (izq.partidos.reduce((a, k) => a + (t[k] || 0), 0) >= 176) ci++;
  }
  const pd = cd / N, pi = ci / N, pb = Math.max(0, 1 - pd - pi);
  const nd = nombreEsc(der), ni = nombreEsc(izq);
  $("#r-sim").replaceChildren(el("b", {}, pd >= 0.5 ? `${cap(nd)} suman mayoría en ${deCada100(pd)}.` : pi >= 0.5 ? `${cap(ni)} suman mayoría en ${deCada100(pi)}.` : `Nadie tiene la mayoría clara.`), ` ${pd < 0.5 ? `${cap(nd)} llegan en ${deCada100(pd)}.` : ""} ${pi < 0.5 ? `${cap(ni)} llegan en ${deCada100(pi)}.` : ""} Nadie suma en ${deCada100(pb)}.`);
  waffle($("#sim-waffle"), $("#sim-waffle-ley"), [{ p: pd, colores: coloresCoalicion(der, sim.ultimaProy.total), nombre: nd }, { p: pb, color: "#8A93A3", nombre: "Nadie suma" }, { p: pi, colores: coloresCoalicion(izq, sim.ultimaProy.total), nombre: ni }]);
}

/* ---------- Más ---------- */
function pintarFiabilidad() {
  const an = D.analisis;
  if (!an?.notas?.length) { $("#fiabilidad").replaceChildren(el("p", { class: "vacio" }, "Se calcula en la primera actualización.")); return; }
  $("#fiabilidad").replaceChildren(...an.notas.map((r) => el("div", { class: "fila-f" }, el("span", { class: "nota" }, r.letra),
    el("span", {}, `${r.empresa}, ${r.encuestas} encuestas`, el("span", { class: "m" }, r.texto),
      r.sesgo ? el("div", { class: "sesgos" }, ...Object.entries(r.sesgo).filter(([, v]) => Math.abs(v) >= 0.3).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 4).map(([k, v]) => el("span", {}, `suele dar a ${nombre(k)} ${signo(v)}`))) : null))));
}
function pintarPorra(proy) {
  const bot = D.config.telegram_bot;
  $("#porra-instrucciones").replaceChildren(bot ? el("p", {}, "Manda tu pronóstico al bot ", el("a", { href: `https://t.me/${bot}`, target: "_blank", rel: "noopener" }, `@${bot}`), ", por ejemplo /porra PP 140 PSOE 110 Vox 50 Sumar 20. Gana quien menos se desvíe en total.") : el("p", {}, "La porra se activa al configurar el bot de Telegram."));
  const ref = D.resultados?.escanos || proy.total;
  const parts = Object.values(D.porra?.participantes || {}).map((p) => ({ ...p, distancia: [...new Set([...Object.keys(p.escanos), ...Object.keys(ref)])].reduce((s, k) => s + Math.abs((p.escanos[k] || 0) - (ref[k] || 0)), 0) })).sort((a, b) => a.distancia - b.distancia);
  $("#porra").replaceChildren(...(parts.length ? parts.map((p, i) => el("div", { class: "fila-f" }, el("span", { class: "pos" }, i + 1), el("span", {}, p.nombre, el("span", { class: "m" }, ordenar(p.escanos).map((k) => `${nombre(k)} ${p.escanos[k]}`).join(", "))), el("span", { class: "v" }, `${p.distancia} asientos de desvío`))) : [el("p", { class: "vacio" }, "Todavía no ha jugado nadie.")]));
}
function pintarPartidos(m, proy) {
  const o = ordenar(m.media).filter((k) => m.media[k] >= 0.5);
  const li = (arr) => arr?.length ? el("ul", {}, ...arr.map((n) => el("li", {}, el("a", { href: n.enlace, target: "_blank", rel: "noopener" }, n.titulo), el("span", { class: "m" }, `${n.fuente} ${hace(n.fecha)}`)))) : el("p", { class: "vacio" }, "Sin titulares recientes.");
  $("#fichas-partidos").replaceChildren(...o.map((k) => el("article", { class: "ficha-p", style: { "--c": color(k) } }, el("h3", {}, `${nombre(k)}, ${Math.round(m.media[k])} de cada 100 votos`),
    li(D.noticias?.partidos?.[k]?.slice(0, 3)), D.noticias?.verificaciones?.[k]?.length ? [el("h4", {}, "Verificado por Newtral y Maldita"), li(D.noticias.verificaciones[k].slice(0, 2))] : null)));
}
function pintarAtencion() {
  const a = D.atencion?.lideres;
  if (!a || !Object.keys(a).length) return;
  const ks = Object.keys(a), dias = a[ks[0]].serie.map((x) => x.dia);
  graficoAtencion?.destroy();
  graficoAtencion = new Chart($("#grafico-atencion"), { type: "line", data: { labels: dias.map((d) => fFecha.format(fechaD(d))), datasets: ks.map((k) => ({ label: a[k].articulo, data: a[k].serie.map((x) => x.visitas), borderColor: color(k), backgroundColor: color(k), borderWidth: 2, pointRadius: 0, tension: .25 })) }, options: opciones(" visitas en Wikipedia") });
}

/* ---------- Arranque ---------- */
let proyActual;
function pintarTodo() {
  const m = calcMedia(), m7 = calcMedia(new Date(+hoy() - 7 * DIA));
  const sinDatos = !Object.keys(m.media).length;
  if (sinDatos) m.media = Modelo.mediaDesdeBase(D.base);
  const proy = Modelo.proyectar(m.media, D.base);
  proyActual = proy;
  pintarHoy(m, m7, proy);
  pintarEncuestas(m, m7, proy);
  pintarMapa(proy);
  pintarSimulador(m, proy);
  pintarFiabilidad();
  pintarPorra(proy);
  pintarPartidos(m, proy);
}
(async function iniciar() {
  const nombres = ["config", "base2023", "encuestas", "fiabilidad", "noticias", "atencion", "porra", "agenda", "resultados", "probabilidades", "analisis", "probabilidades_historial", "mapa"];
  const datos = await Promise.all(nombres.map(cargar));
  nombres.forEach((n, i) => { D[n === "base2023" ? "base" : n === "probabilidades" ? "prob" : n === "probabilidades_historial" ? "historial" : n] = datos[i]; });
  if (!D.config || !D.base) { $("#r-ganando").textContent = "No se han podido cargar los datos base."; return; }
  try { mapa.sel = localStorage.getItem("mi-provincia") || null; } catch {}
  $("#incluir-cis").addEventListener("change", pintarTodo);
  $("#compartir").addEventListener("click", compartir);
  $("#ver-metodo").addEventListener("click", (ev) => { ev.preventDefault(); $("#metodo").hidden = false; $("#metodo").open = true; $("#metodo").scrollIntoView({ behavior: "smooth" }); if (!graficoAtencion) pintarAtencion(); });
  pintarTodo();
  D.listo = true;
  const act = [D.encuestas?.actualizado, D.noticias?.actualizado].filter(Boolean).sort().pop();
  if (act) $("#actualizado").textContent = `Datos actualizados ${hace(act)}.`;
  activarPestana(location.hash.slice(1));
})();

/* ---------- Tarjeta para compartir ---------- */
async function compartir() {
  const P = D.prob, der = escenario(D.config.principales.derecha), izq = escenario(D.config.principales.izquierda);
  if (!P || !der || !izq) return;
  const c = document.createElement("canvas"); c.width = 1080; c.height = 1350;
  const g = c.getContext("2d");
  g.fillStyle = "#17202E"; g.fillRect(0, 0, 1080, 1350);
  g.fillStyle = "#fff"; g.font = "800 120px Archivo, Arial, sans-serif"; g.fillText("29N", 70, 170);
  g.font = "500 40px Archivo, Arial, sans-serif"; g.fillStyle = "#B8C0CC"; g.fillText(`Probabilidades a ${new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "long" }).format(new Date())}`, 70, 240);
  g.fillStyle = "#fff"; g.font = "650 46px Archivo, Arial, sans-serif";
  const lineas = (t, x, y, w) => { const ws = t.split(" "); let l = "", yy = y; for (const w0 of ws) { const p = l ? l + " " + w0 : w0; if (g.measureText(p).width > w) { g.fillText(l, x, yy); l = w0; yy += 56; } else l = p; } g.fillText(l, x, yy); return yy; };
  let y = lineas($("#r-gobernar").textContent, 70, 330, 940) + 70;
  const segs = [[der.p, color("PP"), der.nombre], [P.bloqueo, "#8A93A3", "Bloqueo"], [izq.p, color("PSOE"), izq.nombre]];
  let x = 70; for (const [p, col] of segs) { const w = Math.max(p, .02) * 940; g.fillStyle = col; g.fillRect(x, y, w, 90); if (p >= .12) { g.fillStyle = "#fff"; g.font = "800 44px Archivo, Arial, sans-serif"; g.fillText(pct(p), x + 24, y + 60); } x += w; }
  y += 130; g.font = "500 34px Archivo, Arial, sans-serif";
  for (const [p, col, n] of segs) { g.fillStyle = col; g.fillRect(70, y - 26, 28, 28); g.fillStyle = "#fff"; g.fillText(`${n}, ${pct(p)}`, 120, y); y += 50; }
  y += 40; g.fillStyle = "#B8C0CC"; g.font = "600 32px Archivo, Arial, sans-serif"; g.fillText("Asientos que sacaría cada partido, 8 de cada 10 veces", 70, y); y += 30;
  const o = Object.keys(P.partidos).sort((a, b) => P.partidos[b].p50 - P.partidos[a].p50).slice(0, 6);
  for (const k of o) { const v = P.partidos[k]; y += 62; g.fillStyle = "#fff"; g.font = "650 32px Archivo, Arial, sans-serif"; g.fillText(nombre(k), 70, y);
    const x0 = 300, esc = 700 / 240; g.fillStyle = "#2B3543"; g.fillRect(x0, y - 24, 700, 22); g.fillStyle = color(k); g.globalAlpha = .55; g.fillRect(x0 + v.p10 * esc, y - 24, (v.p90 - v.p10) * esc, 22); g.globalAlpha = 1; g.fillRect(x0 + v.p50 * esc - 3, y - 28, 6, 30);
    g.fillStyle = "#D3A54E"; g.fillRect(x0 + 176 * esc - 1, y - 30, 2, 34); g.fillStyle = "#B8C0CC"; g.font = "500 26px Archivo, Arial, sans-serif"; g.fillText(`${v.p10}-${v.p90}`, x0 + 715, y); }
  g.fillStyle = "#D3A54E"; g.font = "600 28px Archivo, Arial, sans-serif"; g.fillText("176, la mayoría", 300 + 176 * 700 / 240 - 120, y + 50);
  g.fillStyle = "#B8C0CC"; g.font = "500 28px Archivo, Arial, sans-serif"; g.fillText(location.href.replace(/[#?].*$/, ""), 70, 1290);
  const blob = await new Promise((r) => c.toBlob(r, "image/png"));
  const file = new File([blob], "29n.png", { type: "image/png" });
  if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], title: "29N" }); return; } catch {} }
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "29n.png"; a.click();
}
