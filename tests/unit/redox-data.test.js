import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const definition = JSON.parse(readFileSync(
  new URL("../../data/tests/redox-trainer.json", import.meta.url),
  "utf8"
));

const questionMap = new Map(definition.questions.map((question) => [question.id, question]));
const subscripts = new Map(Object.entries({ "₀": "0", "₁": "1", "₂": "2", "₃": "3", "₄": "4", "₅": "5", "₆": "6", "₇": "7", "₈": "8", "₉": "9" }));

function normalizeSubscripts(value) {
  return [...value].map((character) => subscripts.get(character) || character).join("");
}

function particleAtoms(rawParticle) {
  const particle = normalizeSubscripts(rawParticle.trim());
  const coefficientMatch = particle.match(/^(\d+)?(.*)$/);
  const coefficient = Number(coefficientMatch[1] || 1);
  const formula = coefficientMatch[2];
  const atoms = {};
  for (const match of formula.matchAll(/([A-Z][a-z]?)(\d*)/g)) {
    atoms[match[1]] = (atoms[match[1]] || 0) + coefficient * Number(match[2] || 1);
  }
  return atoms;
}

function sideAtoms(side) {
  const total = {};
  side.split(" + ").forEach((particle) => {
    Object.entries(particleAtoms(particle)).forEach(([element, count]) => {
      total[element] = (total[element] || 0) + count;
    });
  });
  return total;
}

test("банк ОВР содержит четыре раздела по 15 уникальных вопросов", () => {
  assert.equal(definition.questions.length, 60);
  assert.equal(new Set(definition.questions.map((question) => question.id)).size, 60);
  assert.deepEqual(
    Object.fromEntries(definition.sections.map((section) => [
      section.id,
      definition.questions.filter((question) => question.section === section.id).length
    ])),
    { "oxidation-states": 15, processes: 15, agents: 15, analysis: 15 }
  );
});

test("распределение типов равно 30 text, 20 single и 10 matching", () => {
  const counts = definition.questions.reduce((result, question) => ({
    ...result,
    [question.type]: (result[question.type] || 0) + 1
  }), {});
  assert.deepEqual(counts, { text: 30, single: 20, matching: 10 });
});

test("пять вариантов имеют выборку 10/15 и охватывают весь банк", () => {
  assert.deepEqual(definition.variants.map((variant) => variant.id), [
    "mixed", "oxidation-states", "processes", "agents", "analysis"
  ]);
  definition.variants.forEach((variant) => {
    assert.deepEqual(variant.selectionCount, { training: 10, test: 15 });
    assert.equal(new Set(variant.questionIds).size, variant.questionIds.length);
  });
  const used = new Set(definition.variants.flatMap((variant) => variant.questionIds));
  assert.deepEqual(used, new Set(questionMap.keys()));
  assert.equal(definition.variants.find((variant) => variant.id === "mixed").questionIds.length, 60);
});

test("каждый matching содержит 4 строки, 5 вариантов и уникальные ответы", () => {
  const matching = definition.questions.filter((question) => question.type === "matching");
  assert.equal(matching.reduce((sum, question) => sum + question.items.length, 0), 40);
  matching.forEach((question) => {
    assert.equal(question.items.length, 4, question.id);
    assert.equal(question.options.length, 5, question.id);
    assert.equal(question.allowOptionReuse, false, question.id);
    assert.equal(new Set(Object.values(question.correct)).size, 4, question.id);
  });
});

test("ключевые степени окисления химически согласованы", () => {
  const expected = {
    "redox-state-001": "+6",
    "redox-state-002": "-3",
    "redox-state-003": "0",
    "redox-state-004": "+1",
    "redox-state-005": "-2",
    "redox-state-006": "+4",
    "redox-state-007": "+5",
    "redox-state-008": "-2",
    "redox-state-009": "+3",
    "redox-state-010": "+2",
    "redox-state-011": "+5",
    "redox-state-012": "+7",
    "redox-state-013": "+6",
    "redox-state-014": "+6",
    "redox-state-015": "-3"
  };
  Object.entries(expected).forEach(([id, answer]) => {
    assert.deepEqual(questionMap.get(id).correct, [answer], id);
  });
  assert.match(questionMap.get("redox-state-014").explanation, /заряду иона/);
  assert.match(questionMap.get("redox-state-015").explanation, /не заряд иона/);
});

test("роли веществ не смешаны с названиями процессов", () => {
  const expected = {
    "redox-agent-001": "окислитель",
    "redox-agent-002": "восстановитель",
    "redox-agent-003": "восстановитель",
    "redox-agent-004": "окислитель",
    "redox-agent-005": "окислитель",
    "redox-agent-006": "восстановитель",
    "redox-agent-007": "восстановитель",
    "redox-agent-008": "окислитель",
    "redox-agent-009": "восстановитель",
    "redox-agent-010": "окислитель",
    "redox-agent-011": "восстановитель",
    "redox-agent-012": "окислитель",
    "redox-agent-013": "восстановитель",
    "redox-agent-014": "окислитель",
    "redox-agent-015": "окислитель"
  };
  Object.entries(expected).forEach(([id, answer]) => {
    assert.deepEqual(questionMap.get(id).correct, [answer], id);
  });
});

test("все используемые молекулярные уравнения уравнены по атомам", () => {
  const reactions = [
    "2KMnO₄ + 16HCl → 2KCl + 2MnCl₂ + 5Cl₂ + 8H₂O",
    "Zn + CuSO₄ → ZnSO₄ + Cu",
    "Cl₂ + 2KI → 2KCl + I₂",
    "CuO + H₂ → Cu + H₂O",
    "Fe₂O₃ + 3CO → 2Fe + 3CO₂",
    "2Mg + O₂ → 2MgO",
    "2FeCl₂ + Cl₂ → 2FeCl₃",
    "2H₂S + SO₂ → 3S + 2H₂O",
    "2Na + Cl₂ → 2NaCl"
  ];
  const content = definition.questions.map((question) => question.content?.text || "").join("\n");
  reactions.forEach((reaction) => {
    assert.match(content, new RegExp(reaction.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), reaction);
    const [left, right] = reaction.split(" → ");
    assert.deepEqual(sideAtoms(left), sideAtoms(right), reaction);
  });
});

test("электронные схемы используют e⁻ и корректные направления", () => {
  const serialized = JSON.stringify(definition);
  assert.doesNotMatch(serialized, /e⁺/);
  assert.match(serialized, /Fe⁰ − 2e⁻ → Fe²⁺/);
  assert.match(serialized, /Cl₂⁰ \+ 2e⁻ → 2Cl⁻/);
  assert.match(serialized, /Al⁰ − 3e⁻ → Al³⁺/);
  assert.match(serialized, /Fe³⁺ \+ e⁻ → Fe²⁺/);
});

test("базовый банк не содержит исключений, требующих отдельного курса", () => {
  const serialized = JSON.stringify(definition);
  assert.doesNotMatch(serialized, /пероксид|надпероксид|озонид|гидрид метал|диспропорционирован|координационн/i);
});
