/* Media ponderada de encuestas. Compartida por el navegador y por el simulador en Node. */
(function (root) {
  const DIA = 86400000;
  const fechaD = (s) => new Date(s + "T12:00:00Z");

  function factorAcierto(clave, ranking) {
    const r = ranking && ranking.find((x) => x.clave === clave);
    return r ? Math.min(1.4, Math.max(0.6, 1.6 / (0.6 + r.error_medio))) : 1;
  }

  /* Cuántos días de encuestas entran en la media y cuánto pesa la antigüedad, según lo que falte para votar.
     Lejos de la votación salen pocas encuestas y conviene estabilidad. En campaña salen varias al día y la opinión
     se mueve rápido, así que la ventana se estrecha para que un cambio real no se diluya entre encuestas viejas.
     La última fase cubre también los 5 días en que la ley prohíbe publicar encuestas. */
  function ventanaAdaptativa(fecha, fechaEleccion) {
    const dias = Math.round((fechaEleccion - fecha) / DIA);
    if (dias > 16) return { ventana: 30, semivida: 14, fase: "precampaña", dias };
    if (dias > 7) return { ventana: 14, semivida: 7, fase: "campaña", dias };
    return { ventana: 10, semivida: 5, fase: "última semana", dias };
  }

  /* encuestas: [{clave, fin, muestra, pct}], fecha: Date,
     opciones: {ventana, semivida, incluirCIS, ranking, excluirClave, sesgos: {clave: {sesgo: {partido: puntos}}}}
     Si hay sesgos, a cada encuesta se le resta lo que esa empresa suele dar de más o de menos respecto a la media. */
  function calcMedia(encuestas, fecha, opciones = {}) {
    const ventana = opciones.ventana || 30, semivida = opciones.semivida || 14;
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
    // Peso bruto de cada encuesta: más reciente, más entrevistas y empresa más acertada pesan más
    for (const e of usadas) {
      const edad = (fecha - fechaD(e.fin)) / DIA;
      e.peso = Math.exp(-edad / semivida) * Math.sqrt(Math.min(e.muestra || 1000, 5000) / 1000) * factorAcierto(e.clave, opciones.ranking);
    }
    // Tope: ninguna encuesta puede pesar más del 25 % (o lo justo si hay muy pocas), lo que sobra se reparte entre las demás.
    // Sin esto la encuesta más reciente se comía la media y la hacía bailar con cada publicación.
    const tope = Math.max(0.25, 1.5 / Math.max(usadas.length, 1));
    for (let it = 0; it < 10; it++) {
      const tot = usadas.reduce((a, e) => a + e.peso, 0) || 1;
      const exceso = usadas.filter((e) => e.peso / tot > tope + 1e-9);
      if (!exceso.length) break;
      const libres = usadas.filter((e) => e.peso / tot <= tope + 1e-9), totLibres = libres.reduce((a, e) => a + e.peso, 0);
      if (!totLibres) break;
      const fijo = exceso.length * tope, escala = (1 - fijo) / (totLibres / tot);
      for (const e of exceso) e.peso = tope * tot;
      for (const e of libres) e.peso = e.peso * escala;
    }
    const suma = {}, pesos = {};
    for (const e of usadas) {
      const sg = opciones.sesgos && opciones.sesgos[e.clave] ? opciones.sesgos[e.clave].sesgo : null;
      for (const [p, v] of Object.entries(e.pct)) { const vc = sg && sg[p] != null ? v - sg[p] : v; suma[p] = (suma[p] || 0) + vc * e.peso; pesos[p] = (pesos[p] || 0) + e.peso; }
    }
    const media = {};
    for (const p of Object.keys(suma)) media[p] = suma[p] / pesos[p];
    const total = usadas.reduce((a, e) => a + e.peso, 0) || 1;
    return { media, usadas: usadas.map((e) => ({ ...e, peso_pct: e.peso / total })).sort((a, b) => b.peso - a.peso), ventana, semivida };
  }

  const api = { calcMedia, ventanaAdaptativa, factorAcierto, fechaD, DIA };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.Media = api;
})(typeof window !== "undefined" ? window : globalThis);
