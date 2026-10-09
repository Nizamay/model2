#!/usr/bin/env python3
"""Вшивает фото моделей из этой папки в index.html (блок FACTORY_MODEL_PHOTOS).

Файл — assets/source/models_2026/<Название модели>.jpg, положение рамки — в fits.json
(посчитано программой: автоподгонка либо вручную по контуру полотна).
Запуск из корня репозитория:  python3 assets/source/models_2026/build_models.py
"""
import base64, json, os, re, sys
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
SRC = os.path.dirname(os.path.abspath(__file__))
fits = json.load(open(os.path.join(SRC, 'fits.json')))
rows = []
for name in sorted(fits):
    path = os.path.join(SRC, name + '.jpg')
    if not os.path.exists(path):
        sys.exit('нет файла ' + path)
    b64 = base64.b64encode(open(path, 'rb').read()).decode()
    fit = fits[name]
    rows.append('    %s: { v: 1, fit: { zx: %r, zy: %r, dx: %r, dy: %r }, source: "data:image/jpeg;base64,%s" }'
                % (json.dumps(name, ensure_ascii=False), fit['zx'], fit['zy'], fit['dx'], fit['dy'], b64))
block = '  // FACTORY_MODEL_PHOTOS_BEGIN (собирается build_models.py из assets/source/models_2026)\n' \
        '  const FACTORY_MODEL_PHOTOS = {\n' + ',\n'.join(rows) + '\n  };\n' \
        '  // FACTORY_MODEL_PHOTOS_END'
idx = os.path.join(ROOT, 'index.html')
s = open(idx, encoding='utf-8').read()
pat = re.compile(r'  // FACTORY_MODEL_PHOTOS_BEGIN.*?// FACTORY_MODEL_PHOTOS_END', re.S)
if not pat.search(s):
    sys.exit('в index.html нет маркеров FACTORY_MODEL_PHOTOS_BEGIN/END')
s = pat.sub(lambda m: block, s, count=1)
open(idx, 'w', encoding='utf-8').write(s)
print('вшито моделей:', len(rows))

# Список моделей программы, у которых ещё нет вшитого фото (кроме «Матрицы»).
m = re.search(r'models: \[(.*?)\]\.map\(', s, re.S)
names = re.findall(r'"([^"]+)"', m.group(1)) if m else []
rm = re.search(r'const REMOVED_MODELS = \[(.*?)\];', s, re.S)
removed = set(re.findall(r'"([^"]+)"', rm.group(1))) if rm else set()
names = [n for n in names if n not in removed]
have = set(fits)
missing = [n for n in names if n not in have]
out = ['# Модели без вшитого фото\n', '\nСписок собирается `build_models.py` из `DB.models` (без «Матрицы»). '
       'Модели с названием, которого нет в программе, сюда не попадают — о них пишется в чате.\n',
       '\nВсего моделей: %d, с фото: %d, без фото: %d.\n\n' % (len(names), len([n for n in names if n in have]), len(missing))]
out += ['- %s\n' % n for n in missing]
open(os.path.join(SRC, 'НЕТ_ФОТО.md'), 'w', encoding='utf-8').write(''.join(out))
print('без фото:', len(missing))

