// Свой уровень: генератор всегда оставляет проход, редактор ставит и стирает
// предметы, предметы появляются там, где поставлены, случайного спавна нет,
// а поход и рекорды уровень не трогает.
import test from "node:test";
import assert from "node:assert/strict";
import { loadGame } from "./harness.mjs";

function game() {
  const { K } = loadGame();
  K.resetSave();
  return K;
}

test("генератор: проход есть при любых реке, длине, сложности и зерне", () => {
  const K = game();
  for (let river = 0; river < 4; river++)
    for (let len = 0; len < 3; len++)
      for (let diff = 0; diff < 3; diff++)
        for (let seed = 1; seed <= 12; seed++) {
          const items = K.genCustom(river, len, diff, seed);
          assert.equal(K.customBlockedRow(items, K.customRows(len)), -1, `река ${river} длина ${len} сложность ${diff} зерно ${seed}`);
          for (const it of items) assert.ok(it.c >= 0 && it.c < K.CUSTOM_COLS && it.r >= 1 && it.r < K.customRows(len));
        }
});

test("генератор: одно зерно — один уровень, зёрна разные — уровни разные; трудно гуще, чем легко", () => {
  const K = game();
  const a = JSON.stringify(K.genCustom(1, 1, 1, 5)), b = JSON.stringify(K.genCustom(1, 1, 1, 5)), c = JSON.stringify(K.genCustom(1, 1, 1, 6));
  assert.equal(a, b);
  assert.notEqual(a, c);
  let easy = 0, hard = 0;
  for (let s = 1; s <= 10; s++) { easy += K.genCustom(0, 1, 0, s).length; hard += K.genCustom(0, 1, 2, s).length; }
  assert.ok(hard > easy, "трудно гуще: " + hard + " против " + easy);
});

test("проверка прохода: перекрытый ряд и слишком резкий сдвиг", () => {
  const K = game();
  const wall = []; for (let c = 0; c < K.CUSTOM_COLS; c++) wall.push({ c, r: 3, k:"rock" });
  assert.equal(K.customBlockedRow(wall, 10), 3, "ряд перекрыт целиком");
  wall.pop();
  assert.equal(K.customBlockedRow(wall, 10), -1, "одна щель — проход");
  // Щель в левой клетке ряда 3 и в правой клетке ряда 4: за один ряд через всю реку не перебраться.
  const jump = [];
  for (let c = 1; c < K.CUSTOM_COLS; c++) jump.push({ c, r: 3, k:"rock" });
  for (let c = 0; c < K.CUSTOM_COLS - 1; c++) jump.push({ c, r: 4, k:"rock" });
  assert.equal(K.customBlockedRow(jump, 10), 4);
  const bonuses = []; for (let c = 0; c < K.CUSTOM_COLS; c++) bonuses.push({ c, r: 3, k:"bread" });
  assert.equal(K.customBlockedRow(bonuses, 10), -1, "бонус не преграда");
});

test("клетка: поставить, заменить, стереть; одна клетка — один предмет", () => {
  const K = game();
  const items = [];
  K.setCell(items, 2, 5, "rock");
  K.setCell(items, 2, 5, "log");
  assert.equal(items.length, 1);
  assert.equal(items[0].k, "log");
  K.setCell(items, 0, 1, "sun");
  assert.deepEqual(items.map(i => i.r), [1, 5], "порядок по рядам");
  K.setCell(items, 2, 5, null);
  assert.equal(items.length, 1);
});

test("предметы появляются в своих клетках, лишнего нет", () => {
  const K = game();
  const cs = K.getCs();
  cs.river = 1; cs.lenIdx = 1;
  cs.items = [{ c:0, r:2, k:"rock" }, { c:6, r:2, k:"bread" }, { c:3, r:3, k:"aggro" }];
  K.startCustom();
  assert.equal(K.G.custom.custom, true);
  let frames = 0;
  while (K.G.obs.length + K.G.bns.length < 3 && frames++ < 4000 && K.G.s === "playing") K.upd();
  assert.ok(frames < 4000, "предметы дождались");
  assert.equal(K.G.obs.length, 2, "камень и злой гребец, ничего случайного");
  const rock = K.G.obs.find(o => o.type === "rock"), foe = K.G.obs.find(o => o.type === "kayaker");
  assert.ok(Math.abs(rock.t - K.colT(0)) < 1e-9 && rock.wy === K.itemWy({ r:2 }));
  assert.ok(foe.aggro);
  assert.ok(Math.abs(K.G.bns[0].t - K.colT(6)) < 1e-9 && K.G.bns[0].type === "bread");
});

test("пустой уровень: случайные препятствия и бонусы не появляются", () => {
  const K = game();
  K.getCs().items = [];
  K.startCustom();
  for (let i = 0; i < 1500 && K.G.s === "playing"; i++) K.upd();
  assert.equal(K.G.obs.length, 0);
  assert.equal(K.G.bns.length, 0);
});

test("прохождение своего уровня не трогает поход: звёзды, кошелёк, дни, рекорды", () => {
  const K = game();
  K.getCs().items = [];
  K.startCustom();
  K.G.dist = 300; K.G.bsc = 120;
  const before = JSON.stringify(K.save);
  K.finishLevel();
  assert.equal(K.G.s, "customEnd");
  assert.equal(JSON.stringify(K.save), before);
  assert.ok(K.getCs().best >= 420, "рекорд уровня запомнен");
  K.startCustom();
  K.failLevel();
  assert.equal(K.G.s, "customEnd");
  assert.equal(JSON.stringify(K.save), before);
});

test("обычный день после своего уровня снова идёт по походу", () => {
  const K = game();
  K.startCustom();
  assert.ok(K.G.custom);
  K.startDay(3);
  assert.equal(K.G.custom, null);
  assert.equal(K.G.day, 3);
});

test("редактор рисуется и считает информацию без ошибок", () => {
  const K = game();
  assert.doesNotThrow(() => K.showEditor());
  const cs = K.getCs();
  cs.items = K.genCustom(2, 1, 1, 3);
  assert.doesNotThrow(() => K.drwEditor());
  assert.match(K.edInfoText(), /ПРОХОД ЕСТЬ/);
  for (let c = 0; c < K.CUSTOM_COLS; c++) K.setCell(cs.items, c, 4, "rock");
  assert.match(K.edInfoText(), /ПРОХОДА НЕТ: РЯД 5/);
  assert.doesNotThrow(() => K.showStart());
});
