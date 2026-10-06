/* Motor de escaños. Proyección provincial por swing proporcional sobre el 23J + D'Hondt con umbral del 3%.
   Funciona en navegador (window.Modelo) y en Node (module.exports) para poder testearlo. */
(function (root) {
  const HIST = ["PP", "PSOE", "Vox", "ERC", "Junts", "Bildu", "PNV", "BNG", "CCa", "UPN"];
  const UMBRAL = 3;

  function proyectarProvincia(prov, media, base) {
    const nat = base.nacional_2023, out = {};
    for (const k of HIST) {
      if (media[k] == null) continue;
      const sinBase = (prov.sin_base || []).includes(k);
      if (sinBase) { out[k] = media[k]; continue; }
      const b = prov.base[k];
      if (b && nat[k]) out[k] = b * media[k] / nat[k];
    }
    // Sumar 2023 incluía a Podemos: el espacio se reparte según la encuesta
    const izq = (media.Sumar || 0) + (media.Podemos || 0);
    if (izq > 0 && prov.base.Sumar) {
      const espacio = prov.base.Sumar * izq / nat.Sumar;
      if (media.Sumar) out.Sumar = espacio * media.Sumar / izq;
      if (media.Podemos) out.Podemos = espacio * media.Podemos / izq;
    }
    // Partidos sin base 2023
    for (const k of Object.keys(media)) {
      if (k in out || HIST.includes(k) || k === "Sumar" || k === "Podemos") continue;
      if (k === "AC") { if (prov.ccaa === "Cataluña") out.AC = media.AC * base.factor_cataluna; continue; }
      out[k] = media[k]; // reparto uniforme
    }
    return out;
  }

  function dhondt(cuotas, escanos) {
    const elig = Object.entries(cuotas).filter(([, v]) => v >= UMBRAL);
    const cocientes = [];
    for (const [p, v] of elig) for (let d = 1; d <= escanos; d++) cocientes.push({ p, q: v / d });
    cocientes.sort((a, b) => b.q - a.q);
    const res = {};
    const ganadores = cocientes.slice(0, escanos);
    for (const c of ganadores) res[c.p] = (res[c.p] || 0) + 1;
    const ultimo = ganadores[ganadores.length - 1];
    // Aspirante: quien necesita menos puntos para quitarle el último escaño
    let aspirante = null;
    for (const [p, v] of Object.entries(cuotas)) {
      const s = res[p] || 0;
      let falta = ultimo ? ultimo.q * (s + 1) - v : 0;
      if (v < UMBRAL) falta = Math.max(falta, UMBRAL - v);
      if (ultimo && p === ultimo.p) continue;
      if (!aspirante || falta < aspirante.falta) aspirante = { p, falta };
    }
    return { escanos: res, ultimo: ultimo ? { p: ultimo.p, q: ultimo.q } : null, aspirante };
  }

  function proyectar(media, base) {
    const total = {}, provincias = [];
    for (const prov of base.provincias) {
      const cuotas = proyectarProvincia(prov, media, base);
      const r = dhondt(cuotas, prov.esc2026);
      for (const [p, n] of Object.entries(r.escanos)) total[p] = (total[p] || 0) + n;
      provincias.push({ nombre: prov.nombre, ccaa: prov.ccaa, n: prov.esc2026, cuotas, ...r });
    }
    return { total, provincias };
  }

  function mediaDesdeBase(base) { return { ...base.nacional_2023 }; }

  const api = { proyectar, proyectarProvincia, dhondt, mediaDesdeBase, UMBRAL };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.Modelo = api;
})(this);
