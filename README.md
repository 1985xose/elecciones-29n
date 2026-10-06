# Panel 29N

Panel personal de seguimiento de las elecciones generales del 29 de noviembre de 2026. Web estática en GitHub Pages, datos actualizados cada hora por GitHub Actions.

## Qué hay

| Ruta | Qué hace |
|---|---|
| `index.html`, `assets/` | El panel. `assets/modelo.js` es el motor de escaños (swing proporcional por provincia + D'Hondt 3%) |
| `data/base2023.json` | Resultados 23J por provincia y escaños 2026 (RD 806/2026). Validado, reproduce el reparto real en 51 de 52 provincias |
| `data/config.json` | Partidos, colores, búsquedas de noticias, artículos de Wikipedia de cada líder, usuario del bot |
| `data/agenda.json` | Calendario electoral |
| `data/programas.json` | Comparativa de programas, se rellena a mano cuando se publiquen |
| `data/resultados.json` | Si existe con `{"escrutado": 87.5, "escanos": {...}}`, la portada pasa a mostrar resultados |
| `scripts/encuestas.py` | Encuestas desde Wikipedia, avisa por Telegram de las nuevas |
| `scripts/fiabilidad.py` | Ranking de acierto de encuestadoras en 23J-2023 y 10N-2019 |
| `scripts/noticias.py` | Titulares por partido y verificaciones de Newtral y Maldita (Google News RSS) |
| `scripts/atencion.py` | Visitas diarias a la Wikipedia de cada líder |
| `scripts/telegram_bot.py` | Porra por Telegram, comandos /porra, /mia, /ayuda |

## Secretos del repo (opcionales, para Telegram)

`TELEGRAM_TOKEN` y `TELEGRAM_CHAT_ID`. Sin ellos todo funciona menos los avisos y la porra.
