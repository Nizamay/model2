#!/usr/bin/env python3
"""Улучшение фото моделей нейросетью Real-ESRGAN (бесплатно, на процессоре).

Для каждого фото из fits.json берётся только та часть, что попадает в кадр
модели (блок 850 x 2085 мм по подгонке из fits.json), увеличивается в 4 раза
нейросетью realesrgan-x4plus и ужимается до кадра 1020 x 2502 точек — ровно
того, что программа и так хранит у модели. Результат — sr/<Название>.jpg;
build_models.py вшивает его вместо исходника (подгонка у такого кадра нулевая).

Нужно: pip install realesrgan-ncnn-py pillow numpy; libomp (apt install libomp5).
Запуск:  python3 enhance_sr.py <номер_воркера> <всего_воркеров>
Если не получилось — фото остаётся прежним, программа работает как раньше.
"""
import json, os, sys, time
import numpy as np
from PIL import Image
import realesrgan_ncnn_py as rg

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'sr')
FRAME_W, FRAME_H = 1020, 2502
R = 850 / 2085
SCALE = 4
MARGIN = 16  # запас вокруг блока (в точках оригинала): у нейросети края хуже

def box_on_source(fit, iw, ih):
    ar = iw / ih
    dwb, dhb = (ar / R, 1) if ar > R else (1, R / ar)
    dw, dh = dwb * fit['zx'], dhb * fit['zy']
    left = (1 - dw) / 2 + fit['dx']; top = (1 - dh) / 2 + fit['dy']
    return -left / dw, -top / dh, 1 / dw, 1 / dh

def edge_color(a):
    b = np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]]).reshape(-1, 3)
    return tuple(int(v) for v in np.median(b, axis=0))

def process(name, fit, up):
    src = Image.open(os.path.join(HERE, name + '.jpg')).convert('RGB')
    iw, ih = src.size
    bx, by, bw, bh = box_on_source(fit, iw, ih)
    x0, y0, x1, y1 = bx * iw, by * ih, (bx + bw) * iw, (by + bh) * ih   # блок в точках оригинала (может выходить за снимок)
    cx0 = max(0, int(np.floor(x0)) - MARGIN); cy0 = max(0, int(np.floor(y0)) - MARGIN)
    cx1 = min(iw, int(np.ceil(x1)) + MARGIN); cy1 = min(ih, int(np.ceil(y1)) + MARGIN)
    crop = src.crop((cx0, cy0, cx1, cy1))
    sr = up.process_pil(crop)
    # холст «весь снимок в 4-кратном масштабе» с цветом края; SR-кусок кладём на место
    fill = edge_color(np.asarray(src))
    pad = int(max(0, -x0, -y0, x1 - iw, y1 - ih)) + 2
    W4, H4 = (iw + 2 * pad) * SCALE, (ih + 2 * pad) * SCALE
    canvas = Image.new('RGB', (W4, H4), fill)
    canvas.paste(sr, ((cx0 + pad) * SCALE, (cy0 + pad) * SCALE))
    fr = canvas.resize((FRAME_W, FRAME_H), Image.LANCZOS,
                       box=((x0 + pad) * SCALE, (y0 + pad) * SCALE, (x1 + pad) * SCALE, (y1 + pad) * SCALE))
    return fr, crop.size

def main():
    k = int(sys.argv[1]); n = int(sys.argv[2])
    fits = json.load(open(os.path.join(HERE, 'fits.json'), encoding='utf8'))
    names = sorted(fits)
    # самые тяжёлые (большой кусок) раздаём вперемешку
    mine = [nm for i, nm in enumerate(names) if i % n == k]
    up = rg.Realesrgan(gpuid=-1, model=4, tilesize=256)   # плитками: целиком кадр на процессоре съедает до 10 ГБ памяти
    for nm in mine:
        out = os.path.join(OUT, nm + '.jpg')
        if os.path.exists(out):
            continue
        t = time.time()
        try:
            fr, csz = process(nm, fits[nm], up)
            fr.save(out + '.tmp.jpg', quality=92, optimize=True)
            os.replace(out + '.tmp.jpg', out)
            print('ok', nm, csz, round(time.time() - t), 'с', flush=True)
        except Exception as e:
            print('ERR', nm, e, flush=True)

if __name__ == '__main__':
    main()
