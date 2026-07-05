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
    total: document.getElementById("total")
  };

  function getModel(id) {
    return DB.models.find((m) => m.id === id);
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
