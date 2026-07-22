import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { validateCatalog } from "../assets/js/catalog.js";
import { ROOT, relativePath } from "./lib/project.mjs";
import { validateParsedJson, validateTestContent } from "./lib/data-validation.mjs";

const catalogFile = path.join(ROOT, "data", "catalog.json");
const testsDirectory = path.join(ROOT, "data", "tests");
const errors = [];
const reports = [];

async function parseJson(file) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    errors.push(`${relativePath(file)}: некорректный JSON — ${error.message}`);
    return null;
  }
}

const catalog = await parseJson(catalogFile);
if (catalog) {
  errors.push(...validateCatalog(catalog).map((message) => `data/catalog.json: ${message}`));
  errors.push(...validateParsedJson(catalog, "Каталог"));
}

const testFiles = (await readdir(testsDirectory))
  .filter((name) => name.endsWith(".json"))
  .sort((left, right) => left.localeCompare(right, "en"));

for (const name of testFiles) {
  const file = path.join(testsDirectory, name);
  const test = await parseJson(file);
  if (!test) continue;
  const expectedId = path.basename(name, ".json");
  const result = validateTestContent(test, expectedId);
  errors.push(...result.errors.map((message) => `${relativePath(file)}: ${message}`));
  reports.push({
    id: test.id,
    questions: Array.isArray(test.questions) ? test.questions.length : 0,
    variants: Array.isArray(test.variants) ? test.variants.length : 0,
    attempts: result.attemptMaximums
  });
}

if (errors.length) {
  console.error(`Валидация данных не пройдена (${errors.length}):\n- ${errors.join("\n- ")}`);
  process.exitCode = 1;
} else {
  const questionCount = reports.reduce((sum, report) => sum + report.questions, 0);
  console.log(
    `Данные корректны: каталог, ${reports.length} теста, ${questionCount} вопросов, ` +
    `${reports.reduce((sum, report) => sum + report.attempts.length, 0)} рассчитанных максимумов попытки.`
  );
  reports.forEach((report) => {
    const maxima = report.attempts
      .map((attempt) => {
        const maximum = attempt.dynamic ? `${attempt.minimum}–${attempt.maximum}` : attempt.maximum;
        return `${attempt.variantId}/${attempt.mode}: ${attempt.questions} → ${maximum}`;
      })
      .join(", ");
    console.log(`- ${report.id}: ${report.questions} вопросов, ${report.variants} вариантов; ${maxima}`);
  });
}
