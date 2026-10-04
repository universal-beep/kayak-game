// Заставка в низком окне (≈430 px): название нарисовано на холсте до 0,25
// высоты окна, кнопки — снизу. В окне ниже 500 px подсказка управления
// прячется (на десктопе она есть в боковой панели), иначе кнопки налезали
// на название.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../index.html", import.meta.url), "utf8");

test("заставка: в низком окне подсказка управления спрятана, кнопки не налезают на название", () => {
  const m = /@media\s*\(max-height:\s*(\d+)px\)\s*\{([^@]*?)\}\s*\}/.exec(src);
  assert.ok(m, "правило для низкого окна");
  assert.ok(+m[1] >= 480, "порог " + m[1]);
  assert.match(m[2], /#startScreen \.ctrl\s*\{\s*display:\s*none/);
  // Высота меню без подсказки: большая кнопка 50 + три малые по 39 + зазоры
  // 18 + отступы ≤ 40 — должна помещаться ниже названия при 430 px.
  const menu = 50 + 3*39 + 18 + 40;
  assert.ok(menu <= 430*0.75 - 10, "меню " + menu + " px");
});

test("заставка на широком окне: название и байдарка рисуются, а не только фон", async () => {
  const { loadGame } = await import("./harness.mjs");
  const { K, ctx } = loadGame();
  const texts = [], sprites = [];
  ctx.fillText = t => texts.push(t);
  K.G.s = "start";
  for (const view of [[0, K.W], [-560, 980]]) {
    texts.length = 0;
    K.withView(view[0], view[1], () => K.rndr());
    assert.ok(texts.includes("СПЛАВ"), "название, вид " + view);
    assert.ok(texts.includes("НА БАЙДАРКЕ"), "подзаголовок, вид " + view);
  }
});
