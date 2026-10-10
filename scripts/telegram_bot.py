"""Vigilante del robot y bot de Telegram, solo para el dueño del panel.

Se ejecuta al final de cada pasada, cuando los demás pasos ya han apuntado en data/estado.json cómo les ha ido.

1. Vigila. Si un paso (encuestas, simulación, noticias, notas de las empresas) pasa de ir bien a ir mal, manda UN aviso.
   Mientras siga mal lo recuerda cada 12 horas, y cuando se arregla lo dice. Un paso que lleva demasiado sin dar señales
   también cuenta como fallo, que es lo que pasa cuando revienta sin llegar a apuntar nada.
2. Contesta al dueño. Solo atiende mensajes del chat de TELEGRAM_CHAT_ID. Lo que escriba cualquier otra persona al bot se
   ignora sin responder. Órdenes: /estado y /ayuda. Como el robot pasa una vez por hora, la respuesta llega en la
   siguiente pasada, no al momento.

Sin TELEGRAM_TOKEN y TELEGRAM_CHAT_ID no hace nada salvo dejar apuntado que los avisos no están configurados.
"""
import os
from datetime import datetime, timezone
from comun import leer, escribir, ahora_iso, S, telegram_enviar

# paso -> (cómo se le llama en los avisos, horas sin dar señales a partir de las cuales se da por caído)
PASOS = {"encuestas": ("la lectura de encuestas", 3), "simulacion": ("la simulación", 3),
         "noticias": ("las noticias", 6), "fiabilidad": ("las notas de las empresas", 30)}
RECORDAR_CADA_H = 12


def _fecha(iso):
    return datetime.fromisoformat(str(iso).replace("Z", "+00:00"))


def _horas(desde, ahora):
    return (ahora - _fecha(desde)).total_seconds() / 3600


def como_va(paso, est, ahora):
    """(va_mal, frase) de un paso según su último parte. La frase es una oración entera, sin el punto final."""
    nombre, limite = PASOS[paso]
    x = est.get(paso)
    if not x:
        return False, f"{nombre}, sin parte todavía"
    h = _horas(x["hora"], ahora)
    if h > limite:
        return True, f"{nombre} no da señales desde hace {int(h)} horas"
    if not x.get("ok"):
        return True, f"falla {nombre}. {(x.get('mensaje') or 'Sin detalle').rstrip('.')}"
    return False, f"{nombre}, bien hace {max(1, int(h * 60))} min" if h < 1 else f"{nombre}, bien hace {int(h)} h"


def _mayus(t):
    return t[0].upper() + t[1:]


def resumen_estado(est, ahora=None):
    ahora = ahora or datetime.now(timezone.utc)
    lineas = []
    for paso in PASOS:
        mal, frase = como_va(paso, est, ahora)
        lineas.append(("MAL. " if mal else "") + _mayus(frase) + ".")
    return "\n".join(lineas)


def vigilar(est, enviar, ahora=None):
    """Compara el estado de cada paso con lo último que se avisó y manda solo los cambios. Devuelve cuántos avisos."""
    ahora = ahora or datetime.now(timezone.utc)
    marca = ahora.replace(microsecond=0).isoformat()
    avisado = est.setdefault("avisado", {})
    n = 0
    for paso, (nombre, _) in PASOS.items():
        if paso not in est:
            continue
        mal, frase = como_va(paso, est, ahora)
        a = avisado.get(paso)
        if mal and not a:
            if enviar(f"Panel 29N. {_mayus(frase)}.\nLa web sigue con los últimos datos buenos."):
                avisado[paso] = {"desde": marca, "ultimo": marca}; n += 1
        elif mal and a and _horas(a["ultimo"], ahora) >= RECORDAR_CADA_H:
            if enviar(f"Panel 29N. Sigue sin arreglarse. {_mayus(frase)}.\nEmpezó hace {int(_horas(a['desde'], ahora))} horas."):
                a["ultimo"] = marca; n += 1
        elif not mal and a:
            if enviar(f"Panel 29N. Ya funciona otra vez {nombre}. Estuvo fallando {int(_horas(a['desde'], ahora))} horas."):
                avisado.pop(paso); n += 1
    return n


def main():
    token, dueno = os.environ.get("TELEGRAM_TOKEN"), os.environ.get("TELEGRAM_CHAT_ID")
    est = leer("estado.json", {}) or {}
    tg = est.get("telegram") or {}
    if not token or not dueno:
        est["telegram"] = {"activo": False, "hora": ahora_iso()}
        escribir("estado.json", est)
        print("Sin TELEGRAM_TOKEN o TELEGRAM_CHAT_ID. Los avisos no están configurados."); return

    # La primera vez que hay credenciales y el mensaje sale, se saluda. Así se sabe que la configuración funciona.
    if not tg.get("activo"):
        ok = telegram_enviar("Panel 29N. Avisos activados.\nTe escribiré cuando falle algo del robot y cuando se arregle, "
                             "cuando salga una encuesta nueva y cada mañana con el resumen.\n"
                             "Escribe /estado para ver cómo va cada paso. Contesto en la siguiente pasada, una vez por hora.")
        tg = {"activo": bool(ok), "hora": ahora_iso()}
        if not ok:
            tg["problema"] = "El mensaje de prueba no ha salido. Revisa el token, el número de chat y que le hayas escrito antes al bot."
        print("Saludo de activación:", "enviado" if ok else "NO ha salido")
    else:
        tg["hora"] = ahora_iso()
    est["telegram"] = tg

    avisos = vigilar(est, telegram_enviar) if tg.get("activo") else 0

    # Mensajes recibidos: solo los del dueño
    oficio = leer("telegram_estado.json", {"offset": 0})
    atendidos = ajenos = 0
    try:
        r = S.get(f"https://api.telegram.org/bot{token}/getUpdates", params={"offset": oficio["offset"], "timeout": 0}, timeout=30).json()
    except Exception as e:
        print("No se han podido leer los mensajes:", type(e).__name__); r = {}
    for u in r.get("result", []):
        oficio["offset"] = u["update_id"] + 1
        m = u.get("message") or u.get("edited_message")
        if not m or "text" not in m:
            continue
        if str(m["chat"]["id"]) != str(dueno):
            ajenos += 1
            continue
        cmd = m["text"].strip().split()[0].split("@")[0].lower()
        if cmd == "/estado":
            telegram_enviar("Panel 29N, estado del robot.\n" + resumen_estado(est)); atendidos += 1
        elif cmd in ("/ayuda", "/start"):
            telegram_enviar("Panel 29N. Este bot solo te escribe a ti.\n/estado dice cómo va cada paso del robot.\n"
                            "Contesto en la siguiente pasada, una vez por hora."); atendidos += 1
    escribir("telegram_estado.json", oficio)
    escribir("estado.json", est)
    print(f"Avisos enviados: {avisos}. Mensajes del dueño atendidos: {atendidos}. Mensajes de otras personas ignorados: {ajenos}.")


if __name__ == "__main__":
    main()
