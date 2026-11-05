import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { geographyCardPairs, geographyCardsForGrade } from "../../assets/js/screensaver-geography-cards.js";

test("младший набор изолирован от тем 6 класса, старший включает весь предыдущий курс", () => {
  const junior = geographyCardsForGrade(5);
  const senior = geographyCardsForGrade(6);
  assert.equal(junior.length, 36);
  assert.equal(senior.length, 90);
  assert.ok(junior.every((pair) => pair.grade === 5));
  const seniorIds = new Set(senior.map((pair) => pair.id));
  assert.ok(junior.every((pair) => seniorIds.has(pair.id)));
  const seniorTopics = new Set(["Гидросфера", "Атмосфера", "Биосфера", "Природные комплексы и почва"]);
  assert.ok(junior.every((pair) => !seniorTopics.has(pair.topic)));
  assert.ok(senior.filter((pair) => pair.grade === 6).every((pair) => seniorTopics.has(pair.topic)));
});

test("неподдерживаемый класс не открывает случайно весь банк", () => {
  for (const grade of [undefined, null, NaN, "5", 0, 4, 7, 11]) {
    assert.deepEqual(geographyCardsForGrade(grade), []);
  }
});

test("у всех географических карточек уникальные вопросы, ответы и доступные изображения", () => {
  const ids = new Set();
  const questions = new Set();
  for (const pair of geographyCardPairs) {
    assert.equal(ids.has(pair.id), false, pair.id);
    assert.equal(questions.has(pair.question), false, pair.question);
    ids.add(pair.id);
    questions.add(pair.question);
    assert.equal(pair.subject, "geography");
    assert.match(pair.id, /^geo[56]-[a-z0-9-]+$/);
    for (const field of ["topic", "image", "alt", "question", "answer"]) {
      assert.equal(typeof pair[field], "string", `${pair.id}: ${field}`);
      assert.ok(pair[field].trim(), `${pair.id}: ${field}`);
    }
    const image = new URL(`../../${pair.image}`, import.meta.url);
    assert.ok(existsSync(image), pair.image);
    if (pair.image.endsWith(".svg")) {
      const source = readFileSync(image, "utf8");
      assert.match(source, /viewBox="0 0 1200 900"/);
      assert.doesNotMatch(source, /<(?:script|foreignObject)\b|(?:href|src)=["']https?:/i);
    }
  }
});
