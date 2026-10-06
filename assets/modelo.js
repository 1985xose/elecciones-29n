/* Motor de escaños, versión general.
   base = { nacional:{partido:%}, provincias:[{nombre, ccaa, escanos, base:{partido:%}}],
            herencia:{partidoEncuesta:[partidosBase]}, estatales:[...], ambitos:{partido:ccaa}, factores_ccaa:{ccaa:factor} }
   media = {partidoEncuesta:%}. Swing proporcional por provincia + D'Hondt con umbral del 3%.
   Funciona en navegador (window.Modelo) y en Node (module.exports). */
(function (root) {
  const UMBRAL = 3;

  function grupos(media, base) {
    // Partidos de la encuesta agrupados por los partidos base que heredan (Sumar y Podemos heredan ambos "Sumar" de 2023)
    const her = base.herencia || {};
    const g = {};
    for (const k of Object.keys(media)) {
      if (media[k] == null) continue;
      const lista = her[k] || [k];
      const clave = lista.slice().sort().join("+");
      (g[clave] ||= { bases: lista, miembros: [] }).miembros.push(k);
    }
    return Object.values(g);
  }

  function proyectarProvincia(prov, media, base, gr) {
    gr = gr || grupos(media, base);
    const out = {};
    for (const { bases, miembros } of gr) {
      const bProv = bases.reduce((s, b) => s + (prov.base[b] || 0), 0);
      const bNat = bases.reduce((s, b) => s + (base.nacional[b] || 0), 0);
      const mSum = miembros.reduce((s, k) => s + media[k], 0);
      if (bProv > 0 && bNat > 0) {
        const pool = bProv * mSum / bNat;
        for (const k of miembros) out[k] = pool * media[k] / mSum;
      } else {
        for (const k of miembros) {
          const amb = base.ambitos && base.ambitos[k];
          if (amb) { if (prov.ccaa === amb) out[k] = media[k] * base.factores_ccaa[amb]; }
          else if ((base.estatales || []).includes(k) || bNat === 0) out[k] = media[k]; // sin base: reparto uniforme
        }
      }
    }
    return out;
  }

  function dhondt(cuotas, escanos) {
    const cocientes = [];
    for (const [p, v] of Object.entries(cuotas)) if (v >= UMBRAL) for (let d = 1; d <= escanos; d++) cocientes.push({ p, q: v / d });
    cocientes.sort((a, b) => b.q - a.q);
    const res = {}, gan = cocientes.slice(0, escanos);
    for (const c of gan) res[c.p] = (res[c.p] || 0) + 1;
    const ultimo = gan[gan.length - 1];
    let aspirante = null;
    if (ultimo) for (const [p, v] of Object.entries(cuotas)) {
      if (p === ultimo.p) continue;
      let falta = ultimo.q * ((res[p] || 0) + 1) - v;
      if (v < UMBRAL) falta = Math.max(falta, UMBRAL - v);
      if (!aspirante || falta < aspirante.falta) aspirante = { p, falta };
    }
    return { escanos: res, ultimo: ultimo ? { p: ultimo.p, q: ultimo.q } : null, aspirante };
  }

  function proyectar(media, base, opciones = {}) {
    const gr = grupos(media, base), total = {}, provincias = [];
    for (const prov of base.provincias) {
      const cuotas = proyectarProvincia(prov, media, base, gr);
      const r = dhondt(cuotas, opciones.escanos ? opciones.escanos[prov.nombre] : prov.escanos);
      for (const [p, n] of Object.entries(r.escanos)) total[p] = (total[p] || 0) + n;
      provincias.push({ nombre: prov.nombre, ccaa: prov.ccaa, n: prov.escanos, cuotas, ...r });
    }
    return { total, provincias };
  }

  const api = { proyectar, proyectarProvincia, dhondt, grupos, mediaDesdeBase: (b) => ({ ...b.nacional }), UMBRAL };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.Modelo = api;
})(typeof window !== "undefined" ? window : globalThis);
