"""Lee los mensajes del bot y gestiona la porra. Comandos:
/porra PP 140 PSOE 110 Vox 50 ...   guarda o sustituye tu pronóstico de escaños
/mia                                 te devuelve tu pronóstico guardado
/ayuda                               instrucciones
"""
import os, re
from datetime import datetime, timezone
from comun import leer, escribir, ahora_iso, S, telegram_enviar


def alias(cfg):
    a = {}
    for k, p in cfg["partidos"].items():
        for nombre in {k, p["nombre"], p["nombre"].replace(" ", "")}:
            a[re.sub(r"[^a-z]", "", nombre.lower())] = k
    a.update({"bildu": "Bildu", "cc": "CCa", "alianca": "AC", "aliança": "AC", "salf": "SALF"})
    return a


def main():
    token = os.environ.get("TELEGRAM_TOKEN")
    if not token:
        print("Sin TELEGRAM_TOKEN, se omite el bot"); return
    cfg = leer("config.json")
    al = alias(cfg)
    cierre = datetime.fromisoformat(cfg["eleccion"]["cierre_urnas"].replace("Z", "+00:00"))
    estado = leer("telegram_estado.json", {"offset": 0})
    porra = leer("porra.json", {"participantes": {}})
    r = S.get(f"https://api.telegram.org/bot{token}/getUpdates", params={"offset": estado["offset"], "timeout": 0}, timeout=30).json()
    cambios = 0
    for u in r.get("result", []):
        estado["offset"] = u["update_id"] + 1
        m = u.get("message") or u.get("edited_message")
        if not m or "text" not in m:
            continue
        texto, chat, de = m["text"].strip(), m["chat"]["id"], m.get("from", {})
        uid, nombre = str(de.get("id")), de.get("first_name") or de.get("username") or "Anónimo"
        cmd = texto.split()[0].split("@")[0].lower()
        if cmd in ("/ayuda", "/start"):
            telegram_enviar("Porra 29N. Escribe por ejemplo:\n/porra PP 140 PSOE 110 Vox 50 Sumar 20\nPuedes cambiarla las veces que quieras hasta el cierre de urnas. /mia para ver la tuya.", chat)
        elif cmd == "/mia":
            p = porra["participantes"].get(uid)
            telegram_enviar(("Tu porra: " + ", ".join(f"{k} {v}" for k, v in p["escanos"].items())) if p else "Aún no tienes porra.", chat)
        elif cmd == "/porra":
            if datetime.now(timezone.utc) >= cierre:
                telegram_enviar("La porra está cerrada, ya han cerrado las urnas.", chat); continue
            pares = re.findall(r"([A-Za-zÀ-ÿ\.\s]+?)\s*[:=]?\s*(\d{1,3})", texto[len(texto.split()[0]):])
            esc, malos = {}, []
            for n, v in pares:
                k = al.get(re.sub(r"[^a-z]", "", n.strip().lower()))
                if k: esc[k] = int(v)
                else: malos.append(n.strip())
            total = sum(esc.values())
            if not esc or total > 350:
                telegram_enviar(f"No la he podido guardar. {'Suma ' + str(total) + ', más de 350.' if total > 350 else 'Formato: /porra PP 140 PSOE 110 ...'}", chat); continue
            porra["participantes"][uid] = {"nombre": nombre, "escanos": esc, "fecha": ahora_iso()}
            cambios += 1
            extra = f" (no reconozco: {', '.join(malos)})" if malos else ""
            telegram_enviar(f"Guardada la porra de {nombre}, suma {total} escaños{extra}.", chat)
    escribir("telegram_estado.json", estado)
    if cambios:
        escribir("porra.json", porra)
    print(f"Mensajes procesados, porras actualizadas: {cambios}, participantes: {len(porra['participantes'])}")


if __name__ == "__main__":
    main()
