#!/usr/bin/env python3
"""Детали наличника «///» для 2D: вырезает их из двух снимков заказчика и
вшивает в index.html между метками CASING_PIECES_BEGIN / CASING_PIECES_END.

  наличник_капитель_банкетка.png — капитель, квадратные элементы, консоль
      (верхний наличник), боковой наличник и банкетка;
  наличник_обычный.png — наличник «///» без доп. элементов, углы на ус.

Координаты — в точках исходных снимков. Детали сохраняются в WebP с
прозрачностью; перекраска (цвет эмали, патина) — в самой программе.
"""
import base64, io, json, os, re
from PIL import Image, ImageFilter
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))

def smooth(c, along):
    """Зерно рендера на снимке под эмалью видно как шум (заказчик). Детали,
    одинаковые по длине (капитель, консоль, доски наличника), усредняем
    вдоль полосок: шум уходит весь, рисунок остаётся. Остальные (торцы
    капители, квадраты, банкетки) — мягкий медианный фильтр."""
    if along == "none":
        return c
    if along is None:
        return c.filter(ImageFilter.MedianFilter(3))
    a = np.array(c).astype(np.float32)
    if along == "x":
        a[:] = a.mean(axis=1, keepdims=True)
    else:
        a[:] = a.mean(axis=0, keepdims=True)
    return Image.fromarray(np.clip(a + 0.5, 0, 255).astype(np.uint8), "RGBA")

def piece(img, box, scale=1.0, along=None):
    c = img.crop(box)
    if scale != 1.0:
        c = c.resize((max(1, round(c.width * scale)), max(1, round(c.height * scale))), Image.LANCZOS)
    c = smooth(c, along)
    buf = io.BytesIO()
    c.save(buf, "WEBP", lossless=True, method=6)
    return {"src": "data:image/webp;base64," + base64.b64encode(buf.getvalue()).decode(), "w": c.width, "h": c.height}

k = Image.open(os.path.join(HERE, "наличник_капитель_банкетка.png")).convert("RGBA")
# Торцы капители: прямой участок (всё, кроме самого загиба, ~30 точек у
# края) берём из той же усреднённой середины — иначе между торцом и
# серединой виден шов по тону и по полоскам.
_mid = np.array(k.crop((250, 0, 390, 48))).astype(np.float32).mean(axis=1, keepdims=True)
_ka = np.array(k).astype(np.float32)
_ka[0:48, 30:611] = _mid
k = Image.fromarray(np.clip(_ka + 0.5, 0, 255).astype(np.uint8), "RGBA")
p = Image.open(os.path.join(HERE, "наличник_обычный.png")).convert("RGBA")
S = 0.5  # обычный снимок вдвое крупнее, чем нужно

out = {
    # board — ширина бокового наличника в точках снимка: по ней всё
    # остальное переводится в миллиметры сцены.
    "kap": {
        "board": 53,
        "capL": dict(piece(k, (0, 0, 120, 48), along="none"), refX=[30, 120]), "capM": piece(k, (250, 0, 390, 48), along="x"), "capR": dict(piece(k, (521, 0, 641, 48), along="none"), refX=[0, 90]),
        "capOver": 27,   # капитель шире наличника на столько с каждой стороны
        "sqL": piece(k, (27, 48, 76, 98)), "sqR": piece(k, (565, 48, 614, 98)),
        "con": piece(k, (200, 48, 440, 98), along="x"),
        "vL": piece(k, (27, 300, 80, 1100), along="y"), "vR": piece(k, (561, 300, 614, 1100), along="y"),
        "bkL": piece(k, (27, 1185, 80, 1300)), "bkR": piece(k, (561, 1185, 614, 1300)),
    },
    "plain": {
        "board": round(176 * S),
        "vL": piece(p, (0, 1200, 176, 2800), S, along="y"), "vR": piece(p, (1698, 1200, 1875, 2800), S, along="y"),
        "top": piece(p, (600, 0, 1275, 180), S, along="x"),
    },
}

html_path = os.path.join(ROOT, "index.html")
html = open(html_path, encoding="utf-8").read()
block = "  // CASING_PIECES_BEGIN (собирается assets/source/casing_2026/build_casing.py)\n  const CASING_PIECES = " + json.dumps(out, ensure_ascii=False) + ";\n  // CASING_PIECES_END"
new, n = re.subn(r"  // CASING_PIECES_BEGIN.*?// CASING_PIECES_END", lambda m: block, html, flags=re.S)
if n != 1:
    raise SystemExit("метки CASING_PIECES_BEGIN/END не найдены")
open(html_path, "w", encoding="utf-8").write(new)
print("ok", sum(len(v["src"]) for g in out.values() for v in g.values() if isinstance(v, dict)), "байт")
