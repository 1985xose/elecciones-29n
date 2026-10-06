# Panel 29N

Panel personal de las elecciones generales del 29 de noviembre de 2026, con un modelo de probabilidades. Web estática en GitHub Pages, datos cada hora por GitHub Actions. Instalable como app en el móvil.

## Cómo funciona el modelo

1. **Media de encuestas.** Última encuesta de cada empresa, ponderada por antigüedad, entrevistas y acierto histórico, corregida por el sesgo de casa y con un tope del 25 % al peso de una sola encuesta. La ventana se estrecha al acercarse la votación, 30 días en precampaña (semivida 14), 14 en campaña (semivida 7) y 10 la última semana (semivida 5). La calibración del error y el backtest usan la misma regla.
2. **Error calibrado.** Con lo que fallaron las medias de encuestas en 2016, abril y noviembre de 2019 y 2023 (`fiabilidad.py` guarda los históricos). Suelo del 6 % del voto, techo para partidos pequeños, más incertidumbre cuanto más lejos esté la votación.
3. **10.000 simulaciones.** Error correlacionado por bloques (derecha, izquierda, territoriales, rho 0,55), ruido provincial del 5 %, swing proporcional por provincia sobre el 23J y D'Hondt con los escaños del RD 806/2026.
4. **Salidas.** Probabilidad de cada escenario (`config.json` > `escenarios`), abanicos de escaños, provincia bisagra, provincias en el aire, puntos de margen, y un backtest sobre 2023 con la base de 2019.
5. **Análisis de encuestas.** Sesgo de casa de cada empresa frente a la media del momento, notas de A a D por acierto histórico, y veredicto de noticia o ruido para cada encuesta nueva.

## Ficheros

| Ruta | Qué hace |
|---|---|
| `index.html`, `assets/` | El panel. `modelo.js` motor de escaños, `media.js` media de encuestas (ambos compartidos con Node) |
| `data/base2023.json`, `data/base2019.json` | Resultados por provincia. 2019 sirve para el backtest |
| `data/config.json` | Partidos, colores, escenarios, búsquedas, líderes, bot |
| `scripts/encuestas.py` | Encuestas desde Wikipedia, avisa por Telegram de las nuevas |
| `scripts/fiabilidad.py` | Ranking de acierto e históricos de 2019 y 2023 |
| `scripts/simular.js` | Modelo de probabilidades, backtest y análisis de encuestas |
| `scripts/noticias.py`, `scripts/atencion.py` | Titulares, verificaciones, visitas a Wikipedia |
| `scripts/telegram_bot.py`, `scripts/resumen_diario.py` | Porra y resumen de la mañana por Telegram |
| `manifest.json`, `sw.js` | App instalable |

## Secretos del repo (opcionales)

`TELEGRAM_TOKEN` y `TELEGRAM_CHAT_ID`. Sin ellos funciona todo menos los avisos, la porra y el resumen diario.
