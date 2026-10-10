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
/* Para meter un texto dentro de una cadena que se pinta como HTML o SVG. Un nombre de partido que no esté en la
   configuración sale tal cual viene de la tabla de encuestas, así que nunca se pega sin pasar por aquí. */
const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
/* Si la librería de gráficas no ha cargado, la gráfica se cambia por una línea que lo dice y todo lo demás sigue. */
function hayGraficas(lienzo) {
  if (typeof Chart !== "undefined") return true;
  const caja = lienzo?.parentElement;
  if (caja && !caja.querySelector(".sin-grafica")) { lienzo.hidden = true; caja.append(el("p", { class: "vacio sin-grafica" }, "La gráfica no se ha podido cargar. El resto funciona igual.")); }
  return false;
}
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
// La franja de una cifra, dicha con palabras. Cuando las dos puntas coinciden no se escribe «entre 0 y 0».
const entreDos = (a, b) => a === b ? `en ${a}` : `entre ${a} y ${b}`;
// Como replaceChildren, pero se salta los huecos. replaceChildren a secas escribe la palabra «null» en pantalla.
const poner = (cont, ...hijos) => cont.replaceChildren(...hijos.flat().filter((h) => h != null && h !== false));
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
/* Visitas. Las cuenta GoatCounter, que no usa cookies ni guarda datos personales. La entrada a la web la apunta su
   propio script. Aquí se apuntan además las pestañas que se abren y algunos usos (modo partido, caso propio, compartir,
   copiar un enlace y llegar con un enlace a un partido o a una provincia), una vez por visita. Si el contador no ha cargado todavía se guarda y se manda cuando cargue. Si está bloqueado, nada. */
const visitas = { hechas: new Set(), cola: [], inicio: true };
function contar(nombre) {
  if (visitas.hechas.has(nombre)) return;
  visitas.hechas.add(nombre);
  const enviar = () => { try { window.goatcounter.count({ path: nombre, title: nombre, event: true }); } catch {} };
  if (window.goatcounter?.count) enviar(); else visitas.cola.push(enviar);
}
/* Personas. Una «entrada» de GoatCounter no es una persona: el contador reconoce a cada visitante por su IP y su navegador
   durante 8 horas, así que quien vuelve por la tarde o cambia de red cuenta otra vez. Para contar personas de verdad la
   app guarda en el dispositivo dos fechas, la de la primera visita y la de la última, sin ningún identificador. Con ellas
   avisa al contador como mucho una vez al día: «Persona nueva» la primera vez y «Persona vuelve N» las siguientes, donde
   N son los días que hacía desde la visita anterior (de 1 a 7, y 7 quiere decir 7 o más). Con esos avisos el panel de
   visitas sabe cuántos dispositivos distintos entran cada día, en los últimos 7 días y en total, sin repetir a nadie.
   - «Persona de antes» es un dispositivo que ya había entrado antes de que existiera esta cuenta (versión 46). Se nota
     porque tiene guardada una versión anterior de la app, o un partido o una provincia elegidos.
   - «Persona sin memoria» es un navegador que no deja guardar nada (algunos modos privados). No se sabe si es nueva.
   - Las fechas solo se guardan cuando el aviso ha salido de verdad. Con el contador bloqueado no se guarda nada.
   - Estos avisos van con «no_session» para que el contador no junte dos dispositivos que comparten IP y modelo. */
const PERSONAS_VERSION = 46;
const habiaEstado = (async () => {
  try { if (["partido", "mi-provincia"].some((k) => localStorage.getItem(k) != null)) return true; } catch {}
  try { return (await caches.keys()).some((k) => { const m = /^29n-v(\d+)$/.exec(k); return m && +m[1] < PERSONAS_VERSION; }); } catch { return false; }
})();
function memoriaVale() { try { localStorage.setItem("prueba-memoria", "1"); const ok = localStorage.getItem("prueba-memoria") === "1"; localStorage.removeItem("prueba-memoria"); return ok; } catch { return false; } }
let personaEnCurso = false;
async function contarPersona() {
  const gc = window.goatcounter;
  if (personaEnCurso || !gc?.count || !gc.filter) return; // sin contador
  personaEnCurso = true;
  try {
    if (gc.filter()) return; // dispositivo que no se cuenta (el del autor, pruebas en local). Va dentro del try porque lee la memoria del navegador y puede estar prohibida
    const dia = diaMadrid();
    if (!memoriaVale()) {
      if (!visitas.hechas.has("Persona sin memoria")) { visitas.hechas.add("Persona sin memoria"); gc.count({ path: "Persona sin memoria", title: "Persona sin memoria", event: true }); }
      return;
    }
    const primera = localStorage.getItem("visto"), ultima = localStorage.getItem("visto-dia");
    if (primera && ultima === dia) return; // hoy ya está contado
    let nombre;
    if (!primera) nombre = (await habiaEstado) ? "Persona de antes" : "Persona nueva";
    else { const dias = /^\d{4}-\d\d-\d\d$/.test(ultima || "") ? Math.round((fechaD(dia) - fechaD(ultima)) / DIA) : 7; nombre = `Persona vuelve ${Math.max(1, Math.min(7, dias))}`; }
    gc.count({ path: nombre, title: nombre, event: true, no_session: true });
    if (!primera) localStorage.setItem("visto", dia);
    localStorage.setItem("visto-dia", dia);
  } catch {} finally { personaEnCurso = false; }
}
document.querySelector("script[data-goatcounter]")?.addEventListener("load", () => { visitas.cola.splice(0).forEach((f) => f()); contarPersona(); });
document.addEventListener("visibilitychange", () => { if (!document.hidden) contarPersona(); }); // por si la app sigue abierta al cambiar de día
contarPersona();
/* Fallos de programa en el dispositivo de un visitante. Sin esto, si la app se rompe en un móvil concreto no queda rastro
   en ningún sitio. Se apunta en el contador como un uso más, con la versión, el fichero y la línea, y el mensaje recortado.
   No lleva ningún dato de la persona. Como mucho 3 por carga, y solo los de los ficheros de la propia app. */
const VERSION_APP = (document.currentScript?.src.match(/[?&]v=(\d+)/) || [])[1] || "?";
let erroresApuntados = 0;
function apuntarError(mensaje, fichero, linea) {
  try {
    if (erroresApuntados >= 3) return;
    let donde = "";
    if (fichero) { const u = new URL(fichero, location.href); if (u.origin !== location.origin) return; donde = `${u.pathname.split("/").pop()}:${linea || 0} `; }
    const texto = String(mensaje || "sin mensaje").replace(/\s+/g, " ").slice(0, 90);
    erroresApuntados++;
    contar(`Error v${VERSION_APP} ${donde}${texto}`);
  } catch {}
}
addEventListener("error", (e) => { if (e.message) apuntarError(e.message, e.filename, e.lineno); });
addEventListener("unhandledrejection", (e) => apuntarError(`Promesa: ${e.reason?.message || e.reason}`, "", 0));
const NOMBRE_PESTANA = { hoy: "Hoy", mapa: "Provincias", encuestas: "Encuestas", senado: "Senado", simulador: "Y si", noticias: "Noticias", el29n: "29N", metodologia: "Metodología" };
let carrilVivo; // vuelve a medir las flechas de la fila de partidos
let pestanaActual = "hoy";
function activarPestana(id) {
  // «#no-contar» no es una pestaña: es la forma de pedir que este dispositivo no se cuente en las visitas
  if (id === "no-contar") { try { localStorage.setItem("skipgc", "t"); alert("Hecho. Este dispositivo ya no se cuenta en las visitas."); } catch { alert("Este navegador no deja guardarlo, así que no se ha podido."); } history.replaceState(null, "", location.pathname + location.search); id = "hoy"; }
  const ids = ["hoy", "mapa", "encuestas", "senado", "simulador", "noticias", "el29n", "metodologia"];
  if (!ids.includes(id)) id = "hoy";
  for (const i of ids) document.getElementById(i).hidden = i !== id;
  pestanaActual = id;
  document.querySelectorAll(".pestanas a").forEach((a) => a.classList.toggle("activa", a.dataset.tab === id));
  // Si la pestaña elegida vive dentro de «Más», se marca ese botón para que se sepa dónde se está. Y la hoja se cierra.
  $(".mas-boton")?.classList.toggle("activa", !!document.querySelector(`.mas-hoja a[data-tab="${id}"]`));
  cerrarMas();
  $("#foco-tira").hidden = id === "el29n" || id === "metodologia"; // ahí no hay nada propio de un partido
  carrilVivo?.();
  window.scrollTo({ top: 0 });
  if (id === "encuestas" && !graficoTendencia && D.listo) pintarTendencia();
  if (id === "metodologia" && VIS.clave && !VIS.datos) visActualizar();
  if (id === "encuestas" && D.listo) pintarGraficoFoco();
  // Entrar por la portada ya lo cuenta el contador. Se apunta la pestaña si se llega directo a otra o al cambiar.
  if (!(visitas.inicio && id === "hoy")) contar(`Pestaña ${NOMBRE_PESTANA[id]}`);
  visitas.inicio = false;
}
function cerrarMas() { $(".pestanas")?.classList.remove("abierta"); $(".mas-boton")?.setAttribute("aria-expanded", "false"); }
$(".mas-boton")?.addEventListener("click", (ev) => { ev.stopPropagation(); const abierta = $(".pestanas").classList.toggle("abierta"); $(".mas-boton").setAttribute("aria-expanded", abierta ? "true" : "false"); if (abierta) contar("Abre el menú Más"); });
// Tocar una pestaña de la hoja cierra la hoja aunque sea la que ya estaba abierta, y también tocar fuera o pulsar Escape
$(".mas-hoja")?.addEventListener("click", cerrarMas);
document.addEventListener("click", (ev) => { if (!ev.target.closest(".pestanas")) cerrarMas(); });
document.addEventListener("keydown", (ev) => { if (ev.key === "Escape") cerrarMas(); });
window.addEventListener("hashchange", () => activarPestana(location.hash.slice(1)));

/* ---------- Media ---------- */
/* Partidos que han anunciado que no se presentan (config.partidos[k].no_concurre). Salen de la media, del reparto y de
   todo lo que cuelga de ellos, aunque encuestas anteriores al anuncio los incluyan. Sus votos no se le dan a nadie. */
const noConcurren = () => Object.keys(D.config?.partidos || {}).filter((k) => D.config.partidos[k].no_concurre);
/* Avisos sobre un partido que conviene tener a la vista (config.partidos[k].aviso), por ejemplo un cambio de nombre
   anunciado que todavía no es oficial. Salen bajo la lista de partidos y en la ficha de ese partido. */
function notaAviso(k, attrs = { class: "explica nota-fuera", id: `aviso-${k}` }) {
  const x = D.config?.partidos?.[k]?.aviso;
  if (!x?.texto) return null;
  return el("p", attrs, el("b", {}, `${nombre(k)}. `), x.texto, x.fuente ? [" (", el("a", { href: x.fuente, target: "_blank", rel: "noopener" }, "fuente"), ")"] : null);
}
/* Enlaces directos. «?partido=sumar» abre la app centrada en ese partido y «?provincia=madrid» abre la ficha de esa
   provincia. Valen para esa visita y no se guardan en el dispositivo, así que no pisan lo que cada uno tuviera elegido.
   En cuanto la persona elige otro partido u otra provincia, el dato se quita de la dirección. */
const llano = (t) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const slug = (t) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const OTROS_NOMBRES = { coruna: "A Coruña", lacoruna: "A Coruña", araba: "Álava", vizcaya: "Bizkaia", guipuzcoa: "Gipuzkoa", gerona: "Girona", lerida: "Lleida", orense: "Ourense", illesbalears: "Baleares", islasbaleares: "Baleares", rioja: "La Rioja", palmas: "Las Palmas", tenerife: "Santa Cruz de Tenerife", alacant: "Alicante", castello: "Castellón" };
const enlace = { partido: false, provincia: false };
function leerEnlace() {
  let q; try { q = new URLSearchParams(location.search); } catch { return; }
  const p = llano(q.get("partido")), v = llano(q.get("provincia"));
  if (p) { const k = Object.keys(D.config.partidos).find((x) => !D.config.partidos[x].no_concurre && (llano(x) === p || llano(nombre(x)) === p));
    if (k) { foco.k = k; enlace.partido = true; contar("Llega con enlace a un partido"); } }
  if (v) { const n = D.base.provincias.map((x) => x.nombre).find((x) => llano(x) === v || x === OTROS_NOMBRES[v]);
    if (n) { mapa.sel = n; enlace.provincia = true; contar("Llega con enlace a una provincia"); } }
}
function quitarDelEnlace(clave) {
  try { const u = new URL(location.href); if (!u.searchParams.has(clave)) return; u.searchParams.delete(clave); history.replaceState(null, "", u.pathname + u.search + u.hash); } catch {}
}
function enlaceA({ partido, provincia, pestana }) {
  const base = document.querySelector('link[rel="canonical"]')?.href || location.origin + location.pathname;
  const q = [partido ? `partido=${slug(nombre(partido))}` : "", provincia ? `provincia=${slug(provincia)}` : ""].filter(Boolean).join("&");
  return base + (q ? `?${q}` : "") + (pestana && pestana !== "hoy" ? `#${pestana}` : "");
}
async function copiarEnlace(boton, url) {
  contar("Copia un enlace");
  let ok = false;
  try { await navigator.clipboard.writeText(url); ok = true; } catch {}
  if (!ok) { prompt("Copia este enlace", url); return; }
  const antes = boton.textContent;
  boton.textContent = "Enlace copiado"; boton.disabled = true;
  setTimeout(() => { boton.textContent = antes; boton.disabled = false; }, 2000);
}
const botonEnlace = (texto, url) => el("button", { type: "button", class: "copiar-enlace", onclick: (e) => copiarEnlace(e.currentTarget, url()) }, texto);
const notasAviso = () => Object.keys(D.config?.partidos || {}).map((k) => notaAviso(k)).filter(Boolean);
function notaNoConcurren() {
  const ks = noConcurren();
  if (!ks.length) return null;
  const f = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "long", timeZone: "UTC" });
  return el("p", { class: "explica nota-fuera" }, ...ks.flatMap((k, i) => { const x = D.config.partidos[k].no_concurre;
    return [i ? " " : null, el("b", {}, `${nombre(k)} no se presenta a estas elecciones.`), ` Lo anunció el ${f.format(fechaD(x.fecha))}`, x.fuente ? [" (", el("a", { href: x.fuente, target: "_blank", rel: "noopener" }, "fuente"), ")"] : null, "."]; }),
    ` Por eso no sale en la media ni en el reparto de asientos, aunque algunas encuestas de antes ${ks.length > 1 ? "los" : "la"} incluyan. Sus votos no se le suman a ningún otro partido, porque no hay dato de adónde irán. Las encuestas nuevas ya lo recogerán.`);
}
/* La media de un día, con la regla que tocaba ese día según lo que faltara para votar. La gráfica usa la misma. */
function calcMedia(fecha = hoy()) {
  const va = Media.ventanaAdaptativa(fecha, fechaD(D.config.eleccion.fecha));
  return { ...Media.calcMedia(D.encuestas?.encuestas || [], fecha, { ...va, ranking: D.fiabilidad?.ranking, sesgos: D.analisis?.sesgos, fuera: noConcurren() }), fase: va.fase, mitad: va.mitad };
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
    : [el("p", {}, `${o.texto || "Pasa cuando ninguno de los dos bloques llega a 176 asientos. Habría que negociar con otros partidos o repetir las elecciones."} Probabilidad, ${r100(o.p)} %.${o.despues ? ` ${o.despues}` : ""}`)])));
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
  const ICO = { urna: "M4 10h16v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1zM7 4h10l2 4H5zM9 13v2h6v-2z", congreso: "M12 3 2 10h3v9h14v-9h3zm-3 8h2v6H9zm4 0h2v6h-2z", encuesta: "M4 20V9h3v11zm6.5 0V4h3v16zM17 20v-6h3v6z", noticia: "M4 4h13a2 2 0 0 1 2 2v13H5a1 1 0 0 1-1-1zm2 3v2h9V7zm0 4v2h9v-2zm0 4v2h6v-2z", mapa: "M9 3 3 5.5v15L9 18l6 2.5 6-2.5v-15L15 6zM9 5.2v10.6l6 2.4V7.6z", calendario: "M7 2v2H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2V2h-2v2H9V2zM5 10h14v9H5z" };
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
  if (aire0) resumen.push(fila("mapa", `La provincia más reñida es ${aire0.nombre}. ${nombre(aire0.ultimo.p)} y ${nombre(aire0.aspirante.p)} se disputan el último asiento ${porVotos(Math.max(aire0.aspirante.falta, 0), aire0.n)}.`, "Ver el mapa", () => { quitarDelEnlace("provincia"); mapa.sel = aire0.nombre; mapa.vista = "filo"; document.querySelectorAll("#mapa .conmutador button").forEach((x) => x.setAttribute("aria-pressed", x.dataset.vista === "filo" ? "true" : "false")); pintarMapa(mapa.proy); location.hash = "#mapa"; }));
  const toca = pintarTareas();
  if (toca) resumen.push(fila("calendario", toca, "Ver qué te toca hacer y hasta cuándo", () => { location.hash = "#el29n"; }));
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
      fichaHemi($("#hemi-ficha"), k, k ? `${esc[k]} ${esc[k] === 1 ? "asiento" : "asientos"} con las encuestas de hoy${m.media[k] != null ? `, con el ${fmt1.format(m.media[k])} % de los votos` : ""}.${pk ? ` Lo normal es que acabe ${entreDos(Math.min(pk.p10, esc[k]), Math.max(pk.p90, esc[k]))}.` : ""}` : "", () => tocar(null));
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
      // El veredicto sale de lo que el modelo habría dicho la última semana, no de una frase fija
      const t6 = tramo(f6.escenarios.pp_vox.p), hubo = pv >= 176;
      const veredicto = t6 === 2 ? "Es decir, a una semana de votar no habría dado a nadie por ganador, y así de justo fue." : (t6 > 2) === hubo ? "Es decir, habría acertado de qué lado caía." : "Es decir, se habría equivocado de lado, pero dejando claro que no era seguro.";
      // Cuántas veces sacó el PSOE más voto del que le daba la media de encuestas, con las elecciones que hay medidas
      const ep = (P.calibracion?.PSOE?.errores_historicos || P.calibracion?.detalle?.PSOE?.errores_historicos || []), mas = ep.filter((x) => x > 0).length;
      const psoe = ep.length >= 3 && mas > ep.length / 2 ? ` En ${mas} de las ${ep.length} últimas elecciones el PSOE sacó más voto del que le daban las encuestas. El modelo no empuja a nadie por eso, deja el mismo margen de error hacia arriba que hacia abajo.` : "";
      $("#backtest").replaceChildren(el("p", {}, el("b", {}, "¿Y acierta esto? "), `Lo probamos con 2023. A ${f54.dias} días del 23J, con las encuestas de entonces, este modelo habría dicho que la mayoría de PP y Vox ${era(f54.escenarios.pp_vox.p)} (${r100(f54.escenarios.pp_vox.p)} %). A ${f6.dias} días, que ${era(f6.escenarios.pp_vox.p)} (${r100(f6.escenarios.pp_vox.p)} %). Se quedaron en ${pv} asientos, a ${176 - pv} de la mayoría. ${veredicto}${psoe}`)); }
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
  /* Lo siguiente es el hito más cercano que aún no ha pasado: algo que empieza o, en los plazos que lo tienen apuntado
     (fin_titulo), su último día. Antes se cogía el primer plazo abierto y se quedaba semanas clavado en el mismo. */
  const ag = D.agenda || [], h0 = hoy();
  const hitos = ag.flatMap((x) => [{ x, t: fechaD(x.fecha), titulo: x.titulo, empieza: true }, ...(x.fin && x.fin_titulo ? [{ x, t: fechaD(x.fin), titulo: x.fin_titulo }] : [])])
    .filter((y) => y.t >= h0 && y.x.fecha !== D.config.eleccion.fecha).sort((a, b) => a.t - b.t || (a.empieza ? 1 : -1));
  const hito = hitos[0], sig = hito?.x;
  const cuando = (y) => { const n = Math.round((y.t - h0) / DIA); return y.empieza && y.x.fin ? `del ${fFecha.format(y.t)} al ${fFecha.format(fechaD(y.x.fin))}${n === 0 ? ", empieza hoy" : n === 1 ? ", empieza mañana" : ""}` : n === 0 ? "hoy" : n === 1 ? "mañana" : `el ${fFechaLarga.format(y.t)}`; };
  const voto = dias > 1 ? `Se vota el domingo 29 de noviembre, dentro de ${dias} días.` : dias === 1 ? "Se vota mañana, domingo 29 de noviembre." : dias === 0 ? "Se vota hoy, domingo 29 de noviembre, de 9:00 a 20:00." : "Se votó el domingo 29 de noviembre.";
  $("#r-fechas").textContent = `${voto}${hito ? ` Lo siguiente en el calendario, ${hito.titulo.charAt(0).toLowerCase() + hito.titulo.slice(1)}, ${cuando(hito)}.` : ""}`;
  $("#agenda").replaceChildren(...ag.map((x) => { const fin = fechaD(x.fin || x.fecha);
    return el("li", { class: fin < hoy() ? "pasado" : x === sig ? "siguiente" : null }, el("span", { class: "dia" }, x.fin ? `${fFecha.format(fechaD(x.fecha))} al ${fFecha.format(fin)}` : fFecha.format(fechaD(x.fecha))), el("span", {}, x.titulo, x.detalle ? el("span", { class: "det" }, x.detalle) : null)); }));
}
/* ---------- Qué te toca hacer: los trámites del votante con sus plazos (config.tareas) ---------- */
const GRUPOS_TAREA = [["todos", "Para votar el 29"], ["correo", "Si vas a votar por correo"], ["fuera", "Si estás fuera de España"]];
const fMes = new Intl.DateTimeFormat("es-ES", { month: "long", timeZone: "UTC" });
const diaLargo = (t) => fFechaLarga.format(t).replace(",", "");
const minus = (t) => t.charAt(0).toLowerCase() + t.slice(1);
function listaTareas() {
  const h = hoy();
  return (D.config.tareas || []).map((t) => { const a = fechaD(t.desde), z = fechaD(t.hasta), faltan = Math.round((a - h) / DIA), quedan = Math.round((z - h) / DIA);
    return { ...t, a, z, faltan, quedan, unDia: t.desde === t.hasta, fase: quedan < 0 ? "pasada" : faltan > 0 ? "futura" : "abierta" }; });
}
/* Pinta el bloque de la pestaña 29N y devuelve la frase que va en el resumen de Hoy (o nada si ya no queda ningún trámite). */
function pintarTareas() {
  const T = listaTareas(), vivas = T.filter((t) => t.fase !== "pasada");
  $("#tareas-bloque").hidden = !vivas.length;
  if (!vivas.length) return null;
  const rango = (t) => t.unDia ? `el ${diaLargo(t.a)}` : fMes.format(t.a) === fMes.format(t.z) ? `del ${t.a.getUTCDate()} al ${t.z.getUTCDate()} de ${fMes.format(t.z)}` : `del ${t.a.getUTCDate()} de ${fMes.format(t.a)} al ${t.z.getUTCDate()} de ${fMes.format(t.z)}`;
  // Lo de todo el mundo manda en el titular. Si hay varias cosas abiertas, la que antes se acaba.
  const mias = T.filter((t) => t.grupo === "todos"), ahora = mias.filter((t) => t.fase === "abierta").sort((x, y) => x.z - y.z)[0], sig = mias.filter((t) => t.fase === "futura").sort((x, y) => x.a - y.a)[0];
  let toca;
  if (ahora?.unDia) toca = `Hoy toca ${minus(ahora.que)}, de 9:00 a 20:00.`;
  else if (ahora?.sin_plazo) toca = `Estos días toca ${minus(ahora.que)}.`;
  else if (ahora) toca = `Ahora toca ${minus(ahora.que)}. Hay hasta el ${diaLargo(ahora.z)}${ahora.quedan === 0 ? ", hoy es el último día" : ahora.quedan === 1 ? ", mañana es el último día" : `, quedan ${ahora.quedan} días`}.`;
  else if (sig) toca = `Lo siguiente que te toca es ${minus(sig.que)}, ${rango(sig)}${sig.faltan === 1 ? (sig.unDia ? ", mañana" : ", empieza mañana") : ""}.`;
  else toca = "Por tu parte ya está todo hecho.";
  // Los otros dos grupos solo suben al titular cuando a un plazo le quedan tres días o menos
  const ojo = T.filter((t) => t.grupo !== "todos" && t.fase === "abierta" && !t.sin_plazo && t.quedan <= 3).sort((x, y) => x.z - y.z)[0];
  const resto = ojo ? ` Ojo, ${ojo.quedan === 0 ? "hoy" : ojo.quedan === 1 ? "mañana" : `el ${diaLargo(ojo.z)}`} es el último día para ${minus(ojo.que)}.` : " Si votas por correo o estás fuera de España, tus plazos van más abajo.";
  $("#r-tareas").textContent = toca + resto;
  const estado = (t) => t.fase === "pasada" ? (t.unDia ? "Ya pasó" : t.sin_plazo ? "Ya pasó" : "Plazo cerrado")
    : t.fase === "futura" ? (t.faltan === 1 ? (t.unDia ? "Mañana" : "Empieza mañana") : `Dentro de ${t.faltan} días`)
    : t.unDia ? "Hoy" : t.sin_plazo ? "Estos días" : t.quedan === 0 ? "Último día" : t.quedan === 1 ? "Termina mañana" : `Abierto, quedan ${t.quedan} días`;
  const fechas = (t) => t.cuando || (t.unDia ? fFecha.format(t.a) : `${fFecha.format(t.a)} al ${fFecha.format(t.z)}`);
  $("#tareas").replaceChildren(...GRUPOS_TAREA.flatMap(([g, titulo]) => { const suyas = T.filter((t) => t.grupo === g).sort((x, y) => x.a - y.a || x.z - y.z);
    return suyas.length ? [el("h3", { class: "tareas-grupo" }, titulo), el("ul", { class: "tareas" }, ...suyas.map((t) => el("li", { class: `tarea ${t.fase}` },
      el("div", { class: "cab" }, el("span", { class: "estado" }, estado(t)), el("span", { class: "dias" }, fechas(t))),
      el("b", {}, t.que), el("span", { class: "det" }, t.como),
      t.enlace?.url ? el("a", { href: t.enlace.url, target: "_blank", rel: "noopener" }, t.enlace.texto || "Más información") : null)))] : []; }));
  return toca;
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
    sel.addEventListener("change", () => { quitarDelEnlace("provincia"); try { localStorage.setItem("mi-provincia", sel.value); } catch {} mapa.sel = sel.value || null; if (mapa.proy) pintarMapa(mapa.proy); if (sel.value) $("#ficha-provincia").scrollIntoView({ behavior: "smooth", block: "center" }); });
  }
  sel.value = mapa.sel || "";
}
function pintarHistorial() {
  const h = D.historial, der = escenario(D.config.principales.derecha), izq = escenario(D.config.principales.izquierda);
  const cont = $("#grafico-historial").parentElement;
  if (!h?.length || h.length < 3 || !der || !izq) { cont.style.display = "none"; return; }
  cont.style.display = "";
  graficoHistorial?.destroy(); graficoHistorial = null;
  if (!hayGraficas($("#grafico-historial"))) return;
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
const enc = { filtro: null, abiertas: new Set(), tramo: "legislatura", todos: false, desde: null, hasta: null };
const fMesAnio = new Intl.DateTimeFormat("es-ES", { month: "short", year: "numeric" });
const etiquetaFecha = (t) => fMesAnio.format(t).replace(" de ", " ");
/* Tramo de la gráfica de Encuestas. Tres fijos hacia atrás desde hoy, uno desde la convocatoria y uno con las dos fechas
   que se quieran, entre el primer día con media (septiembre de 2023) y hoy. */
const TRAMO_INICIO = "2023-09-03";
const fFechaAnio = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const diaConvocatoria = () => (D.agenda || []).find((x) => /convocatoria/i.test(x.titulo))?.fecha || "2026-10-06";
function rangoTendencia() {
  const h = hoy(), ini = fechaD(TRAMO_INICIO);
  if (enc.tramo === "anio") return [new Date(+h - 365 * DIA), h];
  if (enc.tramo === "tres") return [new Date(+h - 92 * DIA), h];
  if (enc.tramo === "convocatoria") return [fechaD(diaConvocatoria()), h];
  if (enc.tramo === "medida" && enc.desde && enc.hasta) {
    let a = fechaD(enc.desde), b = fechaD(enc.hasta);
    if (a > b) [a, b] = [b, a];
    return [a < ini ? ini : a > h ? h : a, b > h ? h : b < ini ? ini : b];
  }
  return [ini, h];
}
function textoTramo() {
  const [a, b] = rangoTendencia();
  return enc.tramo === "anio" ? "en el último año" : enc.tramo === "tres" ? "en los últimos 3 meses"
    : enc.tramo === "convocatoria" ? `desde que se convocaron las elecciones, el ${fFechaAnio.format(a).replace(/ de \d{4}$/, "")}`
    : enc.tramo === "medida" ? `entre el ${fFechaAnio.format(a)} y el ${fFechaAnio.format(b)}` : "desde las últimas elecciones, en julio de 2023";
}
function elegirTramo(t) {
  enc.tramo = t;
  const caja = $("#tramo-fechas"), d = $("#tramo-desde"), h = $("#tramo-hasta"), hoyS = diaMadrid();
  document.querySelectorAll(".tramos button").forEach((x) => { x.setAttribute("aria-pressed", x.dataset.tramo === t ? "true" : "false"); if (x.dataset.tramo === "medida") x.setAttribute("aria-expanded", t === "medida" ? "true" : "false"); });
  caja.hidden = t !== "medida";
  if (t === "medida") {
    for (const c of [d, h]) { c.min = TRAMO_INICIO; c.max = hoyS; }
    if (!enc.desde || !enc.hasta) { enc.desde = new Date(+hoy() - 180 * DIA).toISOString().slice(0, 10); enc.hasta = hoyS; } // de entrada, los últimos seis meses
    d.value = enc.desde; h.value = enc.hasta;
  }
  avisoTramo();
  if (enc.explica) $("#explica-tendencia").textContent = enc.explica();
  pintarTendencia();
}
/* Lo que se le dice al que elige fechas: si están al revés se dan la vuelta, y si se salen de lo que hay se ajustan. */
function avisoTramo() {
  const av = $("#tramo-aviso");
  if (enc.tramo !== "medida") { av.textContent = ""; return; }
  const hoyS = diaMadrid(), fuera = (x) => x < TRAMO_INICIO || x > hoyS;
  av.textContent = enc.desde === enc.hasta ? "Las dos fechas son la misma. Elige al menos dos días distintos."
    : enc.desde > enc.hasta ? "La primera fecha era posterior a la segunda, así que se han tomado al revés."
    : fuera(enc.desde) || fuera(enc.hasta) ? `Solo hay media entre el ${fFechaAnio.format(fechaD(TRAMO_INICIO))} y hoy. Se enseña lo que cae dentro.` : "";
}
document.querySelectorAll(".tramos button").forEach((b) => b.addEventListener("click", () => elegirTramo(b.dataset.tramo)));
for (const id of ["tramo-desde", "tramo-hasta"]) document.getElementById(id)?.addEventListener("change", (e) => {
  if (!e.target.value) return; // fecha a medio escribir
  enc[id === "tramo-desde" ? "desde" : "hasta"] = e.target.value;
  elegirTramo("medida");
});
/* La lista de partidos de Encuestas. Va aparte porque también se repinta al elegir partido en el modo partido. */
function pintarListaPartidos(m, m7, proy) {
  const o = ordenar(m.media).filter((k) => m.media[k] >= 0.5);
  const max = Math.max(...o.map((k) => m.media[k]), 1);
  // A la vista, los partidos con al menos un 5 % (y el que se esté siguiendo en modo partido). El resto, con un botón.
  const grandes = o.filter((k) => m.media[k] >= 5 || k === foco.k), resto = o.length - grandes.length;
  const fila = (k) => { const d = m7.media[k] != null ? m.media[k] - m7.media[k] : 0;
    const marca = D.config.partidos[k]?.aviso?.texto ? el("button", { type: "button", class: "marca-aviso", "aria-label": `Ver el aviso sobre ${nombre(k)}`, onclick: () => { const t = document.getElementById(`aviso-${k}`); if (!t) return; t.scrollIntoView({ behavior: "smooth", block: "center" }); t.classList.add("destacada"); setTimeout(() => t.classList.remove("destacada"), 2500); } }, "aviso") : null;
    return el("div", { class: "fila-p" }, el("div", { class: "nom" }, el("i", { class: "punto", style: { background: color(k) } }), nombre(k), marca),
      el("div", { class: "pct" }, `${fmt1.format(m.media[k])} %`, el("small", { class: Math.abs(d) >= 0.1 ? (d > 0 ? "sube" : "baja") : "" }, Math.abs(d) >= 0.1 ? signo(d) : "")),
      el("div", { class: "barra" }, el("i", { style: { width: `${m.media[k] / max * 100}%`, background: color(k) } })),
      el("div", { class: "esc" }, D.prob?.partidos?.[k] ? (D.prob.partidos[k].p10 === D.prob.partidos[k].p90 ? `${D.prob.partidos[k].p90} ${D.prob.partidos[k].p90 === 1 ? "asiento" : "asientos"}` : `entre ${D.prob.partidos[k].p10} y ${D.prob.partidos[k].p90} asientos`) : `${proy.total[k] || 0} asientos`)); };
  poner($("#lista-partidos"), ...(enc.todos ? o : grandes).map(fila),
    resto > 0 ? el("button", { class: "ver-mas", type: "button", "aria-expanded": enc.todos ? "true" : "false", onclick: () => { enc.todos = !enc.todos; pintarListaPartidos(m, m7, proy); } },
      enc.todos ? "Ver solo los más votados" : `Ver los otros ${resto} partidos`) : null, ...notasAviso(), notaNoConcurren());
}
function pintarEncuestas(m, m7, proy) {
  const o = ordenar(m.media).filter((k) => m.media[k] >= 0.5);
  pintarListaPartidos(m, m7, proy);
  // El CIS no entra en la media. Se enseña al lado lo que dice su última encuesta, para ver cuánto se separa.
  const cis = (D.encuestas?.encuestas || []).filter((e) => e.clave === "cis").sort((x, y) => y.fin.localeCompare(x.fin))[0];
  $("#cis-bloque").hidden = !cis;
  if (cis) {
    const dia = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "long" }).format(Media.fechaD(cis.fin));
    $("#cis-texto").textContent = `Es la encuesta del organismo público. No entra en la media porque desde 2019 se separa mucho del resto de empresas, sobre todo con el PSOE. Su última encuesta es del ${dia}.`;
    const filas = o.filter((k) => cis.pct[k] != null).slice(0, 4);
    poner($("#cis-tabla"), el("span", {}), el("span", { class: "cab" }, "Media de hoy"), el("span", { class: "cab" }, "El CIS"), el("span", { class: "cab" }, "Diferencia"),
      ...filas.flatMap((k) => { const d = cis.pct[k] - m.media[k];
        return [el("span", { class: "nom" }, el("i", { class: "punto", style: { background: color(k) } }), nombre(k)), el("span", {}, `${fmt1.format(m.media[k])} %`),
          el("b", {}, `${fmt1.format(cis.pct[k])} %`), el("span", { class: "dif" }, Math.abs(d) < 0.05 ? "igual" : `${fmt1.format(Math.abs(d))} ${d > 0 ? "más" : "menos"}`)]; }));
    $("#cis-nota").textContent = "Aunque entrara, la media cambiaría muy poco. A cada empresa se le resta lo que suele dar de más o de menos a cada partido antes de hacer la cuenta.";
  }
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
  enc.explica = () => cf ? `Las encuestas de ${cf.empresa}, una a una, ${textoTramo()}. Cada punto es una encuesta. ${enMedia.has(enc.filtro) ? "Su última encuesta cuenta hoy en la media." : enc.filtro === "cis" ? "El CIS no cuenta en la media." : cf.activa ? `Hoy no cuenta en la media porque su última encuesta, del ${fFecha.format(fechaD(cf.ultima))}, tiene más de ${m.ventana} días.` : "Lleva más de un año sin publicar."}` : `Así ha cambiado la media de encuestas ${textoTramo()}.${enc.tramo === "convocatoria" || (enc.tramo === "medida" && rangoTendencia()[1] - rangoTendencia()[0] <= 130 * DIA) ? " Un punto por día." : ""}`;
  $("#explica-tendencia").textContent = enc.explica();
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
    const tarjeta = el("div", { class: "tarjeta abrible", id: `enc-${e.id}`, style: usadas.has(e.id) || enc.filtro ? null : { opacity: .75 }, onclick: (ev) => { if (ev.target.closest("a, .mini-grafico")) return; abierta ? enc.abiertas.delete(e.id) : enc.abiertas.add(e.id); pintarEncuestas(m, m7, proy); } },
      el("div", { class: "cab" }, el("b", {}, e.empresa_base, e.encargo ? ` para ${e.encargo}` : "", nota && nota.letra !== "–" ? el("span", { class: "nota", title: nota.texto }, nota.letra) : null,
        dePartido ? el("span", { class: "veredicto leve" }, "de un partido") : an ? el("span", { class: `veredicto ${an.veredicto}` }, an.veredicto === "ruido" ? "nada nuevo" : an.veredicto === "leve" ? "algo se mueve" : "novedad") : null),
        el("span", {}, fFecha.format(fechaD(e.fin)))),
      el("p", { class: "ver" }, `Dice que gana ${nombre(oe[0])} por ${fmt1.format(dif)} puntos. ${fiable}${fiable ? " " : ""}${ver}${e.muestra ? ` Preguntó a ${fmt0.format(e.muestra)} personas, margen de error de ±${fmt1.format(an?.margen ?? 98 / Math.sqrt(e.muestra))} puntos.` : ""}`),
      el("div", { class: "chips" }, ...oe.slice(0, abierta ? 99 : 6).map((k) => el("span", { class: "chip", style: { background: color(k) } }, `${nombre(k)} ${fmt1.format(e.pct[k])}`))),
      abierta ? el("div", { class: "detalle" },
        el("p", {}, `Trabajo de campo ${e.inicio && e.inicio !== e.fin ? `del ${fFecha.format(fechaD(e.inicio))} al ` : "el "}${fFecha.format(fechaD(e.fin))}.${e.muestra ? ` ${fmt0.format(e.muestra)} entrevistas.` : ""}${Object.keys(e.escanos || {}).length ? ` Asientos que da: ${ordenar(e.escanos).filter((k) => e.escanos[k] > 0).slice(0, 8).map((k) => `${nombre(k)} ${Math.round(e.escanos[k])}`).join(", ")}.` : ""}${nota && nota.letra !== "–" ? ` Nota ${nota.letra}, ${nota.texto}.` : ""}`),
        graficoDeEmpresa(e, todas),
        el("table", {}, el("thead", {}, el("tr", {}, el("th", {}, "Partido"), el("th", {}, "Dio"), el("th", {}, "Suele dar"), el("th", {}, "Media de todas"))),
          el("tbody", {}, ...oe.slice(0, 8).map((k) => { const d = an?.detalle?.find((x) => x.partido === k);
            return el("tr", {}, el("td", {}, nombre(k)), el("td", {}, fmt1.format(e.pct[k])), el("td", {}, sesgo && sesgo[k] != null ? `${signo(sesgo[k])} que la media` : "–"), el("td", {}, d ? fmt1.format(d.esperado - (sesgo && sesgo[k] != null ? sesgo[k] : 0)) : "–")); }))),
        el("p", { class: "mas" }, "\"Suele dar\" es lo que esta empresa se separa de la media del momento en sus encuestas de esta legislatura. Toca para cerrar.")) : el("p", { class: "mas" }, "Toca para ver todos los datos"));
    return tarjeta;
  }));
  dibujarGraficosDeEmpresa(todas);
  if (D.encuestas) $("#fuente-encuestas").replaceChildren(enc.filtro ? "" : `Las atenuadas no entran en la media de hoy por tener más de ${m.ventana} días, por haber otra más reciente de la misma empresa o por ser de un partido. La fecha de cada encuesta es la del último día en que preguntó. `, "Fuente ", el("a", { href: D.encuestas.fuente, target: "_blank", rel: "noopener" }, "Wikipedia"), `, actualizado ${hace(D.encuestas.actualizado)}.`);
  graficoTendencia?.destroy(); graficoTendencia = null;
  if (!$("#encuestas").hidden) pintarTendencia();
}
/* Dentro de cada encuesta desplegada, un gráfico pequeño con las encuestas de esa misma empresa del último año,
   una a una, y la que se está mirando marcada con el punto grande. Así se ve si lo que dice es nuevo en ella o no. */
const graficosEmpresa = [];
const deEmpresa = (e, todas) => todas.filter((x) => x.clave === e.clave && fechaD(x.fin) >= new Date(+hoy() - 365 * DIA)).slice().reverse();
function graficoDeEmpresa(e, todas) {
  const mias = deEmpresa(e, todas);
  if (mias.length < 2 || !mias.some((x) => x.id === e.id)) return el("p", { class: "mas" }, `No hay más encuestas de ${e.empresa_base} en el último año para comparar.`);
  return el("div", { class: "mini-grafico" },
    el("p", {}, `Las ${mias.length} encuestas de ${e.empresa_base} del último año, una a una. El punto grande es esta.`),
    el("div", { class: "lienzo" }, el("canvas", { "data-enc": e.id, "aria-label": `Evolución de las encuestas de ${e.empresa_base}` })));
}
function dibujarGraficosDeEmpresa(todas) {
  graficosEmpresa.splice(0).forEach((g) => g.destroy());
  if (typeof Chart === "undefined") return;
  document.querySelectorAll("#tarjetas-encuestas canvas[data-enc]").forEach((lienzo) => {
    const e = todas.find((x) => x.id === lienzo.dataset.enc); if (!e) return;
    const mias = deEmpresa(e, todas), cual = mias.findIndex((x) => x.id === e.id), partidos = ordenar(e.pct).slice(0, 5);
    const op = opciones(" %"); op.plugins.legend.labels.boxWidth = 7; op.plugins.legend.labels.boxHeight = 7; op.scales.y.beginAtZero = false;
    graficosEmpresa.push(new Chart(lienzo, { type: "line", data: { labels: mias.map((x) => fFecha.format(fechaD(x.fin))),
      datasets: partidos.map((k) => ({ label: nombre(k), data: mias.map((x) => x.pct[k] ?? null), borderColor: color(k), backgroundColor: color(k), borderWidth: 2, tension: .2, spanGaps: true,
        pointRadius: mias.map((_, i) => i === cual ? 6 : 2.5), pointHoverRadius: 6 })) }, options: op }));
  });
}
function pintarTendencia() {
  const m = calcMedia(), o = ordenar(m.media).filter((k) => m.media[k] >= 1.5).slice(0, 7);
  graficoTendencia?.destroy(); graficoTendencia = null;
  if (!hayGraficas($("#grafico-tendencia"))) return;
  avisoTramo();
  const [desde, hasta] = rangoTendencia(), nDias = Math.round((hasta - desde) / DIA);
  // Hasta unos cuatro meses, un punto por día y fechas con día. Más largo, cada 3 días o cada semana, y fechas con mes y año.
  const corto = nDias <= 130, paso = corto ? 1 : nDias <= 500 ? 3 : 7, rotulo = (t) => corto ? fFecha.format(t) : etiquetaFecha(t);
  if (enc.filtro) {
    const mias = (D.encuestas?.encuestas || []).filter((e) => e.clave === enc.filtro && fechaD(e.fin) >= desde && fechaD(e.fin) <= hasta).slice().reverse();
    graficoTendencia = new Chart($("#grafico-tendencia"), { type: "line", data: { labels: mias.map((e) => rotulo(fechaD(e.fin))),
      datasets: o.map((k) => ({ label: nombre(k), data: mias.map((e) => e.pct[k] ?? null), borderColor: color(k), backgroundColor: color(k), borderWidth: 2, pointRadius: 4, tension: .2, spanGaps: true })) }, options: opciones(" %") });
    if (!mias.length) $("#tramo-aviso").textContent = enc.tramo === "medida" ? "Esta empresa no tiene ninguna encuesta entre esas dos fechas." : "";
    return;
  }
  const puntos = [];
  for (let t = desde; t <= hasta; t = new Date(+t + paso * DIA)) puntos.push(t);
  if (puntos[puntos.length - 1] < hasta) puntos.push(hasta);
  const series = {};
  for (const t of puntos) { const mm = calcMedia(t).media; for (const k of o) (series[k] ||= []).push(mm[k] != null ? +mm[k].toFixed(2) : null); }
  // Con pocos días se marca cada uno con su punto, que si no una línea de cinco tramos no dice dónde está cada día
  graficoTendencia = new Chart($("#grafico-tendencia"), { type: "line", data: { labels: puntos.map(rotulo),
    datasets: o.map((k) => ({ label: nombre(k), data: series[k], borderColor: color(k), backgroundColor: color(k), borderWidth: 3, pointRadius: puntos.length <= 31 ? 3 : 0, tension: puntos.length <= 31 ? 0 : .3, spanGaps: true })) }, options: opciones(" %") });
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
    return { fill: dos.length === 2 ? `url(#${id})` : "var(--linea)", op: rel < 0.5 ? 1 : rel < 1 ? 0.75 : rel < 2 ? 0.4 : 0.12, txt: "var(--tinta)", etiqueta: dos.length === 2 && p.n >= 4 ? esc(`${nombre(dos[0])}·${nombre(dos[1])}`) : "", grad, clase: "etq", tam: 21 };
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
  $("#mapa-svg").querySelectorAll("g.prov").forEach((g) => g.addEventListener("click", () => { quitarDelEnlace("provincia"); mapa.sel = g.dataset.p; try { localStorage.setItem("mi-provincia", mapa.sel); } catch {} pintarMapa(mapa.proy); }));
  $("#mapa-pista").textContent = mapa.vista === "ganador" ? "Cada provincia lleva el color del partido que más asientos sacaría en ella, y el número de asientos que reparte. Si está más clara es que hay empate. Toca una para ver el detalle." : "Cada provincia lleva los colores de los dos partidos que se disputan su último asiento, primero el que lo tiene y luego el que lo persigue. Cuanto más intenso, más reñido. Las casi blancas están decididas. Toca una para ver el detalle.";
  const p = proy.provincias.find((x) => x.nombre === mapa.sel);
  $("#ficha-provincia").replaceChildren(...(p ? [el("div", { class: "ficha" }, el("h3", {}, `${p.nombre}, ${p.n} asientos`),
    el("div", { class: "chips" }, ...ordenar(p.escanos).map((k) => el("span", { class: "chip", style: { background: color(k) } }, `${nombre(k)} ${p.escanos[k]}`))),
    el("p", {}, (p.aspirante ? fraseProvincia(p, false) : "") + antes2023(p)),
    botonEnlace(`Copiar el enlace a ${p.nombre}`, () => enlaceA({ provincia: p.nombre, pestana: "mapa" })),
    el("details", { class: "como" }, el("summary", {}, "¿Cómo se reparten estos asientos?"),
      el("p", {}, `De uno en uno. Cada asiento se lo lleva el partido que tenga el número más alto en ese momento. Todos empiezan con su porcentaje de voto. Cuando un partido gana un asiento, para optar al siguiente su voto se divide entre 2. Si gana otro, entre 3. Así el que ya tiene asientos lo tiene cada vez más difícil y los demás van entrando. Es la ley D'Hondt.`),
      pasosDhondt(p),
      el("p", { class: "fuente" }, `Ahí se acaban los ${p.n} asientos de ${p.nombre}. Solo entran en el reparto los partidos con al menos el 3 % del voto de la provincia.`),
      el("details", { class: "como dentro" }, el("summary", {}, "Ver todas las divisiones en una tabla"),
        el("p", {}, "Es lo mismo, visto de golpe. El voto de cada partido dividido entre 1, 2, 3… Los números en color son los más altos, y cada uno es un asiento."),
        el("div", { class: "tabla-scroll" }, tablaDhondt(p)))))] : []));
  // Ordenadas por lo mismo que dice la etiqueta: lo que le falta al aspirante comparado con lo que cuesta un asiento en esa provincia
  const relativo = (x) => Math.max(x.aspirante.falta, 0) / (10 / (x.n + 1));
  const aj = [...proy.provincias].filter((x) => x.aspirante).sort((a, b) => relativo(a) - relativo(b)).slice(0, 5).map((x) => ({ x }));
  const nivel = (x) => { const f = Math.max(x.aspirante?.falta ?? 99, 0), u = 10 / (x.n + 1); return f < u / 2 ? "Muy reñida" : f < u ? "Reñida" : "Algo reñida"; };
  $("#ajustadas").replaceChildren(...aj.map(({ x, pp }) => el("button", { class: "ajustada", type: "button", onclick: () => { quitarDelEnlace("provincia"); mapa.sel = x.nombre; pintarMapa(mapa.proy); $("#ficha-provincia").scrollIntoView({ behavior: "smooth", block: "center" }); } },
    el("b", {}, x.nombre), el("span", { class: "pts" }, nivel(x)),
    el("span", { class: "m" }, x.aspirante ? `Se lo disputan ${nombre(x.ultimo.p)} y ${nombre(x.aspirante.p)}. Hoy lo tiene ${nombre(x.ultimo.p)} ${porVotos(Math.max(x.aspirante.falta, 0), x.n)}.` : ""))));
}
/* El reparto contado asiento a asiento, que se entiende mejor que la tabla de divisiones. Es la ley D'Hondt de siempre,
   en el orden en que se van dando los asientos. En las provincias grandes se enseñan los primeros y los últimos. */
function pasosDhondt(p) {
  const partidos = ordenar(p.cuotas).filter((k) => p.cuotas[k] >= Modelo.UMBRAL), lleva = {}, pasos = [];
  for (let i = 1; i <= p.n && partidos.length; i++) {
    const m = partidos.map((k) => ({ k, d: (lleva[k] || 0) + 1, q: p.cuotas[k] / ((lleva[k] || 0) + 1) })).sort((x, y) => y.q - x.q)[0];
    lleva[m.k] = m.d; pasos.push({ i, ...m });
  }
  const paso = (x) => el("li", {}, el("span", { class: "num" }, `${x.i}.º`), el("span", { class: "chip", style: { background: color(x.k) } }, nombre(x.k)),
    el("span", { class: "por" }, x.d === 1 ? `con su ${fmt1.format(x.q)} % de voto` : `con ${fmt1.format(x.q)}, que es su ${fmt1.format(p.cuotas[x.k])} entre ${x.d} porque va a por su ${x.d}.º asiento`));
  const corta = pasos.length > 10;
  return el("ol", { class: "pasos-dh" }, ...(corta ? [...pasos.slice(0, 4).map(paso), el("li", { class: "salto" }, `Del ${pasos[4].i}.º al ${pasos[pasos.length - 4].i}.º, igual, uno a uno`), ...pasos.slice(-3).map(paso)] : pasos.map(paso)));
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
    if (r.hechos.length) { sim.valores = r.v; sim.fusiones = r.fusiones; sim.situacion = "propio"; contar("Usa monta tu caso"); }
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
  poner(cont,
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
  poner($("#pactos"), ...ordenar(tot).filter((k) => tot[k] > 0).map((k) => el("button", { class: "pacto", type: "button", "aria-pressed": sel.has(k) ? "true" : "false", onclick: () => alternar(k) },
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
  const lnz = (sd, z) => Math.exp(sd * z - sd * sd / 2), CA = Math.sqrt(R.comun || 0), CB = Math.sqrt(1 - (R.comun || 0));
  for (let i = 0; i < N; i++) {
    const z = { d: rn(), i: rn(), t: rn() }, zt = rn(), m = {};
    for (const k of claves) { const b = bloque(k); m[k] = Math.max(0, sim.valores[k] + (P.sigmas[k] || 0.06 * sim.valores[k]) * (0.55 * z[b] + 0.835 * rn() + 0.35 * (b === "d" ? 1 : b === "i" ? -1 : 0) * zt)); }
    const gr = Modelo.grupos(m, D.base), fc = {};
    const zcom = {}; for (const c of ccaas) zcom[c] = rn(); // lo que se separan a la vez todos los estatales en esa comunidad
    for (const k of claves) { fc[k] = {}; for (const c of ccaas) fc[k][c] = est.has(k) ? lnz(R.comunidad, CA * zcom[c] + CB * rn()) : 1; }
    const brutas = D.base.provincias.map((p) => Modelo.proyectarProvincia(p, m, D.base, gr));
    const ruid = brutas.map((cu, j) => { const o = {}, zp = rn(); for (const [k, v] of Object.entries(cu)) o[k] = v * (fc[k] ? fc[k][D.base.provincias[j].ccaa] : 1) * lnz(R.provincia, est.has(k) ? CA * zp + CB * rn() : rn()); return o; });
    for (const k of claves) if (est.has(k)) { let a = 0, d = 0; brutas.forEach((cu, j) => { a += (cu[k] || 0) * peso[j]; d += (ruid[j][k] || 0) * peso[j]; }); if (d > 0) for (const cu of ruid) if (cu[k] != null) cu[k] *= a / d; }
    const t = {};
    D.base.provincias.forEach((p, j) => { for (const [k, n] of Object.entries(Modelo.dhondt(Modelo.fundir(ruid[j], sim.fusiones), p.escanos).escanos)) t[k] = (t[k] || 0) + n; });
    const td = der.partidos.reduce((a, k) => a + (t[k] || 0), 0), ti = izq.partidos.reduce((a, k) => a + (t[k] || 0), 0);
    sd.push(td); si.push(ti); if (td >= 176) cd++; if (ti >= 176) ci++;
  }
  sd.sort((a, b) => a - b); si.sort((a, b) => a - b);
  // Sin tocar nada es la misma situación que en Hoy, así que se enseñan los mismos números que allí y no otra tirada de dados
  const intacto = !sim.fusiones.length && Object.keys(sim.valores).every((k) => Math.abs((sim.valores[k] || 0) - (sim.base[k] ?? -9)) < 1e-9);
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
/* El Senado tiene más asientos que los 208 que se eligen: los parlamentos de las comunidades designan al resto, y esos no
   cambian con estas elecciones (config.senado.designados). La mayoría absoluta es la de toda la cámara. */
function datosSenado() {
  const des = D.config.senado?.designados || {}, nDes = Object.values(des).reduce((a, b) => a + b, 0), total = 208 + nDes;
  return { des, nDes, total, M: Math.floor(total / 2) + 1 };
}
function pintarSenado(proy) {
  // Los senadores elegidos de hoy salen del mismo reparto por provincias que el mapa. Las simulaciones ponen la probabilidad y el margen.
  const { des, nDes, total, M } = datosSenado(), tot = {}, porProv = {}, primeras = {};
  for (const p of proy.provincias) { const r = Modelo.senadoProvincia(p.cuotas, p.nombre); porProv[p.nombre] = r; const g = ordenar(r)[0]; if (g) primeras[g] = (primeras[g] || 0) + 1; for (const [k, n] of Object.entries(r)) tot[k] = (tot[k] || 0) + n; }
  // Las probabilidades solo valen si el robot las calculó con la misma mayoría. Tras cambiar los designados tardan una pasada.
  const S = D.prob?.senado_mayoria === M ? D.prob.senado : null, o = ordenar(tot), k1 = o[0], k2 = o[1];
  if (!k1) return;
  const con = {}; for (const k of new Set([...Object.keys(tot), ...Object.keys(des)])) con[k] = (tot[k] || 0) + (des[k] || 0);
  const X = con[k1], p1 = S?.[k1]?.p_mayoria, t = p1 == null ? -1 : tramo(p1);
  const mas = (k) => des[k] ? `, y con los ${des[k]} que ya tiene designados por las comunidades serían ${con[k]}` : "";
  $("#r-senado").replaceChildren(el("b", {}, t >= 3 ? `${cap(palabra(p1))}, mayoría absoluta ${deP(k1)}.` : t === 2 ? "En el aire." : t >= 0 ? "Nadie tiene asegurada la mayoría del Senado." : `${cap(elP(k1))}, el que más senadores sacaría.`),
    ` Con las encuestas de hoy ${elP(k1)} sacaría ${tot[k1]} de los 208 senadores que se eligen${mas(k1)}. El Senado tiene ${total} y hacen falta ${M}, así que ${X > M ? `le sobrarían ${X - M}` : X === M ? "llegaría justo" : `le faltarían ${M - X}`}.`, k2 ? ` ${cap(elP(k2))} sacaría ${tot[k2]}${mas(k2)}.` : "");
  const franja = (k) => [Math.min(S?.[k]?.p10 ?? tot[k], tot[k]) + (des[k] || 0), Math.max(S?.[k]?.p90 ?? tot[k], tot[k]) + (des[k] || 0)];
  const op = (k) => ({ id: k, titulo: `Mayoría ${deP(k)}`, arco: nombre(k), p: S[k]?.p_mayoria || 0, color: color(k), partidos: [k], central: con[k], p10: franja(k)[0], p90: franja(k)[1], verbo: "tendría", plural: false, mayoria: M, unidad: "senadores", con: des[k] ? `Con las encuestas de hoy y sus ${des[k]} designados` : null });
  const juntos = D.prob?.senado_escenarios?.[D.config.principales.derecha], eJ = escenario(D.config.principales.derecha);
  const ops = S ? [op(k1), { id: "nadie", titulo: "Nadie con mayoría", p: Math.max(0, 1 - Object.values(S).reduce((a, v) => a + (v.p_mayoria || 0), 0)), color: "#8A93A3", texto: `Pasa cuando ningún partido llega solo a ${M} senadores. Tendrían que ponerse de acuerdo varios para sacar adelante las votaciones.`,
    despues: juntos && eJ && eJ.partidos.length > 1 ? `Eso no es lo mismo que un Senado bloqueado: que ${nombreEsc(eJ)} lleguen a ${M} entre los dos es ${palabra(juntos.p)} (${r100(juntos.p)} %).` : null }, ...(k2 ? [op(k2)] : [])] : [];
  const pinta = () => {
    const sel = ops.find((x) => x.id === senado.sel && x.partidos) || (senado.sel === "nadie" ? null : (ops[0] || { partidos: [k1], color: color(k1), arco: nombre(k1), central: X, mayoria: M, unidad: "senadores" }));
    const tocar = (k) => { senado.hemi = k && k !== senado.hemi && con[k] ? k : null; pinta(); };
    hemiciclo($("#sen-hemiciclo"), con, 9, sel ? { partidos: sel.partidos, color: sel.color } : null, String(M), null, { marcado: senado.hemi, alTocar: tocar });
    fraseArco($("#sen-hemi-arco"), sel);
    leyenda($("#sen-leyenda"), con, null, tocar, senado.hemi);
    const kh = senado.hemi;
    fichaHemi($("#sen-hemi-ficha"), kh, kh ? (kh === "Otros" ? `${con[kh]} senadores designados por las comunidades. ${D.config.senado?.otros || ""}.`
      : `${con[kh]} ${con[kh] === 1 ? "senador" : "senadores"}. ${tot[kh] ? `${tot[kh]} ${tot[kh] === 1 ? "elegido" : "elegidos"} con las encuestas de hoy` : "Ninguno elegido con las encuestas de hoy"}${des[kh] ? ` y ${des[kh]} ${des[kh] === 1 ? "designado" : "designados"} por las comunidades` : ""}.${S?.[kh] ? ` De los que se eligen, lo normal es que se quede ${entreDos(Math.min(S[kh].p10, tot[kh] || 0), Math.max(S[kh].p90, tot[kh] || 0))}.` : ""}`) : "", () => tocar(null));
    if (ops.length) medidores($("#sen-medidores"), $("#sen-medidor-detalle"), ops, senado.sel, (id) => { senado.sel = id; pinta(); });
    else { $("#sen-medidores").replaceChildren(); $("#sen-medidor-detalle").replaceChildren(el("p", { class: "pie-bloque" }, "Las probabilidades del Senado se calculan en la próxima actualización.")); }
  };
  pinta();
  $("#sen-pie").textContent = `Cada punto es uno de los ${total} senadores: los 208 que se eligen el 29N y los ${nDes} que designan los parlamentos de las comunidades, que no cambian con estas elecciones. El partido cuyo arco pasa la raya del centro, ${M}, controla el Senado. Toca un partido en el dibujo para ver sus datos.`;
  // Por qué la franja del primero cae más hacia abajo que hacia arriba
  const [f10, f90] = S ? franja(k1) : [X, X], n1 = primeras[k1] || 0;
  $("#sen-nota").textContent = S && X - f10 > 2 * (f90 - X) && n1 > proy.provincias.length / 2 ? `La franja ${deP(k1)} va de ${f10} a ${f90} y hoy está en ${X}, casi arriba del todo. Es porque sería el más votado en ${n1} de las ${proy.provincias.length} provincias: tiene muchas que perder y pocas que ganar, y cada provincia en la que deja de ser primero le cuesta 2 senadores.` : "";
  const d = D.config.senado;
  const conNombre = ordenar(des).filter((k) => k !== "Otros");
  poner($("#sen-designados"), ...(nDes ? [`Además de los que se eligen, las comunidades ya tienen designados ${nDes}. ${lista([...conNombre.map((k) => `${nombre(k)} ${des[k]}`), ...(des.Otros ? [`otros partidos ${des.Otros}`] : [])])}.`, des.Otros && d.otros ? ` Los otros son ${d.otros}.` : null,
    ...(d.fuente ? [" (", el("a", { href: d.fuente, target: "_blank", rel: "noopener" }, "fuente"), ")"] : [])] : []));
  const max = Math.max(...o.map((k) => tot[k]));
  $("#g-senado").replaceChildren(...o.map((k) => el("div", { class: "bg" }, el("div", { class: "nom" }, el("i", { class: "punto", style: { background: color(k) } }), nombre(k)),
    el("div", { class: "num" }, tot[k], el("small", {}, S?.[k] ? ` elegidos, lo normal ${entreDos(Math.min(S[k].p10, tot[k]), Math.max(S[k].p90, tot[k]))}` : " elegidos")), el("div", { class: "pista" }, el("i", { style: { width: `${tot[k] / max * 100}%`, background: color(k) } })))));
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
function elegirFoco(k) { quitarDelEnlace("partido"); foco.k = k; if (k) contar("Usa el modo partido"); try { if (k) localStorage.setItem("partido", k); else localStorage.removeItem("partido"); } catch {} pintarFoco(); if (foco.ctx) pintarListaPartidos(foco.ctx.m, foco.ctx.m7, foco.ctx.proy); }
const agujaFija = (titulo, p, col) => el("div", { class: "medidor-a fijo" }, el("span", { class: "tit" }, titulo), el("span", { class: "svg", html: aguja(p, col) }), el("b", {}, cap(palabra(p))));
/* La fila de partidos no cabe entera. Con el dedo se desliza; con ratón hacen falta flechas y poder arrastrarla. */
function carril(fila, donde = 0) {
  const paso = (s) => fila.scrollBy({ left: s * Math.max(160, fila.clientWidth * 0.7), behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  const izq = el("button", { type: "button", class: "flecha izq", "aria-label": "Ver los partidos de antes", hidden: true, onclick: () => paso(-1) }, el("span", { "aria-hidden": "true" }, "‹"));
  const der = el("button", { type: "button", class: "flecha der", "aria-label": "Ver más partidos", hidden: true, onclick: () => paso(1) }, el("span", { "aria-hidden": "true" }, "›"));
  const medir = () => { const resto = fila.scrollWidth - fila.clientWidth; izq.hidden = fila.scrollLeft < 4; der.hidden = fila.scrollLeft > resto - 4; };
  fila.addEventListener("scroll", medir, { passive: true });
  let x0 = null, s0 = 0, movida = false;
  const soltar = () => { x0 = null; fila.classList.remove("arrastrando"); };
  fila.addEventListener("pointerdown", (e) => { if (e.pointerType !== "mouse" || e.button !== 0) return; x0 = e.clientX; s0 = fila.scrollLeft; movida = false; });
  fila.addEventListener("pointermove", (e) => {
    if (x0 == null) return;
    if (!(e.buttons & 1)) return soltar();
    const dx = e.clientX - x0;
    if (!movida && Math.abs(dx) > 5) { movida = true; fila.setPointerCapture(e.pointerId); fila.classList.add("arrastrando"); }
    if (movida) fila.scrollLeft = s0 - dx;
  });
  fila.addEventListener("pointerup", soltar);
  fila.addEventListener("pointercancel", soltar);
  fila.addEventListener("click", (e) => { if (movida) { e.preventDefault(); e.stopPropagation(); movida = false; } }, true); // soltar tras arrastrar no elige partido
  carrilVivo = medir;
  requestAnimationFrame(() => {
    fila.scrollLeft = donde;
    const b = fila.querySelector('[data-k][aria-pressed="true"]'); // el partido elegido, siempre a la vista
    if (b && fila.clientWidth) { const a = b.offsetLeft - fila.offsetLeft, z = a + b.offsetWidth; if (a < fila.scrollLeft + 34) fila.scrollLeft = a - 40; else if (z > fila.scrollLeft + fila.clientWidth - 34) fila.scrollLeft = z - fila.clientWidth + 40; }
    medir();
  });
  return el("div", { class: "carril" }, izq, fila, der);
}
addEventListener("resize", () => carrilVivo?.());
const ORDINAL = ["", "primero", "segundo", "tercero", "cuarto", "quinto", "sexto", "séptimo", "octavo", "noveno", "décimo"];
function pintarFoco(ctx) {
  if (ctx) foco.ctx = ctx;
  if (!foco.ctx) return;
  const { m, m7, proy } = foco.ctx, P = D.prob;
  const partidos = ordenar(m.media).filter((x) => D.config.partidos[x] && (m.media[x] >= 0.8 || (proy.total[x] || 0) > 0));
  if (foco.k && !partidos.includes(foco.k)) foco.k = null;
  const k = foco.k;
  const donde = $("#foco-tira .fila")?.scrollLeft || 0; // al repintar, la fila se queda donde estaba
  const fila = el("div", { class: "fila" }, el("button", { type: "button", "aria-pressed": k ? "false" : "true", onclick: () => elegirFoco(null) }, "Todos"),
    ...partidos.map((x) => el("button", { type: "button", "data-k": x, "aria-pressed": k === x ? "true" : "false", style: k === x ? { background: color(x), borderColor: color(x), color: "#fff" } : null, onclick: () => elegirFoco(k === x ? null : x) },
      el("i", { class: "punto", style: { background: k === x ? "#fff" : color(x) } }), nombre(x))));
  poner($("#foco-tira"), el("div", { class: "eti" }, el("span", {}, k ? `Toda la app, centrada en ${nombre(k)}` : "Céntrate en un partido"),
    k ? botonEnlace("Copiar enlace", () => enlaceA({ partido: k, pestana: pestanaActual })) : null), carril(fila, donde), k ? notaAviso(k, { class: "foco-aviso" }) : null);
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
    el("p", { class: "pie-bloque" }, `Con las encuestas de hoy ${X ? `sacaría ${X} ${X === 1 ? "asiento" : "asientos"}` : "no sacaría ningún asiento"}${a23 != null ? (X === a23 ? ", los mismos que en 2023" : `, ${Math.abs(X - a23)} ${X > a23 ? "más" : "menos"} que en 2023`) : ""}.${pp ? ` Como las encuestas fallan, lo normal es que acabe ${entreDos(Math.min(pp.p10, X), Math.max(pp.p90, X))}.` : ""}`),
    ag.length ? el("div", { class: "medidores" }, ...ag) : null));

  // Provincias
  const con = proy.provincias.filter((p) => p.escanos[k]), maxS = Math.max(1, ...con.map((p) => p.escanos[k]));
  const rel = (p) => Math.max(p.aspirante.falta, 0) / (10 / (p.n + 1)), votos = (p) => votosDe(Math.max(p.aspirante.falta, 0), p.n);
  const defiende = proy.provincias.filter((p) => p.aspirante && p.ultimo?.p === k).sort((a, b) => rel(a) - rel(b)).slice(0, 4);
  const persigue = proy.provincias.filter((p) => p.aspirante?.p === k).sort((a, b) => rel(a) - rel(b)).slice(0, 4);
  const irA = (n) => { quitarDelEnlace("provincia"); mapa.sel = n; try { localStorage.setItem("mi-provincia", n); } catch {} pintarMapa(mapa.proy); $("#ficha-provincia").scrollIntoView({ behavior: "smooth", block: "center" }); };
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
  const dS = datosSenado(), XS = sen[k] || 0, S = P?.senado_mayoria === dS.M ? P.senado?.[k] : null, misDes = dS.des[k] || 0;
  caja("senado").append(art(`${nombre(k)} en el Senado`,
    el("p", { class: "respuesta" }, XS ? `${cap(elP(k))} sacaría ${XS} de los 208 senadores que se eligen${S ? `, y lo normal es que acabe ${entreDos(Math.min(S.p10, XS), Math.max(S.p90, XS))}` : ""}. Sería el partido más votado en ${primeras.length} ${primeras.length === 1 ? "provincia" : "provincias"}${primeras.length && primeras.length <= 6 ? ` (${lista(primeras)})` : ""} y el segundo en ${segundas.length}.` : `Con las encuestas de hoy ${elP(k)} no sacaría senadores. Para sacarlos hay que ser el primero o el segundo partido de una provincia.`, misDes ? ` Tiene ${misDes} ${misDes === 1 ? "designado" : "designados"} por las comunidades, que no ${misDes === 1 ? "cambia" : "cambian"} con estas elecciones. La mayoría del Senado son ${dS.M} de ${dS.total}.` : null),
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
  if (!hayGraficas(lienzo)) return;
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
    const cu = P.curva;
    if (cu?.exponente) $("#met-curva").textContent = `Medido con ${cu.casos} casos de 2016, 2019 y 2023: un partido el doble de grande tiene un error ${fmt1.format(Math.pow(2, cu.exponente))} veces mayor, y a los partidos que solo se presentan en su territorio las encuestas les fallan ${fmt1.format(cu.estatales / cu.territoriales)} veces menos que a los de toda España del mismo tamaño.`;
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
  /* La hora de arriba es la de la última lectura buena de encuestas, que es de lo que cuelga todo lo demás. Antes se cogía
     la más reciente entre encuestas y noticias, y si las encuestas dejaban de leerse la hora seguía pareciendo de ahora
     porque las noticias la renovaban. Cada cosa avisa por separado cuando se queda atrás. */
  const tE = D.encuestas?.actualizado, tP = D.prob?.actualizado, tN = D.noticias?.actualizado, act = tE || tP || tN;
  if (!act) { $("#cuenta-act").textContent = ""; return; }
  const d = new Date(act), hace_dias = Math.round((fechaD(diaMadrid()) - fechaD(diaMadrid(d))) / DIA);
  $("#cuenta-act").textContent = `actualizado ${hace_dias <= 0 ? "a las" : hace_dias === 1 ? "ayer a las" : `el ${fFecha.format(d)} a las`} ${fHoraMadrid.format(d)}`;
  $("#actualizado").textContent = `Datos actualizados ${hace(act)}.`;
  const horasDe = (t) => t ? (Date.now() - new Date(t)) / 3600000 : null, rato = (h) => h < 48 ? `${Math.round(h)} horas` : `${Math.round(h / 24)} días`;
  const hE = horasDe(tE), hP = horasDe(tP), hN = horasDe(tN);
  const aviso = hE != null && hE > 3 ? `Las encuestas no se han podido leer desde hace ${rato(hE)}. Lo que ves es la última lectura buena.`
    : hP != null && hP > 3 ? `Las probabilidades no se han podido rehacer desde hace ${rato(hP)}. Pueden no cuadrar del todo con la media de hoy.`
    : hN != null && hN > 6 ? `Los titulares no se actualizan desde hace ${rato(hN)}.` : "";
  $("#aviso-datos").textContent = aviso;
  $("#aviso-datos").hidden = !aviso;
}

const NOMBRES = ["config", "base2023", "encuestas", "fiabilidad", "noticias", "porra", "agenda", "probabilidades", "analisis", "probabilidades_historial", "mapa", "europeas2024"];
async function cargarDatos() {
  const datos = await Promise.all(NOMBRES.map(cargar));
  // Si falla la red en un refresco se conserva lo que ya había
  NOMBRES.forEach((n, i) => { const k = n === "base2023" ? "base" : n === "probabilidades" ? "prob" : n === "probabilidades_historial" ? "historial" : n; if (datos[i] != null || D[k] == null) D[k] = datos[i]; });
  if (D.europeas2024 && D.base) D.base.europeas = D.europeas2024;
  // Los resultados no existen hasta que cierran las urnas. Pedirlos antes solo deja un error 404 en la consola del navegador.
  if (D.config && Date.now() >= new Date(D.config.eleccion.cierre_urnas).getTime()) { const r = await cargar("resultados"); if (r != null || D.resultados == null) D.resultados = r; }
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
  contarPersona();
  if (Date.now() - ultimaComprobacion > 4.5 * 60000 && await hayDatosNuevos()) { await cargarDatos(); pintarTodo({ conservarSim: true }); }
  else if (diaMadrid() !== diaPintado) pintarTodo({ conservarSim: true });
  pintarCabecera();
}

(async function iniciar() {
  await cargarDatos();
  if (!D.config || !D.base) { $("#r-ganando").textContent = "No se han podido cargar los datos base."; return; }
  try { mapa.sel = localStorage.getItem("mi-provincia") || null; } catch {}
  leerEnlace();
  $("#compartir").addEventListener("click", compartir);
  pintarTodo();
  D.listo = true;
  pintarCabecera();
  // Quien llega con el enlace de una provincia y sin pestaña va directo a su ficha
  activarPestana(location.hash.slice(1) || (enlace.provincia ? "mapa" : ""));
  if (enlace.provincia && pestanaActual === "mapa") requestAnimationFrame(() => $("#ficha-provincia").scrollIntoView({ block: "center" }));
  hayDatosNuevos();
  setInterval(refrescar, 60000);
  document.addEventListener("visibilitychange", refrescar);
})();

/* ---------- Visitas, solo para quien hace la app ----------
   Al final de Metodología hay un desplegable que pide una clave. Es una clave de GoatCounter con permiso solo para leer
   estadísticas. Se guarda en este dispositivo (nunca en el repositorio) y con ella la app lee las cifras y las enseña
   arriba de Metodología. El dispositivo que tiene la clave es del autor, así que deja de contar como visita: se marca
   con «skipgc», que es la señal que el propio contador respeta. Sin clave no se pide ni se enseña nada.
   GoatCounter admite 4 peticiones por segundo y el navegador hace dos por cada lectura (la de permiso y la de verdad),
   así que las lecturas van en fila, de una en una y con un respiro entre ellas. Si aun así una choca, se reintenta. */
const VIS = { clave: null, datos: null, periodo: "semana", detalle: {}, todos: false, cargando: false, error: null, leido: null };
const VIS_DESDE = "2026-10-09"; // el día que se puso el contador
const VIS_API = (document.querySelector("script[data-goatcounter]")?.dataset.goatcounter || "").replace(/\/count$/, "/api/v0");
try { VIS.clave = localStorage.getItem("clave-visitas") || null; if (VIS.clave) localStorage.setItem("skipgc", "t"); } catch {}
const VIS_ERROR = {
  clave: "Esa clave no vale.",
  permiso: "La clave vale, pero no tiene permiso para leer estadísticas.",
  prisa: "El contador pide ir más despacio. Espera un momento y pulsa Actualizar.",
  red: "No se ha podido conectar con el contador. Puede que este navegador lo bloquee o que no haya conexión.",
  fallo: "El contador ha respondido con un error. Prueba más tarde.",
};
const VIS_PERIODOS = [["hoy", "Hoy"], ["semana", "Últimos 7 días"], ["todo", null]];
const VIS_USOS = [...Object.values(NOMBRE_PESTANA).map((n) => `Pestaña ${n}`), "Usa el modo partido", "Usa monta tu caso", "Comparte la foto", "Abre el menú Más"];
const visUso = (n) => ({ "Pestaña Hoy": "Vuelven a Hoy", "Usa el modo partido": "Modo partido", "Usa monta tu caso": "Monta tu caso", "Comparte la foto": "Compartir la foto", "Abre el menú Más": "Menú Más" })[n] || n.replace(/^Pestaña /, "");
/* De dónde llega una visita, dicho con nombre conocido. Vale tanto para la página de la que viene como para la
   etiqueta que se le ponga al enlace (…/elecciones-29n/?ref=instagram). Lo que no se reconoce se enseña tal cual. */
function visOrigen(n) {
  const t = (n || "").trim().toLowerCase(), sitio = t.split("/")[0];
  if (!t) return "Sin origen";
  if (sitio === "1985xose.github.io") return "Desde la propia app";
  for (const [patron, nombre] of [[/linkedin|lnkd\.in/, "LinkedIn"], [/instagram|^insta$|^ig$/, "Instagram"], [/facebook|^fb\.com$|^fb$/, "Facebook"], [/whatsapp|^wa\.me$|^wasap$/, "WhatsApp"], [/telegram|^t\.me$/, "Telegram"],
    [/twitter|^t\.co$|^x\.com$|^x$/, "X"], [/google/, "Google"], [/bing\.|^bing$/, "Bing"], [/duckduckgo/, "DuckDuckGo"], [/finofilipino/, "Finofilipino"], [/forocoches/, "Forocoches"], [/reddit/, "Reddit"],
    [/youtube|^youtu\.be$/, "YouTube"], [/^github\.com$/, "GitHub"], [/tiktok/, "TikTok"], [/bsky|bluesky/, "Bluesky"], [/threads\.net|^threads$/, "Threads"], [/mastodon/, "Mastodon"]]) if (patron.test(sitio)) return nombre;
  return sitio.includes(".") ? n : cap(n.trim());
}
const visPais = (() => { let dn; try { dn = new Intl.DisplayNames("es", { type: "region" }); } catch {} return (x) => { try { return (x.id && dn?.of(x.id.toUpperCase())) || x.name || "No se sabe"; } catch { return x.name || "No se sabe"; } }; })();
/* El instante en que empieza un día en la península, para pedir al contador justo desde ahí. */
function inicioDia(dia) {
  const t = new Date(dia + "T00:00:00Z");
  const m = /GMT([+-]\d+)/.exec(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Madrid", timeZoneName: "shortOffset" }).format(t));
  return new Date(t.getTime() - (m ? +m[1] : 1) * 3600000);
}
const visISO = (d) => d.toISOString().replace(/\.\d+Z$/, "Z");
const visPausa = (ms) => new Promise((r) => setTimeout(r, ms));
async function visUna(ruta, params, clave) {
  const u = new URL(VIS_API + ruta);
  for (const [k, v] of Object.entries(params || {})) u.searchParams.set(k, v);
  let r;
  try { r = await fetch(u, { headers: { Authorization: `Bearer ${clave}`, "Content-Type": "application/json" }, cache: "no-store" }); } catch { throw new Error("red"); }
  if (!r.ok) throw new Error(r.status === 401 ? "clave" : r.status === 403 ? "permiso" : r.status === 429 ? "prisa" : "fallo");
  return r.json();
}
let visFila_ = Promise.resolve(), visUltima = 0;
const VIS_RESPIRO = 650; // ms entre lecturas: dos peticiones por lectura, menos de 4 por segundo
function visPedir(ruta, params, clave) {
  const tarea = visFila_.then(async () => {
    for (let intento = 0; ; intento++) {
      const espera = visUltima + VIS_RESPIRO - Date.now();
      if (espera > 0) await visPausa(espera);
      visUltima = Date.now();
      try { return await visUna(ruta, params, clave); }
      catch (e) { if ((e.message === "prisa" || e.message === "red") && intento < 2) { await visPausa(1500); continue; } throw e; }
    }
  });
  visFila_ = tarea.catch(() => {});
  return tarea;
}
const visFin = () => new Date(Math.ceil((Date.now() + 1000) / 3600000) * 3600000); // la hora en punto siguiente
/* Una sola lectura trae cada página y cada uso con sus cifras día a día y hora a hora. De ahí salen las entradas, las
   personas, la lista de días, las horas y «Qué miran». Los avisos «Persona …» se apartan: son la cuenta de personas. */
async function visLeer(clave) {
  const r = await visPedir("/stats/hits", { start: visISO(inicioDia(VIS_DESDE)), end: visISO(visFin()), daily: "true", limit: "100" }, clave);
  const hits = r.hits || [], porDia = (h) => Object.fromEntries((h.stats || []).map((s) => [s.day, s.daily || 0]));
  // De 23:00 a 24:00 el contador devuelve también el día de mañana, vacío. Si se colara, «Hoy» sería mañana y saldría a cero.
  const hoyD = diaMadrid(), dias = [...new Set(hits.flatMap((h) => (h.stats || []).map((s) => s.day)))].filter((d) => d >= VIS_DESDE && d <= hoyD).sort();
  if (!dias.includes(hoyD)) dias.push(hoyD);
  const esPersona = (h) => h.event && /^Persona /.test(h.path || ""), esError = (h) => h.event && /^Error /.test(h.path || "");
  const entradas = hits.filter((h) => !h.event), usos = hits.filter((h) => h.event && !esPersona(h) && !esError(h));
  const suma = {}, horas = {};
  for (const h of entradas) for (const s of h.stats || []) {
    suma[s.day] = (suma[s.day] || 0) + (s.daily || 0);
    const hh = (horas[s.day] ||= new Array(24).fill(0));
    (s.hourly || []).forEach((n, i) => { if (i < 24) hh[i] += n || 0; });
  }
  // Personas: nuevas, de antes, sin memoria y las que vuelven según los días que hacía (vuelve[1] … vuelve[7])
  const per = { nueva: {}, antes: {}, sinmem: {}, vuelve: Array.from({ length: 8 }, () => ({})) };
  let inicio = null; // el primer día y la primera hora con algún aviso de persona: desde ahí se cuentan personas
  for (const h of hits.filter(esPersona)) {
    const m = /^Persona (nueva|de antes|sin memoria|vuelve (\d+))$/.exec(h.path);
    if (!m) continue;
    const cual = m[1] === "nueva" ? per.nueva : m[1] === "de antes" ? per.antes : m[1] === "sin memoria" ? per.sinmem : per.vuelve[Math.max(1, Math.min(7, +m[2]))];
    for (const s of h.stats || []) {
      if (s.day < VIS_DESDE || !s.daily) continue;
      cual[s.day] = (cual[s.day] || 0) + s.daily;
      const hora = (s.hourly || []).findIndex((x) => x > 0);
      if (hora >= 0 && (!inicio || s.day < inicio.dia || (s.day === inicio.dia && hora < inicio.hora))) inicio = { dia: s.day, hora };
    }
  }
  return { dias, entradas: suma, horas, per, inicio, mas: !!r.more, ids: entradas.map((h) => h.path_id).filter((x) => x != null), usos: usos.map((h) => ({ nombre: h.path, dias: porDia(h) })),
    errores: hits.filter(esError).map((h) => ({ nombre: h.path.replace(/^Error /, ""), dias: porDia(h) })) };
}
/* Personas (dispositivos) que entran un día: las nuevas, las de antes y todas las que vuelven. */
const visPerDia = (X, d) => (X.per.nueva[d] || 0) + (X.per.antes[d] || 0) + X.per.vuelve.reduce((a, v) => a + (v[d] || 0), 0);
/* Personas distintas de un tramo, sin repetir a nadie. Cada dispositivo se cuenta el primer día del tramo en que
   aparece: ese día es nuevo, o de antes, o vuelve tras más días de los que lleva recorridos el tramo. Para el tramo
   completo basta con nuevas más de antes, porque cada dispositivo manda uno de esos dos avisos una sola vez en la vida. */
function visDistintas(X, dias, p) {
  const fijos = (d) => (X.per.nueva[d] || 0) + (X.per.antes[d] || 0);
  if (p === "todo") return dias.reduce((a, d) => a + fijos(d), 0);
  const ini = fechaD(dias[0]);
  return dias.reduce((a, d) => { const pos = Math.round((fechaD(d) - ini) / DIA); return a + fijos(d) + X.per.vuelve.reduce((b, v, k) => b + (k > pos ? (v[d] || 0) : 0), 0); }, 0);
}
/* Entradas del tramo que llegaron antes de que se empezaran a contar personas. */
function visSinMedir(X, dias) {
  if (!X.inicio) return visSuma(X.entradas, dias);
  return dias.reduce((a, d) => a + (d < X.inicio.dia ? (X.entradas[d] || 0) : d === X.inicio.dia ? (X.horas[d] || []).slice(0, X.inicio.hora).reduce((x, y) => x + y, 0) : 0), 0);
}
/* ¿La cuenta de GoatCounter corta los días a la misma hora que España? Si no, «Hoy» no cuadraría. */
function mismaHora(zona) {
  try {
    const desfase = (z, t) => new Intl.DateTimeFormat("en-GB", { timeZone: z, timeZoneName: "shortOffset" }).formatToParts(t).find((x) => x.type === "timeZoneName")?.value;
    return [new Date(), new Date("2026-07-15T12:00:00Z"), new Date("2026-11-15T12:00:00Z")].every((t) => desfase(zona, t) === desfase("Europe/Madrid", t));
  } catch { return null; }
}
/* El parte del robot (data/estado.json): cómo le ha ido a cada paso en su última pasada. Es un fichero de la propia web. */
const VIS_ROBOT = [["encuestas", "Lectura de encuestas", 3], ["simulacion", "Simulación", 3], ["noticias", "Noticias", 6], ["fiabilidad", "Notas de las empresas", 30]];
async function visRobot() {
  VIS.robot = await cargar("estado"); // null si el robot aún no ha dejado ninguno
  pintarVisitas();
}
function pintarRobot() {
  const R = VIS.robot, out = [el("h3", {}, "Estado del robot")];
  if (R === undefined) return [...out, el("p", { class: "sub" }, "Leyendo…")];
  if (!R) return [...out, el("p", { class: "sub" }, "El robot todavía no ha dejado su primer parte. Saldrá aquí tras su siguiente pasada.")];
  const fH = new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" });
  const rato = (h) => h < 48 ? `${Math.round(h)} horas` : `${Math.round(h / 24)} días`;
  let malos = 0;
  const filas = VIS_ROBOT.map(([paso, nombre, limite]) => {
    const x = R[paso];
    if (!x) return el("div", { class: "vis-robot" }, el("i", { class: "nada" }, "·"), el("span", {}, el("b", {}, nombre), el("small", {}, "Sin parte todavía.")));
    const h = (Date.now() - new Date(x.hora)) / 3600000, parado = h > limite, mal = !x.ok || parado;
    if (mal) malos++;
    return el("div", { class: `vis-robot${mal ? " mal" : ""}` }, el("i", {}, mal ? "!" : "✓"), el("span", {}, el("b", {}, nombre),
      el("small", {}, mal ? (x.ok ? `No da señales desde hace ${rato(h)}. Su última pasada fue bien, pero ya tendría que haber vuelto.` : `${x.mensaje || "Ha fallado, sin más detalle."}`) : `${x.mensaje}. ${cap(hace(x.hora))}.`),
      mal && !x.ok ? el("small", {}, `${cap(hace(x.hora))}.${x.ultima_buena ? ` La última vez que fue bien, el ${fH.format(new Date(x.ultima_buena))}.` : ""}`) : null));
  });
  out.push(el("p", { class: "sub" }, malos ? `${malos === 1 ? "Hay un paso que no va bien" : `Hay ${malos} pasos que no van bien`}. La web sigue enseñando los últimos datos buenos.` : "Todo ha ido bien en la última pasada."), ...filas);
  const d = R.encuestas?.detalle || {}, lista = (t, arr) => arr?.length ? el("p", { class: "sub" }, el("b", {}, t), arr.join(", "), ".") : null;
  out.push(lista("Columnas de Wikipedia que se ignoran por no ser un partido conocido, ", d.ignoradas), lista("Encuestas apartadas por números que no cuadran o fecha futura, ", d.apartadas), lista("Encuestas ya leídas a las que les han cambiado algún número, ", d.corregidas));
  const tg = R.telegram;
  out.push(el("p", { class: "sub" }, tg?.activo ? "Avisos por Telegram, activados." : tg?.problema ? `Avisos por Telegram, sin funcionar. ${tg.problema}` : "Avisos por Telegram, sin configurar."));
  return out.filter(Boolean);
}
async function visZona() {
  if (VIS.zona !== undefined) return;
  VIS.zona = null;
  try {
    const r = await visPedir("/me", {}, VIS.clave), z = String(r?.user?.settings?.timezone || "");
    const nombre = z.includes(".") ? z.slice(z.indexOf(".") + 1) : z, ok = nombre ? mismaHora(nombre) : null;
    if (ok != null) VIS.zona = { nombre, ok };
  } catch {}
  pintarVisitas();
}
const visDias = (p) => p === "hoy" ? VIS.datos.dias.slice(-1) : p === "semana" ? VIS.datos.dias.slice(-7) : VIS.datos.dias;
const visSuma = (porDia, dias) => dias.reduce((a, d) => a + (porDia[d] || 0), 0);
/* Lo demás que sabe el contador, solo de las entradas a la app (no de los usos) y del tramo elegido. Cada lista se
   pide por separado y se pinta en cuanto llega. Si una falla, las otras siguen. */
const VIS_LISTAS = [["paises", "locations"], ["pantallas", "sizes"], ["sistemas", "systems"], ["navegadores", "browsers"]];
function visDetalle(p) {
  if (VIS.detalle[p] || !VIS.datos?.ids.length) return;
  const det = VIS.detalle[p] = {}, datos = VIS.datos, repintar = () => { if (VIS.datos === datos) pintarVisitas(); };
  const q = { start: visISO(inicioDia(visDias(p)[0])), end: visISO(visFin()), include_paths: datos.ids.join(","), limit: "30" };
  /* El origen se pide página a página y no a la lista general de orígenes de GoatCounter, porque esa lista esconde las
     entradas que llegan desde la propia app (alguien que ya la tenía abierta y vuelve) y entonces la suma no cuadra. */
  Promise.all(datos.ids.slice(0, 4).map((id) => visPedir(`/stats/hits/${id}`, { start: q.start, end: q.end, limit: "50" }, VIS.clave))).then((rs) => {
    const filas = {};
    for (const r of rs) for (const x of r.refs || []) { const n = visOrigen(x.name); filas[n] = (filas[n] || 0) + x.count; }
    det.origen = filas;
  }).catch((e) => { det.origen = { error: VIS_ERROR[e.message] || VIS_ERROR.fallo }; }).finally(repintar);
  for (const [clave, ruta] of VIS_LISTAS) {
    visPedir(`/stats/${ruta}`, q, VIS.clave).then((r) => {
      const filas = {}, st = r.stats || [];
      if (clave === "paises") for (const x of st) { const n = visPais(x); filas[n] = (filas[n] || 0) + x.count; }
      else if (clave === "pantallas") { const t = Object.fromEntries(st.map((x) => [x.id, x.count])); Object.assign(filas, { "Móvil": t.phone || 0, "Tableta": t.tablet || 0, "Ordenador": (t.desktop || 0) + (t.desktophd || 0), "No se sabe": t.unknown || 0 }); }
      else for (const x of st) { const n = x.name || "No se sabe"; filas[n] = (filas[n] || 0) + x.count; }
      det[clave] = filas;
    }).catch((e) => { det[clave] = { error: VIS_ERROR[e.message] || VIS_ERROR.fallo }; }).finally(repintar);
  }
}
async function visActualizar() {
  if (!VIS.clave || VIS.cargando) return;
  VIS.cargando = true; VIS.error = null; pintarVisitas();
  visRobot();
  try { VIS.datos = await visLeer(VIS.clave); VIS.detalle = {}; VIS.leido = new Date(); visZona(); visDetalle(VIS.periodo); }
  catch (e) { VIS.error = VIS_ERROR[e.message] || VIS_ERROR.fallo; }
  VIS.cargando = false; pintarVisitas();
}
function visElegir(p) { VIS.periodo = p; visDetalle(p); pintarVisitas(); }
function visQuitar() {
  if (!confirm("Se quita la clave de este dispositivo y vuelve a contar como una visita más. ¿Seguro?")) return;
  try { localStorage.removeItem("clave-visitas"); localStorage.removeItem("skipgc"); } catch {}
  Object.assign(VIS, { clave: null, datos: null, detalle: {}, error: null, leido: null, zona: undefined, robot: undefined });
  pintarVisitas();
}
const visFila = (nombre, n, max, valor, nota) => el("div", { class: "vis-fila" }, el("span", {}, nombre, nota ? el("small", {}, nota) : null),
  el("span", { class: "barra" }, el("i", { style: { width: `${max ? Math.min(100, Math.round(100 * n / max)) : 0}%` } })), el("b", {}, valor ?? fmt0.format(n)));
/* Una lista del detalle: título, y debajo las filas, «Leyendo…» si aún no ha llegado o el aviso si ha fallado. */
function visLista(titulo, sub, filas, N, nota) {
  const cab = [el("h3", {}, titulo), sub ? el("p", { class: "sub" }, sub) : null];
  if (!filas) return [...cab, el("p", { class: "sub" }, "Leyendo…")];
  if (filas.error) return [...cab, el("p", { class: "vis-aviso" }, filas.error)];
  const o = Object.entries(filas).filter(([, c]) => c > 0).sort((a, b) => b[1] - a[1]);
  return [...cab, ...(o.length ? o.map(([n, c]) => visFila(n, c, N, null, nota?.(n))) : [el("p", { class: "sub" }, "Sin datos todavía.")])];
}
const fDiaVis = new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", timeZone: "UTC" });
const plural = (n, uno, varios) => `${fmt0.format(n)} ${n === 1 ? uno : varios}`;
function pintarVisitas() {
  const caja = $("#visitas"), puerta = $("#visitas-puerta");
  if (!caja || !puerta) return;
  puerta.hidden = !!VIS.clave;
  if (!VIS.clave) return caja.replaceChildren();
  const hijos = [el("h2", {}, "Visitas"), el("div", { class: "vis-estado" }, el("i", {}, "✓"), "Este dispositivo tiene la clave y no cuenta como visita.")];
  const pie = el("div", { class: "vis-pie" }, el("span", {}, VIS.cargando ? "Leyendo…" : VIS.leido ? `Leído a las ${new Intl.DateTimeFormat("es-ES", { hour: "2-digit", minute: "2-digit" }).format(VIS.leido)}` : ""),
    el("button", { type: "button", onclick: visActualizar, disabled: VIS.cargando }, "Actualizar"), el("button", { type: "button", class: "enlace", onclick: visQuitar }, "Quitar la clave de aquí"));
  if (VIS.error) hijos.push(el("p", { class: "vis-aviso" }, VIS.error));
  const X = VIS.datos;
  if (X) {
    const p = VIS.periodo, dias = visDias(p), N = visSuma(X.entradas, dias), hay = !!X.inicio;
    const desde = `Desde el ${new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "long", timeZone: "UTC" }).format(fechaD(X.dias[0]))}`;
    const tramo = p === "hoy" ? "de hoy" : p === "semana" ? "de los últimos 7 días" : "desde el principio";
    const P = hay ? visDistintas(X, dias, p) : 0;
    // Las tres cifras. Si ya se cuentan personas mandan ellas y las entradas van debajo. Si no, solo entradas.
    hijos.push(el("div", { class: "vis-cifras" }, ...VIS_PERIODOS.map(([q, t]) => { const dd = visDias(q), e = visSuma(X.entradas, dd);
      return el("button", { type: "button", "aria-pressed": p === q ? "true" : "false", onclick: () => visElegir(q) },
        el("b", {}, fmt0.format(hay ? visDistintas(X, dd, q) : e)), el("span", {}, t || desde), el("small", {}, hay ? `${visDistintas(X, dd, q) === 1 ? "persona" : "personas"} · ${plural(e, "entrada", "entradas")}` : e === 1 ? "entrada" : "entradas")); })));
    // Avisos: lo que hace que la cifra de arriba no sea redonda, dicho aquí mismo
    const ojo = [], cuando = hay ? `${fDiaVis.format(fechaD(X.inicio.dia))} a las ${X.inicio.hora} h` : "";
    const fuera = visSinMedir(X, dias), sinMem = visSuma(X.per.sinmem, dias);
    if (!hay) ojo.push("Todavía no hay cifra de personas. Empieza a contarse con la primera visita que llegue con esta versión. De momento solo se ven entradas, que cuentan otra vez a quien vuelve pasadas unas horas.");
    else if (fuera > 0) ojo.push(`Las personas se cuentan desde el ${cuando}. Antes de ese momento hay ${plural(fuera, "entrada", "entradas")} ${tramo} que no están en la cifra de personas, porque entonces no se podía saber quién repetía.`);
    if (sinMem > 0) ojo.push(`${plural(sinMem, "entrada viene", "entradas vienen")} de navegadores que no dejan guardar nada, como algunos modos privados. No se sabe si son personas nuevas o repetidas, así que no están en la cifra de personas.`);
    if (VIS.zona && VIS.zona.ok === false) ojo.push(`Tu cuenta de GoatCounter está en la zona horaria ${VIS.zona.nombre} y no en la de España. Los días se cortan a otra hora y la cifra de hoy puede no cuadrar. Se cambia en los ajustes de GoatCounter.`);
    if (X.mas) ojo.push("El contador solo ha devuelto las 100 primeras páginas y usos. Alguna cifra puede quedarse corta.");
    if (X.ids.length > 4) ojo.push("Hay más de 4 direcciones de entrada distintas y el origen solo se ha leído de las 4 con más visitas.");
    if (ojo.length) hijos.push(el("ul", { class: "vis-ojo" }, ...ojo.map((t) => el("li", {}, t))));
    hijos.push(...pintarRobot());
    // Día a día, del más reciente al más antiguo
    const lista = [...X.dias].reverse(), corta = VIS.todos ? lista : lista.slice(0, 14);
    const medido = (d) => hay && d >= X.inicio.dia, max = Math.max(1, ...lista.map((d) => medido(d) ? visPerDia(X, d) : 0)), maxE = Math.max(1, ...lista.map((d) => X.entradas[d] || 0));
    hijos.push(el("h3", {}, "Día a día"), el("p", { class: "sub" }, hay ? "Personas distintas cada día. Debajo, cuántas eran nuevas y cuántas entradas hubo." : "Entradas a la app. Si alguien vuelve pasadas unas horas, cuenta otra vez."),
      ...corta.map((d) => { const e = X.entradas[d] || 0, nombre = cap(fDiaVis.format(fechaD(d)));
        if (!hay) return visFila(nombre, e, maxE);
        if (!medido(d)) return visFila(nombre, 0, max, "sin medir", plural(e, "entrada", "entradas"));
        return visFila(nombre, visPerDia(X, d), max, null, `${plural(X.per.nueva[d] || 0, "nueva", "nuevas")} · ${plural(e, "entrada", "entradas")}${d === X.inicio.dia && X.inicio.hora > 0 ? ` · personas desde las ${X.inicio.hora} h` : ""}`); }),
      lista.length > 14 ? el("button", { type: "button", class: "ver-mas", onclick: () => { VIS.todos = !VIS.todos; pintarVisitas(); } }, VIS.todos ? "Ver solo los últimos 14 días" : `Ver los ${lista.length} días`) : null);
    // Quiénes son y cada cuánto vuelven
    if (hay) {
      const nuevas = visSuma(X.per.nueva, dias), antes = visSuma(X.per.antes, dias), vuelta = X.per.vuelve.map((v) => visSuma(v, dias)), vueltas = vuelta.reduce((a, b) => a + b, 0);
      hijos.push(el("h3", {}, "Quiénes son"), el("p", { class: "sub" }, `${plural(P, "persona distinta", "personas distintas")} ${tramo}. Cada dispositivo cuenta una sola vez, entre las veces que entre.`),
        visFila("Nuevas", nuevas, P, null, "Es la primera vez que entran"),
        antes ? visFila("Ya venían de antes", antes, P, null, "Entraron cuando aún no se contaban personas") : null,
        p === "todo" ? null : visFila("Repiten", P - nuevas - antes, P, null, p === "hoy" ? "Habían entrado otro día" : "Habían entrado antes de estos 7 días"),
        p === "hoy" ? null : visFila("Visitas de vuelta", vueltas, Math.max(P, vueltas), null, "Veces que alguien que ya había entrado volvió otro día"));
      if (vueltas) hijos.push(el("h3", {}, "Cada cuánto vuelven"), el("p", { class: "sub" }, `De las ${plural(vueltas, "vuelta", "vueltas")} ${tramo}, cuánto hacía de la visita anterior.`),
        ...[["Al día siguiente", vuelta[1]], ["A los 2 o 3 días", vuelta[2] + vuelta[3]], ["De 4 a 6 días", vuelta[4] + vuelta[5] + vuelta[6]], ["Una semana o más", vuelta[7]]].filter(([, n]) => n > 0).map(([t, n]) => visFila(t, n, vueltas)));
    }
    const de = `${plural(N, "entrada", "entradas")} ${tramo}`;
    const D2 = VIS.detalle[p] || {};
    if (N) {
      // A qué horas
      const hh = new Array(24).fill(0); for (const d of dias) (X.horas[d] || []).forEach((n, i) => { hh[i] += n; });
      const tope = Math.max(...hh), punta = hh.indexOf(tope);
      if (tope > 0) hijos.push(el("h3", {}, "A qué horas entran"), el("p", { class: "sub" }, `De las ${de}. La hora con más es la de las ${punta}, con ${fmt0.format(tope)}.`),
        el("div", { class: "vis-horas", role: "img", "aria-label": `Entradas por hora. La hora con más es la de las ${punta}, con ${tope}.` }, ...hh.map((n, i) => el("i", { title: `${i} h, ${n}`, style: { height: `${Math.max(n ? 8 : 2, Math.round(100 * n / tope))}%` }, class: n ? null : "cero" }))),
        el("div", { class: "vis-horas-eje" }, ...["0 h", "6 h", "12 h", "18 h", "23 h"].map((t) => el("span", {}, t))));
      hijos.push(...visLista("De dónde llegan", `De las ${de}. Para comparar con GoatCounter hay que mirar allí la fila /elecciones-29n de la lista Pages. Su lista «Top referrers» da cifras más altas porque suma además cada pestaña que se abre.`, D2.origen, N,
        (n) => n === "Sin origen" ? "WhatsApp, app instalada o dirección escrita. Con ?ref=sitio al final del enlace, sale el sitio" : n === "Desde la propia app" ? "Gente que ya la tenía abierta y vuelve a ella" : null));
    }
    const usos = X.usos.map((u) => ({ nombre: u.nombre, n: visSuma(u.dias, dias) })).filter((u) => u.n > 0).sort((a, b) => b.n - a.n);
    const sinUso = VIS_USOS.filter((n) => !usos.some((u) => u.nombre === n)).map(visUso);
    hijos.push(el("h3", {}, "Qué miran"), el("p", { class: "sub" }, N ? `En cuántas de las ${de} se hizo cada cosa.` : `No hay entradas ${tramo}.`),
      ...usos.map((u) => visFila(visUso(u.nombre), u.n, N, N ? `${fmt0.format(u.n)} de ${fmt0.format(N)}` : fmt0.format(u.n))),
      sinUso.length && N ? visFila(sinUso.join(", "), 0, N, "0") : null);
    // Fallos de programa que le han saltado a algún visitante
    const fallos = X.errores.map((u) => ({ nombre: u.nombre, n: visSuma(u.dias, dias) })).filter((u) => u.n > 0).sort((a, b) => b.n - a.n), maxF = Math.max(1, ...fallos.map((u) => u.n));
    hijos.push(el("h3", {}, "Fallos en la app"), el("p", { class: "sub" }, fallos.length ? `Fallos de programa que le han saltado a algún visitante ${tramo}. Delante va la versión, el fichero y la línea.` : `Ningún fallo de programa apuntado ${tramo}.`),
      ...fallos.slice(0, 12).map((u) => visFila(u.nombre, u.n, maxF)));
    if (N) hijos.push(...visLista("Desde qué países", `De las ${de}.`, D2.paises, N), ...visLista("Con qué entran", null, D2.pantallas, N), ...visLista("Con qué sistema", null, D2.sistemas, N), ...visLista("Con qué navegador", null, D2.navegadores, N));
    // Qué es exacto y qué no, siempre a mano
    const z = VIS.zona;
    hijos.push(el("details", { class: "como dentro vis-fiable" }, el("summary", {}, "Qué es exacto y qué no"),
      el("p", {}, el("b", {}, "Exacto. "), "Las personas. Cada dispositivo deja guardada en sí mismo la fecha de su primera y de su última visita, y avisa una sola vez al día. Por eso nadie se cuenta dos veces, ni hoy, ni en los últimos 7 días, ni en el total."),
      hay ? el("p", {}, el("b", {}, "Desde cuándo. "), `Las personas se cuentan desde el ${cuando}. Lo anterior solo tiene entradas.`) : null,
      el("p", {}, el("b", {}, "Aproximado. "), "Las entradas, que es lo que cuenta GoatCounter por su cuenta. La misma persona vuelve a contar si entra pasadas 8 horas o cambia de red, por ejemplo del wifi a los datos. El origen, las horas, los países, las pantallas, los sistemas y los navegadores van por entradas."),
      el("p", {}, el("b", {}, "No se ve. "), "Quien lleva bloqueador de contadores, como Firefox en modo estricto, Brave o un bloqueador de anuncios. No aparece ni como persona ni como entrada y no hay forma de contarlo desde una página como esta."),
      el("p", {}, el("b", {}, "Cuenta de más. "), "Una persona con móvil y ordenador son dos. También quien abre el enlace dentro de Instagram o LinkedIn y luego en su navegador. Y quien entra en modo privado o borra los datos del navegador vuelve a salir como nueva."),
      el("p", {}, el("b", {}, "Tus dispositivos. "), "Cuentan como cualquier otro hasta que metas la clave en cada uno."),
      el("p", {}, el("b", {}, "La hora. "), z ? (z.ok ? "La cuenta de GoatCounter está en hora de España, así que los días cuadran." : `La cuenta de GoatCounter está en ${z.nombre}, no en hora de España.`) : "No se ha podido comprobar en qué zona horaria está la cuenta de GoatCounter.")));
  } else { if (!VIS.error) hijos.push(el("p", { class: "sub" }, "Leyendo las cifras…")); hijos.push(...pintarRobot()); }
  hijos.push(pie);
  // Se repinta a menudo mientras llegan las listas: que no se cierre lo que estuviera abierto
  const abierto = caja.querySelector(".vis-fiable")?.open;
  caja.replaceChildren(el("article", { class: "pregunta vis" }, ...hijos.filter(Boolean)));
  if (abierto) caja.querySelector(".vis-fiable").open = true;
}
$("#visitas-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const campo = $("#visitas-clave"), aviso = $("#visitas-aviso"), clave = campo.value.trim();
  if (!clave) return;
  aviso.textContent = "Comprobando…";
  try {
    const datos = await visLeer(clave);
    try { localStorage.setItem("clave-visitas", clave); localStorage.setItem("skipgc", "t"); } catch {}
    Object.assign(VIS, { clave, datos, detalle: {}, error: null, leido: new Date() });
    campo.value = ""; aviso.textContent = "";
    visRobot(); visZona(); visDetalle(VIS.periodo); pintarVisitas(); $("#visitas").scrollIntoView({ block: "start" });
  } catch (err) { aviso.textContent = VIS_ERROR[err.message] || VIS_ERROR.fallo; }
});
pintarVisitas();

/* ---------- Tarjeta para compartir ---------- */
async function compartir() {
  contar("Comparte la foto");
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
