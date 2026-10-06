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
         "up": "UP", "unidaspodemos": "UP", "cs": "Cs", "maspais": "MP"}


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


def fecha_fin(txt):
    t = txt.replace("\u2013", "-").replace("\u2014", "-")
    anios = re.findall(r"(\d{4})", t)
    if not anios:
        return None, None
    anio = int(anios[-1])
    partes = [p.strip() for p in t.split("-") if p.strip()]
    def parse(p, mes_def=None, anio_def=anio):
        d = re.search(r"\b(\d{1,2})\b", re.sub(r"\d{4}", "", p))
        m = re.search(r"([A-Za-z]{3})[a-z]*", p)
        y = re.search(r"(\d{4})", p)
        mes = MESES.get(m.group(1).lower()) if m else mes_def
        if not mes:
            return None
        return date(int(y.group(1)) if y else anio_def, mes, int(d.group(1)) if d else 15)
    fin = parse(partes[-1])
    ini = parse(partes[0], fin.month if fin else None) if len(partes) > 1 else fin
    return ini, fin


def numeros(txt):
    t = txt.replace(",", "")
    return re.findall(r"\d+(?:\.\d+)?(?:/\d+)?", t)


def celda_texto(c):
    for s in c.find_all("sup"):
        s.decompose()
    return c.get_text(" ", strip=True)


def tabla_estimacion(sopa, seccion="Voting_intention_estimates"):
    """Solo la tabla de estimación de voto. La página tiene más tablas con el mismo formato
    (intención directa, preferencia de victoria...) que no deben mezclarse."""
    es_encuestas = lambda t: t.find("tr") is not None and "Polling firm" in t.find("tr").get_text(" ")
    ancla = sopa.find(id=seccion)
    if ancla is not None:
        for t in ancla.find_all_next("table", class_="wikitable"):
            if es_encuestas(t):
                return t, "seccion"
    for t in sopa.find_all("table", class_="wikitable"):
        if es_encuestas(t):
            return t, "primera tabla (sin sección encontrada)"
    return None, None


def parsear_tablas(html):
    sopa = BeautifulSoup(html, "html.parser")
    resultado, partidos_vistos = [], []
    tabla, origen = tabla_estimacion(sopa)
    print(f"Tabla usada: {origen}")
    for tabla in ([tabla] if tabla is not None else []):
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
            ini, fin = fecha_fin(celda_texto(f[idx["fecha"]]))
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
                n = numeros(celda_texto(f[i]))
                if not n:
                    continue
                reg["pct"][p] = float(n[0].split("/")[0])
                if len(n) > 1:
                    partes = [float(x) for x in n[1].split("/")]
                    reg["escanos"][p] = round(sum(partes) / len(partes), 1)
            if reg["pct"]:
                reg["es_resultado"] = "election" in empresa.lower()
                resultado.append(reg)
    return resultado, partidos_vistos
