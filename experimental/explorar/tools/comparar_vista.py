#!/usr/bin/env python3
"""Renderiza la vista inicial de β en Chrome sin interfaz y la compara con el boceto.

Genera (fuera del repo) una imagen lado a lado con las anclas del boceto y lo detectado en el
render, y una tabla con el error por objeto. No se versiona ninguna imagen.

Uso (con el build servido: `pnpm build && pnpm preview`):
  /tmp/explorar-venv/bin/python tools/comparar_vista.py --url http://localhost:4173/ \
      --salida /tmp/explorar-comparacion.png

Método de medición en el render: alrededor del ancla de cada objeto se busca la componente
brillante (más clara que el fondo local) más cercana; su centro de caja es la posición medida.
Los cuerpos pequeños muy oscuros pueden no detectarse: se informa «no detectado».
"""

from __future__ import annotations

import argparse
import base64
import json
import math
import socket
import subprocess
import tempfile
import time
from pathlib import Path

import cv2
import numpy as np
import websocket  # websocket-client

RAIZ = Path(__file__).resolve().parent.parent
LAYOUT = RAIZ / "docs" / "referencias" / "layout.json"
BOCETO = RAIZ / "docs" / "referencias" / "boceto-navegacion.png"
W, H = 1280, 720  # 16:9, la pantalla de referencia de la composición


class Chrome:
    def __init__(self) -> None:
        with socket.socket() as s:
            s.bind(("127.0.0.1", 0))
            self.port = s.getsockname()[1]
        self.perfil = tempfile.mkdtemp(prefix="explorar-chrome-")
        self.proc = subprocess.Popen(
            [
                "google-chrome", "--headless=new", "--no-sandbox", "--hide-scrollbars",
                "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist",
                # Sin red externa: cualquier nombre que no sea localhost falla.
                "--host-resolver-rules=MAP * ~NOTFOUND , EXCLUDE localhost, EXCLUDE 127.0.0.1",
                f"--remote-debugging-port={self.port}", f"--user-data-dir={self.perfil}",
                f"--window-size={W},{H}", "about:blank",
            ],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        )
        import urllib.request
        for _ in range(100):
            try:
                tabs = json.load(urllib.request.urlopen(f"http://127.0.0.1:{self.port}/json"))
                page = next(t for t in tabs if t["type"] == "page")
                break
            except Exception:
                time.sleep(0.1)
        self.ws = websocket.create_connection(page["webSocketDebuggerUrl"], timeout=60)
        self.n = 0
        self.externas: list[str] = []

    def send(self, method: str, **params):
        self.n += 1
        self.ws.send(json.dumps({"id": self.n, "method": method, "params": params}))
        while True:
            msg = json.loads(self.ws.recv())
            if msg.get("method") == "Network.requestWillBeSent":
                url = msg["params"]["request"]["url"]
                if not url.startswith(("http://localhost", "http://127.0.0.1", "data:", "blob:")):
                    self.externas.append(url)
            if msg.get("id") == self.n:
                return msg.get("result", {})

    def eval(self, expr: str):
        return self.send("Runtime.evaluate", expression=expr, returnByValue=True, awaitPromise=True).get("result", {}).get("value")

    def close(self) -> None:
        self.ws.close()
        self.proc.terminate()


def capturar(url: str) -> tuple[np.ndarray, list[str]]:
    c = Chrome()
    try:
        c.send("Network.enable")
        c.send("Page.enable")
        c.send("Emulation.setDeviceMetricsOverride", width=W, height=H, deviceScaleFactor=1, mobile=False)
        c.send("Page.navigate", url=url)
        time.sleep(2)
        c.eval("document.querySelector('.ex-body:not([data-soon])').click()")
        for _ in range(60):  # salto + carga del chunk + llegada
            time.sleep(0.5)
            if c.eval("!!document.querySelector('.ex-nav canvas')"):
                break
        time.sleep(4)
        # Solo la escena: sin barra de la app ni HUD, a 1280×720.
        c.eval(
            "(() => { const s = document.createElement('style'); s.textContent ="
            " '.app-bar,.ex-hud,.ex-debug{display:none!important}'; document.head.appendChild(s); })()"
        )
        time.sleep(2)
        png = base64.b64decode(c.send("Page.captureScreenshot", format="png")["data"])
        img = cv2.imdecode(np.frombuffer(png, np.uint8), cv2.IMREAD_COLOR)
        return img, c.externas
    finally:
        c.close()


def medir_en_render(render: np.ndarray, anclas: dict[str, tuple[float, float, float]]) -> dict[str, tuple[float, float] | None]:
    gris = cv2.cvtColor(render, cv2.COLOR_BGR2GRAY).astype(np.float32)
    fondo = cv2.medianBlur(gris.astype(np.uint8), 31).astype(np.float32)
    out: dict[str, tuple[float, float] | None] = {}
    for oid, (u, v, d) in anclas.items():
        if v - d / 2 < 0:
            # Recortado por el borde superior (como en el boceto): se mide el borde inferior visible.
            x0, x1 = int(max(0, (u - d * H / W) * W)), int(min(W, (u + d * H / W) * W))
            franja = ((gris[: int((v + d) * H), x0:x1] - fondo[: int((v + d) * H), x0:x1]) > 14).astype(np.uint8)
            n, lab, st, _ = cv2.connectedComponentsWithStats(franja)
            tocan = [i for i in range(1, n) if st[i, cv2.CC_STAT_TOP] <= 1 and st[i, cv2.CC_STAT_AREA] > 50]
            if tocan:
                i = max(tocan, key=lambda k: st[k, cv2.CC_STAT_AREA])
                bx, by, bw, bh = st[i, :4]
                out[oid] = ((x0 + bx + bw / 2) / W, (by + bh) / H)
                out[oid + ":borde"] = True  # type: ignore[assignment]
            else:
                out[oid] = None
            continue
        r = max(0.04, d * 1.2)
        x0, x1 = int(max(0, (u - r * H / W) * W)), int(min(W, (u + r * H / W) * W))
        y0, y1 = int(max(0, (v - r) * H)), int(min(H, (v + r) * H))
        if x1 <= x0 or y1 <= y0:
            out[oid] = None
            continue
        ventana = ((gris[y0:y1, x0:x1] - fondo[y0:y1, x0:x1]) > 14).astype(np.uint8)
        ventana = cv2.morphologyEx(ventana, cv2.MORPH_OPEN, np.ones((2, 2), np.uint8))
        n, lab, st, cen = cv2.connectedComponentsWithStats(ventana)
        mejor = None
        for i in range(1, n):
            if st[i, cv2.CC_STAT_AREA] < 12:
                continue
            bx, by, bw, bh = st[i, :4]
            cx, cy = (x0 + bx + bw / 2) / W, (y0 + by + bh / 2) / H
            dist = math.hypot(cx - u, cy - v) - 0.15 * st[i, cv2.CC_STAT_AREA] / (W * H) ** 0.5
            if mejor is None or dist < mejor[0]:
                mejor = (dist, (cx, cy))
        out[oid] = mejor[1] if mejor else None
    return out


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--url", default="http://localhost:4173/")
    ap.add_argument("--salida", type=Path, default=Path("/tmp/explorar-comparacion.png"))
    args = ap.parse_args()
    layout = json.loads(LAYOUT.read_text(encoding="utf-8"))
    nav = layout["navegacion"]
    render, externas = capturar(args.url)

    boceto = cv2.imread(str(BOCETO))[nav["franja_superior_px"]:]
    boceto = cv2.resize(boceto, (W, H), interpolation=cv2.INTER_AREA)  # mismas coordenadas normalizadas

    anclas = {o["id"]: (*o["ancla"]["centro"], o["ancla"]["diametro_v"]) for o in nav["objetos"]}
    medido = medir_en_render(render, anclas)
    filas = []
    for img in (boceto, render):
        for oid, (u, v, _) in anclas.items():
            p = (int(u * W), int(v * H))
            cv2.drawMarker(img, p, (0, 220, 255), cv2.MARKER_CROSS, 18, 2)
            cv2.putText(img, oid, (p[0] + 8, p[1] - 8), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 220, 255), 1)
    for oid, (u, v, d) in anclas.items():
        m = medido[oid]
        if medido.get(oid + ":borde"):
            v = v + d / 2  # se compara el borde inferior del objeto recortado
            oid = oid + " (borde inf.)"
        if m:
            cv2.circle(render, (int(m[0] * W), int(m[1] * H)), 7, (80, 255, 80), 2)
        err = math.hypot(m[0] - u, m[1] - v) if m else None
        filas.append((oid, (u, v), m, err))
    for name, (u, v) in nav["nave"]["ajuste"]["objetivo_16_9"].items():
        for img in (boceto, render):
            cv2.drawMarker(img, (int(u * W), int(v * H)), (255, 120, 60), cv2.MARKER_TILTED_CROSS, 12, 2)
    lienzo = np.concatenate([boceto, np.full((H, 8, 3), 40, np.uint8), render], axis=1)
    cv2.putText(lienzo, "Boceto (anclas medidas)", (12, 24), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
    cv2.putText(lienzo, "Escena (cruz = boceto, circulo = medido en el render)", (W + 20, 24), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
    cv2.imwrite(str(args.salida), lienzo)
    print(f"comparación: {args.salida}")
    print(f"peticiones externas: {len(externas)}")
    print(f"{'objeto':20} {'boceto (u,v)':16} {'render (u,v)':16} error")
    for oid, (u, v), m, err in sorted(filas):
        ms = f"({m[0]:.3f},{m[1]:.3f})" if m else "no detectado"
        es = f"{err:.3f}" if err is not None else "—"
        print(f"{oid:20} ({u:.3f},{v:.3f})    {ms:16} {es}")


if __name__ == "__main__":
    main()
