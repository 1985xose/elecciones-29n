/* Media ponderada de encuestas. Compartida por el navegador y por el simulador en Node. */
(function (root) {
  const DIA = 86400000;
  const fechaD = (s) => new Date(s + "T12:00:00Z");

  function factorAcierto(clave, ranking) {
    const r = ranking && ranking.find((x) => x.clave === clave);
    return r ? Math.min(1.4, Math.max(0.6, 1.6 / (0.6 + r.error_medio))) : 1;
  }

  /* encuestas: [{clave, fin, muestra, pct}], fecha: Date,
     opciones: {ventana, incluirCIS, ranking, excluirClave, sesgos: {clave: {sesgo: {partido: puntos}}}}
     Si hay sesgos, a cada encuesta se le resta lo que esa empresa suele dar de más o de menos respecto a la media. */
  function calcMedia(encuestas, fecha, opciones = {}) {
    const ventana = opciones.ventana || 30;
    const elegir = (v) => {
      const ult = {};
      for (const e of encuestas) {
        const edad = (fecha - fechaD(e.fin)) / DIA;
        if (edad < 0 || edad > v) continue;
        if (!opciones.incluirCIS && e.clave === "cis") continue;
        if (opciones.excluirClave && e.clave === opciones.excluirClave) continue;
        if (!ult[e.clave] || ult[e.clave].fin < e.fin) ult[e.clave] = e;
      }
      return Object.values(ult);
    };
    let usadas = elegir(ventana);
    if (usadas.length < 4) usadas = elegir(ventana * 2);
    const suma = {}, pesos = {};
    for (const e of usadas) {
      const edad = (fecha - fechaD(e.fin)) / DIA;
      e.peso = Math.exp(-edad / 14) * Math.sqrt(Math.min(e.muestra || 1000, 5000) / 1000) * factorAcierto(e.clave, opciones.ranking);
      const sg = opciones.sesgos && opciones.sesgos[e.clave] ? opciones.sesgos[e.clave].sesgo : null;
      for (const [p, v] of Object.entries(e.pct)) { const vc = sg && sg[p] != null ? v - sg[p] : v; suma[p] = (suma[p] || 0) + vc * e.peso; pesos[p] = (pesos[p] || 0) + e.peso; }
    }
    const media = {};
    for (const p of Object.keys(suma)) media[p] = suma[p] / pesos[p];
    return { media, usadas };
  }

  const api = { calcMedia, factorAcierto, fechaD, DIA };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.Media = api;
})(typeof window !== "undefined" ? window : globalThis);
