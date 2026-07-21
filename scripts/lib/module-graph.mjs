import { access } from "node:fs/promises";
import path from "node:path";
import {
  ASSET_JS_ROOT,
  ROOT,
  hasProtocol,
  isInsideDirectory,
  isInsideRoot,
  isLocalReference,
  relativePath,
  resolveLocalReference,
  splitSpecifier,
  walkFiles,
  readText
} from "./project.mjs";

const STATIC_IMPORT_PATTERNS = [
  /(?:^|\n)\s*(?:import|export)\s+[\w$*\s{},]+?\s+from\s*(["'])([^"']+)\1/g,
  /(?:^|\n)\s*import\s*(["'])([^"']+)\1/g
];
const ATTRIBUTE_PATTERN = /([:\w-]+)\s*=\s*(["'])(.*?)\2/gs;
const MODULE_SCRIPT_PATTERN = /<script\b([^>]*)>/gi;

export function findStaticImports(source) {
  const imports = [];
  for (const pattern of STATIC_IMPORT_PATTERNS) {
    let match;
    pattern.lastIndex = 0;
    while ((match = pattern.exec(source))) {
      const specifier = match[2];
      const relativeIndex = match[0].lastIndexOf(specifier);
      imports.push({
        specifier,
        start: match.index + relativeIndex,
        end: match.index + relativeIndex + specifier.length
      });
    }
  }
  return imports
    .filter((item, index, items) => items.findIndex((candidate) => candidate.start === item.start) === index)
    .sort((left, right) => left.start - right.start);
}

export function parseAttributes(fragment) {
  const attributes = new Map();
  let match;
  ATTRIBUTE_PATTERN.lastIndex = 0;
  while ((match = ATTRIBUTE_PATTERN.exec(fragment))) {
    attributes.set(match[1].toLowerCase(), {
      value: match[3],
      start: match.index + match[0].indexOf(match[3]),
      end: match.index + match[0].indexOf(match[3]) + match[3].length
    });
  }
  return attributes;
}

export function findHtmlModuleEntries(source) {
  const entries = [];
  let match;
  MODULE_SCRIPT_PATTERN.lastIndex = 0;
  while ((match = MODULE_SCRIPT_PATTERN.exec(source))) {
    const attributes = parseAttributes(match[1]);
    const type = attributes.get("type")?.value?.toLowerCase();
    const src = attributes.get("src");
    if (type !== "module" || !src) continue;
    const tagOffset = match.index + match[0].indexOf(match[1]);
    entries.push({
      specifier: src.value,
      start: tagOffset + src.start,
      end: tagOffset + src.end
    });
  }
  return entries;
}

export function versionFromSpecifier(specifier) {
  const { search } = splitSpecifier(specifier);
  const values = new URLSearchParams(search).getAll("v");
  return values.length === 1 && /^\d+$/.test(values[0]) ? Number(values[0]) : null;
}

export function withAssetVersion(specifier, version) {
  const { pathname, search, hash } = splitSpecifier(specifier);
  const params = new URLSearchParams(search);
  params.delete("v");
  params.append("v", String(version));
  return `${pathname}?${params.toString()}${hash}`;
}

async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

export async function collectModuleConnections() {
  const htmlFiles = await walkFiles(ROOT, (file) => file.endsWith(".html"));
  const jsFiles = await walkFiles(ASSET_JS_ROOT, (file) => file.endsWith(".js"));
  const connections = [];

  for (const file of htmlFiles) {
    const source = await readText(file);
    for (const entry of findHtmlModuleEntries(source)) {
      connections.push({ ...entry, file, kind: "html-entry" });
    }
  }

  for (const file of jsFiles) {
    const source = await readText(file);
    for (const entry of findStaticImports(source)) {
      connections.push({ ...entry, file, kind: "static-import" });
    }
  }

  return { connections, htmlFiles, jsFiles };
}

export async function analyzeModuleGraph(expectedVersion) {
  const { connections, jsFiles } = await collectModuleConnections();
  const errors = [];
  const entrypoints = [];
  const graph = new Map(jsFiles.map((file) => [file, []]));

  for (const connection of connections) {
    const { file, kind, specifier } = connection;
    const location = `${relativePath(file)} → ${specifier}`;

    if (hasProtocol(specifier)) {
      if (!/^https:/i.test(specifier)) {
        errors.push(`${location}: опасный или неподдерживаемый протокол.`);
      }
      continue;
    }

    if (!isLocalReference(specifier)) {
      errors.push(`${location}: локальный модуль должен использовать относительный или корневой путь.`);
      continue;
    }

    const resolved = resolveLocalReference(file, specifier);
    if (!isInsideRoot(resolved)) {
      errors.push(`${location}: путь выходит за пределы репозитория.`);
      continue;
    }
    if (!(await exists(resolved))) {
      errors.push(`${location}: файл ${relativePath(resolved)} не существует.`);
      continue;
    }
    if (!resolved.endsWith(".js")) {
      errors.push(`${location}: модуль должен иметь расширение .js.`);
    }
    if (!isInsideDirectory(resolved, ASSET_JS_ROOT)) {
      errors.push(`${location}: импорт из старой корневой структуры запрещён.`);
    }

    const actualVersion = versionFromSpecifier(specifier);
    if (actualVersion === null) {
      errors.push(`${location}: отсутствует единственный суффикс ?v=<число>.`);
    } else if (actualVersion !== expectedVersion) {
      errors.push(`${location}: версия ${actualVersion}, ожидается ${expectedVersion}.`);
    }

    if (kind === "html-entry") entrypoints.push({ html: file, module: resolved });
    else graph.get(file)?.push(resolved);
  }

  const cycles = findCycles(graph);
  cycles.forEach((cycle) => {
    errors.push(`Циклический импорт: ${cycle.map(relativePath).join(" → ")}.`);
  });

  const reachable = new Set();
  const visit = (file) => {
    if (reachable.has(file)) return;
    reachable.add(file);
    (graph.get(file) || []).forEach(visit);
  };
  entrypoints.forEach(({ module }) => visit(module));

  return {
    errors,
    entrypoints,
    graph,
    moduleCount: jsFiles.length,
    reachableCount: reachable.size,
    orphanModules: jsFiles.filter((file) => !reachable.has(file)),
    connections
  };
}

function findCycles(graph) {
  const state = new Map();
  const stack = [];
  const cycleKeys = new Set();
  const cycles = [];

  function visit(node) {
    state.set(node, 1);
    stack.push(node);
    for (const next of graph.get(node) || []) {
      if (!graph.has(next)) continue;
      if (!state.has(next)) visit(next);
      else if (state.get(next) === 1) {
        const start = stack.indexOf(next);
        const cycle = [...stack.slice(start), next];
        const key = cycle.slice(0, -1).map(relativePath).sort().join("|");
        if (!cycleKeys.has(key)) {
          cycleKeys.add(key);
          cycles.push(cycle);
        }
      }
    }
    stack.pop();
    state.set(node, 2);
  }

  [...graph.keys()].sort((a, b) => a.localeCompare(b, "en")).forEach((node) => {
    if (!state.has(node)) visit(node);
  });
  return cycles;
}
