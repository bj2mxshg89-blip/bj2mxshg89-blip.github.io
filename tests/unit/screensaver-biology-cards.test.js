import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { biologyCardPairs } from "../../assets/js/screensaver-biology-cards.js";

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));

test("биологический банк содержит 36 карточек 5 класса и 54 карточки 6 класса", () => {
  assert.equal(biologyCardPairs.length, 90);
  assert.equal(biologyCardPairs.filter(({ grade }) => grade === 5).length, 36);
  assert.equal(biologyCardPairs.filter(({ grade }) => grade === 6).length, 54);
});

test("количество карточек в каждой теме соответствует согласованному перечню", () => {
  const counts = Object.fromEntries(
    [...Map.groupBy(biologyCardPairs, ({ grade, topic }) => `${grade}:${topic}`)]
      .map(([key, cards]) => [key, cards.length])
  );

  assert.deepEqual(counts, {
    "5:Что изучает биология": 6,
    "5:Признаки живого": 6,
    "5:Разнообразие живой природы": 6,
    "5:Среды обитания": 6,
    "5:Методы биологии": 6,
    "5:Микроскоп": 4,
    "5:Первое знакомство с клеткой": 2,
    "6:Корень": 10,
    "6:Побег, стебель и почки": 10,
    "6:Лист": 13,
    "6:Цветок": 9,
    "6:Плод и семя": 6,
    "6:Задания на понимание": 6
  });
});

test("у каждой карточки есть уникальный id, вопрос, ответ и существующее изображение", () => {
  const ids = new Set();
  for (const card of biologyCardPairs) {
    assert.match(card.id, /^bio[56]-[a-z0-9-]+$/);
    assert.equal(ids.has(card.id), false, `Повторяется id ${card.id}`);
    ids.add(card.id);
    assert.equal(card.subject, "biology");
    assert.ok([5, 6].includes(card.grade));
    for (const field of ["topic", "image", "alt", "question", "answer"]) {
      assert.equal(typeof card[field], "string", `${card.id}: отсутствует ${field}`);
      assert.ok(card[field].trim(), `${card.id}: пустое поле ${field}`);
    }
    assert.ok(existsSync(join(repositoryRoot, card.image)), `${card.id}: нет изображения ${card.image}`);
    assert.match(card.image, /\.webp$/, `${card.id}: биологическая карточка должна использовать WebP`);
    const signature = readFileSync(join(repositoryRoot, card.image)).subarray(0, 12);
    assert.equal(signature.subarray(0, 4).toString(), "RIFF", `${card.id}: повреждён WebP`);
    assert.equal(signature.subarray(8, 12).toString(), "WEBP", `${card.id}: повреждён WebP`);
  }
});

test("тексты карточек укладываются в безопасные пределы экрана", () => {
  for (const card of biologyCardPairs) {
    assert.ok(card.question.length <= 115, `${card.id}: слишком длинный вопрос`);
    assert.ok(card.answer.length <= 105, `${card.id}: слишком длинный ответ`);
  }
});
