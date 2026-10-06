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
