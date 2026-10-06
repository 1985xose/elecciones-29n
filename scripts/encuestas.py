"""Descarga las encuestas de Wikipedia, detecta las nuevas y avisa por Telegram."""
import re, sys
from datetime import date
from comun import leer, escribir, ahora_iso, clave_empresa, telegram_enviar
from wikitabla import html_pagina, parsear_tablas

PAGINA = "Opinion polling for the next Spanish general election"

# La misma casa demoscópica con otro nombre según la época, para que conserve su nota de acierto
EQUIVALENCIAS = {"emanalytics": "electopanel", "emanalyticselectomania": "electopanel", "electomania": "electopanel",
                 "sociometricaelespanol": "sociometrica", "40dbprisa": "40db", "sigmadoselmundo": "sigmados",
                 "ncreportlarazon": "ncreport", "gad3abc": "gad3", "simplelogicaelindependiente": "simplelogica",
                 "demoscopiayservicios": "demoscopiaservicios"}


def tabla_empresas(encuestas, hoy=None):
    """Una línea por empresa con cuántas encuestas tiene, la fecha de la última (fin del trabajo de campo) y los días que
    lleva sin publicar. Sirve para ver en el log de un vistazo si falta alguna empresa o si una habitual se ha quedado atrás."""
    hoy = hoy or date.today()
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
    filas, partidos = parsear_tablas(html, anio_defecto=date.today().year)
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

    # ---- Validación dura. Si algo no cuadra, se para y se conservan los datos anteriores ----
    problemas = []
    if len(unicas) < 20:
        problemas.append(f"solo {len(unicas)} encuestas")
    anteriores = len(previo.get("encuestas", []))
    if anteriores and len(unicas) < anteriores * 0.8:
        problemas.append(f"han desaparecido encuestas, antes {anteriores} y ahora {len(unicas)}")
    for k in ("PP", "PSOE", "Vox"):
        if k not in partidos:
            problemas.append(f"falta la columna {k}")
    sospechosas = [e for e in unicas if not (70 <= sum(e["pct"].values()) <= 101) or any(v > 60 for v in e["pct"].values())]
    if len(sospechosas) > len(unicas) * 0.05:
        problemas.append(f"{len(sospechosas)} encuestas con porcentajes que no cuadran, p. ej. {sospechosas[0]['empresa']} {sospechosas[0]['fin']} {sospechosas[0]['pct']}")
    recientes = [e for e in unicas if e["fin"] >= str(date.today().replace(day=1))] if date.today().day > 10 else unicas[:1]
    if not recientes:
        problemas.append("ninguna encuesta de este mes, la tabla puede haber cambiado de sitio")
    if problemas:
        print("VALIDACIÓN FALLIDA, no se escribe nada y se conservan los datos anteriores:")
        for x in problemas:
            print("  -", x)
        telegram_enviar("Panel 29N: la lectura de encuestas ha fallado la validación. " + "; ".join(problemas))
        sys.exit(1)
    # Las encuestas con porcentajes imposibles se apartan en vez de contaminar la media
    unicas = [e for e in unicas if e not in sospechosas]

    escribir("encuestas.json", {"actualizado": ahora_iso(), "fuente": f"https://en.wikipedia.org/wiki/{titulo.replace(' ', '_')}",
                                "revision": revid, "partidos": partidos, "encuestas": unicas})

    for e in nuevas[:5]:
        top = sorted(e["pct"].items(), key=lambda kv: -kv[1])[:6]
        linea = ", ".join(f"{k} {v:.1f}" for k, v in top)
        esc = e.get("escanos") or {}
        extra = ("\nEscaños " + ", ".join(f"{k} {int(v)}" for k, v in sorted(esc.items(), key=lambda kv: -kv[1])[:5])) if esc else ""
        telegram_enviar(f"Nueva encuesta {e['empresa']} ({e['fin']}, n={e.get('muestra') or '?'})\n{linea}{extra}")


if __name__ == "__main__":
    main()
