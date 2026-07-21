import { TestLoadError, fetchJson } from "./utils.js";

const VALID_STATUSES = new Set(["active", "beta", "hidden"]);

export async function loadCatalog(url = "data/catalog.json") {
  const catalog = await fetchJson(url);
  const errors = validateCatalog(catalog);
  if (errors.length) throw new TestLoadError("Каталог содержит ошибки.", errors);
  return catalog;
}

export function visibleCatalogItems(catalog) {
  return catalog.items.filter((item) => item.status !== "hidden");
}

export function validateCatalog(catalog) {
  const errors = [];
  if (!catalog || typeof catalog !== "object" || Array.isArray(catalog)) {
    return ["Корневое значение каталога должно быть объектом."];
  }
  if (catalog.schemaVersion !== 1) errors.push("Поле «schemaVersion» каталога должно быть равно 1.");
  if (!Array.isArray(catalog.items)) return [...errors, "Поле «items» должно быть массивом."];

  const ids = new Set();
  catalog.items.forEach((item, index) => {
    const label = item?.id || `позиция ${index + 1}`;
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      errors.push(`Элемент ${index + 1} должен быть объектом.`);
      return;
    }
    if (typeof item.id !== "string" || !item.id) errors.push(`Элемент ${index + 1}: отсутствует id.`);
    else if (ids.has(item.id)) errors.push(`Повторяется id каталога «${item.id}».`);
    ids.add(item.id);

    ["title", "description", "section", "symbol", "color", "url"].forEach((field) => {
      if (typeof item[field] !== "string" || !item[field].trim()) {
        errors.push(`Элемент «${label}»: поле «${field}» должно быть непустой строкой.`);
      }
    });
    if (!VALID_STATUSES.has(item.status)) {
      errors.push(`Элемент «${label}»: недопустимый статус «${String(item.status)}».`);
    }
    if (!Number.isInteger(item.questionCount) || item.questionCount < 0) {
      errors.push(`Элемент «${label}»: questionCount должен быть неотрицательным целым числом.`);
    }
    if (!Array.isArray(item.modes)) errors.push(`Элемент «${label}»: modes должен быть массивом.`);
  });
  return errors;
}
