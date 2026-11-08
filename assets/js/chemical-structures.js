// Acyclic condensed hydrocarbon structures. No code, markup or network input.
export function parseChemicalStructure(value) {
  if (typeof value !== "string" || value.length > 240) throw new Error("Допустимо не более 240 символов.");
  const source = value.trim().toUpperCase()
    .replace(/[₀-₉]/g, (digit) => String("₀₁₂₃₄₅₆₇₈₉".indexOf(digit)))
    .replace(/[\s\u200b]/g, "").replace(/[—–−]/g, "-").replace(/≡/g, "#")
    .replace(/(^|[-=(#])H([0-9])C/g, "$1CH$2");
  if (!source) throw new Error("Введите сокращённую структурную формулу.");
  if (/^C\d+H\d+$/.test(source)) throw new Error("Нужна структурная формула, например CH3-CH2-CH3, а не молекулярная.");
  const nodes = [], edges = [], stack = [];
  let index = 0, last = null, bond = 1, needsAtom = true;
  while (index < source.length) {
    const character = source[index];
    if ("-=#".includes(character)) {
      if (last === null || needsAtom) throw new Error("Проверьте расположение знаков связей.");
      bond = character === "=" ? 2 : character === "#" ? 3 : 1;
      needsAtom = true; index += 1; continue;
    }
    if (character === "(") {
      if (last === null || needsAtom) throw new Error("Проверьте запись боковой группы.");
      stack.push({ parent: last, start: nodes.length });
      needsAtom = true; index += 1; continue;
    }
    if (character === ")") {
      const branch = stack.pop();
      if (!branch || needsAtom || branch.start === nodes.length) throw new Error("Проверьте скобки в формуле.");
      last = branch.parent; needsAtom = false; index += 1; continue;
    }
    if (character !== "C") throw new Error("Используйте группы CH3, CH2, CH и C; связи - = ≡.");
    index += 1;
    let hydrogen = 0;
    if (source[index] === "H") {
      index += 1;
      let digits = "";
      while (index < source.length && /[0-9]/.test(source[index])) digits += source[index++];
      hydrogen = digits ? Number(digits) : 1;
    }
    if (hydrogen > 4) throw new Error("У одного атома C не может быть больше четырёх атомов H.");
    const id = nodes.length;
    nodes.push({ hydrogen, links: [] });
    if (last !== null) {
      nodes[last].links.push({ id, order: bond });
      nodes[id].links.push({ id: last, order: bond });
      edges.push({ from: last, to: id, order: bond });
    }
    last = id; bond = 1; needsAtom = false;
    if (nodes.length > 25) throw new Error("Допустимо не более 25 атомов углерода.");
  }
  if (stack.length || needsAtom) throw new Error("Формула не завершена: проверьте связи и скобки.");
  for (const node of nodes) {
    if (node.links.reduce((sum, link) => sum + link.order, node.hydrogen) !== 4) {
      throw new Error("Проверьте валентность углерода и число атомов водорода в каждой группе.");
    }
  }
  // Rooting the tree at every carbon also accepts a reversed main-chain traversal.
  function signature(id, parent) {
    return `H${nodes[id].hydrogen}[${nodes[id].links.filter((link) => link.id !== parent)
      .map((link) => `${link.order}:${signature(link.id, id)}`).sort().join("|")}]`;
  }
  return { source, nodes, edges, key: nodes.map((_, id) => signature(id, -1)).sort()[0] };
}

export function chemicalStructureKey(value) {
  return parseChemicalStructure(value).key;
}

export function normalizeChemicalName(value) {
  return String(value || "").toLowerCase().replace(/ё/g, "е").replace(/[—–−]/g, "-")
    .replace(/\s+/g, "").replace(/[.()]/g, "")
    .replace(/([а-я]+)-(\d+(?:,\d+)*)-(диен|ен|ин)([а-я]*)/g,
      (_, stem, positions, suffix, ending) => `${stem}${suffix}${ending}-${positions}`);
}

export function chemicalAnswerMatches(question, value) {
  if (typeof value !== "string" || !value.trim() || value.length > 240) return false;
  try {
    const normalize = question.chemical.kind === "structure" ? chemicalStructureKey : normalizeChemicalName;
    const entered = normalize(value);
    return question.correct.some((answer) => normalize(answer) === entered);
  } catch (_) {
    return false;
  }
}
