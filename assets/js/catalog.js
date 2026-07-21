import { TestLoadError, fetchJson, isPlainObject } from "./utils.js";

const CATALOG_SCHEMA_VERSION = 2;
const ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;
const COLOR_PATTERN = /^#[0-9a-f]{6}$/i;
const VALID_STATUSES = new Set(["active", "beta", "hidden"]);
const REQUIRED_ITEM_STRINGS = [
  "id", "title", "description", "section", "kicker", "symbol", "color",
  "softColor", "meta", "url", "linkLabel", "status"
];

export async function loadCatalog(url = "data/catalog.json") {
  let catalog;
  try {
    catalog = await fetchJson(url, {
      resourceName: "каталог",
      notFoundMessage: "Файл каталога не найден."
    });
  } catch (error) {
    if (error instanceof TestLoadError) throw error;
    throw new TestLoadError("Не удалось загрузить каталог.", [String(error)]);
  }

  const errors = validateCatalog(catalog);
  if (errors.length) throw new TestLoadError("Каталог содержит ошибки.", errors);
  return catalog;
}

export function visibleCatalogItems(catalog) {
  return catalog.items.filter((item) => item.status !== "hidden");
}

export function isSafeCatalogUrl(value) {
  if (typeof value !== "string" || !value.trim()) return false;
  const normalized = value.trim().replace(/[\u0000-\u0020]+/g, "").toLowerCase();
  if (/^(javascript|data|vbscript):/.test(normalized)) return false;

  try {
    const parsed = new URL(value, "https://catalog.local/");
    return parsed.protocol === "https:" || (parsed.origin === "https://catalog.local" && parsed.protocol === "https:");
  } catch {
    return false;
  }
}

export function validateCatalog(catalog) {
  const errors = [];
  if (!isPlainObject(catalog)) return ["Корневое значение каталога должно быть объектом."];

  if (catalog.schemaVersion !== CATALOG_SCHEMA_VERSION) {
    errors.push(
      `Неподдерживаемая версия схемы каталога: ${String(catalog.schemaVersion)}. ` +
      `Ожидается ${CATALOG_SCHEMA_VERSION}.`
    );
  }

  const sectionIds = validateSections(catalog.sections, errors);
  validateItems(catalog.items, sectionIds, errors);
  return errors;
}

function validateSections(sections, errors) {
  const ids = new Set();
  if (!Array.isArray(sections) || sections.length === 0) {
    errors.push("Поле «sections» должно быть непустым массивом.");
    return ids;
  }

  sections.forEach((section, index) => {
    const label = isPlainObject(section) && section.id ? `«${section.id}»` : `${index + 1}`;
    if (!isPlainObject(section)) {
      errors.push(`Раздел ${index + 1} должен быть объектом.`);
      return;
    }

    if (typeof section.id !== "string" || !ID_PATTERN.test(section.id)) {
      errors.push(`Раздел ${label}: id должен содержать строчные латинские буквы, цифры и дефисы.`);
    } else if (ids.has(section.id)) {
      errors.push(`Повторяется id раздела «${section.id}».`);
    } else {
      ids.add(section.id);
    }

    ["title", "kicker", "description", "color"].forEach((field) => {
      if (typeof section[field] !== "string" || !section[field].trim()) {
        errors.push(`Раздел ${label}: поле «${field}» должно быть непустой строкой.`);
      }
    });
    if (typeof section.color === "string" && !COLOR_PATTERN.test(section.color)) {
      errors.push(`Раздел ${label}: color должен быть цветом в формате #RRGGBB.`);
    }
    if (!Number.isFinite(section.order)) {
      errors.push(`Раздел ${label}: order должен быть конечным числом.`);
    }

    if (!isPlainObject(section.countWords)) {
      errors.push(`Раздел ${label}: countWords должен быть объектом.`);
    } else {
      ["one", "few", "many"].forEach((form) => {
        if (typeof section.countWords[form] !== "string" || !section.countWords[form].trim()) {
          errors.push(`Раздел ${label}: countWords.${form} должно быть непустой строкой.`);
        }
      });
    }
  });
  return ids;
}

function validateItems(items, sectionIds, errors) {
  const ids = new Set();
  if (!Array.isArray(items)) {
    errors.push("Поле «items» должно быть массивом.");
    return;
  }

  items.forEach((item, index) => {
    const label = isPlainObject(item) && item.id ? `«${item.id}»` : `${index + 1}`;
    if (!isPlainObject(item)) {
      errors.push(`Элемент ${index + 1} должен быть объектом.`);
      return;
    }

    REQUIRED_ITEM_STRINGS.forEach((field) => {
      if (typeof item[field] !== "string" || !item[field].trim()) {
        errors.push(`Элемент ${label}: поле «${field}» должно быть непустой строкой.`);
      }
    });

    if (typeof item.id === "string" && !ID_PATTERN.test(item.id)) {
      errors.push(`Элемент ${label}: id должен содержать строчные латинские буквы, цифры и дефисы.`);
    } else if (ids.has(item.id)) {
      errors.push(`Повторяется id каталога «${item.id}».`);
    } else if (typeof item.id === "string") {
      ids.add(item.id);
    }

    if (typeof item.section === "string" && !sectionIds.has(item.section)) {
      errors.push(`Элемент ${label}: раздел «${item.section}» не существует.`);
    }
    if (!VALID_STATUSES.has(item.status)) {
      errors.push(`Элемент ${label}: недопустимый статус «${String(item.status)}».`);
    }
    ["color", "softColor"].forEach((field) => {
      if (typeof item[field] === "string" && !COLOR_PATTERN.test(item[field])) {
        errors.push(`Элемент ${label}: ${field} должен быть цветом в формате #RRGGBB.`);
      }
    });
    if (!Number.isInteger(item.questionCount) || item.questionCount < 0) {
      errors.push(`Элемент ${label}: questionCount должен быть неотрицательным целым числом.`);
    }
    if (!Array.isArray(item.modes) || item.modes.length === 0 || item.modes.some((mode) => typeof mode !== "string" || !mode.trim())) {
      errors.push(`Элемент ${label}: modes должен быть непустым массивом непустых строк.`);
    }
    if (!Number.isFinite(item.order)) errors.push(`Элемент ${label}: order должен быть конечным числом.`);
    if (item.wide !== undefined && typeof item.wide !== "boolean") {
      errors.push(`Элемент ${label}: wide должно быть логическим значением.`);
    }
    if (item.badge !== undefined && (typeof item.badge !== "string" || !item.badge.trim())) {
      errors.push(`Элемент ${label}: badge должно быть непустой строкой.`);
    }
    if (typeof item.url === "string" && !isSafeCatalogUrl(item.url)) {
      errors.push(`Элемент ${label}: URL «${item.url}» недопустим или небезопасен.`);
    }
  });
}
