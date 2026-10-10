"""Ranking de acierto de las encuestadoras: última encuesta de cada una antes de 23J-2023 y 10N-2019."""
from datetime import date
from comun import escribir, ahora_iso, clave_empresa, apuntar_estado, con_parte
from wikitabla import html_pagina, parsear_tablas
from encuestas import EQUIVALENCIAS

ELECCIONES = [
    {"nombre": "23J 2023", "pagina": "Opinion polling for the 2023 Spanish general election", "fecha": date(2023, 7, 23), "archivo": "historico_2023.json"},
    {"nombre": "10N 2019", "pagina": "Opinion polling for the November 2019 Spanish general election", "fecha": date(2019, 11, 10), "archivo": "historico_2019.json"},
    {"nombre": "28A 2019", "pagina": "Opinion polling for the April 2019 Spanish general election", "fecha": date(2019, 4, 28), "archivo": "historico_2019a.json"},
    {"nombre": "26J 2016", "pagina": "Opinion polling for the 2016 Spanish general election", "fecha": date(2016, 6, 26), "archivo": "historico_2016.json"},
]


def main():
    salida, acumulado = [], {}
    for el in ELECCIONES:
        _, _, html = html_pagina(el["pagina"])
        filas, _ = parsear_tablas(html, anio_defecto=el["fecha"].year)
        real = next((f for f in filas if f.get("es_resultado") and f["fin"] == el["fecha"].isoformat()), None)
        if not real:
            print(f"{el['nombre']}: no encuentro la fila del resultado real, se omite")
            continue
        principales = [k for k, _ in sorted(real["pct"].items(), key=lambda kv: -kv[1])[:4]]
        limite = date.fromordinal(el["fecha"].toordinal() - 6).isoformat()  # antes de la veda de 5 días
        ultima = {}
        for f in filas:
            if f.get("es_resultado") or f["fin"] > limite:
                continue
            clave, base = clave_empresa(f["empresa"])
            clave = EQUIVALENCIAS.get(clave, clave)
            if not clave or (clave in ultima and ultima[clave]["fin"] >= f["fin"]):
                continue
            if all(p in f["pct"] for p in principales):
                ultima[clave] = {**f, "clave": clave, "base": base}
        firmas = []
        for clave, f in ultima.items():
            errores = {p: round(f["pct"][p] - real["pct"][p], 1) for p in principales}
            mae = round(sum(abs(v) for v in errores.values()) / len(errores), 2)
            firmas.append({"clave": clave, "empresa": f["base"], "fin": f["fin"], "error_medio": mae, "errores": errores})
            acumulado.setdefault(clave, {"empresa": f["base"], "errores": []})["errores"].append(mae)
        firmas.sort(key=lambda x: x["error_medio"])
        # Histórico completo de encuestas de aquella legislatura, para calibrar el modelo y el backtest
        hist = []
        for f in filas:
            if f.get("es_resultado") or not f["pct"]:
                continue
            clave, base = clave_empresa(f["empresa"])
            clave = EQUIVALENCIAS.get(clave, clave)
            if not clave or f["empresa"].startswith("CIS (") or f["fin"] > el["fecha"].isoformat():
                continue
            hist.append({"id": f"{clave}-{f['fin']}-{f.get('muestra') or 0}", "empresa": f["empresa"], "empresa_base": base, "clave": clave,
                         "inicio": f["inicio"], "fin": f["fin"], "muestra": f["muestra"], "pct": f["pct"]})
        hist.sort(key=lambda e: e["fin"], reverse=True)
        escribir(el["archivo"], {"nombre": el["nombre"], "fecha": el["fecha"].isoformat(), "resultado": real["pct"], "escanos": real.get("escanos", {}), "encuestas": hist})
        print(f"   histórico guardado en {el['archivo']}, {len(hist)} encuestas")
        salida.append({"nombre": el["nombre"], "resultado": {p: real["pct"][p] for p in principales}, "firmas": firmas})
        print(f"{el['nombre']}: real {[(p, real['pct'][p]) for p in principales]}  empresas evaluadas {len(firmas)}")
        for x in firmas[:5]:
            print(f"   {x['empresa']:<25} {x['fin']}  error medio {x['error_medio']}")
    ranking = [{"clave": k, "empresa": v["empresa"], "error_medio": round(sum(v["errores"]) / len(v["errores"]), 2),
                "elecciones": len(v["errores"])} for k, v in acumulado.items()]
    ranking.sort(key=lambda x: (x["error_medio"], -x["elecciones"]))
    if not ranking:
        raise SystemExit("Sin datos de fiabilidad, no se escribe nada")
    escribir("fiabilidad.json", {"actualizado": ahora_iso(), "elecciones": salida, "ranking": ranking})
    apuntar_estado("fiabilidad", True, f"{len(ranking)} empresas con nota, {len(salida)} elecciones pasadas")


if __name__ == "__main__":
    con_parte("fiabilidad", main)
