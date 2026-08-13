import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { evaluateAnswer, getQuestionMaxPoints } from "../../assets/js/question-types.js";
import { validateTestContent } from "../../scripts/lib/data-validation.mjs";

const definition = JSON.parse(readFileSync(
  new URL("../../data/tests/biology-matching.json", import.meta.url),
  "utf8"
));

const sourcePairs = {
  levels: [
    ["Молекулярный", "Молекулы и химические реакции, лежащие в основе процессов жизнедеятельности"],
    ["Клеточный", "Клетка как структурная и функциональная единица живого"],
    ["Тканевый", "Совокупность сходных по строению и функциям клеток и межклеточного вещества"],
    ["Органный", "Отдельный орган, образованный несколькими тканями и выполняющий определённую функцию"],
    ["Система органов", "Несколько органов, совместно выполняющих общую функцию"],
    ["Организм", "Отдельное живое существо как целостная биологическая система"],
    ["Популяция", "Совокупность особей одного вида, длительно обитающих на общей территории"],
    ["Биосферный", "Совокупность всех экосистем Земли и область распространения жизни"]
  ],
  properties: [
    ["Питание", "Получение организмом веществ, необходимых для построения тела и жизнедеятельности"],
    ["Дыхание", "Процессы, при которых организм получает энергию за счёт превращения веществ"],
    ["Рост и развитие", "Увеличение размеров и массы организма и закономерные изменения в течение жизни"],
    ["Размножение", "Способность организмов производить потомство"],
    ["Обмен веществ и энергией", "Поступление, превращение и удаление веществ с одновременным преобразованием энергии"],
    ["Раздражимость", "Способность воспринимать изменения среды и отвечать на них"],
    ["Клеточное строение", "Организмы состоят из одной или множества клеток"]
  ],
  "plant-cell": [
    ["Ядро", "Хранит наследственную информацию и управляет процессами жизнедеятельности клетки"],
    ["Цитоплазма", "Внутренняя среда клетки, в которой расположены органоиды и протекают многие реакции"],
    ["Клеточная мембрана", "Отделяет содержимое клетки от внешней среды и регулирует транспорт веществ"],
    ["Клеточная стенка", "Придаёт клетке форму, обеспечивает прочность и защиту"],
    ["Вакуоль", "Содержит клеточный сок, запасает воду и вещества, поддерживает внутреннее давление"],
    ["Хлоропласты", "Осуществляют фотосинтез и содержат хлорофилл"],
    ["Хромопласты", "Содержат цветные пигменты и обеспечивают окраску частей растения"],
    ["Лейкопласты", "Бесцветные пластиды, участвующие в запасании питательных веществ"],
    ["Митохондрии", "Обеспечивают клеточное дыхание и образование энергии в форме АТФ"],
    ["Рибосомы", "Осуществляют синтез белка"],
    ["Эндоплазматическая сеть", "Участвует в синтезе и транспорте веществ внутри клетки"],
    ["Аппарат Гольджи", "Изменяет, сортирует и упаковывает вещества, участвует в их выведении"]
  ]
};

test("биологический банк проходит общую валидацию", () => {
  const { errors } = validateTestContent(definition, "biology-matching");
  assert.deepEqual(errors, []);
});

test("банк содержит три раздела, три matching-задания и 27 соответствий", () => {
  assert.deepEqual(definition.sections.map((section) => section.id), ["levels", "properties", "plant-cell"]);
  assert.equal(definition.questions.length, 3);
  assert.ok(definition.questions.every((question) => question.type === "matching"));
  assert.deepEqual(definition.questions.map((question) => question.items.length), [8, 7, 12]);
  assert.equal(definition.questions.reduce((sum, question) => sum + question.items.length, 0), 27);
});

test("все исходные термины, описания и правильные пары сохранены", () => {
  definition.questions.forEach((question) => {
    const options = new Map(question.options.map((option) => [option.id, option.text]));
    const actual = question.items.map((item) => [item.text, options.get(question.correct[item.id])]);
    assert.deepEqual(actual, sourcePairs[question.section], question.section);
  });
});

test("постоянные ID строк и вариантов уникальны, а соответствия являются биекциями", () => {
  definition.questions.forEach((question) => {
    const itemIds = question.items.map((item) => item.id);
    const optionIds = question.options.map((option) => option.id);
    const correctIds = Object.values(question.correct);
    assert.equal(new Set(itemIds).size, itemIds.length, question.id);
    assert.equal(new Set(optionIds).size, optionIds.length, question.id);
    assert.equal(new Set(correctIds).size, correctIds.length, question.id);
    assert.deepEqual(new Set(correctIds), new Set(optionIds), question.id);
    assert.equal(question.allowOptionReuse, false);
  });
});

test("правильные ответы дают 27 из 27 баллов", () => {
  let maximum = 0;
  let earned = 0;
  definition.questions.forEach((question) => {
    const result = evaluateAnswer(question, question.correct);
    assert.equal(result.isFullyCorrect, true, question.id);
    assert.equal(result.maxPoints, question.items.length, question.id);
    assert.equal(getQuestionMaxPoints(question), question.items.length, question.id);
    maximum += result.maxPoints;
    earned += result.earnedPoints;
  });
  assert.equal(earned, 27);
  assert.equal(maximum, 27);
});

test("четыре варианта покрывают весь тест и каждый тематический раздел", () => {
  assert.deepEqual(definition.variants.map((variant) => variant.id), [
    "mixed", "levels", "properties", "plant-cell"
  ]);
  assert.deepEqual(definition.variants[0].selectionCount, { training: 3, test: 3 });
  definition.variants.slice(1).forEach((variant) => {
    assert.equal(variant.questionIds.length, 1, variant.id);
    assert.deepEqual(variant.selectionCount, { training: 1, test: 1 }, variant.id);
    const question = definition.questions.find((item) => item.id === variant.questionIds[0]);
    assert.equal(question.section, variant.id, variant.id);
  });
});

test("банк не содержит персональных данных и полей ученика", () => {
  const serialized = JSON.stringify(definition).toLowerCase();
  assert.doesNotMatch(serialized, /имя ученика|фамили|название класса|studentname|classname/);
});
