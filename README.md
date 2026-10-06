# Panel 29N

Panel personal de las elecciones generales del 29 de noviembre de 2026, con un modelo de probabilidades. Web estática en GitHub Pages, datos cada hora por GitHub Actions. Instalable como app en el móvil.

## Cómo funciona el modelo

1. **Media de encuestas.** Última encuesta de cada empresa, ponderada por antigüedad, entrevistas y acierto histórico, corregida por el sesgo de casa y con un tope del 25 % al peso de una sola encuesta. La antigüedad se cuenta desde el final del trabajo de campo, que es la fecha que da Wikipedia (se publican entre 3 y 7 días después). Cuenta la última de cada empresa hasta 60 días atrás en precampaña, 28 en campaña y 20 la última semana, y el peso se queda en la mitad cada 10, 5 y 3,5 días (exp(-días/14), /7 y /5). El tope es el doble del que había (30, 14 y 10) porque las empresas mensuales tardan de 30 a 42 días en sacar la siguiente y se quedaban fuera cada mes. Medido en 2016, 2019 y 2023, el acierto es el mismo (3,29 y 3,32 puntos a 54 días, 1,96 a 6) y la media da menos saltos. Una empresa sin historial pesa como la mediana de las que tienen nota (medido, las debutantes de 2019 y 2023 fallaron lo mismo que las veteranas, 1,69 frente a 1,65 puntos). Las encuestas hechas o encargadas por un partido no entran. La calibración del error y el backtest usan la misma regla.
2. **Error calibrado.** Con lo que fallaron las medias de encuestas en 2016, abril y noviembre de 2019 y 2023, medido a la misma distancia de la votación (a 54 días el error es 1,68 veces el de 6 días) (`fiabilidad.py` guarda los históricos). Suelo del 6 % del voto, techo para partidos pequeños, más incertidumbre cuanto más lejos esté la votación.
3. **10.000 simulaciones.** Error correlacionado por bloques (rho 0,55, probado de 0,30 a 0,80 sin cambio relevante), ruido territorial medido entre 2019 y 2023 (17,3 % por comunidad, 8,5 % por provincia, reajustado para no mover el total nacional), swing proporcional por provincia sobre el 23J con Sumar, Podemos y SALF repartidos según las europeas de 2024, y D'Hondt con los escaños del RD 806/2026.
4. **Salidas.** Probabilidad de cada escenario (`config.json` > `escenarios`), abanicos de escaños, provincia bisagra, provincias en el aire, puntos de margen, y un backtest sobre 2023 con la base de 2019.
5. **Análisis de encuestas.** Sesgo de casa de cada empresa frente a la media del momento, notas de A a D por acierto histórico, y veredicto de noticia o ruido para cada encuesta nueva.

## Ficheros

| Ruta | Qué hace |
|---|---|
| `index.html`, `assets/` | El panel. `modelo.js` motor de escaños, `media.js` media de encuestas (ambos compartidos con Node) |
| `data/base2023.json`, `data/base2019.json` | Resultados por provincia. 2019 sirve para el backtest |
| `data/config.json` | Partidos, colores, escenarios, búsquedas, líderes, bot |
| `scripts/encuestas.py` | Encuestas desde Wikipedia con validación dura. Imprime en el log una tabla por empresa (total, último año, última fecha, días sin publicar) para ver si falta alguna |
| `scripts/fiabilidad.py` | Ranking de acierto e históricos de 2019 y 2023 |
| `scripts/simular.js` | Modelo de probabilidades, backtest y análisis de encuestas |
| `scripts/noticias.py`, `scripts/atencion.py` | Titulares del día con foto desde los RSS de los periódicos (`config.json` > `medios`, el log dice cuáles responden y cuántos traen foto), titulares por partido, polémicas y verificaciones desde Google News. Visitas a Wikipedia |
| `scripts/telegram_bot.py`, `scripts/resumen_diario.py` | Porra y resumen de la mañana por Telegram |
| `manifest.json`, `sw.js` | App instalable |

## Secretos del repo (opcionales)

`TELEGRAM_TOKEN` y `TELEGRAM_CHAT_ID`. Sin ellos funciona todo menos los avisos, la porra y el resumen diario.
