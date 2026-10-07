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
/* "Hoy" es el día del calendario de España, no el del reloj UTC. Si no, de 12 de la noche a 2 de la madrugada
   la app seguiría en el día anterior y la cuenta atrás iría un día por detrás. */
const fDiaMadrid = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit" });
const fHoraMadrid = new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", hour: "2-digit", minute: "2-digit" });
const diaMadrid = (d = new Date()) => fDiaMadrid.format(d);
const hoy = () => new Date(diaMadrid() + "T12:00:00Z");
const fechaD = (s) => new Date(s + "T12:00:00Z");
const r100 = (p) => Math.round(p * 100);
/* La probabilidad se dice con palabras, cinco tramos iguales, los mismos en toda la app. */
const TRAMOS = ["muy difícil", "difícil", "en el aire", "probable", "muy probable"];
const tramo = (p) => Math.min(4, Math.max(0, Math.floor((p || 0) * 5 + 1e-9)));
const palabra = (p) => TRAMOS[tramo(p)];
const CON_ARTICULO = new Set(["PP", "PSOE", "PNV", "BNG"]);
const aP = (k) => CON_ARTICULO.has(k) ? `al ${nombre(k)}` : `a ${nombre(k)}`;
const elP = (k) => CON_ARTICULO.has(k) ? `el ${nombre(k)}` : nombre(k), deP = (k) => CON_ARTICULO.has(k) ? `del ${nombre(k)}` : `de ${nombre(k)}`;
/* Frase que acompaña al arco del hemiciclo */
function fraseArco(cont, o) {
  cont.replaceChildren(...(o ? [el("i", { style: { background: o.color } }), `${o.arco || o.titulo}, ${o.central} ${o.unidad || "asientos"}. ${o.central >= (o.mayoria || 176) ? (o.plural ? "Pasan la raya." : "Pasa la raya.") : (o.plural ? `Se quedan a ${(o.mayoria || 176) - o.central} de la raya.` : `Se queda a ${(o.mayoria || 176) - o.central} de la raya.`)}`] : []));
}
const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
const VOTOS_VALIDOS = 24688087; // votos válidos del 23J
// Votos aproximados de una provincia. Los asientos menos los 2 fijos por provincia van en proporción a la población.
const votosProvincia = (n) => Math.max(n - 2, 0.3) / 246.6 * VOTOS_VALIDOS;
const votosDe = (pts, n) => Math.round(pts / 100 * votosProvincia(n) / 100) * 100;
const porVotos = (pts, n) => { const v = votosDe(pts, n); return v < 100 ? "por menos de 100 votos, un empate técnico" : `por unos ${fmt0.format(v)} votos`; };
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
  const ids = ["hoy", "mapa", "encuestas", "senado", "simulador", "noticias", "el29n", "metodologia"];
  if (!ids.includes(id)) id = "hoy";
  for (const i of ids) document.getElementById(i).hidden = i !== id;
  document.querySelectorAll(".pestanas a").forEach((a) => a.classList.toggle("activa", a.dataset.tab === id));
  $("#foco-tira").hidden = id === "el29n" || id === "metodologia"; // ahí no hay nada propio de un partido
  window.scrollTo({ top: 0 });
  if (id === "encuestas" && !graficoTendencia && D.listo) pintarTendencia();
  if (id === "encuestas" && D.listo) pintarGraficoFoco();
}
window.addEventListener("hashchange", () => activarPestana(location.hash.slice(1)));

/* ---------- Media ---------- */
/* La media de un día, con la regla que tocaba ese día según lo que faltara para votar. La gráfica usa la misma. */
function calcMedia(fecha = hoy()) {
  const va = Media.ventanaAdaptativa(fecha, fechaD(D.config.eleccion.fecha));
  return { ...Media.calcMedia(D.encuestas?.encuestas || [], fecha, { ...va, incluirCIS: $("#incluir-cis")?.checked, ranking: D.fiabilidad?.ranking, sesgos: D.analisis?.sesgos }), fase: va.fase, mitad: va.mitad };
}

/* Patrón de colores de una coalición según el peso de cada partido en escaños (p. ej. 2 PP por cada Vox) */
/* ---------- Un titular: foto si la trae y, si no, un sello con las iniciales del medio ---------- */
function sello(fuente) {
  const pal = String(fuente || "?").replace(/\.(es|com|cat|eus|net|org)$/i, "").split(/[\s.\-]+/).filter(Boolean);
  const ini = (pal.length > 1 ? pal[0][0] + pal[1][0] : (pal[0] || "?").slice(0, 2)).toUpperCase();
  let h = 0; for (const c of String(fuente || "")) h = (h * 31 + c.charCodeAt(0)) % 360;
  return el("span", { class: "sello", style: { background: `hsl(${h} 40% 90%)`, color: `hsl(${h} 45% 30%)` }, "aria-hidden": "true" }, ini);
}
function noticia(n, opciones = {}) {
  const foto = n.imagen ? el("img", { class: "foto", src: n.imagen, alt: "", loading: "lazy", referrerpolicy: "no-referrer", onerror: (ev) => { ev.target.closest("a")?.classList.remove("grande"); ev.target.replaceWith(sello(n.fuente)); } }) : sello(n.fuente);
  return el("a", { class: `titular-n${opciones.grande && n.imagen ? " grande" : ""}`, href: n.enlace, target: "_blank", rel: "noopener" }, foto,
    el("span", { class: "txt" }, n.partido && !opciones.sinPartido ? el("span", { class: "tag", style: { background: color(n.partido) } }, nombre(n.partido)) : null, n.titulo, el("span", { class: "m" }, `${n.fuente} · ${hace(n.fecha)}`)));
}

/* ---------- Medidor de aguja ---------- */
function aguja(p, col) {
  const cx = 60, cy = 58, R = 44, pt = (f, r) => { const a = Math.PI * (1 - f); return [(cx + r * Math.cos(a)).toFixed(1), (cy - r * Math.sin(a)).toFixed(1)]; };
  const t = tramo(p);
  let svg = `<svg viewBox="0 0 120 66" role="img" aria-label="${cap(TRAMOS[t])}">`;
  for (let i = 0; i < 5; i++) { const a = pt(i / 5 + 0.012, R), b = pt((i + 1) / 5 - 0.012, R);
    svg += `<path d="M${a[0]} ${a[1]} A${R} ${R} 0 0 1 ${b[0]} ${b[1]}" fill="none" stroke="${i === t ? col : "var(--linea)"}" stroke-width="${i === t ? 12 : 9}"/>`; }
  const f = pt(Math.min(0.98, Math.max(0.02, p || 0)), R - 12);
  return svg + `<line x1="${cx}" y1="${cy}" x2="${f[0]}" y2="${f[1]}" stroke="var(--tinta)" stroke-width="3.5" stroke-linecap="round"/><circle cx="${cx}" cy="${cy}" r="5" fill="var(--tinta)"/></svg>`;
}
/* Barra con los asientos de hoy (punto), dónde acaban 8 de cada 10 veces (franja) y la raya de la mayoría */
function barraAsientos(o) {
  const M = o.mayoria || 176, hol = M > 150 ? 25 : 15, min = Math.max(0, Math.min(o.p10, o.central, M) - hol), max = Math.max(o.p90, o.central, M) + hol, pos = (v) => `${(v - min) / (max - min) * 100}%`, cerca = (a, b) => Math.abs(a - b) / (max - min) < 0.1;
  return el("div", { class: "barra-asientos" }, el("div", { class: "pista" }),
    el("div", { class: "franja", style: { left: pos(o.p10), width: `${(o.p90 - o.p10) / (max - min) * 100}%`, background: o.color } }),
    el("div", { class: "raya", style: { left: pos(M) } }), el("span", { class: "eti-raya", style: { left: pos(M) } }, `${M}, mayoría`),
    el("div", { class: "hoy", style: { left: pos(o.central), background: o.color } }),
    cerca(o.p10, o.central) ? null : el("span", { class: "n izq", style: { left: pos(o.p10) } }, o.p10),
    el("span", { class: "n c", style: { left: pos(o.central) } }, o.central),
    cerca(o.p90, o.central) ? null : el("span", { class: "n der", style: { left: pos(o.p90) } }, o.p90));
}
/* Tres medidores (los dos gobiernos posibles y que nadie sume). Al tocar uno se abre su detalle.
   ops: [{id, titulo, p, color, partidos, central, p10, p90, verbo}] */
function medidores(cont, det, ops, sel, alElegir) {
  cont.replaceChildren(...ops.map((o) => el("button", { type: "button", class: "medidor-a", "data-id": o.id, "aria-pressed": sel === o.id ? "true" : "false", onclick: () => alElegir(sel === o.id ? null : o.id) },
    el("span", { class: "tit" }, o.titulo), el("span", { class: "svg", html: aguja(o.p, o.color) }), el("b", {}, cap(palabra(o.p))))));
  const o = ops.find((x) => x.id === sel);
  if (!o) { det.replaceChildren(el("p", { class: "pie-bloque" }, "Toca un medidor para ver el detalle.")); return; }
  const M = o.mayoria || 176;
  det.replaceChildren(el("div", { class: "caja" }, ...(o.central != null ? [barraAsientos(o),
    el("p", {}, `${o.con || "Con las encuestas de hoy"} ${o.verbo} ${o.central} ${o.unidad || "asientos"}, ${o.central > M ? `${o.central - M} más de los que hacen falta` : o.central === M ? "justo los que hacen falta" : `${M - o.central} menos de los que hacen falta`}. Como las encuestas fallan, lo normal es que ${o.plural ? "acaben" : "acabe"} entre ${o.p10} y ${o.p90}. Probabilidad de llegar a la mayoría, ${r100(o.p)} %.`)]
    : [el("p", {}, `${o.texto || "Pasa cuando ninguno de los dos bloques llega a 176 asientos. Habría que negociar con otros partidos o repetir las elecciones."} Probabilidad, ${r100(o.p)} %.`)])));
}

/* ---------- Hemiciclo ---------- */
/* resaltar: {partidos, color} dibuja un arco por fuera sobre los asientos de ese bloque. Si el arco pasa la raya, hay mayoría. */
/* extra: {marcado, alTocar, orden, apagado}. orden coloca los partidos de izquierda a derecha en el orden que se le dé
   y apagado(k) deja a media luz los que diga. Con alTocar el hemiciclo se puede tocar: avisa del partido del asiento más cercano al toque
   (o de null si se toca fuera). El partido marcado se queda a todo color y el resto se apaga. */
function hemiciclo(cont, escanos, filas = 12, resaltar = null, etiqueta = "176", solo = null, extra = {}) {
  const orden = D.config.orden_hemiciclo;
  const sitio = (k) => extra.orden ? (extra.orden.indexOf(k) + 1 || 999) : (orden.indexOf(k) + 1 || 99);
  const claves = Object.keys(escanos).filter((k) => escanos[k] > 0).sort((a, b) => sitio(a) - sitio(b));
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
  const partidoDe = [];
  for (const k of claves) for (let i = 0; i < escanos[k]; i++) { colores.push(solo && k !== solo ? "var(--linea)" : color(k)); partidoDe.push(k); }
  const rp = (1 - r0) / (filas - 1) * 0.42, E = 100;
  let svg = `<svg viewBox="-114 -116 228 136" role="img" aria-label="Hemiciclo de ${total} asientos">`;
  if (resaltar?.partidos?.length) {
    let i0 = -1, i1 = -1, acc = 0;
    for (const k of claves) { if (resaltar.partidos.includes(k)) { if (i0 < 0) i0 = acc; i1 = acc + escanos[k]; } acc += escanos[k]; }
    if (i0 >= 0) { const RA = (1 + rp + 0.04) * E, pt = (f) => { const a = Math.PI * (1 - f); return `${(RA * Math.cos(a)).toFixed(1)} ${(-RA * Math.sin(a)).toFixed(1)}`; };
      svg += `<path class="arco" d="M${pt(i0 / total)} A${RA.toFixed(1)} ${RA.toFixed(1)} 0 0 1 ${pt(i1 / total)}" fill="none" stroke="${resaltar.color}" stroke-width="4" stroke-linecap="round"/>`; }
  }
  asientos.forEach((s, i) => { svg += `<circle cx="${(s.x * E).toFixed(1)}" cy="${(-s.y * E).toFixed(1)}" r="${(rp * E).toFixed(1)}" fill="${colores[i] || "var(--linea)"}"${(extra.marcado && partidoDe[i] !== extra.marcado) || (extra.apagado && extra.apagado(partidoDe[i])) ? ' fill-opacity=".2"' : ""}/>`; });
  svg += `<line x1="0" y1="-114" x2="0" y2="${-r0 * E + 8}" stroke="var(--tinta)" stroke-width="1.6" stroke-dasharray="3 3"/>`;
  svg += `<text x="0" y="${-r0 * E + 24}" text-anchor="middle" font-size="15" font-weight="800" fill="var(--tinta)">${etiqueta}</text><text x="0" y="${-r0 * E + 37}" text-anchor="middle" font-size="9.5" font-weight="600" fill="var(--gris)">mayoría</text></svg>`;
  cont.innerHTML = svg;
  cont.classList.toggle("tocable", !!extra.alTocar);
  cont.onclick = extra.alTocar ? (ev) => {
    const lienzo = cont.querySelector("svg"), m = lienzo.getScreenCTM();
    if (!m) return;
    const pt = new DOMPoint(ev.clientX, ev.clientY).matrixTransform(m.inverse());
    let mejor = null, d2 = 100; // hasta 10 unidades del dibujo, unos 14 píxeles en un móvil
    asientos.forEach((a, i) => { const d = (a.x * E - pt.x) ** 2 + (-a.y * E - pt.y) ** 2; if (d < d2) { d2 = d; mejor = partidoDe[i]; } });
    extra.alTocar(mejor);
  } : null;
}
/* Ficha pequeña del partido tocado en un hemiciclo, con el botón que centra toda la app en él */
function fichaHemi(cont, k, texto, alCerrar) {
  cont.replaceChildren(...(k ? [el("div", { class: "hemi-ficha", style: { "--c": color(k) } },
    el("button", { type: "button", class: "cerrar", "aria-label": "Cerrar", onclick: alCerrar }, "×"),
    el("b", {}, el("i", { class: "punto", style: { background: color(k) } }), nombre(k)), el("span", {}, texto),
    foco.k === k ? null : el("button", { type: "button", class: "boton", onclick: () => { alCerrar(); elegirFoco(k); window.scrollTo({ top: 0, behavior: "smooth" }); } }, `Centrar toda la app en ${nombre(k)}`))] : []));
}
const leyenda = (cont, escanos, extra, alTocar, marcado) => cont.replaceChildren(...ordenar(escanos).filter((k) => escanos[k] > 0).map((k) => el(alTocar ? "button" : "span", alTocar ? { type: "button", "aria-pressed": marcado === k ? "true" : "false", onclick: () => alTocar(k) } : {}, el("i", { class: "punto", style: { background: color(k) } }), `${nombre(k)} ${escanos[k]}`, extra ? extra(k) : null)));

/* ---------- Hoy, las preguntas ---------- */
let graficoHistorial, graficoTendencia;
const gob = { sel: null, hemi: null };
function pintarHoy(m, m7, proy) {
  const dias = Math.round((fechaD(D.config.eleccion.fecha) - hoy()) / DIA);
  const P = D.prob, der = escenario(D.config.principales.derecha), izq = escenario(D.config.principales.izquierda);
  const o = ordenar(m.media);

  // 0. El resumen de hoy, cada línea lleva a lo que anuncia
  $("#resumen-titulo").replaceChildren("El resumen de hoy ", el("span", { class: "fecha" }, new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", weekday: "long", day: "numeric", month: "long" }).format(new Date())));
  const ICO = { urna: "M4 10h16v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1zM7 4h10l2 4H5zM9 13v2h6v-2z", congreso: "M12 3 2 10h3v9h14v-9h3zm-3 8h2v6H9zm4 0h2v6h-2z", encuesta: "M4 20V9h3v11zm6.5 0V4h3v16zM17 20v-6h3v6z", noticia: "M4 4h13a2 2 0 0 1 2 2v13H5a1 1 0 0 1-1-1zm2 3v2h9V7zm0 4v2h9v-2zm0 4v2h6v-2z", mapa: "M9 3 3 5.5v15L9 18l6 2.5 6-2.5v-15L15 6zM9 5.2v10.6l6 2.4V7.6z" };
  const fila = (ico, texto, sub, accion) => el("li", {}, el(typeof accion === "string" ? "a" : "button", typeof accion === "string" ? { class: "enlace-resumen", href: accion, target: "_blank", rel: "noopener" } : { class: "enlace-resumen", type: "button", onclick: accion },
    el("svg", { viewBox: "0 0 24 24", html: `<path d="${ICO[ico]}"/>` }), el("span", {}, texto, sub ? el("small", {}, sub) : null), el("svg", { class: "flecha", viewBox: "0 0 24 24", html: '<path d="M9 5l7 7-7 7-1.4-1.4L13.2 12 7.6 6.4z"/>' })));
  const ir = (sel) => () => { const t = $(sel); t.scrollIntoView({ behavior: "smooth", block: "center" }); t.classList.add("destacada"); setTimeout(() => t.classList.remove("destacada"), 2500); };
  const resumen = [];
  if (o.length) resumen.push(fila("urna", `${nombre(o[0])} va primero con el ${fmt1.format(m.media[o[0]])} % de los votos, ${fmt1.format(m.media[o[0]] - m.media[o[1]])} puntos más que ${nombre(o[1])}.`, "Ver la media de encuestas", ir("#g-ganando")));
  if (P && der && izq) { const fav = der.p >= izq.p ? der : izq; resumen.push(fila("congreso", `Gobierno de ${nombreEsc(fav)}, ${palabra(fav.p)}. Que nadie sume, ${palabra(P.bloqueo)}.`, "Ver quién gobernaría", ir("#g-medidores"))); }
  const uu = D.analisis?.ultimas?.[0];
  if (uu) resumen.push(fila("encuesta", `Última encuesta, ${uu.empresa}${uu.encargo ? ` para ${uu.encargo}` : ""}, del ${fFecha.format(fechaD(uu.fin))}, ${uu.veredicto === "ruido" ? "sin novedades" : uu.veredicto === "leve" ? "con algún movimiento" : "con una novedad de verdad"}.`, uu.texto, () => { location.hash = "#encuestas"; setTimeout(ir(`#enc-${CSS.escape(uu.id)}`), 150); }));
  const pol0 = D.noticias?.polemicas?.[0];
  if (pol0) resumen.push(fila("noticia", pol0.titulo, `Polémica del día, ${nombre(pol0.partido)}, ${pol0.fuente}`, pol0.enlace));
  const aire0 = [...proy.provincias].filter((x) => x.aspirante).sort((a, b) => Math.max(a.aspirante.falta, 0) / (10 / (a.n + 1)) - Math.max(b.aspirante.falta, 0) / (10 / (b.n + 1)))[0];
  if (aire0) resumen.push(fila("mapa", `La provincia más reñida es ${aire0.nombre}. ${nombre(aire0.ultimo.p)} y ${nombre(aire0.aspirante.p)} se disputan el último asiento ${porVotos(Math.max(aire0.aspirante.falta, 0), aire0.n)}.`, "Ver el mapa", () => { mapa.sel = aire0.nombre; mapa.vista = "filo"; document.querySelectorAll("#mapa .conmutador button").forEach((x) => x.setAttribute("aria-pressed", x.dataset.vista === "filo" ? "true" : "false")); pintarMapa(mapa.proy); location.hash = "#mapa"; }));
  $("#resumen").replaceChildren(...resumen);

  // 1. ¿Quién va ganando?
  if (o.length) {
    $("#r-ganando").replaceChildren(el("b", {}, `${nombre(o[0])}.`), ` Tiene el ${fmt1.format(m.media[o[0]])} % de los votos en la media de encuestas. Le siguen ${nombre(o[1])} con el ${fmt1.format(m.media[o[1]])} % y ${nombre(o[2])} con el ${fmt1.format(m.media[o[2]])} %.`);
    const max = m.media[o[0]];
    $("#g-ganando").replaceChildren(...o.slice(0, 3).map((k) => { const d = m7.media[k] != null ? m.media[k] - m7.media[k] : 0;
      return el("div", { class: "bg" }, el("div", { class: "nom" }, el("i", { class: "punto", style: { background: color(k) } }), nombre(k)),
        el("div", { class: "num" }, `${fmt1.format(m.media[k])} %`, el("small", { class: Math.abs(d) >= 0.2 ? (d > 0 ? "sube" : "baja") : null }, Math.abs(d) >= 0.2 ? `${d > 0 ? "▲" : "▼"} ${fmt1.format(Math.abs(d))} esta semana` : "igual que la semana pasada")),
        el("div", { class: "pista" }, el("i", { style: { width: `${m.media[k] / max * 100}%`, background: color(k) } }))); }));
    $("#g-resto").replaceChildren(...o.slice(3).filter((k) => m.media[k] >= 0.5).map((k) => el("span", {}, el("i", { class: "punto", style: { background: color(k) } }), `${nombre(k)} ${fmt1.format(m.media[k])} %`)));
    // Transparencia: qué encuestas forman la media de hoy y cuánto pesa cada una
    const faseTxt = m.fase === "precampaña" ? "Cuanto más antigua es una encuesta, menos pesa. Una de hace 10 días pesa la mitad que una de hoy y una de hace un mes, ocho veces menos. Desde que empiece la campaña, el 13 de noviembre, las antiguas perderán peso el doble de rápido, para que los cambios se noten antes."
      : m.fase === "campaña" ? "En campaña las encuestas antiguas pierden peso rápido, una de hace 5 días pesa la mitad que una de hoy, para que los cambios se noten antes." : "En la última semana una encuesta de hace 3 o 4 días ya pesa la mitad que una de hoy. Desde el 24 de noviembre la ley prohíbe publicar encuestas nuevas en España.";
    $("#media-hoy").replaceChildren(el("p", { class: "pie-bloque" }, `La media de hoy sale de ${m.usadas.length} encuestas, la última de cada empresa en los últimos ${m.ventana} días. La fecha es la del día en que terminaron de preguntar, que suele ser unos días antes de publicarse. ${faseTxt}`),
      ...m.usadas.map((e) => el("div", { class: "peso" }, el("span", {}, e.empresa_base, el("small", {}, ` ${fFecha.format(fechaD(e.fin))}${e.muestra ? `, ${fmt0.format(e.muestra)} entrevistas` : ""}`)),
        el("div", { class: "pista" }, el("i", { style: { width: `${Math.round(e.peso_pct * 100)}%` } })), el("b", {}, `${Math.round(e.peso_pct * 100)} %`))));
    $("#como-ganando").textContent = "El porcentaje es lo que pesa cada encuesta en la media. Pesa más la más reciente, la que preguntó a más gente y la de la empresa que más acertó en 2016, 2019 y 2023. Una empresa nueva, que aún no ha pasado por unas elecciones, cuenta como una empresa normal. Las encuestas que encarga un partido no entran. A cada encuesta se le resta antes lo que esa empresa suele dar de más o de menos a cada partido.";
  } else $("#r-ganando").textContent = "Todavía no hay encuestas cargadas. La primera actualización tarda unos minutos.";

  // 2. ¿Quién va a gobernar?
  // Una sola medida para los asientos de hoy: el reparto con la media de encuestas (el mismo del mapa y de ¿Y si…?).
  // Las simulaciones ponen la probabilidad (aguja) y el margen (franja de la barra).
  const esc = D.resultados?.escanos || proy.total;
  const sumaEsc = (e) => e.partidos.reduce((a, k) => a + (esc[k] || 0), 0);
  if (P && der && izq) {
    const fav = der.p >= izq.p ? der : izq, otro = fav === der ? izq : der;
    const nFav = nombreEsc(fav), nOtro = nombreEsc(otro), X = sumaEsc(fav), t = tramo(fav.p), varios = fav.partidos.length > 1;
    const frase = [el("b", {}, t >= 3 ? `${cap(palabra(fav.p))}, ${nFav}${varios ? " juntos" : ""}.` : t === 2 ? "En el aire." : "Nadie lo tiene claro."),
      ` Con las encuestas de hoy ${t >= 3 ? "" : nFav + " "}${varios ? "sumarían" : "sacaría"} ${X} asientos, ${X > 176 ? `${X - 176} más de los 176 que hacen falta` : X === 176 ? "justo los 176 que hacen falta" : `${176 - X} menos de los 176 que hacen falta`}.`,
      ` Para ${nOtro}, ${palabra(otro.p)}, con ${sumaEsc(otro)} asientos.`, ` Que nadie sume y haya que negociar, ${palabra(P.bloqueo)}.`];
    $("#r-gobernar").replaceChildren(...frase);
    const op3 = (e, col) => ({ id: e.id, titulo: cap(nombreEsc(e)), p: e.p, color: col, partidos: e.partidos, central: sumaEsc(e), p10: e.p10, p90: e.p90, verbo: e.partidos.length > 1 ? "sumarían" : "sacaría", plural: e.partidos.length > 1 });
    const ops = [op3(der, color("PP")), { id: "nadie", titulo: "Nadie suma", p: P.bloqueo, color: "#8A93A3" }, op3(izq, color("PSOE"))];
    const pinta = () => {
      const o = ops.find((x) => x.id === gob.sel && x.partidos) || (gob.sel === "nadie" ? null : ops.find((x) => x.id === fav.id));
      const tocar = (k) => { gob.hemi = k && k !== gob.hemi && esc[k] ? k : null; pinta(); };
      hemiciclo($("#hemiciclo"), esc, 10, o ? { partidos: o.partidos, color: o.color } : null, "176", null, { marcado: gob.hemi, alTocar: tocar });
      fraseArco($("#hemi-arco"), o);
      leyenda($("#leyenda"), esc, null, tocar, gob.hemi);
      const k = gob.hemi, pk = k && P.partidos?.[k];
      fichaHemi($("#hemi-ficha"), k, k ? `${esc[k]} ${esc[k] === 1 ? "asiento" : "asientos"} con las encuestas de hoy${m.media[k] != null ? `, con el ${fmt1.format(m.media[k])} % de los votos` : ""}.${pk ? ` Lo normal es que acabe entre ${Math.min(pk.p10, esc[k])} y ${Math.max(pk.p90, esc[k])}.` : ""}` : "", () => tocar(null));
      medidores($("#g-medidores"), $("#g-medidor-detalle"), ops, gob.sel, (id) => { gob.sel = id; pinta(); });
    };
    pinta();
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
    $("#como-gobernar").textContent = `Que ${elP(primero[0])} sea el partido más votado, ${palabra(primero[1].p_primero)}. ${tramos.length ? cap(tramos.join(", y ")) + "." : ""} ${fav.bisagra?.length ? `La provincia que decide, donde cae el asiento 176 de ${nombreEsc(fav)} más veces, es ${fav.bisagra[0].nombre}.` : ""}`;
    const bt = P.backtest;
    const era = (x) => tramo(x) === 2 ? "estaba en el aire" : `era ${palabra(x)}`;
    if (bt) { const real = bt.resultado_escanos, pv = (real.PP || 0) + (real.Vox || 0), f6 = bt.fechas[bt.fechas.length - 1], f54 = bt.fechas[0];
      $("#backtest").replaceChildren(el("p", {}, el("b", {}, "¿Y acierta esto? "), `Lo probamos con 2023. A ${f54.dias} días del 23J, con las encuestas de entonces, este modelo habría dicho que la mayoría de PP y Vox ${era(f54.escenarios.pp_vox.p)} (${r100(f54.escenarios.pp_vox.p)} %). A ${f6.dias} días, que ${era(f6.escenarios.pp_vox.p)} (${r100(f6.escenarios.pp_vox.p)} %). Se quedaron en ${pv} asientos. Es decir, se habría equivocado de lado, pero dejando claro que no era seguro. Las encuestas españolas suelen quedarse cortas con el PSOE y eso ya lo tenemos en cuenta.`)); }
  } else {
    hemiciclo($("#hemiciclo"), esc, 10); leyenda($("#leyenda"), esc); fraseArco($("#hemi-arco"), null);
    $("#g-medidores").replaceChildren(); $("#g-medidor-detalle").replaceChildren();
    $("#r-gobernar").textContent = o.length ? `Si se votara hoy, ${nombre(ordenar(esc)[0])} sacaría ${esc[ordenar(esc)[0]]} asientos. Las probabilidades se calculan en la próxima actualización.` : "";
  }

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

  // 5. Titulares
  $("#titulares").replaceChildren(...(D.noticias?.generales || []).slice(0, 4).map((n) => noticia(n)), ...(D.noticias?.polemicas || []).slice(0, 2).map((n) => noticia(n)));
  $("#titulares-todos").replaceChildren(...(D.noticias?.generales || []).slice(0, 12).map((n, i) => noticia(n, { grande: i === 0 })));
  $("#polemicas-todas").replaceChildren(...((D.noticias?.polemicas || []).length ? D.noticias.polemicas.slice(0, 12).map((n) => noticia(n)) : [el("p", { class: "vacio" }, "Se recogen en la próxima actualización.")]));
  $("#verificaciones-todas").replaceChildren(...((D.noticias?.verificaciones_generales || []).length ? D.noticias.verificaciones_generales.slice(0, 8).map((n) => noticia(n)) : [el("p", { class: "vacio" }, "Se recogen en la próxima actualización.")]));

  // 6. Fechas
  const ag = D.agenda || [], sig = ag.find((x) => fechaD(x.fin || x.fecha) >= hoy());
  $("#r-fechas").textContent = `Se vota el domingo 29 de noviembre${dias > 0 ? `, dentro de ${dias} días` : ""}. ${sig ? `Lo siguiente en el calendario, ${sig.titulo.charAt(0).toLowerCase() + sig.titulo.slice(1)}, ${sig.fin ? `del ${fFecha.format(fechaD(sig.fecha))} al ${fFecha.format(fechaD(sig.fin))}` : `el ${fFechaLarga.format(fechaD(sig.fecha))}`}.` : ""}`;
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
  if (p.aspirante) { const falta = Math.max(p.aspirante.falta, 0), votos = votosDe(falta, p.n), umbral = 10 / (p.n + 1);
    const renido = falta < umbral / 2 ? "muy reñido" : falta < umbral ? "reñido" : null;
    f += renido ? `El último asiento está ${renido}, lo tiene ${nombre(p.ultimo.p)} y ${nombre(p.aspirante.p)} se lo quitaría ${votos < 100 ? "con muy pocos votos, es un empate técnico" : `con unos ${fmt0.format(votos)} votos más`}.` : `El último asiento lo tiene bastante claro ${nombre(p.ultimo.p)}, ${nombre(p.aspirante.p)} necesitaría unos ${fmt0.format(votos)} votos más para quitárselo.`; }
  return f;
}
function pintarMiProvincia(proy) {
  const sel = $("#mi-provincia");
  if (!sel.options.length) {
    sel.append(el("option", { value: "" }, "Elige una"), ...proy.provincias.map((p) => p.nombre).sort((a, b) => a.localeCompare(b, "es")).map((n) => el("option", { value: n }, n)));
    sel.addEventListener("change", () => { try { localStorage.setItem("mi-provincia", sel.value); } catch {} mapa.sel = sel.value || null; if (mapa.proy) pintarMapa(mapa.proy); if (sel.value) $("#ficha-provincia").scrollIntoView({ behavior: "smooth", block: "center" }); });
  }
  sel.value = mapa.sel || "";
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
    options: { ...opciones(" %"), scales: { ...opciones("").scales, y: { ...opciones("").scales.y, min: 0, max: 100 } } } });
}
function opciones(suf) {
  const css = getComputedStyle(document.documentElement), gris = css.getPropertyValue("--gris").trim(), linea = css.getPropertyValue("--linea").trim();
  return { responsive: true, maintainAspectRatio: false, animation: false, interaction: { mode: "index", intersect: false },
    plugins: { legend: { position: "bottom", labels: { color: gris, boxWidth: 10, boxHeight: 10, usePointStyle: true } }, tooltip: { callbacks: { label: (c) => `${c.dataset.label} ${c.parsed.y == null ? "–" : fmt1.format(c.parsed.y)}${suf}` } } },
    scales: { x: { ticks: { color: gris, maxRotation: 0, autoSkipPadding: 18 }, grid: { display: false } }, y: { beginAtZero: true, ticks: { color: gris }, grid: { color: linea } } } };
}

/* ---------- Encuestas ---------- */
const enc = { filtro: null, abiertas: new Set(), tramo: "legislatura" };
const fMesAnio = new Intl.DateTimeFormat("es-ES", { month: "short", year: "numeric" });
const etiquetaFecha = (t) => fMesAnio.format(t).replace(" de ", " ");
document.querySelectorAll(".tramos button").forEach((b) => b.addEventListener("click", () => { enc.tramo = b.dataset.tramo; document.querySelectorAll(".tramos button").forEach((x) => x.setAttribute("aria-pressed", x === b ? "true" : "false")); pintarTendencia(); }));
function pintarEncuestas(m, m7, proy) {
  const o = ordenar(m.media).filter((k) => m.media[k] >= 0.5);
  const max = Math.max(...o.map((k) => m.media[k]), 1);
  $("#lista-partidos").replaceChildren(...o.map((k) => { const d = m7.media[k] != null ? m.media[k] - m7.media[k] : 0;
    return el("div", { class: "fila-p" }, el("div", { class: "nom" }, el("i", { class: "punto", style: { background: color(k) } }), nombre(k)),
      el("div", { class: "pct" }, `${fmt1.format(m.media[k])} %`, el("small", { class: Math.abs(d) >= 0.1 ? (d > 0 ? "sube" : "baja") : "" }, Math.abs(d) >= 0.1 ? signo(d) : "")),
      el("div", { class: "barra" }, el("i", { style: { width: `${m.media[k] / max * 100}%`, background: color(k) } })),
      el("div", { class: "esc" }, D.prob?.partidos?.[k] ? `entre ${D.prob.partidos[k].p10} y ${D.prob.partidos[k].p90} asientos` : `${proy.total[k] || 0} asientos`)); }));
  // Botones por empresa: todas las de la legislatura. Primero las que han publicado en el último año, de más a menos
  // encuestas, y al final las que llevan más de un año calladas. Las de partido no son empresas y no tienen botón.
  const todas = D.encuestas?.encuestas || [], hace365 = new Date(+hoy() - 365 * DIA);
  const cuenta = {};
  for (const e of todas) { if (Media.esDePartido(e)) continue; const c = (cuenta[e.clave] ||= { empresa: e.empresa_base, n: 0, ultima: e.fin }); c.n++; if (e.fin > c.ultima) c.ultima = e.fin; }
  const enMedia = new Set(m.usadas.map((e) => e.clave));
  for (const c of Object.values(cuenta)) c.activa = fechaD(c.ultima) >= hace365;
  const empresas = Object.entries(cuenta).sort((a, b) => b[1].activa - a[1].activa || b[1].n - a[1].n || (a[1].ultima < b[1].ultima ? 1 : -1));
  if (enc.filtro && !cuenta[enc.filtro]) enc.filtro = null;
  // De entrada se ven las 8 que más publican, el resto se despliega. Si la elegida está más abajo, se despliega sola.
  const CORTE = 8;
  const oculta = () => enc.filtro && empresas.findIndex(([k]) => k === enc.filtro) >= CORTE;
  if (oculta()) enc.todas = true;
  $("#filtro-empresas").replaceChildren(el("button", { type: "button", "aria-pressed": enc.filtro ? "false" : "true", onclick: () => { enc.filtro = null; pintarEncuestas(m, m7, proy); } }, "Media de todas"),
    ...(enc.todas ? empresas : empresas.slice(0, CORTE)).map(([clave, v]) => el("button", { type: "button", class: `${enMedia.has(clave) ? "en-media" : ""}${v.activa ? "" : " inactiva"}`, "data-clave": clave, "aria-pressed": enc.filtro === clave ? "true" : "false",
      title: `${v.n} ${v.n === 1 ? "encuesta" : "encuestas"} desde 2023, la última del ${fFecha.format(fechaD(v.ultima))}`, onclick: () => { enc.filtro = clave; pintarEncuestas(m, m7, proy); } }, v.empresa, el("small", {}, ` ${v.n}`))),
    empresas.length > CORTE ? el("button", { type: "button", class: "mas", "aria-expanded": enc.todas ? "true" : "false", onclick: () => { enc.todas = !enc.todas; if (!enc.todas && oculta()) enc.filtro = null; pintarEncuestas(m, m7, proy); } }, enc.todas ? "Ver menos" : `Ver las ${empresas.length}`) : null);
  $("#leyenda-empresas").textContent = `${empresas.length} empresas han publicado encuestas desde 2023. El número es cuántas lleva cada una. Con punto verde, las ${enMedia.size} que cuentan hoy en la media. En gris, las que llevan más de un año sin publicar.`;
  const cf = enc.filtro ? cuenta[enc.filtro] : null;
  $("#explica-tendencia").textContent = cf ? `Las encuestas de ${cf.empresa}, una a una, desde las últimas elecciones. Cada punto es una encuesta. ${enMedia.has(enc.filtro) ? "Su última encuesta cuenta hoy en la media." : enc.filtro === "cis" ? "El CIS no cuenta en la media salvo que lo actives más abajo." : cf.activa ? `Hoy no cuenta en la media porque su última encuesta, del ${fFecha.format(fechaD(cf.ultima))}, tiene más de ${m.ventana} días.` : "Lleva más de un año sin publicar."}` : "Así ha cambiado la media de encuestas desde las últimas elecciones, en julio de 2023.";
  // Tarjetas
  const usadas = new Set(m.usadas.map((e) => e.id));
  const lista = (enc.filtro ? todas.filter((e) => e.clave === enc.filtro) : todas).slice(0, enc.filtro ? 30 : 12);
  $("#tarjetas-encuestas").replaceChildren(...lista.map((e) => {
    const an = D.analisis?.ultimas?.find((x) => x.id === e.id), nota = D.analisis?.notas?.find((x) => x.clave === e.clave), oe = ordenar(e.pct);
    const dif = e.pct[oe[0]] - e.pct[oe[1]];
    const dePartido = Media.esDePartido(e);
    const fiable = dePartido ? "La ha encargado un partido, así que no entra en la media" : nota ? (nota.letra === "A" || nota.letra === "B" ? "Es una empresa que ha acertado bastante en el pasado" : nota.letra === "C" || nota.letra === "D" ? "Es una empresa que ha fallado más de la cuenta en el pasado" : "No sabemos cuánto acierta, no hizo encuestas antes de las últimas elecciones") : "";
    const ver = an ? (an.veredicto === "ruido" ? "y dice más o menos lo mismo que las demás." : an.veredicto === "leve" ? "y se sale un poco de lo habitual en ella." : "y trae un cambio de verdad respecto a lo que suele dar.") : ".";
    const abierta = enc.abiertas.has(e.id);
    const sesgo = D.analisis?.sesgos?.[e.clave]?.sesgo;
    const tarjeta = el("div", { class: "tarjeta abrible", id: `enc-${e.id}`, style: usadas.has(e.id) || enc.filtro ? null : { opacity: .75 }, onclick: (ev) => { if (ev.target.closest("a")) return; abierta ? enc.abiertas.delete(e.id) : enc.abiertas.add(e.id); pintarEncuestas(m, m7, proy); } },
      el("div", { class: "cab" }, el("b", {}, e.empresa_base, e.encargo ? ` para ${e.encargo}` : "", nota && nota.letra !== "–" ? el("span", { class: "nota", title: nota.texto }, nota.letra) : null,
        dePartido ? el("span", { class: "veredicto leve" }, "de un partido") : an ? el("span", { class: `veredicto ${an.veredicto}` }, an.veredicto === "ruido" ? "nada nuevo" : an.veredicto === "leve" ? "algo se mueve" : "novedad") : null),
        el("span", {}, fFecha.format(fechaD(e.fin)))),
      el("p", { class: "ver" }, `Dice que gana ${nombre(oe[0])} por ${fmt1.format(dif)} puntos. ${fiable}${fiable ? " " : ""}${ver}${e.muestra ? ` Preguntó a ${fmt0.format(e.muestra)} personas, margen de error de ±${fmt1.format(an?.margen ?? 98 / Math.sqrt(e.muestra))} puntos.` : ""}`),
      el("div", { class: "chips" }, ...oe.slice(0, abierta ? 99 : 6).map((k) => el("span", { class: "chip", style: { background: color(k) } }, `${nombre(k)} ${fmt1.format(e.pct[k])}`))),
      abierta ? el("div", { class: "detalle" },
        el("p", {}, `Trabajo de campo ${e.inicio && e.inicio !== e.fin ? `del ${fFecha.format(fechaD(e.inicio))} al ` : "el "}${fFecha.format(fechaD(e.fin))}.${e.muestra ? ` ${fmt0.format(e.muestra)} entrevistas.` : ""}${Object.keys(e.escanos || {}).length ? ` Asientos que da: ${ordenar(e.escanos).filter((k) => e.escanos[k] > 0).slice(0, 8).map((k) => `${nombre(k)} ${Math.round(e.escanos[k])}`).join(", ")}.` : ""}${nota && nota.letra !== "–" ? ` Nota ${nota.letra}, ${nota.texto}.` : ""}`),
        el("table", {}, el("thead", {}, el("tr", {}, el("th", {}, "Partido"), el("th", {}, "Dio"), el("th", {}, "Suele dar"), el("th", {}, "Media de todas"))),
          el("tbody", {}, ...oe.slice(0, 8).map((k) => { const d = an?.detalle?.find((x) => x.partido === k);
            return el("tr", {}, el("td", {}, nombre(k)), el("td", {}, fmt1.format(e.pct[k])), el("td", {}, sesgo && sesgo[k] != null ? `${signo(sesgo[k])} que la media` : "–"), el("td", {}, d ? fmt1.format(d.esperado - (sesgo && sesgo[k] != null ? sesgo[k] : 0)) : "–")); }))),
        el("p", { class: "mas" }, "\"Suele dar\" es lo que esta empresa se separa de la media del momento en sus encuestas de esta legislatura. Toca para cerrar.")) : el("p", { class: "mas" }, "Toca para ver todos los datos"));
    return tarjeta;
  }));
  if (D.encuestas) $("#fuente-encuestas").replaceChildren(enc.filtro ? "" : `Las atenuadas no entran en la media de hoy por tener más de ${m.ventana} días, por haber otra más reciente de la misma empresa o por ser de un partido. La fecha de cada encuesta es la del último día en que preguntó. `, "Fuente ", el("a", { href: D.encuestas.fuente, target: "_blank", rel: "noopener" }, "Wikipedia"), `, actualizado ${hace(D.encuestas.actualizado)}.`);
  graficoTendencia?.destroy(); graficoTendencia = null;
  if (!$("#encuestas").hidden) pintarTendencia();
}
function pintarTendencia() {
  const m = calcMedia(), o = ordenar(m.media).filter((k) => m.media[k] >= 1.5).slice(0, 7);
  graficoTendencia?.destroy();
  const desde = enc.tramo === "anio" ? new Date(+hoy() - 365 * DIA) : enc.tramo === "tres" ? new Date(+hoy() - 92 * DIA) : fechaD("2023-09-03");
  if (enc.filtro) {
    const mias = (D.encuestas?.encuestas || []).filter((e) => e.clave === enc.filtro && fechaD(e.fin) >= desde).slice().reverse();
    graficoTendencia = new Chart($("#grafico-tendencia"), { type: "line", data: { labels: mias.map((e) => enc.tramo === "tres" ? fFecha.format(fechaD(e.fin)) : etiquetaFecha(fechaD(e.fin))),
      datasets: o.map((k) => ({ label: nombre(k), data: mias.map((e) => e.pct[k] ?? null), borderColor: color(k), backgroundColor: color(k), borderWidth: 2, pointRadius: 4, tension: .2, spanGaps: true })) }, options: opciones(" %") });
    return;
  }
  const puntos = [], paso = enc.tramo === "tres" ? 1 : enc.tramo === "anio" ? 3 : 7;
  for (let t = desde; t <= hoy(); t = new Date(+t + paso * DIA)) puntos.push(t);
  if (puntos[puntos.length - 1] < hoy()) puntos.push(hoy());
  const series = {};
  for (const t of puntos) { const mm = calcMedia(t).media; for (const k of o) (series[k] ||= []).push(mm[k] != null ? +mm[k].toFixed(2) : null); }
  graficoTendencia = new Chart($("#grafico-tendencia"), { type: "line", data: { labels: puntos.map((t) => enc.tramo === "tres" ? fFecha.format(t) : etiquetaFecha(t)),
    datasets: o.map((k) => ({ label: nombre(k), data: series[k], borderColor: color(k), backgroundColor: color(k), borderWidth: 3, pointRadius: 0, tension: .3, spanGaps: true })) }, options: opciones(" %") });
}
/* ---------- ¿La ley electoral favorece a alguien? (en ¿Y si…?, con los votos de la situación elegida) ---------- */
function pintarLey(media, esc2, provincias) {
  const conVoto = ordenar(media).filter((k) => media[k] > 0), sumaV = conVoto.reduce((s, k) => s + media[k], 0);
  const cuo = conVoto.map((k) => ({ k, q: media[k] / sumaV * 350 }));
  const prop = {}; let asignados = 0;
  for (const x of cuo) { prop[x.k] = Math.floor(x.q); asignados += prop[x.k]; }
  for (const x of cuo.sort((a, b) => (b.q - Math.floor(b.q)) - (a.q - Math.floor(a.q))).slice(0, 350 - asignados)) prop[x.k]++;
  const comp = [...new Set([...Object.keys(esc2), ...Object.keys(prop)])].filter((k) => (esc2[k] || 0) > 0 || (prop[k] || 0) >= 2).map((k) => ({ k, real: esc2[k] || 0, prop: prop[k] || 0, d: (esc2[k] || 0) - (prop[k] || 0) })).sort((a, b) => b.real - a.real);
  if (comp.length > 2) {
    const ganan = comp.filter((x) => x.d >= 3).sort((a, b) => b.d - a.d), pierden = comp.filter((x) => x.d <= -3).sort((a, b) => a.d - b.d);
    $("#r-coste").replaceChildren(el("b", {}, ganan.length ? "Sí." : "Poco."), ganan.length ? ` A ${lista(ganan.map((x) => nombre(x.k)))} le${ganan.length > 1 ? "s" : ""} da ${lista(ganan.map((x) => `${x.d}`))} asientos más de los que le${ganan.length > 1 ? "s" : ""} tocarían por sus votos.` : "", pierden.length ? ` A ${lista(pierden.map((x) => nombre(x.k)))} le${pierden.length > 1 ? "s" : ""} quita ${lista(pierden.map((x) => `${-x.d}`))}.` : "");
    const maxB = Math.max(...comp.map((x) => Math.max(x.real, x.prop)));
    $("#g-proporcional").replaceChildren(...comp.map((x) => el("div", { class: "par" },
      el("span", { class: "nom" }, el("i", { class: "punto", style: { background: color(x.k) } }), nombre(x.k)),
      el("span", { class: `dif ${x.d > 0 ? "sube" : x.d < 0 ? "baja" : ""}` }, x.d ? `${x.d > 0 ? "+" : "−"}${Math.abs(x.d)}` : "igual"),
      el("div", { class: "filas" },
        el("div", { class: "fila" }, el("span", {}, "tendrá"), el("i", { style: { width: `${x.real / maxB * 100}%`, background: color(x.k) } }), el("b", {}, x.real)),
        el("div", { class: "fila tendria" }, el("span", {}, "le tocarían"), el("i", { style: { width: `${x.prop / maxB * 100}%`, background: color(x.k) } }), el("b", {}, x.prop))))));
    const utiles = (k) => { let con = 0, sin = 0, provCon = 0, provSin = 0;
      for (const pr of provincias) { const v = (pr.cuotas[k] || 0) * pr.n; if (!v) continue; if (pr.escanos[k]) { con += v; provCon++; } else { sin += v; provSin++; } }
      return { util: con / (con + sin || 1), provCon, provSin }; };
    const expl = comp.filter((x) => Math.abs(x.d) >= 3).map((x) => ({ ...x, ...utiles(x.k) }));
    $("#g-perdidos").replaceChildren(...expl.map((x) => el("div", { class: "perdido" }, el("b", {}, el("i", { class: "punto", style: { background: color(x.k) } }), nombre(x.k)),
      el("span", { class: "v", style: x.d > 0 ? { color: "var(--bien)" } : null }, x.d > 0 ? `${x.d} asientos de regalo` : `${-x.d} asientos menos`),
      el("span", { class: "m" }, x.provCon ? `Saca asiento en ${x.provCon} provincias y se queda a cero en ${x.provSin}. El ${r100(1 - x.util)} % de sus votos no sirve para elegir a nadie.` : `No saca asiento en ninguna provincia. Todos sus votos se tiran.`))));
  }
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
    // Misma pareja y misma medida que la ficha y la lista: quién tiene el último asiento, quién se lo disputa,
    // y lo que le falta comparado con lo que cuesta un asiento en esa provincia
    const dos = p.ultimo && p.aspirante ? [p.ultimo.p, p.aspirante.p] : [];
    const rel = p.aspirante ? Math.max(p.aspirante.falta, 0) / (10 / (p.n + 1)) : 9;
    const id = "g" + p.nombre.replace(/[^a-z]/gi, "");
    const grad = dos.length === 2 ? `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="50%" stop-color="${color(dos[0])}"/><stop offset="50%" stop-color="${color(dos[1])}"/></linearGradient>` : "";
    return { fill: dos.length === 2 ? `url(#${id})` : "var(--linea)", op: rel < 0.5 ? 1 : rel < 1 ? 0.75 : rel < 2 ? 0.4 : 0.12, txt: "var(--tinta)", etiqueta: dos.length === 2 && p.n >= 4 ? `${nombre(dos[0])}·${nombre(dos[1])}` : "", grad, clase: "etq", tam: 21 };
  }
  const empate = gan && ordenar(p.escanos).length > 1 && p.escanos[gan] === p.escanos[ordenar(p.escanos)[1]];
  return { fill: gan ? color(gan) : "var(--linea)", op: empate ? .6 : 1, txt: "#fff", etiqueta: String(p.n) };
}
function dibujarMapa(proy, opciones = {}) {
  // opciones: {vista, sel, resaltar: Set de provincias con borde, colorear: (p)=>{fill,op,...}}
  const G = D.mapa, vista = opciones.vista || mapa.vista, sel = opciones.sel ?? mapa.sel, resaltar = opciones.resaltar || new Set();
  const guardada = mapa.vista; mapa.vista = vista;
  const cols = proy.provincias.map((p) => [p, opciones.colorear ? opciones.colorear(p) : colorProvincia(p)]);
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
  pintarMiProvincia(proy);
  const svg = dibujarMapa(proy);
  $("#mapa-svg").innerHTML = svg;
  $("#mapa-svg").querySelectorAll("g.prov").forEach((g) => g.addEventListener("click", () => { mapa.sel = g.dataset.p; try { localStorage.setItem("mi-provincia", mapa.sel); } catch {} pintarMapa(mapa.proy); }));
  $("#mapa-pista").textContent = mapa.vista === "ganador" ? "Cada provincia lleva el color del partido que más asientos sacaría en ella, y el número de asientos que reparte. Si está más clara es que hay empate. Toca una para ver el detalle." : "Cada provincia lleva los colores de los dos partidos que se disputan su último asiento, primero el que lo tiene y luego el que lo persigue. Cuanto más intenso, más reñido. Las casi blancas están decididas. Toca una para ver el detalle.";
  const p = proy.provincias.find((x) => x.nombre === mapa.sel);
  $("#ficha-provincia").replaceChildren(...(p ? [el("div", { class: "ficha" }, el("h3", {}, `${p.nombre}, ${p.n} asientos`),
    el("div", { class: "chips" }, ...ordenar(p.escanos).map((k) => el("span", { class: "chip", style: { background: color(k) } }, `${nombre(k)} ${p.escanos[k]}`))),
    el("p", {}, (p.aspirante ? fraseProvincia(p, false) : "") + antes2023(p)),
    el("details", { class: "como" }, el("summary", {}, "¿Cómo se reparten estos asientos?"),
      el("p", {}, "Con la ley D'Hondt. El voto de cada partido se divide entre 1, 2, 3… y los asientos van a los números más altos. Los marcados en color son los que se llevan asiento. Solo entran los partidos con al menos el 3 % del voto de la provincia."),
      tablaDhondt(p)))] : []));
  // Ordenadas por lo mismo que dice la etiqueta: lo que le falta al aspirante comparado con lo que cuesta un asiento en esa provincia
  const relativo = (x) => Math.max(x.aspirante.falta, 0) / (10 / (x.n + 1));
  const aj = [...proy.provincias].filter((x) => x.aspirante).sort((a, b) => relativo(a) - relativo(b)).slice(0, 5).map((x) => ({ x }));
  const nivel = (x) => { const f = Math.max(x.aspirante?.falta ?? 99, 0), u = 10 / (x.n + 1); return f < u / 2 ? "Muy reñida" : f < u ? "Reñida" : "Algo reñida"; };
  $("#ajustadas").replaceChildren(...aj.map(({ x, pp }) => el("button", { class: "ajustada", type: "button", onclick: () => { mapa.sel = x.nombre; pintarMapa(mapa.proy); $("#ficha-provincia").scrollIntoView({ behavior: "smooth", block: "center" }); } },
    el("b", {}, x.nombre), el("span", { class: "pts" }, nivel(x)),
    el("span", { class: "m" }, x.aspirante ? `Se lo disputan ${nombre(x.ultimo.p)} y ${nombre(x.aspirante.p)}. Hoy lo tiene ${nombre(x.ultimo.p)} ${porVotos(Math.max(x.aspirante.falta, 0), x.n)}.` : ""))));
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
document.querySelectorAll("#mapa .conmutador button").forEach((b) => b.addEventListener("click", () => {
  mapa.vista = b.dataset.vista;
  document.querySelectorAll("#mapa .conmutador button").forEach((x) => x.setAttribute("aria-pressed", x === b ? "true" : "false"));
  pintarMapa(mapa.proy);
}));

/* ---------- ¿Y si…? ---------- */
const sim = { valores: {}, seleccion: new Set(), situacion: "media", fusiones: [], cambios: [], caso: { quien: "", verbo: "absorbe", a: new Set(), puntos: 3, sigue: 1 } };
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
  sim.base = { ...m.media }; sim.valores = { ...m.media }; sim.proyBase = proyBase; sim.situacion = "media"; sim.fusiones = [];
  vaciarCaso();
  const sits = situaciones(sim.base);
  $("#situaciones").replaceChildren(...sits.map((x) => el("button", { class: "situacion", type: "button", "data-id": x.id, "aria-pressed": sim.situacion === x.id ? "true" : "false", onclick: () => {
    sim.situacion = x.id; sim.valores = x.f({ ...sim.base }); sim.fusiones = [];
    vaciarCaso(); pintarCaso();
    marcarSituacion(); recalcularSim(); probabilidadSim(); } }, x.titulo, el("small", {}, x.detalle))));
  pintarCaso();
  recalcularSim();
  probabilidadSim();
}
const marcarSituacion = () => document.querySelectorAll(".situacion").forEach((b) => b.setAttribute("aria-pressed", b.dataset.id === sim.situacion ? "true" : "false"));

/* Monta tu caso: frases con quién, qué hace y a quién. Se pueden encadenar varias con «Añadir otro cambio».
   Quitar puntos mueve votos en toda España, como las situaciones fijas. Absorber o ir en una lista junta los votos
   provincia a provincia (Modelo.fundir), cada partido donde los tiene, y después se reparten los asientos.
   sim.cambios son los cambios ya guardados y sim.caso el que se está montando. Se aplican en ese orden. */
const VERBOS = [["absorbe", "absorbe a"], ["lista", "va en una lista con"], ["quita", "le quita puntos a"]];
const SIGUEN = [[1, "Todos"], [0.75, "Tres cuartos"], [0.5, "La mitad"]];
const casoNuevo = () => ({ quien: "", verbo: "absorbe", a: new Set(), puntos: 3, sigue: 1 });
function vaciarCaso() { sim.cambios = []; sim.caso = casoNuevo(); }
function resolverCaso(cambios) {
  const v = { ...sim.base }, fusiones = [], fuera = new Set(), hechos = [];
  // Los partidos que forman hoy la lista k: ella y los que se le han ido juntando
  const partes = (k) => [k, ...fusiones.filter((f) => f.a === k).flatMap((f) => f.de.flatMap(partes))];
  cambios.forEach((c, i) => {
    const otros = [...c.a].filter((k) => k !== c.quien && v[k] > 0 && !fuera.has(k));
    if (!c.quien || !(v[c.quien] > 0) || fuera.has(c.quien) || !otros.length) return;
    if (c.verbo === "quita") {
      // Los puntos salen de cada lista según su tamaño, y dentro de una lista conjunta, de cada partido que la forma
      const de = otros.flatMap(partes), antes = { ...v }, total = de.reduce((t, k) => t + antes[k], 0), pts = Math.min(c.puntos, total);
      for (const k of de) v[k] -= pts * antes[k] / total;
      v[c.quien] += pts; hechos.push({ i, c, otros, pts });
    } else {
      // En una lista conjunta manda el nombre del partido con más votos. Si uno absorbe a otros, el suyo.
      const todos = [c.quien, ...otros], tam = Modelo.fundir(v, fusiones), cabeza = c.verbo === "lista" ? todos.reduce((x, k) => tam[k] > tam[x] ? k : x) : c.quien;
      const f = { a: cabeza, de: todos.filter((k) => k !== cabeza), sigue: c.sigue };
      fusiones.push(f); f.de.forEach((k) => fuera.add(k)); hechos.push({ i, c, otros, f });
    }
  });
  return { v, fusiones, fuera, hechos };
}
function pintarCaso() {
  const c = sim.caso, cont = $("#caso");
  if (!cont || !sim.base) return;
  const guardados = resolverCaso(sim.cambios), todo = resolverCaso([...sim.cambios, c]), actual = todo.hechos.find((h) => h.c === c);
  const partidos = ordenar(sim.base).filter((k) => sim.base[k] > 0 && !guardados.fuera.has(k));
  if (c.quien && !partidos.includes(c.quien)) c.quien = "";
  const cambiar = () => {
    const r = resolverCaso([...sim.cambios, sim.caso]);
    if (r.hechos.length) { sim.valores = r.v; sim.fusiones = r.fusiones; sim.situacion = "propio"; }
    else if (sim.situacion === "propio") { sim.situacion = "media"; sim.valores = { ...sim.base }; sim.fusiones = []; }
    else { pintarCaso(); return; }
    pintarCaso(); marcarSituacion(); recalcularSim(); probabilidadSim();
  };
  const pastillas = (valores, elegido, alElegir) => el("div", { class: "pactos" }, ...valores.map(([val, txt]) =>
    el("button", { class: "pacto opcion", type: "button", "aria-pressed": val === elegido ? "true" : "false", onclick: () => alElegir(val) }, txt)));
  const n = (ks) => lista(ks.map(nombre)), puntos = (x) => `${Number.isInteger(x) ? x : fmt1.format(x)} ${x === 1 ? "punto" : "puntos"}`;
  // Una línea por cambio ya guardado
  const frase = (h) => h.f
    ? `${h.c.verbo === "lista" ? `${cap(n([h.f.a, ...h.f.de]))} van en una lista` : `${cap(elP(h.f.a))} absorbe ${lista(h.f.de.map(aP))}`}${h.f.sigue < 1 ? `, y de los que se suman le ${h.f.sigue === 0.5 ? "sigue la mitad" : "siguen tres cuartos"}` : ""}`
    : `${cap(elP(h.c.quien))} le quita ${puntos(h.pts)} ${lista(h.otros.map(aP))}`;
  const otros = [...c.a].filter((k) => k !== c.quien && partidos.includes(k)), f = actual?.f;
  let resumen = sim.cambios.length ? "Puedes dejarlo así o montar otro cambio." : "Elige un partido, qué hace y con quién.";
  if (c.quien && !otros.length) resumen = c.verbo === "quita" ? "Ahora toca a quién le quita los puntos." : "Ahora toca los partidos con los que se junta.";
  if (actual && !f) resumen = `${cap(elP(c.quien))} le quita ${puntos(actual.pts)} ${otros.length > 1 ? `entre ${n(otros)}, a cada uno según su tamaño` : aP(otros[0])}. Son ${puntosTexto(actual.pts).replace(/^.*? puntos, /, "")}.`;
  if (f) resumen = `${c.verbo === "lista" ? `${cap(n([f.a, ...f.de]))} van en una sola lista. En los dibujos sale con el nombre y el color ${deP(f.a)}.` : `${cap(elP(f.a))} se queda con los votos ${lista(f.de.map(deP))}.`} Se suman provincia a provincia, cada uno donde los tiene.${f.sigue < 1 ? ` ${f.sigue === 0.5 ? "La mitad" : "Uno de cada cuatro"} de los votantes ${lista(f.de.map(deP))} no le sigue y se queda en casa.` : ""}`;
  cont.replaceChildren(
    el("h3", {}, "O monta tu caso"),
    guardados.hechos.length ? el("ul", { class: "caso-lista" }, ...guardados.hechos.map((h) => el("li", {}, el("span", {}, frase(h)),
      el("button", { type: "button", "aria-label": `Quitar este cambio, ${frase(h)}`, onclick: () => { sim.cambios.splice(h.i, 1); cambiar(); } }, "×")))) : null,
    el("div", { class: "caso-frase" }, el("span", {}, sim.cambios.length ? "¿Y si además" : "¿Y si"),
      el("select", { "aria-label": "Qué partido", onchange: (e) => { c.quien = e.target.value; c.a.delete(c.quien); cambiar(); } },
        el("option", { value: "" }, "elige partido"), ...partidos.map((k) => el("option", { value: k, selected: k === c.quien ? "" : null }, elP(k)))),
      el("select", { "aria-label": "Qué hace", onchange: (e) => { c.verbo = e.target.value; cambiar(); } },
        ...VERBOS.map(([val, txt]) => el("option", { value: val, selected: val === c.verbo ? "" : null }, txt))),
      el("span", {}, "…?")),
    el("div", { class: "pactos" }, ...partidos.filter((k) => k !== c.quien).map((k) => el("button", { class: "pacto", type: "button", "aria-pressed": c.a.has(k) ? "true" : "false",
      onclick: () => { if (c.a.has(k)) c.a.delete(k); else c.a.add(k); cambiar(); } }, el("i", { class: "punto", style: { background: color(k) } }), nombre(k)))),
    c.verbo === "quita"
      ? el("div", { class: "caso-extra" }, el("span", {}, "¿Cuántos puntos?"), pastillas([[1, "1"], [2, "2"], [3, "3"], [5, "5"]], c.puntos, (val) => { c.puntos = val; cambiar(); }))
      : el("div", { class: "caso-extra" }, el("span", {}, otros.length ? `¿Cuántos votantes ${lista((f ? f.de : otros).map(deP))} le siguen?` : "¿Cuántos de sus votantes le siguen?"), pastillas(SIGUEN, c.sigue, (val) => { c.sigue = val; cambiar(); })),
    el("p", { class: "caso-resumen" }, resumen),
    el("div", { class: "caso-botones" },
      actual ? el("button", { class: "pacto opcion", type: "button", onclick: () => { sim.cambios.push({ ...c, a: new Set(c.a) }); sim.caso = casoNuevo(); cambiar(); } }, "Añadir otro cambio") : null,
      sim.situacion === "propio" ? el("button", { class: "pacto limpiar", type: "button", onclick: () => { vaciarCaso(); cambiar(); } }, "Quitar mi caso") : null));
}
function pintarHemiSim() {
  const tot = sim.ultimaProy.total, der = escenario(D.config.principales.derecha), izq = escenario(D.config.principales.izquierda), suma = (e) => e.partidos.reduce((a, k) => a + (tot[k] || 0), 0);
  const bl = !der || !izq || sim.med === "nadie" ? null : [der, izq].find((e) => e.id === sim.med) || (suma(der) >= suma(izq) ? der : izq);
  const col = bl ? color(bl === der ? "PP" : "PSOE") : null;
  if (sim.hemi && !tot[sim.hemi]) sim.hemi = null;
  const tocar = (k) => { sim.hemi = k && k !== sim.hemi && tot[k] ? k : null; pintarHemiSim(); };
  hemiciclo($("#sim-hemiciclo"), tot, 10, bl ? { partidos: bl.partidos, color: col } : null, "176", null, { marcado: sim.hemi, alTocar: tocar });
  fraseArco($("#sim-hemi-arco"), bl ? { titulo: cap(nombreEsc(bl)), central: suma(bl), color: col, plural: bl.partidos.length > 1 } : null);
  leyenda($("#sim-leyenda"), tot, (k) => { const d = tot[k] - (sim.proyBase.total[k] || 0); return d ? el("small", { class: d > 0 ? "sube" : "baja" }, ` ${d > 0 ? "+" : "−"}${Math.abs(d)}`) : null; }, tocar, sim.hemi);
  const k = sim.hemi, dif = k ? tot[k] - (sim.proyBase.total[k] || 0) : 0;
  fichaHemi($("#sim-hemi-ficha"), k, k ? `${tot[k]} ${tot[k] === 1 ? "asiento" : "asientos"} en esta situación, ${dif ? `${Math.abs(dif)} ${dif > 0 ? "más" : "menos"} que con las encuestas de hoy` : "los mismos que con las encuestas de hoy"}.` : "", () => tocar(null));
}
/* Suma de partidos: los elegidos se juntan a la izquierda del hemiciclo, a todo color, y el resto se queda a media luz.
   Si el arco de los elegidos pasa la raya, suman mayoría. Se eligen tocando el dibujo o los botones. */
function pintarPactos() {
  const tot = sim.ultimaProy.total, sel = sim.seleccion, base = D.config.orden_hemiciclo;
  for (const k of [...sel]) if (!tot[k]) sel.delete(k);
  const con = Object.keys(tot).filter((k) => tot[k] > 0);
  const orden = [...ordenar(tot).filter((k) => sel.has(k)), ...con.filter((k) => !sel.has(k)).sort((a, b) => (base.indexOf(a) + 1 || 99) - (base.indexOf(b) + 1 || 99))];
  const alternar = (k) => { if (!k || !tot[k]) return; if (sel.has(k)) sel.delete(k); else sel.add(k); pintarPactos(); };
  const suma = [...sel].reduce((a, k) => a + (tot[k] || 0), 0);
  hemiciclo($("#pactos-hemi"), tot, 10, sel.size ? { partidos: [...sel], color: "var(--tinta)" } : null, "176", null, { orden, apagado: (k) => !sel.has(k), alTocar: alternar });
  $("#pactos-frase").replaceChildren(...(sel.size ? [el("b", {}, `Suman ${suma}.`), suma > 176 ? ` Pasan la raya, les sobran ${suma - 176}.` : suma === 176 ? " Justo los que hacen falta." : ` Les faltan ${176 - suma} para llegar a 176.`] : ["Todavía no has elegido ninguno."]));
  $("#pactos").replaceChildren(...ordenar(tot).filter((k) => tot[k] > 0).map((k) => el("button", { class: "pacto", type: "button", "aria-pressed": sel.has(k) ? "true" : "false", onclick: () => alternar(k) },
    el("i", { class: "punto", style: { background: color(k) } }), `${nombre(k)} ${tot[k]}`)),
    sel.size ? el("button", { class: "pacto limpiar", type: "button", onclick: () => { sel.clear(); pintarPactos(); } }, "Quitar todos") : null);
}
function recalcularSim() {
  const proy = Modelo.proyectar(sim.valores, D.base, { fusiones: sim.fusiones });
  sim.ultimaProy = proy;
  pintarHemiSim();
  pintarLey(Modelo.fundir(sim.valores, sim.fusiones), proy.total, proy.provincias);
  pintarPactos();
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
  let cd = 0, ci = 0; const sd = [], si = [];
  const claves = Object.keys(sim.valores).filter((k) => sim.valores[k] > 0);
  const R = P.ruido || { comunidad: 0.173, provincia: 0.085 }, est = new Set(D.base.estatales || []);
  const ccaas = [...new Set(D.base.provincias.map((p) => p.ccaa))], peso = D.base.provincias.map((p) => Math.max(p.escanos - 2, 0.3));
  const lnc = (sd) => Math.exp(sd * rn() - sd * sd / 2);
  for (let i = 0; i < N; i++) {
    const z = { d: rn(), i: rn(), t: rn() }, zt = rn(), m = {};
    for (const k of claves) { const b = bloque(k); m[k] = Math.max(0, sim.valores[k] + (P.sigmas[k] || 0.06 * sim.valores[k]) * (0.55 * z[b] + 0.835 * rn() + 0.35 * (b === "d" ? 1 : b === "i" ? -1 : 0) * zt)); }
    const gr = Modelo.grupos(m, D.base), fc = {};
    for (const k of claves) { fc[k] = {}; for (const c of ccaas) fc[k][c] = est.has(k) ? lnc(R.comunidad) : 1; }
    const brutas = D.base.provincias.map((p) => Modelo.proyectarProvincia(p, m, D.base, gr));
    const ruid = brutas.map((cu, j) => { const o = {}; for (const [k, v] of Object.entries(cu)) o[k] = v * (fc[k] ? fc[k][D.base.provincias[j].ccaa] : 1) * lnc(R.provincia); return o; });
    for (const k of claves) if (est.has(k)) { let a = 0, d = 0; brutas.forEach((cu, j) => { a += (cu[k] || 0) * peso[j]; d += (ruid[j][k] || 0) * peso[j]; }); if (d > 0) for (const cu of ruid) if (cu[k] != null) cu[k] *= a / d; }
    const t = {};
    D.base.provincias.forEach((p, j) => { for (const [k, n] of Object.entries(Modelo.dhondt(Modelo.fundir(ruid[j], sim.fusiones), p.escanos).escanos)) t[k] = (t[k] || 0) + n; });
    const td = der.partidos.reduce((a, k) => a + (t[k] || 0), 0), ti = izq.partidos.reduce((a, k) => a + (t[k] || 0), 0);
    sd.push(td); si.push(ti); if (td >= 176) cd++; if (ti >= 176) ci++;
  }
  sd.sort((a, b) => a - b); si.sort((a, b) => a - b);
  // Sin tocar nada es la misma situación que en Hoy, así que se enseñan los mismos números que allí y no otra tirada de dados
  const intacto = !$("#incluir-cis")?.checked && !sim.fusiones.length && Object.keys(sim.valores).every((k) => Math.abs((sim.valores[k] || 0) - (sim.base[k] ?? -9)) < 1e-9);
  const pd = intacto ? der.p : cd / N, pi = intacto ? izq.p : ci / N, pb = intacto ? P.bloqueo : Math.max(0, 1 - pd - pi);
  const rd = intacto ? [der.p10, der.p90] : [sd[Math.floor(N * .1)], sd[Math.floor(N * .9)]], ri = intacto ? [izq.p10, izq.p90] : [si[Math.floor(N * .1)], si[Math.floor(N * .9)]];
  const nd = nombreEsc(der), ni = nombreEsc(izq);
  $("#r-sim").replaceChildren(el("b", {}, pd >= 0.6 ? `${cap(palabra(pd))}, ${nd}.` : pi >= 0.6 ? `${cap(palabra(pi))}, ${ni}.` : "Nadie tiene la mayoría clara."),
    pd >= 0.6 ? ` Para ${ni}, ${palabra(pi)}.` : pi >= 0.6 ? ` Para ${nd}, ${palabra(pd)}.` : ` Para ${nd}, ${palabra(pd)}. Para ${ni}, ${palabra(pi)}.`, ` Que nadie sume, ${palabra(pb)}.`);
  const tot = sim.ultimaProy.total, suma = (e) => e.partidos.reduce((a, k) => a + (tot[k] || 0), 0);
  const op3 = (e, col, pr, r) => ({ id: e.id, titulo: cap(nombreEsc(e)), p: pr, color: col, partidos: e.partidos, central: suma(e), p10: Math.min(r[0], suma(e)), p90: Math.max(r[1], suma(e)), verbo: e.partidos.length > 1 ? "sumarían" : "sacaría", plural: e.partidos.length > 1, con: intacto ? null : "Con estos votos" });
  const ops = [op3(der, color("PP"), pd, rd), { id: "nadie", titulo: "Nadie suma", p: pb, color: "#8A93A3" }, op3(izq, color("PSOE"), pi, ri)];
  const pinta = () => medidores($("#sim-medidores"), $("#sim-medidor-detalle"), ops, sim.med, (id) => { sim.med = id; pinta(); pintarHemiSim(); });
  pinta();
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
  const li = (arr) => arr?.length ? el("div", { class: "titulares" }, ...arr.map((n) => noticia(n, { sinPartido: true }))) : el("p", { class: "vacio" }, "Sin titulares recientes.");
  $("#fichas-partidos").replaceChildren(...o.map((k) => el("article", { class: "ficha-p", style: { "--c": color(k) } }, el("h3", {}, `${nombre(k)}, ${fmt1.format(m.media[k])} % de los votos`),
    li(D.noticias?.partidos?.[k]?.slice(0, 3)), D.noticias?.verificaciones?.[k]?.length ? [el("h4", {}, "Verificado por Newtral y Maldita"), li(D.noticias.verificaciones[k].slice(0, 2))] : null)));
}

/* ---------- Senado ---------- */
const senado = { sel: null, prov: null, hemi: null };
function pintarSenado(proy) {
  // Los senadores de hoy salen del mismo reparto por provincias que el mapa. Las simulaciones ponen la probabilidad y el margen.
  const M = 105, tot = {}, porProv = {};
  for (const p of proy.provincias) { const r = Modelo.senadoProvincia(p.cuotas, p.nombre); porProv[p.nombre] = r; for (const [k, n] of Object.entries(r)) tot[k] = (tot[k] || 0) + n; }
  const S = D.prob?.senado, o = ordenar(tot), k1 = o[0], k2 = o[1];
  if (!k1) return;
  const X = tot[k1], p1 = S?.[k1]?.p_mayoria, t = p1 == null ? -1 : tramo(p1);
  $("#r-senado").replaceChildren(el("b", {}, t >= 3 ? `${cap(palabra(p1))}, mayoría absoluta ${deP(k1)}.` : t === 2 ? "En el aire." : t >= 0 ? "Nadie tiene asegurada la mayoría del Senado." : `${cap(elP(k1))}, el que más senadores sacaría.`),
    ` Con las encuestas de hoy ${elP(k1)} sacaría ${X} de los 208 senadores que se eligen, ${X > M ? `${X - M} más de los ${M} que hacen falta` : X === M ? `justo los ${M} que hacen falta` : `${M - X} menos de los ${M} que hacen falta`}.`, k2 ? ` ${cap(elP(k2))} sacaría ${tot[k2]}.` : "");
  const op = (k) => ({ id: k, titulo: `Mayoría ${deP(k)}`, arco: nombre(k), p: S[k]?.p_mayoria || 0, color: color(k), partidos: [k], central: tot[k], p10: Math.min(S[k]?.p10 ?? tot[k], tot[k]), p90: Math.max(S[k]?.p90 ?? tot[k], tot[k]), verbo: "sacaría", plural: false, mayoria: M, unidad: "senadores" });
  const ops = S ? [op(k1), { id: "nadie", titulo: "Nadie con mayoría", p: Math.max(0, 1 - Object.values(S).reduce((a, v) => a + (v.p_mayoria || 0), 0)), color: "#8A93A3", texto: `Pasa cuando ningún partido llega solo a ${M} senadores. Tendrían que ponerse de acuerdo varios para sacar adelante las votaciones.` }, ...(k2 ? [op(k2)] : [])] : [];
  const pinta = () => {
    const sel = ops.find((x) => x.id === senado.sel && x.partidos) || (senado.sel === "nadie" ? null : (ops[0] || { partidos: [k1], color: color(k1), arco: nombre(k1), central: X, mayoria: M, unidad: "senadores" }));
    const tocar = (k) => { senado.hemi = k && k !== senado.hemi && tot[k] ? k : null; pinta(); };
    hemiciclo($("#sen-hemiciclo"), tot, 8, sel ? { partidos: sel.partidos, color: sel.color } : null, String(M), null, { marcado: senado.hemi, alTocar: tocar });
    fraseArco($("#sen-hemi-arco"), sel);
    leyenda($("#sen-leyenda"), tot, null, tocar, senado.hemi);
    const kh = senado.hemi;
    fichaHemi($("#sen-hemi-ficha"), kh, kh ? `${tot[kh]} ${tot[kh] === 1 ? "senador" : "senadores"} con las encuestas de hoy.${S?.[kh] ? ` Lo normal es que acabe entre ${Math.min(S[kh].p10, tot[kh])} y ${Math.max(S[kh].p90, tot[kh])}.` : ""}` : "", () => tocar(null));
    if (ops.length) medidores($("#sen-medidores"), $("#sen-medidor-detalle"), ops, senado.sel, (id) => { senado.sel = id; pinta(); });
    else { $("#sen-medidores").replaceChildren(); $("#sen-medidor-detalle").replaceChildren(); }
  };
  pinta();
  const max = Math.max(...o.map((k) => tot[k]));
  $("#g-senado").replaceChildren(...o.map((k) => el("div", { class: "bg" }, el("div", { class: "nom" }, el("i", { class: "punto", style: { background: color(k) } }), nombre(k)),
    el("div", { class: "num" }, tot[k], el("small", {}, S?.[k] ? ` senadores, lo normal entre ${Math.min(S[k].p10, tot[k])} y ${Math.max(S[k].p90, tot[k])}` : " senadores")), el("div", { class: "pista" }, el("i", { style: { width: `${tot[k] / max * 100}%`, background: color(k) } })))));
  // Mapa: el color es el del partido más votado de la provincia, que es quien se lleva casi todos sus senadores
  if (senado.prov == null) senado.prov = mapa.sel;
  const pintaMapa = () => {
    $("#sen-mapa").innerHTML = dibujarMapa(proy, { vista: "ganador", sel: senado.prov || "", colorear: (p) => { const r = porProv[p.nombre], g = ordenar(r)[0]; return { fill: g ? color(g) : "var(--linea)", op: 1, txt: "#fff", etiqueta: String(Object.values(r).reduce((a, b) => a + b, 0)) }; } });
    $("#sen-mapa").querySelectorAll("g.prov").forEach((g) => g.addEventListener("click", () => { senado.prov = g.dataset.p; pintaMapa(); }));
    const r = porProv[senado.prov], q = r ? ordenar(r) : [];
    $("#sen-ficha").replaceChildren(...(r ? [el("div", { class: "ficha" }, el("h3", {}, `${senado.prov}, ${Object.values(r).reduce((a, b) => a + b, 0)} senadores`),
      el("div", { class: "chips" }, ...q.map((k) => el("span", { class: "chip", style: { background: color(k) } }, `${nombre(k)} ${r[k]}`))),
      el("p", {}, `${cap(elP(q[0]))} sería el partido más votado y se llevaría ${r[q[0]]}${q[1] ? `. ${cap(elP(q[1]))} sería el segundo y se llevaría ${r[q[1]]}` : ""}.`))] : []));
  };
  pintaMapa();
}

/* ---------- Modo partido: se elige uno y cada pestaña abre con su ficha ---------- */
const foco = { k: null, ctx: null };
let graficoFoco;
try { foco.k = localStorage.getItem("partido") || null; } catch {}
function elegirFoco(k) { foco.k = k; try { if (k) localStorage.setItem("partido", k); else localStorage.removeItem("partido"); } catch {} pintarFoco(); }
const agujaFija = (titulo, p, col) => el("div", { class: "medidor-a fijo" }, el("span", { class: "tit" }, titulo), el("span", { class: "svg", html: aguja(p, col) }), el("b", {}, cap(palabra(p))));
const ORDINAL = ["", "primero", "segundo", "tercero", "cuarto", "quinto", "sexto", "séptimo", "octavo", "noveno", "décimo"];
function pintarFoco(ctx) {
  if (ctx) foco.ctx = ctx;
  if (!foco.ctx) return;
  const { m, m7, proy } = foco.ctx, P = D.prob;
  const partidos = ordenar(m.media).filter((x) => D.config.partidos[x] && (m.media[x] >= 0.8 || (proy.total[x] || 0) > 0));
  if (foco.k && !partidos.includes(foco.k)) foco.k = null;
  const k = foco.k;
  $("#foco-tira").replaceChildren(el("span", { class: "eti" }, k ? `Toda la app, centrada en ${nombre(k)}` : "Céntrate en un partido"),
    el("div", { class: "fila" }, el("button", { type: "button", "aria-pressed": k ? "false" : "true", onclick: () => elegirFoco(null) }, "Todos"),
      ...partidos.map((x) => el("button", { type: "button", "data-k": x, "aria-pressed": k === x ? "true" : "false", style: k === x ? { background: color(x), borderColor: color(x), color: "#fff" } : null, onclick: () => elegirFoco(k === x ? null : x) },
        el("i", { class: "punto", style: { background: k === x ? "#fff" : color(x) } }), nombre(x)))));
  const caja = (id) => $(`#foco-${id}`);
  for (const id of ["hoy", "mapa", "encuestas", "senado", "simulador", "noticias"]) caja(id).replaceChildren();
  graficoFoco?.destroy(); graficoFoco = null;
  if (!k) return;
  const col = color(k), art = (titulo, ...hijos) => el("article", { class: "pregunta foco", style: { "--c": col } }, el("h2", {}, titulo), ...hijos);
  const X = proy.total[k] || 0, pp = P?.partidos?.[k], pos = ordenar(m.media).indexOf(k) + 1, d = m7.media[k] != null ? m.media[k] - m7.media[k] : 0;
  const der = escenario(D.config.principales.derecha), izq = escenario(D.config.principales.izquierda);

  // Hoy
  const hemi = el("div", { class: "hemi" });
  hemiciclo(hemi, proy.total, 10, null, "176", k);
  const a23 = D.base.escanos_reales?.[k], ag = [];
  if (pp && (pp.p_primero >= 0.005 || pos <= 2)) ag.push(agujaFija("Ser el más votado", pp.p_primero, col));
  if (pp && (pp.p_mayoria >= 0.001 || pos <= 2)) ag.push(agujaFija("Mayoría absoluta sin nadie más", pp.p_mayoria, col));
  for (const e of [der, izq]) if (e && e.partidos.length > 1 && e.partidos.includes(k)) ag.push(agujaFija(`Mayoría de ${nombreEsc(e)}`, e.p, col));
  if (pp && pp.p10 === 0 && pp.histograma) { const tot = Object.values(pp.histograma).reduce((a, b) => a + b, 0); if (tot) ag.push(agujaFija("Entrar en el Congreso", 1 - (pp.histograma[0] || 0) / tot, col)); }
  caja("hoy").append(art(`${nombre(k)}, de un vistazo`,
    el("p", { class: "respuesta" }, el("b", {}, `${fmt1.format(m.media[k])} % de los votos.`), ` Es el ${ORDINAL[pos] || `número ${pos}`} en la media de encuestas y ${Math.abs(d) >= 0.2 ? `${d > 0 ? "sube" : "baja"} ${fmt1.format(Math.abs(d))} puntos esta semana` : "está igual que la semana pasada"}.`),
    hemi,
    el("p", { class: "arco-txt" }, el("i", { style: { background: col } }), `${nombre(k)}, ${X} de 350 asientos`),
    el("p", { class: "pie-bloque" }, `Con las encuestas de hoy ${X ? `sacaría ${X} ${X === 1 ? "asiento" : "asientos"}` : "no sacaría ningún asiento"}${a23 != null ? (X === a23 ? ", los mismos que en 2023" : `, ${Math.abs(X - a23)} ${X > a23 ? "más" : "menos"} que en 2023`) : ""}.${pp ? ` Como las encuestas fallan, lo normal es que acabe entre ${Math.min(pp.p10, X)} y ${Math.max(pp.p90, X)}.` : ""}`),
    ag.length ? el("div", { class: "medidores" }, ...ag) : null));

  // Provincias
  const con = proy.provincias.filter((p) => p.escanos[k]), maxS = Math.max(1, ...con.map((p) => p.escanos[k]));
  const rel = (p) => Math.max(p.aspirante.falta, 0) / (10 / (p.n + 1)), votos = (p) => votosDe(Math.max(p.aspirante.falta, 0), p.n);
  const defiende = proy.provincias.filter((p) => p.aspirante && p.ultimo?.p === k).sort((a, b) => rel(a) - rel(b)).slice(0, 4);
  const persigue = proy.provincias.filter((p) => p.aspirante?.p === k).sort((a, b) => rel(a) - rel(b)).slice(0, 4);
  const irA = (n) => { mapa.sel = n; try { localStorage.setItem("mi-provincia", n); } catch {} pintarMapa(mapa.proy); $("#ficha-provincia").scrollIntoView({ behavior: "smooth", block: "center" }); };
  const filaProv = (p, texto) => el("button", { class: "ajustada", type: "button", onclick: () => irA(p.nombre) }, el("b", {}, p.nombre), el("span", { class: "m" }, texto));
  const mapaK = el("div", { class: "mapa" });
  mapaK.innerHTML = dibujarMapa(proy, { vista: "ganador", sel: "", colorear: (p) => { const n = p.escanos[k] || 0; return { fill: n ? col : "var(--linea)", op: n ? 0.35 + 0.65 * Math.sqrt(n / maxS) : 0.45, txt: "#fff", etiqueta: n ? String(n) : "" }; } });
  mapaK.querySelectorAll("g.prov").forEach((g) => g.addEventListener("click", () => irA(g.dataset.p)));
  const top = [...con].sort((a, b) => b.escanos[k] - a.escanos[k]).slice(0, 3);
  caja("mapa").append(art(`${nombre(k)}, provincia a provincia`,
    el("p", { class: "respuesta" }, con.length ? `${cap(elP(k))} sacaría asiento en ${con.length} de las ${proy.provincias.length} circunscripciones. Donde más, ${lista(top.map((p) => `${p.nombre} con ${p.escanos[k]}`))}.` : `Con las encuestas de hoy ${elP(k)} no sacaría asiento en ninguna provincia.`),
    mapaK, el("p", { class: "pie-bloque" }, "El número es los asientos que sacaría en cada provincia. Cuanto más intenso el color, más asientos. Toca una para ver su reparto completo."),
    defiende.length ? el("h3", {}, "Asientos que puede perder") : null, defiende.length ? el("div", { class: "ajustadas" }, ...defiende.map((p) => filaProv(p, `Tiene el último asiento y ${elP(p.aspirante.p)} se lo quitaría ${votos(p) < 100 ? "con muy pocos votos" : `con unos ${fmt0.format(votos(p))} votos más`}.`))) : null,
    persigue.length ? el("h3", {}, "Asientos que puede ganar") : null, persigue.length ? el("div", { class: "ajustadas" }, ...persigue.map((p) => filaProv(p, `Le faltan ${votos(p) < 100 ? "muy pocos votos" : `unos ${fmt0.format(votos(p))} votos`} para quitarle el último asiento ${aP(p.ultimo.p)}.`))) : null));

  // Encuestas
  const emp = m.usadas.filter((e) => e.pct[k] != null).sort((a, b) => b.pct[k] - a.pct[k]);
  caja("encuestas").append(art(`${nombre(k)} en las encuestas`,
    el("p", { class: "respuesta" }, emp.length > 1 ? `La media le da el ${fmt1.format(m.media[k])} %. La encuesta que más le da es la de ${emp[0].empresa_base}, con el ${fmt1.format(emp[0].pct[k])} %, y la que menos la de ${emp[emp.length - 1].empresa_base}, con el ${fmt1.format(emp[emp.length - 1].pct[k])} %.` : `La media le da el ${fmt1.format(m.media[k])} %.`),
    el("p", { class: "pie-bloque" }, "Su media de encuestas en el último año."),
    el("div", { class: "grafico grafico-bajo" }, el("canvas", { id: "grafico-foco", "aria-label": `Evolución de ${nombre(k)}` })),
    emp.length ? el("details", { class: "como" }, el("summary", {}, "Empresa por empresa"),
      ...emp.map((e) => { const sg = D.analisis?.sesgos?.[e.clave]?.sesgo?.[k];
        return el("div", { class: "fila-foco" }, el("span", {}, e.empresa_base, el("small", {}, ` ${fFecha.format(fechaD(e.fin))}`)), el("b", {}, `${fmt1.format(e.pct[k])} %`), el("small", { class: "nota-sesgo" }, sg != null && Math.abs(sg) >= 0.3 ? `suele darle ${signo(sg)}` : "")); }),
      el("p", { class: "fuente" }, "Son las encuestas que cuentan hoy en la media. \"Suele darle\" es lo que esa empresa se separa de la media con este partido.")) : null));

  // Senado
  const sen = {}, primeras = [], segundas = [];
  for (const p of proy.provincias) { const r = Modelo.senadoProvincia(p.cuotas, p.nombre), o = ordenar(r); for (const [x, n] of Object.entries(r)) sen[x] = (sen[x] || 0) + n; if (o[0] === k) primeras.push(p.nombre); else if (r[k]) segundas.push(p.nombre); }
  const XS = sen[k] || 0, S = P?.senado?.[k];
  caja("senado").append(art(`${nombre(k)} en el Senado`,
    el("p", { class: "respuesta" }, XS ? `${cap(elP(k))} sacaría ${XS} de los 208 senadores que se eligen${S ? `, y lo normal es que acabe entre ${Math.min(S.p10, XS)} y ${Math.max(S.p90, XS)}` : ""}. Sería el partido más votado en ${primeras.length} ${primeras.length === 1 ? "provincia" : "provincias"}${primeras.length && primeras.length <= 6 ? ` (${lista(primeras)})` : ""} y el segundo en ${segundas.length}.` : `Con las encuestas de hoy ${elP(k)} no sacaría senadores. Para sacarlos hay que ser el primero o el segundo partido de una provincia.`),
    S && S.p_mayoria >= 0.001 ? el("div", { class: "medidores" }, agujaFija("Mayoría absoluta en el Senado", S.p_mayoria, col)) : null));

  // ¿Y si…?
  const sits = situaciones(m.media).filter((x) => x.id !== "media");
  caja("simulador").append(art(`¿Qué le pasaría ${aP(k)}?`,
    el("p", { class: "pie-bloque" }, `Hoy ${X ? `sacaría ${X} ${X === 1 ? "asiento" : "asientos"}` : "no sacaría ningún asiento"}. Así cambiaría en cada situación.`),
    ...sits.map((x) => { const n = Modelo.proyectar(x.f({ ...m.media }), D.base).total[k] || 0, dif = n - X;
      return el("div", { class: "fila-foco" }, el("span", {}, x.titulo), el("b", {}, n), el("small", { class: dif > 0 ? "sube" : dif < 0 ? "baja" : "" }, dif ? `${dif > 0 ? "+" : "−"}${Math.abs(dif)}` : "igual")); })));

  // Noticias
  const N = D.noticias || {}, tit = (n) => noticia(n, { sinPartido: true });
  const suyas = (N.partidos?.[k] || []).slice(0, 5), pol = (N.polemicas || []).filter((n) => n.partido === k).slice(0, 3), ver = (N.verificaciones?.[k] || []).slice(0, 3);
  caja("noticias").append(art(`${nombre(k)} en las noticias`,
    ...(suyas.length ? suyas.map(tit) : [el("p", { class: "vacio" }, "Sin titulares recientes.")]),
    pol.length ? el("h3", {}, "Polémicas") : null, ...pol.map(tit),
    ver.length ? el("h3", {}, "Verificado por Newtral y Maldita") : null, ...ver.map(tit)));

  pintarGraficoFoco();
}
function pintarGraficoFoco() {
  const k = foco.k, lienzo = $("#grafico-foco");
  if (!k || !lienzo || $("#encuestas").hidden || graficoFoco) return;
  const puntos = [];
  for (let t = new Date(+hoy() - 365 * DIA); t <= hoy(); t = new Date(+t + 3 * DIA)) puntos.push(t);
  if (puntos[puntos.length - 1] < hoy()) puntos.push(hoy());
  const op = opciones(" %");
  graficoFoco = new Chart(lienzo, { type: "line", data: { labels: puntos.map(etiquetaFecha), datasets: [{ label: nombre(k), data: puntos.map((t) => { const v = calcMedia(t).media[k]; return v != null ? +v.toFixed(2) : null; }), borderColor: color(k), backgroundColor: color(k), borderWidth: 3, pointRadius: 0, tension: .3, spanGaps: true }] },
    options: { ...op, plugins: { ...op.plugins, legend: { display: false } }, scales: { ...op.scales, y: { ...op.scales.y, beginAtZero: false, ticks: { ...op.scales.y.ticks, callback: (v) => `${fmt1.format(v)} %` } } } } });
}

/* ---------- Arranque ---------- */
let proyActual, diaPintado = null;
function pintarTodo(opciones) {
  const m = calcMedia(), m7 = calcMedia(new Date(+hoy() - 7 * DIA));
  const sinDatos = !Object.keys(m.media).length;
  if (sinDatos) m.media = Modelo.mediaDesdeBase(D.base);
  const proy = Modelo.proyectar(m.media, D.base);
  proyActual = proy;
  diaPintado = diaMadrid();
  pintarHoy(m, m7, proy);
  pintarEncuestas(m, m7, proy);
  pintarMapa(proy);
  pintarSenado(proy);
  // En un refresco automático no se le deshace a nadie la situación que esté probando en ¿Y si…?
  const probando = sim.base && (sim.situacion !== "media" || Object.keys(sim.valores).some((k) => Math.abs((sim.valores[k] || 0) - (sim.base[k] || 0)) > 1e-9));
  if (!(opciones?.conservarSim && probando)) pintarSimulador(m, proy);
  pintarFiabilidad();
  pintarPorra(proy);
  pintarPartidos(m, proy);
  pintarFoco({ m, m7, proy });
  pintarMetodo(m);
}

/* ---------- Metodología: las cifras del texto salen de los datos del día, no están escritas a mano ---------- */
function pintarMetodo(m) {
  const E = D.encuestas?.encuestas || [], P = D.prob;
  if (E.length) {
    const empresas = new Set(E.filter((e) => !Media.esDePartido(e)).map((e) => e.clave)).size, ult = E.reduce((a, e) => (e.fin > a ? e.fin : a), "");
    $("#met-resumen").textContent = `Ahora mismo hay cargadas ${fmt0.format(E.length)} encuestas de ${empresas} empresas, todas las publicadas desde las elecciones de julio de 2023. La más reciente terminó de preguntar el ${fFecha.format(fechaD(ult))}. La media de hoy sale de ${m.usadas.length} de ellas.`;
    if (D.encuestas.fuente) $("#met-wiki").href = D.encuestas.fuente;
  }
  // Los periódicos que de verdad han respondido en la última actualización, por grupos
  const medios = D.noticias?.medios?.length ? D.noticias.medios : [], G = D.config.grupos_medios || {};
  if (medios.length) {
    const porGrupo = Object.keys(G).map((g) => [G[g], medios.filter((x) => x.grupo === g).map((x) => x.nombre)]).filter(([, v]) => v.length);
    $("#met-medios").textContent = `${medios.length} periódicos y medios, repartidos en ${porGrupo.length} grupos según su línea editorial más habitual. ${porGrupo.map(([n, v]) => `${cap(n)}, ${lista(v)}`).join(". ")}`;
  }
  $("#met-ventana").textContent = m.fase === "precampaña" ? `Ahora cuentan las de los últimos ${m.ventana} días. En campaña serán 28 y la última semana 20, para que los cambios se noten antes.` : `Ahora, en ${m.fase}, cuentan las de los últimos ${m.ventana} días.`;
  $("#met-mitad").textContent = `ahora una de hace unos ${Math.round(m.mitad)} días pesa la mitad que una de hoy`;
  const cal = P?.calibracion;
  if (cal) {
    const tres = ["PP", "PSOE", "Vox"].filter((k) => cal[k]?.rms);
    $("#met-error").textContent = tres.length ? `A seis días de votar, la media de encuestas de 2016, 2019 y 2023 se desvió del resultado, de media, unos ${lista(tres.map((k) => `${fmt1.format(cal[k].rms)} puntos con ${elP(k)}`))}.` : "";
    const ft = Object.values(cal)[0]?.factor_tiempo;
    $("#met-tiempo").textContent = ft && P.dias_para_votar > 6 ? `Hoy faltan ${P.dias_para_votar} días, y a esa distancia las encuestas fallan ${fmt1.format(ft)} veces más que en la última semana. Por eso las franjas son ahora anchas y se irán estrechando.` : "";
  }
  $("#met-media-hoy").innerHTML = $("#media-hoy").innerHTML;
  $("#met-backtest").innerHTML = $("#backtest").innerHTML || "<p>La prueba con las elecciones de 2023 se calcula en la próxima actualización.</p>";
}

/* Arriba a la derecha, en todas las pestañas: los días que faltan y la hora de la última actualización de datos.
   Se repinta cada minuto para que cambie sola a medianoche y cuando entran datos nuevos. */
function pintarCabecera() {
  if (!D.config) return;
  const dias = Math.round((fechaD(D.config.eleccion.fecha) - hoy()) / DIA);
  $("#cuenta").innerHTML = dias > 1 ? `faltan <strong>${dias} días</strong>` : dias === 1 ? "se vota <strong>mañana</strong>" : dias === 0 ? "se vota <strong>hoy</strong>" : "elecciones celebradas";
  const act = [D.encuestas?.actualizado, D.noticias?.actualizado].filter(Boolean).sort().pop();
  if (!act) { $("#cuenta-act").textContent = ""; return; }
  const d = new Date(act), hace_dias = Math.round((fechaD(diaMadrid()) - fechaD(diaMadrid(d))) / DIA);
  $("#cuenta-act").textContent = `actualizado ${hace_dias <= 0 ? "a las" : hace_dias === 1 ? "ayer a las" : `el ${fFecha.format(d)} a las`} ${fHoraMadrid.format(d)}`;
  $("#actualizado").textContent = `Datos actualizados ${hace(act)}.`;
  const horas = (Date.now() - d) / 3600000;
  $("#aviso-datos").textContent = horas > 3 ? `Los datos tienen ${Math.round(horas)} horas. La actualización automática puede estar fallando, lo que ves es la última foto buena.` : "";
  $("#aviso-datos").hidden = !(horas > 3);
}

const NOMBRES = ["config", "base2023", "encuestas", "fiabilidad", "noticias", "porra", "agenda", "resultados", "probabilidades", "analisis", "probabilidades_historial", "mapa", "europeas2024"];
async function cargarDatos() {
  const datos = await Promise.all(NOMBRES.map(cargar));
  // Si falla la red en un refresco se conserva lo que ya había
  NOMBRES.forEach((n, i) => { const k = n === "base2023" ? "base" : n === "probabilidades" ? "prob" : n === "probabilidades_historial" ? "historial" : n; if (datos[i] != null || D[k] == null) D[k] = datos[i]; });
  if (D.europeas2024 && D.base) D.base.europeas = D.europeas2024;
}

/* ¿Ha publicado el robot datos nuevos? Se pregunta solo por la cabecera de dos ficheros, sin descargarlos. */
let firmaDatos = null, ultimaComprobacion = 0;
async function hayDatosNuevos() {
  ultimaComprobacion = Date.now();
  try {
    const rs = await Promise.all(["encuestas", "noticias"].map((n) => fetch(`data/${n}.json`, { method: "HEAD", cache: "no-store" })));
    const firma = rs.map((r) => r.ok ? (r.headers.get("etag") || r.headers.get("last-modified") || "") : "").join("|");
    if (firma === "|") return false;
    const cambio = firmaDatos != null && firma !== firmaDatos;
    firmaDatos = firma;
    return cambio;
  } catch { return false; }
}
async function refrescar() {
  if (document.hidden || !D.listo) return;
  if (Date.now() - ultimaComprobacion > 4.5 * 60000 && await hayDatosNuevos()) { await cargarDatos(); pintarTodo({ conservarSim: true }); }
  else if (diaMadrid() !== diaPintado) pintarTodo({ conservarSim: true });
  pintarCabecera();
}

(async function iniciar() {
  await cargarDatos();
  if (!D.config || !D.base) { $("#r-ganando").textContent = "No se han podido cargar los datos base."; return; }
  try { mapa.sel = localStorage.getItem("mi-provincia") || null; } catch {}
  $("#incluir-cis").addEventListener("change", pintarTodo);
  $("#compartir").addEventListener("click", compartir);
  pintarTodo();
  D.listo = true;
  pintarCabecera();
  activarPestana(location.hash.slice(1));
  hayDatosNuevos();
  setInterval(refrescar, 60000);
  document.addEventListener("visibilitychange", refrescar);
})();

/* ---------- Tarjeta para compartir ---------- */
async function compartir() {
  const P = D.prob, der = escenario(D.config.principales.derecha), izq = escenario(D.config.principales.izquierda);
  if (!P || !der || !izq) return;
  const c = document.createElement("canvas"); c.width = 1080; c.height = 1350;
  const g = c.getContext("2d");
  g.fillStyle = "#17202E"; g.fillRect(0, 0, 1080, 1350);
  g.fillStyle = "#fff"; g.font = "800 120px Archivo, Arial, sans-serif"; g.fillText("29N", 70, 170);
  g.font = "500 40px Archivo, Arial, sans-serif"; g.fillStyle = "#B8C0CC"; g.fillText(`Así está a ${new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "long" }).format(new Date())}`, 70, 240);
  g.fillStyle = "#fff"; g.font = "650 40px Archivo, Arial, sans-serif";
  const lineas = (t, x, y, w) => { const ws = t.split(" "); let l = "", yy = y; for (const w0 of ws) { const p = l ? l + " " + w0 : w0; if (g.measureText(p).width > w) { g.fillText(l, x, yy); l = w0; yy += 50; } else l = p; } g.fillText(l, x, yy); return yy; };
  let y = lineas($("#r-gobernar").textContent, 70, 330, 940) + 60;
  const segs = [[der.p, color("PP"), der.nombre], [P.bloqueo, "#8A93A3", "Nadie suma"], [izq.p, color("PSOE"), izq.nombre]];
  let x = 70; for (const [p, col] of segs) { const w = Math.max(p, .02) * 940; g.fillStyle = col; g.fillRect(x, y, w, 70); x += w; }
  y += 110; g.font = "500 34px Archivo, Arial, sans-serif";
  for (const [p, col, n] of segs) { g.fillStyle = col; g.fillRect(70, y - 26, 28, 28); g.fillStyle = "#fff"; g.fillText(`${n}, ${palabra(p)}`, 120, y); y += 46; }
  y += 30; g.fillStyle = "#B8C0CC"; g.font = "600 32px Archivo, Arial, sans-serif"; g.fillText("Asientos que podría sacar cada partido", 70, y); y += 30;
  const o = Object.keys(P.partidos).sort((a, b) => P.partidos[b].p50 - P.partidos[a].p50).slice(0, 6);
  for (const k of o) { if (y + 56 > 1180) break; const v = P.partidos[k]; y += 56; g.fillStyle = "#fff"; g.font = "650 32px Archivo, Arial, sans-serif"; g.fillText(nombre(k), 70, y);
    const x0 = 300, esc = 600 / 240; g.fillStyle = "#2B3543"; g.fillRect(x0, y - 24, 600, 22); g.fillStyle = color(k); g.globalAlpha = .55; g.fillRect(x0 + v.p10 * esc, y - 24, (v.p90 - v.p10) * esc, 22); g.globalAlpha = 1; g.fillRect(x0 + v.p50 * esc - 3, y - 28, 6, 30);
    g.fillStyle = "#D3A54E"; g.fillRect(x0 + 176 * esc - 1, y - 30, 2, 34); g.fillStyle = "#B8C0CC"; g.font = "500 26px Archivo, Arial, sans-serif"; g.fillText(`${v.p10} a ${v.p90}`, x0 + 615, y); }
  g.fillStyle = "#D3A54E"; g.font = "600 28px Archivo, Arial, sans-serif"; g.fillText("176, la mayoría", 300 + 176 * 600 / 240 - 120, y + 50);
  g.fillStyle = "#B8C0CC"; g.font = "500 28px Archivo, Arial, sans-serif"; g.fillText(location.href.replace(/[#?].*$/, ""), 70, 1290);
  const blob = await new Promise((r) => c.toBlob(r, "image/png"));
  const file = new File([blob], "29n.png", { type: "image/png" });
  if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], title: "29N" }); return; } catch {} }
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "29n.png"; a.click();
}
