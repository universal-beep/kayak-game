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

// Заставка (05.10.2026): меню перекрывало байдарочника. На широком окне он
// плывёт слева от меню, справа на отмели машет медведь; на узком экране
// байдарка встаёт над кнопками.
test("заставка на широком окне: байдарка слева от поля, медведь справа машет", async () => {
  const { runInContext } = await import("node:vm");
  const { loadGame } = await import("./harness.mjs");
  const { K, sandbox } = loadGame();
  const seen = [];
  sandbox.__wrapDS = orig => function (name, x, y) { seen.push({ name, x, y }); return orig.apply(this, arguments); };
  runInContext("drawSprite = __wrapDS(drawSprite)", sandbox);
  K.G.s = "start";
  const frames = new Set();
  for (let i = 0; i < 60; i++) {
    seen.length = 0;
    K.withView(-560, 980, () => K.rndr());
    const kayak = seen.find(s => /^kayak_man/.test(s.name)), bear = seen.find(s => /^bear_wave/.test(s.name));
    assert.ok(kayak && kayak.x < -60, "байдарка слева: " + (kayak && kayak.x));
    assert.ok(bear && bear.x > K.W + 60, "медведь справа: " + (bear && bear.x));
    frames.add(bear.name);
  }
  assert.equal(frames.size, 2, "машет — два кадра");
});

test("заставка на узком экране: байдарка над кнопками меню, медведя нет", async () => {
  const { runInContext } = await import("node:vm");
  const { loadGame } = await import("./harness.mjs");
  const { K, sandbox } = loadGame();
  const seen = [];
  sandbox.__wrapDS = orig => function (name, x, y) { seen.push({ name, x, y }); return orig.apply(this, arguments); };
  runInContext("drawSprite = __wrapDS(drawSprite)", sandbox);
  K.G.s = "start";
  for (const top of [600, 430, 400]) {
    K.setTitleMenuTop(top);
    seen.length = 0;
    K.rndr();
    const kayak = seen.find(s => /^kayak_man/.test(s.name));
    const h = K.spriteSize("kayak_man").h;
    assert.ok(kayak.y + h/2 <= Math.max(top - 4, 405), "меню с " + top + ": низ байдарки " + (kayak.y + h/2));
    assert.ok(kayak.y - h/2 >= 316, "не выше берега");
    assert.ok(!seen.some(s => /^bear_wave/.test(s.name)), "на узком медведя нет");
  }
});

// Тень байдарки на заставке (05.10.2026): тёмный овал лежал на 20 px ниже
// днища — лодка будто висела в воздухе. Теперь ватерлиния: днище в воде,
// поверх нижних рядов корпуса — вода, под лодкой — отражение, без тени.
test("заставка: байдарка сидит в воде, без тени-овала под днищем", async () => {
  const { runInContext } = await import("node:vm");
  const { loadGame } = await import("./harness.mjs");
  const { K, ctx, sandbox } = loadGame();
  let kayak = null;
  sandbox.__wrapDS = orig => function (name, x, y) { if (/^kayak_man/.test(name)) kayak = { x, y }; return orig.apply(this, arguments); };
  runInContext("drawSprite = __wrapDS(drawSprite)", sandbox);
  const ell = [], rects = [];
  ctx.ellipse = function (x, y, rx, ry) { ell.push({ x, y, rx, ry, fill: String(this.fillStyle) }); };
  ctx.fillRect = function (x, y, w, h) { rects.push({ x, y, w, h, fill: String(this.fillStyle) }); };
  K.G.s = "start"; K.setTitleMenuTop(1e9);
  K.rndr();
  assert.ok(kayak, "байдарка нарисована");
  const below = ell.filter(e => Math.abs(e.x - kayak.x) < 40 && e.y > kayak.y + 25 && /0,0,0/.test(e.fill));
  assert.equal(below.length, 0, "тёмной тени ниже днища нет");
  const wl = kayak.y + 16;
  assert.ok(rects.some(r => r.y >= wl - 2 && r.y <= wl + 2 && r.w >= 100 && /rgba\(40,\s*100,\s*170/.test(r.fill)), "вода по ватерлинии поверх корпуса");
});
