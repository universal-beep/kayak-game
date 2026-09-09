// Финиш уровня — причал к палаточному лагерю.
// Лагерь компактный (как было), а «большой участок земли» даёт рельеф:
// у места причаливания река сужается и уходит в сторону, берег лагеря широкий.
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadGame } from "./harness.mjs";

function setupForCamp(K) {
  K.G.s = "playing";
  K.G.day = 0;
  K.G.landSide = 1;
  K.G.bev = [];
  K.G.frame = 10;
}

test("лагерь у финиша компактный (людей не больше, чем было)", () => {
  const { K } = loadGame();
  setupForCamp(K);
  K.spawnCamp(1000);
  const camp = K.G.bev.filter(e => !e.atCamp || e.side === 1);
  const singleBank = K.G.bev.filter(e => e.side === 1); // сторона причаливания
  assert.ok(singleBank.length <= 8, "на берегу лагеря не толпа: " + singleBank.length);
  assert.ok(K.G.bev.length <= 14, "всего в сцене (обе стороны) не больше 14: " + K.G.bev.length);
  const kinds = new Set(singleBank.map(e => e.type));
  assert.ok(kinds.has("tent") && kinds.has("tent2"), "обе формы палаток");
  assert.ok(kinds.has("fire") && kinds.has("ducks") && kinds.has("fisher"), "костёр и утки с рыбаком у воды");
});

test("палатки в лагере разных цветов (variant доходит до справйта)", () => {
  const { K } = loadGame();
  setupForCamp(K);
  K.spawnCamp(1000);
  const tents = K.G.bev.filter(e => e.type === "tent" || e.type === "tent2");
  const variants = tents.map(e => e.variant);
  assert.ok(tents.length >= 2, "есть обе палатки лагеря: " + tents.length);
  assert.ok(new Set(variants).size >= 2, "палатки разного цвета: " + variants.join(","));
});

test("drwBev рисует палатку в указанном варианте (разные картинки)", () => {
  const { K, ctx } = loadGame();
  const imgs = [];
  const orig = ctx.drawImage;
  ctx.drawImage = (img) => { imgs.push(img); };
  const wy = 1000;
  K.G.scroll = wy; K.G.s = "playing";
  K.G.rWidth = 1; K.G.rBend = 1;
  K.G.segs = [{ type: "calm", start: 0, end: 1e9 }];
  K.G.frame = 10;
  K.drwBev({ type: "tent", side: 1, wy, off: 40, phase: 1, mode: "sit", variant: 0 });
  K.drwBev({ type: "tent", side: 1, wy, off: 40, phase: 1, mode: "sit", variant: 3 });
  assert.ok(imgs.length >= 2, "два спрайта нарисованы");
  assert.notEqual(imgs[0], imgs[1], "вариант 0 и вариант 3 — разные канвасы");
});