# Panel 29N

Panel personal de las elecciones generales del 29 de noviembre de 2026, con un modelo de probabilidades. Web estática en GitHub Pages, datos cada hora por GitHub Actions. Instalable como app en el móvil.

## Cómo funciona el modelo

1. **Media de encuestas.** Última encuesta de cada empresa, ponderada por antigüedad, entrevistas y acierto histórico, corregida por el sesgo de casa y con un tope del 25 % al peso de una sola encuesta. La antigüedad se cuenta desde el final del trabajo de campo, que es la fecha que da Wikipedia (se publican entre 3 y 7 días después). Cuenta la última de cada empresa hasta 60 días atrás en precampaña, 28 en campaña y 20 la última semana, y el peso se queda en la mitad cada 10, 5 y 3,5 días (exp(-días/14), /7 y /5). El tope es el doble del que había (30, 14 y 10) porque las empresas mensuales tardan de 30 a 42 días en sacar la siguiente y se quedaban fuera cada mes. Medido en 2016, 2019 y 2023, el acierto es el mismo (3,29 y 3,32 puntos a 54 días, 1,96 a 6) y la media da menos saltos. Una empresa sin historial pesa como la mediana de las que tienen nota (medido, las debutantes de 2019 y 2023 fallaron lo mismo que las veteranas, 1,69 frente a 1,65 puntos). Las encuestas hechas o encargadas por un partido no entran. La calibración del error y el backtest usan la misma regla.
2. **Error calibrado.** Con lo que fallaron las medias de encuestas en 2016, abril y noviembre de 2019 y 2023, medido a la misma distancia de la votación (a 54 días el error es 1,68 veces el de 6 días) (`fiabilidad.py` guarda los históricos). Suelo del 6 % del voto, techo para partidos pequeños, más incertidumbre cuanto más lejos esté la votación.
3. **10.000 simulaciones.** Error correlacionado por bloques (rho 0,55, probado de 0,30 a 0,80 sin cambio relevante), ruido territorial medido entre 2019 y 2023 (17,3 % por comunidad, 8,5 % por provincia, reajustado para no mover el total nacional), swing proporcional por provincia sobre el 23J con Sumar, Podemos y SALF repartidos según las europeas de 2024, y D'Hondt con los escaños del RD 806/2026.
4. **Salidas.** Probabilidad de cada escenario (`config.json` > `escenarios`), abanicos de escaños, provincia bisagra, provincias en el aire, puntos de margen, y un backtest sobre 2023 con la base de 2019.
5. **Análisis de encuestas.** Sesgo de casa de cada empresa frente a la media del momento, notas de A a D por acierto histórico, y veredicto de noticia o ruido para cada encuesta nueva.

Las visitas se cuentan con GoatCounter (cuenta `xose`, panel en https://xose.goatcounter.com), sin cookies. La línea está en `index.html` y los apuntes de pestañas y usos en `contar()` de `app.js`. Al final de Metodología hay una puerta «Visitas» que pide una clave de GoatCounter con permiso solo de lectura. La clave se guarda en el navegador del dispositivo, nunca en el repositorio. Con ella la app lee las cifras y las enseña arriba de Metodología, y ese dispositivo deja de contar como visita (bloque «Visitas, solo para quien hace la app» de `app.js`). GoatCounter admite 4 peticiones por segundo y el navegador gasta dos por lectura, así que el panel lee en fila con un respiro entre lecturas y reintenta si choca. Para saber de dónde llega la gente cuando el enlace se abre desde una app (que no dice el origen), se reparte con una etiqueta: `https://1985xose.github.io/elecciones-29n/?ref=instagram`. Desde la versión 46 se cuentan además personas (dispositivos), no solo entradas: cada dispositivo guarda en sí mismo la fecha de su primera y su última visita (`visto` y `visto-dia`, sin identificador) y avisa al contador como mucho una vez al día con «Persona nueva», «Persona de antes», «Persona vuelve N» (N días desde la visita anterior, de 1 a 7) o «Persona sin memoria». Con eso el panel calcula personas distintas de hoy, de 7 días y del total sin repetir a nadie (`contarPersona()` y `visDistintas()` en `app.js`). Entrar con `#no-contar` hace que el dispositivo deje de contarse.

## Ficheros

| Ruta | Qué hace |
|---|---|
| `index.html`, `assets/` | El panel. `modelo.js` motor de escaños (con `fundir` para juntar listas provincia a provincia, que usa «monta tu caso» en ¿Y si…?), `media.js` media de encuestas (ambos compartidos con Node) |
| `data/base2023.json`, `data/base2019.json` | Resultados por provincia. 2019 sirve para el backtest |
| `data/config.json` | Partidos, colores, escenarios, búsquedas, líderes, bot |
| `scripts/encuestas.py` | Encuestas desde Wikipedia con validación dura. Imprime en el log una tabla por empresa (total, último año, última fecha, días sin publicar) para ver si falta alguna |
| `scripts/fiabilidad.py` | Ranking de acierto e históricos de 2019 y 2023 |
| `scripts/simular.js` | Modelo de probabilidades, backtest y análisis de encuestas |
| `scripts/noticias.py` | Titulares del día con foto desde los RSS de los periódicos (`config.json` > `medios`, cada uno con su grupo y una o varias direcciones que se prueban por orden; el log dice cuáles responden y cuántos traen foto). Antes se quitan las secciones que no son información política (`secciones_fuera`: deportes, opinión, internacional...) y las encuestas de «vota aquí» (`titulos_fuera`). Un titular entra si lleva una palabra que solo se usa hablando de elecciones (`portada_seguras`) o si nombra en el propio titular a un partido, un dirigente o una institución (`portada_nombres`, `portada_claves` y los `nombres` de cada partido). Las palabras que también valen para el fútbol o la tele (`portada_fuertes`: encuesta, debate, campaña) solo cuentan con ese nombre en el titular. Se eligen por turnos entre grupos y sin repetir medio, titulares por partido, polémicas y verificaciones desde Google News (un titular solo se apunta a un partido si lo nombra en el titular, `config.json` > `partidos` > `nombres`, y solo es polémica si además lleva una palabra de `polemicas_titular`). |
| `scripts/telegram_bot.py`, `scripts/resumen_diario.py` | Vigilante del robot con avisos por Telegram solo para el dueño, y resumen de la mañana |
| `manifest.json`, `sw.js` | App instalable |

## Secretos del repo (opcionales)

`TELEGRAM_TOKEN` (el del bot, de @BotFather) y `TELEGRAM_CHAT_ID` (el número de chat del dueño). Sin ellos funciona todo menos los avisos y el resumen diario. El bot solo escribe a ese chat y solo atiende mensajes de ese chat (`/estado`, `/ayuda`), una vez por hora. Lo que escriba cualquier otra persona se ignora.

## Cómo enterarse de que algo falla

- **Parte del robot.** Cada paso (encuestas, notas de las empresas, simulación, noticias) apunta en `data/estado.json` si ha ido bien, a qué hora y, si no, por qué (`apuntar_estado` y `con_parte` en `comun.py`, `apuntarEstado` en `simular.js`). Se ve en el panel privado de la app, apartado «Estado del robot». Un paso que no da señales en 3 horas (6 las noticias, 30 las notas) cuenta como caído.
- **Telegram.** `telegram_bot.py` lee ese parte al final de cada pasada y avisa una vez cuando un paso pasa de bien a mal, lo recuerda cada 12 horas y avisa cuando se arregla. Además llegan las encuestas nuevas y el resumen de las 7:00 UTC.
- **Correo de GitHub.** Si la lectura de encuestas no pasa la validación, la ejecución acaba en rojo aunque el resto de pasos siga.
- **Aviso en la app.** Arriba, para todo el mundo, si encuestas, probabilidades o titulares se quedan atrás.
- **Fallos en el dispositivo de un visitante.** `apuntarError` en `app.js` los manda al contador como «Error vNN fichero:línea mensaje», máximo 3 por carga. Se ven en el panel privado, apartado «Fallos en la app».

Si un partido anuncia que no se presenta, se marca en `data/config.json` con `"no_concurre": { "fecha": "AAAA-MM-DD", "fuente": "enlace" }` dentro de su ficha. Sale de la media (`calcMedia`, opción `fuera`), del reparto y de la simulación, y en Encuestas aparece una nota que lo explica. Sus votos no se le dan a nadie. Primer caso, Aliança Catalana, anunciado el 5 de octubre de 2026.

Escudo del lector de encuestas (`scripts/encuestas.py`): solo cuentan como partido las claves de `data/config.json`. Una columna desconocida de la tabla de Wikipedia se ignora, se apunta en el log y en `columnas_ignoradas`, y nunca llega a la app. La lectura se descarta entera, conservando los datos anteriores, si un partido conocido desaparece de 5 o más encuestas que ya estaban leídas (columna renombrada), si cambian 3 puntos o más los números de 5 o más encuestas ya leídas (columnas movidas) o si una encuesta nueva trae una columna desconocida y le falta un partido habitual. `frenteamplio` entra como `Sumar` hasta que la app cambie el nombre. Un aviso por partido se pone en su ficha de `config.json` con `"aviso": { "texto", "fecha", "fuente" }`.

La librería de gráficas (Chart.js 4.4.1, licencia MIT) va dentro del repo, en `assets/chart.umd.js`, y no se pide a ningún servidor externo. Si aun así no carga, cada gráfica se cambia por una línea que lo dice y el resto de la app sigue.

La hora «actualizado» de la cabecera es la de la última lectura buena de encuestas. La app avisa por separado si se quedan atrás las encuestas (más de 3 horas), las probabilidades (más de 3) o los titulares (más de 6). `noticias.py` no renueva su hora si no ha respondido ninguna fuente.

`data/agenda.json`: cada hito lleva `fecha`, `titulo` y, si es un plazo, `fin`. Los plazos cuyo último día importa llevan además `fin_titulo`, y ese día sale como hito propio en «Lo siguiente en el calendario».

Tramos de la gráfica de Encuestas (`rangoTendencia()` en `app.js`): toda la legislatura, último año, 3 meses, desde la convocatoria (la fecha sale de `agenda.json`) y dos fechas a elegir entre el 3 de septiembre de 2023 y hoy. Hasta 130 días se pinta un punto por día, hasta 500 uno cada 3 días y más allá uno por semana.

«Qué te toca hacer» (pestaña 29N y última línea del resumen de Hoy) sale de `data/config.json` > `tareas`. Cada trámite lleva `grupo` (`todos`, `correo` o `fuera`), `que`, `como`, `desde`, `hasta` y, si hace falta, `enlace`. Con `sin_plazo` el tramo no es un plazo del votante (el sorteo de mesas, las tarjetas censales) y con `cuando` se escribe a mano el texto de las fechas. El estado de cada uno (dentro de N días, abierto, último día, cerrado) lo calcula `pintarTareas()` con la fecha de hoy. Si la Junta Electoral cambia un plazo, se toca ahí y en `agenda.json`.

Enlaces directos: `?partido=sumar` abre la app centrada en ese partido y `?provincia=madrid` abre la ficha de esa provincia. Se pueden combinar entre sí, con `?ref=` y con la pestaña (`?partido=vox&ref=x#encuestas`). Valen para esa visita y no se guardan en el dispositivo. Los genera la propia app con los botones «Copiar enlace» de la fila de partidos y de la ficha de provincia (`enlaceA()` y `leerEnlace()` en `app.js`).

Un aviso sobre un partido (`config.json` > `partidos` > `aviso`, con `texto`, `fecha` y `fuente`) sale bajo la fila de partidos cuando ese partido está elegido, bajo la lista de Encuestas, y con una marca junto a su nombre en esa lista.

Margen de error de cada partido (`sigmas()` en `scripts/simular.js`). Primero se mide la curva de tamaño con todos los partidos de las elecciones históricas (unos 50 casos): margen = A × media^B, con el mismo exponente B para todos y un nivel A para los partidos estatales y otro para los de un solo territorio (`curvaTamano()`). Después, para cada partido, sus errores históricos se llevan a su tamaño de hoy con esa curva y se mezclan con el margen típico de su tamaño, que pesa como cuatro elecciones (`PESO_CURVA`). Un partido sin historial lleva solo el margen típico de los estatales. `HISTORIA` dice con qué nombre salía antes cada partido. Sustituye a la regla anterior, que usaba el error propio con un suelo fijo de 0,4 puntos. Probadas las dos dejando cada elección fuera y calculando con las otras tres, el error real fue 1,34 veces el margen en los estatales y 0,67 en los territoriales con la regla vieja, y 1,10 y 1,01 con la nueva. El resultado va en `probabilidades.json` > `calibracion` (errores, errores llevados a su tamaño, margen típico y grupo de cada partido) y `curva`.

Ruido territorial (`RUIDO` en `simular.js`): 17,3 % por comunidad y 8,5 % por provincia, medidos entre 2019 y 2023, con una parte común a todos los partidos estatales (`comun`, correlación 0,36 medida en el mismo periodo). El simulador rápido de ¿Y si…? en `app.js` (`probabilidadSim()`) usa lo mismo, leído de `probabilidades.json` > `ruido`.

Senado: `data/config.json` > `senado` lleva los senadores que designan las comunidades, por partido, con fecha y fuente. La mayoría absoluta se calcula sobre toda la cámara (208 elegidos más los designados). `simular.js` da la probabilidad de mayoría de cada partido contando sus designados (`senado`), la de las coaliciones del Congreso (`senado_escenarios`) y la mayoría que ha usado (`senado_mayoria`). Si la app ve que ese número no coincide con el de `config.json`, no enseña probabilidades hasta la siguiente pasada del robot. Si una comunidad cambia sus designados, se toca `config.json` y nada más.

Polémicas (`ordenar_polemicas()` en `scripts/noticias.py`): solo las de los últimos 7 días (Google News cuela cosas de hace meses aunque se le pida la última semana), apuntadas al partido al que afectan y no al que las denuncia (`papeles()` mira si el partido va detrás de «investigar a», «condena a», «pide a»… o si es el que denuncia, pide o ejerce la acusación popular), sin titulares repetidos, con una sola por historia y partido (dos titulares del mismo partido que comparten dos palabras propias) y como mucho 4 por partido. El log dice cuántas se quedan fuera y por qué.

Versión 53, pulido:
- Las restas entre porcentajes se hacen con los números tal como se leen en pantalla (`dif1()` en `app.js`), y «igual que la semana pasada» quiere decir en todas partes que los dos números que se ven son el mismo.
- ¿Y si…? solo repite las elecciones en el dispositivo cuando se toca algo. Sin tocar nada enseña las cifras del robot.
- El service worker guarda una copia por fichero, sin lo que va detrás de «?». Antes acumulaba una copia de cada dato en cada visita.
- Texto sobre color de partido: `sobre()` elige blanco o tinta oscura según se lea mejor, y si ninguno llega a un contraste de 4,5 oscurece el fondo lo justo. El bronce que va como texto es `--bronce-texto`.
- Teclado: las provincias de los mapas y las tarjetas de encuestas reciben el foco y se activan con Intro o con la barra.
- «Desde tu última visita» (`pintarDesde()`): la app guarda en el dispositivo (clave `visita`) la media, los asientos, la probabilidad del bloque que va delante y las encuestas de los últimos 60 días, y al volver otro día dice qué ha cambiado. No sale del dispositivo.
- Sin `encuestas.json` la app enseña el resultado de 2023, y ahora lo dice en un aviso arriba y en la primera respuesta.
- El robot usa el día de Madrid (`diaMadrid()` en `simular.js`, `hoy_madrid()` en `comun.py`), no el de la hora universal.
- En el histórico de 2023 Podemos se suma a Sumar antes de calcular nada, porque acabaron en la misma lista y hasta junio las encuestas los daban por separado.
- Las estimaciones que otras empresas hacen con los datos del CIS («CIS (SocioMétrica)») llevan clave propia (`cis-…`) y no cuentan como encuestas del CIS para su nota. Tampoco entran en la media (`esCIS()` en `media.js`).
- Flujo de GitHub: si al guardar los datos hay conflicto, solo se reponen los ficheros que chocan, no la carpeta `data/` entera.
