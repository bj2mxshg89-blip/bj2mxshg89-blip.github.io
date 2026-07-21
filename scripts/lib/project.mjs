import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(fileURLToPath(new URL("../../", import.meta.url)));
export const ASSET_JS_ROOT = path.join(ROOT, "assets", "js");

const IGNORED_DIRECTORIES = new Set([
  ".git",
  "node_modules",
  "playwright-report",
  "test-results"
]);

export async function walkFiles(directory, predicate = () => true) {
  const files = [];

  async function visit(current) {
    const entries = await readdir(current, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name, "en"));
    for (const entry of entries) {
      if (entry.isDirectory() && IGNORED_DIRECTORIES.has(entry.name)) continue;
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) await visit(absolute);
      else if (entry.isFile() && predicate(absolute)) files.push(absolute);
    }
  }

  await visit(directory);
  return files;
}

export async function readText(file) {
  return readFile(file, "utf8");
}

export async function readJson(file) {
  return JSON.parse(await readText(file));
}

export function relativePath(file) {
  return path.relative(ROOT, file).split(path.sep).join("/");
}

export function isInsideRoot(file) {
  const relative = path.relative(ROOT, file);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== "..");
}

export function isInsideDirectory(file, directory) {
  const relative = path.relative(directory, file);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== "..");
}

export function splitSpecifier(specifier) {
  const hashIndex = specifier.indexOf("#");
  const withoutHash = hashIndex === -1 ? specifier : specifier.slice(0, hashIndex);
  const hash = hashIndex === -1 ? "" : specifier.slice(hashIndex);
  const queryIndex = withoutHash.indexOf("?");
  return {
    pathname: queryIndex === -1 ? withoutHash : withoutHash.slice(0, queryIndex),
    search: queryIndex === -1 ? "" : withoutHash.slice(queryIndex + 1),
    hash
  };
}

export function isLocalReference(value) {
  return typeof value === "string" && value.length > 0 &&
    !value.startsWith("//") && !value.startsWith("#") && !hasProtocol(value);
}

export function hasProtocol(value) {
  return /^[a-z][a-z0-9+.-]*:/i.test(value);
}

export function isAllowedExternalUrl(value) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

export function resolveLocalReference(fromFile, specifier) {
  const { pathname } = splitSpecifier(specifier);
  const decoded = decodeURIComponent(pathname);
  const resolved = decoded.startsWith("/")
    ? path.resolve(ROOT, `.${decoded}`)
    : path.resolve(path.dirname(fromFile), decoded);
  return resolved;
}
