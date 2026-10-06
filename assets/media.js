/* Media ponderada de encuestas. Compartida por el navegador y por el simulador en Node. */
(function (root) {
  const DIA = 86400000;
  const fechaD = (s) => new Date(s + "T12:00:00Z");

  /* Cuánto pesa una empresa por su acierto pasado. Una empresa sin historial cuenta como una empresa normal
     (sinHistorial, la mediana de las que sí tienen nota y están en la media), no como la mejor.
     Medido en 2019 y 2023: las debutantes fallaron lo mismo que las veteranas, 1,69 puntos de mediana frente a 1,65. */
  function factorAcierto(clave, ranking, sinHistorial = 1) {
    const r = ranking && ranking.find((x) => x.clave === clave);
    return r ? Math.min(1.4, Math.max(0.6, 1.6 / (0.6 + r.error_medio))) : sinHistorial;
  }

  /* Encuestas hechas o encargadas por un partido. Se enseñan, pero no entran en la media. */
  const PARTIDOS = new Set(["pp", "psoe", "vox", "sumar", "podemos", "unidaspodemos", "unidospodemos", "up", "cs", "ciudadanos", "iu", "izquierdaunida",
    "erc", "junts", "jxcat", "pdecat", "cdc", "pnv", "eajpnv", "ehbildu", "bildu", "bng", "cc", "cca", "coalicioncanaria", "upn", "salf",
    "maspais", "compromis", "cup", "upyd", "aliancacatalana"]);
  const normal = (t) => String(t || "").replace(/\(.*?\)|\[.*?\]/g, "").toLowerCase().normalize("NFD").replace(/[^a-z0-9]/g, "");
  function esDePartido(e) {
    return PARTIDOS.has(e.clave) || String(e.empresa || e.empresa_base || "").split("/").some((x) => PARTIDOS.has(normal(x)));
  }

  /* Hasta cuántos días atrás cuenta la última encuesta de cada empresa (ventana) y con qué rapidez pierde peso (caida),
     según lo que falte para votar. El peso de una encuesta es exp(-antigüedad / caida), o sea que se queda en la mitad
     cada caida x 0,69 días (10 días en precampaña, 5 en campaña, 3 y medio la última semana).
     La antigüedad se cuenta desde el final del trabajo de campo, que es la fecha que da Wikipedia. Las encuestas se publican
     entre 3 y 7 días después y las empresas mensuales tardan de 30 a 42 días en sacar la siguiente, así que con un tope de
     30 días una empresa seria se quedaba fuera cada mes hasta su siguiente encuesta. Por eso el tope es el doble (60, 28 y 20).
     Medido en 2016, 2019 y 2023: el acierto es el mismo con tope 30 que con 60 (3,29 y 3,32 puntos a 54 días, 1,96 a 6 días)
     y la media da menos saltos por empresas que entran y salen.
     La última fase cubre también los 5 días en que la ley prohíbe publicar encuestas. */
  const PRECAMPANA = { ventana: 60, caida: 14 };
  function ventanaAdaptativa(fecha, fechaEleccion) {
    const dias = Math.round((fechaEleccion - fecha) / DIA);
    const r = dias > 16 ? { ...PRECAMPANA, fase: "precampaña" } : dias > 7 ? { ventana: 28, caida: 7, fase: "campaña" } : { ventana: 20, caida: 5, fase: "última semana" };
    return { ...r, mitad: +(r.caida * Math.LN2).toFixed(1), dias };
  }

  /* encuestas: [{clave, fin, muestra, pct}], fecha: Date,
     opciones: {ventana, caida, incluirCIS, ranking, excluirClave, sesgos: {clave: {sesgo: {partido: puntos}}}}
     Si hay sesgos, a cada encuesta se le resta lo que esa empresa suele dar de más o de menos respecto a la media. */
  function calcMedia(encuestas, fecha, opciones = {}) {
    const ventana = opciones.ventana || PRECAMPANA.ventana, caida = opciones.caida || PRECAMPANA.caida;
    const elegir = (v) => {
      const ult = {};
      for (const e of encuestas) {
        const edad = (fecha - fechaD(e.fin)) / DIA;
        if (edad < 0 || edad > v) continue;
        if (!opciones.incluirCIS && e.clave === "cis") continue;
        if (opciones.excluirClave && e.clave === opciones.excluirClave) continue;
        if (esDePartido(e)) continue;
        if (!ult[e.clave] || ult[e.clave].fin < e.fin) ult[e.clave] = e;
      }
      return Object.values(ult);
    };
    let usadas = elegir(ventana);
    if (usadas.length < 4) usadas = elegir(ventana * 2);
    // Peso bruto de cada encuesta: más reciente, más entrevistas y empresa más acertada pesan más
    const conNota = usadas.filter((e) => opciones.ranking && opciones.ranking.some((x) => x.clave === e.clave)).map((e) => factorAcierto(e.clave, opciones.ranking)).sort((x, y) => x - y);
    const sinHistorial = conNota.length ? (conNota[(conNota.length - 1) >> 1] + conNota[conNota.length >> 1]) / 2 : 1;
    for (const e of usadas) {
      const edad = (fecha - fechaD(e.fin)) / DIA;
      e.peso = Math.exp(-edad / caida) * Math.sqrt(Math.min(e.muestra || 1000, 5000) / 1000) * factorAcierto(e.clave, opciones.ranking, sinHistorial);
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
    return { media, usadas: usadas.map((e) => ({ ...e, peso_pct: e.peso / total })).sort((a, b) => b.peso - a.peso), ventana, caida };
  }

  const api = { calcMedia, ventanaAdaptativa, factorAcierto, esDePartido, PRECAMPANA, fechaD, DIA };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.Media = api;
})(typeof window !== "undefined" ? window : globalThis);
