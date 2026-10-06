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

/* ---------- Media de encuestas (módulo compartido con el simulador) ---------- */
function calcMedia(fecha = hoy(), ventana = 30) {
  return Media.calcMedia(D.encuestas?.encuestas || [], fecha, { ventana, incluirCIS: $("#incluir-cis")?.checked, ranking: D.fiabilidad?.ranking });
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
const pct = (p) => `${Math.round(p * 100)} %`;
function escenario(id) { return D.prob?.escenarios?.[id]; }
function pintarHoy(m, m7, proy) {
  const dias = Math.round((fechaD(D.config.eleccion.fecha) - hoy()) / DIA);
  $("#cuenta").innerHTML = dias > 1 ? `faltan <strong>${dias} días</strong>` : dias === 1 ? "<strong>mañana</strong> se vota" : dias === 0 ? "<strong>hoy</strong> se vota" : "elecciones celebradas";
  const P = D.prob, der = escenario(D.config.principales.derecha), izq = escenario(D.config.principales.izquierda);
  const esc = D.resultados?.escanos || proy.total;
  hemiciclo($("#hemiciclo"), esc, 10);
  leyenda($("#leyenda"), esc);
  if (D.resultados?.escanos) { $("#titular").textContent = `Resultados con el ${fmt1.format(D.resultados.escrutado || 0)}% escrutado`; }
  else if (P && der && izq) {
    const fav = der.p >= izq.p ? der : izq, otro = fav === der ? izq : der;
    $("#titular").textContent = fav.p >= 0.5 ? `Hoy ${fav.nombre} tiene${fav.partidos.length > 1 ? "n" : ""} un ${pct(fav.p)} de probabilidades de llegar a 176.`
      : `Hoy nadie tiene la mayoría asegurada. ${fav.nombre}, ${pct(fav.p)}. ${otro.nombre}, ${pct(otro.p)}. Bloqueo, ${pct(P.bloqueo)}.`;
    const segs = [[der, color("PP")], [{ nombre: "Bloqueo, nadie suma", p: P.bloqueo }, "#8A93A3"], [izq, color("PSOE")]];
    $("#prob-barra").replaceChildren(...segs.map(([e, c]) => el("div", { style: { flex: `${Math.max(e.p, 0.02)} 1 0`, background: c }, title: e.nombre }, e.p >= 0.12 ? pct(e.p) : "")));
    $("#prob-leyenda").replaceChildren(...segs.map(([e, c]) => el("div", {}, el("i", { style: { background: c } }), el("span", {}, e.nombre), el("b", {}, pct(e.p)))));
    const primero = Object.entries(P.partidos).sort((a, b) => b[1].p_primero - a[1].p_primero)[0];
    $("#prob-nota").textContent = `${P.simulaciones.toLocaleString("es-ES")} elecciones simuladas con la media de encuestas y el error que tuvieron en 2019 y 2023. ${nombre(primero[0])} es primera fuerza en el ${pct(primero[1].p_primero)} de ellas.`;
    $("#compartir").hidden = false;
  } else {
    $("#titular").textContent = Object.keys(esc).length ? `Si se votara hoy, ${nombre(ordenar(esc)[0])} ganaría con ${esc[ordenar(esc)[0]]} escaños. Las probabilidades se calculan en la próxima actualización.` : "Aún no hay encuestas cargadas.";
  }
  // Abanicos
  if (P) {
    const o = Object.keys(P.partidos).sort((a, b) => P.partidos[b].p50 - P.partidos[a].p50).filter((k) => P.partidos[k].p90 > 0).slice(0, 7);
    const MAX = 240;
    $("#abanicos").replaceChildren(...o.map((k) => { const x = P.partidos[k];
      return el("div", { class: "abanico" }, el("span", { class: "nom" }, nombre(k)), el("div", { class: "pista" },
        el("div", { class: "m176" }), el("div", { class: "rango", style: { left: `${x.p10 / MAX * 100}%`, width: `${(x.p90 - x.p10) / MAX * 100}%`, background: color(k) } }),
        el("div", { class: "mediana", style: { left: `calc(${x.p50 / MAX * 100}% - 2px)`, background: color(k) } }),
        el("span", { class: "num", style: { left: `calc(${x.p90 / MAX * 100}% + 8px)` } }, `${x.p10} a ${x.p90}`))); }),
      el("div", { class: "eje" }, ...[0, 50, 100, 150, 176, 200].map((v) => el("span", { style: { left: `${v / MAX * 100}%`, color: v === 176 ? "var(--bronce)" : null, fontWeight: v === 176 ? 700 : null } }, v))));
  }
  // Claves
  const claves = [];
  if (P && der && izq) {
    for (const e of [der, izq]) if (e.margen != null) claves.push(el("div", { class: "clave" }, el("b", {}, e.margen > 0 ? `A ${e.nombre} le${e.partidos.length > 1 ? "s" : ""} faltan ${fmt1.format(e.margen)} puntos` : `A ${e.nombre} le${e.partidos.length > 1 ? "s" : ""} sobran ${fmt1.format(-e.margen)} puntos`), el("span", { class: "m" }, "de voto para que la mayoría absoluta sea más probable que improbable.")));
    const fav = der.p >= izq.p ? der : izq;
    if (fav.bisagra?.length) claves.push(el("div", { class: "clave" }, el("b", {}, `La provincia bisagra es ${fav.bisagra[0].nombre}`), el("span", { class: "m" }, `Es donde cae el escaño 176 de ${fav.nombre} en el ${pct(fav.bisagra[0].p)} de las simulaciones en las que llegan. Le siguen ${fav.bisagra.slice(1, 4).map((b) => b.nombre).join(", ")}.`)));
    const aire = [...P.provincias].sort((a, b) => b.en_el_aire - a.en_el_aire).slice(0, 4);
    claves.push(el("div", { class: "clave" }, el("b", {}, `Provincias con el último escaño más en el aire: ${aire.map((p) => p.nombre).join(", ")}`), el("span", { class: "m" }, `En ${aire[0].nombre} el último escaño cambia de partido en el ${pct(aire[0].en_el_aire)} de las simulaciones.`)));
  }
  $("#claves").replaceChildren(...claves);
  pintarHistorial();
  // Podio
  const top = ordenar(m.media).slice(0, 3);
  $("#podio").replaceChildren(...top.map((k) => {
    const d = m7.media[k] != null ? m.media[k] - m7.media[k] : 0;
    return el("div", { class: "tile", style: { "--c": color(k) } }, el("div", { class: "n" }, nombre(k)), el("div", { class: "g" }, `${fmt1.format(m.media[k])}%`),
      el("div", { class: "s" }, P ? `${P.partidos[k]?.p50 ?? proy.total[k] ?? 0} escaños` : `${proy.total[k] || 0} escaños`), Math.abs(d) >= 0.1 ? el("div", { class: `d ${d > 0 ? "sube" : "baja"}` }, `${signo(d)} esta semana`) : el("div", { class: "d s" }, "sin cambios"));
  }));
  // Resumen
  const items = [];
  const u = D.analisis?.ultimas?.[0];
  if (u) items.push(`Última encuesta, ${u.empresa}${u.encargo ? ` para ${u.encargo}` : ""}, ${fFecha.format(fechaD(u.fin))}. ${u.texto}`);
  const cambios = Object.keys(m.media).filter((k) => m7.media[k] != null).map((k) => ({ k, d: m.media[k] - m7.media[k] })).filter((x) => Math.abs(x.d) >= 0.3).sort((a, b) => Math.abs(b.d) - Math.abs(a.d)).slice(0, 3);
  if (cambios.length) items.push("Esta semana " + cambios.map((x) => `${nombre(x.k)} ${x.d > 0 ? "sube" : "baja"} ${fmt1.format(Math.abs(x.d))}`).join(", ") + " puntos en la media.");
  else if (Object.keys(m7.media).length) items.push("La media apenas se mueve esta semana, ningún partido cambia más de 0,3 puntos.");
  const h = D.historial;
  if (h?.length > 1 && der) { const d0 = h[h.length - 1].escenarios[der.id], d7 = (h.find((x) => (fechaD(h[h.length - 1].fecha) - fechaD(x.fecha)) / DIA <= 7) || h[0]).escenarios[der.id]; const d = (d0 - d7) * 100; if (Math.abs(d) >= 2) items.push(`La probabilidad de ${der.nombre} ${d > 0 ? "sube" : "baja"} ${Math.abs(Math.round(d))} puntos esta semana.`); }
  const sig = (D.agenda || []).find((x) => fechaD(x.fin || x.fecha) >= hoy());
  if (sig) items.push(`Próxima fecha, ${fFechaLarga.format(fechaD(sig.fecha))}, ${sig.titulo}.`);
  $("#resumen").replaceChildren(...(items.length ? items.map((t) => el("li", {}, t)) : [el("li", { class: "vacio" }, "Aún no hay datos. La primera actualización tarda unos minutos.")]));
  $("#titulares").replaceChildren(...(D.noticias?.generales || []).slice(0, 6).map((n) => el("a", { class: "titular-n", href: n.enlace, target: "_blank", rel: "noopener" }, n.titulo, el("span", { class: "m" }, `${n.fuente} ${hace(n.fecha)}`))));
  const pol = (n) => el("a", { class: "polemica", href: n.enlace, target: "_blank", rel: "noopener", style: { "--c": color(n.partido) } }, n.titulo, el("span", { class: "m" }, `${nombre(n.partido)}, ${n.fuente} ${hace(n.fecha)}`));
  const pols = D.noticias?.polemicas || [];
  $("#polemicas").replaceChildren(...(pols.length ? pols.slice(0, 6).map(pol) : [el("p", { class: "vacio" }, "Se recogen en la próxima actualización.")]));
  $("#polemicas-todas").replaceChildren(...pols.map(pol));
}
let graficoHistorial;
function pintarHistorial() {
  const h = D.historial, der = escenario(D.config.principales.derecha), izq = escenario(D.config.principales.izquierda);
  if (!h?.length || !der || !izq) { $("#grafico-historial").parentElement.style.display = "none"; return; }
  graficoHistorial?.destroy();
  graficoHistorial = new Chart($("#grafico-historial"), { type: "line",
    data: { labels: h.map((x) => fFecha.format(fechaD(x.fecha))), datasets: [
      { label: der.nombre, data: h.map((x) => Math.round(x.escenarios[der.id] * 100)), borderColor: color("PP"), backgroundColor: color("PP"), borderWidth: 2.5, pointRadius: h.length < 20 ? 3 : 0, tension: .3 },
      { label: izq.nombre, data: h.map((x) => Math.round(x.escenarios[izq.id] * 100)), borderColor: color("PSOE"), backgroundColor: color("PSOE"), borderWidth: 2.5, pointRadius: h.length < 20 ? 3 : 0, tension: .3 },
      { label: "Bloqueo", data: h.map((x) => Math.round(x.bloqueo * 100)), borderColor: "#8A93A3", backgroundColor: "#8A93A3", borderWidth: 2, pointRadius: h.length < 20 ? 3 : 0, tension: .3 }] },
    options: { ...opciones(" %"), scales: { ...opciones(" %").scales, y: { ...opciones(" %").scales.y, min: 0, max: 100 } } } });
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
  $("#tarjetas-encuestas").replaceChildren(...(D.encuestas?.encuestas || []).slice(0, 12).map((e) => {
    const nueva = e.primera_vez && Date.now() - new Date(e.primera_vez) < 2 * DIA;
    const an = D.analisis?.ultimas?.find((x) => x.id === e.id);
    const nota = D.analisis?.notas?.find((x) => x.clave === e.clave);
    return el("div", { class: "tarjeta", style: usadas.has(e.id) ? null : { opacity: .75 } },
      el("div", { class: "cab" }, el("b", {}, e.empresa_base, nota && nota.letra !== "–" ? el("span", { class: "nota", title: nota.texto }, nota.letra) : null, e.encargo ? ` para ${e.encargo}` : "", nueva ? el("span", { class: "etiqueta-nueva" }, "nueva") : null,
        an ? el("span", { class: `veredicto ${an.veredicto}` }, an.veredicto === "ruido" ? "ruido" : an.veredicto === "leve" ? "algo se mueve" : "noticia") : null),
        el("span", {}, `${fFecha.format(fechaD(e.fin))}${e.muestra ? `, n=${fmt0.format(e.muestra)}` : ""}`)),
      el("div", { class: "chips" }, ...ordenar(e.pct).slice(0, 6).map((k) => el("span", { class: "chip", style: { background: color(k) } }, `${nombre(k)} ${fmt1.format(e.pct[k])}`))),
      an ? el("div", { class: "ver" }, an.texto) : null);
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

function colorProvincia(p) {
  const pp = D.prob?.provincias?.find((x) => x.nombre === p.nombre);
  const gan = ordenar(p.escanos)[0];
  if (mapa.vista === "filo") {
    const a = pp ? pp.en_el_aire : (p.aspirante ? Math.max(0, 1 - p.aspirante.falta / 4) : 0);
    return { fill: "var(--mal)", op: Math.max(.12, Math.min(1, a * 1.3)), txt: a > .35 ? "#fff" : "var(--tinta)", etiqueta: pp ? Math.round(pp.en_el_aire * 100) + "%" : "–" };
  }
  const empate = gan && ordenar(p.escanos).length > 1 && p.escanos[gan] === p.escanos[ordenar(p.escanos)[1]];
  return { fill: gan ? color(gan) : "var(--linea)", op: empate ? .6 : 1, txt: "#fff", etiqueta: String(p.n) };
}
function pintarMapa(proy) {
  mapa.proy = proy;
  const G = D.mapa;
  let svg;
  if (G) {
    svg = `<svg viewBox="${G.viewBox}" role="img" aria-label="Mapa de España por provincias">`;
    const r = G.recuadro_canarias; svg += `<rect class="recuadro" x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="8"/>`;
    for (const p of proy.provincias) {
      const g = G.provincias[p.nombre]; if (!g) continue;
      const c = colorProvincia(p);
      svg += `<g class="prov${mapa.sel === p.nombre ? " sel" : ""}" data-p="${p.nombre}">`;
      svg += g.circulo ? `<circle class="prov" cx="${g.cx}" cy="${g.cy}" r="14" fill="${c.fill}" fill-opacity="${c.op}"/>` : `<path d="${g.d}" fill="${c.fill}" fill-opacity="${c.op}"/>`;
      if (!g.circulo || true) svg += `<text x="${g.cx}" y="${g.cy + 7}" text-anchor="middle" font-size="${g.circulo ? 14 : 22}" font-weight="700" fill="${c.txt}">${c.etiqueta}</text>`;
      svg += "</g>";
    }
    svg += "</svg>";
  } else {
    const T = 44, Gp = 4;
    svg = `<svg viewBox="0 0 ${11 * (T + Gp)} ${9 * (T + Gp)}" role="img" aria-label="Mapa de provincias">`;
    for (const p of proy.provincias) {
      const [x, y] = TESELAS[p.nombre] || [0, 0], c = colorProvincia(p);
      svg += `<g class="prov tesela${mapa.sel === p.nombre ? " sel" : ""}" data-p="${p.nombre}"><rect x="${x * (T + Gp)}" y="${y * (T + Gp)}" width="${T}" height="${T}" fill="${c.fill}" fill-opacity="${c.op}"/><text x="${x * (T + Gp) + T / 2}" y="${y * (T + Gp) + 18}" text-anchor="middle" font-size="11" font-weight="700" fill="${c.txt}">${ABREV[p.nombre]}</text><text x="${x * (T + Gp) + T / 2}" y="${y * (T + Gp) + 34}" text-anchor="middle" font-size="12" fill="${c.txt}">${c.etiqueta}</text></g>`;
    }
    svg += "</svg>";
  }
  $("#mapa-svg").innerHTML = svg;
  $("#mapa-svg").querySelectorAll("g.prov").forEach((g) => g.addEventListener("click", () => { mapa.sel = g.dataset.p; try { localStorage.setItem("mi-provincia", mapa.sel); } catch {} pintarMapa(mapa.proy); }));
  $("#mapa-pista").textContent = mapa.vista === "ganador" ? "Color del partido con más escaños en cada provincia y escaños que reparte. Más claro, empate entre los dos primeros. Toca una para ver el detalle." : "Probabilidad de que el último escaño de cada provincia cambie de partido en las simulaciones. Cuanto más rojo, más en el aire.";
  const p = proy.provincias.find((x) => x.nombre === mapa.sel);
  $("#ficha-provincia").replaceChildren(...(p ? [el("div", { class: "ficha" }, el("h3", {}, `${p.nombre}, ${p.n} escaños`),
    el("div", { class: "chips" }, ...ordenar(p.escanos).map((k) => el("span", { class: "chip", style: { background: color(k) } }, `${nombre(k)} ${p.escanos[k]}`))),
    p.aspirante ? el("p", {}, `El último escaño se lo lleva ${nombre(p.ultimo.p)}. ${nombre(p.aspirante.p)} se lo quitaría con ${fmt1.format(Math.max(p.aspirante.falta, 0))} puntos más.`) : null,
    (() => { const pp = D.prob?.provincias?.find((x) => x.nombre === p.nombre); return pp ? el("p", {}, `En las simulaciones el último escaño es ${ordenar(pp.ultimo).slice(0, 3).map((k) => `de ${nombre(k)} el ${pct(pp.ultimo[k])}`).join(", ")}.`) : null; })(),
    tablaDhondt(p),
    el("p", { class: "fuente" }, "Así funciona D'Hondt: el voto de cada partido se divide entre 1, 2, 3… y los escaños van a los cocientes más altos. Marcados los que se llevan escaño. Solo entran los partidos con al menos el 3 % del voto."))] : []));
  const aj = D.prob ? [...D.prob.provincias].sort((a, b) => b.en_el_aire - a.en_el_aire).slice(0, 5).map((pp) => ({ x: proy.provincias.find((q) => q.nombre === pp.nombre), pp }))
    : [...proy.provincias].filter((x) => x.aspirante).sort((a, b) => a.aspirante.falta - b.aspirante.falta).slice(0, 5).map((x) => ({ x }));
  $("#ajustadas").replaceChildren(...aj.map(({ x, pp }) => el("button", { class: "ajustada", type: "button", onclick: () => { mapa.sel = x.nombre; pintarMapa(mapa.proy); $("#ficha-provincia").scrollIntoView({ behavior: "smooth", block: "center" }); } },
    el("b", {}, x.nombre), el("span", { class: "pts" }, pp ? `${pct(pp.en_el_aire)} en el aire` : `${fmt1.format(Math.max(x.aspirante.falta, 0))} pts`),
    el("span", { class: "m" }, x.aspirante ? `${nombre(x.ultimo.p)} tiene el último escaño, lo persigue ${nombre(x.aspirante.p)}` : ""))));
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

/* ---------- Simulador ---------- */
const sim = { valores: {}, seleccion: new Set(), swing: 0 };
const DERECHA = ["PP", "Vox", "SALF", "UPN"], IZQUIERDA = ["PSOE", "Sumar", "Podemos", "AA"];
function pintarSimulador(m, proyBase) {
  sim.base = { ...m.media }; sim.valores = { ...m.media }; sim.proyBase = proyBase; sim.swing = 0;
  $("#swing").value = 0; $("#swing-out").textContent = "Como la media de encuestas";
  pintarControles();
  recalcularSim();
}
function pintarControles() {
  const o = ordenar(sim.base).filter((k) => sim.base[k] >= 0.3);
  $("#sim-controles").replaceChildren(...o.map((k) => {
    const out = el("output", {}, fmt1.format(sim.valores[k]));
    return el("label", { class: "deslizador" }, el("span", {}, el("i", { class: "punto", style: { background: color(k) } }), " ", nombre(k)),
      el("input", { type: "range", min: 0, max: 45, step: 0.1, value: sim.valores[k].toFixed(1), "aria-label": `Voto de ${nombre(k)}`, style: { accentColor: color(k) },
        oninput: (ev) => { sim.valores[k] = +ev.target.value; out.textContent = fmt1.format(sim.valores[k]); programarSim(); }, onchange: () => probabilidadSim() }), out);
  }), el("button", { class: "boton", type: "button", onclick: () => pintarSimulador({ media: sim.base }, sim.proyBase) }, "Volver a la media de encuestas"));
}
$("#swing").addEventListener("input", (ev) => {
  const s = +ev.target.value; sim.swing = s;
  const der = DERECHA.filter((k) => sim.base[k] > 0), izq = IZQUIERDA.filter((k) => sim.base[k] > 0);
  const sd = der.reduce((a, k) => a + sim.base[k], 0), si = izq.reduce((a, k) => a + sim.base[k], 0);
  sim.valores = { ...sim.base };
  for (const k of der) sim.valores[k] = Math.max(0, sim.base[k] + s * sim.base[k] / sd);
  for (const k of izq) sim.valores[k] = Math.max(0, sim.base[k] - s * sim.base[k] / si);
  $("#swing-out").textContent = s === 0 ? "Como la media de encuestas" : `${fmt1.format(Math.abs(s))} puntos ${s > 0 ? "de la izquierda a la derecha" : "de la derecha a la izquierda"}`;
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
  if (!sim.probPintada) probabilidadSim();
}
/* Monte Carlo ligero en el navegador (600 simulaciones) para que el swingómetro dé probabilidades */
function probabilidadSim() {
  const P = D.prob; if (!P?.sigmas) { $("#sim-prob").replaceChildren(); return; }
  sim.probPintada = true;
  const der = escenario(D.config.principales.derecha), izq = escenario(D.config.principales.izquierda), N = 600;
  const BL = { d: ["PP", "Vox", "SALF", "UPN"], i: ["PSOE", "Sumar", "Podemos", "AA"] };
  const bloque = (k) => BL.d.includes(k) ? "d" : BL.i.includes(k) ? "i" : "t";
  const rn = () => { let u = 0, v = 0; while (u === 0) u = Math.random(); v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  let cd = 0, ci = 0, cb = 0;
  const claves = Object.keys(sim.valores).filter((k) => sim.valores[k] > 0);
  for (let i = 0; i < N; i++) {
    const z = { d: rn(), i: rn(), t: rn() }, zt = rn(), m = {};
    for (const k of claves) { const b = bloque(k); m[k] = Math.max(0, sim.valores[k] + (P.sigmas[k] || 0.06 * sim.valores[k]) * (0.55 * z[b] + 0.835 * rn() + 0.35 * (b === "d" ? 1 : b === "i" ? -1 : 0) * zt)); }
    const t = Modelo.proyectar(m, D.base).total;
    const sd = der.partidos.reduce((a, k) => a + (t[k] || 0), 0) >= 176, si = izq.partidos.reduce((a, k) => a + (t[k] || 0), 0) >= 176;
    if (sd) cd++; if (si) ci++; if (!sd && !si) cb++;
  }
  $("#sim-prob").replaceChildren(
    el("div", {}, el("b", { style: { color: color("PP") } }, pct(cd / N)), el("span", {}, der.nombre)),
    el("div", {}, el("b", {}, pct(cb / N)), el("span", {}, "Bloqueo")),
    el("div", {}, el("b", { style: { color: color("PSOE") } }, pct(ci / N)), el("span", {}, izq.nombre)));
}

/* ---------- Más ---------- */
function pintarFiabilidad() {
  const an = D.analisis;
  if (!an?.notas?.length) { $("#fiabilidad").replaceChildren(el("p", { class: "vacio" }, "Se calcula en la primera actualización.")); }
  else $("#fiabilidad").replaceChildren(...an.notas.map((r) => el("div", { class: "fila-f" }, el("span", { class: "nota" }, r.letra),
    el("span", {}, `${r.empresa}, ${r.encuestas} encuestas`, el("span", { class: "m" }, r.texto),
      r.sesgo ? el("div", { class: "sesgos" }, ...Object.entries(r.sesgo).filter(([, v]) => Math.abs(v) >= 0.3).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 4).map(([k, v]) => el("span", {}, `${nombre(k)} ${signo(v)}`))) : null))));
  const bt = D.prob?.backtest;
  if (!bt) { $("#backtest").replaceChildren(el("p", { class: "vacio" }, "Se calcula en la primera actualización.")); return; }
  const real = bt.resultado_escanos, pv = (real.PP || 0) + (real.Vox || 0), iz = ["PSOE", "Sumar", "ERC", "Junts", "Bildu", "PNV", "BNG", "CCa"].reduce((a, k) => a + (real[k] || 0), 0);
  $("#backtest").replaceChildren(...bt.fechas.map((f) => el("div", { class: "fila-bt" },
    el("span", {}, `${fFecha.format(fechaD(f.fecha))} 2023, a ${f.dias} días`, el("span", { class: "m" }, `PP ${f.partidos.PP?.p10}-${f.partidos.PP?.p90}, PSOE ${f.partidos.PSOE?.p10}-${f.partidos.PSOE?.p90}, Vox ${f.partidos.Vox?.p10}-${f.partidos.Vox?.p90}`)),
    el("span", {}, `PP y Vox ${pct(f.escenarios.pp_vox.p)}`), el("span", {}, `Izquierda y socios ${pct(f.escenarios.izq_socios.p)}`))),
    el("div", { class: "fila-bt" }, el("span", { class: "real" }, "Lo que pasó el 23J", el("span", { class: "m" }, `PP ${real.PP}, PSOE ${real.PSOE}, Vox ${real.Vox}, Sumar ${real.Sumar}`)), el("span", { class: "real" }, `PP y Vox ${pv}`), el("span", { class: "real" }, `Izquierda y socios ${iz}`)));
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
  const nombres = ["config", "base2023", "encuestas", "fiabilidad", "noticias", "atencion", "porra", "agenda", "programas", "resultados", "probabilidades", "analisis", "probabilidades_historial", "mapa"];
  const datos = await Promise.all(nombres.map(cargar));
  nombres.forEach((n, i) => { D[n === "base2023" ? "base" : n === "probabilidades" ? "prob" : n === "probabilidades_historial" ? "historial" : n] = datos[i]; });
  $("#compartir").addEventListener("click", compartir);
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
  let y = lineas($("#titular").textContent, 70, 330, 940) + 70;
  const segs = [[der.p, color("PP"), der.nombre], [P.bloqueo, "#8A93A3", "Bloqueo"], [izq.p, color("PSOE"), izq.nombre]];
  let x = 70; for (const [p, col] of segs) { const w = Math.max(p, .02) * 940; g.fillStyle = col; g.fillRect(x, y, w, 90); if (p >= .12) { g.fillStyle = "#fff"; g.font = "800 44px Archivo, Arial, sans-serif"; g.fillText(pct(p), x + 24, y + 60); } x += w; }
  y += 130; g.font = "500 34px Archivo, Arial, sans-serif";
  for (const [p, col, n] of segs) { g.fillStyle = col; g.fillRect(70, y - 26, 28, 28); g.fillStyle = "#fff"; g.fillText(`${n}, ${pct(p)}`, 120, y); y += 50; }
  y += 40; g.fillStyle = "#B8C0CC"; g.font = "600 32px Archivo, Arial, sans-serif"; g.fillText("Escaños probables (del 10 % al 90 %)", 70, y); y += 30;
  const o = Object.keys(P.partidos).sort((a, b) => P.partidos[b].p50 - P.partidos[a].p50).slice(0, 6);
  for (const k of o) { const v = P.partidos[k]; y += 62; g.fillStyle = "#fff"; g.font = "650 32px Archivo, Arial, sans-serif"; g.fillText(nombre(k), 70, y);
    const x0 = 300, esc = 700 / 240; g.fillStyle = "#2B3543"; g.fillRect(x0, y - 24, 700, 22); g.fillStyle = color(k); g.globalAlpha = .55; g.fillRect(x0 + v.p10 * esc, y - 24, (v.p90 - v.p10) * esc, 22); g.globalAlpha = 1; g.fillRect(x0 + v.p50 * esc - 3, y - 28, 6, 30);
    g.fillStyle = "#D3A54E"; g.fillRect(x0 + 176 * esc - 1, y - 30, 2, 34); g.fillStyle = "#B8C0CC"; g.font = "500 26px Archivo, Arial, sans-serif"; g.fillText(`${v.p10}-${v.p90}`, x0 + 715, y); }
  g.fillStyle = "#D3A54E"; g.font = "600 28px Archivo, Arial, sans-serif"; g.fillText("176 = mayoría absoluta", 300 + 176 * 700 / 240 - 120, y + 50);
  g.fillStyle = "#B8C0CC"; g.font = "500 28px Archivo, Arial, sans-serif"; g.fillText(location.href.replace(/[#?].*$/, ""), 70, 1290);
  const blob = await new Promise((r) => c.toBlob(r, "image/png"));
  const file = new File([blob], "29n.png", { type: "image/png" });
  if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], title: "29N" }); return; } catch {} }
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "29n.png"; a.click();
}
