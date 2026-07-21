import { readFile } from "node:fs/promises";
import path from "node:path";
import { analyzeModuleGraph } from "./lib/module-graph.mjs";
import { ROOT, relativePath } from "./lib/project.mjs";

const config = JSON.parse(await readFile(path.join(ROOT, "config", "asset-version.json"), "utf8"));
const expectedVersion = Number(config.version);
const errors = [];

if (!Number.isInteger(expectedVersion) || expectedVersion < 1) {
  errors.push("config/asset-version.json: version должна быть положительным целым числом.");
}

const graph = await analyzeModuleGraph(expectedVersion);
errors.push(...graph.errors);

const universalModules = [
  "assets/js/trainer-engine.js",
  "assets/js/question-types.js",
  "assets/js/question-renderers.js",
  "assets/js/grading.js",
  "assets/js/storage.js",
  "assets/js/results.js"
];

const forbiddenPatterns = [
  {
    label: "сравнение test.id с литералом",
    pattern: /(?:this\.)?test\.id\s*(?:===|==|!==|!=)\s*["'`]/g
  },
  {
    label: "switch по test.id",
    pattern: /switch\s*\(\s*(?:this\.)?test\.id\s*\)/g
  },
  {
    label: "строковая специализация test.id",
    pattern: /(?:this\.)?test\.id\s*\.\s*(?:includes|startsWith|endsWith)\s*\(/g
  }
];

for (const relative of universalModules) {
  const file = path.join(ROOT, relative);
  const source = await readFile(file, "utf8");
  forbiddenPatterns.forEach(({ label, pattern }) => {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(source))) {
      const line = source.slice(0, match.index).split("\n").length;
      errors.push(`${relative}:${line}: запрещена специализация логики — ${label}.`);
    }
  });
}

if (graph.orphanModules.length) {
  errors.push(
    `Модули без HTML-точки входа: ${graph.orphanModules.map(relativePath).join(", ")}.`
  );
}

if (errors.length) {
  console.error(`Проверка модульного графа не пройдена (${errors.length}):\n- ${errors.join("\n- ")}`);
  process.exitCode = 1;
} else {
  console.log(
    `Модульный граф корректен: версия ${expectedVersion}, ${graph.entrypoints.length} HTML-точки входа, ` +
    `${graph.moduleCount} модулей, ${graph.connections.length} связей, циклов нет.`
  );
  graph.entrypoints.forEach(({ html, module }) => {
    console.log(`- ${relativePath(html)} → ${relativePath(module)}`);
  });
}
