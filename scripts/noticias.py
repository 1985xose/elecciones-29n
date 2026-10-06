"""Titulares por partido y verificaciones (Newtral/Maldita) desde Google News RSS."""
import xml.etree.ElementTree as ET
from email.utils import parsedate_to_datetime
from urllib.parse import quote
from comun import leer, escribir, ahora_iso, get

RSS = "https://news.google.com/rss/search?q={q}&hl=es&gl=ES&ceid=ES:es"


def buscar(q, n):
    xml = get(RSS.format(q=quote(q))).content
    raiz = ET.fromstring(xml)
    items = []
    for it in raiz.iter("item"):
        titulo = (it.findtext("title") or "").strip()
        fuente = (it.findtext("source") or "").strip()
        if fuente and titulo.endswith(" - " + fuente):
            titulo = titulo[: -len(fuente) - 3]
        try:
            fecha = parsedate_to_datetime(it.findtext("pubDate")).isoformat()
        except Exception:
            fecha = None
        items.append({"titulo": titulo, "enlace": it.findtext("link"), "fuente": fuente, "fecha": fecha})
    items.sort(key=lambda x: x["fecha"] or "", reverse=True)
    vistos, out = set(), []
    for x in items:
        k = x["titulo"].lower()[:70]
        if k not in vistos:
            vistos.add(k); out.append(x)
    return out[:n]


def main():
    cfg = leer("config.json")
    previo = leer("noticias.json", {}) or {}
    res = {"actualizado": ahora_iso(), "generales": [], "partidos": {}, "verificaciones": {}, "polemicas": []}
    try:
        res["generales"] = buscar(f"{cfg['titulares_generales']} when:1d", 10)
    except Exception as e:
        print("generales:", e); res["generales"] = previo.get("generales", [])
    for k, p in cfg["partidos"].items():
        try:
            res["partidos"][k] = buscar(f"({p['consulta']}) elecciones when:3d", 6)
        except Exception as e:
            print(k, e); res["partidos"][k] = previo.get("partidos", {}).get(k, [])
        try:
            res["verificaciones"][k] = buscar(f"({p['consulta']}) {cfg['verificadores']} when:21d", 4)
        except Exception as e:
            print(k, "verif", e); res["verificaciones"][k] = previo.get("verificaciones", {}).get(k, [])
        if k in ("PP", "PSOE", "Vox", "Sumar", "Podemos", "SALF", "ERC", "Junts", "Bildu", "PNV"):
            try:
                for n in buscar(f"({p['consulta']}) ({cfg['polemicas']}) when:7d", 4):
                    res["polemicas"].append({**n, "partido": k})
            except Exception as e:
                print(k, "polémicas", e)
    res["polemicas"].sort(key=lambda x: x["fecha"] or "", reverse=True)
    if not res["polemicas"]:
        res["polemicas"] = previo.get("polemicas", [])
    total = sum(len(v) for v in res["partidos"].values())
    print(f"Titulares generales {len(res['generales'])}, por partido {total}, verificaciones {sum(len(v) for v in res['verificaciones'].values())}, polémicas {len(res['polemicas'])}")
    escribir("noticias.json", res)


if __name__ == "__main__":
    main()
