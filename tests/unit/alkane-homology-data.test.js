import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const definition = JSON.parse(readFileSync(
  new URL("../../data/tests/alkane-homology.json", import.meta.url),
  "utf8"
));

const sectionIds = [
  "neighbor", "pair", "steps", "missing", "formula", "carbon",
  "name", "matching", "sequence", "odd", "truefalse", "calculation"
];
const variantIds = ["mixed", ...sectionIds];
const names = [
  "метан", "этан", "пропан", "бутан", "пентан",
  "гексан", "гептан", "октан", "нонан", "декан",
  "ундекан", "додекан", "тридекан", "тетрадекан", "пентадекан",
  "гексадекан", "гептадекан", "октадекан", "нонадекан", "эйкозан"
];
const subscripts = new Map(Object.entries({
  "₀": "0", "₁": "1", "₂": "2", "₃": "3", "₄": "4",
  "₅": "5", "₆": "6", "₇": "7", "₈": "8", "₉": "9"
}));

function normalizeSubscripts(value) {
  return [...value].map((character) => subscripts.get(character) || character).join("");
}

function parseHydrocarbon(raw) {
  const normalized = normalizeSubscripts(raw);
  const match = normalized.match(/^C(\d*)H(\d+)$/);
  if (!match) return null;
  return {
    carbon: Number(match[1] || 1),
    hydrogen: Number(match[2])
  };
}

function isAcyclicAlkaneFormula(raw) {
  const parsed = parseHydrocarbon(raw);
  return Boolean(parsed && parsed.carbon > 0 && parsed.hydrogen === 2 * parsed.carbon + 2);
}

function correctChoice(question) {
  return question.options[question.correct[0]];
}

function formulasIn(value) {
  return normalizeSubscripts(value)
    .match(/C\d*H\d+/g)
    ?.map(parseHydrocarbon)
    .filter(Boolean) || [];
}

test("банк алканов содержит ровно 12 разделов и 180 уникальных вопросов", () => {
  assert.deepEqual(definition.sections.map((section) => section.id), sectionIds);
  assert.equal(definition.questions.length, 180);
  assert.equal(new Set(definition.questions.map((question) => question.id)).size, 180);
  definition.sections.forEach((section) => {
    assert.equal(
      definition.questions.filter((question) => question.section === section.id).length,
      15,
      section.id
    );
  });
});

test("распределение типов равно 105 single, 45 number, 15 matching и 15 sequence", () => {
  const counts = definition.questions.reduce((result, question) => ({
    ...result,
    [question.type]: (result[question.type] || 0) + 1
  }), {});
  assert.deepEqual(counts, { single: 105, number: 45, matching: 15, sequence: 15 });
});

test("тринадцать вариантов имеют выборку 10/15 и корректные тематические пулы", () => {
  assert.deepEqual(definition.variants.map((variant) => variant.id), variantIds);
  const allQuestionIds = new Set(definition.questions.map((question) => question.id));
  const questionMap = new Map(definition.questions.map((question) => [question.id, question]));
  definition.variants.forEach((variant) => {
    assert.deepEqual(variant.selectionCount, { training: 10, test: 15 }, variant.id);
    assert.equal(new Set(variant.questionIds).size, variant.questionIds.length, variant.id);
    variant.questionIds.forEach((questionId) => assert.ok(allQuestionIds.has(questionId), questionId));
    if (variant.id !== "mixed") {
      assert.equal(variant.questionIds.length, 15, variant.id);
      variant.questionIds.forEach((questionId) => {
        assert.equal(questionMap.get(questionId).section, variant.id, questionId);
      });
    }
  });
  assert.deepEqual(new Set(definition.variants[0].questionIds), allQuestionIds);
});

test("matching содержит 60 однозначных соответствий и по одному реальному дистрактору", () => {
  const matching = definition.questions.filter((question) => question.type === "matching");
  assert.equal(matching.reduce((sum, question) => sum + question.items.length, 0), 60);
  matching.forEach((question) => {
    assert.equal(question.items.length, 4, question.id);
    assert.equal(question.options.length, 5, question.id);
    assert.equal(question.allowOptionReuse, false, question.id);
    assert.equal(new Set(question.items.map((item) => item.id)).size, 4, question.id);
    assert.equal(new Set(question.options.map((option) => option.id)).size, 5, question.id);
    assert.equal(new Set(Object.values(question.correct)).size, 4, question.id);
    const optionMap = new Map(question.options.map((option) => [option.id, option.text]));
    question.items.forEach((item) => {
      const n = names.indexOf(item.text) + 1;
      assert.ok(n > 0, `${question.id}: ${item.text}`);
      const formula = optionMap.get(question.correct[item.id]);
      const parsed = parseHydrocarbon(formula);
      assert.deepEqual(parsed, { carbon: n, hydrogen: 2 * n + 2 }, `${question.id}: ${item.text}`);
    });
    const extraIds = question.options
      .map((option) => option.id)
      .filter((optionId) => !Object.values(question.correct).includes(optionId));
    assert.equal(extraIds.length, 1, question.id);
    assert.equal(isAcyclicAlkaneFormula(optionMap.get(extraIds[0])), true, question.id);
  });
});

test("sequence содержит 60 позиций, постоянные ID и возрастающий правильный порядок", () => {
  const sequences = definition.questions.filter((question) => question.type === "sequence");
  assert.equal(sequences.reduce((sum, question) => sum + question.items.length, 0), 60);
  sequences.forEach((question) => {
    assert.equal(question.items.length, 4, question.id);
    assert.equal(new Set(question.items.map((item) => item.id)).size, 4, question.id);
    assert.deepEqual(new Set(question.correct), new Set(question.items.map((item) => item.id)), question.id);
    assert.deepEqual(question.sequence, { shuffleInitial: true, scoring: "position" }, question.id);
    const itemMap = new Map(question.items.map((item) => [item.id, item]));
    const carbons = question.correct.map((itemId) => {
      const item = itemMap.get(itemId);
      assert.equal(item.format, "formula", question.id);
      assert.equal(isAcyclicAlkaneFormula(item.text), true, `${question.id}: ${item.text}`);
      return parseHydrocarbon(item.text).carbon;
    });
    assert.deepEqual(
      carbons,
      [...carbons].sort((left, right) => left - right),
      question.id
    );
    assert.match(question.text, /увеличения|низшего гомолога к высшему/, question.id);
  });
});

test("соседние пары и число переходов химически согласованы", () => {
  definition.questions.filter((question) => question.section === "neighbor").forEach((question) => {
    assert.equal(isAcyclicAlkaneFormula(correctChoice(question)), true, question.id);
    const [source] = formulasIn(question.content.text);
    const target = parseHydrocarbon(correctChoice(question));
    assert.equal(target.carbon - source.carbon, 1, question.id);
  });

  definition.questions.filter((question) => question.section === "pair").forEach((question) => {
    const pair = formulasIn(correctChoice(question));
    assert.equal(pair.length, 2, question.id);
    assert.equal(pair.every(({ carbon, hydrogen }) => hydrogen === 2 * carbon + 2), true, question.id);
    assert.equal(Math.abs(pair[1].carbon - pair[0].carbon), 1, question.id);
  });

  definition.questions.filter((question) => question.section === "steps").forEach((question) => {
    const [start, finish] = formulasIn(question.content.text);
    assert.equal(question.correct, finish.carbon - start.carbon, question.id);
    assert.ok(Number.isInteger(question.correct) && question.correct > 0, question.id);
  });
});

test("пропуски, формулы и число атомов углерода следуют CₙH₂ₙ₊₂", () => {
  definition.questions.filter((question) => question.section === "missing").forEach((question) => {
    const [start, finish] = formulasIn(question.content.text);
    const answer = parseHydrocarbon(correctChoice(question));
    assert.equal(answer.hydrogen, 2 * answer.carbon + 2, question.id);
    assert.equal(answer.carbon, start.carbon + 1, question.id);
    assert.equal(answer.carbon, finish.carbon - 1, question.id);
  });

  definition.questions.filter((question) => question.section === "formula").forEach((question) => {
    const n = Number(question.id.match(/(\d+)$/)[1]);
    assert.deepEqual(parseHydrocarbon(correctChoice(question)), {
      carbon: n,
      hydrogen: 2 * n + 2
    }, question.id);
  });

  definition.questions.filter((question) => question.section === "carbon").forEach((question) => {
    const hydrogen = Number(question.text.match(/алкана (\d+) атом/)[1]);
    assert.equal(hydrogen, 2 * question.correct + 2, question.id);
    assert.ok(Number.isInteger(question.correct) && question.correct > 0, question.id);
  });
});

test("русские названия нормальных алканов соответствуют числу атомов углерода", () => {
  definition.questions.filter((question) => question.section === "name").forEach((question) => {
    const parsed = parseHydrocarbon(question.content.text);
    assert.equal(correctChoice(question), names[parsed.carbon - 1], question.id);
    if (parsed.carbon >= 4) assert.match(question.text, /нормальных алканов/, question.id);
  });
  assert.match(JSON.stringify(definition), /эйкозан/i);
});

test("в каждом задании odd только один вариант не соответствует ациклическому алкану", () => {
  definition.questions.filter((question) => question.section === "odd").forEach((question) => {
    const flags = question.options.map(isAcyclicAlkaneFormula);
    assert.equal(flags.filter(Boolean).length, 3, question.id);
    assert.equal(flags[question.correct[0]], false, question.id);
  });
});

test("верные и неверные утверждения имеют проверенные ответы без двусмысленного контекста", () => {
  const expected = [
    "Верно", "Верно", "Неверно", "Неверно", "Верно",
    "Верно", "Неверно", "Верно", "Верно", "Верно",
    "Верно", "Верно", "Верно", "Неверно", "Верно"
  ];
  const questions = definition.questions.filter((question) => question.section === "truefalse");
  assert.deepEqual(questions.map(correctChoice), expected);
  questions.forEach((question) => {
    assert.deepEqual(new Set(question.options), new Set(["Верно", "Неверно"]), question.id);
  });
});

test("расчётные ответы являются целыми и соблюдают Mr = 14n + 2 и 3n + 2", () => {
  const calculations = definition.questions.filter((question) => question.section === "calculation");
  calculations.forEach((question) => {
    assert.ok(Number.isInteger(question.correct) && question.correct > 0, question.id);
  });
  calculations.slice(0, 5).forEach((question) => {
    const [formula] = formulasIn(question.text);
    assert.equal(question.correct, 14 * formula.carbon + 2, question.id);
  });
  calculations.slice(5, 10).forEach((question) => {
    const [formula] = formulasIn(question.text);
    assert.equal(question.correct, 3 * formula.carbon + 2, question.id);
  });
  calculations.slice(10).forEach((question) => {
    const mr = Number(question.text.match(/равна (\d+)/)[1]);
    assert.equal(mr, 14 * question.correct + 2, question.id);
  });
});

test("банк полностью статичен и не содержит runtime-шаблонов или персональных данных", () => {
  const serialized = JSON.stringify(definition);
  assert.doesNotMatch(serialized, /\$\{|Math\.random|generate[A-Z]|randomInt|<%|%>/);
  assert.doesNotMatch(serialized, /имя ученика|фамилия|класс ученика|токен|secret|api[_ -]?key/i);
});

test("предметные оговорки и область курса соблюдены", () => {
  const serialized = JSON.stringify(definition);
  assert.match(serialized, /Общая формула ациклических алканов/);
  assert.match(serialized, /не соседними гомологами/);
  assert.match(serialized, /Ar\(C\) = 12/);
  assert.doesNotMatch(serialized, /общая формула всех насыщенных|разветвл|механизм|конформац|циклоалкан/i);
  assert.doesNotMatch(serialized, /<[^>]+>/);
});
