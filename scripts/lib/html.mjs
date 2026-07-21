const QUOTED_ATTRIBUTE_PATTERN = /\b([:\w-]+)\s*=\s*(["'])(.*?)\2/gis;

export function htmlAttributes(source, names = null) {
  const allowed = names ? new Set(names.map((name) => name.toLowerCase())) : null;
  const attributes = [];
  let match;
  QUOTED_ATTRIBUTE_PATTERN.lastIndex = 0;
  while ((match = QUOTED_ATTRIBUTE_PATTERN.exec(source))) {
    const name = match[1].toLowerCase();
    if (allowed && !allowed.has(name)) continue;
    attributes.push({ name, value: match[3], index: match.index });
  }
  return attributes;
}

export function fallbackCardLinks(source) {
  const links = [];
  const anchorPattern = /<a\b([^>]*)>/gi;
  let match;
  while ((match = anchorPattern.exec(source))) {
    const attributes = new Map(htmlAttributes(match[1]).map(({ name, value }) => [name, value]));
    const classes = (attributes.get("class") || "").split(/\s+/);
    if (classes.includes("tool-link") && attributes.has("href")) links.push(attributes.get("href"));
  }
  return links;
}
