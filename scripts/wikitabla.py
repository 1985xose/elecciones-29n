"""Parser de las tablas de encuestas de Wikipedia (en) para elecciones españolas."""
import re
from datetime import date
from bs4 import BeautifulSoup
from comun import get

API = "https://en.wikipedia.org/w/api.php"
MESES = {m: i + 1 for i, m in enumerate(["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"])}
CANON = {"pp": "PP", "psoe": "PSOE", "vox": "Vox", "sumar": "Sumar", "erc": "ERC", "junts": "Junts",
         "ehbildu": "Bildu", "bildu": "Bildu", "pnv": "PNV", "eajpnv": "PNV", "bng": "BNG", "cca": "CCa",
         "upn": "UPN", "podemos": "Podemos", "salf": "SALF", "aliancacat": "AC", "alianca": "AC",
         "up": "UP", "unidaspodemos": "UP", "ercsobiranistes": "ERC", "ercsob": "ERC", "jxcat": "Junts", "jxcatjunts": "Junts", "ccnca": "CCa", "ccapncnc": "CCa", "adelanteandalucia": "AA", "adelanteandalucia2021": "AA", "cs": "Cs", "maspais": "MP"}


def html_pagina(titulo):
    r = get(API, params={"action": "parse", "page": titulo, "prop": "text|revid", "format": "json",
                         "redirects": 1, "formatversion": 2})
    j = r.json()
    if "error" in j:
        raise RuntimeError(f"Wikipedia: {j['error'].get('info')}")
    return j["parse"]["title"], j["parse"].get("revid"), j["parse"]["text"]


def canon(txt):
    t = txt.lower()
    for a, b in zip("áàéíóúüçñ", "aaeiouucn"):
        t = t.replace(a, b)
    t = re.sub(r"[^a-z0-9]", "", t)
    return CANON.get(t, txt.strip())


def texto_th(th):
    t = th.get_text(" ", strip=True)
    if t:
        return t
    a = th.find("a")
    if a and a.get("title"):
        return a["title"]
    img = th.find("img")
    return img.get("alt", "") if img else ""


def rejilla(tabla):
    """Expande rowspan/colspan. Devuelve lista de filas, cada una lista de (celda, es_th)."""
    filas, pendientes = [], {}
    for tr in tabla.find_all("tr"):
        fila, col = [], 0
        celdas = tr.find_all(["td", "th"], recursive=False)
        it = iter(celdas)
        while True:
            if col in pendientes:
                cel, resto = pendientes[col]
                fila.append(cel)
                if resto > 1:
                    pendientes[col] = (cel, resto - 1)
                else:
                    del pendientes[col]
                col += 1
                continue
            c = next(it, None)
            if c is None:
                break
            cs = int(re.sub(r"\D", "", c.get("colspan", "1")) or 1)
            rs = int(re.sub(r"\D", "", c.get("rowspan", "1")) or 1)
            for k in range(cs):
                fila.append(c)
                if rs > 1:
                    pendientes[col] = (c, rs - 1)
                col += 1
        while col in pendientes:
            cel, resto = pendientes[col]
            fila.append(cel)
            if resto > 1:
                pendientes[col] = (cel, resto - 1)
            else:
                del pendientes[col]
            col += 1
        filas.append(fila)
    return filas


def fecha_fin(txt, anio_defecto):
    """'24–26 Sep 2026', '30 Sep–2 Oct', '29 Dec–5 Jan 2026', '17 Jul'. Si no trae año usa anio_defecto."""
    t = txt.replace("\u2013", "-").replace("\u2014", "-")
    anios = re.findall(r"(\d{4})", t)
    anio = int(anios[-1]) if anios else anio_defecto
    if not anio:
        return None, None
    partes = [p.strip() for p in t.split("-") if p.strip()]
    def parse(p, mes_def=None):
        d = re.search(r"\b(\d{1,2})\b", re.sub(r"\d{4}", "", p))
        m = re.search(r"([A-Za-z]{3})[a-z]*", p)
        mes = MESES.get(m.group(1).lower()) if m else mes_def
        if not mes:
            return None
        try:
            return date(anio, mes, int(d.group(1)) if d else 15)
        except ValueError:
            return None
    fin = parse(partes[-1])
    if not fin:
        return None, None
    ini = parse(partes[0], fin.month) if len(partes) > 1 else fin
    if ini and ini > fin:  # '29 Dec–5 Jan': el inicio es del año anterior
        ini = ini.replace(year=ini.year - 1)
    return ini, fin


def numeros(txt):
    t = txt.replace(",", "")
    return re.findall(r"\d+(?:\.\d+)?(?:/\d+)?", t)


def pct_y_escanos(txt):
    """'33.1 137' -> (33.1, 137). '? 7' -> (None, 7). '138' -> (None, 138). '140/145' -> (None, 142.5). '33.1' -> (33.1, None).
    En Wikipedia el porcentaje siempre lleva decimal y los escaños nunca, así es como se distinguen."""
    tokens = re.findall(r"\d+(?:\.\d+)?(?:/\d+(?:\.\d+)?)?", txt.replace(",", ""))
    pct, esc = None, None
    for t in tokens:
        if "." in t and "/" not in t and pct is None and float(t) <= 100:
            pct = float(t)
        elif "." not in t and esc is None:
            partes = [float(x) for x in t.split("/")]
            esc = round(sum(partes) / len(partes), 1)
    return pct, esc


def celda_texto(c):
    for s in c.find_all("sup"):
        s.decompose()
    return c.get_text(" ", strip=True)


def tablas_estimacion(sopa, seccion="Voting_intention_estimates"):
    """Tablas de estimación de voto con el año de su bloque. La estimación está partida en una tabla
    por año (títulos '2026', '2025'...) y las fechas de esas tablas no llevan año. Se para en el
    siguiente apartado de nivel 2 (intención directa, escenarios...), que no debe mezclarse."""
    es_encuestas = lambda t: t.find("tr") is not None and "Polling firm" in t.find("tr").get_text(" ")
    ancla = sopa.find(id=seccion)
    if ancla is None:
        t = next((t for t in sopa.find_all("table", class_="wikitable") if es_encuestas(t)), None)
        return ([(t, None)] if t else []), "primera tabla (sin sección encontrada)"
    salida, anio = [], None
    def titulo(h):
        for x in h.find_all(class_="mw-editsection"):
            x.decompose()
        return h.get_text(" ", strip=True)
    for el in ancla.find_all_next(["h2", "h3", "h4", "table"]):
        if el.name in ("h2", "h3", "h4"):
            if el is ancla or ancla in el.parents:
                continue
            m = re.fullmatch(r"(\d{4})", titulo(el))
            if m:
                anio = int(m.group(1))
            elif salida or el.name == "h2":
                break  # siguiente apartado (intención directa, escenarios...)
        elif "wikitable" in (el.get("class") or []) and es_encuestas(el) and el.find_parent("table") is None:
            salida.append((el, anio))
    return salida, f"sección, {len(salida)} tablas, años {[a for _, a in salida]}"


def parsear_tablas(html, anio_defecto=None):
    """anio_defecto: año de la fila más reciente cuando la página no tiene bloques por año.
    En ese caso el año se va deduciendo hacia atrás, porque las filas van de más nueva a más antigua."""
    sopa = BeautifulSoup(html, "html.parser")
    resultado, partidos_vistos = [], []
    tablas, origen = tablas_estimacion(sopa)
    print(f"Tablas usadas: {origen}")
    anio_corrido, ultima = anio_defecto, None
    for tabla, anio_tabla in tablas:
        filas = rejilla(tabla)
        # filas de cabecera = filas iniciales solo con th
        n_cab = 0
        for f in filas:
            if f and all(c.name == "th" for c in f):
                n_cab += 1
            else:
                break
        ncols = max(len(f) for f in filas[:n_cab]) if n_cab else 0
        nombres = []
        for i in range(ncols):
            vistos, textos = set(), []
            for f in filas[:n_cab]:
                if i < len(f) and id(f[i]) not in vistos:
                    vistos.add(id(f[i]))
                    t = texto_th(f[i])
                    if t:
                        textos.append(t)
            nombres.append(" ".join(textos))
        idx = {"empresa": None, "fecha": None, "muestra": None, "participacion": None, "ventaja": None}
        partidos = {}
        for i, n in enumerate(nombres):
            nl = n.lower()
            if "polling firm" in nl: idx["empresa"] = i
            elif "fieldwork" in nl: idx["fecha"] = i
            elif "sample" in nl: idx["muestra"] = i
            elif "turnout" in nl: idx["participacion"] = i
            elif nl.startswith("lead"): idx["ventaja"] = i
            elif n.strip() and not nl.startswith("other"):
                partidos[i] = canon(n)
        if idx["empresa"] is None or idx["fecha"] is None:
            continue
        for k in partidos.values():
            if k not in partidos_vistos:
                partidos_vistos.append(k)
        for f in filas[n_cab:]:
            if len(f) <= max(idx["empresa"], idx["fecha"]):
                continue
            if all(c is f[0] for c in f):  # fila que ocupa todo el ancho (notas)
                continue
            empresa = celda_texto(f[idx["empresa"]])
            txt_fecha = celda_texto(f[idx["fecha"]])
            ini, fin = fecha_fin(txt_fecha, anio_tabla or anio_corrido)
            if fin and not anio_tabla and not re.search(r"\d{4}", txt_fecha) and ultima and (fin - ultima).days > 60:
                anio_corrido -= 1  # se ha cruzado de enero a diciembre bajando por la tabla
                ini, fin = fecha_fin(txt_fecha, anio_corrido)
            if fin:
                ultima = fin
            if not empresa or not fin:
                continue
            reg = {"empresa": empresa, "inicio": ini.isoformat() if ini else None, "fin": fin.isoformat(),
                   "muestra": None, "participacion": None, "pct": {}, "escanos": {}}
            if idx["muestra"] is not None and idx["muestra"] < len(f):
                n = numeros(celda_texto(f[idx["muestra"]]))
                reg["muestra"] = int(float(n[0])) if n else None
            if idx["participacion"] is not None and idx["participacion"] < len(f):
                n = numeros(celda_texto(f[idx["participacion"]]))
                reg["participacion"] = float(n[0]) if n else None
            for i, p in partidos.items():
                if i >= len(f):
                    continue
                pct, esc = pct_y_escanos(celda_texto(f[i]))
                if pct is not None:
                    reg["pct"][p] = pct
                if esc is not None:
                    reg["escanos"][p] = esc
            if reg["pct"]:
                reg["es_resultado"] = "election" in empresa.lower()
                resultado.append(reg)
    return resultado, partidos_vistos
