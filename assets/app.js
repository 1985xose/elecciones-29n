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
/* La insignia de un partido: su logo (config.partidos[k].logo, un fichero en assets/logos/) o, si no lo tiene, una chapa
   redonda con sus siglas en su color. Mismo tamaño y forma para todos, que ninguno destaque por tener logo. */
const SIGLAS = { PP: "PP", PSOE: "PSOE", Vox: "VOX", Sumar: "FA", Podemos: "POD", SALF: "SALF", ERC: "ERC", Junts: "JxC", Bildu: "EHB", PNV: "PNV", BNG: "BNG", CCa: "CC", UPN: "UPN", AC: "AC", AA: "AA" };
const siglas = (k) => D.config.partidos[k]?.siglas || SIGLAS[k] || String(k).slice(0, 4).toUpperCase();
/* En la tira de partidos y en la ficha hay sitio para el logo entero (alto fijo, ancho el que sea). Sin logo, la chapa. */
function logoTira(k, clase = "logo-tira") {
  const p = D.config.partidos[k];
  if (!p?.logo) return insignia(k, "mini");
  return el("img", { class: clase, src: p.logo, alt: "", loading: "lazy", onerror: (ev) => { ev.target.replaceWith(insignia(k, "mini")); } });
}
function insignia(k, clase = "") {
  const p = D.config.partidos[k];
  if (p?.logo) return el("img", { class: `insignia logo ${clase}`, src: p.logo, alt: "", loading: "lazy", style: { "--c": color(k) }, onerror: (ev) => { ev.target.replaceWith(el("span", { class: `insignia chapa ${clase}`, style: { "--c": color(k) }, "aria-hidden": "true" }, siglas(k))); } });
  return el("span", { class: `insignia chapa ${clase}`, style: { "--c": color(k) }, "aria-hidden": "true" }, siglas(k));
}
/* El nombre de una lista en una provincia: si en esa comunidad va en coalición con otros (config.coaliciones), el de la coalición */
const coalicionEn = (ccaa, k) => (D.config?.coaliciones || []).find((c) => c.ccaa === ccaa && c.a === k);
const nombreEn = (k, ccaa) => coalicionEn(ccaa, k)?.nombre || nombre(k);
/* El nombre de una lista al Senado en una provincia: la coalición solo de Senado si la hay ahí, si no el de Congreso */
const coalicionSen = (prov, k) => (D.config?.coaliciones_senado || []).find((c) => c.a === k && !(c.excepto || []).includes(prov));
const elPSen = (k, prov) => coalicionSen(prov, k) ? coalicionSen(prov, k).nombre : elP(k);
const nombreSen = (k, prov) => coalicionSen(prov, k)?.nombre || nombreEn(k, ccaaDe(prov));
const ccaaDe = (nombreProv) => D.base?.provincias.find((x) => x.nombre === nombreProv)?.ccaa;
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
/* Un porcentaje tal como se lee en pantalla, con un decimal, y la diferencia entre dos de ellos. 32,1 menos 26,6 son 5,5
   aunque por dentro sean 32,12 y 26,55 y la resta exacta dé 5,57. Así ninguna resta contradice a los números de al lado. */
const fmtR1 = new Intl.NumberFormat("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1, useGrouping: false });
const r1 = (v) => +fmtR1.format(v), dif1 = (a, b) => r1(r1(a) - r1(b));
/* Texto que se lee sobre el color de un partido, con contraste de 4,5 o más. Primero se prueba el blanco y después la
   tinta oscura. Si ninguno llega, se oscurece el fondo lo justo para que el blanco se lea. Con «op» el color va aclarado
   (las provincias del mapa), ahí el fondo no se toca y se coge el que mejor se lea de los dos. */
const lumin = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const contraste = (a, b) => { const x = lumin(a), y = lumin(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const TINTA = [23, 32, 46], BLANCO = [255, 255, 255], sobreHecho = new Map();
function sobre(c, op = 1) {
  const clave = `${c}|${op}`;
  if (sobreHecho.has(clave)) return sobreHecho.get(clave);
  let r = { background: c, color: "#fff" };
  if (/^#[0-9a-f]{6}$/i.test(c)) {
    const n = parseInt(c.slice(1), 16), f = [n >> 16 & 255, n >> 8 & 255, n & 255].map((v) => Math.round(v * op + 255 * (1 - op)));
    if (contraste(BLANCO, f) >= 4.5) r = { background: c, color: "#fff" };
    else if (contraste(TINTA, f) >= 4.5) r = { background: c, color: "#17202E" };
    else if (op < 1) r = { background: c, color: contraste(BLANCO, f) >= contraste(TINTA, f) ? "#fff" : "#17202E" };
    else { let g = f; for (let i = 0; i < 14 && contraste(BLANCO, g) < 4.5; i++) g = g.map((v) => Math.round(v * 0.96)); r = { background: "#" + g.map((v) => v.toString(16).padStart(2, "0")).join(""), color: "#fff" }; }
  }
  sobreHecho.set(clave, r);
  return r;
}
// La franja de una cifra, dicha con palabras. Cuando las dos puntas coinciden no se escribe «entre 0 y 0».
const entreDos = (a, b) => a === b ? `en ${a}` : `entre ${a} y ${b}`;
// Como replaceChildren, pero se salta los huecos. replaceChildren a secas escribe la palabra «null» en pantalla.
const poner = (cont, ...hijos) => cont.replaceChildren(...hijos.flat().filter((h) => h != null && h !== false));
const ordenar = (o) => Object.keys(o).sort((a, b) => o[b] - o[a]);
// «PP, PSOE y Vox». Delante de un nombre que empieza por i la «y» pasa a «e»: «40dB e IMOP»
const lista = (arr) => arr.length <= 1 ? arr.join("") : arr.slice(0, -1).join(", ") + (/^h?i(?!e)/i.test(String(arr[arr.length - 1])) ? " e " : " y ") + arr[arr.length - 1];
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
  if (id !== pestanaActual) { const sec = document.getElementById(id); sec.classList.remove("entra"); void sec.offsetWidth; sec.classList.add("entra"); }
  pestanaActual = id;
  animarNumeros(document.getElementById(id));
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
/* Teclado. Lo que se puede tocar y no es un botón de verdad (las provincias de los mapas, las tarjetas de encuestas) se
   activa con Intro o con la barra espaciadora, y el foco vuelve al mismo sitio cuando se repinta. */
document.addEventListener("keydown", (ev) => {
  if (ev.key !== "Enter" && ev.key !== " ") return;
  const t = ev.target;
  if (!t?.matches?.('[role="button"]') || t.matches("button, a, summary, input, select")) return;
  ev.preventDefault();
  const id = t.id, prov = t.dataset?.p, caja = t.parentElement?.closest("[id]");
  t.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  requestAnimationFrame(() => (id ? document.getElementById(id) : prov && caja ? caja.querySelector(`[data-p="${CSS.escape(prov)}"]`) : null)?.focus());
});

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
    el("span", { class: "txt" }, n.partido && !opciones.sinPartido ? el("span", { class: "tag con-insignia", style: sobre(color(n.partido)) }, insignia(n.partido, "mini"), nombre(n.partido)) : null, n.titulo, el("span", { class: "m" }, `${n.fuente} · ${hace(n.fecha)}`)));
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
    el("span", { class: "tit" }, o.titulo), el("span", { class: "svg", html: aguja(o.p, o.color) }), el("b", { class: "num-sube" }, `${r100(o.p)} %`), el("small", {}, cap(palabra(o.p))))));
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
  asientos.forEach((s, i) => { svg += `<circle style="--i:${i}" cx="${(s.x * E).toFixed(1)}" cy="${(-s.y * E).toFixed(1)}" r="${(rp * E).toFixed(1)}" fill="${colores[i] || "var(--linea)"}"${(extra.marcado && partidoDe[i] !== extra.marcado) || (extra.apagado && extra.apagado(partidoDe[i])) ? ' fill-opacity=".2"' : ""}/>`; });
  // El número de asientos de cada partido grande, dentro de su parte del arco
  if (!extra.sinNumeros) { let acc = 0; for (const k of claves) { const n = escanos[k], i0 = acc, i1 = acc + n - 1; acc += n;
    if (n >= 14 && !(solo && k !== solo)) { const a = (asientos[i0].a + asientos[i1].a) / 2, RT = 0.72 * E;
      svg += `<text class="num-hemi" x="${(RT * Math.cos(a)).toFixed(1)}" y="${(-RT * Math.sin(a) + 5).toFixed(1)}" text-anchor="middle" font-size="14" font-weight="800">${n}</text>`; } } }
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
    el("b", {}, insignia(k), nombre(k)), el("span", {}, texto),
    foco.k === k ? null : el("button", { type: "button", class: "boton", onclick: () => { alCerrar(); elegirFoco(k); window.scrollTo({ top: 0, behavior: "smooth" }); } }, `Centrar toda la app en ${nombre(k)}`))] : []));
}
const leyenda = (cont, escanos, extra, alTocar, marcado) => cont.replaceChildren(...ordenar(escanos).filter((k) => escanos[k] > 0).map((k) => el(alTocar ? "button" : "span", alTocar ? { type: "button", "aria-pressed": marcado === k ? "true" : "false", onclick: () => alTocar(k) } : {}, insignia(k), `${nombre(k)} ${escanos[k]}`, extra ? extra(k) : null)));

/* ---------- Hoy, las preguntas ---------- */
let graficoHistorial, graficoTendencia;
const gob = { sel: null, hemi: null };
function pintarHoy(m, m7, proy) {
  const dias = Math.round((fechaD(D.config.eleccion.fecha) - hoy()) / DIA);
  const P = D.prob, der = escenario(D.config.principales.derecha), izq = escenario(D.config.principales.izquierda);
  const o = ordenar(m.media);

  // 0. Las tarjetas del día (última encuesta, polémica, provincia reñida, qué te toca hacer)
  pintarTarjetasHoy(proy);

  // 1. ¿Quién va ganando?
  if (o.length) {
    $("#r-ganando").replaceChildren(el("b", {}, `${nombre(o[0])}.`), ` Tiene el ${fmt1.format(m.media[o[0]])} % de los votos ${D.sinEncuestas ? "con el resultado de 2023, que es lo que se enseña mientras no se puedan cargar las encuestas" : "en la media de encuestas"}. Le siguen ${nombre(o[1])} con el ${fmt1.format(m.media[o[1]])} % y ${nombre(o[2])} con el ${fmt1.format(m.media[o[2]])} %.`);
    pintarBarrasVotos(m, m7, proy);
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
    pintarPortada(m, m7, proy, { fav, otro, X, Y: sumaEsc(otro), dias });
    $("#compartir").hidden = false;
    const op = Object.keys(P.partidos).sort((a, b) => P.partidos[b].p50 - P.partidos[a].p50).filter((k) => P.partidos[k].p90 > 0).slice(0, 7), MAX = 240;
    $("#abanicos").replaceChildren(...op.map((k) => { const x = P.partidos[k];
      return el("div", { class: "abanico" }, el("span", { class: "nom" }, nombre(k)), el("div", { class: "pista" }, el("div", { class: "m176" }),
        el("div", { class: "rango", style: { left: `${x.p10 / MAX * 100}%`, width: `${(x.p90 - x.p10) / MAX * 100}%`, background: color(k) } }),
        el("div", { class: "mediana", style: { left: `calc(${x.p50 / MAX * 100}% - 2px)`, background: color(k) } }),
        el("span", { class: "num", style: { left: `calc(${x.p90 / MAX * 100}% + 8px)` } }, `${x.p10} a ${x.p90}`))); }),
      el("div", { class: "eje" }, ...[0, 50, 100, 150, 176, 200].map((v) => el("span", { style: { left: `${v / MAX * 100}%`, color: v === 176 ? "var(--bronce-texto)" : null, fontWeight: v === 176 ? 700 : null } }, v))));
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
    pintarPortada(m, m7, proy, { dias });
    hemiciclo($("#hemiciclo"), esc, 10); leyenda($("#leyenda"), esc); fraseArco($("#hemi-arco"), null);
    $("#g-medidores").replaceChildren(); $("#g-medidor-detalle").replaceChildren();
    $("#r-gobernar").textContent = o.length ? `Si se votara hoy, ${nombre(ordenar(esc)[0])} sacaría ${esc[ordenar(esc)[0]]} asientos. Las probabilidades se calculan en la próxima actualización.` : "";
  }

  // 3. ¿Ha cambiado algo?
  const cambios = Object.keys(m.media).filter((k) => m7.media[k] != null && m.media[k] >= 2).map((k) => ({ k, d: dif1(m.media[k], m7.media[k]) })).sort((a, b) => Math.abs(b.d) - Math.abs(a.d));
  const fuertes = cambios.filter((x) => Math.abs(x.d) >= 0.3);
  const u = D.analisis?.ultimas?.[0];
  let fr = fuertes.length ? `${fuertes.length === 1 ? "Un poco." : "Algo."} ${lista(fuertes.slice(0, 3).map((x) => `${nombre(x.k)} ${x.d > 0 ? "sube" : "baja"} ${fmt1.format(Math.abs(x.d))} puntos`))}.` : (cambios.length ? "Poco. Ningún partido se mueve más de tres décimas en la media." : "Aún no hay datos.");
  if (u) fr += ` La última encuesta es de ${u.empresa}, del ${fFecha.format(fechaD(u.fin))}, y ${u.veredicto === "ruido" ? "dice más o menos lo mismo que las demás" : u.veredicto === "leve" ? "se sale un poco de lo habitual en esa empresa" : "trae un cambio de verdad respecto a lo que suele dar esa empresa"}.`;
  $("#r-cambios").textContent = fr;
  $("#g-cambios").replaceChildren(...cambios.slice(0, 4).map((x) => el("div", { class: "cambio" }, el("span", { class: "nom" }, insignia(x.k), nombre(x.k)),
    el("span", { class: `d ${!x.d ? "" : x.d > 0 ? "sube" : "baja"}` }, !x.d ? "igual" : signo(x.d)), el("span", { class: "m" }, `${fmt1.format(m7.media[x.k])} hace una semana, ${fmt1.format(m.media[x.k])} hoy`))));
  pintarHistorial();

  // 5. Titulares
  $("#titulares").replaceChildren(...(D.noticias?.generales || []).slice(0, 4).map((n) => noticia(n, { grande: true })), ...(D.noticias?.polemicas || []).slice(0, 2).map((n) => noticia(n)));
  pintarPortadaNoticias();

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
  pintarCamino(ag, sig, dias);
}
/* La cuenta atrás en grande y el camino hasta el 29N: una línea con cada hito de la agenda, los pasados apagados, el
   siguiente latiendo, y al tocar uno se abre su detalle. En móvil la línea va en vertical. */
const camino = { abierto: null, todo: false };
function pintarCamino(ag, sig, dias) {
  const conv = fechaD(D.config.eleccion.fecha), h0 = hoy();
  $("#cuenta-29n").replaceChildren(el("div", { class: "cuenta-num" }, el("b", { class: "num-sube" }, dias > 0 ? String(dias) : dias === 0 ? "Hoy" : "29N"), el("span", {}, dias > 1 ? "días para el 29N" : dias === 1 ? "día, se vota mañana" : dias === 0 ? "se vota, de 9:00 a 20:00" : "elecciones celebradas")),
    el("div", { class: "cuenta-txt" }, el("b", {}, "Domingo 29 de noviembre de 2026"), el("span", {}, "Elecciones generales. Congreso y Senado.")));
  const hitos = ag.map((x) => ({ x, t: fechaD(x.fecha), fin: fechaD(x.fin || x.fecha) })), t0 = Math.min(...hitos.map((h) => +h.t)), t1 = +conv;
  const pos = (t) => Math.max(0, Math.min(100, (t - t0) / (t1 - t0) * 100));
  const hoyPos = pos(+h0);
  $("#camino-29n").replaceChildren(el("div", { class: "camino-linea" }, el("i", { class: "hecho", style: { "--p": `${hoyPos}%` } }), el("i", { class: "hoy", style: { "--p": `${hoyPos}%` }, title: "Hoy" })),
    el("ol", { class: "camino-hitos" }, ...hitos.map((h, i) => { const pasado = h.fin < h0, siguiente = h.x === sig, abierto = camino.abierto === i;
      // Plegado: el último pasado, los seis siguientes y el día de la votación. El resto sale con «Ver todo»
      const iSig = Math.max(0, hitos.findIndex((q) => q.x === sig)), esVoto = h.x.fecha === D.config.eleccion.fecha;
      if (!camino.todo && !esVoto && (i < iSig - 1 || i > iSig + 5)) return null;
      return el("li", { class: `hito${pasado ? " pasado" : ""}${siguiente ? " siguiente" : ""}${abierto ? " abierto" : ""}${h.x.fecha === D.config.eleccion.fecha ? " voto" : ""}`, style: { "--p": `${pos(+h.t)}%` } },
        el("button", { type: "button", "aria-expanded": abierto ? "true" : "false", onclick: () => { camino.abierto = abierto ? null : i; contar("Abre un hito del camino"); pintarCamino(ag, sig, dias); } },
          el("i", { class: "punto-hito" }), el("span", { class: "dia" }, h.x.fin ? `${fFecha.format(h.t)} al ${fFecha.format(h.fin)}` : fFecha.format(h.t)), el("span", { class: "tit" }, h.x.titulo)),
        abierto && h.x.detalle ? el("p", { class: "det" }, h.x.detalle) : null); })),
    hitos.length > 8 ? el("button", { type: "button", class: "atajo volver camino-todo", onclick: () => { camino.todo = !camino.todo; contar("Ver todo el camino"); pintarCamino(ag, sig, dias); } }, camino.todo ? "Ver menos" : `Ver todo el calendario, ${hitos.length} fechas`) : null);
}
/* Chispa de cada partido en la fila de arriba: su media de los últimos 90 días, en 10 puntos, cada una a su escala */
let chispasHechas = null;
function chispasFoco(partidos) {
  const dia = diaMadrid();
  if (chispasHechas?.dia === dia && partidos.every((k) => k in chispasHechas.v)) return chispasHechas.v;
  const fechas = []; for (let i = 9; i >= 0; i--) fechas.push(new Date(+hoy() - i * 10 * DIA));
  const medias = fechas.map((t) => calcMedia(t).media), v = {};
  for (const k of partidos) {
    const ys = medias.map((m) => m[k]).filter((y) => y != null); if (ys.length < 3) continue;
    const lo = Math.min(...ys), hi = Math.max(...ys), span = Math.max(hi - lo, 0.6);
    v[k] = medias.map((m, i) => m[k] == null ? null : `${(i / 9 * 32 + 1).toFixed(1)},${(13 - (m[k] - lo) / span * 11 - 1).toFixed(1)}`).filter(Boolean).join(" ");
  }
  chispasHechas = { dia, v };
  return v;
}

/* ---------- ¿Quién va ganando?: barras tocables ----------
   Una barra por partido con al menos un 1 %. Al tocar una se abre debajo su chispa de 90 días, la franja de asientos del
   modelo y el cambio en una semana. Solo una abierta a la vez. */
const votos = { abierto: null };
function pintarBarrasVotos(m, m7, proy) {
  const o = ordenar(m.media).filter((k) => m.media[k] >= 1), max = Math.max(...o.map((k) => m.media[k]), 1), ch = chispasFoco(o);
  const fila = (k) => { const d = m7.media[k] != null ? dif1(m.media[k], m7.media[k]) : 0, abierta = votos.abierto === k, pk = D.prob?.partidos?.[k];
    const b = el("button", { type: "button", class: `fila-v${abierta ? " abierta" : ""}`, "aria-expanded": abierta ? "true" : "false", style: { "--c": color(k) }, onclick: () => { votos.abierto = abierta ? null : k; contar("Toca un partido en Hoy"); pintarBarrasVotos(m, m7, proy); } },
      el("span", { class: "nom" }, insignia(k), nombre(k)),
      el("span", { class: "pista" }, el("i", { style: { width: `${m.media[k] / max * 100}%` } })),
      el("span", { class: "num num-sube" }, `${fmt1.format(m.media[k])} %`), el("small", { class: d ? (d > 0 ? "sube" : "baja") : "igual" }, d ? `${d > 0 ? "▲" : "▼"} ${fmt1.format(Math.abs(d))}` : "="));
    if (!abierta) return b;
    const det = el("div", { class: "fila-v-detalle", style: { "--c": color(k) } },
      el("div", { class: "dato" }, el("b", {}, `${proy.total[k] || 0}`), el("span", {}, "asientos hoy")),
      el("div", { class: "dato" }, el("b", {}, pk ? `${pk.p10}–${pk.p90}` : "–"), el("span", {}, "lo normal, 80 % de las veces")),
      el("div", { class: "dato" }, el("b", {}, d ? `${d > 0 ? "+" : ""}${fmt1.format(d)}` : "="), el("span", {}, "puntos en una semana")),
      ch[k] ? el("div", { class: "dato chispa-grande" }, el("svg", { viewBox: "0 0 34 14", "aria-hidden": "true", html: `<polyline points="${ch[k]}"/>` }), el("span", {}, "últimos 90 días")) : null,
      el("button", { type: "button", class: "boton pequeno", onclick: (ev) => { ev.stopPropagation(); elegirFoco(k); window.scrollTo({ top: 0, behavior: "smooth" }); } }, `Toda la app sobre ${nombre(k)}`));
    return [b, det];
  };
  $("#g-ganando").replaceChildren(...o.flatMap(fila));
}

const lista2 = (xs) => lista(xs);
/* ---------- Noticias: portada, pulso del día, polémicas y verificaciones ----------
   La portada es la última noticia con foto, a toda anchura, y las siguientes en mosaico. El pulso son burbujas por partido
   según cuántos titulares lo nombran, y al tocar una se filtra todo a ese partido. Las polémicas van por partido, con
   cuántas lleva cada uno, y las verificaciones con su veredicto si el titular lo dice. */
const not = { filtro: null };
function pintarPortadaNoticias() {
  const N = D.noticias; if (!N) return;
  const ahora = Date.now(), reciente = (n) => n.fecha && ahora - new Date(n.fecha) < 2 * 3600000;
  // En directo
  const ult = (N.generales || [])[0];
  $("#not-directo").hidden = !ult; if (ult) $("#not-directo").querySelector("span").textContent = `última ${hace(ult.fecha)}`;
  // El pulso del día: titulares de las últimas 24 h por partido, y en rojo cuántas polémicas lleva. El tamaño junta las dos cosas.
  const polPor = {}; for (const p of N.polemicas || []) if (p.partido) polPor[p.partido] = (polPor[p.partido] || 0) + 1;
  const cuenta = Object.entries(N.partidos || {}).map(([k, arr]) => [k, (arr || []).filter((n) => n.fecha && ahora - new Date(n.fecha) < 24 * 3600000).length, polPor[k] || 0])
    .filter(([k, n, pol]) => (n > 0 || pol > 0) && D.config.partidos[k] && !D.config.partidos[k].no_concurre).sort((a, b) => (b[1] + 2 * b[2]) - (a[1] + 2 * a[2])).slice(0, 10);
  const maxN = Math.max(...cuenta.map((x) => x[1] + 2 * x[2]), 1);
  $("#not-pulso").replaceChildren(el("span", { class: "eti" }, "De quién se habla"), el("div", { class: "pulso-fila" }, not.filtro ? el("button", { type: "button", class: "burbuja todo", style: { "--c": "var(--tinta)", "--t": "44px" }, title: "Ver todos los partidos", onclick: () => { not.filtro = null; pintarPortadaNoticias(); } }, el("b", {}, "✕"), el("span", {}, "todos")) : null, ...cuenta.map(([k, n, pol]) => el("button", { type: "button", class: `burbuja${not.filtro === k ? " activa" : ""}`, "aria-pressed": not.filtro === k ? "true" : "false", title: `${n} titulares en 24 h${pol ? `, ${pol} polémica${pol === 1 ? "" : "s"}` : ""}`, style: { "--c": color(k), "--t": `${44 + 30 * (n + 2 * pol) / maxN}px` }, onclick: () => { not.filtro = not.filtro === k ? null : k; contar("Filtra noticias por partido"); pintarPortadaNoticias(); } }, el("b", {}, n), D.config.partidos[k]?.logo ? insignia(k, "mini burbuja-logo") : el("span", {}, nombre(k)), pol ? el("i", { class: "pol-n", "aria-label": `${pol} polémicas` }, pol) : null))));
  // Portada y mosaico (filtradas por partido si se ha tocado una burbuja)
  const lista = not.filtro ? (N.partidos?.[not.filtro] || []) : (N.generales || []);
  const iPortada = lista.findIndex((n) => n.imagen), portada = iPortada >= 0 ? lista[iPortada] : null, resto = lista.filter((n, i) => i !== iPortada).slice(0, 8);
  $("#not-portada").replaceChildren(...(portada ? [el("a", { class: "portada-n", href: portada.enlace, target: "_blank", rel: "noopener" },
    el("img", { src: portada.imagen, alt: "", referrerpolicy: "no-referrer", onerror: (ev) => { ev.target.closest("a").classList.add("sin-foto"); } }),
    el("div", { class: "velo" }, reciente(portada) ? el("span", { class: "nuevo" }, "Nuevo") : null, portada.partido && not.filtro ? null : (portada.partido ? el("span", { class: "tag con-insignia", style: sobre(color(portada.partido)) }, insignia(portada.partido, "mini"), nombre(portada.partido)) : null), el("h3", {}, portada.titulo), el("span", { class: "m" }, `${portada.fuente} · ${hace(portada.fecha)}`)))] : [el("p", { class: "vacio" }, not.filtro ? `Hoy no hay titulares de ${nombre(not.filtro)}.` : "Los titulares llegan en la próxima actualización.")]));
  $("#not-mosaico").replaceChildren(...resto.map((n) => { const a = noticia(n, { grande: !!n.imagen, sinPartido: !!not.filtro }); if (reciente(n)) a.classList.add("reciente"); return a; }));
  // Google News pega al final del titular el nombre del medio o de la sección («· La Buloteca · Maldita.es»); se quita para leerlo limpio
  const limpio = (t) => { let r = String(t || ""); for (let i = 0; i < 3; i++) { const m = r.match(/^(.*\S)\s*[·|–-]\s*([^·|–-]{2,28})$/); if (!m) break; r = m[1]; } return r; };
  // Polémicas: la tira de partidos con su cuenta (filtra), la primera como tarjeta grande con la foto si el robot la trae
  // o la marca de agua del partido si no, y el resto numeradas.
  const porP = {};
  for (const x of N.polemicas || []) if (x.partido) (porP[x.partido] ||= []).push(x);
  const ordenP = Object.keys(porP).sort((a, b) => porP[b].length - porP[a].length), nPol = ordenP.reduce((a, k) => a + porP[k].length, 0);
  const todasP = (N.polemicas || []).slice().sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  const todas = todasP.filter((x) => !not.filtro || x.partido === not.filtro);
  $("#pol-ultima").textContent = todasP.length ? `última ${hace(todasP[0].fecha)} · ${nPol} esta semana` : "";
  $("#pol-reparto").replaceChildren(el("button", { type: "button", class: `pol-chip todas${not.filtro ? "" : " activa"}`, style: { "--c": "var(--tinta)" }, "aria-pressed": not.filtro ? "false" : "true", onclick: () => { if (!not.filtro) return; not.filtro = null; pintarPortadaNoticias(); } }, "Todas ", el("b", {}, nPol)), ...ordenP.map((k) => el("button", { type: "button", class: `pol-chip${not.filtro === k ? " activa" : ""}`, style: { "--c": color(k) }, "aria-pressed": not.filtro === k ? "true" : "false", onclick: () => { not.filtro = not.filtro === k ? null : k; contar("Filtra polémicas por partido"); pintarPortadaNoticias(); } }, insignia(k, "mini"), `${nombre(k)} `, el("b", {}, porP[k].length))));
  const sup = (x) => el("span", { class: "pol-sup" }, insignia(x.partido, "mini"), el("i", { class: "pol-tag" }, nombre(x.partido)), el("time", { class: reciente(x) ? "fresca" : "" }, hace(x.fecha)));
  const grande = (x) => el("a", { class: `pol-grande${x.imagen ? " con-foto" : ""}`, href: x.enlace, target: "_blank", rel: "noopener", style: { "--c": color(x.partido) } },
    x.imagen ? el("img", { src: x.imagen, alt: "", loading: "lazy", referrerpolicy: "no-referrer", onerror: (ev) => { ev.target.closest("a").classList.remove("con-foto"); ev.target.remove(); } }) : el("span", { class: "marca", "aria-hidden": "true" }, nombre(x.partido)),
    el("span", { class: "pol-grande-txt" }, sup(x), el("span", { class: "pol-tit" }, limpio(x.titulo)), el("span", { class: "pol-fuente" }, x.fuente)));
  const item = (x, i) => el("li", { class: "pol-item", style: { "--c": color(x.partido) } },
    el("a", { href: x.enlace, target: "_blank", rel: "noopener" }, el("span", { class: "pol-num" }, String(i + 2).padStart(2, "0")),
      el("span", { class: "pol-cuerpo" }, sup(x), el("span", { class: "pol-tit" }, limpio(x.titulo)), el("span", { class: "pol-fuente" }, x.fuente))));
  $("#polemicas-todas").replaceChildren(...(todas.length ? [grande(todas[0]), ...(todas.length > 1 ? [el("ol", { class: "pol-lista" }, ...todas.slice(1, 8).map(item))] : [])] : [el("p", { class: "vacio" }, not.filtro ? `Sin polémicas ${deP(not.filtro)} esta semana.` : "Sin polémicas recogidas esta semana.")]));
  // Verificaciones: el veredicto si el titular lo dice
  const veredicto = (t) => /\bbulo|falso|falsa|no es cierto|es mentira|desinforma/i.test(t) ? ["Bulo", "bulo"] : /engañoso|engañosa|fuera de contexto|a medias|descontextualiz/i.test(t) ? ["Engañoso", "enganoso"] : /\bverdad|es cierto|confirmad|sí es real/i.test(t) ? ["Verdad", "verdad"] : /\bqué sabemos|explicamos|claves\b|¿/i.test(t) ? ["Explicación", "explica"] : null;
  const V = N.verificaciones_generales || [];
  $("#verificaciones-todas").replaceChildren(...(V.length ? V.slice(0, 6).map((x) => { const v = veredicto(x.titulo);
    return el("a", { class: `verif${v ? " " + v[1] : ""}`, href: x.enlace, target: "_blank", rel: "noopener" }, el("span", { class: "sello-v" }, x.fuente), v ? el("span", { class: "ver-eti" }, v[0]) : null, el("span", { class: "txt" }, limpio(x.titulo)), el("span", { class: "m" }, hace(x.fecha))); }) : [el("p", { class: "vacio" }, "Sin verificaciones recogidas estos días.")]));
}

/* ---------- La portada de Hoy ----------
   Quién gobernaría y con cuánta probabilidad, en grande, y a la derecha el hemiciclo de arcos con el reparto de hoy y el
   cambio en una semana. Los arcos se dibujan uno tras otro al entrar (CSS, stroke-dashoffset). */
function pintarPortada(m, m7, proy, g) {
  const P = D.prob, esc = D.resultados?.escanos || proy.total, esc7 = Object.keys(m7.media).length ? Modelo.proyectar(m7.media, D.base).total : null;
  $("#portada-fecha").textContent = `${new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", weekday: "long", day: "numeric", month: "long" }).format(new Date())} · ${g.dias > 1 ? `faltan ${g.dias} días` : g.dias === 1 ? "se vota mañana" : g.dias === 0 ? "se vota hoy" : "elecciones celebradas"}`;
  if (g.fav && P) {
    const { fav, otro, X, Y } = g, t = tramo(fav.p), varios = fav.partidos.length > 1, dif = X - 176;
    $("#portada-titulo").replaceChildren(el("b", {}, cap(nombreEsc(fav))), t >= 3 ? ` ${varios ? "gobernarían" : "gobernaría"}, ${palabra(fav.p)}.` : t === 2 ? ", en el aire." : `, ${palabra(fav.p)}.`);
    // Tres cifras que se tocan: al tocar un bloque se iluminan sus arcos en el hemiciclo
    const resalta = (partidos) => { const svg = $("#arcos svg"); if (!svg) return; svg.classList.toggle("resalta", !!partidos); svg.querySelectorAll("path.arco").forEach((pth) => pth.classList.toggle("on", !!partidos && partidos.includes(pth.dataset.k))); };
    const cifra = (n, texto, c, partidos) => el("button", { type: "button", class: "cifra", style: { "--c": c }, onpointerenter: () => resalta(partidos), onpointerleave: () => resalta(null), onclick: () => { const ya = $("#arcos svg")?.classList.contains("resalta") && $("#arcos svg").querySelector("path.on")?.dataset.k === partidos?.[0]; resalta(ya ? null : partidos); } },
      el("b", { class: "num-sube" }, String(n)), el("span", {}, texto));
    $("#portada-cifras").replaceChildren(cifra(X, `${cap(nombreEsc(fav))}${varios ? " suman" : " saca"} hoy`, color(fav.partidos[0]), fav.partidos), cifra(176, "para gobernar", "var(--acento)", null), cifra(Y, cap(nombreEsc(otro)), color(otro.partidos[0]), otro.partidos));
    const col = color(fav.partidos[0]), R = 36, L = 2 * Math.PI * R, p = Math.max(0, Math.min(1, fav.p));
    $("#portada-anillo").replaceChildren(el("div", { class: "anillo", style: { "--c": col } },
      el("svg", { viewBox: "0 0 90 90", role: "img", "aria-label": `${r100(p)} % de probabilidad`, html: `<circle cx="45" cy="45" r="${R}" class="fondo"/><circle cx="45" cy="45" r="${R}" class="valor" style="stroke-dasharray:${L};stroke-dashoffset:${L * (1 - p)}" transform="rotate(-90 45 45)"/>` }),
      el("div", { class: "anillo-txt" }, el("b", { class: "num-sube" }, `${r100(p)} %`), el("small", {}, "de las 10.000 repeticiones"))),
      el("p", { class: "anillo-pie" }, `Probabilidad de que ${nombreEsc(fav)} ${varios ? "lleguen" : "llegue"} a 176.`));
  } else {
    const o = ordenar(esc);
    $("#portada-titulo").replaceChildren(el("b", {}, nombre(o[0])), ` va primero con ${esc[o[0]]} asientos.`);
    $("#portada-cifras").replaceChildren(el("p", { class: "portada-sub" }, "Las probabilidades se calculan en la próxima actualización."));
    $("#portada-anillo").replaceChildren();
  }
  arcos($("#arcos"), esc, esc7);
  const orden = ordenar(esc).filter((k) => esc[k] > 0);
  $("#arcos-leyenda").replaceChildren(...orden.map((k) => { const d = esc7 ? esc[k] - (esc7[k] || 0) : 0;
    return el("span", {}, insignia(k, "mini"), `${nombre(k)} `, el("b", {}, esc[k]), el("small", { class: d > 0 ? "sube" : d < 0 ? "baja" : "" }, d > 0 ? ` ▲${d}` : d < 0 ? ` ▼${-d}` : " =")); }));
}
/* El hemiciclo de arcos: un semianillo, cada partido un tramo proporcional a sus asientos, en el orden del hemiciclo.
   Los de 14 asientos o más llevan nombre, número y cambio dentro. Los pequeños van juntos en «otros» si no caben. */
function arcos(cont, esc, esc7, op = {}) {
  const total = Object.values(esc).reduce((a, b) => a + b, 0), minimo = op.minimo ?? 14;
  if (!total) { cont.replaceChildren(); return; }
  const orden = op.orden || D.config.orden_hemiciclo, sitio = (k) => orden.indexOf(k) + 1 || 99;
  const claves = Object.keys(esc).filter((k) => esc[k] > 0).sort((a, b) => sitio(a) - sitio(b));
  const colorDe = (k) => op.apagar && op.apagar(k) ? "#D7DCE3" : color(k);
  const CX = 160, CY = 158, R = 108, W = 62, pt = (f, r) => { const a = Math.PI * (1 - f); return [CX + r * Math.cos(a), CY - r * Math.sin(a)]; };
  let acc = 0, retraso = 0, svg = `<svg viewBox="0 0 320 170" role="img" aria-label="Reparto de ${total} asientos">`;
  for (const k of claves) {
    const n = esc[k], f0 = acc / total, f1 = (acc + n) / total, [x0, y0] = pt(f0, R), [x1, y1] = pt(f1, R), largo = Math.PI * R * (f1 - f0);
    acc += n;
    // Sobre un semicírculo ningún tramo pasa de 180 grados, así que el arco siempre es el corto. Un tramo que ocupe
    // más de la mitad se dibuja pasando por su punto medio, que si no el navegador no sabe por dónde ir.
    const [xm, ym] = pt((f0 + f1) / 2, R);
    svg += `<path class="arco" data-k="${k}" d="M${x0.toFixed(1)} ${y0.toFixed(1)} A${R} ${R} 0 0 1 ${xm.toFixed(1)} ${ym.toFixed(1)} A${R} ${R} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}" stroke="${colorDe(k)}" stroke-width="${W}" fill="none" style="--l:${largo.toFixed(1)};--r:${retraso}ms"/>`;
    retraso += Math.max(60, largo * 2.2);
  }
  // Tramo ya decidido de cada partido (en el Senado, los designados), rayado encima del color
  if (op.sombra) { acc = 0; for (const k of claves) { const n = esc[k], f0 = acc / total, d = Math.min(n, op.sombra[k] || 0); acc += n; if (!d) continue; const f1 = f0 + d / total, [x0, y0] = pt(f0, R), [xm, ym] = pt((f0 + f1) / 2, R), [x1, y1] = pt(f1, R);
    svg += `<path class="arco-sombra" d="M${x0.toFixed(1)} ${y0.toFixed(1)} A${R} ${R} 0 0 1 ${xm.toFixed(1)} ${ym.toFixed(1)} A${R} ${R} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}" stroke="rgba(255,255,255,.55)" stroke-width="${W}" fill="none" stroke-dasharray="3 3"/>`; } }
  // Etiquetas dentro de los arcos grandes
  acc = 0;
  for (const k of claves) {
    const n = esc[k], fm = (acc + n / 2) / total; acc += n;
    if (n < minimo || (n / total) < 0.07) continue;
    const [x, y] = pt(fm, R), d = esc7 ? n - (esc7[k] || 0) : 0, c = sobre(colorDe(k)).color;
    svg += `<text class="arco-eti" x="${x.toFixed(1)}" y="${(y - 9).toFixed(1)}" text-anchor="middle" fill="${c}" font-size="11" font-weight="700">${esc_(nombre(k))}</text>`;
    svg += `<text class="arco-eti" x="${x.toFixed(1)}" y="${(y + 9).toFixed(1)}" text-anchor="middle" fill="${c}" font-size="19" font-weight="800">${n}</text>`;
    if (d) svg += `<text class="arco-eti" x="${x.toFixed(1)}" y="${(y + 22).toFixed(1)}" text-anchor="middle" fill="${c}" font-size="9.5" font-weight="700">${d > 0 ? "▲" : "▼"} ${Math.abs(d)}</text>`;
  }
  if (!op.sin176) svg += `<line x1="${CX}" y1="${CY - R - W / 2 - 10}" x2="${CX}" y2="${CY - R - W / 2 + 4}" stroke="var(--tinta)" stroke-width="1.6"/><text x="${CX + 5}" y="${CY - R - W / 2 - 2}" font-size="11" font-weight="700" fill="var(--gris)">176</text>`;
  else { const M = Math.floor(total / 2) + 1; svg += `<line x1="${CX}" y1="${CY - R - W / 2 - 10}" x2="${CX}" y2="${CY - R - W / 2 + 4}" stroke="var(--tinta)" stroke-width="1.6" stroke-dasharray="3 3"/><text x="${CX + 5}" y="${CY - R - W / 2 - 2}" font-size="11" font-weight="700" fill="var(--gris)">${M}</text>`; }
  svg += `<text x="${CX}" y="${CY - 10}" text-anchor="middle" font-size="22" font-weight="800" fill="var(--tinta)">${total}</text><text x="${CX}" y="${CY + 4}" text-anchor="middle" font-size="9.5" font-weight="600" fill="var(--gris)">${op.unidad || "asientos"}</text></svg>`;
  cont.innerHTML = svg;
}
const esc_ = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;");

/* ---------- Las tarjetas del día ---------- */
function pintarTarjetasHoy(proy) {
  const ir = (sel) => () => { const t = $(sel); t.scrollIntoView({ behavior: "smooth", block: "center" }); t.classList.add("destacada"); setTimeout(() => t.classList.remove("destacada"), 2500); };
  // Cada tarjeta lleva un dibujo a la izquierda (vis) y el fondo teñido de su color, para que no sean cuatro cajas blancas iguales
  const tarjeta = (clase, vis, eti, titulo, sub, accion, col) => el(typeof accion === "string" ? "a" : "button", typeof accion === "string" ? { class: `tarjeta-hoy ${clase}`, href: accion, target: "_blank", rel: "noopener", style: { "--c": col || "var(--bronce)" } } : { class: `tarjeta-hoy ${clase}`, type: "button", onclick: accion, style: { "--c": col || "var(--bronce)" } },
    el("span", { class: "vis" }, vis), el("span", { class: "cuerpo" }, el("span", { class: "eti" }, eti), el("span", { class: "tit" }, titulo), sub ? el("span", { class: "sub" }, sub) : null), el("svg", { class: "flecha", viewBox: "0 0 24 24", html: '<path d="M9 5l7 7-7 7-1.4-1.4L13.2 12 7.6 6.4z"/>' }));
  const T = [];
  // 1. Última encuesta: sus tres primeros partidos en barritas, y la nota de la empresa
  const uu = D.analisis?.ultimas?.[0];
  if (uu) {
    const det = (uu.detalle || []).filter((d) => D.config.partidos[d.partido]).sort((x, y) => y.dado - x.dado).slice(0, 3), maxD = Math.max(...det.map((d) => d.dado), 1);
    const vis = el("span", { class: "mini-barras" }, ...det.map((d) => el("span", { class: "mb", style: { "--c": color(d.partido), "--w": `${Math.round(100 * d.dado / maxD)}%` } }, el("b", {}, d.dado.toFixed(1).replace(".", ",")))));
    T.push(tarjeta("t-encuesta", vis, `Última encuesta · ${fFecha.format(fechaD(uu.fin))}${uu.nota ? ` · nota ${uu.nota}` : ""}`, `${uu.empresa}${uu.encargo ? ` para ${uu.encargo}` : ""}`, uu.veredicto === "ruido" ? "Sin novedades, dentro de lo que suele dar esta empresa." : uu.veredicto === "leve" ? "Con algún movimiento." : "Con una novedad de verdad.", () => { location.hash = "#encuestas"; setTimeout(ir("#tabla-encuestas"), 60); }, "var(--acento)"));
  }
  // 2. Polémica del día: el color del partido manda
  const pol0 = D.noticias?.polemicas?.[0];
  if (pol0) T.push(tarjeta("t-polemica", el("span", { class: "sello-p", style: sobre(color(pol0.partido)) }, nombre(pol0.partido)), `Polémica del día · ${hace(pol0.fecha)}`, pol0.titulo, pol0.fuente, pol0.enlace, color(pol0.partido)));
  // 3. La provincia más reñida: su silueta partida entre los dos que se disputan el último asiento
  const aire0 = [...proy.provincias].filter((x) => x.aspirante).sort((a, b) => Math.max(a.aspirante.falta, 0) / (10 / (a.n + 1)) - Math.max(b.aspirante.falta, 0) / (10 / (b.n + 1)))[0];
  if (aire0) {
    const g = D.mapa?.provincias?.[aire0.nombre], c1 = color(aire0.ultimo.p), c2 = color(aire0.aspirante.p);
    let vis = null;
    if (g && g.d) {
      const nums = g.d.match(/-?\d+(?:\.\d+)?/g).map(Number), xs = nums.filter((_, i) => i % 2 === 0), ys = nums.filter((_, i) => i % 2 === 1);
      const x0 = Math.min(...xs), y0 = Math.min(...ys), w = Math.max(...xs) - x0, h = Math.max(...ys) - y0, m = Math.max(w, h) * 0.08;
      vis = el("svg", { class: "silueta", viewBox: `${x0 - m} ${y0 - m} ${w + 2 * m} ${h + 2 * m}`, html: `<defs><linearGradient id="grad-renida" x1="0" x2="1"><stop offset="50%" stop-color="${c1}"/><stop offset="50%" stop-color="${c2}"/></linearGradient></defs><path d="${g.d}" fill="url(#grad-renida)" stroke="#fff" stroke-width="${Math.max(w, h) / 60}" stroke-linejoin="round"/>` });
    } else vis = el("span", { class: "sello-p", style: { background: `linear-gradient(90deg, ${c1} 50%, ${c2} 50%)`, color: "#fff" } }, ABREV[aire0.nombre] || "");
    T.push(tarjeta("t-renida", el("span", { class: "renida-vis" }, vis, el("span", { class: "votos-vis" }, el("b", {}, aire0.aspirante.falta > 0 ? porVotos(aire0.aspirante.falta, aire0.n).replace(/^por unos |^por /, "") : "empate"))), "La provincia más reñida", aire0.nombre, `${nombre(aire0.ultimo.p)} tiene el último asiento y ${nombre(aire0.aspirante.p)} se lo disputa.`, () => { quitarDelEnlace("provincia"); mapa.sel = aire0.nombre; pintarMapa(mapa.proy); location.hash = "#mapa"; }, c1));
  }
  // 4. Qué te toca hacer: cuenta atrás en un anillo
  const toca = pintarTareas();
  if (toca) {
    const ab = listaTareas().filter((t) => t.grupo === "todos" && t.fase === "abierta").sort((x, y) => x.z - y.z)[0];
    const quedan = ab ? ab.quedan : null, total = ab ? Math.max(1, Math.round((ab.z - ab.a) / DIA)) : 1, f = quedan == null ? 0 : Math.max(0.03, Math.min(1, quedan / total));
    const R = 26, L = 2 * Math.PI * R;
    const vis = el("span", { class: "anillo-dias" }, el("svg", { viewBox: "0 0 64 64", html: `<circle cx="32" cy="32" r="${R}" fill="none" stroke="color-mix(in srgb, var(--c) 22%, #fff)" stroke-width="7"/><circle cx="32" cy="32" r="${R}" fill="none" stroke="var(--c)" stroke-width="7" stroke-linecap="round" stroke-dasharray="${L}" stroke-dashoffset="${(L * (1 - f)).toFixed(1)}" transform="rotate(-90 32 32)" class="anillo-tramo"/>` }),
      el("b", {}, quedan == null ? "·" : quedan === 0 ? "hoy" : quedan), quedan != null && quedan > 0 ? el("small", {}, quedan === 1 ? "día" : "días") : null);
    T.push(tarjeta("t-toca", vis, "Qué te toca hacer", toca, "Ver todos los plazos", () => { location.hash = "#el29n"; }, "var(--bronce)"));
  }
  $("#tarjetas-hoy").replaceChildren(...T);
}

/* ---------- Qué te toca hacer: los trámites del votante con sus plazos (config.tareas) ---------- */
const tareasVista = { grupo: null };
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
  const resto = ojo ? ` Ojo, ${ojo.quedan === 0 ? "hoy" : ojo.quedan === 1 ? "mañana" : `el ${diaLargo(ojo.z)}`} es el último día para ${minus(ojo.que)}.` : " Si votas por correo o estás fuera de España, toca tu píldora.";
  $("#r-tareas").textContent = toca + resto;
  const estado = (t) => t.fase === "pasada" ? (t.unDia ? "Ya pasó" : t.sin_plazo ? "Ya pasó" : "Plazo cerrado")
    : t.fase === "futura" ? (t.faltan === 1 ? (t.unDia ? "Mañana" : "Empieza mañana") : `Dentro de ${t.faltan} días`)
    : t.unDia ? "Hoy" : t.sin_plazo ? "Estos días" : t.quedan === 0 ? "Último día" : t.quedan === 1 ? "Termina mañana" : `Abierto, quedan ${t.quedan} días`;
  const fechas = (t) => t.cuando || (t.unDia ? fFecha.format(t.a) : `${fFecha.format(t.a)} al ${fFecha.format(t.z)}`);
  // Un grupo cada vez, con píldoras. Cada tarea lleva un anillo con los días que quedan.
  tareasVista.grupo = tareasVista.grupo || "todos";
  $(".conmutador.grupos-tarea").replaceChildren(...GRUPOS_TAREA.filter(([g]) => T.some((t) => t.grupo === g)).map(([g, titulo]) => el("button", { type: "button", "aria-pressed": tareasVista.grupo === g ? "true" : "false", onclick: () => { tareasVista.grupo = g; contar(`Tareas ${g}`); pintarTareas(); } }, titulo)));
  const anillo = (t) => { const total = Math.max(1, Math.round((t.z - t.a) / DIA) + 1), f = t.fase === "pasada" ? 0 : t.fase === "futura" ? 1 : Math.max(0.04, Math.min(1, (t.quedan + 1) / total)), R = 26, L = 2 * Math.PI * R;
    return el("span", { class: "anillo-dias" }, el("svg", { viewBox: "0 0 64 64", html: `<circle cx="32" cy="32" r="${R}" fill="none" stroke="color-mix(in srgb, var(--c) 22%, #fff)" stroke-width="7"/><circle cx="32" cy="32" r="${R}" fill="none" stroke="var(--c)" stroke-width="7" stroke-linecap="round" stroke-dasharray="${L}" stroke-dashoffset="${(L * (1 - f)).toFixed(1)}" transform="rotate(-90 32 32)" class="anillo-tramo"/>` }),
      el("b", {}, t.fase === "pasada" ? "✓" : t.fase === "futura" ? String(t.faltan) : t.unDia || t.sin_plazo ? "hoy" : t.quedan === 0 ? "hoy" : String(t.quedan)), t.fase === "pasada" || (t.fase === "abierta" && (t.unDia || t.sin_plazo || t.quedan === 0)) ? null : el("small", {}, t.fase === "futura" ? (t.faltan === 1 ? "día" : "días") : (t.quedan === 1 ? "día" : "días"))); };
  const suyas = T.filter((t) => t.grupo === tareasVista.grupo).sort((x, y) => x.a - y.a || x.z - y.z);
  $("#tareas").replaceChildren(el("ul", { class: "tareas" }, ...suyas.map((t) => el("li", { class: `tarea ${t.fase}`, style: { "--c": t.fase === "abierta" ? "var(--bronce)" : t.fase === "futura" ? "var(--acento)" : "var(--gris)" } },
    anillo(t), el("div", { class: "tarea-cuerpo" }, el("div", { class: "cab" }, el("span", { class: "estado" }, estado(t)), el("span", { class: "dias" }, fechas(t))),
      el("b", {}, t.que), el("span", { class: "det" }, t.como),
      t.enlace?.url ? el("a", { href: t.enlace.url, target: "_blank", rel: "noopener" }, t.enlace.texto || "Más información") : null)))));
  return toca;
}
/* ---------- Desde tu última visita ---------- */
/* La app guarda en el dispositivo cómo estaban las cifras la última vez que se abrió, para decir qué ha cambiado. No sale
   del dispositivo. Clave «visita»: { dia, datos, antes: { dia, datos } }. «antes» es la visita de otro día con la que se
   compara durante todo el día de hoy, para que al recargar no desaparezca el bloque. */
function pintarDesde(m, proy, sinDatos) {
  const caja = $("#desde"), P = D.prob, eD = escenario(D.config.principales.derecha), dia = diaMadrid();
  caja.hidden = true;
  if (sinDatos) return;
  const hace60 = new Date(+hoy() - 60 * DIA).toISOString().slice(0, 10);
  const ahora = { media: Object.fromEntries(Object.entries(m.media).filter(([, v]) => v >= 1).map(([k, v]) => [k, r1(v)])), asientos: { ...proy.total },
    prob: eD ? eD.p : null, encuestas: (D.encuestas?.encuestas || []).filter((e) => e.fin >= hace60).map((e) => e.id) };
  let g = null;
  try { g = JSON.parse(localStorage.getItem("visita") || "null"); } catch {}
  const vale = (x) => x && /^\d{4}-\d\d-\d\d$/.test(x.dia || "") && x.datos && typeof x.datos.media === "object";
  const antes = vale(g) ? (g.dia === dia ? (vale(g.antes) ? g.antes : null) : { dia: g.dia, datos: g.datos }) : null;
  try { localStorage.setItem("visita", JSON.stringify({ dia, datos: ahora, antes })); } catch { return; }
  if (!antes || antes.dia >= dia) return;
  const a = antes.datos, n = Math.round((fechaD(dia) - fechaD(antes.dia)) / DIA), lineas = [];
  // 1. La media
  const mov = Object.keys(ahora.media).filter((k) => a.media[k] != null).map((k) => ({ k, d: dif1(ahora.media[k], a.media[k]) })).filter((x) => Math.abs(x.d) >= 0.3).sort((x, y) => Math.abs(y.d) - Math.abs(x.d)).slice(0, 3);
  lineas.push(mov.length ? `En la media de encuestas, ${lista(mov.map((x) => `${nombre(x.k)} ${x.d > 0 ? "sube" : "baja"} ${fmt1.format(Math.abs(x.d))}`))}.` : "La media de encuestas está casi igual, ningún partido se ha movido más de dos décimas.");
  // 2. Los asientos de hoy
  const as = Object.keys({ ...ahora.asientos, ...(a.asientos || {}) }).map((k) => ({ k, de: (a.asientos || {})[k] || 0, a: ahora.asientos[k] || 0 })).filter((x) => x.de !== x.a).sort((x, y) => Math.abs(y.a - y.de) - Math.abs(x.a - x.de)).slice(0, 4);
  if (a.asientos && typeof a.asientos === "object") lineas.push(as.length ? `En asientos, ${lista(as.map((x) => `${nombre(x.k)} pasa de ${x.de} a ${x.a}`))}.` : "El reparto de asientos es el mismo.");
  // 3. La mayoría del bloque que va por delante
  if (eD && a.prob != null && ahora.prob != null) { const pa = palabra(a.prob), pn = palabra(ahora.prob), varios = eD.partidos.length > 1 ? "juntos " : "";
    lineas.push(pa !== pn ? `La mayoría de ${nombreEsc(eD)} ${varios}pasa de ${pa} a ${pn}.` : `La mayoría de ${nombreEsc(eD)} ${varios}sigue siendo ${pn}${Math.abs(ahora.prob - a.prob) >= 0.02 ? ` (del ${r100(a.prob)} al ${r100(ahora.prob)} %)` : ""}.`); }
  // 4. Encuestas nuevas
  const vistas = new Set(a.encuestas || []), nuevas = (D.encuestas?.encuestas || []).filter((e) => e.fin >= hace60 && !vistas.has(e.id) && !Media.esDePartido(e)), casas = [...new Set(nuevas.map((e) => e.empresa_base))];
  if (Array.isArray(a.encuestas)) lineas.push(!nuevas.length ? "No ha salido ninguna encuesta nueva." : `${nuevas.length === 1 ? "Ha salido 1 encuesta nueva" : `Han salido ${nuevas.length} encuestas nuevas`}, de ${lista(casas.slice(0, 3))}${casas.length > 3 ? ` y ${casas.length - 3} más` : ""}.`);
  // Si no se ha movido nada, una sola frase en vez de cuatro que dicen lo mismo
  const quieto = !mov.length && !as.length && Array.isArray(a.encuestas) && !nuevas.length && (a.prob == null || ahora.prob == null || palabra(a.prob) === palabra(ahora.prob));
  const dichas = quieto ? ["Todo sigue igual. La media de encuestas y el reparto de asientos no se han movido y no ha salido ninguna encuesta nueva."] : lineas;
  caja.replaceChildren(el("h2", {}, "Desde tu última visita ", el("span", { class: "fecha" }, n === 1 ? "ayer" : `el ${diaLargo(fechaD(antes.dia))}, hace ${n} días`)), el("ul", {}, ...dichas.map((t) => el("li", {}, t))));
  caja.hidden = false;
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
    sel.append(el("option", { value: "" }, "Elige una provincia…"), ...proy.provincias.map((p) => p.nombre).sort((a, b) => a.localeCompare(b, "es")).map((n) => el("option", { value: n }, n)));
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
  if ($("#tramo-sel")) $("#tramo-sel").value = t;
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
$("#tramo-sel")?.addEventListener("change", (e) => elegirTramo(e.target.value));
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
  const fila = (k) => { const d = m7.media[k] != null ? dif1(m.media[k], m7.media[k]) : 0;
    const marca = D.config.partidos[k]?.aviso?.texto ? el("button", { type: "button", class: "marca-aviso", "aria-label": `Ver el aviso sobre ${nombre(k)}`, onclick: () => { const t = document.getElementById(`aviso-${k}`); if (!t) return; t.scrollIntoView({ behavior: "smooth", block: "center" }); t.classList.add("destacada"); setTimeout(() => t.classList.remove("destacada"), 2500); } }, "aviso") : null;
    return el("div", { class: "fila-p" }, el("div", { class: "nom" }, insignia(k), nombre(k), marca),
      el("div", { class: "pct num-sube" }, `${fmt1.format(m.media[k])} %`, el("small", { class: d ? (d > 0 ? "sube" : "baja") : "" }, d ? signo(d) : "")),
      el("div", { class: "barra" }, el("i", { style: { width: `${m.media[k] / max * 100}%`, background: color(k) } })),
      el("div", { class: "esc" }, D.prob?.partidos?.[k] ? (D.prob.partidos[k].p10 === D.prob.partidos[k].p90 ? `${D.prob.partidos[k].p90} ${D.prob.partidos[k].p90 === 1 ? "asiento" : "asientos"}` : `entre ${D.prob.partidos[k].p10} y ${D.prob.partidos[k].p90} asientos`) : `${proy.total[k] || 0} asientos`)); };
  poner($("#lista-partidos"), ...(enc.todos ? o : grandes).map(fila),
    resto > 0 ? el("button", { class: "ver-mas", type: "button", "aria-expanded": enc.todos ? "true" : "false", onclick: () => { enc.todos = !enc.todos; pintarListaPartidos(m, m7, proy); } },
      enc.todos ? "Ver solo los más votados" : `Ver los otros ${resto} partidos`) : null, ...notasAviso(), notaNoConcurren());
}
function pintarEncuestas(m, m7, proy) {
  const o = ordenar(m.media).filter((k) => m.media[k] >= 0.5);
  poner($("#notas-encuestas"), ...notasAviso(), notaNoConcurren());
  // El CIS no entra en la media. Se enseña al lado lo que dice su última encuesta, para ver cuánto se separa.
  const cis = (D.encuestas?.encuestas || []).filter((e) => e.clave === "cis").sort((x, y) => y.fin.localeCompare(x.fin))[0];
  $("#cis-bloque").hidden = !cis;
  if (cis) {
    const dia = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "long" }).format(Media.fechaD(cis.fin));
    $("#cis-texto").textContent = `Es la encuesta del organismo público. No entra en la media porque desde 2019 se separa mucho del resto de empresas, sobre todo con el PSOE. Su última encuesta es del ${dia}.`;
    const filas = o.filter((k) => cis.pct[k] != null).slice(0, 4);
    poner($("#cis-tabla"), el("span", {}), el("span", { class: "cab" }, "Media de hoy"), el("span", { class: "cab" }, "El CIS"), el("span", { class: "cab" }, "Diferencia"),
      ...filas.flatMap((k) => { const d = dif1(cis.pct[k], m.media[k]);
        return [el("span", { class: "nom" }, insignia(k), nombre(k)), el("span", {}, `${fmt1.format(m.media[k])} %`),
          el("b", {}, `${fmt1.format(cis.pct[k])} %`), el("span", { class: "dif" }, !d ? "igual" : `${fmt1.format(Math.abs(d))} ${d > 0 ? "más" : "menos"}`)]; }));
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
  const sel = $("#filtro-empresas");
  sel.replaceChildren(el("option", { value: "" }, "Media de todas las empresas"),
    ...empresas.map(([clave, v]) => el("option", { value: clave }, `${v.empresa} (${v.n})${enMedia.has(clave) ? "" : v.activa ? "" : ", sin publicar desde hace un año"}`)));
  sel.value = enc.filtro || "";
  sel.onchange = () => { enc.filtro = sel.value || null; contar("Filtra por empresa"); pintarEncuestas(m, m7, proy); };
  $("#leyenda-empresas").textContent = `${empresas.length} empresas desde 2023, ${enMedia.size} cuentan hoy en la media. El número es cuántas encuestas lleva cada una.`; const _viejo = `${empresas.length} empresas han publicado encuestas desde 2023. El número es cuántas lleva cada una. Con punto verde, las ${enMedia.size} que cuentan hoy en la media. En gris, las que llevan más de un año sin publicar.`;
  const cf = enc.filtro ? cuenta[enc.filtro] : null;
  enc.explica = () => cf ? `Las encuestas de ${cf.empresa}, una a una, ${textoTramo()}. Cada punto es una encuesta. ${enMedia.has(enc.filtro) ? "Su última encuesta cuenta hoy en la media." : enc.filtro === "cis" ? "El CIS no cuenta en la media." : cf.activa ? `Hoy no cuenta en la media porque su última encuesta, del ${fFecha.format(fechaD(cf.ultima))}, tiene más de ${m.ventana} días.` : "Lleva más de un año sin publicar."}` : `Así ha cambiado la media de encuestas ${textoTramo()}.${enc.tramo === "convocatoria" || (enc.tramo === "medida" && rangoTendencia()[1] - rangoTendencia()[0] <= 130 * DIA) ? " Un punto por día." : ""}`;
  $("#explica-tendencia").textContent = enc.explica();
  // La tabla encuesta a encuesta: una fila por encuesta, una columna por partido, y al tocar se abre su detalle
  const usadas = new Set(m.usadas.map((e) => e.id));
  const lista = (enc.filtro ? todas.filter((e) => e.clave === enc.filtro) : todas).slice(0, enc.filtro ? 30 : 20);
  const cols = o.filter((k) => m.media[k] >= 1).slice(0, 9);
  const filaDetalle = (e) => {
    const an = D.analisis?.ultimas?.find((x) => x.id === e.id), oe = ordenar(e.pct), sesgo = D.analisis?.sesgos?.[e.clave]?.sesgo;
    return el("tr", { class: "detalle-enc" }, el("td", { colspan: String(cols.length + 4) }, el("div", { class: "detalle" },
      el("p", {}, `Trabajo de campo ${e.inicio && e.inicio !== e.fin ? `del ${fFecha.format(fechaD(e.inicio))} al ` : "el "}${fFecha.format(fechaD(e.fin))}.${e.muestra ? ` ${fmt0.format(e.muestra)} entrevistas, margen de error de ±${fmt1.format(an?.margen ?? 98 / Math.sqrt(e.muestra))} puntos.` : ""}${Object.keys(e.escanos || {}).length ? ` Asientos que publica, ${lista2(oe.filter((k) => e.escanos[k] != null).slice(0, 6).map((k) => `${nombre(k)} ${Math.round(e.escanos[k])}`))}.` : ""}${an ? ` ${an.texto}` : ""}`),
      graficoDeEmpresa(e, todas),
      el("table", {}, el("thead", {}, el("tr", {}, el("th", {}, "Partido"), el("th", {}, "Dio"), el("th", {}, "Suele dar"), el("th", {}, "Media de todas"))),
        el("tbody", {}, ...oe.slice(0, 8).map((k) => { const d = an?.detalle?.find((x) => x.partido === k);
          return el("tr", {}, el("td", {}, nombre(k)), el("td", {}, fmt1.format(e.pct[k])), el("td", {}, sesgo && sesgo[k] != null ? `${signo(sesgo[k])} que la media` : "–"), el("td", {}, d ? fmt1.format(d.esperado - (sesgo && sesgo[k] != null ? sesgo[k] : 0)) : (m.media[k] != null ? fmt1.format(m.media[k]) : "–"))); }))),
      el("p", { class: "fuente" }, "«Suele dar» es lo que esta empresa se separa de la media del momento en sus encuestas de esta legislatura."))));
  };
  const filas = lista.flatMap((e) => {
    const an = D.analisis?.ultimas?.find((x) => x.id === e.id), nota = D.analisis?.notas?.find((x) => x.clave === e.clave), lider = ordenar(e.pct)[0], dePartido = Media.esDePartido(e), abierta = enc.abiertas.has(e.id);
    const fila = el("tr", { id: `enc-${e.id}`, class: `tocable${usadas.has(e.id) || enc.filtro ? "" : " fuera"}${abierta ? " abierta" : ""}`, onclick: () => { if (abierta) enc.abiertas.delete(e.id); else enc.abiertas.add(e.id); contar("Abre una encuesta"); pintarEncuestas(m, m7, proy); } },
      el("th", {}, el("span", { class: "emp" }, e.empresa_base, nota && nota.letra !== "–" ? el("span", { class: "nota", title: nota.texto }, nota.letra) : null), e.encargo ? el("small", {}, `para ${e.encargo}`) : null),
      el("td", { class: "n" }, fFecha.format(fechaD(e.fin))), el("td", { class: "n" }, e.muestra ? fmt0.format(e.muestra) : "–"),
      ...cols.map((k) => e.pct[k] == null ? el("td", { class: "vacia" }, "–") : el("td", {}, el("span", { class: `celda${k === lider ? " lider" : ""}`, style: k === lider ? sobre(color(k)) : { color: color(k) } }, fmt1.format(e.pct[k])))),
      el("td", { class: "ver" }, dePartido ? el("span", { class: "veredicto leve" }, "de un partido") : an ? el("span", { class: `veredicto ${an.veredicto}` }, an.veredicto === "ruido" ? "nada nuevo" : an.veredicto === "leve" ? "algo se mueve" : "novedad") : null));
    return abierta ? [fila, filaDetalle(e)] : [fila];
  });
  $("#tabla-encuestas").replaceChildren(el("thead", {}, el("tr", {}, el("th", {}, "Encuesta"), el("th", {}, "Fecha"), el("th", {}, "Muestra"), ...cols.map((k) => el("th", {}, insignia(k), el("span", {}, nombre(k)))), el("th", {}, ""))),
    el("tbody", {}, ...filas, el("tr", { class: "total" }, el("th", {}, "Media de hoy"), el("td", {}), el("td", {}), ...cols.map((k) => el("td", {}, fmt1.format(m.media[k]))), el("td", {}))));
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
  document.querySelectorAll("#tabla-encuestas canvas[data-enc]").forEach((lienzo) => {
    const e = todas.find((x) => x.id === lienzo.dataset.enc); if (!e) return;
    const mias = deEmpresa(e, todas), cual = mias.findIndex((x) => x.id === e.id), partidos = ordenar(e.pct).slice(0, 5);
    const op = opciones(" %"); op.plugins.legend.labels.boxWidth = 7; op.plugins.legend.labels.boxHeight = 7; op.scales.y.beginAtZero = false;
    graficosEmpresa.push(new Chart(lienzo, { type: "line", data: { labels: mias.map((x) => fFecha.format(fechaD(x.fin))),
      datasets: partidos.map((k) => ({ label: nombre(k), data: mias.map((x) => x.pct[k] ?? null), borderColor: color(k), backgroundColor: color(k), borderWidth: 2, tension: .2, spanGaps: true,
        pointRadius: mias.map((_, i) => i === cual ? 6 : 2.5), pointHoverRadius: 6 })) }, options: op }));
  });
}
/* ---------- Movimiento ----------
   Los números grandes suben contando la primera vez que se ven, las barras crecen al pintarse (CSS, clase crece) y los
   bloques entran al hacer scroll (observador de abajo). Todo respeta «reducir movimiento» del sistema. */
const sinMovimiento = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const animados = new WeakSet();
function animarNumeros(raiz) {
  if (!raiz || sinMovimiento()) return;
  raiz.querySelectorAll(".num-sube").forEach((e) => {
    if (animados.has(e) || e.closest("[hidden]")) return;
    animados.add(e);
    const nodo = [...e.childNodes].find((n) => n.nodeType === 3 && /\d/.test(n.textContent)); if (!nodo) return;
    const texto = nodo.textContent, m = texto.match(/-?\d+(?:[.,]\d+)?/); if (!m) return;
    const fin = parseFloat(m[0].replace(/\./g, "").replace(",", ".")), dec = (m[0].split(",")[1] || "").length, t0 = performance.now(), dur = 750;
    const f = new Intl.NumberFormat("es-ES", { minimumFractionDigits: dec, maximumFractionDigits: dec });
    const paso = (t) => { const x = Math.min(1, (t - t0) / dur), ease = 1 - Math.pow(1 - x, 3); nodo.textContent = texto.replace(m[0], f.format(fin * ease)); if (x < 1) requestAnimationFrame(paso); else nodo.textContent = texto; };
    requestAnimationFrame(paso);
  });
}
/* ---------- La gráfica grande de Encuestas ----------
   Tres vistas (tendencia, barras y carrera), partidos o bloques, porcentaje o asientos, y una franja opcional con lo que
   difieren las encuestas entre sí. Cada punto es una encuesta tal como la publicó su empresa (en asientos, los que dio
   esa empresa). La línea y las barras son la media del día, y en asientos el reparto de esa media con la ley electoral,
   el mismo número que sale en Hoy. Todo se calcula en el dispositivo a partir de encuestas.json. */
Object.assign(enc, { vista: "tendencia", que: "partidos", medida: "pct", franja: true, puntos: false, carreraI: null, reproduciendo: null });
const diaDesdeInicio = (t) => Math.round((t - fechaD(TRAMO_INICIO)) / DIA);
const fechaDesdeDia = (n) => new Date(+fechaD(TRAMO_INICIO) + n * DIA);
const GRIS_RESTO = "#8A94A6";
const colorAlfa = (c, a) => { if (!/^#[0-9a-f]{6}$/i.test(c)) return c; const n = parseInt(c.slice(1), 16); return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`; };
/* Los bloques salen de los escenarios principales de config.json. Lo que no está en ninguno de los dos es «resto». */
function bloques() {
  const E = Object.fromEntries((D.config.escenarios || []).map((e) => [e.id, e]));
  const der = E[D.config.principales.derecha], izq = E[D.config.principales.izquierda];
  const dentro = new Set([...der.partidos, ...izq.partidos]);
  return [{ k: "der", nombre: der.nombre, partidos: der.partidos, color: color(der.partidos[0]) },
    { k: "izq", nombre: izq.nombre.replace(/ de 2023$/, ""), partidos: izq.partidos, color: color(izq.partidos[0]) },
    { k: "resto", nombre: "Resto", partidos: Object.keys(D.config.partidos).filter((k) => !dentro.has(k)), color: GRIS_RESTO }];
}
/* Qué series se pintan: los partidos con al menos un 1,5 % de media hoy (siete como mucho), o los tres bloques. */
function seriesGrafica() {
  if (enc.que === "bloques") return bloques().map((b) => ({ k: b.k, nombre: b.nombre, color: b.color, partidos: b.partidos }));
  const m = calcMedia();
  return ordenar(m.media).filter((k) => m.media[k] >= 1.5).slice(0, 7).map((k) => ({ k, nombre: nombre(k), color: color(k), partidos: [k] }));
}
const sumaDe = (obj, partidos) => { let s = null; for (const k of partidos) if (obj?.[k] != null) s = (s || 0) + obj[k]; return s; };
/* El valor de cada serie en un día: la media (o su reparto en asientos), cuántas encuestas lo forman y lo que difieren entre sí. */
const cacheDia = new Map();
function valorDia(t) {
  const clave = `${enc.medida}|${enc.que}|${diaMadrid(t)}`;
  if (cacheDia.has(clave)) return cacheDia.get(clave);
  const m = calcMedia(t), series = seriesGrafica(), hay = Object.keys(m.media).length > 0;
  const tot = hay && enc.medida === "esc" ? Modelo.proyectar(m.media, D.base).total : null;
  const v = {}, sd = {}, n = {};
  for (const s of series) {
    v[s.k] = hay ? (enc.medida === "pct" ? sumaDe(m.media, s.partidos) : sumaDe(tot, s.partidos) ?? 0) : null;
    const xs = m.usadas.map((e) => sumaDe(enc.medida === "pct" ? e.pct : e.escanos, s.partidos)).filter((x) => x != null);
    n[s.k] = xs.length;
    if (xs.length >= 2) { const med = xs.reduce((a, b) => a + b, 0) / xs.length; sd[s.k] = Math.sqrt(xs.reduce((a, x) => a + (x - med) ** 2, 0) / xs.length); }
  }
  const r = { v, sd, n, usadas: m.usadas.length, desde: m.usadas.reduce((a, e) => (!a || e.fin < a ? e.fin : a), null), hasta: m.usadas.reduce((a, e) => (!a || e.fin > a ? e.fin : a), null) };
  cacheDia.set(clave, r);
  return r;
}
/* Lo que sacó cada partido en 2023, para marcarlo al principio de la gráfica */
function valor2023(serie) { return enc.medida === "pct" ? sumaDe(D.base.nacional, serie.partidos) : sumaDe(D.base.escanos_reales, serie.partidos); }
function unidad() { return enc.medida === "pct" ? " %" : " asientos"; }
function fmtValor(x) { return enc.medida === "pct" ? fmt1.format(x) : fmt0.format(Math.round(x)); }

function pintarTendencia() {
  cacheDia.clear();
  graficoTendencia?.destroy(); graficoTendencia = null;
  pararCarrera();
  const vista = enc.vista;
  $("#caja-tendencia").hidden = vista !== "tendencia";
  $("#carrera").hidden = vista === "tendencia";
  $("#carrera").classList.toggle("quieta", vista === "barras");
  $("#franja-mando").hidden = vista !== "tendencia";
  avisoTramo();
  pieGrafica();
  $("#explica-tendencia").textContent = vista === "barras" ? `La media de hoy, ${enc.que === "bloques" ? "bloque a bloque" : "partido a partido"}, en ${enc.medida === "pct" ? "porcentaje de voto" : "asientos"}.` : vista === "carrera" ? `Cómo ha ido cambiando la media ${textoTramo()}.` : enc.explica ? enc.explica() : "";
  if (vista !== "tendencia") { prepararCarrera(); return; }
  if (!hayGraficas($("#grafico-tendencia"))) return;
  const [desde, hasta] = rangoTendencia(), nDias = Math.round((hasta - desde) / DIA);
  const corto = nDias <= 130, paso = corto ? 1 : nDias <= 500 ? 3 : 7;
  const series = seriesGrafica(), x0 = diaDesdeInicio(desde), x1 = diaDesdeInicio(hasta);
  const E = (D.encuestas?.encuestas || []).filter((e) => fechaD(e.fin) >= desde && fechaD(e.fin) <= hasta && (!enc.filtro || e.clave === enc.filtro));
  const datasets = [];
  lectura.dias = null; lectura.encuestas = E; lectura.series = series;
  // Cada encuesta, un punto translúcido (en asientos, solo las que los publican). Solo si se piden o al elegir una empresa.
  if (enc.puntos || enc.filtro) for (const s of series) {
    const puntos = E.map((e) => { const y = sumaDe(enc.medida === "pct" ? e.pct : e.escanos, s.partidos); return y == null ? null : { x: diaDesdeInicio(fechaD(e.fin)), y, empresa: e.empresa }; }).filter(Boolean);
    datasets.push({ type: "scatter", label: s.nombre, data: puntos, backgroundColor: colorAlfa(s.color, enc.filtro ? .9 : .28), borderColor: "transparent", pointRadius: enc.filtro ? 4.5 : 2.6, pointHoverRadius: 5, order: 3, esPunto: true, color: s.color });
  }
  // La media, una línea suave. Con una sola empresa elegida no hay media, los puntos van unidos por una línea fina.
  if (!enc.filtro) {
    const puntos = [];
    for (let t = desde; t <= hasta; t = new Date(+t + paso * DIA)) puntos.push(t);
    if (puntos[puntos.length - 1] < hasta) puntos.push(hasta);
    const dias = puntos.map(valorDia);
    lectura.dias = puntos.map((t, i) => ({ x: diaDesdeInicio(t), t, v: dias[i].v }));
    // La media de cada día da saltos cuando entra o sale una encuesta. Para la línea de tendencia se suaviza con los
    // vecinos (unas tres semanas en los tramos largos), que es lo que se quiere ver aquí. En los tramos cortos, tal cual.
    const radio = corto ? 0 : paso >= 7 ? 1 : 3;
    const suave = (arr) => arr.map((y, i) => { if (y == null) return null; let s = 0, n = 0; for (let j = Math.max(0, i - radio); j <= Math.min(arr.length - 1, i + radio); j++) if (arr[j] != null) { s += arr[j]; n++; } return s / n; });
    for (const s of series) {
      const vs = suave(dias.map((d) => d.v[s.k])), sds = suave(dias.map((d) => d.sd[s.k]));
      const linea = puntos.map((t, i) => ({ x: diaDesdeInicio(t), y: vs[i] == null ? null : +vs[i].toFixed(2) }));
      if (enc.franja) {
        const arriba = puntos.map((t, i) => ({ x: diaDesdeInicio(t), y: vs[i] == null || sds[i] == null ? null : vs[i] + sds[i] }));
        const abajo = puntos.map((t, i) => ({ x: diaDesdeInicio(t), y: vs[i] == null || sds[i] == null ? null : Math.max(0, vs[i] - sds[i]) }));
        datasets.push({ type: "line", label: `${s.nombre} +`, data: arriba, borderWidth: 0, pointRadius: 0, pointHoverRadius: 0, tension: .35, spanGaps: true, order: 4, auxiliar: true });
        datasets.push({ type: "line", label: `${s.nombre} −`, data: abajo, borderWidth: 0, pointRadius: 0, pointHoverRadius: 0, tension: .35, spanGaps: true, fill: "-1", backgroundColor: colorAlfa(s.color, .13), order: 4, auxiliar: true });
      }
      datasets.push({ type: "line", label: s.nombre, data: linea, borderColor: s.color, backgroundColor: s.color, borderWidth: 4, pointRadius: 0, pointHoverRadius: 5, pointHitRadius: 10, tension: .35, spanGaps: true, order: 1, esMedia: true });
    }
  } else {
    for (const s of series) { const d = datasets.find((x) => x.esPunto && x.label === s.nombre); if (d) { d.showLine = true; d.borderColor = colorAlfa(s.color, .5); d.borderWidth = 1.5; d.data.sort((a, b) => a.x - b.x); } }
  }
  // El resultado de 2023, un rombo al principio, y la raya de la mayoría absoluta en asientos
  const d23 = diaDesdeInicio(fechaD("2023-07-23"));
  const margenX = Math.max(1, Math.round((x1 - x0) * .012));
  if (d23 >= x0 - 45) for (const s of series) { const y = valor2023(s); if (y != null) datasets.push({ type: "scatter", label: `${s.nombre} en 2023`, data: [{ x: Math.max(d23, x0), y, empresa: "Resultado de 2023" }], backgroundColor: s.color, borderColor: "#fff", borderWidth: 1.5, pointStyle: "rectRot", pointRadius: 6.5, pointHoverRadius: 8, order: 0, auxiliar: true }); }
  if (enc.medida === "esc") datasets.push({ type: "line", label: "176, mayoría absoluta", data: [{ x: x0, y: 176 }, { x: x1, y: 176 }], borderColor: colorAlfa(getComputedStyle(document.documentElement).getPropertyValue("--bronce").trim(), .9), borderDash: [6, 5], borderWidth: 1.5, pointRadius: 0, pointHoverRadius: 0, order: 5, auxiliar: true, mayoria: true });
  const op = opciones(unidad());
  const css = getComputedStyle(document.documentElement), gris = css.getPropertyValue("--gris").trim(), tinta = css.getPropertyValue("--tinta").trim();
  const fEje = corto ? new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short" }) : new Intl.DateTimeFormat("es-ES", { month: "short", year: "2-digit" });
  const ultimos = {}; // para que la leyenda enseñe una entrada por serie y el tooltip no repita
  graficoTendencia = new Chart($("#grafico-tendencia"), { data: { datasets }, options: { ...op, animation: { duration: 600, easing: "easeOutQuart" }, interaction: { mode: "nearest", axis: "xy", intersect: false }, onHover: (ev, items, chart) => leerTendencia(ev, items, chart), events: ["mousemove", "mouseout", "touchstart", "touchmove", "click"],
    plugins: { ...op.plugins, legend: { display: false },
      tooltip: { enabled: false } },
    scales: { x: { type: "linear", min: x0 - margenX, max: x1 + margenX, ticks: { color: gris, maxRotation: 0, autoSkipPadding: 24, callback: (v) => fEje.format(fechaDesdeDia(v)).replace(" de ", " ") }, grid: { display: false } },
      y: { min: 0, suggestedMax: enc.medida === "esc" ? 190 : undefined, ticks: { color: gris, callback: (v) => enc.medida === "pct" ? `${v} %` : v }, grid: { color: css.getPropertyValue("--linea").trim() } } } }, plugins: [rayaLectura] });
  lectura.x = null; pintarLectura(null);
  pintarLeyendaTendencia(series);
}
/* La leyenda de la gráfica, en HTML para que lleve los logos. Tocar un partido lo oculta o lo enseña (sus líneas, franja y puntos). */
function pintarLeyendaTendencia(series) {
  const cont = $("#leyenda-tendencia"); if (!cont || !graficoTendencia) return;
  const ch = graficoTendencia, visible = (s) => ch.data.datasets.some((d, i) => (d.label === s.nombre || d.label === `${s.nombre} +` || d.label === `${s.nombre} −`) && ch.isDatasetVisible(i));
  cont.replaceChildren(...series.map((s) => el("button", { type: "button", class: `ley-serie${visible(s) ? "" : " apagada"}`, style: { "--c": s.color }, "aria-pressed": visible(s) ? "true" : "false", onclick: () => {
    const on = !visible(s);
    ch.data.datasets.forEach((d, i) => { if (d.label === s.nombre || d.label === `${s.nombre} +` || d.label === `${s.nombre} −` || d.label === `${s.nombre} en 2023`) ch.setDatasetVisibility(i, on); });
    ch.update(); contar("Oculta un partido en la gráfica"); pintarLeyendaTendencia(series); } },
    s.partidos && s.partidos.length === 1 && D.config.partidos[s.k] ? insignia(s.k, "mini") : el("i", { class: "punto", style: { background: s.color } }), el("span", {}, s.nombre))));
}

/* ---------- Lectura al pie de la gráfica ----------
   En vez de un globo sobre la línea, que tapa y solo enseña un partido, al pasar el ratón (o el dedo) se dibuja una raya
   vertical y debajo de la gráfica salen todos los partidos de ese día. Sin ratón encima, enseña el último día. */
const lectura = { dias: null, encuestas: [], series: [], x: null };
const rayaLectura = { id: "rayaLectura", afterDatasetsDraw(chart) {
  if (lectura.x == null || chart.canvas.id !== "grafico-tendencia") return;
  const { ctx, chartArea: a, scales } = chart, px = scales.x.getPixelForValue(lectura.x);
  if (px < a.left || px > a.right) return;
  ctx.save(); ctx.strokeStyle = "rgba(23,32,46,.45)"; ctx.lineWidth = 1; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(px, a.top); ctx.lineTo(px, a.bottom); ctx.stroke();
  ctx.setLineDash([]);
  for (const ds of chart.data.datasets) { if (!ds.esMedia && !(ds.esPunto && enc.filtro)) continue; const p = ds.data.find((q) => q.x === lectura.x); if (!p || p.y == null) continue; const py = scales.y.getPixelForValue(p.y); ctx.beginPath(); ctx.arc(px, py, 5.5, 0, Math.PI * 2); ctx.fillStyle = ds.borderColor === "transparent" ? ds.backgroundColor : ds.borderColor; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = "#fff"; ctx.stroke(); }
  ctx.restore();
} };
function leerTendencia(ev, items, chart) {
  if (ev.type === "mouseout") { lectura.x = null; pintarLectura(null); chart.draw(); return; }
  // Un punto de encuesta bajo el ratón manda sobre la media
  const punto = items.find((it) => chart.data.datasets[it.datasetIndex].esPunto || chart.data.datasets[it.datasetIndex].auxiliar && chart.data.datasets[it.datasetIndex].data[it.index]?.empresa);
  if (punto) { const ds = chart.data.datasets[punto.datasetIndex], p = ds.data[punto.index]; const e = lectura.encuestas.find((q) => q.empresa === p.empresa && diaDesdeInicio(fechaD(q.fin)) === p.x); if (e) { lectura.x = p.x; pintarLectura({ encuesta: e, x: p.x }); chart.draw(); return; } }
  if (!lectura.dias || !ev.x) { return; }
  const xv = chart.scales.x.getValueForPixel(ev.x);
  let mejor = null; for (const d of lectura.dias) if (!mejor || Math.abs(d.x - xv) < Math.abs(mejor.x - xv)) mejor = d;
  if (mejor && mejor.x !== lectura.x) { lectura.x = mejor.x; pintarLectura({ dia: mejor }); chart.draw(); }
}
function pintarLectura(q) {
  const cont = $("#lectura-tendencia"); if (!cont) return;
  const S = lectura.series, u = unidad();
  let cab, vals;
  if (q && q.encuesta) { const e = q.encuesta; cab = `${e.empresa}${e.encargo ? ` para ${e.encargo}` : ""} · ${fFechaCompleta.format(fechaD(e.fin))}`; vals = S.map((s) => [s, sumaDe(enc.medida === "pct" ? e.pct : e.escanos, s.partidos)]); }
  else if (q && q.dia) { cab = `Media del ${fFechaCompleta.format(q.dia.t)}`; vals = S.map((s) => [s, q.dia.v[s.k]]); }
  else if (lectura.dias && lectura.dias.length) { const d = lectura.dias[lectura.dias.length - 1]; cab = `Media a ${fFechaCompleta.format(d.t)} · pasa el ratón por la gráfica`; vals = S.map((s) => [s, d.v[s.k]]); }
  else if (lectura.encuestas.length) { const e = lectura.encuestas[lectura.encuestas.length - 1]; cab = `Última, ${e.empresa} · ${fFechaCompleta.format(fechaD(e.fin))}`; vals = S.map((s) => [s, sumaDe(enc.medida === "pct" ? e.pct : e.escanos, s.partidos)]); }
  else { cont.replaceChildren(); return; }
  vals = vals.filter(([, v]) => v != null).sort((a, b) => b[1] - a[1]);
  cont.replaceChildren(el("span", { class: "lf" }, cab), el("span", { class: "lvals" }, ...vals.map(([s, v]) => el("span", { class: "lchip", style: { "--c": s.color } }, s.partidos && s.partidos.length === 1 && D.config.partidos[s.k] ? insignia(s.k, "mini") : el("i"), `${s.nombre} `, el("b", {}, `${fmtValor(v)}${u}`)))));
}
const fFechaCompleta = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
function pieGrafica() {
  const pct = enc.medida === "pct", v = enc.vista;
  $("#pie-grafica").textContent = v === "tendencia"
    ? `${enc.filtro ? "Cada punto es una encuesta de esa empresa, y la línea fina las une." : `La línea es la media del día y la franja clara, lo que difieren entre sí las encuestas que cuentan ese día.${enc.puntos ? " Cada punto es una encuesta." : ""}`} ${pct ? "" : "En asientos, la línea es el reparto de la media con la ley electoral, el mismo número que en Hoy, y cada punto lo que publicó esa empresa. "}El rombo es el resultado de 2023.`
    : v === "barras" ? `La barra es la media de hoy${pct ? "" : " repartida con la ley electoral"}. ${!pct && enc.que === "partidos" && D.prob?.partidos ? "La parte clara es donde lo normal es que acabe, el 80 % de las repeticiones del modelo." : "La parte clara es lo que difieren entre sí las encuestas que cuentan hoy."} La raya fina es lo que sacó en 2023.`
    : `Mueve el deslizador o dale al play para ver cómo ha cambiado la media desde 2023. La parte clara es lo que difieren entre sí las encuestas de cada momento, y la raya fina, el resultado de 2023.`;
}

/* ---------- Barras y carrera ---------- */
const carrera = { puntos: [], max: 1, filas: new Map() };
function prepararCarrera() {
  const [desde, hasta] = enc.vista === "barras" ? [hoy(), hoy()] : rangoTendencia();
  carrera.puntos = [];
  for (let t = desde; t < hasta; t = new Date(+t + 3 * DIA)) carrera.puntos.push(t);
  carrera.puntos.push(hasta);
  const series = seriesGrafica(), hoyV = valorDia(hoy());
  const topes = series.map((s) => Math.max(hoyV.v[s.k] || 0, valor2023(s) || 0, (hoyV.v[s.k] || 0) + (hoyV.sd[s.k] || 0), enc.medida === "esc" && enc.que === "partidos" ? D.prob?.partidos?.[s.k]?.p90 || 0 : 0));
  carrera.max = Math.max(...topes, enc.medida === "esc" ? 180 : 10) * 1.08;
  const r = $("#carrera-fecha");
  r.max = carrera.puntos.length - 1; r.value = r.max;
  $("#carrera-inicio").textContent = etiquetaFecha(carrera.puntos[0]);
  // La escala de arriba
  const paso = enc.medida === "pct" ? (carrera.max > 30 ? 10 : 5) : 25, marcas = [];
  for (let x = 0; x <= carrera.max; x += paso) if (!(enc.medida === "esc" && Math.abs(x - 176) < carrera.max * .06)) marcas.push(el("span", { style: { left: `${x / carrera.max * 100}%` } }, enc.medida === "pct" ? `${x} %` : x));
  if (enc.medida === "esc" && 176 <= carrera.max) marcas.push(el("span", { class: "mayoria", style: { left: `${176 / carrera.max * 100}%` } }, "176"));
  $("#carrera-escala").replaceChildren(...marcas);
  carrera.filas.clear();
  $("#carrera-barras").replaceChildren();
  pintarCarrera(carrera.puntos.length - 1, true);
}
function pintarCarrera(i, primera = false) {
  enc.carreraI = i;
  const t = carrera.puntos[i], esHoy = i === carrera.puntos.length - 1 && diaMadrid(t) === diaMadrid();
  const d = valorDia(t), series = seriesGrafica(), modelo = esHoy && enc.medida === "esc" && enc.que === "partidos" ? D.prob?.partidos : null;
  $("#carrera-dia").textContent = esHoy ? `Hoy · ${fFecha.format(t)} ${t.getUTCFullYear()}` : fFechaCompleta.format(t);
  $("#carrera-n").textContent = d.usadas ? `${d.usadas} ${d.usadas === 1 ? "encuesta" : "encuestas"}${d.desde && d.hasta && d.desde !== d.hasta ? ` entre el ${fFecha.format(fechaD(d.desde))} y el ${fFecha.format(fechaD(d.hasta))}` : d.hasta ? `, del ${fFecha.format(fechaD(d.hasta))}` : ""}` : "Sin encuestas en ese momento";
  const orden = series.slice().sort((a, b) => (d.v[b.k] || 0) - (d.v[a.k] || 0));
  const ALTO = 54;
  $("#carrera-barras").style.height = `${orden.length * ALTO}px`;
  const pos = (x) => `${Math.min(100, Math.max(0, (x || 0) / carrera.max * 100))}%`;
  orden.forEach((s, idx) => {
    let f = carrera.filas.get(s.k);
    if (!f) {
      f = { el: el("div", { class: "carrera-fila", style: { "--c": s.color } }, el("span", { class: "nom" }, s.partidos && s.partidos.length === 1 && D.config.partidos[s.k] ? insignia(s.k, "mini") : el("i", { class: "punto", style: { background: s.color } }), s.nombre),
        el("div", { class: "pista" }, el("i", { class: "banda" }), el("i", { class: "barra" }), el("i", { class: "raya23" }), el("i", { class: "raya" })),
        el("span", { class: "num" }, el("b", {}), el("small", {}))) };
      f.banda = f.el.querySelector(".banda"); f.barra = f.el.querySelector(".barra"); f.raya = f.el.querySelector(".raya"); f.raya23 = f.el.querySelector(".raya23"); f.b = f.el.querySelector("b"); f.small = f.el.querySelector("small");
      carrera.filas.set(s.k, f);
      $("#carrera-barras").append(f.el);
      if (!primera) f.el.classList.add("nueva");
    }
    const v = d.v[s.k], lo = modelo?.[s.k] ? modelo[s.k].p10 : v != null && d.sd[s.k] != null ? v - d.sd[s.k] : null, hi = modelo?.[s.k] ? modelo[s.k].p90 : v != null && d.sd[s.k] != null ? v + d.sd[s.k] : null;
    f.el.style.transform = `translateY(${idx * ALTO}px)`;
    f.barra.style.width = pos(v);
    f.banda.style.left = pos(lo); f.banda.style.width = lo == null ? "0" : `calc(${pos(hi)} - ${pos(lo)})`;
    f.raya.style.left = pos(v); f.raya.hidden = v == null;
    const v23 = valor2023(s); f.raya23.style.left = pos(v23); f.raya23.hidden = v23 == null;
    f.b.textContent = v == null ? "–" : fmtValor(v);
    f.small.textContent = lo == null ? "" : `${fmtValor(Math.max(0, lo))}–${fmtValor(hi)}`;
  });
  for (const [k, f] of carrera.filas) if (!orden.find((s) => s.k === k)) { f.el.remove(); carrera.filas.delete(k); }
}
function pararCarrera() { if (enc.reproduciendo) { clearInterval(enc.reproduciendo); enc.reproduciendo = null; } $("#carrera-play")?.classList.remove("en-marcha"); }
function alternarCarrera() {
  if (enc.reproduciendo) { pararCarrera(); return; }
  const r = $("#carrera-fecha");
  if (+r.value >= +r.max) r.value = 0;
  $("#carrera-play").classList.add("en-marcha");
  contar("Reproduce la carrera");
  enc.reproduciendo = setInterval(() => { const i = +r.value + 1; if (i > +r.max) { pararCarrera(); return; } r.value = i; pintarCarrera(i); }, 90);
}
$("#carrera-play")?.addEventListener("click", alternarCarrera);
$("#carrera-fecha")?.addEventListener("input", (e) => { pararCarrera(); pintarCarrera(+e.target.value); });
/* Los mandos de la gráfica */
function mando(sel, dato, campo) {
  document.querySelectorAll(`${sel} button`).forEach((b) => b.addEventListener("click", () => {
    enc[campo] = b.dataset[dato];
    document.querySelectorAll(`${sel} button`).forEach((x) => x.setAttribute("aria-pressed", x.dataset[dato] === enc[campo] ? "true" : "false"));
    contar(`Gráfica ${enc[campo]}`);
    pintarTendencia();
  }));
}
mando(".conmutador.vistas", "vista", "vista"); mando(".conmutador.quever", "que", "que"); mando(".conmutador.medida", "medida", "medida");
$("#puntos")?.addEventListener("change", (e) => { enc.puntos = e.target.checked; contar("Ve cada encuesta"); pintarTendencia(); });

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
      el("span", { class: "nom" }, insignia(x.k), nombre(x.k)),
      el("span", { class: `dif ${x.d > 0 ? "sube" : x.d < 0 ? "baja" : ""}` }, x.d ? `${x.d > 0 ? "+" : "−"}${Math.abs(x.d)}` : "igual"),
      el("div", { class: "filas" },
        el("div", { class: "fila" }, el("span", {}, "tendrá"), el("i", { style: { width: `${x.real / maxB * 100}%`, background: color(x.k) } }), el("b", {}, x.real)),
        el("div", { class: "fila tendria" }, el("span", {}, "le tocarían"), el("i", { style: { width: `${x.prop / maxB * 100}%`, background: color(x.k) } }), el("b", {}, x.prop))))));
    const utiles = (k) => { let con = 0, sin = 0, provCon = 0, provSin = 0;
      for (const pr of provincias) { const v = (pr.cuotas[k] || 0) * pr.n; if (!v) continue; if (pr.escanos[k]) { con += v; provCon++; } else { sin += v; provSin++; } }
      return { util: con / (con + sin || 1), provCon, provSin }; };
    const expl = comp.filter((x) => Math.abs(x.d) >= 3).map((x) => ({ ...x, ...utiles(x.k) }));
    $("#g-perdidos").replaceChildren(...expl.map((x) => el("div", { class: "perdido" }, el("b", {}, insignia(x.k), nombre(x.k)),
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
const mapa = { vista: "ganador", sel: null, proy: null, sub: "mapa", terr: "ccaa", tmed: "pct" };

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
  return { fill: gan ? color(gan) : "var(--linea)", op: empate ? .6 : 1, txt: gan ? sobre(color(gan), empate ? .6 : 1).color : "var(--tinta)", etiqueta: ABREV[p.nombre] || String(p.n), tam: 17 };
}
function dibujarMapa(proy, opciones = {}) {
  // opciones: {vista, sel, resaltar: Set de provincias con borde, colorear: (p)=>{fill,op,...}}
  const G = D.mapa, vista = opciones.vista || mapa.vista, sel = opciones.sel ?? mapa.sel, resaltar = opciones.resaltar || new Set();
  const guardada = mapa.vista; mapa.vista = vista;
  const cols = proy.provincias.map((p) => [p, opciones.colorear ? opciones.colorear(p) : colorProvincia(p)]);
  mapa.vista = guardada;
  let svg;
  if (G) {
    svg = `<svg viewBox="${G.viewBox}" role="group" aria-label="Mapa de España por provincias"><defs>${cols.map(([, c]) => c.grad || "").join("")}</defs>`;
    const r = G.recuadro_canarias; svg += `<rect class="recuadro" x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="8"/>`;
    const xs = cols.map(([p]) => G.provincias[p.nombre]?.cx).filter((x) => x != null), xMin = Math.min(...xs), xMax = Math.max(...xs);
    for (const [p, c] of cols) {
      const g = G.provincias[p.nombre]; if (!g) continue;
      svg += `<g style="--r:${Math.round((g.cx - xMin) / (xMax - xMin || 1) * 650)}ms" class="prov${sel === p.nombre ? " sel" : ""}${resaltar.has(p.nombre) ? " cambia" : ""}" data-p="${p.nombre}" tabindex="0" role="button" aria-label="${esc(p.nombre)}">`;
      svg += g.circulo ? `<circle class="prov" cx="${g.cx}" cy="${g.cy}" r="14" fill="${c.fill}" fill-opacity="${c.op}"/>` : `<path d="${g.d}" fill="${c.fill}" fill-opacity="${c.op}"/>`;
      if (!g.circulo && c.etiqueta) svg += `<text class="${c.clase || ""}" x="${g.cx}" y="${g.cy + 6}" text-anchor="middle" font-size="${c.tam || 22}" font-weight="700" fill="${c.txt}">${c.etiqueta}</text>`;
      else if (g.circulo && vista !== "filo") svg += `<text x="${g.cx}" y="${g.cy + 5}" text-anchor="middle" font-size="14" font-weight="700" fill="${c.txt}">${c.etiqueta}</text>`;
      svg += "</g>";
    }
    svg += "</svg>";
  } else {
    const T = 44, Gp = 4;
    svg = `<svg viewBox="0 0 ${11 * (T + Gp)} ${9 * (T + Gp)}" role="group" aria-label="Mapa de provincias">`;
    for (const [p, c] of cols) {
      const [x, y] = TESELAS[p.nombre] || [0, 0];
      svg += `<g class="prov tesela${sel === p.nombre ? " sel" : ""}${resaltar.has(p.nombre) ? " cambia" : ""}" data-p="${p.nombre}" tabindex="0" role="button" aria-label="${esc(p.nombre)}"><rect x="${x * (T + Gp)}" y="${y * (T + Gp)}" width="${T}" height="${T}" fill="${c.fill}" fill-opacity="${c.op}"/><text x="${x * (T + Gp) + T / 2}" y="${y * (T + Gp) + 18}" text-anchor="middle" font-size="11" font-weight="700" fill="${c.txt}">${ABREV[p.nombre]}</text><text x="${x * (T + Gp) + T / 2}" y="${y * (T + Gp) + 34}" text-anchor="middle" font-size="12" fill="${c.txt}">${c.etiqueta}</text></g>`;
    }
    svg += "</svg>";
  }
  return svg;
}
function pintarMapa(proy) {
  mapa.proy = proy;
  pintarMiProvincia(proy);
  // Qué se ve: la lista (mapa, último asiento o tabla) o el detalle de una provincia
  const det = !!mapa.sel && proy.provincias.some((x) => x.nombre === mapa.sel);
  $("#prov-lista").hidden = det;
  $("#prov-detalle").hidden = !det;
  if (det) { pintarDetalleProvincia(proy.provincias.find((x) => x.nombre === mapa.sel), proy); return; }
  for (const sub of ["mapa", "ultimo", "tabla"]) $(`#prov-${sub}`).hidden = mapa.sub !== sub;
  document.querySelectorAll(".conmutador.subvistas button").forEach((x) => x.setAttribute("aria-pressed", x.dataset.sub === mapa.sub ? "true" : "false"));
  if (mapa.sub === "mapa") {
    const tip = $("#mapa-tip");
    $("#mapa-svg").innerHTML = dibujarMapa(proy);
    $("#mapa-svg").prepend(tip);
    const abrir = (nombre) => { quitarDelEnlace("provincia"); mapa.sel = nombre; try { localStorage.setItem("mi-provincia", nombre); } catch {} contar("Abre una provincia"); pintarMapa(proy); window.scrollTo({ top: 0, behavior: "smooth" }); };
    $("#mapa-svg").querySelectorAll("g.prov").forEach((g) => {
      g.addEventListener("click", () => abrir(g.dataset.p));
      // En ordenador, al pasar el ratón sale la tabla de la provincia. En táctil no hay ratón, se toca y se abre.
      g.addEventListener("pointerenter", (ev) => { if (ev.pointerType !== "mouse") return; tipProvincia(tip, proy.provincias.find((x) => x.nombre === g.dataset.p)); tip.hidden = false; moverTip(tip, ev); });
      g.addEventListener("pointermove", (ev) => { if (!tip.hidden) moverTip(tip, ev); });
      g.addEventListener("pointerleave", () => { tip.hidden = true; });
    });
    $("#mapa-pista").textContent = "Cada provincia lleva el color del partido que más asientos sacaría en ella. Pasa el ratón para ver su reparto y tócala para abrirla.";
  } else if (mapa.sub === "ultimo") pintarUltimoAsiento(proy);
  else pintarTablaTerritorio(proy);
}
function moverTip(tip, ev) {
  const caja = tip.parentElement.getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight;
  let x = ev.clientX - caja.left + 14, y = ev.clientY - caja.top + 14;
  if (x + w > caja.width - 4) x = ev.clientX - caja.left - w - 14;
  if (y + h > caja.height - 4) y = ev.clientY - caja.top - h - 14;
  tip.style.left = `${Math.max(0, x)}px`; tip.style.top = `${Math.max(0, y)}px`;
}
function tipProvincia(tip, p) {
  if (!p) return;
  const o = ordenar(p.cuotas).filter((k) => p.cuotas[k] >= 1).slice(0, 6), max = p.cuotas[o[0]] || 1;
  tip.replaceChildren(el("b", {}, `${p.nombre}, ${p.n} asientos`),
    el("div", { class: "cab" }, el("span", {}, "Partido"), el("span", {}, "% votos"), el("span", {}, "Esc.")),
    ...o.map((k) => el("div", { class: "fila", style: { "--c": color(k) } }, el("span", { class: "nom" }, insignia(k), nombreEn(k, p.ccaa)),
      el("span", { class: "pct" }, `${fmt1.format(p.cuotas[k])} %`), el("b", { class: p.escanos[k] ? "" : "cero" }, p.escanos[k] || "–"), el("i", { class: "barra", style: { width: `${p.cuotas[k] / max * 100}%` } }))));
}
/* El detalle de una provincia: hemiciclo de arcos, tabla de partidos, bloques y el reparto D'Hondt plegado */
function pintarDetalleProvincia(p, proy) {
  const b = D.base.provincias.find((x) => x.nombre === p.nombre), r23 = b?.esc_reales_2023 || {};
  $("#det-nombre").textContent = p.nombre;
  const coas = (D.config.coaliciones || []).filter((c) => c.ccaa === p.ccaa);
  $("#det-sub").replaceChildren(`${b?.ccaa || ""} · ${p.n} asientos`, ...coas.map((c) => el("span", { class: "det-coalicion" }, ` · ${c.nombre}. ${c.nota}`)));
  arcos($("#det-arcos"), p.escanos, null, { sin176: true, minimo: 1, total: p.n });
  const o = ordenar(p.escanos), lider = o[0], m = Math.floor(p.n / 2) + 1;
  $("#det-lider").replaceChildren(insignia(lider), el("b", {}, nombreEn(lider, p.ccaa)), ` se lleva ${p.escanos[lider]} de ${p.n}`, p.escanos[lider] >= m ? ", más de la mitad." : ".");
  $("#det-ultimo").textContent = antes2023(p).trim();
  pintarDisputa(p);
  const todos = ordenar(p.cuotas).filter((k) => p.cuotas[k] >= 0.5), max = p.cuotas[todos[0]] || 1;
  const fila = (k, pct, esc, esc23) => { const d = esc23 == null ? null : esc - esc23;
    return el("div", { class: "det-fila", style: { "--c": color(k) } }, el("span", { class: "nom" }, insignia(k), nombreEn(k, p.ccaa)),
      el("span", { class: "pista" }, el("i", { style: { width: `${pct / max * 100}%` } })), el("span", { class: "pct" }, `${fmt1.format(pct)} %`), el("b", { class: esc ? "" : "cero" }, esc || "–"),
      el("small", { class: d > 0 ? "sube" : d < 0 ? "baja" : "igual" }, d == null ? "" : d > 0 ? `▲${d}` : d < 0 ? `▼${-d}` : "=")); };
  $("#det-tabla").replaceChildren(el("div", { class: "det-cab-fila" }, el("span", {}, "Partido"), el("span", {}), el("span", {}, "% votos"), el("span", {}, "Esc."), el("span", {}, "vs 2023")),
    ...todos.map((k) => fila(k, p.cuotas[k], p.escanos[k] || 0, r23[k] ?? (Object.keys(r23).length ? 0 : null))));
  // Bloques
  const B = bloques(), maxB = Math.max(...B.map((x) => sumaDe(p.cuotas, x.partidos) || 0), 1);
  $("#det-bloques").replaceChildren(...B.map((x) => { const pct = sumaDe(p.cuotas, x.partidos) || 0, esc = sumaDe(p.escanos, x.partidos) || 0;
    return el("div", { class: "det-fila bloque", style: { "--c": x.color } }, el("span", { class: "nom" }, el("i", { class: "punto", style: { background: x.color } }), x.nombre), el("span", { class: "pista" }, el("i", { style: { width: `${pct / maxB * 100}%` } })), el("span", { class: "pct" }, `${fmt1.format(pct)} %`), el("b", { class: esc ? "" : "cero" }, esc || "–"), el("small", {})); }));
  // D'Hondt
  $("#det-dhondt").replaceChildren(el("p", { class: "explica-corta" }, "De uno en uno. Cada asiento se lo lleva el partido con el número más alto, y a quien gana uno se le divide el voto entre 2, luego entre 3, y así."),
    pasosDhondt(p), el("p", { class: "fuente" }, `Solo entran en el reparto los partidos con al menos el 3 % del voto de la provincia.`),
    el("details", { class: "como dentro" }, el("summary", {}, "Ver todas las divisiones en una tabla"), el("div", { class: "tabla-scroll" }, tablaDhondt(p))),
    botonEnlace(`Copiar el enlace a ${p.nombre}`, () => enlaceA({ provincia: p.nombre, pestana: "mapa" })));
}
/* La disputa por el último asiento: quién lo tiene, quién lo pelea y por cuántos votos, como un duelo */
function pintarDisputa(p) {
  const cont = $("#det-disputa");
  if (!p.ultimo || !p.aspirante) { cont.replaceChildren(el("p", { class: "vacio" }, "Sin datos del último asiento.")); return; }
  const t = p.ultimo.p, a = p.aspirante.p, qT = p.ultimo.q, qA = p.cuotas[a] / ((p.escanos[a] || 0) + 1), v = votosDe(Math.max(p.aspirante.falta, 0), p.n);
  const nivel = v < 100 ? "Empate técnico" : v < 1000 ? "Muy reñido" : v < 3000 ? "Reñido" : v < 8000 ? "Algo reñido" : "Bastante claro";
  const ancho = (q) => `${Math.max(8, q / Math.max(qT, qA) * 100)}%`;
  cont.replaceChildren(
    el("div", { class: "duelo" },
      el("div", { class: "lado tiene", style: { "--c": color(t) } }, el("span", { class: "eti" }, "Lo tiene"), el("span", { class: "chip", style: sobre(color(t)) }, nombreEn(t, p.ccaa)), el("i", { class: "barra", style: { width: ancho(qT) } }), el("small", {}, `su ${(p.escanos[t] || 0)}.º asiento, ${fmt1.format(p.cuotas[t])} % entre ${p.escanos[t] || 1}`)),
      el("div", { class: "centro" }, el("b", { class: "num-sube" }, v < 100 ? "±100" : fmt0.format(v)), el("span", {}, "votos"), el("em", { class: v < 1000 ? "mal" : v < 3000 ? "medio" : "bien" }, nivel)),
      el("div", { class: "lado pelea", style: { "--c": color(a) } }, el("span", { class: "eti" }, "Se lo pelea"), el("span", { class: "chip", style: sobre(color(a)) }, nombreEn(a, p.ccaa)), el("i", { class: "barra", style: { width: ancho(qA) } }), el("small", {}, `iría a por su ${(p.escanos[a] || 0) + 1}.º, ${fmt1.format(p.cuotas[a])} % entre ${(p.escanos[a] || 0) + 1}`))),
    el("p", { class: "explica-corta" }, v < 100 ? `${nombreEn(a, p.ccaa)} le quitaría el asiento a ${nombreEn(t, p.ccaa)} con un puñado de votos.` : `Si ${nombreEn(a, p.ccaa)} sumara unos ${fmt0.format(v)} votos más en ${p.nombre}, le quitaría el último asiento a ${nombreEn(t, p.ccaa)}.`));
}
$("#det-volver")?.addEventListener("click", () => { quitarDelEnlace("provincia"); mapa.sel = null; try { localStorage.removeItem("mi-provincia"); } catch {} pintarMapa(mapa.proy); });
document.querySelectorAll(".conmutador.subvistas button").forEach((b) => b.addEventListener("click", () => { mapa.sub = b.dataset.sub; contar(`Provincias ${mapa.sub}`); pintarMapa(mapa.proy); }));
/* Último asiento de cada provincia: cuántos tiene y pelea cada partido, y la lista de más a menos reñida */
function pintarUltimoAsiento(proy) {
  const con = proy.provincias.filter((x) => x.ultimo && x.aspirante);
  // El mapa: cada provincia con el color de quien tiene el último asiento, a más color más reñido
  const colorear = (p) => { if (!p.ultimo || !p.aspirante) return { fill: "var(--linea)", op: .5, txt: "var(--tinta)", etiqueta: ABREV[p.nombre] || "", tam: 15 };
    const v = votosDe(Math.max(p.aspirante.falta, 0), p.n), op = v < 1000 ? 1 : v < 3000 ? .7 : v < 8000 ? .45 : .22;
    return { fill: color(p.ultimo.p), op, txt: op >= .7 ? sobre(color(p.ultimo.p)).color : "var(--tinta)", etiqueta: ABREV[p.nombre] || "", tam: 15 }; };
  $("#ultimo-mapa").innerHTML = dibujarMapa(proy, { vista: "ganador", sel: null, colorear });
  const tip = el("div", { class: "mapa-tip", hidden: true }); $("#ultimo-mapa").prepend(tip);
  $("#ultimo-mapa").querySelectorAll("g.prov").forEach((g) => {
    g.addEventListener("click", () => { quitarDelEnlace("provincia"); mapa.sel = g.dataset.p; contar("Abre una provincia"); pintarMapa(proy); window.scrollTo({ top: 0, behavior: "smooth" }); });
    g.addEventListener("pointerenter", (ev) => { if (ev.pointerType !== "mouse") return; const p = proy.provincias.find((x) => x.nombre === g.dataset.p); if (!p?.aspirante) return;
      const v = votosDe(Math.max(p.aspirante.falta, 0), p.n);
      tip.replaceChildren(el("b", {}, `${p.nombre}, ${p.n} asientos`), el("div", { class: "fila-ult" }, el("span", { class: "chip con-insignia", style: sobre(color(p.ultimo.p)) }, insignia(p.ultimo.p, "mini"), nombre(p.ultimo.p)), el("i", {}, "›"), el("span", { class: "chip con-insignia", style: sobre(color(p.aspirante.p)) }, insignia(p.aspirante.p, "mini"), nombre(p.aspirante.p))), el("span", { class: "m" }, v < 100 ? "Empate técnico" : `Le faltan unos ${fmt0.format(v)} votos`));
      tip.hidden = false; moverTip(tip, ev); });
    g.addEventListener("pointermove", (ev) => { if (!tip.hidden) moverTip(tip, ev); });
    g.addEventListener("pointerleave", () => { tip.hidden = true; });
  });
  const orden = con.slice().sort((a, b) => votosDe(Math.max(a.aspirante.falta, 0), a.n) - votosDe(Math.max(b.aspirante.falta, 0), b.n));
  const chip = (k) => el("span", { class: "chip con-insignia", style: sobre(color(k)) }, insignia(k, "mini"), nombre(k));
  $("#ultimo-tabla").replaceChildren(el("div", { class: "cab" }, el("span", {}, "Provincia"), el("span", {}, "Lo tiene"), el("span", {}, "Siguiente"), el("span", {}, "Le faltan")),
    ...orden.map((x) => el("button", { type: "button", class: "ultimo-prov", onclick: () => { quitarDelEnlace("provincia"); mapa.sel = x.nombre; pintarMapa(proy); window.scrollTo({ top: 0, behavior: "smooth" }); } },
      el("span", { class: "prov" }, el("b", {}, x.nombre), el("small", {}, `${x.n} asientos`)), chip(x.ultimo.p), el("span", { class: "sig" }, el("i", {}, "›"), chip(x.aspirante.p)), el("span", { class: "falta" }, (() => { const v = votosDe(Math.max(x.aspirante.falta, 0), x.n); return v < 100 ? "empate" : `${fmt0.format(v)} votos`; })()))));
}
/* Tabla por territorio: comunidades o provincias, porcentaje o asientos */
function pintarTablaTerritorio(proy) {
  document.querySelectorAll("#prov-tabla .conmutador button").forEach((x) => { if (x.dataset.terr) x.setAttribute("aria-pressed", x.dataset.terr === mapa.terr ? "true" : "false"); if (x.dataset.tmed) x.setAttribute("aria-pressed", x.dataset.tmed === mapa.tmed ? "true" : "false"); });
  const m = calcMedia().media, cols = ordenar(m).filter((k) => m[k] >= 0.8 || proy.total[k] > 0).slice(0, 12);
  let filas;
  if (mapa.terr === "prov") filas = proy.provincias.map((p) => ({ nombre: p.nombre, n: p.n, pct: p.cuotas, esc: p.escanos, abrir: p.nombre }));
  else {
    const por = {};
    for (const p of proy.provincias) { const c = (por[p.ccaa] ||= { nombre: p.ccaa, n: 0, pct: {}, esc: {} }); c.n += p.n; for (const k of Object.keys(p.cuotas)) c.pct[k] = (c.pct[k] || 0) + p.cuotas[k] * p.n; for (const k of Object.keys(p.escanos)) c.esc[k] = (c.esc[k] || 0) + p.escanos[k]; }
    filas = Object.values(por).map((c) => ({ ...c, pct: Object.fromEntries(Object.entries(c.pct).map(([k, v]) => [k, v / c.n])) }));
  }
  filas.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  const pct = mapa.tmed === "pct";
  const celda = (f, k) => { const v = pct ? f.pct[k] : f.esc[k]; if (!v || (pct && v < 0.5)) return el("td", { class: "vacia" }, "–");
    const lider = ordenar(pct ? f.pct : f.esc)[0] === k; return el("td", {}, el("span", { class: `celda${lider ? " lider" : ""}`, style: lider ? sobre(color(k)) : { color: color(k) } }, pct ? `${fmt1.format(v)} %` : v)); };
  const total = el("tr", { class: "total" }, el("th", {}, "España"), el("th", {}), ...cols.map((k) => el("td", {}, pct ? `${fmt1.format(m[k] || 0)} %` : proy.total[k] || "–")));
  $("#tabla-territorio").replaceChildren(el("thead", {}, el("tr", {}, el("th", {}, mapa.terr === "prov" ? "Provincia" : "Comunidad"), el("th", {}, "Esc."), ...cols.map((k) => el("th", { style: { "--c": color(k) } }, insignia(k), el("span", {}, nombre(k)))))),
    el("tbody", {}, ...filas.map((f) => el("tr", { class: f.abrir ? "tocable" : null, onclick: f.abrir ? () => { quitarDelEnlace("provincia"); mapa.sel = f.abrir; pintarMapa(proy); window.scrollTo({ top: 0, behavior: "smooth" }); } : null }, el("th", {}, f.nombre), el("th", { class: "n" }, f.n), ...cols.map((k) => celda(f, k)))), total));
}
document.querySelectorAll("#prov-tabla .conmutador button").forEach((b) => b.addEventListener("click", () => { if (b.dataset.terr) mapa.terr = b.dataset.terr; if (b.dataset.tmed) mapa.tmed = b.dataset.tmed; pintarTablaTerritorio(mapa.proy); }));
function pasosDhondt(p) {
  const partidos = ordenar(p.cuotas).filter((k) => p.cuotas[k] >= Modelo.UMBRAL), lleva = {}, pasos = [];
  for (let i = 1; i <= p.n && partidos.length; i++) {
    const m = partidos.map((k) => ({ k, d: (lleva[k] || 0) + 1, q: p.cuotas[k] / ((lleva[k] || 0) + 1) })).sort((x, y) => y.q - x.q)[0];
    lleva[m.k] = m.d; pasos.push({ i, ...m });
  }
  const paso = (x) => el("li", {}, el("span", { class: "num" }, `${x.i}.º`), el("span", { class: "chip con-insignia", style: sobre(color(x.k)) }, insignia(x.k, "mini"), nombre(x.k)),
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
      ...Array.from({ length: maxDiv }, (_, i) => { const g = gana.has(`${k}/${i + 1}`); return el("td", { class: g ? "gana" : null, style: g ? sobre(color(k)) : null }, fmt1.format(p.cuotas[k] / (i + 1))); })))));
}


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
  sim.base = { ...m.media }; sim.proyBase = proyBase;
  if (!sim.tocado) { sim.valores = { ...m.media }; sim.situacion = "media"; sim.fusiones = []; }
  sim.sub = sim.sub || "mueve";
  pintarSubSim();
}
function pintarSubSim() {
  for (const sub of ["mueve", "enjuego", "pactos"]) $(`#sim-${sub}`).hidden = sim.sub !== sub;
  document.querySelectorAll(".conmutador.subvistas-sim button").forEach((x) => x.setAttribute("aria-pressed", x.dataset.ssub === sim.sub ? "true" : "false"));
  if (sim.sub === "mueve") { pintarBarrasSim(); recalcularSim(); probabilidadSim(); }
  else if (sim.sub === "enjuego") pintarEnJuego();
  else pintarPactos();
}
document.querySelectorAll(".conmutador.subvistas-sim button").forEach((b) => b.addEventListener("click", () => { sim.sub = b.dataset.ssub; contar(`Y si ${sim.sub}`); pintarSubSim(); }));

/* ---------- Mueve el voto: una barra por partido que se arrastra ---------- */
const marcarSituacion = () => document.querySelectorAll("#sim-atajos button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.id === sim.situacion ? "true" : "false"));
function pintarBarrasSim() {
  const ks = ordenar(sim.base).filter((k) => sim.base[k] >= 0.8), max = 45;
  $("#sim-barras").replaceChildren(...ks.map((k) => { const v = sim.valores[k] ?? 0, d = v - sim.base[k];
    const r = el("input", { type: "range", min: "0", max: String(max), step: "0.1", value: v.toFixed(1), "aria-label": `${nombre(k)}, ${fmt1.format(v)} %`, style: { "--c": color(k), "--p": `${v / max * 100}%` } });
    r.addEventListener("input", () => { moverVoto(k, +r.value); });
    r.addEventListener("change", () => contar("Arrastra un partido en Y si"));
    return el("div", { class: "sim-fila", "data-k": k, style: { "--c": color(k) } }, el("span", { class: "nom" }, insignia(k), nombre(k)), r,
      el("span", { class: "num" }, `${fmt1.format(v)} %`), el("small", { class: Math.abs(d) >= 0.05 ? (d > 0 ? "sube" : "baja") : "igual" }, Math.abs(d) >= 0.05 ? `${d > 0 ? "+" : "−"}${fmt1.format(Math.abs(d))}` : "="),
      el("span", { class: "esc" }, el("b", {}, "–"), el("small", {}, ""))); }));
  const sits = situaciones(sim.base).filter((x) => x.id !== "media");
  $("#sim-atajos").replaceChildren(...sits.map((x) => el("button", { type: "button", class: "atajo", "data-id": x.id, "aria-pressed": sim.situacion === x.id ? "true" : "false", title: x.detalle, onclick: () => { sim.tocado = true; sim.situacion = x.id; sim.valores = x.f({ ...sim.base }); sim.fusiones = []; contar("Atajo en Y si"); pintarBarrasSim(); recalcularSim(); probabilidadSim(); } }, x.titulo)),
    el("button", { type: "button", class: "atajo volver", onclick: () => { sim.tocado = false; sim.situacion = "media"; sim.valores = { ...sim.base }; sim.fusiones = []; pintarBarrasSim(); recalcularSim(); probabilidadSim(); } }, "Volver a hoy"));
}
/* Al mover un partido, los demás se ajustan en proporción para que el total no cambie */
function moverVoto(k, v) {
  const antes = sim.valores[k] ?? 0, delta = v - antes, otros = Object.keys(sim.valores).filter((x) => x !== k && sim.valores[x] > 0), suma = otros.reduce((a, x) => a + sim.valores[x], 0);
  if (suma <= 0) return;
  const f = Math.max(0, (suma - delta) / suma);
  for (const x of otros) sim.valores[x] = +(sim.valores[x] * f).toFixed(3);
  sim.valores[k] = v; sim.tocado = true; sim.situacion = "custom";
  // Solo se actualizan los números de las barras, no se recrean, para no perder el dedo del deslizador
  document.querySelectorAll("#sim-barras .sim-fila").forEach((fila) => { const kk = fila.querySelector("input").getAttribute("aria-label").split(",")[0], key = Object.keys(sim.valores).find((z) => nombre(z) === kk); if (!key) return; const vv = sim.valores[key], d = vv - sim.base[key], inp = fila.querySelector("input");
    if (key !== k) inp.value = vv.toFixed(1); inp.style.setProperty("--p", `${vv / 45 * 100}%`); fila.querySelector(".num").textContent = `${fmt1.format(vv)} %`; const sm = fila.querySelector("small"); sm.textContent = Math.abs(d) >= 0.05 ? `${d > 0 ? "+" : "−"}${fmt1.format(Math.abs(d))}` : "="; sm.className = Math.abs(d) >= 0.05 ? (d > 0 ? "sube" : "baja") : "igual"; });
  marcarSituacion();
  recalcularSim();
  clearTimeout(sim.espera); sim.espera = setTimeout(probabilidadSim, 250);
}
function recalcularSim() {
  const proy = Modelo.proyectar(sim.valores, D.base, { fusiones: sim.fusiones });
  sim.ultimaProy = proy;
  pintarArcosSim();
  asientosEnFilas("#sim-barras", proy.total, sim.proyBase.total, "asientos");
  pintarMapaSim();
}
/* En cada fila de barras, los asientos que saca ese partido y el cambio respecto a hoy */
function asientosEnFilas(sel, tot, base, unidad) {
  document.querySelectorAll(`${sel} .sim-fila`).forEach((fila) => { const k = fila.dataset.k, n = tot[k] || 0, d = n - (base[k] || 0), c = fila.querySelector(".esc"); if (!c) return;
    c.querySelector("b").textContent = String(n); const sm = c.querySelector("small"); sm.textContent = d ? `${d > 0 ? "▲" : "▼"}${Math.abs(d)}` : unidad === "asientos" ? "asientos" : "sen."; sm.className = d > 0 ? "sube" : d < 0 ? "baja" : ""; });
}
/* La leyenda bajo un hemiciclo de arcos: todos los partidos con asiento, con el cambio */
function leyendaArcos(cont, esc, base) {
  cont.replaceChildren(...ordenar(esc).filter((k) => esc[k] > 0).map((k) => { const d = base ? esc[k] - (base[k] || 0) : 0;
    return el("span", {}, insignia(k, "mini"), `${nombre(k)} `, el("b", {}, esc[k]), el("small", { class: d > 0 ? "sube" : d < 0 ? "baja" : "" }, d > 0 ? ` ▲${d}` : d < 0 ? ` ▼${-d}` : " =")); }));
}
function pintarArcosSim() {
  const proy = sim.ultimaProy, tot = proy.total, der = escenario(D.config.principales.derecha), izq = escenario(D.config.principales.izquierda);
  arcos($("#sim-arcos"), tot, sim.proyBase.total, { minimo: 12 });
  leyendaArcos($("#sim-arcos-leyenda"), tot, sim.proyBase.total);
  const suma = (e) => e.partidos.reduce((a, k) => a + (tot[k] || 0), 0), sd = der ? suma(der) : 0, si = izq ? suma(izq) : 0;
  const fav = sd >= si ? der : izq, X = Math.max(sd, si);
  $("#sim-cifra").replaceChildren(el("b", { style: { color: color(fav.partidos[0]) } }, `${X}`), ` ${nombreEsc(fav)}`, el("span", { class: X >= 176 ? "pasa" : "nopasa" }, X > 176 ? ` · pasan la raya por ${X - 176}` : X === 176 ? " · justo en la raya" : ` · les faltan ${176 - X}`),
    el("small", {}, ` ${nombreEsc(fav === der ? izq : der)}, ${Math.min(sd, si)}`));
  // Con un reparto proporcional puro, para ver cuánto pesa la ley electoral
  const v = sim.valores, claves = Object.keys(v).filter((k) => v[k] > 0), sumV = claves.reduce((a, k) => a + v[k], 0), prop = {};
  for (const k of claves) prop[k] = Math.round(v[k] / sumV * 350);
  const sp = fav.partidos.reduce((a, k) => a + (prop[k] || 0), 0);
  $("#sim-prop").textContent = `Si los 350 asientos se repartieran solo por votos en toda España, ${nombreEsc(fav)} ${fav.partidos.length > 1 ? "tendrían" : "tendría"} ${sp} en vez de ${X}. La diferencia es la ley electoral.`;
}

/* ---------- En juego: horquillas de asientos si el voto se mueve ±x puntos ---------- */
const enjuego = { que: "partidos", puntos: 3, abierto: null };
function proyMovida(partidos, pts) {
  const v = { ...sim.base }, suma = Object.values(v).reduce((a, b) => a + b, 0);
  const propios = partidos.reduce((a, k) => a + (v[k] || 0), 0), otros = suma - propios;
  if (!propios || !otros) return null;
  // El bloque sube o baja pts en total, repartido entre sus partidos según su tamaño, y el resto compensa en proporción
  for (const k of partidos) v[k] = Math.max(0, v[k] + pts * v[k] / propios);
  const f = (otros - pts) / otros;
  for (const k of Object.keys(v)) if (!partidos.includes(k)) v[k] = Math.max(0, v[k] * f);
  return Modelo.proyectar(v, D.base);
}
function pintarEnJuego() {
  document.querySelectorAll("#sim-enjuego .conmutador button").forEach((x) => x.setAttribute("aria-pressed", x.dataset.ej === enjuego.que ? "true" : "false"));
  $("#ej-puntos").value = enjuego.puntos; $("#ej-valor").textContent = `±${fmt1.format(enjuego.puntos)} puntos`; $("#ej-votos").textContent = `${cap(puntosTexto(enjuego.puntos))} en toda España, arriba o abajo.`;
  const base = sim.proyBase, series = enjuego.que === "bloques" ? bloques().filter((b) => b.k !== "resto") : ordenar(sim.base).filter((k) => sim.base[k] >= 0.8 && (base.total[k] || 0) > 0).map((k) => ({ k, nombre: nombre(k), color: color(k), partidos: [k] }));
  const filas = series.map((s) => { const hoy = sumaDe(base.total, s.partidos) || 0, baja = proyMovida(s.partidos, -enjuego.puntos), sube = proyMovida(s.partidos, enjuego.puntos);
    const b = baja ? sumaDe(baja.total, s.partidos) || 0 : hoy, u = sube ? sumaDe(sube.total, s.partidos) || 0 : hoy;
    return { s, hoy, seguros: Math.min(hoy, b), perder: Math.max(0, hoy - b), ganar: Math.max(0, u - hoy), bajo: Math.min(b, hoy), alto: Math.max(u, hoy), baja, sube }; });
  const max = Math.max(...filas.map((f) => f.alto), 1), pos = (x) => `${x / max * 100}%`;
  $("#ej-filas").replaceChildren(...filas.flatMap((f) => {
    const abierta = enjuego.abierto === f.s.k;
    const fila = el("button", { type: "button", class: `ej-fila${abierta ? " abierta" : ""}`, style: { "--c": f.s.color }, "aria-expanded": abierta ? "true" : "false", onclick: () => { enjuego.abierto = abierta ? null : f.s.k; contar("Abre una horquilla"); pintarEnJuego(); } },
      el("span", { class: "nom" }, el("i", { class: "punto", style: { background: f.s.color } }), f.s.nombre, el("small", {}, `${fmt1.format(sumaDe(sim.base, f.s.partidos) || 0)} %`)),
      el("span", { class: "pista" }, el("i", { class: "seg", style: { width: pos(f.seguros) } }, f.seguros > 3 ? f.seguros : ""), el("i", { class: "perder", style: { left: pos(f.seguros), width: pos(f.perder) } }, f.perder ? f.perder : ""), el("i", { class: "ganar", style: { left: pos(f.hoy), width: pos(f.ganar) } }, f.ganar ? `+${f.ganar}` : ""), el("i", { class: "hoy", style: { left: pos(f.hoy) } })),
      el("span", { class: "num" }, el("b", {}, f.hoy), el("small", {}, `${f.bajo}–${f.alto}`)));
    if (!abierta) return [fila];
    const dif = (p2, signo) => { if (!p2) return []; const out = []; for (let i = 0; i < base.provincias.length; i++) { const a = sumaDe(base.provincias[i].escanos, f.s.partidos) || 0, b = sumaDe(p2.provincias[i].escanos, f.s.partidos) || 0; if (b !== a) out.push({ nombre: base.provincias[i].nombre, d: b - a }); } return out.sort((x, y) => Math.abs(y.d) - Math.abs(x.d)); };
    const pierde = dif(f.baja), gana = dif(f.sube);
    const lista = (arr, titulo, clase) => el("div", { class: "ej-col" }, el("span", { class: "cab" }, titulo), ...(arr.length ? arr.map((x) => el("button", { type: "button", class: `ej-prov ${clase}`, onclick: (ev) => { ev.stopPropagation(); quitarDelEnlace("provincia"); mapa.sel = x.nombre; location.hash = "#mapa"; if (mapa.proy) pintarMapa(mapa.proy); } }, el("span", {}, x.nombre), el("b", {}, `${x.d > 0 ? "+" : ""}${x.d}`))) : [el("p", { class: "vacio" }, "Ninguna")]));
    return [fila, el("div", { class: "ej-detalle", style: { "--c": f.s.color } }, lista(pierde, `Si baja ${fmt1.format(enjuego.puntos)} puntos, pierde en`, "perder"), lista(gana, `Si sube ${fmt1.format(enjuego.puntos)} puntos, gana en`, "ganar"))];
  }));
}
$("#ej-puntos")?.addEventListener("input", (e) => { enjuego.puntos = +e.target.value; $("#ej-valor").textContent = `±${fmt1.format(enjuego.puntos)} puntos`; clearTimeout(enjuego.espera); enjuego.espera = setTimeout(() => { contar("Mueve En juego"); pintarEnJuego(); }, 120); });
document.querySelectorAll("#sim-enjuego .conmutador button").forEach((b) => b.addEventListener("click", () => { enjuego.que = b.dataset.ej; enjuego.abierto = null; pintarEnJuego(); }));

/* ---------- Pactos: tocar partidos y ver si suman 176 sobre los arcos ---------- */
function pintarPactos() {
  const tot = sim.proyBase.total, sel = sim.seleccion;
  for (const k of [...sel]) if (!tot[k]) sel.delete(k);
  const suma = [...sel].reduce((a, k) => a + (tot[k] || 0), 0);
  const alternar = (k) => { if (sel.has(k)) sel.delete(k); else sel.add(k); contar("Suma partidos"); pintarPactos(); };
  poner($("#pactos"), ...ordenar(tot).filter((k) => tot[k] > 0).map((k) => el("button", { class: "pacto", type: "button", "aria-pressed": sel.has(k) ? "true" : "false", style: sel.has(k) ? { ...sobre(color(k)), borderColor: color(k) } : { "--c": color(k) }, onclick: () => alternar(k) }, insignia(k, "mini"), `${nombre(k)} ${tot[k]}`)));
  arcos($("#pactos-arcos"), tot, null, { minimo: 12, apagar: (k) => sel.size && !sel.has(k), orden: [...sel, ...D.config.orden_hemiciclo.filter((k) => !sel.has(k))] });
  $("#pactos-frase").replaceChildren(...(sel.size ? [el("b", { class: suma >= 176 ? "pasa" : "nopasa" }, `${suma}`), " de 176", el("span", { class: suma >= 176 ? "pasa" : "nopasa" }, suma > 176 ? ` · llegan, les sobran ${suma - 176}` : suma === 176 ? " · justo los que hacen falta" : ` · les faltan ${176 - suma}`)] : [el("span", { class: "nopasa" }, "Toca partidos para sumarlos")]));
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
    el("div", { class: "chips" }, ...ordenar(p.escanos).map((k) => el("span", { class: "chip con-insignia", style: sobre(color(k)) }, insignia(k, "mini"), `${nombre(k)} ${p.escanos[k]}`))),
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
  // Sin tocar nada es la misma situación que en Hoy, así que se enseñan los mismos números que allí y no hace falta
  // repetir las elecciones en el dispositivo. Antes se repetían 600 veces en cada carga y el resultado se tiraba.
  const intacto = !sim.fusiones.length && Object.keys(sim.valores).every((k) => Math.abs((sim.valores[k] || 0) - (sim.base[k] ?? -9)) < 1e-9);
  for (let i = 0; i < N && !intacto; i++) {
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
  const pd = intacto ? der.p : cd / N, pi = intacto ? izq.p : ci / N, pb = intacto ? P.bloqueo : Math.max(0, 1 - pd - pi);
  const rd = intacto ? [der.p10, der.p90] : [sd[Math.floor(N * .1)], sd[Math.floor(N * .9)]], ri = intacto ? [izq.p10, izq.p90] : [si[Math.floor(N * .1)], si[Math.floor(N * .9)]];
  const nd = nombreEsc(der), ni = nombreEsc(izq);
  $("#r-sim").replaceChildren(el("b", {}, pd >= 0.6 ? `${cap(palabra(pd))}, ${nd}.` : pi >= 0.6 ? `${cap(palabra(pi))}, ${ni}.` : "Nadie tiene la mayoría clara."),
    pd >= 0.6 ? ` Para ${ni}, ${palabra(pi)}.` : pi >= 0.6 ? ` Para ${nd}, ${palabra(pd)}.` : ` Para ${nd}, ${palabra(pd)}. Para ${ni}, ${palabra(pi)}.`, ` Que nadie sume, ${palabra(pb)}.`);
  const tot = sim.ultimaProy.total, suma = (e) => e.partidos.reduce((a, k) => a + (tot[k] || 0), 0);
  const op3 = (e, col, pr, r) => ({ id: e.id, titulo: cap(nombreEsc(e)), p: pr, color: col, partidos: e.partidos, central: suma(e), p10: Math.min(r[0], suma(e)), p90: Math.max(r[1], suma(e)), verbo: e.partidos.length > 1 ? "sumarían" : "sacaría", plural: e.partidos.length > 1, con: intacto ? null : "Con estos votos" });
  const ops = [op3(der, color("PP"), pd, rd), { id: "nadie", titulo: "Nadie suma", p: pb, color: "#8A93A3" }, op3(izq, color("PSOE"), pi, ri)];
  const pinta = () => medidores($("#sim-medidores"), $("#sim-medidor-detalle"), ops, sim.med, (id) => { sim.med = id; pinta(); });
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
const senado = { sub: "hoy", prov: null, valores: null, base: null, tocado: false, proy: null, marcado: null };
/* El Senado tiene más asientos que los 208 que se eligen: los parlamentos de las comunidades designan al resto, y esos no
   cambian con estas elecciones (config.senado.designados). La mayoría absoluta es la de toda la cámara. */
function datosSenado() {
  const des = D.config.senado?.designados || {}, nDes = Object.values(des).reduce((a, b) => a + b, 0), total = 208 + nDes;
  return { des, nDes, total, M: Math.floor(total / 2) + 1 };
}
/* Reparto del Senado para una proyección: senadores elegidos por partido (tot), por provincia (porProv), con designados (con). */
function repartoSenado(proy) {
  const { des, nDes, total, M } = datosSenado(), tot = {}, porProv = {}, primeras = {};
  for (const p of proy.provincias) { const r = Modelo.senadoProvincia(p.cuotas, p.nombre, D.base); porProv[p.nombre] = r; const g = ordenar(r)[0]; if (g) primeras[g] = (primeras[g] || 0) + 1; for (const [k, n] of Object.entries(r)) tot[k] = (tot[k] || 0) + n; }
  const con = {}; for (const k of new Set([...Object.keys(tot), ...Object.keys(des)])) con[k] = (tot[k] || 0) + (des[k] || 0);
  return { des, nDes, total, M, tot, porProv, primeras, con };
}
const ORDEN_SEN = () => [...D.config.orden_hemiciclo, "Otros"];
function pintarSenado(proy, m) {
  senado.proy = proy; senado.base = { ...m.media };
  if (!senado.tocado) senado.valores = { ...m.media };
  pintarSubSen();
}
function pintarSubSen() {
  for (const sub of ["hoy", "mueve", "decide"]) $(`#sen-${sub}`).hidden = senado.sub !== sub;
  document.querySelectorAll(".conmutador.subvistas-sen button").forEach((x) => x.setAttribute("aria-pressed", x.dataset.sensub === senado.sub ? "true" : "false"));
  if (senado.sub === "hoy") pintarSenadoHoy(senado.proy);
  else if (senado.sub === "mueve") { pintarBarrasSen(); recalcularSen(); }
  else pintarDecideSen(senado.proy);
}
document.querySelectorAll(".conmutador.subvistas-sen button").forEach((b) => b.addEventListener("click", () => { senado.sub = b.dataset.sensub; contar(`Senado ${senado.sub}`); pintarSubSen(); }));

function pintarSenadoHoy(proy) {
  const R = repartoSenado(proy), { des, nDes, total, M, tot, con } = R;
  // Las probabilidades solo valen si el robot las calculó con la misma mayoría. Tras cambiar los designados tardan una pasada.
  const S = D.prob?.senado_mayoria === M ? D.prob.senado : null, o = ordenar(con).filter((k) => k !== "Otros"), k1 = o[0], k2 = o[1];
  if (!k1) return;
  const X = con[k1], p1 = S?.[k1]?.p_mayoria, t = p1 == null ? -1 : tramo(p1);
  $("#sen-titulo").replaceChildren(el("b", {}, nombre(k1)), t >= 3 ? ` controlaría el Senado, ${palabra(p1)}.` : t === 2 ? ", mayoría del Senado en el aire." : t >= 0 ? ` sería el primero, pero sin mayoría asegurada.` : ` sería el partido con más senadores.`);
  // Tres cifras que se tocan, como en Hoy
  const resalta = (ks) => { const svg = $("#sen-arcos svg"); if (!svg) return; svg.classList.toggle("resalta", !!ks); svg.querySelectorAll("path.arco").forEach((pth) => pth.classList.toggle("on", !!ks && ks.includes(pth.dataset.k))); };
  const cifra = (n, texto, c, ks) => el("button", { type: "button", class: "cifra", style: { "--c": c }, onpointerenter: () => resalta(ks), onpointerleave: () => resalta(null), onclick: () => { senado.marcado = senado.marcado === (ks && ks[0]) ? null : (ks && ks[0]); resalta(senado.marcado ? [senado.marcado] : null); } }, el("b", { class: "num-sube" }, String(n)), el("span", {}, texto));
  $("#sen-cifras").replaceChildren(cifra(X, `${nombre(k1)} tendría`, color(k1), [k1]), cifra(M, "para controlarlo", "var(--acento)", null), ...(k2 ? [cifra(con[k2], `${nombre(k2)} tendría`, color(k2), [k2])] : []));
  arcos($("#sen-arcos"), con, null, { sin176: true, minimo: 10, sombra: des, unidad: "senadores", orden: ORDEN_SEN() });
  // Listas conjuntas solo al Senado: aquí cuentan dentro del partido que encabeza
  const csn = D.config.coaliciones_senado || [];
  $("#sen-nota-coalicion").textContent = csn.map((c) => `${c.nombre}, la lista conjunta de ${lista([c.a, ...c.de].map(nombre))}, cuenta aquí dentro de ${nombre(c.a)}. ${c.nota || ""}`).join(" ");
  $("#sen-arcos-leyenda").replaceChildren(...ordenar(con).filter((k) => con[k] > 0).map((k) => el("span", {}, insignia(k, "mini"), `${nombre(k)} `, el("b", {}, con[k]), des[k] ? el("small", {}, ` ${tot[k] || 0}+${des[k]}`) : null)));
  // El anillo con la probabilidad
  if (S && p1 != null) {
    const Rr = 36, L = 2 * Math.PI * Rr, p = Math.max(0, Math.min(1, p1));
    $("#sen-anillo").replaceChildren(el("div", { class: "anillo", style: { "--c": color(k1) } },
      el("svg", { viewBox: "0 0 90 90", role: "img", "aria-label": `${r100(p)} % de probabilidad`, html: `<circle cx="45" cy="45" r="${Rr}" class="fondo"/><circle cx="45" cy="45" r="${Rr}" class="valor" style="stroke-dasharray:${L};stroke-dashoffset:${L * (1 - p)}" transform="rotate(-90 45 45)"/>` }),
      el("div", { class: "anillo-txt" }, el("b", { class: "num-sube" }, `${r100(p)} %`), el("small", {}, "de las 10.000 repeticiones"))),
      el("p", { class: "anillo-pie" }, `Probabilidad de que ${elP(k1)} llegue solo a ${M}.${k2 && S[k2]?.p_mayoria >= 0.005 ? ` ${cap(elP(k2))}, ${r100(S[k2].p_mayoria)} %.` : ""}`));
  } else $("#sen-anillo").replaceChildren(el("p", { class: "fuente" }, "Las probabilidades del Senado se calculan en la próxima actualización."));
  // Congreso y Senado lado a lado, con el mismo partido
  const esc = D.resultados?.escanos || proy.total, cC = esc[k1] || 0, cS = con[k1];
  const mini = (titulo, e, raya, n, tot_, op) => el("div", { class: "sen-mini" }, el("h3", {}, titulo), el("div", { class: "arcos chico" }), el("p", { class: "sen-mini-cifra", style: { "--c": color(k1) } }, el("b", {}, String(n)), ` de ${tot_}`, el("span", { class: n >= raya ? "pasa" : "nopasa" }, n >= raya ? ` · pasa la raya por ${n - raya}` : ` · se queda a ${raya - n}`)));
  const mC = mini("Congreso", esc, 176, cC, 350), mS = mini("Senado", con, M, cS, total);
  $("#sen-doble").replaceChildren(mC, mS);
  arcos(mC.querySelector(".arcos"), esc, null, { minimo: 999, apagar: (k) => k !== k1 });
  arcos(mS.querySelector(".arcos"), con, null, { minimo: 999, sin176: true, unidad: "senadores", orden: ORDEN_SEN(), apagar: (k) => k !== k1 });
  const fC = cC / 350, fS = cS / total;
  $("#sen-doble-frase").textContent = `Con los mismos votos, ${elP(k1)} tendría el ${r100(fC)} % del Congreso y el ${r100(fS)} % del Senado. ${cC < 176 && cS >= M ? "Puede controlar el Senado sin mayoría en el Congreso, porque el Senado da 3 de 4 al primero de cada provincia." : cC >= 176 && cS >= M ? "Mayoría en las dos cámaras." : "Ni en una ni en otra."}`;
  // Lista de partidos con su franja
  const franja = (k) => [Math.min(S?.[k]?.p10 ?? tot[k] ?? 0, tot[k] || 0) + (des[k] || 0), Math.max(S?.[k]?.p90 ?? tot[k] ?? 0, tot[k] || 0) + (des[k] || 0)];
  const maxL = Math.max(...ordenar(con).map((k) => franja(k)[1]), M) * 1.05;
  $("#sen-lista").replaceChildren(...ordenar(con).filter((k) => con[k] > 0).map((k) => { const [a, b] = franja(k);
    return el("button", { type: "button", class: `sen-fila${senado.marcado === k ? " marcada" : ""}`, style: { "--c": color(k) }, "aria-label": `${nombre(k)}, ${con[k]} senadores`, onclick: () => { senado.marcado = senado.marcado === k ? null : k; resalta(senado.marcado ? [k] : null); document.querySelectorAll("#sen-lista .sen-fila").forEach((f) => f.classList.toggle("marcada", f.dataset.k === senado.marcado)); }, "data-k": k },
      el("span", { class: "nom" }, insignia(k), nombre(k)),
      el("span", { class: "pista" }, el("i", { class: "franja", style: { left: `${a / maxL * 100}%`, width: `${Math.max(0.5, (b - a) / maxL * 100)}%` } }), el("i", { class: "valor", style: { width: `${con[k] / maxL * 100}%` } }), el("i", { class: "raya", style: { left: `${M / maxL * 100}%` } })),
      el("span", { class: "num" }, String(con[k])), el("small", {}, S?.[k] && b > a ? `${a}–${b}` : des[k] ? `${tot[k] || 0}+${des[k]}` : "")); }));
  const d = D.config.senado, conNombre = ordenar(des).filter((k) => k !== "Otros");
  poner($("#sen-designados"), ...(nDes ? [`La franja es lo normal con las encuestas de hoy, y la raya, los ${M} que hacen falta. Las comunidades ya tienen designados ${nDes}, que no cambian el 29N. ${lista([...conNombre.map((k) => `${nombre(k)} ${des[k]}`), ...(des.Otros ? [`otros partidos ${des.Otros}`] : [])])}.`, des.Otros && d.otros ? ` Los otros son ${d.otros}.` : null,
    ...(d.fuente ? [" (", el("a", { href: d.fuente, target: "_blank", rel: "noopener" }, "fuente"), ")"] : [])] : []));
  // Mapa con tooltip y ficha al tocar
  pintarMapaSen($("#sen-mapa"), proy, R, { sel: () => senado.prov, alTocar: (nom) => { senado.prov = nom; pintarFichaSen(proy, R); pintarMapaSen($("#sen-mapa"), proy, R, { sel: () => senado.prov, alTocar: null, redibuja: true }); } });
  pintarFichaSen(proy, R);
}
function tipSenado(tip, p, R) {
  const cs = Modelo.cuotasSenado(p.cuotas, p.nombre, D.base), r = R.porProv[p.nombre], q = ordenar(r), n = Object.values(r).reduce((a, b) => a + b, 0), o = ordenar(cs).slice(0, 3);
  tip.replaceChildren(el("b", {}, `${p.nombre}, ${n} senadores`), el("div", { class: "fila-ult" }, ...q.map((k) => el("span", { class: "chip con-insignia", style: sobre(color(k)) }, insignia(k, "mini"), `${nombreSen(k, p.nombre)} ${r[k]}`))),
    el("span", { class: "m" }, o.length > 1 ? `${nombreSen(o[0], p.nombre)} ${fmt1.format(cs[o[0]])} %, ${nombreSen(o[1], p.nombre)} ${fmt1.format(cs[o[1]])} %${o[2] ? `, ${nombreSen(o[2], p.nombre)} ${fmt1.format(cs[o[2]])} %` : ""}` : ""));
}
function pintarMapaSen(cont, proy, R, op = {}) {
  const colorear = (p) => { const r = R.porProv[p.nombre], g = ordenar(r)[0]; return { fill: g ? color(g) : "var(--linea)", op: 1, txt: g ? sobre(color(g)).color : "var(--tinta)", etiqueta: String(Object.values(r).reduce((a, b) => a + b, 0)) }; };
  cont.innerHTML = dibujarMapa(proy, { vista: "ganador", sel: op.sel ? op.sel() || "" : "", colorear: op.colorear || colorear, resaltar: op.resaltar });
  const tip = el("div", { class: "mapa-tip", hidden: true }); cont.prepend(tip);
  cont.querySelectorAll("g.prov").forEach((g) => {
    const p = proy.provincias.find((x) => x.nombre === g.dataset.p);
    g.addEventListener("click", () => { if (op.alTocar) op.alTocar(g.dataset.p); else if (op.sel) { senado.prov = g.dataset.p; pintarFichaSen(proy, R); cont.querySelectorAll("g.prov").forEach((h) => h.classList.toggle("sel", h.dataset.p === senado.prov)); } });
    g.addEventListener("pointerenter", (ev) => { if (ev.pointerType !== "mouse" || !p) return; (op.tip || tipSenado)(tip, p, R); tip.hidden = false; moverTip(tip, ev); });
    g.addEventListener("pointermove", (ev) => { if (!tip.hidden) moverTip(tip, ev); });
    g.addEventListener("pointerleave", () => { tip.hidden = true; });
  });
}
function pintarFichaSen(proy, R) {
  const r = R.porProv[senado.prov], q = r ? ordenar(r) : [], p = proy.provincias.find((x) => x.nombre === senado.prov), cs = p ? Modelo.cuotasSenado(p.cuotas, p.nombre, D.base) : {};
  $("#sen-ficha").replaceChildren(...(r && p ? [el("div", { class: "ficha sen-ficha" }, el("h3", {}, `${senado.prov}, ${Object.values(r).reduce((a, b) => a + b, 0)} senadores`),
    el("div", { class: "chips grandes" }, ...q.map((k) => el("span", { class: "chip con-insignia", style: sobre(color(k)) }, insignia(k, "mini"), `${nombreSen(k, senado.prov)} ${r[k]}`))),
    el("p", {}, `${cap(elPSen(q[0], senado.prov))} sería el más votado con el ${fmt1.format(cs[q[0]])} % y se llevaría ${r[q[0]]}${q[1] ? `. ${cap(elPSen(q[1], senado.prov))}, segundo con el ${fmt1.format(cs[q[1]])} %, se llevaría ${r[q[1]]}` : ""}.`),
    el("button", { type: "button", class: "enlace-boton", onclick: () => { quitarDelEnlace("provincia"); mapa.sel = senado.prov; pintarMapa(mapa.proy); location.hash = "#mapa"; } }, "Ver la provincia al completo ›"))] : []));
}

/* Mueve el voto, versión Senado: las mismas barras que en ¿Y si…?, pero lo que cambia es el Senado */
function pintarBarrasSen() {
  const ks = ordenar(senado.base).filter((k) => senado.base[k] >= 0.8), max = 45;
  $("#sen-barras").replaceChildren(...ks.map((k) => { const v = senado.valores[k] ?? 0, d = v - senado.base[k];
    const r = el("input", { type: "range", min: "0", max: String(max), step: "0.1", value: v.toFixed(1), "aria-label": `${nombre(k)}, ${fmt1.format(v)} %`, style: { "--c": color(k), "--p": `${v / max * 100}%` } });
    r.addEventListener("input", () => moverVotoSen(k, +r.value));
    r.addEventListener("change", () => contar("Arrastra un partido en el Senado"));
    return el("div", { class: "sim-fila", "data-k": k, style: { "--c": color(k) } }, el("span", { class: "nom" }, insignia(k), nombre(k)), r,
      el("span", { class: "num" }, `${fmt1.format(v)} %`), el("small", { class: Math.abs(d) >= 0.05 ? (d > 0 ? "sube" : "baja") : "igual" }, Math.abs(d) >= 0.05 ? `${d > 0 ? "+" : "−"}${fmt1.format(Math.abs(d))}` : "="),
      el("span", { class: "esc" }, el("b", {}, "–"), el("small", {}, ""))); }));
  $("#sen-atajos").replaceChildren(el("button", { type: "button", class: "atajo volver", onclick: () => { senado.tocado = false; senado.valores = { ...senado.base }; pintarBarrasSen(); recalcularSen(); } }, "Volver a hoy"));
}
function moverVotoSen(k, v) {
  const V = senado.valores, antes = V[k] ?? 0, delta = v - antes, otros = Object.keys(V).filter((x) => x !== k && V[x] > 0), suma = otros.reduce((a, x) => a + V[x], 0);
  if (suma <= 0) return;
  const f = Math.max(0, (suma - delta) / suma);
  for (const x of otros) V[x] = +(V[x] * f).toFixed(3);
  V[k] = v; senado.tocado = true;
  document.querySelectorAll("#sen-barras .sim-fila").forEach((fila) => { const key = fila.dataset.k, vv = V[key] ?? 0, d = vv - senado.base[key], inp = fila.querySelector("input");
    if (key !== k) inp.value = vv.toFixed(1); inp.style.setProperty("--p", `${vv / 45 * 100}%`); fila.querySelector(".num").textContent = `${fmt1.format(vv)} %`; const sm = fila.querySelector("small"); sm.textContent = Math.abs(d) >= 0.05 ? `${d > 0 ? "+" : "−"}${fmt1.format(Math.abs(d))}` : "="; sm.className = Math.abs(d) >= 0.05 ? (d > 0 ? "sube" : "baja") : "igual"; });
  recalcularSen();
}
function recalcularSen() {
  const proy = Modelo.proyectar(senado.valores, D.base), R = repartoSenado(proy), R0 = repartoSenado(senado.proy), { con, M, total } = R;
  arcos($("#sen-sim-arcos"), con, R0.con, { sin176: true, minimo: 10, sombra: R.des, unidad: "senadores", orden: ORDEN_SEN() });
  leyendaArcos($("#sen-sim-leyenda"), con, R0.con);
  asientosEnFilas("#sen-barras", con, R0.con, "senadores");
  const o = ordenar(con).filter((k) => k !== "Otros"), k1 = o[0], k2 = o[1], X = con[k1] || 0;
  $("#sen-sim-cifra").replaceChildren(el("b", { style: { color: color(k1) } }, `${X}`), ` ${nombre(k1)}`, el("span", { class: X >= M ? "pasa" : "nopasa" }, X > M ? ` · pasa la raya por ${X - M}` : X === M ? " · justo en la raya" : ` · le faltan ${M - X}`), k2 ? el("small", {}, `${nombre(k2)}, ${con[k2]}`) : null);
  // Provincias que cambian de primero respecto a hoy
  const cambian = proy.provincias.filter((p) => ordenar(R.porProv[p.nombre])[0] !== ordenar(R0.porProv[p.nombre])[0]);
  const frase = cambian.slice(0, 6).map((p) => `${p.nombre} (${nombre(ordenar(R0.porProv[p.nombre])[0])} › ${nombre(ordenar(R.porProv[p.nombre])[0])})`);
  $("#sen-sim-cambios").textContent = !senado.tocado ? "Mueve una barra y mira qué provincias cambian de primero. Cada una que cambia mueve 2 senadores." : cambian.length ? `${cambian.length === 1 ? "Cambia de primero 1 provincia" : `Cambian de primero ${cambian.length} provincias`}, ${lista(frase)}${cambian.length > 6 ? " y más" : ""}.` : "Con ese movimiento ninguna provincia cambia de primero, así que el Senado se queda casi igual.";
  pintarMapaSen($("#sen-sim-mapa"), proy, R, { resaltar: new Set(cambian.map((p) => p.nombre)) });
}

/* Dónde se decide: las provincias ordenadas por lo pegados que van el primero y el segundo */
function pintarDecideSen(proy) {
  const R = repartoSenado(proy);
  const filas = proy.provincias.map((p) => { const cs = Modelo.cuotasSenado(p.cuotas, p.nombre, D.base), o = ordenar(cs), d = o.length > 1 ? cs[o[0]] - cs[o[1]] : 99, s = Modelo.senadoProvincia(p.cuotas, p.nombre, D.base), enJuego = (s[o[0]] || 0) - (s[o[1]] || 0); return { p, k1: o[0], k2: o[1], d, votos: votosDe(d, p.n), enJuego }; }).filter((x) => x.k2).sort((a, b) => a.votos - b.votos || a.d - b.d);
  const colorear = (p) => { const f = filas.find((x) => x.p === p); if (!f) return { fill: "var(--linea)", op: .5, txt: "var(--tinta)", etiqueta: ABREV[p.nombre] || "", tam: 15 };
    const op = f.d < 2 ? 1 : f.d < 5 ? .7 : f.d < 10 ? .45 : .22; return { fill: color(f.k1), op, txt: op >= .7 ? sobre(color(f.k1)).color : "var(--tinta)", etiqueta: ABREV[p.nombre] || "", tam: 15 }; };
  pintarMapaSen($("#sen-decide-mapa"), proy, R, { colorear, tip: (tip, p) => { const f = filas.find((x) => x.p === p); if (!f) return; tip.replaceChildren(el("b", {}, `${p.nombre}, ${f.enJuego} senadores en juego`), el("div", { class: "fila-ult" }, el("span", { class: "chip con-insignia", style: sobre(color(f.k1)) }, insignia(f.k1, "mini"), nombreSen(f.k1, p.nombre)), el("i", {}, "›"), el("span", { class: "chip con-insignia", style: sobre(color(f.k2)) }, insignia(f.k2, "mini"), nombreSen(f.k2, p.nombre))), el("span", { class: "m" }, `${fmt1.format(f.d)} puntos, unos ${fmt0.format(f.votos)} votos`)); }, alTocar: (nom) => { quitarDelEnlace("provincia"); mapa.sel = nom; pintarMapa(mapa.proy); location.hash = "#mapa"; } });
  const chip = (k, prov) => el("span", { class: "chip con-insignia", style: sobre(color(k)) }, insignia(k, "mini"), nombreSen(k, prov));
  $("#sen-decide-lista").replaceChildren(el("div", { class: "cab" }, el("span", {}, "Provincia"), el("span", {}, "Primero"), el("span", {}, "Segundo"), el("span", {}, "Diferencia")),
    ...filas.slice(0, 15).map((x) => el("button", { type: "button", class: "ultimo-prov", onclick: () => { quitarDelEnlace("provincia"); mapa.sel = x.p.nombre; pintarMapa(mapa.proy); location.hash = "#mapa"; } },
      el("span", { class: "prov" }, el("b", {}, x.p.nombre), el("small", {}, `${x.enJuego} senadores en juego`)), chip(x.k1, x.p.nombre), el("span", { class: "sig" }, el("i", {}, "›"), chip(x.k2, x.p.nombre)), el("span", { class: "falta" }, x.votos < 100 ? "empate" : `${fmt0.format(x.votos)} votos`))));
}

/* ---------- Modo partido: se elige uno y cada pestaña abre con su ficha ---------- */
const foco = { k: null, ctx: null };
let graficoFoco;
try { foco.k = localStorage.getItem("partido") || null; } catch {}
function elegirFoco(k) { quitarDelEnlace("partido"); foco.k = k; if (k) contar("Usa el modo partido"); try { if (k) localStorage.setItem("partido", k); else localStorage.removeItem("partido"); } catch {} pintarFoco(); }
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
  const chispas = chispasFoco(partidos);
  const fila = el("div", { class: "fila" }, el("button", { type: "button", "aria-pressed": k ? "false" : "true", onclick: () => elegirFoco(null) }, "Todos"),
    ...partidos.map((x) => el("button", { type: "button", "data-k": x, "aria-pressed": k === x ? "true" : "false", style: k === x ? { ...sobre(color(x)), borderColor: sobre(color(x)).background } : null, onclick: () => elegirFoco(k === x ? null : x) },
      logoTira(x), nombre(x), chispas[x] ? el("svg", { class: "chispa", viewBox: "0 0 34 14", "aria-hidden": "true", html: `<polyline points="${chispas[x]}"/>` }) : null)));
  poner($("#foco-tira"), el("div", { class: "eti" }, el("span", {}, k ? `Toda la app, centrada en ${nombre(k)}` : "Céntrate en un partido"),
    k ? botonEnlace("Copiar enlace", () => enlaceA({ partido: k, pestana: pestanaActual })) : null), carril(fila, donde), k ? notaAviso(k, { class: "foco-aviso" }) : null);
  const caja = (id) => $(`#foco-${id}`);
  for (const id of ["hoy", "mapa", "encuestas", "senado", "simulador", "noticias"]) caja(id).replaceChildren();
  graficoFoco?.destroy(); graficoFoco = null;
  if (!k) return;
  const col = color(k), art = (titulo, ...hijos) => el("article", { class: "pregunta foco", style: { "--c": col } }, el("h2", { class: Array.isArray(titulo) ? "con-logo" : "" }, ...(Array.isArray(titulo) ? titulo : [titulo])), ...hijos);
  const X = proy.total[k] || 0, pp = P?.partidos?.[k], pos = ordenar(m.media).indexOf(k) + 1, d = m7.media[k] != null ? dif1(m.media[k], m7.media[k]) : 0;
  const der = escenario(D.config.principales.derecha), izq = escenario(D.config.principales.izquierda);

  // Hoy
  const hemi = el("div", { class: "hemi" });
  hemiciclo(hemi, proy.total, 10, null, "176", k);
  const a23 = D.base.escanos_reales?.[k], ag = [];
  if (pp && (pp.p_primero >= 0.005 || pos <= 2)) ag.push(agujaFija("Ser el más votado", pp.p_primero, col));
  if (pp && (pp.p_mayoria >= 0.001 || pos <= 2)) ag.push(agujaFija("Mayoría absoluta sin nadie más", pp.p_mayoria, col));
  for (const e of [der, izq]) if (e && e.partidos.length > 1 && e.partidos.includes(k)) ag.push(agujaFija(`Mayoría de ${nombreEsc(e)}`, e.p, col));
  if (pp && pp.p10 === 0 && pp.histograma) { const tot = Object.values(pp.histograma).reduce((a, b) => a + b, 0); if (tot) ag.push(agujaFija("Entrar en el Congreso", 1 - (pp.histograma[0] || 0) / tot, col)); }
  caja("hoy").append(art([D.config.partidos[k]?.logo ? logoTira(k, "logo-ficha") : null, `${nombre(k)}, de un vistazo`],
    el("p", { class: "respuesta" }, el("b", {}, `${fmt1.format(m.media[k])} % de los votos.`), ` Es el ${ORDINAL[pos] || `número ${pos}`} en la media de encuestas y ${d ? `${d > 0 ? "sube" : "baja"} ${fmt1.format(Math.abs(d))} ${Math.abs(d) === 1 ? "punto" : "puntos"} esta semana` : "está igual que la semana pasada"}.`),
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
  mapaK.innerHTML = dibujarMapa(proy, { vista: "ganador", sel: "", colorear: (p) => { const n = p.escanos[k] || 0, op = n ? 0.35 + 0.65 * Math.sqrt(n / maxS) : 0.45; return { fill: n ? col : "var(--linea)", op, txt: n ? sobre(col, op).color : "var(--tinta)", etiqueta: n ? String(n) : "" }; } });
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
  for (const p of proy.provincias) { const r = Modelo.senadoProvincia(p.cuotas, p.nombre, D.base), o = ordenar(r); for (const [x, n] of Object.entries(r)) sen[x] = (sen[x] || 0) + n; if (o[0] === k) primeras.push(p.nombre); else if (r[k]) segundas.push(p.nombre); }
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
  D.sinEncuestas = sinDatos; // lo que se enseña entonces es el resultado de 2023, y la cabecera lo avisa
  const proy = Modelo.proyectar(m.media, D.base);
  proyActual = proy;
  diaPintado = diaMadrid();
  pintarHoy(m, m7, proy);
  pintarDesde(m, proy, sinDatos);
  pintarEncuestas(m, m7, proy);
  pintarMapa(proy);
  pintarSenado(proy, m);
  // En un refresco automático no se le deshace a nadie la situación que esté probando en ¿Y si…?
  const probando = !!sim.tocado;
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
    // El flujo en cuatro pasos, con las cifras del día. Al tocar uno se abre su apartado.
    const abre = (id) => () => { const d = $(`#met-${id}`); if (!d) return; d.open = true; d.scrollIntoView({ behavior: "smooth", block: "start" }); };
    const paso = (n, cifra, texto, id) => el("button", { type: "button", class: "met-pasito", onclick: abre(id) }, el("span", { class: "n" }, String(n)), el("b", { class: "num-sube" }, cifra), el("span", { class: "t" }, texto));
    const back = P?.backtest, pasos = [paso(1, fmt0.format(E.length), "encuestas publicadas desde 2023", 1), paso(2, String(m.usadas.length), "cuentan hoy, ponderadas", 2), paso(3, "52", "provincias, reparto D'Hondt", 3), paso(4, "10.000", "repeticiones con el error de otras veces", 4)];
    $("#met-flujo").replaceChildren(...pasos.flatMap((x, i) => i ? [el("span", { class: "flecha-paso", "aria-hidden": "true" }, "›"), x] : [x]));
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
  const aviso = D.sinEncuestas ? "No se han podido cargar las encuestas. Los porcentajes y los asientos que ves son el resultado de las elecciones de 2023, no la media de hoy."
    : hE != null && hE > 3 ? `Las encuestas no se han podido leer desde hace ${rato(hE)}. Lo que ves es la última lectura buena.`
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
  if (D.base) D.base.coaliciones = D.config?.coaliciones || []; // uniones que solo valen en una comunidad (modelo.js, fundirTerritorial)
  if (D.base) D.base.coaliciones_senado = D.config?.coaliciones_senado || []; // listas conjuntas solo al Senado (modelo.js, cuotasSenado)
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
  animarNumeros(document.getElementById(pestanaActual));
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
/* Nombres legibles para el panel. Lo que la app cuenta con clave corta (Y si enjuego, Provincias ultimo…) sale con su nombre de pantalla. */
const VIS_NOMBRES = { "Pestaña Hoy": "Vuelven a Hoy", "Usa el modo partido": "Modo partido", "Usa monta tu caso": "Monta tu caso", "Comparte la foto": "Compartir la foto", "Abre el menú Más": "Menú Más",
  "Y si mueve": "¿Y si…?, mueve el voto", "Y si enjuego": "¿Y si…?, en juego", "Y si pactos": "¿Y si…?, pactos", "Provincias mapa": "Provincias, mapa", "Provincias ultimo": "Provincias, último asiento", "Provincias tabla": "Provincias, tabla por territorio",
  "Senado hoy": "Senado, hoy", "Senado mueve": "Senado, mueve el voto", "Senado decide": "Senado, dónde se decide", "Tareas todos": "Trámites, para votar", "Tareas correo": "Trámites, por correo", "Tareas fuera": "Trámites, fuera de España",
  "Gráfica tendencia": "Gráfica, tendencia", "Gráfica carrera": "Gráfica, carrera", "Gráfica pct": "Gráfica, en votos", "Gráfica esc": "Gráfica, en asientos", "Gráfica partidos": "Gráfica, partidos", "Gráfica bloques": "Gráfica, bloques" };
const visUso = (n) => VIS_NOMBRES[n] || n.replace(/^Pestaña /, "");
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
