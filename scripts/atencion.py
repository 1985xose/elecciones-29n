"""Visitas diarias a la Wikipedia en español de cada líder (termómetro de atención)."""
from datetime import date, timedelta
from urllib.parse import quote
from comun import leer, escribir, ahora_iso, S

URL = "https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/es.wikipedia/all-access/user/{t}/daily/{a}/{b}"


def main():
    cfg = leer("config.json")
    fin = date.today() - timedelta(days=1)
    ini = fin - timedelta(days=59)
    res = {"actualizado": ahora_iso(), "desde": ini.isoformat(), "hasta": fin.isoformat(), "lideres": {}}
    for k, p in cfg["partidos"].items():
        t = p.get("lider")
        if not t:
            continue
        r = S.get(URL.format(t=quote(t, safe=""), a=ini.strftime("%Y%m%d"), b=fin.strftime("%Y%m%d")), timeout=30)
        if r.status_code != 200:
            print(f"{k}: '{t}' sin datos ({r.status_code}), revisa el título en config.json")
            continue
        serie = [{"dia": f"{i['timestamp'][:4]}-{i['timestamp'][4:6]}-{i['timestamp'][6:8]}", "visitas": i["views"]} for i in r.json().get("items", [])]
        res["lideres"][k] = {"articulo": t.replace("_", " "), "serie": serie}
        print(f"{k}: {t} {len(serie)} días, ayer {serie[-1]['visitas'] if serie else '?'}")
    escribir("atencion.json", res)


if __name__ == "__main__":
    main()
