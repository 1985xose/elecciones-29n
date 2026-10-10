"""Utilidades compartidas por los recolectores."""
import json, os, re, time
from datetime import datetime, timezone
from pathlib import Path
import requests

RAIZ = Path(__file__).resolve().parent.parent
DATA = RAIZ / "data"
UA = "panel-29n/1.0 (https://github.com/1985xose; uso personal)"
S = requests.Session()
S.headers.update({"User-Agent": UA})


def ahora_iso():
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def leer(nombre, defecto=None):
    p = DATA / nombre
    if not p.exists():
        return defecto
    with open(p, encoding="utf-8") as f:
        return json.load(f)


def escribir(nombre, obj):
    p = DATA / nombre
    tmp = p.with_suffix(".tmp")
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=1)
    tmp.replace(p)


def get(url, **kw):
    for intento in range(3):
        try:
            r = S.get(url, timeout=30, **kw)
            r.raise_for_status()
            return r
        except Exception as e:
            if intento == 2:
                raise
            time.sleep(3 * (intento + 1))


def clave_empresa(nombre):
    """'SocioMétrica/El Español' -> 'sociometrica'. Sirve para cruzar empresas entre elecciones."""
    base = nombre.split("/")[0]
    base = re.sub(r"\(.*?\)|\[.*?\]", "", base).strip()
    t = base.lower()
    for a, b in zip("áéíóúüñ", "aeiouun"):
        t = t.replace(a, b)
    return re.sub(r"[^a-z0-9]", "", t), base


# ---- Parte del robot ----
# Cada paso (encuestas, notas de las empresas, simulación, noticias) apunta en data/estado.json cómo le ha ido: si ha
# acabado bien, a qué hora, y si no, por qué. El fichero se publica con los demás datos. Lo leen el panel privado de la
# app («Estado del robot») y el vigilante de telegram_bot.py, que es quien avisa cuando algo cambia de bien a mal o al revés.
def apuntar_estado(paso, ok, mensaje="", detalle=None):
    est = leer("estado.json", {}) or {}
    antes = est.get(paso) or {}
    ahora = ahora_iso()
    est[paso] = {"ok": bool(ok), "hora": ahora, "mensaje": str(mensaje)[:600],
                 "ultima_buena": ahora if ok else antes.get("ultima_buena"), "detalle": detalle or {}}
    escribir("estado.json", est)


def con_parte(paso, funcion):
    """Ejecuta un paso entero y, si revienta por algo que el propio paso no ha previsto (sin red, un formato que cambia,
    un fallo de programa), lo deja apuntado antes de salir. Lo que el paso sí prevé lo apunta él mismo."""
    try:
        return funcion()
    except SystemExit as e:
        if e.code not in (0, None) and not isinstance(e.code, int):
            apuntar_estado(paso, False, str(e.code))
        raise
    except Exception as e:
        apuntar_estado(paso, False, f"{type(e).__name__}: {e}")
        raise


# ---- Telegram (opcional: solo actúa si hay TELEGRAM_TOKEN y TELEGRAM_CHAT_ID) ----
def telegram_enviar(texto, chat_id=None):
    token = os.environ.get("TELEGRAM_TOKEN")
    chat = chat_id or os.environ.get("TELEGRAM_CHAT_ID")
    if not token or not chat:
        return False
    try:
        r = S.post(f"https://api.telegram.org/bot{token}/sendMessage",
                   json={"chat_id": chat, "text": texto, "disable_web_page_preview": True}, timeout=20)
        return r.ok
    except Exception as e:
        print("Telegram error:", e)
        return False
