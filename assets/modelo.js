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
        // El tamaño del espacio sale de las generales de 2023. Cómo se reparte dentro (p. ej. Sumar frente a Podemos)
        // sale de las europeas de 2024, donde fueron por separado. Solo se usa la forma, no el nivel.
        const eu = base.europeas, rel = (k) => (eu && eu.provincias[prov.nombre] && eu.provincias[prov.nombre][k] && eu.nacional[k]) ? eu.provincias[prov.nombre][k] / eu.nacional[k] : 1;
        const pesos = miembros.map((k) => media[k] * (miembros.length > 1 ? rel(k) : 1)), sumP = pesos.reduce((a, b) => a + b, 0) || 1;
        miembros.forEach((k, i) => { out[k] = pool * pesos[i] / sumP; });
      } else {
        for (const k of miembros) {
          const amb = base.ambitos && base.ambitos[k];
          if (amb) { if (prov.ccaa === amb) out[k] = media[k] * base.factores_ccaa[amb]; }
          else if (base.europeas && base.europeas.provincias[prov.nombre] && base.europeas.provincias[prov.nombre][k] && base.europeas.nacional[k])
            out[k] = media[k] * base.europeas.provincias[prov.nombre][k] / base.europeas.nacional[k]; // sin base de 2023: forma de las europeas
          else if ((base.estatales || []).includes(k) || bNat === 0) out[k] = media[k]; // sin ningún dato: reparto uniforme
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

  /* Senado: 4 por provincia (3 al partido más votado y 1 al segundo), islas y ciudades autónomas con su reparto propio. 208 electos.
     Devuelve los senadores de una provincia, {partido: n}, a partir de sus cuotas de voto. */
  const SENADO_ESPECIAL = { Baleares: [4, 1], "Las Palmas": [4, 1], "Santa Cruz de Tenerife": [5, 1], Ceuta: [2, 0], Melilla: [2, 0] };
  function senadoProvincia(cuotas, nombre) {
    const o = Object.keys(cuotas).sort((x, y) => cuotas[y] - cuotas[x]), [s1, s2] = SENADO_ESPECIAL[nombre] || [3, 1], r = {};
    if (o[0]) r[o[0]] = s1;
    if (o[1] && s2) r[o[1]] = s2;
    return r;
  }

  const api = { proyectar, proyectarProvincia, dhondt, grupos, senadoProvincia, mediaDesdeBase: (b) => ({ ...b.nacional }), UMBRAL };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.Modelo = api;
})(typeof window !== "undefined" ? window : globalThis);
