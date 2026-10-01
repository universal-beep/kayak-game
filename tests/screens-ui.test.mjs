// Экраны меню: у кнопок есть базовый стиль, стартовый экран — оверлей с
// видимой кнопкой, подсказка про тапы не висит на загрузке, мелких шрифтов нет.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { loadGame } from "./harness.mjs";

const html = readFileSync(fileURLToPath(new URL("../index.html", import.meta.url)), "utf8");
const css = html.match(/<style>([\s\S]*?)<\/style>/)[1];

test("у .btn есть базовый стиль (не серая системная кнопка)", () => {
  assert.match(css, /(^|\n)\.btn \{[^}]*background:/);
});

test("стартовый экран — оверлей, а кнопка старта не спрятана", () => {
  assert.match(css, /#startScreen \{[^}]*position:absolute/);
  assert.ok(!/#startScreen \.btn[^{]*\{[^}]*display:none/.test(css), "кнопка старта спрятана");
  assert.ok(html.includes('id="startBtn"') && html.includes('id="startBoardBtn"'));
});

test("подсказка про тапы по умолчанию скрыта", () => {
  assert.match(html, /<div id="mHint" class="hide">/);
});

test("шрифт интерфейса не мельче 8px (пиксельный шрифт мылится на дробных)", () => {
  for (const m of css.matchAll(/font-size:([\d.]+)px/g)) assert.ok(+m[1] >= 8, m[0]);
});

test("в кнопках лагеря нет символов, которых нет во встроенном шрифте", () => {
  const camp = html.slice(html.indexOf("function showCamp"), html.indexOf("function leaveCamp"));
  assert.ok(!/[★✓]/.test(camp.match(/b\.textContent[^\n]*/)[0]));
});

test("заставка рисуется без ошибок в состоянии start", () => {
  const { K } = loadGame();
  K.G.s = "start";
  assert.doesNotThrow(() => { K.rndr(); K.rndr(); });
});
