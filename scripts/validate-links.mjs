import { access, readFile } from "node:fs/promises";
import path from "node:path";
import {
  ROOT,
  hasProtocol,
  isAllowedExternalUrl,
  isInsideRoot,
  relativePath,
  resolveLocalReference,
  splitSpecifier,
  walkFiles
} from "./lib/project.mjs";
import { fallbackCardLinks, htmlAttributes } from "./lib/html.mjs";

const errors = [];
const catalogFile = path.join(ROOT, "data", "catalog.json");
const indexFile = path.join(ROOT, "index.html");
const catalog = JSON.parse(await readFile(catalogFile, "utf8"));

async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

function isIgnored(value) {
  return !value || value.startsWith("#") || /^(mailto|tel):/i.test(value);
}

async function validateLocalTarget(fromFile, value, label) {
  if (isIgnored(value)) return;
  if (hasProtocol(value)) {
    if (!isAllowedExternalUrl(value)) errors.push(`${label}: недопустимый протокол в «${value}».`);
    return;
  }
  if (value.startsWith("//")) {
    errors.push(`${label}: URL без явного протокола запрещён — «${value}».`);
    return;
  }
  const resolved = resolveLocalReference(fromFile, value);
  if (!isInsideRoot(resolved)) {
    errors.push(`${label}: путь «${value}» выходит за пределы репозитория.`);
  } else if (!(await exists(resolved))) {
    errors.push(`${label}: локальный файл «${relativePath(resolved)}» не найден.`);
  }
}

for (const item of catalog.items) {
  const label = `Каталог «${item.id}»`;
  if (hasProtocol(item.url)) {
    if (!isAllowedExternalUrl(item.url)) errors.push(`${label}: разрешены только внешние HTTPS-ссылки.`);
    continue;
  }

  const parsed = new URL(item.url, "https://catalog.local/");
  const pathname = parsed.pathname.replace(/^\//, "");
  if (pathname === "test.html") {
    const testId = parsed.searchParams.get("id")?.trim();
    if (!testId) {
      errors.push(`${label}: для test.html отсутствует параметр id.`);
      continue;
    }
    const definitionFile = path.join(ROOT, "data", "tests", `${testId}.json`);
    if (!(await exists(definitionFile))) {
      errors.push(`${label}: файл data/tests/${testId}.json не найден.`);
    } else {
      const definition = JSON.parse(await readFile(definitionFile, "utf8"));
      if (definition.id !== testId) {
        errors.push(`${label}: параметр id «${testId}» не совпадает с test.id «${definition.id}».`);
      }
    }
    if (!(await exists(path.join(ROOT, "results.html")))) {
      errors.push(`${label}: results.html для истории универсального теста не найден.`);
    }
    const historyUrl = `results.html?id=${encodeURIComponent(testId)}`;
    if (new URL(historyUrl, "https://catalog.local/").searchParams.get("id") !== testId) {
      errors.push(`${label}: не удалось корректно построить URL истории.`);
    }
  } else {
    await validateLocalTarget(indexFile, item.url, label);
    if (!pathname.endsWith(".html")) errors.push(`${label}: локальная карточка должна вести на HTML-файл.`);
  }
}

const indexSource = await readFile(indexFile, "utf8");
const fallbackLinks = fallbackCardLinks(indexSource);
const visibleUrls = catalog.items.filter((item) => item.status !== "hidden").map((item) => item.url);
const hiddenUrls = new Set(catalog.items.filter((item) => item.status === "hidden").map((item) => item.url));

if (fallbackLinks.length !== visibleUrls.length) {
  errors.push(
    `Резервный каталог: найдено ${fallbackLinks.length} карточек, ожидается ${visibleUrls.length} видимых карточек.`
  );
}
visibleUrls.forEach((url) => {
  const count = fallbackLinks.filter((candidate) => candidate === url).length;
  if (count !== 1) errors.push(`Резервный каталог: ссылка «${url}» должна встречаться ровно один раз, найдено ${count}.`);
});
fallbackLinks.forEach((url) => {
  if (hiddenUrls.has(url)) errors.push(`Резервный каталог: hidden-ссылка «${url}» не должна отображаться.`);
});

const htmlFiles = await walkFiles(ROOT, (file) => file.endsWith(".html"));
let checkedAttributes = 0;
for (const file of htmlFiles) {
  const source = await readFile(file, "utf8");
  for (const attribute of htmlAttributes(source, ["href", "src"])) {
    checkedAttributes += 1;
    await validateLocalTarget(
      file,
      attribute.value,
      `${relativePath(file)}: ${attribute.name}`
    );
  }
}

if (errors.length) {
  console.error(`Проверка ссылок не пройдена (${errors.length}):\n- ${errors.join("\n- ")}`);
  process.exitCode = 1;
} else {
  console.log(
    `Ссылки корректны: ${catalog.items.length} элементов каталога, ` +
    `${fallbackLinks.length} резервных карточек, ${htmlFiles.length} HTML-файлов, ` +
    `${checkedAttributes} атрибутов href/src.`
  );
}
