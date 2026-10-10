"""Resumen de la mañana por Telegram con las probabilidades del día. Se ejecuta a las 7:00 UTC."""
from datetime import date
from comun import leer, telegram_enviar

def main():
    p = leer("probabilidades.json"); cfg = leer("config.json"); h = leer("probabilidades_historial.json", []); an = leer("analisis.json", {})
    if not p:
        print("Sin probabilidades"); return
    der = p["escenarios"][cfg["principales"]["derecha"]]; izq = p["escenarios"][cfg["principales"]["izquierda"]]
    def delta(id_):
        if len(h) < 2: return ""
        ayer = next((x for x in reversed(h[:-1])), None)
        if not ayer: return ""
        d = (h[-1]["escenarios"][id_] - ayer["escenarios"][id_]) * 100
        return f" ({'+' if d >= 0 else ''}{d:.0f})" if abs(d) >= 1 else " (igual)"
    nombres = {k: v["nombre"] for k, v in cfg["partidos"].items()}
    top = sorted(p["partidos"].items(), key=lambda kv: -kv[1]["p50"])[:4]
    lineas = [f"Buenos días. Faltan {p['dias_para_votar']} días para el 29N.",
              f"{der['nombre']}: {der['p']*100:.0f} %{delta(der['id'])}",
              f"{izq['nombre']}: {izq['p']*100:.0f} %{delta(izq['id'])}",
              f"Bloqueo: {p['bloqueo']*100:.0f} %",
              "Escaños probables: " + ", ".join(f"{nombres.get(k, k)} {v['p10']}-{v['p90']}" for k, v in top)]
    if der.get("bisagra"): lineas.append(f"Provincia bisagra: {der['bisagra'][0]['nombre']}")
    u = (an.get("ultimas") or [None])[0]
    if u: lineas.append(f"Última encuesta, {u['empresa']} ({u['fin']}): {u['texto']}")
    # Cómo está el robot, en una línea si va todo bien y con detalle si no
    try:
        from telegram_bot import PASOS, como_va
        from datetime import datetime, timezone
        est = leer("estado.json", {}) or {}
        malos = [f for m, f in (como_va(paso, est, datetime.now(timezone.utc)) for paso in PASOS if paso in est) if m]
        lineas.append("Robot: todo bien." if not malos else "Robot: FALLA " + ". FALLA ".join(malos))
    except Exception as e:
        lineas.append(f"Robot: no he podido mirar su estado ({type(e).__name__}).")
    texto = "\n".join(lineas)
    print(texto)
    telegram_enviar(texto)

if __name__ == "__main__":
    main()
