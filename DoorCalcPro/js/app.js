(function () {
  "use strict";

  const state = {
    modelId: null,
    material: "пвх",
    color: null,
    glassId: "none",
    height: DB.standard.height,
    width: DB.standard.widths[3], // 800 по умолчанию
    thickness: DB.standard.thickness,
    options: {},   // { optionId: true | choiceIndex }
    discount: 0
  };

  const el = {
    model: document.getElementById("model"),
    material: document.getElementById("material"),
    color: document.getElementById("color"),
    glass: document.getElementById("glass"),
    height: document.getElementById("height"),
    width: document.getElementById("width"),
    thickness: document.getElementById("thickness"),
    sizeBadge: document.getElementById("sizeBadge"),
    thicknessWarning: document.getElementById("thicknessWarning"),
    options: document.getElementById("options"),
    discount: document.getElementById("discount"),
    breakdown: document.getElementById("breakdown"),
    total: document.getElementById("total"),
    doorLeafRect: document.getElementById("doorLeafRect"),
    doorFillGradient: document.getElementById("doorFillGradient"),
    doorGlassGroup: document.getElementById("doorGlassGroup"),
    doorHandleGroup: document.getElementById("doorHandleGroup")
  };

  function getModel(id) {
    return DB.models.find((m) => m.id === id);
  }

  // --- Механика закраски превью двери ---------------------------------

  function hexToRgb(hex) {
    const clean = hex.replace("#", "");
    const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
    const num = parseInt(full, 16);
    return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
  }

  function rgbToHex(r, g, b) {
    return "#" + [r, g, b]
      .map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0"))
      .join("");
  }

  // Осветление (percent > 0) или затемнение (percent < 0) цвета —
  // используется, чтобы закраска двери выглядела объёмно/естественно.
  function shade(hex, percent) {
    const { r, g, b } = hexToRgb(hex);
    const target = percent < 0 ? 0 : 255;
    const p = Math.abs(percent) / 100;
    return rgbToHex(r + (target - r) * p, g + (target - g) * p, b + (target - b) * p);
  }

  function getColorFill(colorName) {
    return (DB.colorFills && DB.colorFills[colorName]) || { base: "#c9cbcd", kind: "solid" };
  }

  function buildGradientStops(fill) {
    if (fill.kind === "wood") {
      const grain = fill.grain || shade(fill.base, -18);
      return [
        { offset: "0%", color: shade(fill.base, 12) },
        { offset: "32%", color: fill.base },
        { offset: "48%", color: grain, opacity: 0.85 },
        { offset: "62%", color: fill.base },
        { offset: "100%", color: shade(fill.base, -12) }
      ];
    }
    return [
      { offset: "0%", color: shade(fill.base, 14) },
      { offset: "100%", color: shade(fill.base, -10) }
    ];
  }

  function applyGradientStops(gradientEl, stops) {
    gradientEl.innerHTML = stops
      .map((s) => `<stop offset="${s.offset}" stop-color="${s.color}"${s.opacity != null ? ` stop-opacity="${s.opacity}"` : ""}/>`)
      .join("");
  }

  const DOOR_VB_W = 220;
  const DOOR_VB_H = 400;
  const DOOR_PAD = 18;

  function renderDoorPreview() {
    const width = Math.max(Number(state.width) || 0, 1);
    const height = Math.max(Number(state.height) || 0, 1);
    const aspect = width / height;

    const availW = DOOR_VB_W - DOOR_PAD * 2;
    const availH = DOOR_VB_H - DOOR_PAD * 2;

    let w, h;
    if (availW / aspect <= availH) {
      w = availW;
      h = w / aspect;
    } else {
      h = availH;
      w = h * aspect;
    }

    const x = (DOOR_VB_W - w) / 2;
    const y = DOOR_PAD + (availH - h); // дверь стоит на полу — выравниваем по низу

    el.doorLeafRect.setAttribute("x", x);
    el.doorLeafRect.setAttribute("y", y);
    el.doorLeafRect.setAttribute("width", w);
    el.doorLeafRect.setAttribute("height", h);
    el.doorLeafRect.setAttribute("rx", Math.min(w, h) * 0.015);

    applyGradientStops(el.doorFillGradient, buildGradientStops(getColorFill(state.color)));

    const stileW = w * 0.09;
    const topRail = h * 0.06;

    if (state.glassId === "none") {
      // Глухая дверь — обычное полотно без остекления.
      el.doorGlassGroup.innerHTML = "";
    } else {
      // Остекление — пока 6 одинаковых квадратных стекол (2 колонки × 3 ряда).
      const zoneTop = y + topRail;
      const zoneBottom = y + h * 0.64;
      const zoneLeft = x + stileW;
      const zoneRight = x + w - stileW;
      const zoneW = zoneRight - zoneLeft;
      const zoneH = zoneBottom - zoneTop;

      const cols = 2;
      const rows = 3;
      const gap = w * 0.045;
      const sByWidth = (zoneW - (cols + 1) * gap) / cols;
      const sByHeight = (zoneH - (rows + 1) * gap) / rows;
      const s = Math.max(4, Math.min(sByWidth, sByHeight));

      const gridW = cols * s + (cols + 1) * gap;
      const gridH = rows * s + (rows + 1) * gap;
      const offsetX = zoneLeft + (zoneW - gridW) / 2;
      const offsetY = zoneTop + (zoneH - gridH) / 2;

      let panes = "";
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const px = offsetX + gap + c * (s + gap);
          const py = offsetY + gap + r * (s + gap);
          panes += `<rect x="${px}" y="${py}" width="${s}" height="${s}" rx="${s * 0.06}" fill="url(#glassFillGradient)" stroke="rgba(255,255,255,.5)" stroke-width="1"/>`;
        }
      }
      el.doorGlassGroup.innerHTML = panes;
    }

    // Ручка есть на любой двери, независимо от остекления.
    const handleY = y + h * 0.47;
    const handleThickness = Math.max(2, w * 0.018);
    const plateH = h * 0.09;
    const plateX = x + w - stileW * 0.62;
    const leverLen = w * 0.14;

    el.doorHandleGroup.innerHTML = `
      <rect x="${plateX - handleThickness}" y="${handleY - plateH / 2}" width="${handleThickness * 2}" height="${plateH}" rx="${handleThickness}" fill="#cfd3d6" stroke="#8b8f93" stroke-width="0.6"/>
      <rect x="${plateX - leverLen}" y="${handleY - handleThickness / 2}" width="${leverLen}" height="${handleThickness}" rx="${handleThickness / 2}" fill="#cfd3d6" stroke="#8b8f93" stroke-width="0.6"/>
      <circle cx="${plateX}" cy="${handleY + plateH * 0.32}" r="${handleThickness * 0.55}" fill="#6f7377"/>
    `;
  }

  function roundUp10(value) {
    return Math.ceil(value / 10) * 10;
  }

  function isStandardSize(height, width, thickness) {
    return (
      height === DB.standard.height &&
      DB.standard.widths.includes(width) &&
      thickness === DB.standard.thickness
    );
  }

  function findCategory(material, color) {
    const groups = DB.colors[material] || {};
    for (const category of Object.keys(groups)) {
      if (groups[category].includes(color)) return Number(category);
    }
    return null;
  }

  function populateModels() {
    el.model.innerHTML = DB.models
      .map((m) => `<option value="${m.id}">${m.name}</option>`)
      .join("");
    state.modelId = DB.models[0].id;
  }

  function availableMaterials(model) {
    // Раздел 11 ТЗ: сборные двери в эмали быть не могут.
    if (model.type === "сборное") return ["пвх"];
    return ["пвх", "эмаль"];
  }

  function populateMaterial() {
    const model = getModel(state.modelId);
    const materials = availableMaterials(model);
    el.material.innerHTML = materials
      .map((m) => `<option value="${m}">${m === "пвх" ? "Пленка ПВХ" : "Эмаль"}</option>`)
      .join("");
    if (!materials.includes(state.material)) state.material = materials[0];
    el.material.value = state.material;
  }

  function populateColors() {
    const groups = DB.colors[state.material] || {};
    const optionsHtml = Object.keys(groups)
      .sort()
      .map((cat) => groups[cat].map((c) => `<option value="${c}">${c}</option>`).join(""))
      .join("");
    el.color.innerHTML = optionsHtml;
    const allColors = Object.values(groups).flat();
    if (!allColors.includes(state.color)) state.color = allColors[0];
    el.color.value = state.color;
  }

  function populateGlass() {
    el.glass.innerHTML = DB.glass
      .map((g) => `<option value="${g.id}">${g.name}</option>`)
      .join("");
    el.glass.value = state.glassId;
  }

  function populateOptions() {
    const optionDefs = DB.options[state.material] || [];
    state.options = {};
    el.options.innerHTML = optionDefs
      .map((opt) => {
        if (opt.kind === "checkbox") {
          state.options[opt.id] = false;
          return `
            <label class="option-row">
              <input type="checkbox" data-opt="${opt.id}" data-kind="checkbox">
              <span>${opt.name}</span>
              <span class="option-price">+${opt.price} ₽</span>
            </label>`;
        }
        // radio group
        state.options[opt.id] = 0;
        const choices = opt.choices
          .map(
            (c, i) => `
              <label class="option-choice">
                <input type="radio" name="opt-${opt.id}" data-opt="${opt.id}" data-kind="radio" value="${i}" ${i === 0 ? "checked" : ""}>
                <span>${c.label}</span>
                <span class="option-price">${c.price ? "+" + c.price + " ₽" : ""}</span>
              </label>`
          )
          .join("");
        return `
          <div class="option-group">
            <div class="option-group-title">${opt.name}</div>
            <div class="option-choices">${choices}</div>
          </div>`;
      })
      .join("");
  }

  function sumSelectedOptions() {
    const optionDefs = DB.options[state.material] || [];
    let sum = 0;
    const lines = [];
    optionDefs.forEach((opt) => {
      if (opt.kind === "checkbox") {
        if (state.options[opt.id]) {
          sum += opt.price;
          lines.push(`${opt.name}: +${opt.price} ₽`);
        }
      } else {
        const idx = state.options[opt.id] || 0;
        const choice = opt.choices[idx];
        if (choice && choice.price) {
          sum += choice.price;
          lines.push(`${opt.name} (${choice.label}): +${choice.price} ₽`);
        }
      }
    });
    return { sum, lines };
  }

  function updateSizeUI() {
    const standard = isStandardSize(state.height, state.width, state.thickness);
    el.sizeBadge.textContent = standard ? "Стандарт" : "Нестандарт (+30%)";
    el.sizeBadge.className = "badge " + (standard ? "badge-ok" : "badge-warn");

    const model = getModel(state.modelId);
    const thicknessInvalid = state.thickness === 42 && model.type !== "щитовое";
    el.thicknessWarning.style.display = thicknessInvalid ? "block" : "none";
  }

  function render() {
    const model = getModel(state.modelId);
    const category = findCategory(state.material, state.color);
    const surcharge = category != null ? (DB.categorySurcharge[state.material][category] || 0) : 0;

    let leafPrice = model.basePrice + surcharge;
    const standard = isStandardSize(state.height, state.width, state.thickness);
    const leafBeforeNonstandard = leafPrice;
    if (!standard) leafPrice = roundUp10(leafPrice * 1.3);

    const { sum: optionsSum, lines: optionLines } = sumSelectedOptions();
    const glass = DB.glass.find((g) => g.id === state.glassId);
    const glassPrice = glass ? glass.price : 0;

    const subtotal = leafPrice + optionsSum + glassPrice;
    const discount = Number(state.discount) || 0;
    const total = Math.round(subtotal * (1 - discount / 100));

    updateSizeUI();
    renderDoorPreview();

    const rows = [];
    rows.push(`Полотно (${model.name}): ${leafBeforeNonstandard} ₽`);
    if (!standard) rows.push(`Наценка за нестандарт (×1.3, округление вверх до 10 ₽): ${leafPrice} ₽`);
    optionLines.forEach((l) => rows.push(l));
    if (glassPrice) rows.push(`Стекло (${glass.name}): +${glassPrice} ₽`);
    rows.push(`Подытог: ${subtotal} ₽`);
    if (discount) rows.push(`Скидка ${discount}%: -${Math.round(subtotal * discount / 100)} ₽`);

    el.breakdown.innerHTML = rows.map((r) => `<div class="breakdown-row">${r}</div>`).join("");
    el.total.textContent = total.toLocaleString("ru-RU") + " ₽";
  }

  function bind() {
    el.model.addEventListener("change", () => {
      state.modelId = el.model.value;
      populateMaterial();
      populateColors();
      populateOptions();
      render();
    });
    el.material.addEventListener("change", () => {
      state.material = el.material.value;
      populateColors();
      populateOptions();
      render();
    });
    el.color.addEventListener("change", () => {
      state.color = el.color.value;
      render();
    });
    el.glass.addEventListener("change", () => {
      state.glassId = el.glass.value;
      render();
    });
    [el.height, el.width, el.thickness].forEach((input) => {
      input.addEventListener("input", () => {
        state.height = Number(el.height.value) || 0;
        state.width = Number(el.width.value) || 0;
        state.thickness = Number(el.thickness.value) || 0;
        render();
      });
    });
    el.options.addEventListener("change", (e) => {
      const target = e.target;
      if (!target.dataset.opt) return;
      if (target.dataset.kind === "checkbox") {
        state.options[target.dataset.opt] = target.checked;
      } else {
        state.options[target.dataset.opt] = Number(target.value);
      }
      render();
    });
    el.discount.addEventListener("input", () => {
      state.discount = el.discount.value;
      render();
    });
  }

  function init() {
    populateModels();
    populateMaterial();
    populateColors();
    populateGlass();
    populateOptions();
    el.height.value = state.height;
    el.width.value = state.width;
    el.thickness.value = state.thickness;
    el.discount.value = state.discount;
    bind();
    render();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
