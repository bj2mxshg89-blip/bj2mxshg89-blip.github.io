import { readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { ROOT, isInsideRoot, isLocalReference, relativePath, resolveLocalReference } from "./lib/project.mjs";
import {
  analyzeModuleGraph,
  collectModuleConnections,
  versionFromSpecifier,
  withAssetVersion
} from "./lib/module-graph.mjs";

const CONFIG_FILE = path.join(ROOT, "config", "asset-version.json");
const command = process.argv[2] || "check";

function positiveVersion(value, label = "Версия") {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) {
    throw new Error(`${label} должна быть положительным целым числом.`);
  }
  return number;
}

async function configuredVersion() {
  let config;
  try {
    config = JSON.parse(await readFile(CONFIG_FILE, "utf8"));
  } catch (error) {
    throw new Error(`Не удалось прочитать config/asset-version.json: ${error.message}`);
  }
  return positiveVersion(config.version, "config.version");
}

async function validateConnections(version, { allowVersionMismatch = false } = {}) {
  const { connections } = await collectModuleConnections();
  const errors = [];

  for (const connection of connections) {
    const { file, specifier } = connection;
    if (!isLocalReference(specifier)) continue;
    const resolved = resolveLocalReference(file, specifier);
    if (!isInsideRoot(resolved)) {
      errors.push(`${relativePath(file)} → ${specifier}: путь выходит за пределы репозитория.`);
      continue;
    }
    try {
      await readFile(resolved);
    } catch {
      errors.push(`${relativePath(file)} → ${specifier}: файл ${relativePath(resolved)} не существует.`);
    }
    if (!allowVersionMismatch) {
      const actual = versionFromSpecifier(specifier);
      if (actual === null) errors.push(`${relativePath(file)} → ${specifier}: отсутствует версия.`);
      else if (actual !== version) errors.push(`${relativePath(file)} → ${specifier}: версия ${actual}, ожидается ${version}.`);
    }
  }
  return errors;
}

async function plannedSourceUpdates(version) {
  const { connections } = await collectModuleConnections();
  const grouped = new Map();
  const errors = await validateConnections(version, { allowVersionMismatch: true });
  if (errors.length) throw new Error(errors.join("\n"));

  for (const connection of connections) {
    if (!isLocalReference(connection.specifier)) continue;
    const next = withAssetVersion(connection.specifier, version);
    if (next === connection.specifier) continue;
    if (!grouped.has(connection.file)) grouped.set(connection.file, []);
    grouped.get(connection.file).push({ ...connection, replacement: next });
  }

  const updates = new Map();
  for (const [file, replacements] of grouped) {
    let source = await readFile(file, "utf8");
    replacements.sort((left, right) => right.start - left.start).forEach(({ start, end, replacement }) => {
      source = `${source.slice(0, start)}${replacement}${source.slice(end)}`;
    });
    updates.set(file, source);
  }
  return updates;
}

async function writeTransaction(updates) {
  if (!updates.size) return;
  const originals = new Map();
  const temporary = new Map();

  try {
    for (const [file, content] of updates) {
      originals.set(file, await readFile(file, "utf8"));
      const temp = `${file}.asset-sync-${process.pid}.tmp`;
      temporary.set(file, temp);
      await writeFile(temp, content, "utf8");
    }
    for (const [file, temp] of temporary) await rename(temp, file);
  } catch (error) {
    for (const [file, content] of originals) {
      try { await writeFile(file, content, "utf8"); } catch { /* best-effort rollback */ }
    }
    for (const temp of temporary.values()) {
      try { await unlink(temp); } catch { /* already renamed or absent */ }
    }
    throw error;
  }
}

async function check(version) {
  const graph = await analyzeModuleGraph(version);
  if (graph.errors.length) {
    throw new Error(`Проверка версии ассетов не пройдена:\n- ${graph.errors.join("\n- ")}`);
  }
  console.log(`Версия ассетов ${version}: ${graph.connections.length} подключений согласованы.`);
}

async function sync(version, includeConfig = false) {
  const updates = await plannedSourceUpdates(version);
  if (includeConfig) updates.set(CONFIG_FILE, `${JSON.stringify({ version }, null, 2)}\n`);
  await writeTransaction(updates);
  await check(version);
  console.log(updates.size ? `Обновлено файлов: ${updates.size}.` : "Изменения не требуются.");
}

try {
  if (command === "check") {
    await check(await configuredVersion());
  } else if (command === "sync") {
    await sync(await configuredVersion());
  } else if (command === "bump") {
    const version = positiveVersion(process.argv[3], "Новая версия");
    await sync(version, true);
  } else {
    throw new Error(`Неизвестная команда «${command}». Используйте check, sync или bump.`);
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
