import test from "node:test";
import assert from "node:assert/strict";
import { fallbackCardLinks } from "../../scripts/lib/html.mjs";

test("резервный каталог не считает временные ссылки главной страницы", () => {
  const source = `
    <a class="tool-link" href="test.html?id=biology">Открыть</a>
    <a class="tool-link" href="temporary.html" data-catalog-ignore="true">Открыть</a>
    <a class="site-nav-link" href="account.html">Войти</a>
  `;

  assert.deepEqual(fallbackCardLinks(source), ["test.html?id=biology"]);
});
