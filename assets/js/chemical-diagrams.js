import { parseChemicalStructure } from "./chemical-structures.js?v=17";

const namespace = "http://www.w3.org/2000/svg";
function svgNode(tag, attributes) {
  const node = document.createElementNS(namespace, tag);
  Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, String(value)));
  return node;
}

export function chemicalDiagram(formula) {
  const graph = parseChemicalStructure(formula);
  const tokens = graph.source.match(/CH\d*|C|[-=#()]/g);
  const nodes = [], stack = [], branchCounts = new Map();
  let mainIndex = 0, last = -1, firstBranch = false;
  for (const token of tokens) {
    if ("-=#".includes(token)) continue;
    if (token === "(") {
      const occurrence = (branchCounts.get(last) || 0) + 1;
      branchCounts.set(last, occurrence);
      stack.push({ parent: last, offset: (occurrence % 2 ? -1 : 1) * 82 * Math.ceil(occurrence / 2) });
      firstBranch = true;
    } else if (token === ")") {
      last = stack.pop().parent; firstBranch = false;
    } else {
      const branch = stack.at(-1);
      const x = branch ? firstBranch ? nodes[branch.parent].x : nodes[last].x + 100 : mainIndex++ * 100;
      const y = branch ? nodes[branch.parent].y + branch.offset : 0;
      nodes.push({ label: token, x, y });
      last = nodes.length - 1; firstBranch = false;
    }
  }
  const minX = Math.min(...nodes.map((node) => node.x)), minY = Math.min(...nodes.map((node) => node.y));
  const width = Math.max(...nodes.map((node) => node.x)) - minX + 90;
  const height = Math.max(...nodes.map((node) => node.y)) - minY + 80;
  const figure = document.createElement("span");
  figure.className = "chemical-diagram";
  figure.dataset.structure = formula;
  const svg = svgNode("svg", { viewBox: `0 0 ${width} ${height}`, width, height, role: "img", "aria-label": `Структурная формула: ${formula}` });
  for (const edge of graph.edges) {
    const a = nodes[edge.from], b = nodes[edge.to];
    const distance = Math.hypot(b.x - a.x, b.y - a.y);
    const ux = (b.x - a.x) / distance, uy = (b.y - a.y) / distance;
    const padding = Math.abs(ux) > .6 ? 29 : 21;
    const offsets = edge.order === 1 ? [0] : edge.order === 2 ? [-3.5, 3.5] : [-5.5, 0, 5.5];
    offsets.forEach((offset) => svg.append(svgNode("line", {
      x1: a.x + ux * padding - uy * offset - minX + 45,
      y1: a.y + uy * padding + ux * offset - minY + 40,
      x2: b.x - ux * padding - uy * offset - minX + 45,
      y2: b.y - uy * padding + ux * offset - minY + 40,
      stroke: "currentColor", "stroke-width": 2.3, "stroke-linecap": "round"
    })));
  }
  nodes.forEach((node) => {
    const text = svgNode("text", { x: node.x - minX + 45, y: node.y - minY + 40,
      "text-anchor": "middle", "dominant-baseline": "central", fill: "currentColor", "font-size": 18, "font-weight": 700 });
    text.textContent = node.label.replace(/\d/g, (digit) => "₀₁₂₃₄₅₆₇₈₉"[Number(digit)]);
    svg.append(text);
  });
  figure.append(svg);
  return figure;
}

export function appendFormattedValue(container, text, format = "text") {
  if (format === "structure") container.append(chemicalDiagram(text));
  else {
    const value = document.createElement("span");
    if (format === "formula") value.className = "is-formula";
    value.textContent = text;
    container.append(value);
  }
}

export function appendChemicalZoom(container) {
  const formulas = [...new Set([...container.querySelectorAll("[data-structure]")].map((node) => node.dataset.structure))];
  if (!formulas.length) return;
  const button = document.createElement("button");
  button.type = "button"; button.className = "site-btn ghost chemical-zoom-button";
  button.textContent = "Увеличить формулы";
  button.addEventListener("click", () => {
    const dialog = document.createElement("dialog");
    dialog.className = "chemical-dialog";
    const title = document.createElement("h2"); title.textContent = "Структурные формулы";
    const close = document.createElement("button");
    close.type = "button"; close.className = "site-btn secondary"; close.textContent = "Закрыть";
    close.addEventListener("click", () => dialog.close());
    dialog.append(title, close);
    formulas.forEach((formula) => {
      const frame = document.createElement("div"); frame.className = "chemical-zoom-frame";
      frame.append(chemicalDiagram(formula)); dialog.append(frame);
    });
    dialog.addEventListener("close", () => { dialog.remove(); button.focus(); }, { once: true });
    document.body.append(dialog); dialog.showModal();
  });
  container.append(button);
}
