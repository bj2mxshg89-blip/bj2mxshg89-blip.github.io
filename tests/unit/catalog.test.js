import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateCatalog, visibleCatalogItems } from "../../assets/js/catalog.js";

const validCatalog = JSON.parse(readFileSync(new URL("../../data/catalog.json", import.meta.url), "utf8"));
const clone = () => structuredClone(validCatalog);

test("валидная схема каталога проходит проверку", () => {
  assert.deepEqual(validateCatalog(clone()), []);
});

test("неизвестный раздел обнаруживается", () => {
  const catalog = clone();
  catalog.items[0].section = "missing";
  assert.match(validateCatalog(catalog).join("\n"), /не существует/);
});

test("повтор id элемента обнаруживается", () => {
  const catalog = clone();
  catalog.items[1].id = catalog.items[0].id;
  assert.match(validateCatalog(catalog).join("\n"), /Повторяется id каталога/);
});

test("hidden допустим и исключается из видимого каталога", () => {
  const catalog = clone();
  catalog.items[0].status = "hidden";
  assert.deepEqual(validateCatalog(catalog), []);
  assert.equal(visibleCatalogItems(catalog).some((item) => item.id === catalog.items[0].id), false);
});

test("опасный URL обнаруживается", () => {
  const catalog = clone();
  catalog.items[0].url = "javascript:alert(1)";
  assert.match(validateCatalog(catalog).join("\n"), /небезопасен/);
});

test("некорректный цвет обнаруживается", () => {
  const catalog = clone();
  catalog.items[0].color = "red";
  assert.match(validateCatalog(catalog).join("\n"), /#RRGGBB/);
});

test("отсутствующее обязательное поле обнаруживается", () => {
  const catalog = clone();
  delete catalog.items[0].title;
  assert.match(validateCatalog(catalog).join("\n"), /поле «title»/);
});

test("одинаковый order внутри раздела обнаруживается", () => {
  const catalog = clone();
  catalog.items[1].order = catalog.items[0].order;
  assert.match(validateCatalog(catalog).join("\n"), /одинаковый order/);
});
