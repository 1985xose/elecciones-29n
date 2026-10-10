"""Descarga las encuestas de Wikipedia, detecta las nuevas y avisa por Telegram."""
import re, sys
from collections import Counter
from datetime import date, timedelta
from comun import leer, escribir, ahora_iso, clave_empresa, telegram_enviar, apuntar_estado, con_parte, hoy_madrid
from wikitabla import html_pagina, parsear_tablas

PAGINA = "Opinion polling for the next Spanish general election"

# La misma casa demoscópica con otro nombre según la época, para que conserve su nota de acierto
EQUIVALENCIAS = {"emanalytics": "electopanel", "emanalyticselectomania": "electopanel", "electomania": "electopanel",
                 "sociometricaelespanol": "sociometrica", "40dbprisa": "40db", "sigmadoselmundo": "sigmados",
                 "ncreportlarazon": "ncreport", "gad3abc": "gad3", "simplelogicaelindependiente": "simplelogica",
                 "demoscopiayservicios": "demoscopiaservicios"}


def limpia(k):
    """Nombre de una columna desconocida, recortado y sin nada que no sea letra, número o signo corriente, para poder
    escribirlo en el log, en el aviso y en el fichero sin arrastrar lo que alguien haya metido en Wikipedia."""
    return re.sub(r"[^\w .+·'-]", "?", str(k))[:40]


def tabla_empresas(encuestas, hoy=None):
    """Una línea por empresa con cuántas encuestas tiene, la fecha de la última (fin del trabajo de campo) y los días que
    lleva sin publicar. Sirve para ver en el log de un vistazo si falta alguna empresa o si una habitual se ha quedado atrás."""
    hoy = hoy or hoy_madrid()
    por = {}
    for e in encuestas:
        por.setdefault(e["clave"], []).append(e)
    filas = []
    for clave, lista in por.items():
        fechas = sorted(date.fromisoformat(e["fin"]) for e in lista)
        saltos = sorted((b - a).days for a, b in zip(fechas, fechas[1:]))
        habitual = saltos[len(saltos) // 2] if saltos else None
        sin = (hoy - fechas[-1]).days
        ultimo_anio = sum(1 for f in fechas if (hoy - f).days <= 365)
        aviso = "  <- lleva más del doble de lo habitual sin publicar" if habitual and len(fechas) >= 4 and ultimo_anio and sin > max(45, 2 * habitual) else ""
        filas.append((sin, f"   {lista[0]['empresa_base'][:24]:<25}{len(fechas):>4}{ultimo_anio:>6}   {fechas[-1].isoformat()}{sin:>6}{(str(habitual) if habitual else '-'):>10}{aviso}"))
    print(f"Empresas en la tabla: {len(por)}")
    print(f"   {'empresa':<25}{'total':>4}{'año':>6}   {'última':<10}{'días':>6}{'habitual':>10}")
    for _, linea in sorted(filas):
        print(linea)


def main():
    titulo, revid, html = html_pagina(PAGINA)
    filas, partidos = parsear_tablas(html, anio_defecto=hoy_madrid().year)
    previo = leer("encuestas.json", {}) or {}
    primera = {e["id"]: e.get("primera_vez") for e in previo.get("encuestas", [])}
    # Si a una empresa se le cambia la clave (equivalencias), su encuesta sigue siendo la misma y no es "nueva"
    primera_firma = {(e["empresa"], e["fin"], e.get("muestra")): e.get("primera_vez") for e in previo.get("encuestas", [])}
    encuestas, nuevas = [], []
    for f in filas:
        if f.get("es_resultado"):
            continue
        if re.match(r"^CIS\s*\(", f["empresa"]):  # reproyecciones de terceros con datos del CIS
            continue
        clave, base = clave_empresa(f["empresa"])
        clave = EQUIVALENCIAS.get(clave, clave)
        f["empresa_base"], f["clave"] = base, clave
        f["encargo"] = f["empresa"].split("/", 1)[1].strip() if "/" in f["empresa"] else ""
        f["id"] = f"{clave}-{f['fin']}-{f.get('muestra') or 0}"
        f.pop("es_resultado", None)
        if f["id"] in primera:
            f["primera_vez"] = primera[f["id"]]
        elif (f["empresa"], f["fin"], f.get("muestra")) in primera_firma:
            f["primera_vez"] = primera_firma[(f["empresa"], f["fin"], f.get("muestra"))]
        else:
            f["primera_vez"] = ahora_iso()
            if previo:  # en la primera ejecución no se considera nada "nuevo"
                nuevas.append(f)
        encuestas.append(f)
    # Duplicados exactos (misma empresa, fecha y muestra) se quedan una vez
    vistos, unicas = set(), []
    for e in encuestas:
        if e["id"] not in vistos:
            vistos.add(e["id"]); unicas.append(e)
    unicas.sort(key=lambda e: e["fin"], reverse=True)

    print(f"Página: {titulo} (rev {revid})")
    print(f"Partidos detectados en cabecera: {partidos}")
    print(f"Encuestas leídas: {len(unicas)}  nuevas: {len(nuevas)}")
    if unicas:
        e = unicas[0]
        print(f"Más reciente: {e['empresa']} | {e['inicio']} a {e['fin']} | n={e['muestra']} | {e['pct']} | escaños {e['escanos']}")
        tabla_empresas(unicas)

    # ---- Escudo de partidos ----
    # Solo cuentan como partido los que están en config.json. Cualquier otra cabecera de la tabla (un partido nuevo, un
    # nombre cambiado, una errata o un destrozo en Wikipedia) se ignora y se apunta, y nunca llega a la app.
    config = leer("config.json", {}) or {}
    conocidos = set((config.get("partidos") or {}).keys())
    ignoradas = Counter()
    for e in unicas:
        raras = [k for k in (e.get("pct") or {}) if k not in conocidos]
        if raras:
            e["_raras"] = [limpia(k) for k in raras]
        for campo in ("pct", "escanos"):
            for k in [k for k in (e.get(campo) or {}) if k not in conocidos]:
                ignoradas[k] += 1
                del e[campo][k]
    partidos = [k for k in partidos if k in conocidos]
    ya_ignoradas = set(previo.get("columnas_ignoradas") or [])
    if ignoradas:
        print("Columnas que no son ningún partido de config.json y se ignoran: " + ", ".join(f"«{limpia(k)}» ({n} encuestas)" for k, n in ignoradas.most_common()))
        nuevas_raras = [limpia(k) for k in ignoradas if limpia(k) not in ya_ignoradas]
        if nuevas_raras:
            telegram_enviar("Panel 29N: la tabla de encuestas trae columnas nuevas que no conozco y las ignoro: " + ", ".join(nuevas_raras))

    # ---- Validación dura. Si algo no cuadra, se para y se conservan los datos anteriores ----
    problemas = []
    hoy = hoy_madrid()
    corte = (hoy - timedelta(days=60)).isoformat()
    antes_por_id = {e["id"]: e for e in previo.get("encuestas", [])}
    # 1. Un partido conocido que desaparece de encuestas que ya estaban leídas: le han cambiado el nombre a su columna.
    perdidas, movidas = Counter(), []
    for e in unicas:
        a = antes_por_id.get(e["id"])
        if not a:
            continue
        for k, v in (a.get("pct") or {}).items():
            if k not in conocidos:
                continue
            if k not in e["pct"]:
                perdidas[k] += 1
            elif abs(e["pct"][k] - v) >= 3:
                movidas.append(e); break
    for k, n in perdidas.items():
        if n >= 5:
            problemas.append(f"{k} ha desaparecido de {n} encuestas que ya estaban leídas, puede que Wikipedia le haya cambiado el nombre a su columna")
    # 2. Números que cambian de golpe en muchas encuestas ya leídas: se han movido las columnas.
    if len(movidas) >= 5:
        problemas.append(f"han cambiado 3 puntos o más los números de {len(movidas)} encuestas que ya estaban leídas, p. ej. {movidas[0]['empresa']} {movidas[0]['fin']}")
    elif movidas:
        print("Encuestas ya leídas a las que les han corregido algún número en 3 puntos o más: " + ", ".join(f"{e['empresa']} {e['fin']}" for e in movidas))
    # 3. Encuestas nuevas que traen una columna desconocida y a la vez les falta un partido que llevan casi todas las
    #    recientes: es el partido de siempre con otro nombre en una columna aparte.
    rec_antes = [e for e in previo.get("encuestas", []) if e["fin"] >= corte]
    if len(rec_antes) >= 8 and ignoradas:
        habituales = [k for k in conocidos if sum(1 for e in rec_antes if k in e["pct"]) >= 0.8 * len(rec_antes)]
        for e in unicas:
            if e["id"] in antes_por_id or e["fin"] < corte:
                continue
            faltan = [k for k in habituales if k not in e["pct"]]
            if faltan and e.get("_raras"):
                problemas.append(f"{e['empresa']} {e['fin']} no trae {', '.join(faltan)} y sí una columna desconocida ({', '.join(e['_raras'])})")
    if len(unicas) < 20:
        problemas.append(f"solo {len(unicas)} encuestas")
    anteriores = len(previo.get("encuestas", []))
    if anteriores and len(unicas) < anteriores * 0.8:
        problemas.append(f"han desaparecido encuestas, antes {anteriores} y ahora {len(unicas)}")
    recientes60 = [e for e in unicas if e["fin"] >= corte]
    for k in ("PP", "PSOE", "Vox"):
        if k not in partidos or (recientes60 and not any(k in e["pct"] for e in recientes60)):
            problemas.append(f"falta la columna {k}")
    # Porcentajes que no cuadran o fecha de fin que todavía no ha llegado
    futuras = [e for e in unicas if e["fin"] > (hoy + timedelta(days=1)).isoformat()]
    sospechosas = [e for e in unicas if not (70 <= sum(e["pct"].values()) <= 101) or any(v > 60 for v in e["pct"].values())]
    if len(sospechosas) > len(unicas) * 0.05:
        problemas.append(f"{len(sospechosas)} encuestas con porcentajes que no cuadran, p. ej. {sospechosas[0]['empresa']} {sospechosas[0]['fin']} {sospechosas[0]['pct']}")
    recientes = [e for e in unicas if e["fin"] >= str(hoy.replace(day=1))] if hoy.day > 10 else unicas[:1]
    if not recientes:
        problemas.append("ninguna encuesta de este mes, la tabla puede haber cambiado de sitio")
    if problemas:
        print("VALIDACIÓN FALLIDA, no se escribe nada y se conservan los datos anteriores:")
        for x in problemas:
            print("  -", x)
        # El aviso por Telegram no se manda desde aquí: lo manda el vigilante (telegram_bot.py) una sola vez cuando el
        # paso pasa de ir bien a ir mal, y otra cuando se arregla. Desde aquí saldría repetido cada hora.
        apuntar_estado("encuestas", False, "No se ha publicado la lectura. " + "; ".join(problemas),
                       {"ignoradas": sorted(limpia(k) for k in ignoradas)})
        sys.exit(1)
    # Las encuestas con porcentajes imposibles o con fecha futura se apartan en vez de contaminar la media, y se dice cuáles
    for e in sospechosas:
        print(f"Se aparta por porcentajes que no cuadran: {e['empresa']} {e['fin']} {e['pct']}")
    for e in futuras:
        print(f"Se aparta por fecha futura: {e['empresa']} {e['fin']}")
    apartadas = {id(e) for e in sospechosas + futuras}
    unicas = [e for e in unicas if id(e) not in apartadas]
    nuevas = [e for e in nuevas if id(e) not in apartadas]
    for e in unicas:
        e.pop("_raras", None)

    escribir("encuestas.json", {"actualizado": ahora_iso(), "fuente": f"https://en.wikipedia.org/wiki/{titulo.replace(' ', '_')}",
                                "revision": revid, "partidos": partidos, "columnas_ignoradas": sorted(limpia(k) for k in ignoradas), "encuestas": unicas})

    apuntar_estado("encuestas", True, f"{len(unicas)} encuestas leídas, {len(nuevas)} nuevas",
                   {"ignoradas": sorted(limpia(k) for k in ignoradas),
                    "apartadas": [f"{e['empresa']} {e['fin']}" for e in sospechosas + futuras][:10],
                    "corregidas": [f"{e['empresa']} {e['fin']}" for e in movidas][:10],
                    "nuevas": [f"{e['empresa']} {e['fin']}" for e in nuevas][:10]})

    for e in nuevas[:5]:
        top = sorted(e["pct"].items(), key=lambda kv: -kv[1])[:6]
        linea = ", ".join(f"{k} {v:.1f}" for k, v in top)
        esc = e.get("escanos") or {}
        extra = ("\nEscaños " + ", ".join(f"{k} {int(v)}" for k, v in sorted(esc.items(), key=lambda kv: -kv[1])[:5])) if esc else ""
        telegram_enviar(f"Nueva encuesta {e['empresa']} ({e['fin']}, n={e.get('muestra') or '?'})\n{linea}{extra}")


if __name__ == "__main__":
    con_parte("encuestas", main)
