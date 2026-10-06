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
function hace(iso) {
  if (!iso) return "";
  const m = Math.round((Date.now() - new Date(iso)) / 60000);
  if (m < 60) return `hace ${Math.max(m, 1)} min`;
  if (m < 1440) return `hace ${Math.round(m / 60)} h`;
  return `hace ${Math.round(m / 1440)} d`;
}

async function cargar(nombreArchivo) {
  try {
    const r = await fetch(`data/${nombreArchivo}.json?v=${Date.now()}`);
    return r.ok ? await r.json() : null;
  } catch { return null; }
}

/* ---------- Media de encuestas ---------- */
function factorAcierto(clave) {
  const r = D.fiabilidad?.ranking?.find((x) => x.clave === clave);
  if (!r) return 1;
  return Math.min(1.4, Math.max(0.6, 1.6 / (0.6 + r.error_medio)));
}

function calcMedia(fecha = hoy(), ventana = 30) {
  const todas = D.encuestas?.encuestas || [];
  const incluirCIS = $("#incluir-cis")?.checked;
  const elegir = (v) => {
    const ultimas = {};
    for (const e of todas) {
      const edad = (fecha - fechaD(e.fin)) / DIA;
      if (edad < 0 || edad > v) continue;
      if (!incluirCIS && e.clave === "cis") continue;
      if (!ultimas[e.clave] || ultimas[e.clave].fin < e.fin) ultimas[e.clave] = e;
    }
    return Object.values(ultimas);
  };
  let usadas = elegir(ventana);
  if (usadas.length < 4) usadas = elegir(ventana * 2);
  const suma = {}, pesos = {};
  for (const e of usadas) {
    const edad = (fecha - fechaD(e.fin)) / DIA;
    const n = Math.min(e.muestra || 1000, 5000);
    e.peso = Math.exp(-edad / 14) * Math.sqrt(n / 1000) * factorAcierto(e.clave);
    for (const [p, v] of Object.entries(e.pct)) {
      suma[p] = (suma[p] || 0) + v * e.peso;
      pesos[p] = (pesos[p] || 0) + e.peso;
    }
  }
  const media = {};
  for (const p of Object.keys(suma)) media[p] = suma[p] / pesos[p];
  return { media, usadas };
}

function ordenarPartidos(obj) { return Object.keys(obj).sort((a, b) => obj[b] - obj[a]); }

/* ---------- Hemiciclo ---------- */
function hemiciclo(contenedor, escanos, { filas = 12, mayoria = 176 } = {}) {
  const orden = D.config.orden_hemiciclo;
  const claves = Object.keys(escanos).filter((k) => escanos[k] > 0)
    .sort((a, b) => (orden.indexOf(a) + 1 || 99) - (orden.indexOf(b) + 1 || 99));
  const total = claves.reduce((s, k) => s + escanos[k], 0);
  if (!total) { contenedor.replaceChildren(); return; }
  const r0 = 0.38, R = 1, radios = [];
  for (let i = 0; i < filas; i++) radios.push(r0 + (R - r0) * i / (filas - 1));
  const sumR = radios.reduce((a, b) => a + b, 0);
  let porFila = radios.map((r) => Math.round(total * r / sumR));
  porFila[filas - 1] += total - porFila.reduce((a, b) => a + b, 0);
  const asientos = [];
  radios.forEach((r, i) => {
    const n = porFila[i];
    for (let j = 0; j < n; j++) {
      const a = Math.PI * (1 - (n === 1 ? 0.5 : j / (n - 1)));
      asientos.push({ x: r * Math.cos(a), y: r * Math.sin(a), a });
    }
  });
  asientos.sort((p, q) => q.a - p.a || (Math.hypot(p.x, p.y) - Math.hypot(q.x, q.y)));
  const colores = [];
  for (const k of claves) for (let i = 0; i < escanos[k]; i++) colores.push(color(k));
  const rp = (R - r0) / (filas - 1) * 0.42;
  const W = 220, esc = 100;
  let svg = `<svg viewBox="-${W / 2} -${esc + 8} ${W} ${esc + 30}" role="img" aria-label="Hemiciclo con ${total} escaños">`;
  asientos.forEach((s, i) => {
    svg += `<circle cx="${(s.x * esc).toFixed(2)}" cy="${(-s.y * esc).toFixed(2)}" r="${(rp * esc).toFixed(2)}" fill="${colores[i] || "var(--linea)"}"/>`;
  });
  svg += `<line x1="0" y1="${-esc - 6}" x2="0" y2="${-r0 * esc + 6}" stroke="var(--bronce)" stroke-width="1" stroke-dasharray="2 2"/>`;
  svg += `<text x="0" y="18" text-anchor="middle" font-size="13" font-weight="700" fill="var(--tinta)" font-family="Archivo, sans-serif">${mayoria} para la mayoría</text></svg>`;
  contenedor.innerHTML = svg;
}

/* ---------- Portada ---------- */
function pintarPortada(proy) {
  const eleccion = fechaD(D.config.eleccion.fecha);
  const dias = Math.round((eleccion - hoy()) / DIA);
  $("#cuenta").innerHTML = dias > 1 ? `Faltan <strong>${dias} días</strong> para votar` : dias === 1 ? "<strong>Mañana</strong> se vota" : dias === 0 ? "<strong>Hoy</strong> se vota" : "Elecciones celebradas";
  const res = D.resultados;
  const escanos = res?.escanos || proy.total;
  hemiciclo($("#hemiciclo"), escanos);
  const orden = ordenarPartidos(escanos).filter((k) => escanos[k] > 0);
  $("#leyenda").replaceChildren(...orden.map((k) => el("span", {}, el("i", { class: "punto", style: { background: color(k) } }), `${nombre(k)} ${escanos[k]}`)));
  if (res?.escanos) {
    $("#titular-proy").textContent = `Resultados con el ${fmt1.format(res.escrutado || 0)}% escrutado`;
    $("#nota-proy").textContent = "";
    return;
  }
  const primero = orden[0], segundo = orden[1];
  $("#titular-proy").textContent = primero
    ? `Si se votara hoy, ${nombre(primero)} sería primera fuerza con ${escanos[primero]} escaños, ${escanos[primero] - (escanos[segundo] || 0)} más que ${nombre(segundo)}.`
    : "Aún no hay encuestas cargadas.";
  $("#nota-proy").textContent = "Proyección propia a partir de la media de encuestas. Mira el simulador para ver qué combinaciones llegan a 176.";
}

/* ---------- Hoy en 30 segundos ---------- */
function pintarResumen(m, m7, proy) {
  const items = [];
  const nuevas = (D.encuestas?.encuestas || []).filter((e) => e.primera_vez && Date.now() - new Date(e.primera_vez) < 2 * DIA);
  if (nuevas.length) {
    const top = (e) => ordenarPartidos(e.pct).slice(0, 3).map((k) => `${nombre(k)} ${fmt1.format(e.pct[k])}`).join(", ");
    items.push(`${nuevas.length === 1 ? "Nueva encuesta" : nuevas.length + " encuestas nuevas"} en las últimas 48 horas. ${nuevas.slice(0, 2).map((e) => `${e.empresa_base}: ${top(e)}`).join(". ")}.`);
  } else if (D.encuestas?.encuestas?.length) {
    const u = D.encuestas.encuestas[0];
    items.push(`La última encuesta es de ${u.empresa_base}, con trabajo de campo hasta el ${fFecha.format(fechaD(u.fin))}.`);
  }
  const cambios = Object.keys(m.media).filter((k) => m7.media[k] != null)
    .map((k) => ({ k, d: m.media[k] - m7.media[k] })).filter((x) => Math.abs(x.d) >= 0.3)
    .sort((a, b) => Math.abs(b.d) - Math.abs(a.d)).slice(0, 3);
  if (cambios.length) items.push("En la última semana " + cambios.map((x) => `${nombre(x.k)} ${x.d > 0 ? "sube" : "baja"} ${fmt1.format(Math.abs(x.d))} puntos`).join(", ") + ".");
  else if (Object.keys(m7.media).length) items.push("La media apenas se ha movido en la última semana, ningún partido cambia más de 0,3 puntos.");
  const filo = proy.provincias.filter((p) => p.aspirante && p.aspirante.falta < 0.5);
  if (filo.length) items.push(`${filo.length} provincias tienen el último escaño a menos de medio punto: ${filo.slice(0, 6).map((p) => p.nombre).join(", ")}.`);
  $("#resumen").replaceChildren(...(items.length ? items.map((t) => el("li", {}, t)) : [el("li", { class: "vacio" }, "Aún no hay datos. La primera actualización tarda unos minutos.")]));
  const tit = D.noticias?.generales || [];
  $("#titulares").replaceChildren(...tit.slice(0, 6).map((n) => el("a", { class: "titular", href: n.enlace, target: "_blank", rel: "noopener" },
    el("span", { class: "t" }, n.titulo), el("span", { class: "m" }, `${n.fuente} ${hace(n.fecha)}`))));
}

/* ---------- Encuestas ---------- */
let graficoTendencia;
function pintarEncuestas(m, m7, proy) {
  const orden = ordenarPartidos(m.media).filter((k) => m.media[k] >= 0.5);
  const max = Math.max(...orden.map((k) => m.media[k]), 1);
  $("#barras-media").replaceChildren(...orden.map((k) => {
    const d = m7.media[k] != null ? m.media[k] - m7.media[k] : null;
    return el("div", { class: "barra" },
      el("span", {}, nombre(k)),
      el("div", { class: "pista" }, el("div", { class: "relleno", style: { width: `${m.media[k] / max * 100}%`, background: color(k) } })),
      el("span", { class: "cifra" }, `${fmt1.format(m.media[k])}%`,
        d != null && Math.abs(d) >= 0.1 ? el("span", { class: `delta ${d > 0 ? "sube" : "baja"}` }, `${d > 0 ? "+" : "−"}${fmt1.format(Math.abs(d))}`) : null,
        el("span", { class: "delta" }, ` ${proy.total[k] || 0} esc.`)));
  }));
  // Tendencia semanal desde el 23J
  const desde = fechaD("2023-09-03"), puntos = [];
  for (let t = desde; t <= hoy(); t = new Date(+t + 7 * DIA)) puntos.push(t);
  if (puntos[puntos.length - 1] < hoy()) puntos.push(hoy());
  const series = {};
  for (const t of puntos) {
    const mm = calcMedia(t, 28).media;
    for (const k of orden) (series[k] ||= []).push(mm[k] != null ? +mm[k].toFixed(2) : null);
  }
  const datos = { labels: puntos.map((t) => fFecha.format(t) + (t.getUTCMonth() === 0 || t === puntos[0] ? ` ${t.getUTCFullYear()}` : "")),
    datasets: orden.filter((k) => m.media[k] >= 1).map((k) => ({ label: nombre(k), data: series[k], borderColor: color(k), backgroundColor: color(k), borderWidth: 2, pointRadius: 0, tension: 0.3, spanGaps: true })) };
  graficoTendencia?.destroy();
  graficoTendencia = new Chart($("#grafico-tendencia"), { type: "line", data: datos, options: opcionesGrafico("%") });
  // Tabla
  const cols = orden.slice(0, 9);
  const filas = (D.encuestas?.encuestas || []).slice(0, 25);
  const usadas = new Set(m.usadas.map((e) => e.id));
  $("#tabla-encuestas").replaceChildren(
    el("thead", {}, el("tr", {}, el("th", {}, "Empresa"), el("th", {}, "Campo"), el("th", { class: "n" }, "Muestra"), ...cols.map((k) => el("th", { class: "n" }, nombre(k))))),
    el("tbody", {}, ...filas.map((e) => el("tr", { class: usadas.has(e.id) ? "marcada" : null },
      el("td", {}, e.empresa_base, e.encargo ? el("span", { class: "m" }, ` ${e.encargo}`) : null,
        e.primera_vez && Date.now() - new Date(e.primera_vez) < 2 * DIA ? el("span", { class: "etiqueta-nueva" }, "nueva") : null),
      el("td", {}, fFecha.format(fechaD(e.fin))),
      el("td", { class: "n" }, e.muestra ? fmt0.format(e.muestra) : "?"),
      ...cols.map((k) => el("td", { class: "n" }, e.pct[k] != null ? fmt1.format(e.pct[k]) : "–"))))));
  if (D.encuestas) $("#fuente-encuestas").replaceChildren("Sombreadas las que entran en la media de hoy. Fuente ", el("a", { href: D.encuestas.fuente, target: "_blank", rel: "noopener" }, "Wikipedia"), `, actualizado ${hace(D.encuestas.actualizado)}.`);
}

function opcionesGrafico(sufijo) {
  const css = getComputedStyle(document.documentElement);
  const gris = css.getPropertyValue("--gris").trim(), linea = css.getPropertyValue("--linea").trim();
  return { responsive: true, maintainAspectRatio: false, interaction: { mode: "index", intersect: false },
    plugins: { legend: { position: "bottom", labels: { color: gris, boxWidth: 10, boxHeight: 10, usePointStyle: true } },
      tooltip: { callbacks: { label: (c) => `${c.dataset.label} ${c.parsed.y == null ? "–" : fmt1.format(c.parsed.y)}${sufijo}` } } },
    scales: { x: { ticks: { color: gris, maxRotation: 0, autoSkipPadding: 16 }, grid: { display: false } },
      y: { beginAtZero: true, ticks: { color: gris }, grid: { color: linea } } } };
}

/* ---------- Simulador y pactos ---------- */
const sim = { valores: {}, base: {}, seleccion: new Set() };
function pintarSimulador(m, proyBase) {
  sim.base = { ...m.media };
  sim.valores = { ...m.media };
  sim.proyBase = proyBase;
  const orden = ordenarPartidos(m.media).filter((k) => m.media[k] >= 0.3);
  const controles = orden.map((k) => {
    const out = el("output", {}, fmt1.format(sim.valores[k]));
    const input = el("input", { type: "range", min: 0, max: 45, step: 0.1, value: sim.valores[k].toFixed(1), "aria-label": `Voto de ${nombre(k)}`,
      style: { accentColor: color(k) },
      oninput: (ev) => { sim.valores[k] = +ev.target.value; out.textContent = fmt1.format(sim.valores[k]); programarSim(); } });
    return el("label", { class: "deslizador" }, el("span", {}, el("i", { class: "punto", style: { background: color(k) } }), " ", nombre(k)), input, out);
  });
  const reset = el("button", { class: "boton", type: "button", onclick: () => pintarSimulador(m, proyBase) }, "Volver a la media de encuestas");
  $("#sim-controles").replaceChildren(...controles, reset);
  recalcularSim();
}
let simPendiente = false;
function programarSim() { if (!simPendiente) { simPendiente = true; requestAnimationFrame(() => { simPendiente = false; recalcularSim(); }); } }
function recalcularSim() {
  const proy = Modelo.proyectar(sim.valores, D.base);
  sim.proy = proy;
  hemiciclo($("#sim-hemiciclo"), proy.total, { filas: 10 });
  const orden = ordenarPartidos(proy.total).filter((k) => proy.total[k] > 0);
  $("#sim-tabla").replaceChildren(el("div", { class: "leyenda" }, ...orden.map((k) => {
    const d = proy.total[k] - (sim.proyBase.total[k] || 0);
    return el("span", {}, el("i", { class: "punto", style: { background: color(k) } }), `${nombre(k)} ${proy.total[k]}`,
      d ? el("span", { class: `delta ${d > 0 ? "sube" : "baja"}` }, `${d > 0 ? "+" : "−"}${Math.abs(d)}`) : null);
  })));
  // Pactos
  for (const k of [...sim.seleccion]) if (!proy.total[k]) sim.seleccion.delete(k);
  const suma = [...sim.seleccion].reduce((s, k) => s + (proy.total[k] || 0), 0);
  const botones = orden.map((k) => el("button", { class: "pacto", type: "button", "aria-pressed": sim.seleccion.has(k) ? "true" : "false",
    onclick: () => { sim.seleccion.has(k) ? sim.seleccion.delete(k) : sim.seleccion.add(k); recalcularSim(); } },
    el("i", { class: "punto", style: { background: color(k) } }), `${nombre(k)} ${proy.total[k]}`));
  const texto = sim.seleccion.size ? (suma >= 176 ? `Suman ${suma}, mayoría absoluta.` : `Suman ${suma}, les faltan ${176 - suma} para la mayoría absoluta.`) : "Marca partidos para sumar sus escaños.";
  $("#pactos").replaceChildren(...botones, el("div", { class: "suma-pacto" }, texto,
    el("div", { class: "medidor" }, el("div", { class: "lleno", style: { width: `${suma / 350 * 100}%` } }), el("div", { class: "meta" }))));
  // Provincias que cambian respecto a la media
  const cambian = [];
  proy.provincias.forEach((p, i) => {
    const a = sim.proyBase.provincias[i].escanos, b = p.escanos;
    const ks = new Set([...Object.keys(a), ...Object.keys(b)]);
    const dif = [...ks].filter((k) => (a[k] || 0) !== (b[k] || 0)).map((k) => `${nombre(k)} ${(b[k] || 0) - (a[k] || 0) > 0 ? "+" : "−"}${Math.abs((b[k] || 0) - (a[k] || 0))}`);
    if (dif.length) cambian.push(`${p.nombre} (${dif.join(", ")})`);
  });
  $("#sim-cambios").textContent = cambian.length ? `Cambian ${cambian.length} provincias: ${cambian.join("; ")}.` : "Con estos datos el reparto es el mismo que con la media de encuestas.";
}

/* ---------- Provincias ---------- */
let proyActual;
function pintarProvincias(proyNueva) {
  if (proyNueva) proyActual = proyNueva;
  const proy = proyActual;
  const ccaas = [...new Set(proy.provincias.map((p) => p.ccaa))].sort((a, b) => a.localeCompare(b, "es"));
  const selC = $("#filtro-ccaa"), selP = $("#mi-provincia");
  if (!selC.options.length) {
    selC.append(el("option", { value: "" }, "Todas"), ...ccaas.map((c) => el("option", { value: c }, c)));
    selP.append(el("option", { value: "" }, "Elige"), ...proy.provincias.map((p) => p.nombre).sort((a, b) => a.localeCompare(b, "es")).map((n) => el("option", { value: n }, n)));
    try { selP.value = localStorage.getItem("mi-provincia") || ""; } catch {}
    selC.addEventListener("change", () => pintarProvincias());
    selP.addEventListener("change", () => { try { localStorage.setItem("mi-provincia", selP.value); } catch {} pintarProvincias(); });
  }
  const chips = (esc) => el("div", { class: "reparto" }, ...ordenarPartidos(esc).map((k) => el("span", { class: "ficha-esc", style: { background: color(k) } }, `${nombre(k)} ${esc[k]}`)));
  const mia = proy.provincias.find((p) => p.nombre === selP.value);
  $("#mi-provincia-ficha").replaceChildren(...(mia ? [el("div", { class: "mi-ficha" },
    el("h3", {}, `${mia.nombre}, ${mia.n} escaños`), chips(mia.escanos),
    el("p", {}, mia.aspirante ? `El último escaño es de ${nombre(mia.ultimo.p)}. ${nombre(mia.aspirante.p)} se lo quitaría con ${fmt1.format(Math.max(mia.aspirante.falta, 0))} puntos más.` : ""),
    el("p", { class: "explica" }, "Voto estimado: " + ordenarPartidos(mia.cuotas).filter((k) => mia.cuotas[k] >= 1).map((k) => `${nombre(k)} ${fmt1.format(mia.cuotas[k])}%`).join(", ")))] : []));
  const lista = proy.provincias.filter((p) => !selC.value || p.ccaa === selC.value).sort((a, b) => (a.aspirante?.falta ?? 99) - (b.aspirante?.falta ?? 99));
  $("#tabla-provincias").replaceChildren(
    el("thead", {}, el("tr", {}, el("th", {}, "Provincia"), el("th", {}, "Último escaño"), el("th", { class: "n" }, "Le faltan"), el("th", {}, "Reparto estimado"))),
    el("tbody", {}, ...lista.map((p) => el("tr", { class: p.nombre === selP.value ? "marcada" : null },
      el("td", {}, p.nombre, el("span", { class: "m" }, ` ${p.n}`)),
      el("td", {}, p.ultimo ? nombre(p.ultimo.p) : "–", p.aspirante ? el("span", { class: "m" }, ` lo persigue ${nombre(p.aspirante.p)}`) : null),
      el("td", { class: `n ${p.aspirante && p.aspirante.falta < 0.5 ? "filo" : ""}` }, p.aspirante ? `${fmt1.format(Math.max(p.aspirante.falta, 0))} pts` : "–"),
      el("td", {}, chips(p.escanos))))));
}

/* ---------- Quién acierta ---------- */
function pintarFiabilidad() {
  const f = D.fiabilidad;
  if (!f) { $("#tabla-fiabilidad").replaceChildren(el("caption", { class: "vacio" }, "Se calcula en la primera actualización.")); return; }
  const ultima = {};
  for (const e of D.encuestas?.encuestas || []) if (!ultima[e.clave]) ultima[e.clave] = e;
  const porEleccion = (clave, nom) => f.elecciones.find((x) => x.nombre === nom)?.firmas.find((y) => y.clave === clave);
  const nombres = f.elecciones.map((x) => x.nombre);
  $("#tabla-fiabilidad").replaceChildren(
    el("thead", {}, el("tr", {}, el("th", {}, "#"), el("th", {}, "Empresa"), el("th", { class: "n" }, "Error medio"), ...nombres.map((n) => el("th", { class: "n" }, n)), el("th", {}, "Última encuesta este ciclo"))),
    el("tbody", {}, ...f.ranking.map((r, i) => el("tr", {},
      el("td", {}, i + 1), el("td", {}, r.empresa),
      el("td", { class: "n" }, `${fmt1.format(r.error_medio)} pts`),
      ...nombres.map((n) => { const x = porEleccion(r.clave, n); return el("td", { class: "n" }, x ? fmt1.format(x.error_medio) : "–"); }),
      el("td", {}, ultima[r.clave] ? fFecha.format(fechaD(ultima[r.clave].fin)) : "no publica")))));
}

/* ---------- Partidos ---------- */
function pintarPartidos(m, m7, proy) {
  const orden = ordenarPartidos(m.media).filter((k) => m.media[k] >= 0.5);
  const vis = (k) => D.atencion?.lideres?.[k]?.serie?.slice(-1)[0]?.visitas;
  const lista = (arr, vacio) => arr?.length ? el("ul", {}, ...arr.map((n) => el("li", {}, el("a", { href: n.enlace, target: "_blank", rel: "noopener" }, n.titulo), el("span", { class: "m" }, `${n.fuente} ${hace(n.fecha)}`)))) : el("p", { class: "vacio" }, vacio);
  $("#fichas-partidos").replaceChildren(...orden.map((k) => {
    const d = m7.media[k] != null ? m.media[k] - m7.media[k] : 0;
    return el("article", { class: "ficha", style: { "--c": color(k) } },
      el("h3", {}, nombre(k)),
      el("div", { class: "cifras" }, el("span", {}, el("b", {}, `${fmt1.format(m.media[k])}%`), Math.abs(d) >= 0.1 ? el("span", { class: `delta ${d > 0 ? "sube" : "baja"}` }, `${d > 0 ? "+" : "−"}${fmt1.format(Math.abs(d))} en 7 días`) : null),
        el("span", {}, el("b", {}, proy.total[k] || 0), " escaños"), vis(k) ? el("span", {}, el("b", {}, fmt0.format(vis(k))), " visitas ayer") : null),
      lista(D.noticias?.partidos?.[k]?.slice(0, 4), "Sin titulares recientes."),
      D.noticias?.verificaciones?.[k]?.length ? [el("h4", {}, "Verificado por Newtral y Maldita"), lista(D.noticias.verificaciones[k].slice(0, 3))] : null);
  }));
}

/* ---------- Atención ---------- */
let graficoAtencion;
function pintarAtencion() {
  const a = D.atencion?.lideres;
  if (!a || !Object.keys(a).length) return;
  const claves = Object.keys(a);
  const dias = a[claves[0]].serie.map((x) => x.dia);
  graficoAtencion?.destroy();
  graficoAtencion = new Chart($("#grafico-atencion"), { type: "line",
    data: { labels: dias.map((d) => fFecha.format(fechaD(d))),
      datasets: claves.map((k) => ({ label: a[k].articulo, data: a[k].serie.map((x) => x.visitas), borderColor: color(k), backgroundColor: color(k), borderWidth: 2, pointRadius: 0, tension: 0.25 })) },
    options: opcionesGrafico(" visitas") });
}

/* ---------- Porra ---------- */
function pintarPorra(proy) {
  const bot = D.config.telegram_bot;
  $("#porra-instrucciones").replaceChildren(bot
    ? el("p", {}, "Manda tu pronóstico de escaños al bot ", el("a", { href: `https://t.me/${bot}`, target: "_blank", rel: "noopener" }, `@${bot}`), ", por ejemplo /porra PP 140 PSOE 110 Vox 50 Sumar 20. Puedes cambiarlo hasta el cierre de urnas. Gana quien menos escaños se desvíe en total.")
    : el("p", {}, "La porra se activa al configurar el bot de Telegram."));
  const ref = D.resultados?.escanos || proy.total;
  const refTexto = D.resultados?.escanos ? "resultado" : "proyección de hoy";
  const parts = Object.values(D.porra?.participantes || {}).map((p) => {
    const ks = new Set([...Object.keys(p.escanos), ...Object.keys(ref)]);
    return { ...p, distancia: [...ks].reduce((s, k) => s + Math.abs((p.escanos[k] || 0) - (ref[k] || 0)), 0) };
  }).sort((a, b) => a.distancia - b.distancia);
  if (!parts.length) { $("#tabla-porra").replaceChildren(el("caption", { class: "vacio" }, "Todavía no ha jugado nadie.")); return; }
  $("#tabla-porra").replaceChildren(
    el("thead", {}, el("tr", {}, el("th", {}, "#"), el("th", {}, "Quién"), el("th", {}, "Pronóstico"), el("th", { class: "n" }, `Desvío frente a ${refTexto}`))),
    el("tbody", {}, ...parts.map((p, i) => el("tr", {}, el("td", {}, i + 1), el("td", {}, p.nombre),
      el("td", {}, el("div", { class: "reparto" }, ...ordenarPartidos(p.escanos).map((k) => el("span", { class: "ficha-esc", style: { background: color(k) } }, `${nombre(k)} ${p.escanos[k]}`)))),
      el("td", { class: "n" }, `${p.distancia} esc.`)))));
}

/* ---------- Calendario y programas ---------- */
function pintarAgenda() {
  const ag = D.agenda || [];
  const h = hoy();
  const sig = ag.find((x) => fechaD(x.fin || x.fecha) >= h);
  $("#agenda").replaceChildren(...ag.map((x) => {
    const fin = fechaD(x.fin || x.fecha);
    const dia = x.fin ? `${fFecha.format(fechaD(x.fecha))} al ${fFecha.format(fin)}` : fFechaLarga.format(fechaD(x.fecha));
    return el("li", { class: fin < h ? "pasado" : x === sig ? "siguiente" : null }, el("span", { class: "dia" }, dia),
      el("span", {}, x.titulo, x.detalle ? el("span", { class: "det" }, x.detalle) : null));
  }));
  const veda = ag.find((x) => /encuestas/i.test(x.titulo));
  if (veda && h >= fechaD(veda.fecha) && h <= fechaD(veda.fin || veda.fecha))
    $("#encuestas").prepend(el("p", { class: "aviso" }, "Estamos en los cinco días previos a la votación, en los que la ley prohíbe publicar encuestas en España. La media se queda con las publicadas hasta el 23 de noviembre."));
}
function pintarProgramas() {
  const t = D.programas?.temas;
  if (!t?.length) return;
  $("#programas").hidden = false;
  const ps = [...new Set(t.flatMap((x) => Object.keys(x.propuestas)))];
  $("#tabla-programas").replaceChildren(el("thead", {}, el("tr", {}, el("th", {}, "Tema"), ...ps.map((k) => el("th", {}, nombre(k))))),
    el("tbody", {}, ...t.map((x) => el("tr", {}, el("th", {}, x.tema), ...ps.map((k) => el("td", {}, x.propuestas[k] || "–"))))));
}

/* ---------- Arranque ---------- */
function pintarTodo() {
  const m = calcMedia();
  const m7 = calcMedia(new Date(+hoy() - 7 * DIA));
  const sinDatos = !Object.keys(m.media).length;
  const media = sinDatos ? Modelo.mediaDesdeBase(D.base) : m.media;
  const proy = Modelo.proyectar(media, D.base);
  if (sinDatos) { m.media = media; }
  pintarPortada(proy);
  if (sinDatos) $("#nota-proy").textContent = "Sin encuestas cargadas todavía, se muestra el 23J con los escaños de 2026.";
  pintarResumen(m, m7, proy);
  pintarEncuestas(m, m7, proy);
  pintarSimulador(m, proy);
  pintarProvincias(proy);
  pintarFiabilidad();
  pintarPartidos(m, m7, proy);
  pintarPorra(proy);
}

(async function iniciar() {
  const nombres = ["config", "base2023", "encuestas", "fiabilidad", "noticias", "atencion", "porra", "agenda", "programas", "resultados"];
  const datos = await Promise.all(nombres.map(cargar));
  nombres.forEach((n, i) => { D[n === "base2023" ? "base" : n] = datos[i]; });
  if (!D.config || !D.base) { $("#titular-proy").textContent = "No se han podido cargar los datos base."; return; }
  $("#incluir-cis").addEventListener("change", pintarTodo);
  pintarTodo();
  pintarAtencion();
  pintarAgenda();
  pintarProgramas();
  const act = [D.encuestas?.actualizado, D.noticias?.actualizado].filter(Boolean).sort().pop();
  if (act) $("#actualizado").textContent = `Datos actualizados ${hace(act)}.`;
})();
