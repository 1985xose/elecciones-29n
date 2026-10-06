"use strict";
const D = {};
const DIA = 86400000;
const fmt1 = new Intl.NumberFormat("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const fmt0 = new Intl.NumberFormat("es-ES");
const fFecha = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short" });
const fFechaLarga = new Intl.DateTimeFormat("es-ES", { weekday: "short", day: "numeric", month: "short" });
const $ = (s) => document.querySelector(s);

function el(tag, attrs = {}, ...hijos) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === "style" && typeof v === "object") { for (const [sk, sv] of Object.entries(v)) sk.startsWith("--") ? e.style.setProperty(sk, sv) : (e.style[sk] = sv); }
    else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? "" : v);
  }
  for (const h of hijos.flat()) if (h != null && h !== false) e.append(h.nodeType ? h : String(h));
  return e;
}
const color = (k) => D.config.partidos[k]?.color || "#8A93A3";
const nombre = (k) => D.config.partidos[k]?.nombre || k;
const hoy = () => new Date(new Date().toISOString().slice(0, 10) + "T12:00:00Z");
const fechaD = (s) => new Date(s + "T12:00:00Z");
const signo = (d) => (d > 0 ? "+" : "−") + fmt1.format(Math.abs(d));
function hace(iso) {
  if (!iso) return "";
  const m = Math.round((Date.now() - new Date(iso)) / 60000);
  if (m < 60) return `hace ${Math.max(m, 1)} min`;
  if (m < 1440) return `hace ${Math.round(m / 60)} h`;
  return `hace ${Math.round(m / 1440)} d`;
}
async function cargar(n) {
  try { const r = await fetch(`data/${n}.json?v=${Date.now()}`); return r.ok ? await r.json() : null; } catch { return null; }
}

/* ---------- Pestañas ---------- */
function activarPestana(id) {
  const ids = ["hoy", "encuestas", "mapa", "simulador", "mas"];
  if (!ids.includes(id)) id = "hoy";
  for (const i of ids) { document.getElementById(i).hidden = i !== id; }
  document.querySelectorAll(".pestanas a").forEach((a) => a.classList.toggle("activa", a.dataset.tab === id));
  window.scrollTo({ top: 0 });
  if (id === "encuestas" && !graficoTendencia && D.listo) pintarTendencia();
  if (id === "mas" && !graficoAtencion && D.listo) pintarAtencion();
}
window.addEventListener("hashchange", () => activarPestana(location.hash.slice(1)));

/* ---------- Media de encuestas ---------- */
function factorAcierto(clave) {
  const r = D.fiabilidad?.ranking?.find((x) => x.clave === clave);
  return r ? Math.min(1.4, Math.max(0.6, 1.6 / (0.6 + r.error_medio))) : 1;
}
function calcMedia(fecha = hoy(), ventana = 30) {
  const todas = D.encuestas?.encuestas || [];
  const incluirCIS = $("#incluir-cis")?.checked;
  const elegir = (v) => {
    const ult = {};
    for (const e of todas) {
      const edad = (fecha - fechaD(e.fin)) / DIA;
      if (edad < 0 || edad > v || (!incluirCIS && e.clave === "cis")) continue;
      if (!ult[e.clave] || ult[e.clave].fin < e.fin) ult[e.clave] = e;
    }
    return Object.values(ult);
  };
  let usadas = elegir(ventana);
  if (usadas.length < 4) usadas = elegir(ventana * 2);
  const suma = {}, pesos = {};
  for (const e of usadas) {
    const edad = (fecha - fechaD(e.fin)) / DIA;
    const peso = Math.exp(-edad / 14) * Math.sqrt(Math.min(e.muestra || 1000, 5000) / 1000) * factorAcierto(e.clave);
    for (const [p, v] of Object.entries(e.pct)) { suma[p] = (suma[p] || 0) + v * peso; pesos[p] = (pesos[p] || 0) + peso; }
  }
  const media = {};
  for (const p of Object.keys(suma)) media[p] = suma[p] / pesos[p];
  return { media, usadas };
}
const ordenar = (o) => Object.keys(o).sort((a, b) => o[b] - o[a]);

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

/* ---------- Hoy ---------- */
function pintarHoy(m, m7, proy) {
  const dias = Math.round((fechaD(D.config.eleccion.fecha) - hoy()) / DIA);
  $("#cuenta").innerHTML = dias > 1 ? `faltan <strong>${dias} días</strong>` : dias === 1 ? "<strong>mañana</strong> se vota" : dias === 0 ? "<strong>hoy</strong> se vota" : "elecciones celebradas";
  const esc = D.resultados?.escanos || proy.total;
  hemiciclo($("#hemiciclo"), esc);
  leyenda($("#leyenda"), esc);
  const o = ordenar(esc).filter((k) => esc[k] > 0);
  if (D.resultados?.escanos) $("#titular").textContent = `Resultados con el ${fmt1.format(D.resultados.escrutado || 0)}% escrutado`;
  else if (!o.length) $("#titular").textContent = "Aún no hay encuestas cargadas.";
  else {
    const dif = esc[o[0]] - esc[o[1]];
    $("#titular").textContent = `Si se votara hoy, ${nombre(o[0])} ganaría con ${esc[o[0]]} escaños, ${dif} más que ${nombre(o[1])}. Nadie llega a 176.`;
    if (esc[o[0]] >= 176) $("#titular").textContent = `Si se votara hoy, ${nombre(o[0])} tendría mayoría absoluta con ${esc[o[0]]} escaños.`;
  }
  const top = ordenar(m.media).slice(0, 3);
  $("#podio").replaceChildren(...top.map((k) => {
    const d = m7.media[k] != null ? m.media[k] - m7.media[k] : 0;
    return el("div", { class: "tile", style: { "--c": color(k) } }, el("div", { class: "n" }, nombre(k)), el("div", { class: "g" }, `${fmt1.format(m.media[k])}%`),
      el("div", { class: "s" }, `${proy.total[k] || 0} ${proy.total[k] === 1 ? "escaño" : "escaños"}`), Math.abs(d) >= 0.1 ? el("div", { class: `d ${d > 0 ? "sube" : "baja"}` }, `${signo(d)} esta semana`) : el("div", { class: "d s" }, "sin cambios"));
  }));
  const items = [];
  const nuevas = (D.encuestas?.encuestas || []).filter((e) => e.primera_vez && Date.now() - new Date(e.primera_vez) < 2 * DIA);
  if (nuevas.length) {
    const top3 = (e) => ordenar(e.pct).slice(0, 3).map((k) => `${nombre(k)} ${fmt1.format(e.pct[k])}`).join(", ");
    items.push(`${nuevas.length === 1 ? "Encuesta nueva" : nuevas.length + " encuestas nuevas"}. ${nuevas.slice(0, 2).map((e) => `${e.empresa_base}: ${top3(e)}`).join(". ")}.`);
  } else if (D.encuestas?.encuestas?.length) {
    const u = D.encuestas.encuestas[0];
    items.push(`La encuesta más reciente es de ${u.empresa_base}, con trabajo de campo hasta el ${fFecha.format(fechaD(u.fin))}.`);
  }
  const cambios = Object.keys(m.media).filter((k) => m7.media[k] != null).map((k) => ({ k, d: m.media[k] - m7.media[k] })).filter((x) => Math.abs(x.d) >= 0.3).sort((a, b) => Math.abs(b.d) - Math.abs(a.d)).slice(0, 3);
  if (cambios.length) items.push("Esta semana " + cambios.map((x) => `${nombre(x.k)} ${x.d > 0 ? "sube" : "baja"} ${fmt1.format(Math.abs(x.d))}`).join(", ") + " puntos.");
  else if (Object.keys(m7.media).length) items.push("La media apenas se mueve esta semana, ningún partido cambia más de 0,3 puntos.");
  const filo = proy.provincias.filter((p) => p.aspirante && p.aspirante.falta < 0.5);
  if (filo.length) items.push(`${filo.length} provincias tienen el último escaño en el aire, a menos de medio punto: ${filo.slice(0, 5).map((p) => p.nombre).join(", ")}.`);
  const sig = (D.agenda || []).find((x) => fechaD(x.fin || x.fecha) >= hoy());
  if (sig) items.push(`Próxima fecha, ${fFechaLarga.format(fechaD(sig.fecha))}: ${sig.titulo}.`);
  $("#resumen").replaceChildren(...(items.length ? items.map((t) => el("li", {}, t)) : [el("li", { class: "vacio" }, "Aún no hay datos. La primera actualización tarda unos minutos.")]));
  $("#titulares").replaceChildren(...(D.noticias?.generales || []).slice(0, 6).map((n) => el("a", { class: "titular-n", href: n.enlace, target: "_blank", rel: "noopener" }, n.titulo, el("span", { class: "m" }, `${n.fuente} ${hace(n.fecha)}`))));
}

/* ---------- Encuestas ---------- */
let graficoTendencia, graficoAtencion;
function pintarEncuestas(m, m7, proy) {
  const o = ordenar(m.media).filter((k) => m.media[k] >= 0.5);
  const max = Math.max(...o.map((k) => m.media[k]), 1);
  $("#lista-partidos").replaceChildren(...o.map((k) => {
    const d = m7.media[k] != null ? m.media[k] - m7.media[k] : 0;
    return el("div", { class: "fila-p" },
      el("div", { class: "nom" }, el("i", { class: "punto", style: { background: color(k) } }), nombre(k)),
      el("div", { class: "pct" }, `${fmt1.format(m.media[k])}%`, Math.abs(d) >= 0.1 ? el("small", { class: d > 0 ? "sube" : "baja" }, signo(d)) : null),
      el("div", { class: "barra" }, el("i", { style: { width: `${m.media[k] / max * 100}%`, background: color(k) } })),
      el("div", { class: "esc" }, `${proy.total[k] || 0} ${proy.total[k] === 1 ? "escaño" : "escaños"}`));
  }));
  const usadas = new Set(m.usadas.map((e) => e.id));
  $("#tarjetas-encuestas").replaceChildren(...(D.encuestas?.encuestas || []).slice(0, 15).map((e) => {
    const nueva = e.primera_vez && Date.now() - new Date(e.primera_vez) < 2 * DIA;
    return el("div", { class: "tarjeta", style: usadas.has(e.id) ? null : { opacity: .7 } },
      el("div", { class: "cab" }, el("b", {}, e.empresa_base, e.encargo ? ` para ${e.encargo}` : "", nueva ? el("span", { class: "etiqueta-nueva" }, "nueva") : null), el("span", {}, `${fFecha.format(fechaD(e.fin))}${e.muestra ? `, n=${fmt0.format(e.muestra)}` : ""}`)),
      el("div", { class: "chips" }, ...ordenar(e.pct).slice(0, 6).map((k) => el("span", { class: "chip", style: { background: color(k) } }, `${nombre(k)} ${fmt1.format(e.pct[k])}`))));
  }));
  if (D.encuestas) $("#fuente-encuestas").replaceChildren("Atenuadas las que no entran en la media de hoy. Fuente ", el("a", { href: D.encuestas.fuente, target: "_blank", rel: "noopener" }, "Wikipedia"), `, actualizado ${hace(D.encuestas.actualizado)}.`);
  graficoTendencia?.destroy(); graficoTendencia = null;
  if (!$("#encuestas").hidden) pintarTendencia();
}
function pintarTendencia() {
  const m = calcMedia();
  const o = ordenar(m.media).filter((k) => m.media[k] >= 1.5).slice(0, 7);
  const puntos = [];
  for (let t = fechaD("2023-09-03"); t <= hoy(); t = new Date(+t + 7 * DIA)) puntos.push(t);
  if (puntos[puntos.length - 1] < hoy()) puntos.push(hoy());
  const series = {};
  for (const t of puntos) { const mm = calcMedia(t, 28).media; for (const k of o) (series[k] ||= []).push(mm[k] != null ? +mm[k].toFixed(2) : null); }
  graficoTendencia?.destroy();
  graficoTendencia = new Chart($("#grafico-tendencia"), { type: "line",
    data: { labels: puntos.map((t) => t.getUTCMonth() === 0 && t.getUTCDate() <= 7 ? String(t.getUTCFullYear()) : fFecha.format(t)),
      datasets: o.map((k) => ({ label: nombre(k), data: series[k], borderColor: color(k), backgroundColor: color(k), borderWidth: 2.5, pointRadius: 0, tension: .3, spanGaps: true })) },
    options: opciones("%") });
}
function opciones(suf) {
  const css = getComputedStyle(document.documentElement), gris = css.getPropertyValue("--gris").trim(), linea = css.getPropertyValue("--linea").trim();
  return { responsive: true, maintainAspectRatio: false, interaction: { mode: "index", intersect: false },
    plugins: { legend: { position: "bottom", labels: { color: gris, boxWidth: 10, boxHeight: 10, usePointStyle: true } }, tooltip: { callbacks: { label: (c) => `${c.dataset.label} ${c.parsed.y == null ? "–" : fmt1.format(c.parsed.y)}${suf}` } } },
    scales: { x: { ticks: { color: gris, maxRotation: 0, autoSkipPadding: 18 }, grid: { display: false } }, y: { beginAtZero: true, ticks: { color: gris }, grid: { color: linea } } } };
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

function pintarMapa(proy) {
  mapa.proy = proy;
  const T = 44, G = 4;
  let svg = `<svg viewBox="0 0 ${11 * (T + G)} ${9 * (T + G)}" role="img" aria-label="Mapa de provincias">`;
  for (const p of proy.provincias) {
    const [x, y] = TESELAS[p.nombre] || [0, 0];
    const gan = ordenar(p.escanos)[0];
    let fill = gan ? color(gan) : "var(--linea)", op = 1, txt = "#fff";
    if (mapa.vista === "filo") {
      const f = p.aspirante ? p.aspirante.falta : 9;
      op = f < 0.5 ? 1 : f < 1 ? .75 : f < 2 ? .5 : f < 4 ? .3 : .15;
      fill = "var(--mal)"; txt = f < 1 ? "#fff" : "var(--tinta)";
    } else if (gan && ordenar(p.escanos).length > 1 && p.escanos[gan] === p.escanos[ordenar(p.escanos)[1]]) op = .6; // empate a escaños
    svg += `<g class="tesela${mapa.sel === p.nombre ? " sel" : ""}" data-p="${p.nombre}"><rect x="${x * (T + G)}" y="${y * (T + G)}" width="${T}" height="${T}" fill="${fill}" fill-opacity="${op}"/>`;
    svg += `<text x="${x * (T + G) + T / 2}" y="${y * (T + G) + 18}" text-anchor="middle" font-size="11" font-weight="700" fill="${txt}">${ABREV[p.nombre]}</text>`;
    svg += `<text x="${x * (T + G) + T / 2}" y="${y * (T + G) + 34}" text-anchor="middle" font-size="12" fill="${txt}">${mapa.vista === "filo" && p.aspirante ? fmt1.format(Math.max(p.aspirante.falta, 0)) : p.n}</text></g>`;
  }
  svg += "</svg>";
  $("#mapa-svg").innerHTML = svg;
  $("#mapa-svg").querySelectorAll(".tesela").forEach((g) => g.addEventListener("click", () => { mapa.sel = g.dataset.p; try { localStorage.setItem("mi-provincia", mapa.sel); } catch {} pintarMapa(mapa.proy); }));
  $("#mapa-pista").textContent = mapa.vista === "ganador" ? "Color del partido con más escaños en cada provincia y escaños que reparte. Más claro, empate entre los dos primeros. Toca una para ver el detalle." : "Puntos que le faltan al siguiente partido para quitar el último escaño. Cuanto más rojo, más en el aire.";
  const p = proy.provincias.find((x) => x.nombre === mapa.sel);
  $("#ficha-provincia").replaceChildren(...(p ? [el("div", { class: "ficha" }, el("h3", {}, `${p.nombre}, ${p.n} escaños`),
    el("div", { class: "chips" }, ...ordenar(p.escanos).map((k) => el("span", { class: "chip", style: { background: color(k) } }, `${nombre(k)} ${p.escanos[k]}`))),
    p.aspirante ? el("p", {}, `El último escaño se lo lleva ${nombre(p.ultimo.p)}. ${nombre(p.aspirante.p)} se lo quitaría con ${fmt1.format(Math.max(p.aspirante.falta, 0))} puntos más.`) : null,
    el("p", { class: "fuente" }, "Voto estimado: " + ordenar(p.cuotas).filter((k) => p.cuotas[k] >= 1).map((k) => `${nombre(k)} ${fmt1.format(p.cuotas[k])}%`).join(", ")))] : []));
  const aj = [...proy.provincias].filter((x) => x.aspirante).sort((a, b) => a.aspirante.falta - b.aspirante.falta).slice(0, 5);
  $("#ajustadas").replaceChildren(...aj.map((x) => el("button", { class: "ajustada", type: "button", onclick: () => { mapa.sel = x.nombre; pintarMapa(mapa.proy); $("#ficha-provincia").scrollIntoView({ behavior: "smooth", block: "center" }); } },
    el("b", {}, x.nombre), el("span", { class: "pts" }, `${fmt1.format(Math.max(x.aspirante.falta, 0))} pts`),
    el("span", { class: "m" }, `${nombre(x.ultimo.p)} tiene el último escaño, lo persigue ${nombre(x.aspirante.p)}`))));
}
document.querySelectorAll(".conmutador button").forEach((b) => b.addEventListener("click", () => {
  mapa.vista = b.dataset.vista;
  document.querySelectorAll(".conmutador button").forEach((x) => x.setAttribute("aria-pressed", x === b ? "true" : "false"));
  pintarMapa(mapa.proy);
}));

/* ---------- Simulador ---------- */
const sim = { valores: {}, seleccion: new Set() };
function pintarSimulador(m, proyBase) {
  sim.valores = { ...m.media }; sim.proyBase = proyBase;
  const o = ordenar(m.media).filter((k) => m.media[k] >= 0.3);
  $("#sim-controles").replaceChildren(...o.map((k) => {
    const out = el("output", {}, fmt1.format(sim.valores[k]));
    return el("label", { class: "deslizador" }, el("span", {}, el("i", { class: "punto", style: { background: color(k) } }), " ", nombre(k)),
      el("input", { type: "range", min: 0, max: 45, step: 0.1, value: sim.valores[k].toFixed(1), "aria-label": `Voto de ${nombre(k)}`, style: { accentColor: color(k) },
        oninput: (ev) => { sim.valores[k] = +ev.target.value; out.textContent = fmt1.format(sim.valores[k]); programarSim(); } }), out);
  }), el("button", { class: "boton", type: "button", onclick: () => pintarSimulador(m, proyBase) }, "Volver a la media de encuestas"));
  recalcularSim();
}
let simPendiente = false;
function programarSim() { if (!simPendiente) { simPendiente = true; requestAnimationFrame(() => { simPendiente = false; recalcularSim(); }); } }
function recalcularSim() {
  const proy = Modelo.proyectar(sim.valores, D.base);
  hemiciclo($("#sim-hemiciclo"), proy.total, 10);
  leyenda($("#sim-leyenda"), proy.total, (k) => { const d = proy.total[k] - (sim.proyBase.total[k] || 0); return d ? el("small", { class: d > 0 ? "sube" : "baja" }, ` ${d > 0 ? "+" : "−"}${Math.abs(d)}`) : null; });
  for (const k of [...sim.seleccion]) if (!proy.total[k]) sim.seleccion.delete(k);
  const suma = [...sim.seleccion].reduce((s, k) => s + (proy.total[k] || 0), 0);
  $("#pactos").replaceChildren(...ordenar(proy.total).filter((k) => proy.total[k] > 0).map((k) => el("button", { class: "pacto", type: "button", "aria-pressed": sim.seleccion.has(k) ? "true" : "false",
    onclick: () => { sim.seleccion.has(k) ? sim.seleccion.delete(k) : sim.seleccion.add(k); recalcularSim(); } }, el("i", { class: "punto", style: { background: color(k) } }), `${nombre(k)} ${proy.total[k]}`)),
    el("div", { class: "suma-pacto" }, sim.seleccion.size ? (suma >= 176 ? `Suman ${suma}, mayoría absoluta.` : `Suman ${suma}, les faltan ${176 - suma}.`) : "Marca partidos para sumar sus escaños.",
      el("div", { class: "medidor" }, el("div", { class: "lleno", style: { width: `${suma / 350 * 100}%` } }), el("div", { class: "meta" }))));
  const cambian = [];
  proy.provincias.forEach((p, i) => {
    const a = sim.proyBase.provincias[i].escanos, b = p.escanos;
    const dif = [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((k) => (a[k] || 0) !== (b[k] || 0)).map((k) => `${nombre(k)} ${(b[k] || 0) - (a[k] || 0) > 0 ? "+" : "−"}${Math.abs((b[k] || 0) - (a[k] || 0))}`);
    if (dif.length) cambian.push(`${p.nombre} (${dif.join(", ")})`);
  });
  $("#sim-cambios").textContent = cambian.length ? `Cambian ${cambian.length} provincias: ${cambian.join("; ")}.` : "Con estos datos el reparto es el mismo que con la media de encuestas.";
}

/* ---------- Más ---------- */
function pintarFiabilidad() {
  const f = D.fiabilidad;
  if (!f) { $("#fiabilidad").replaceChildren(el("p", { class: "vacio" }, "Se calcula en la primera actualización.")); return; }
  const ult = {}; for (const e of D.encuestas?.encuestas || []) if (!ult[e.clave]) ult[e.clave] = e;
  $("#fiabilidad").replaceChildren(...f.ranking.map((r, i) => el("div", { class: "fila-f" }, el("span", { class: "pos" }, i + 1),
    el("span", {}, r.empresa, el("span", { class: "m" }, r.elecciones === 2 ? "evaluada en 2019 y 2023" : "evaluada en una elección", ult[r.clave] ? `, última encuesta ${fFecha.format(fechaD(ult[r.clave].fin))}` : "")),
    el("span", { class: "v" }, `${fmt1.format(r.error_medio)} pts`))));
}
function pintarPorra(proy) {
  const bot = D.config.telegram_bot;
  $("#porra-instrucciones").replaceChildren(bot ? el("p", {}, "Manda tu pronóstico al bot ", el("a", { href: `https://t.me/${bot}`, target: "_blank", rel: "noopener" }, `@${bot}`), ", por ejemplo /porra PP 140 PSOE 110 Vox 50 Sumar 20. Gana quien menos se desvíe en total.") : el("p", {}, "La porra se activa al configurar el bot de Telegram."));
  const ref = D.resultados?.escanos || proy.total;
  const parts = Object.values(D.porra?.participantes || {}).map((p) => ({ ...p, distancia: [...new Set([...Object.keys(p.escanos), ...Object.keys(ref)])].reduce((s, k) => s + Math.abs((p.escanos[k] || 0) - (ref[k] || 0)), 0) })).sort((a, b) => a.distancia - b.distancia);
  $("#porra").replaceChildren(...(parts.length ? parts.map((p, i) => el("div", { class: "fila-f" }, el("span", { class: "pos" }, i + 1),
    el("span", {}, p.nombre, el("span", { class: "m" }, ordenar(p.escanos).map((k) => `${nombre(k)} ${p.escanos[k]}`).join(", "))),
    el("span", { class: "v" }, `${p.distancia} esc.`))) : [el("p", { class: "vacio" }, "Todavía no ha jugado nadie.")]));
}
function pintarAgenda() {
  const ag = D.agenda || [], h = hoy(), sig = ag.find((x) => fechaD(x.fin || x.fecha) >= h);
  $("#agenda").replaceChildren(...ag.map((x) => {
    const fin = fechaD(x.fin || x.fecha);
    return el("li", { class: fin < h ? "pasado" : x === sig ? "siguiente" : null }, el("span", { class: "dia" }, x.fin ? `${fFecha.format(fechaD(x.fecha))} al ${fFecha.format(fin)}` : fFechaLarga.format(fechaD(x.fecha))), el("span", {}, x.titulo, x.detalle ? el("span", { class: "det" }, x.detalle) : null));
  }));
  const veda = ag.find((x) => /encuestas/i.test(x.titulo));
  if (veda && h >= fechaD(veda.fecha) && h <= fechaD(veda.fin || veda.fecha)) $("#encuestas").prepend(el("p", { class: "aviso" }, "Estamos en los cinco días previos a la votación, en los que la ley prohíbe publicar encuestas en España."));
}
function pintarPartidos(m, proy) {
  const o = ordenar(m.media).filter((k) => m.media[k] >= 0.5);
  const lista = (arr) => arr?.length ? el("ul", {}, ...arr.map((n) => el("li", {}, el("a", { href: n.enlace, target: "_blank", rel: "noopener" }, n.titulo), el("span", { class: "m" }, `${n.fuente} ${hace(n.fecha)}`)))) : el("p", { class: "vacio" }, "Sin titulares recientes.");
  $("#fichas-partidos").replaceChildren(...o.map((k) => el("article", { class: "ficha-p", style: { "--c": color(k) } }, el("h3", {}, `${nombre(k)}, ${fmt1.format(m.media[k])}%, ${proy.total[k] || 0} escaños`),
    lista(D.noticias?.partidos?.[k]?.slice(0, 3)), D.noticias?.verificaciones?.[k]?.length ? [el("h4", {}, "Verificado por Newtral y Maldita"), lista(D.noticias.verificaciones[k].slice(0, 2))] : null)));
}
function pintarAtencion() {
  const a = D.atencion?.lideres;
  if (!a || !Object.keys(a).length) return;
  const ks = Object.keys(a), dias = a[ks[0]].serie.map((x) => x.dia);
  graficoAtencion?.destroy();
  graficoAtencion = new Chart($("#grafico-atencion"), { type: "line", data: { labels: dias.map((d) => fFecha.format(fechaD(d))), datasets: ks.map((k) => ({ label: a[k].articulo, data: a[k].serie.map((x) => x.visitas), borderColor: color(k), backgroundColor: color(k), borderWidth: 2, pointRadius: 0, tension: .25 })) }, options: opciones(" visitas") });
}
function pintarProgramas() {
  const t = D.programas?.temas;
  if (!t?.length) return;
  $("#programas").hidden = false;
  const ps = [...new Set(t.flatMap((x) => Object.keys(x.propuestas)))];
  $("#tabla-programas").replaceChildren(el("thead", {}, el("tr", {}, el("th", {}, "Tema"), ...ps.map((k) => el("th", {}, nombre(k))))), el("tbody", {}, ...t.map((x) => el("tr", {}, el("th", {}, x.tema), ...ps.map((k) => el("td", {}, x.propuestas[k] || "–"))))));
}

/* ---------- Arranque ---------- */
function pintarTodo() {
  const m = calcMedia(), m7 = calcMedia(new Date(+hoy() - 7 * DIA));
  const sinDatos = !Object.keys(m.media).length;
  if (sinDatos) m.media = Modelo.mediaDesdeBase(D.base);
  const proy = Modelo.proyectar(m.media, D.base);
  pintarHoy(m, m7, proy);
  if (sinDatos) $("#titular").textContent += " Sin encuestas cargadas, se muestra el 23J con los escaños de 2026.";
  pintarEncuestas(m, m7, proy);
  pintarMapa(proy);
  pintarSimulador(m, proy);
  pintarFiabilidad();
  pintarPorra(proy);
  pintarPartidos(m, proy);
}
(async function iniciar() {
  const nombres = ["config", "base2023", "encuestas", "fiabilidad", "noticias", "atencion", "porra", "agenda", "programas", "resultados"];
  const datos = await Promise.all(nombres.map(cargar));
  nombres.forEach((n, i) => { D[n === "base2023" ? "base" : n] = datos[i]; });
  if (!D.config || !D.base) { $("#titular").textContent = "No se han podido cargar los datos base."; return; }
  try { mapa.sel = localStorage.getItem("mi-provincia") || null; } catch {}
  $("#incluir-cis").addEventListener("change", pintarTodo);
  pintarTodo();
  pintarAgenda();
  pintarProgramas();
  D.listo = true;
  const act = [D.encuestas?.actualizado, D.noticias?.actualizado].filter(Boolean).sort().pop();
  if (act) $("#actualizado").textContent = `Datos actualizados ${hace(act)}.`;
  activarPestana(location.hash.slice(1));
})();
