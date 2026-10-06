#!/usr/bin/env node
/* Modelo de probabilidades del 29N.
   1. Calibra el error de las encuestas con lo que pasó en 2019 y 2023.
   2. Simula N elecciones: media de encuestas + error correlacionado por bloques + ruido provincial, D'Hondt por provincia.
   3. Saca probabilidades de escenarios, abanicos de escaños, provincias bisagra y provincias en el aire.
   4. Backtest: lo que el modelo habría dicho en 2023 con las encuestas de entonces y la base de 2019.
   5. Analiza las encuestas: sesgo de casa de cada empresa, notas, y si la última encuesta es noticia o ruido.
   Escribe data/probabilidades.json, data/analisis.json y data/probabilidades_historial.json */
"use strict";
const fs = require("fs"), path = require("path");
const M = require("../assets/modelo.js"), Me = require("../assets/media.js");
const DATA = path.join(__dirname, "..", "data");
const leer = (n, d = null) => fs.existsSync(path.join(DATA, n)) ? JSON.parse(fs.readFileSync(path.join(DATA, n), "utf8")) : d;
const escribir = (n, o) => fs.writeFileSync(path.join(DATA, n), JSON.stringify(o, null, 1));
const N = +(process.env.SIMULACIONES || 10000), MAYORIA = 176;
const fechaD = Me.fechaD, DIA = Me.DIA;

/* ---------- Aleatorio reproducible ---------- */
function rng(semilla) {
  let a = semilla >>> 0;
  const u = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  return { u, n: () => { let x = 0, y = 0; while (x === 0) x = u(); y = u(); return Math.sqrt(-2 * Math.log(x)) * Math.cos(2 * Math.PI * y); } };
}

/* ---------- Calibración del error ---------- */
const BLOQUES = { derecha: ["PP", "Vox", "SALF", "UPN", "Cs", "NA+"], izquierda: ["PSOE", "Sumar", "Podemos", "UP", "MP", "AA"], territorial: ["ERC", "Junts", "Bildu", "PNV", "BNG", "CCa", "AC", "CUP", "PRC", "TE"] };
const bloqueDe = (k) => Object.keys(BLOQUES).find((b) => BLOQUES[b].includes(k)) || "otros";
// Un partido de hoy hereda el error histórico de su equivalente de entonces
const EQUIV = { Sumar: ["Sumar", "UP"], Podemos: ["Sumar", "UP"], SALF: ["Vox", "Cs"], AA: ["Sumar", "UP"], AC: ["Junts", "CDC"], Junts: ["Junts", "CDC"] };

function erroresEleccion(hist) {
  // hist = {fecha, resultado:{p:%}, encuestas:[...]}; media a fecha de inicio de la veda
  // Misma regla que se usa hoy: la media al empezar la veda, con la ventana de la última semana
  const veda = new Date(fechaD(hist.fecha) - 6 * DIA);
  const m = Me.calcMedia(hist.encuestas, veda, Me.ventanaAdaptativa(veda, fechaD(hist.fecha))).media;
  const err = {};
  for (const [p, v] of Object.entries(hist.resultado)) if (v >= 1 && m[p] != null) err[p] = +(v - m[p]).toFixed(2);
  return { media: m, errores: err };
}

function sigmas(media, historicos, dias) {
  const errs = historicos.map(erroresEleccion);
  const out = {}, detalle = {};
  for (const k of Object.keys(media)) {
    const fuentes = EQUIV[k] || [k];
    const muestras = [];
    for (const e of errs) for (const f of fuentes) if (e.errores[f] != null) { muestras.push(e.errores[f]); break; }
    const rms = muestras.length ? Math.sqrt(muestras.reduce((s, x) => s + x * x, 0) / muestras.length) : 0;
    const suelo = Math.max(0.4, 0.06 * media[k]);
    const techo = 0.6 * media[k] + 0.3; // un partido pequeño no puede tener un error mayor que él mismo
    const base = Math.min(Math.max(rms, suelo), techo);
    const tiempo = 1 + 0.5 * Math.min(Math.max(dias, 0), 90) / 90; // más incertidumbre cuanto más lejos esté la votación
    out[k] = +(base * tiempo).toFixed(3);
    detalle[k] = { errores_historicos: muestras, rms: +rms.toFixed(2), suelo: +suelo.toFixed(2), factor_tiempo: +tiempo.toFixed(2), sigma: out[k] };
  }
  return { sigmas: out, detalle, errores: errs };
}

/* ---------- Simulación ---------- */
function simular(media, base, sig, n, semilla, opciones = {}) {
  const r = rng(semilla), claves = Object.keys(media).filter((k) => media[k] > 0);
  const RHO = 0.55, ZS = 0.35, RUIDO_PROV = 0.05;
  const resultados = [];
  for (let i = 0; i < n; i++) {
    const zb = {}, zt = r.n();
    for (const b of Object.keys(BLOQUES)) zb[b] = r.n();
    zb.otros = r.n();
    const m = {};
    for (const k of claves) {
      const b = bloqueDe(k), signo = b === "derecha" ? 1 : b === "izquierda" ? -1 : 0;
      const z = RHO * zb[b] + Math.sqrt(1 - RHO * RHO) * r.n() + ZS * signo * zt;
      m[k] = Math.max(0, media[k] + sig[k] * z);
    }
    const ruido = (prov, cuotas) => { for (const k of Object.keys(cuotas)) cuotas[k] *= 1 + RUIDO_PROV * r.n(); return cuotas; };
    const gr = M.grupos(m, base), total = {}, provincias = [];
    for (const prov of base.provincias) {
      const cuotas = ruido(prov, M.proyectarProvincia(prov, m, base, gr));
      const d = M.dhondt(cuotas, opciones.escanos ? opciones.escanos[prov.nombre] : prov.escanos);
      for (const [p, s] of Object.entries(d.escanos)) total[p] = (total[p] || 0) + s;
      provincias.push({ escanos: d.escanos, ultimo: d.ultimo ? d.ultimo.p : null, aspirante: d.aspirante ? d.aspirante.p : null, falta: d.aspirante ? Math.max(0, d.aspirante.falta) : 99, cuotas });
    }
    resultados.push({ total, provincias, senado: senadoDe(provincias, base) });
  }
  return resultados;
}

/* Senado: 4 por provincia (3 al primero, 1 al segundo), islas y ciudades autónomas con su reparto propio. 208 electos */
const SENADO_ESPECIAL = { Baleares: [4, 1], "Las Palmas": [4, 1], "Santa Cruz de Tenerife": [5, 1], Ceuta: [2, 0], Melilla: [2, 0] };
function senadoDe(provincias, base) {
  const total = {};
  provincias.forEach((p, i) => {
    const o = Object.keys(p.cuotas).sort((a, b) => p.cuotas[b] - p.cuotas[a]);
    const [s1, s2] = SENADO_ESPECIAL[base.provincias[i].nombre] || [3, 1];
    if (o[0]) total[o[0]] = (total[o[0]] || 0) + s1;
    if (o[1] && s2) total[o[1]] = (total[o[1]] || 0) + s2;
  });
  return total;
}

function resumir(sims, base, escenarios) {
  const n = sims.length, claves = new Set();
  for (const s of sims) for (const k of Object.keys(s.total)) claves.add(k);
  const partidos = {};
  for (const k of claves) {
    const v = sims.map((s) => s.total[k] || 0).sort((a, b) => a - b);
    const hist = {};
    for (const x of v) hist[x] = (hist[x] || 0) + 1;
    partidos[k] = { p10: v[Math.floor(n * .1)], p50: v[Math.floor(n * .5)], p90: v[Math.floor(n * .9)], media: +(v.reduce((a, b) => a + b, 0) / n).toFixed(1),
      p_primero: 0, p_mayoria: v.filter((x) => x >= MAYORIA).length / n, histograma: hist };
  }
  for (const s of sims) { const o = Object.keys(s.total).sort((a, b) => s.total[b] - s.total[a]); if (o[0]) partidos[o[0]].p_primero += 1 / n; }
  for (const k of claves) partidos[k].p_primero = +partidos[k].p_primero.toFixed(4);
  const esc = {};
  let bloqueo = 0;
  const bisagra = {};
  for (const e of escenarios) { esc[e.id] = { ...e, p: 0, escanos: [] }; bisagra[e.id] = {}; }
  for (const s of sims) {
    let alguno = false;
    for (const e of escenarios) {
      const suma = e.partidos.reduce((a, k) => a + (s.total[k] || 0), 0);
      esc[e.id].escanos.push(suma);
      if (suma >= MAYORIA) {
        esc[e.id].p += 1 / n;
        if (e.gobierno) alguno = true;
        // provincia bisagra: ordenadas por fuerza de la coalición, dónde cae el escaño 176
        const orden = s.provincias.map((p, i) => ({ i, f: e.partidos.reduce((a, k) => a + (p.cuotas[k] || 0), 0), s: e.partidos.reduce((a, k) => a + (p.escanos[k] || 0), 0) })).sort((a, b) => b.f - a.f);
        let acum = 0;
        for (const o of orden) { acum += o.s; if (acum >= MAYORIA) { const nom = base.provincias[o.i].nombre; bisagra[e.id][nom] = (bisagra[e.id][nom] || 0) + 1; break; } }
      }
    }
    if (!alguno) bloqueo += 1 / n;
  }
  for (const e of escenarios) {
    const v = esc[e.id].escanos.sort((a, b) => a - b);
    esc[e.id] = { id: e.id, nombre: e.nombre, partidos: e.partidos, gobierno: !!e.gobierno, p: +esc[e.id].p.toFixed(4), p10: v[Math.floor(n * .1)], p50: v[Math.floor(n * .5)], p90: v[Math.floor(n * .9)],
      bisagra: Object.entries(bisagra[e.id]).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([nombre, c]) => ({ nombre, p: +(c / Math.max(1, Object.values(bisagra[e.id]).reduce((x, y) => x + y, 0))).toFixed(3) })) };
  }
  // Provincias: reparto más frecuente y probabilidad de que el último escaño sea de cada partido
  const provincias = base.provincias.map((prov, i) => {
    const rep = {}, ult = {}, pares = {};
    let renidas = 0, sumaFalta = 0;
    for (const s of sims) {
      const p = s.provincias[i];
      const clave = Object.keys(p.escanos).sort().map((k) => `${k}:${p.escanos[k]}`).join(",");
      rep[clave] = (rep[clave] || 0) + 1;
      if (p.ultimo) ult[p.ultimo] = (ult[p.ultimo] || 0) + 1;
      if (p.ultimo && p.aspirante) { const k = `${p.ultimo}|${p.aspirante}`; pares[k] = (pares[k] || 0) + 1; }
      // reñida: el último asiento se decide por menos de 10.000 votos (los puntos de la provincia pasados a votos por su tamaño)
      if (p.falta / 100 * (prov.escanos / 350) * 24688087 < 10000) renidas++;
      sumaFalta += Math.min(p.falta, 10);
    }
    const par = Object.entries(pares).sort((a, b) => b[1] - a[1])[0];
    const modal = Object.entries(rep).sort((a, b) => b[1] - a[1])[0];
    const reparto = {};
    for (const par of modal[0].split(",")) { const [k, v] = par.split(":"); reparto[k] = +v; }
    const ultimo = {};
    for (const [k, c] of Object.entries(ult)) ultimo[k] = +(c / n).toFixed(3);
    // en_el_aire: de cada 100 simulaciones, en cuántas el último asiento se decide por menos de 10.000 votos
    return { nombre: prov.nombre, ccaa: prov.ccaa, n: prov.escanos, reparto, p_reparto: +(modal[1] / n).toFixed(3), en_el_aire: +(renidas / n).toFixed(3), falta_media: +(sumaFalta / n).toFixed(2),
      disputa: par ? { tiene: par[0].split("|")[0], quiere: par[0].split("|")[1], p: +(par[1] / n).toFixed(3) } : null, ultimo };
  });
  // Senado
  const senado = {};
  const clavesS = new Set(); for (const s of sims) for (const k of Object.keys(s.senado)) clavesS.add(k);
  for (const k of clavesS) { const v = sims.map((s) => s.senado[k] || 0).sort((a, b) => a - b); senado[k] = { p10: v[Math.floor(n * .1)], p50: v[Math.floor(n * .5)], p90: v[Math.floor(n * .9)], p_mayoria: +(v.filter((x) => x >= 105).length / n).toFixed(4) }; }
  return { partidos, escenarios: esc, bloqueo: +bloqueo.toFixed(4), provincias, senado };
}

/* Puntos de voto que le faltan (o sobran) a una coalición para que su probabilidad de 176 sea del 50 % */
function margen(media, base, sig, e, semilla) {
  const desplazar = (s) => {
    const m = { ...media }, coal = e.partidos.filter((k) => m[k] > 0), otros = Object.keys(m).filter((k) => !coal.includes(k) && m[k] > 0);
    const sc = coal.reduce((a, k) => a + m[k], 0), so = otros.reduce((a, k) => a + m[k], 0);
    for (const k of coal) m[k] = Math.max(0, m[k] + s * m[k] / sc);
    for (const k of otros) m[k] = Math.max(0, m[k] - s * m[k] / so);
    return m;
  };
  const p = (s) => { const sims = simular(desplazar(s), base, sig, 1200, semilla + 7); return sims.filter((x) => e.partidos.reduce((a, k) => a + (x.total[k] || 0), 0) >= MAYORIA).length / sims.length; };
  let lo = -12, hi = 12;
  if (p(lo) >= 0.5) return -12; if (p(hi) < 0.5) return 12;
  for (let i = 0; i < 9; i++) { const mid = (lo + hi) / 2; if (p(mid) >= 0.5) hi = mid; else lo = mid; }
  return +((lo + hi) / 2).toFixed(1);
}

/* ---------- Análisis de encuestas: sesgo de casa, notas, noticia o ruido ---------- */
function analizar(encuestas, ranking, mediaHoy) {
  const principales = Object.keys(mediaHoy).sort((a, b) => mediaHoy[b] - mediaHoy[a]).filter((k) => mediaHoy[k] >= 2).slice(0, 6);
  const hoy = new Date(), recientes = encuestas.filter((e) => (hoy - fechaD(e.fin)) / DIA <= 420);
  const desv = {}; // clave -> [{fin, dev:{p:x}}]
  for (const e of recientes) {
    const m = Me.calcMedia(encuestas, fechaD(e.fin), { ventana: 30, excluirClave: e.clave, incluirCIS: false }).media;
    const dev = {};
    for (const p of principales) if (e.pct[p] != null && m[p] != null) dev[p] = e.pct[p] - m[p];
    if (Object.keys(dev).length >= 3) (desv[e.clave] ||= { empresa: e.empresa_base, filas: [] }).filas.push({ id: e.id, fin: e.fin, dev });
  }
  const sesgos = {};
  for (const [clave, d] of Object.entries(desv)) {
    if (d.filas.length < 3) continue;
    const sesgo = {}, resid = [];
    for (const p of principales) {
      const xs = d.filas.map((f) => f.dev[p]).filter((x) => x != null);
      if (xs.length >= 3) sesgo[p] = +(xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(2);
    }
    for (const f of d.filas) for (const p of principales) if (f.dev[p] != null && sesgo[p] != null) resid.push(f.dev[p] - sesgo[p]);
    const sd = Math.sqrt(resid.reduce((a, x) => a + x * x, 0) / Math.max(1, resid.length));
    sesgos[clave] = { empresa: d.empresa, n: d.filas.length, sesgo, sd: +Math.max(sd, 0.5).toFixed(2) };
  }
  // Centrar: de media las manías de las empresas (sin el CIS) suman cero en cada partido.
  // Así la corrección quita lo raro de cada empresa sin mover el nivel de la media entera.
  const normales = Object.entries(sesgos).filter(([k]) => k !== "cis");
  for (const p of principales) {
    const xs = normales.map(([, v]) => v.sesgo[p]).filter((x) => x != null);
    if (!xs.length) continue;
    const centro = xs.reduce((a, b) => a + b, 0) / xs.length;
    for (const [, v] of Object.entries(sesgos)) if (v.sesgo[p] != null) v.sesgo[p] = +(v.sesgo[p] - centro).toFixed(2);
  }
  const nota = (clave) => {
    const r = ranking && ranking.find((x) => x.clave === clave);
    if (!r) return { letra: "–", texto: "sin historial en 2019 ni 2023" };
    const l = r.error_medio <= 1.2 ? "A" : r.error_medio <= 1.8 ? "B" : r.error_medio <= 2.5 ? "C" : "D";
    return { letra: l, texto: `error medio de ${r.error_medio.toFixed(1)} puntos en ${r.elecciones === 2 ? "2019 y 2023" : "una elección"}` };
  };
  const ultimas = [];
  for (const e of encuestas.slice(0, 12)) {
    const m = Me.calcMedia(encuestas, fechaD(e.fin), { ventana: 30, excluirClave: e.clave, incluirCIS: false }).media;
    const s = sesgos[e.clave];
    const detalle = [];
    let maxZ = 0, culpable = null;
    const margen = e.muestra ? 98 / Math.sqrt(e.muestra) : 3.1; // margen de error muestral al 95 % para un 50 %, en puntos
    for (const p of principales) {
      if (e.pct[p] == null || m[p] == null) continue;
      const esperado = m[p] + (s && s.sesgo[p] != null ? s.sesgo[p] : 0);
      const resid = e.pct[p] - esperado;
      const sdTotal = Math.sqrt(Math.pow(s ? s.sd : 1.5, 2) + Math.pow(margen / 1.96 * Math.sqrt(Math.max(e.pct[p], 1) * (100 - Math.max(e.pct[p], 1))) / 50, 2));
      const z = resid / sdTotal;
      detalle.push({ partido: p, dado: e.pct[p], esperado: +esperado.toFixed(1), diferencia: +resid.toFixed(1) });
      if (Math.abs(z) > Math.abs(maxZ)) { maxZ = z; culpable = p; }
    }
    const az = Math.abs(maxZ);
    const veredicto = az < 1.2 ? "ruido" : az < 2 ? "leve" : "movimiento";
    const d = detalle.find((x) => x.partido === culpable);
    const texto = veredicto === "ruido" ? "Dentro de lo que suele dar esta empresa. No cambia nada."
      : veredicto === "leve" ? `Algo fuera de lo habitual: ${culpable} ${d.diferencia > 0 ? "sube" : "baja"} ${Math.abs(d.diferencia).toFixed(1)} puntos respecto a lo esperado de esta empresa.`
      : `Movimiento real: ${culpable} sale ${Math.abs(d.diferencia).toFixed(1)} puntos ${d.diferencia > 0 ? "por encima" : "por debajo"} de lo que cabía esperar de esta empresa.`;
    ultimas.push({ id: e.id, empresa: e.empresa_base, encargo: e.encargo, fin: e.fin, veredicto, texto, nota: nota(e.clave).letra, margen: +margen.toFixed(1), detalle });
  }
  const notas = Object.values(encuestas.reduce((acc, e) => { acc[e.clave] ||= { clave: e.clave, empresa: e.empresa_base, encuestas: 0 }; acc[e.clave].encuestas++; return acc; }, {}))
    .map((x) => ({ ...x, ...nota(x.clave), sesgo: sesgos[x.clave] ? sesgos[x.clave].sesgo : null }))
    .sort((a, b) => (a.letra === "–") - (b.letra === "–") || a.letra.localeCompare(b.letra) || b.encuestas - a.encuestas);
  return { principales, sesgos, notas, ultimas };
}

/* ---------- Principal ---------- */
function main() {
  const config = leer("config.json"), base = leer("base2023.json"), enc = leer("encuestas.json"), fiab = leer("fiabilidad.json");
  const historicos = [leer("historico_2023.json"), leer("historico_2019.json"), leer("historico_2019a.json"), leer("historico_2016.json")].filter(Boolean);
  const encuestas = enc ? enc.encuestas : [];
  const hoy = new Date();
  const dias = Math.round((fechaD(config.eleccion.fecha) - hoy) / DIA);
  const va = Me.ventanaAdaptativa(hoy, fechaD(config.eleccion.fecha));
  console.log(`Ventana de la media: ${va.ventana} días, semivida ${va.semivida} días (${va.fase}, faltan ${va.dias} días)`);
  const mediaBruta = Me.calcMedia(encuestas, hoy, { ...va, ranking: fiab && fiab.ranking }).media;
  if (!Object.keys(mediaBruta).length) { console.log("Sin encuestas, no se simula"); return; }
  // Primero el análisis (sesgo de casa de cada empresa), después la media ya corregida con esos sesgos
  const an = analizar(encuestas, fiab && fiab.ranking, mediaBruta);
  const { media, usadas } = Me.calcMedia(encuestas, hoy, { ...va, ranking: fiab && fiab.ranking, sesgos: an.sesgos });
  console.log(`Encuestas en la media de hoy: ${usadas.map((e) => `${e.empresa_base} ${e.fin} (${Math.round(e.peso_pct * 100)} %)`).join(", ")}`);
  console.log(`Corrección de sesgo de casa: ${Object.entries(media).slice(0, 5).map(([k, v]) => `${k} ${mediaBruta[k].toFixed(1)} -> ${v.toFixed(1)}`).join(", ")}`);
  const cal = sigmas(media, historicos, dias);
  console.log(`Media hoy: ${Object.entries(media).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => `${k} ${v.toFixed(1)}`).join(", ")}`);
  console.log(`Sigmas: ${Object.entries(cal.sigmas).slice(0, 6).map(([k, v]) => `${k} ±${v}`).join(", ")}  (elecciones calibradas: ${historicos.length})`);
  const t0 = Date.now();
  const sims = simular(media, base, cal.sigmas, N, 29);
  const res = resumir(sims, base, config.escenarios);
  console.log(`${N} simulaciones en ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  for (const e of Object.values(res.escenarios)) {
    if (e.gobierno) e.margen = margen(media, base, cal.sigmas, e, 29);
    console.log(`  ${e.nombre}: ${(e.p * 100).toFixed(0)} %  (${e.p10}-${e.p90})${e.gobierno ? `  margen ${e.margen > 0 ? "faltan " + e.margen : "sobran " + (-e.margen)} pts` : ""}`);
  }
  console.log(`  Bloqueo: ${(res.bloqueo * 100).toFixed(0)} %`);
  const salida = { actualizado: hoy.toISOString(), simulaciones: N, dias_para_votar: dias, media,
    ventana: { ...va, encuestas: usadas.map((e) => ({ id: e.id, empresa: e.empresa_base, encargo: e.encargo, fin: e.fin, muestra: e.muestra, peso: +e.peso_pct.toFixed(3) })) }, sigmas: cal.sigmas, calibracion: cal.detalle, errores_historicos: cal.errores.map((e, i) => ({ eleccion: historicos[i].nombre, errores: e.errores })),
    ...res, metodo: "Media ponderada de encuestas + error correlacionado por bloques (rho 0,55) calibrado con 2019 y 2023 + ruido provincial 5 %, D'Hondt por provincia con los escaños del RD 806/2026." };

  // Backtest 2023: base 2019 y encuestas de entonces, con el error calibrado SOLO con 2019
  const h23 = historicos.find((h) => h.nombre === "23J 2023"), h19 = historicos.find((h) => h.nombre === "10N 2019"), base19 = leer("base2019.json");
  if (h23 && h19 && base19) {
    const fechas = ["2023-05-30", "2023-06-20", "2023-07-10", "2023-07-17"];
    salida.backtest = { eleccion: "23J 2023", resultado_escanos: base.escanos_reales, fechas: [] };
    for (const f of fechas) {
      const fd = fechaD(f), m = Me.calcMedia(h23.encuestas, fd, Me.ventanaAdaptativa(fd, fechaD("2023-07-23"))).media;
      const d = Math.round((fechaD("2023-07-23") - fd) / DIA);
      const c = sigmas(m, historicos.filter((h) => h.nombre !== "23J 2023"), d); // solo con lo anterior a 2023
      const s = simular(m, base19, c.sigmas, 4000, 23);
      const r = resumir(s, base19, config.escenarios_2023);
      salida.backtest.fechas.push({ fecha: f, dias: d, media: m, escenarios: Object.fromEntries(Object.values(r.escenarios).map((e) => [e.id, { nombre: e.nombre, p: e.p, p10: e.p10, p50: e.p50, p90: e.p90 }])), bloqueo: r.bloqueo,
        partidos: Object.fromEntries(Object.entries(r.partidos).map(([k, v]) => [k, { p10: v.p10, p50: v.p50, p90: v.p90 }])) });
      console.log(`  backtest ${f} (${d} días): ${Object.values(r.escenarios).map((e) => `${e.nombre} ${(e.p * 100).toFixed(0)} %`).join(", ")}, bloqueo ${(r.bloqueo * 100).toFixed(0)} %`);
    }
  }
  escribir("probabilidades.json", salida);

  // Historial diario
  const hist = leer("probabilidades_historial.json", []);
  const dia = hoy.toISOString().slice(0, 10);
  const fila = { fecha: dia, escenarios: Object.fromEntries(Object.values(res.escenarios).map((e) => [e.id, e.p])), bloqueo: res.bloqueo, p50: Object.fromEntries(Object.entries(res.partidos).map(([k, v]) => [k, v.p50])) };
  const i = hist.findIndex((h) => h.fecha === dia);
  if (i >= 0) hist[i] = fila; else hist.push(fila);
  escribir("probabilidades_historial.json", hist);

  escribir("analisis.json", { actualizado: hoy.toISOString(), media_bruta: mediaBruta, ...an });
  console.log(`Análisis: ${Object.keys(an.sesgos).length} empresas con sesgo calculado, última encuesta ${an.ultimas[0] ? an.ultimas[0].empresa + " -> " + an.ultimas[0].veredicto : "ninguna"}`);
}

main();
