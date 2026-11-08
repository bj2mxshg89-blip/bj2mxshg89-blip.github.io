import { appendFormattedValue, appendChemicalZoom } from "./chemical-diagrams.js?v=17";
import { parseChemicalStructure } from "./chemical-structures.js?v=17";

export function validateStudyMaterials(materials, errors) {
  if (materials === undefined) return;
  if (!Array.isArray(materials) || !materials.length || materials.length > 20) {
    errors.push("Поле studyMaterials должно содержать от 1 до 20 разделов."); return;
  }
  const validText = (value) => typeof value === "string" && Boolean(value.trim());
  const validDisplay = (value) => {
    if (!value || !validText(value.text) || !["text", "formula", "structure"].includes(value.format)) return false;
    if (value.format === "structure") {
      try { parseChemicalStructure(value.text); } catch (_) { return false; }
    }
    return true;
  };
  const ids = new Set();
  for (const material of materials) {
    if (!material || !validText(material.id) || ids.has(material.id) || !validText(material.title)
      || !Array.isArray(material.blocks) || !material.blocks.length) {
      errors.push("Учебный материал: нужны уникальный id, title и непустой blocks."); continue;
    }
    ids.add(material.id);
    for (const block of material.blocks) {
      const valid = block && (
        (["heading", "paragraph"].includes(block.kind) && validText(block.text))
        || (block.kind === "structure" && validDisplay({ text: block.text, format: "structure" }))
        || (block.kind === "list" && Array.isArray(block.items) && block.items.length && block.items.every(validText))
        || (block.kind === "table" && Array.isArray(block.rows) && block.rows.length
          && block.rows.every((row) => Array.isArray(row) && row.length && row.every(validDisplay)))
      );
      if (!valid) errors.push(`Учебный материал ${material.id}: недопустимый блок.`);
    }
    if (material.cards !== undefined && (!Array.isArray(material.cards) || material.cards.some((card) =>
      !card || !validDisplay(card.front) || !validText(card.answer) || !validText(card.explanation)))) {
      errors.push(`Учебный материал ${material.id}: недопустимые карточки.`);
    }
  }
}

export function renderStudyMaterials(container, materials) {
  container.replaceChildren(); container.hidden = !materials?.length;
  if (container.hidden) return;
  const title = document.createElement("h3"); title.textContent = "Теория и карточки для повторения";
  container.append(title);
  for (const material of materials) {
    const details = document.createElement("details"); details.className = "trainer-reference study-topic";
    const summary = document.createElement("summary"); summary.textContent = material.title; details.append(summary);
    const body = document.createElement("div"); body.className = "study-content";
    for (const block of material.blocks) {
      if (block.kind === "table") {
        const frame = document.createElement("div"); frame.className = "study-table-frame";
        const table = document.createElement("table"); table.className = "study-table";
        block.rows.forEach((row, index) => {
          const tr = document.createElement("tr");
          row.forEach((value) => {
            const cell = document.createElement(index === 0 ? "th" : "td");
            appendFormattedValue(cell, value.text, value.format); tr.append(cell);
          }); table.append(tr);
        }); frame.append(table); body.append(frame);
      } else if (block.kind === "list") {
        const list = document.createElement(block.ordered ? "ol" : "ul");
        block.items.forEach((text) => { const item = document.createElement("li"); item.textContent = text; list.append(item); });
        body.append(list);
      } else if (block.kind === "structure") {
        const figure = document.createElement("div");
        appendFormattedValue(figure, block.text, "structure"); body.append(figure);
      } else {
        const node = document.createElement(block.kind === "heading" ? "h4" : "p");
        node.textContent = block.text; body.append(node);
      }
    }
    if (material.cards?.length) {
      const heading = document.createElement("h4"); heading.textContent = `Карточки: ${material.cards.length}`; body.append(heading);
      const cards = document.createElement("div"); cards.className = "study-cards";
      material.cards.forEach((card) => {
        const flip = document.createElement("details"); flip.className = "study-card";
        const front = document.createElement("summary"); appendFormattedValue(front, card.front.text, card.front.format);
        const instruction = document.createElement("span"); instruction.className = "study-card-instruction";
        instruction.textContent = "Показать / скрыть ответ"; front.append(instruction);
        const answer = document.createElement("strong"); answer.textContent = card.answer;
        const explanation = document.createElement("p"); explanation.textContent = card.explanation;
        flip.append(front, answer, explanation); cards.append(flip);
      }); body.append(cards);
    }
    appendChemicalZoom(body);
    details.append(body); container.append(details);
  }
}
