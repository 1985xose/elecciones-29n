"""Titulares del día con foto desde los RSS de los periódicos, y titulares por partido, polémicas y verificaciones
(Newtral/Maldita) desde Google News RSS, que no trae foto."""
import html, re, unicodedata
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from urllib.parse import quote
from comun import leer, escribir, ahora_iso, get, S

RSS = "https://news.google.com/rss/search?q={q}&hl=es&gl=ES&ceid=ES:es"

# ---------- RSS de los periódicos (traen foto) ----------
NS = {"media": "http://search.yahoo.com/mrss/", "content": "http://purl.org/rss/1.0/modules/content/", "atom": "http://www.w3.org/2005/Atom"}
IMG = re.compile(r"<img[^>]+src=[\"']([^\"']+)[\"']", re.I)
ES_IMAGEN = re.compile(r"\.(jpe?g|png|webp|avif)(\?|$)", re.I)


def plano(t):
    """Sin etiquetas, sin acentos y en minúsculas, para comparar textos."""
    t = re.sub(r"<[^>]+>", " ", html.unescape(t or ""))
    t = "".join(c for c in unicodedata.normalize("NFD", t) if unicodedata.category(c) != "Mn")
    return re.sub(r"\s+", " ", t).strip().lower()


def huella(titulo):
    return re.sub(r"[^a-z0-9]", "", plano(titulo))[:60]


def parecidos(a, b):
    """Dos titulares cuentan la misma noticia si comparten casi todas las palabras largas, aunque cambie alguna."""
    pa, pb = ({w for w in re.findall(r"[a-z0-9]{4,}", plano(t))} for t in (a, b))
    return bool(pa and pb) and len(pa & pb) / min(len(pa), len(pb)) >= 0.75


def imagen_de(it):
    """La foto de un titular, la busque donde la ponga cada periódico. Solo https. De varias, la de unos 500 px de ancho."""
    cands = []
    for etiqueta in ("media:content", "media:thumbnail"):
        for m in it.findall(".//" + etiqueta, NS):
            u, tipo = m.get("url"), (m.get("type") or m.get("medium") or "")
            if u and (etiqueta == "media:thumbnail" or "image" in tipo or (not tipo and ES_IMAGEN.search(u))):
                try:
                    ancho = int(float(m.get("width") or 0))
                except ValueError:
                    ancho = 0
                cands.append((ancho, u))
    for e in it.findall("enclosure"):
        if e.get("url") and ("image" in (e.get("type") or "") or ES_IMAGEN.search(e.get("url"))):
            cands.append((0, e.get("url")))
    if not cands:
        for campo in ("content:encoded", "description", "atom:content", "atom:summary"):
            m = IMG.search(it.findtext(campo, default="", namespaces=NS) or "")
            if m:
                cands.append((0, html.unescape(m.group(1))))
                break
    cands = [(a, u.strip()) for a, u in cands if u.strip().startswith("https://")]
    if not cands:
        return None
    grandes = sorted(c for c in cands if c[0] >= 480)
    return grandes[0][1] if grandes else max(cands)[1]


def leer_medio(medio):
    """Titulares de un periódico. Prueba sus direcciones por orden y se queda con la primera que dé titulares."""
    urls, fallo = ([medio["rss"]] if isinstance(medio["rss"], str) else list(medio["rss"])), None
    for url in urls:
        try:
            items = leer_rss(medio, url)
            if len(items) >= 3:
                return items, url
            fallo = fallo or ValueError(f"solo {len(items)} titulares")
        except Exception as e:
            fallo = fallo or e
    raise fallo


def leer_rss(medio, url):
    """Titulares de un RSS o Atom: [{titulo, enlace, fuente, grupo, fecha, imagen, texto}]."""
    r = S.get(url, timeout=12)
    r.raise_for_status()
    raiz = ET.fromstring(r.content)
    items = list(raiz.iter("item")) or list(raiz.iter("{http://www.w3.org/2005/Atom}entry"))
    out = []
    for it in items:
        titulo = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", html.unescape(it.findtext("title") or it.findtext("atom:title", namespaces=NS) or ""))).strip()
        enlace = (it.findtext("link") or "").strip()
        if not enlace:
            a = it.find("atom:link", NS)
            enlace = (a.get("href") if a is not None else "") or ""
        if not titulo or not enlace.startswith("http"):
            continue
        fecha = None
        try:
            if it.findtext("pubDate"):
                fecha = parsedate_to_datetime(it.findtext("pubDate"))
            else:
                f = it.findtext("atom:updated", namespaces=NS) or it.findtext("atom:published", namespaces=NS)
                fecha = datetime.fromisoformat(f.replace("Z", "+00:00")) if f else None
            if fecha and fecha.tzinfo is None:
                fecha = fecha.replace(tzinfo=timezone.utc)
        except Exception:
            fecha = None
        out.append({"titulo": titulo, "enlace": enlace, "fuente": medio["nombre"], "grupo": medio.get("grupo", "centro"), "fecha": fecha.isoformat() if fecha else None, "imagen": imagen_de(it),
                    "texto": plano(titulo + " " + (it.findtext("description") or it.findtext("atom:summary", namespaces=NS) or ""))[:600]})
    return out


def patron(terminos):
    """Expresión que encuentra cualquiera de los términos como palabra (o principio de palabra) en un texto plano."""
    ts = sorted({plano(t) for t in terminos if plano(t)}, key=len, reverse=True)
    return re.compile(r"(?<![a-z0-9])(" + "|".join(re.escape(t) for t in ts) + r")") if ts else None


def sin_acentos(t):
    return "".join(c for c in unicodedata.normalize("NFD", html.unescape(t or "")) if unicodedata.category(c) != "Mn")


def patron_nombres(terminos):
    """Nombres propios y siglas como palabra entera y respetando mayúsculas: "Sumar" sí, "sumar mayoría" no."""
    ts = sorted({sin_acentos(t) for t in terminos if t}, key=len, reverse=True)
    return re.compile(r"(?<![A-Za-z0-9])(" + "|".join(re.escape(t) for t in ts) + r")(?![A-Za-z0-9])") if ts else None


def terminos_consulta(consulta):
    return [t.strip().strip('"') for t in consulta.split(" OR ") if t.strip()]


def seccion_fuera(enlace, fuera):
    """True si la dirección de la noticia pasa por una sección que no es información política (deportes, horóscopo,
    opinión...). Mira las carpetas de la dirección y el subdominio, nunca el nombre final de la noticia."""
    m = re.match(r"https?://([^/]+)/?(.*)", enlace or "")
    if not m:
        return False
    trozos = m.group(1).lower().split(".")[:-2] + m.group(2).lower().split("?")[0].split("/")[:-1]
    return any(t in fuera for t in trozos)


def filtro_portada(cfg):
    """Devuelve una función que clasifica un titular de periódico: 1 si va de las elecciones, 2 si es política, 0 si no.
    Hay palabras que solo se usan hablando de elecciones (29N, electoral, voto por correo) y bastan solas, aunque estén en
    la entradilla. Otras se usan también para el fútbol o la tele (encuesta, debate, campaña, candidato) y solo cuentan si
    el propio titular nombra a un partido, a un líder o a una institución. Sin ese nombre en el titular no es política."""
    seguras, dudosas, claves = patron(cfg.get("portada_seguras", [])), patron(cfg.get("portada_fuertes", [])), patron(cfg.get("portada_claves", []))
    nombres = patron_nombres(cfg.get("portada_nombres", []))
    # Cada partido con sus nombres y con lo que no es él aunque se escriba igual (el ERC de las becas, CC.OO.)
    partidos = [(patron_nombres(p.get("nombres") or terminos_consulta(p["consulta"])), patron_nombres(p.get("no") or [])) for p in cfg["partidos"].values()]

    def clase(x):
        titulo = x["titulo"]
        texto, t = x.get("texto") or plano(titulo), sin_acentos(titulo)
        ancla = bool((nombres and nombres.search(t)) or (claves and claves.search(plano(titulo))) or any(si.search(t) and not (no and no.search(t)) for si, no in partidos if si))
        if (seguras and seguras.search(texto)) or (ancla and dudosas and dudosas.search(texto)):
            return 1
        return 2 if ancla else 0
    return clase


def reparto_plural(candidatos, n, grupos, tope=2):
    """Elige n titulares de una lista ya ordenada por preferencia, pero por turnos: uno de cada grupo de periódicos
    (progresistas, conservadores, generalistas) y sin repetir periódico hasta que hayan salido todos. Así no mandan ni
    los que más publican ni los de una sola línea editorial."""
    elegidos, vistos, por_medio = [], [], {}
    for limite in range(1, tope + 1):
        avance = True
        while avance and len(elegidos) < n:
            avance = False
            for g in grupos:
                if len(elegidos) >= n:
                    break
                for x in candidatos:
                    if x["grupo"] != g or por_medio.get(x["fuente"], 0) >= limite or any(parecidos(x["titulo"], v) for v in vistos):
                        continue
                    vistos.append(x["titulo"]); por_medio[x["fuente"]] = por_medio.get(x["fuente"], 0) + 1; elegidos.append(x); avance = True
                    break
    return elegidos


def portada(cfg):
    """Lee todos los periódicos y devuelve (titulares del día, todos los titulares leídos). Imprime qué tal ha ido cada uno."""
    todos, activos = [], []
    fuera, relleno = {plano(t) for t in cfg.get("secciones_fuera", [])}, patron(cfg.get("titulos_fuera", []))
    print("Periódicos con RSS propio:")
    for medio in cfg.get("medios", []):
        try:
            items, url = leer_medio(medio)
            # Fuera lo que no es información política: deportes, horóscopo, opinión... y las encuestas de «vota aquí»
            validos = [x for x in items if not seccion_fuera(x["enlace"], fuera) and not (relleno and relleno.search(plano(x["titulo"])))]
            todos += validos
            if any(x["imagen"] for x in items):
                activos.append({"nombre": medio["nombre"], "grupo": medio.get("grupo", "centro")})
            print(f"   {medio['nombre']:<16} {medio.get('grupo', ''):<10} {len(items):>3} titulares, {sum(1 for x in items if x['imagen']):>3} con foto, {len(items) - len(validos):>3} fuera por sección   {url}")
        except Exception as e:
            print(f"   {medio['nombre']:<16} {medio.get('grupo', ''):<10} FALLA: {type(e).__name__} {str(e)[:70]}")
    clase = filtro_portada(cfg)
    limite = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
    recientes = sorted((x for x in todos if x["fecha"] and x["fecha"] >= limite and x["imagen"]), key=lambda x: x["fecha"], reverse=True)
    # Preferencia: primero lo que habla de las elecciones y después el resto de la política, lo más reciente delante.
    clases = [clase(x) for x in recientes]
    ordenados = [x for x, c in zip(recientes, clases) if c == 1] + [x for x, c in zip(recientes, clases) if c == 2]
    grupos = list(cfg.get("grupos_medios") or {}) or sorted({x["grupo"] for x in todos})
    grupos = sorted(grupos, key=lambda g: g != "centro")  # el turno empieza por los generalistas
    elegidos = reparto_plural(ordenados, 10, grupos)
    elegidos.sort(key=lambda x: x["fecha"], reverse=True)
    cuenta = {g: sum(1 for x in elegidos if x["grupo"] == g) for g in grupos}
    print(f"   De {len(recientes)} titulares de hoy con foto, {clases.count(1)} van de las elecciones, {clases.count(2)} son de política y {clases.count(0)} se descartan")
    print(f"   Titulares del día con foto: {len(elegidos)} de {len({x['fuente'] for x in elegidos})} periódicos. Por grupo: {cuenta}")
    for x in elegidos:
        print(f"      {x['fuente']:<16} {x['titulo'][:100]}")
    return elegidos, todos, grupos, activos


def limpio(x):
    return {k: v for k, v in x.items() if k not in ("texto", "grupo") and v is not None}


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
    res = {"actualizado": ahora_iso(), "generales": [], "partidos": {}, "verificaciones": {}, "verificaciones_generales": [], "polemicas": []}
    try:
        res["generales"] = buscar(f"{cfg['titulares_generales']} when:1d", 10)
    except Exception as e:
        print("generales:", e); res["generales"] = previo.get("generales", [])
    # Titulares del día: primero los de los periódicos, con foto, y hasta llegar a 10 los de Google News, sin foto.
    try:
        del_dia, leidos, grupos, activos = portada(cfg)
    except Exception as e:
        print("periódicos:", e); del_dia, leidos, grupos, activos = [], [], [], []
    # Los periódicos que han respondido con foto en esta pasada, para que la metodología diga los que de verdad se usan
    res["medios"] = activos or previo.get("medios", [])
    if del_dia:
        ya = {huella(x["titulo"]) for x in del_dia}
        relleno = [x for x in res["generales"] if huella(x["titulo"]) not in ya]
        res["generales"] = ([limpio(x) for x in del_dia] + relleno)[:10]
    # Google News busca en todo el texto de la noticia, así que devuelve cosas que solo rozan al partido (o que hablan de
    # otra cosa con las mismas siglas, como el ERC europeo de investigación). Un titular solo se le apunta a un partido
    # si lo nombra en el propio titular, y solo es polémica si además el titular lleva una palabra de polémica.
    nombres = {k: (patron_nombres(p.get("nombres") or terminos_consulta(p["consulta"])), patron_nombres(p.get("no") or [])) for k, p in cfg["partidos"].items()}
    polemico = patron(cfg.get("polemicas_titular") or terminos_consulta(cfg["polemicas"]))

    def nombra(k, titulo):
        t = sin_acentos(titulo)
        return bool(nombres[k][0] and nombres[k][0].search(t)) and not (nombres[k][1] and nombres[k][1].search(t))

    descartes, verif = {"partido": 0, "polémica": 0, "verificación": 0}, {}
    por_huella = {huella(x["titulo"]): x for x in leidos if x["imagen"]}
    hace3 = (datetime.now(timezone.utc) - timedelta(days=3)).isoformat()

    def con_foto(lista):
        """A los titulares de Google News que coinciden con uno leído en un periódico se les pone su foto y su enlace directo."""
        for n in lista:
            x = por_huella.get(huella(n["titulo"]))
            if x:
                n["imagen"], n["enlace"] = x["imagen"], x["enlace"]
        return lista
    for k, p in cfg["partidos"].items():
        try:
            hallados = buscar(f"({p['consulta']}) elecciones when:3d", 15)
            res["partidos"][k] = [n for n in hallados if nombra(k, n["titulo"])][:6]
            descartes["partido"] += len(hallados) - len([n for n in hallados if nombra(k, n["titulo"])])
        except Exception as e:
            print(k, e); res["partidos"][k] = previo.get("partidos", {}).get(k, [])
        # Hasta 3 titulares de los periódicos que nombran al partido en el titular, con foto, y el resto de Google News
        suyos = sorted((x for x in leidos if x["imagen"] and x["fecha"] and x["fecha"] >= hace3 and nombra(k, x["titulo"])), key=lambda x: x["fecha"], reverse=True)
        elegidos = reparto_plural(suyos, 3, grupos, tope=1)  # también por turnos entre grupos de periódicos
        propios, vistos = [limpio(x) for x in elegidos], {huella(x["titulo"]) for x in elegidos}
        resto = [n for n in con_foto(res["partidos"][k]) if huella(n["titulo"]) not in vistos]
        res["partidos"][k] = sorted(propios + resto, key=lambda x: x.get("fecha") or "", reverse=True)[:6]
        try:
            hallados = buscar(f"({p['consulta']}) {cfg['verificadores']} when:21d", 8)
            for n in hallados:
                verif[huella(n["titulo"])] = n
            res["verificaciones"][k] = [n for n in hallados if nombra(k, n["titulo"])][:4]
            descartes["verificación"] += len(hallados) - len([n for n in hallados if nombra(k, n["titulo"])])
        except Exception as e:
            print(k, "verif", e); res["verificaciones"][k] = previo.get("verificaciones", {}).get(k, [])
        if k in ("PP", "PSOE", "Vox", "Sumar", "Podemos", "SALF", "ERC", "Junts", "Bildu", "PNV"):
            try:
                hallados = buscar(f"({p['consulta']}) ({cfg['polemicas']}) when:7d", 12)
                buenos = [n for n in hallados if nombra(k, n["titulo"]) and polemico.search(plano(n["titulo"]))]
                descartes["polémica"] += len(hallados) - len(buenos)
                for n in buenos[:4]:
                    res["polemicas"].append({**n, "partido": k})
            except Exception as e:
                print(k, "polémicas", e)
    # La misma polémica sale al buscar por varios partidos. Se queda una sola vez.
    unicas = []
    for n in sorted(res["polemicas"], key=lambda x: x["fecha"] or "", reverse=True):
        if not any(parecidos(n["titulo"], u["titulo"]) for u in unicas):
            unicas.append(n)
    res["polemicas"] = con_foto(unicas)
    res["polemicas"].sort(key=lambda x: x["fecha"] or "", reverse=True)
    if not res["polemicas"]:
        res["polemicas"] = previo.get("polemicas", [])
    # Verificaciones de Newtral y Maldita sobre la campaña en general: van en un bloque propio, no colgadas de un partido
    try:
        for n in buscar(f"elecciones {cfg['verificadores']} when:14d", 12):
            verif[huella(n["titulo"])] = n
    except Exception as e:
        print("verificaciones generales:", e)
    for n in verif.values():
        n["titulo"] = re.sub(r"\s*[·|-]\s*La Buloteca\s*$", "", n["titulo"]).strip()
    clase = filtro_portada(cfg)
    generales = sorted((n for n in verif.values() if len(n["titulo"]) >= 30 and clase({"titulo": n["titulo"]})),
                       key=lambda x: x["fecha"] or "", reverse=True)[:8]
    res["verificaciones_generales"] = generales or previo.get("verificaciones_generales", [])
    print(f"Descartados por no nombrar al partido en el titular: {descartes['partido']} titulares y {descartes['verificación']} verificaciones. Polémicas descartadas: {descartes['polémica']}")
    total = sum(len(v) for v in res["partidos"].values())
    fotos = sum(1 for x in res["generales"] if x.get("imagen")), sum(1 for v in res["partidos"].values() for x in v if x.get("imagen")), sum(1 for x in res["polemicas"] if x.get("imagen"))
    print(f"Con foto: {fotos[0]} titulares del día, {fotos[1]} por partido, {fotos[2]} polémicas")
    print(f"Titulares generales {len(res['generales'])}, por partido {total}, verificaciones {sum(len(v) for v in res['verificaciones'].values())}, polémicas {len(res['polemicas'])}")
    escribir("noticias.json", res)


if __name__ == "__main__":
    main()
