// Первая баржа дня 2 выходит по сценарию: медленно, с одной стороны,
// с подписью и гудком за 400 px — чтобы игрок успел выбрать проход.
import test from "node:test";
import assert from "node:assert/strict";
import { loadGame, setupWorld } from "./harness.mjs";

function day2(){
  const { K, ctx } = loadGame();
  K.resetSave();
  K.startDay(1);
  setupWorld(K, { wy: 5000 });
  K.G.dist = K.G.bargeIntro.at;
  K.bargeIntroTick();
  return { K, ctx, B: K.G.bargeIntro, barge: K.G.bargeIntro.barge };
}
test("баржа: первый выход сценарный, медленный, с проходом", () => {
  const { K, B, barge } = day2();
  assert.ok(barge, "баржа появилась");
  assert.equal(barge.intro, true);
  assert.equal(barge.slow, 0.65, "первая баржа идёт медленнее");
  assert.ok(barge.t < -0.3, "баржа смещена к одному берегу, проход свободен");
  assert.ok(K.gapFor(barge, barge.t) > 80, "рядом с баржой остаётся проход");
  assert.equal(B.done, true, "сценарий отработал один раз");

  assert.match(K.G.hint.text, /БАРЖА/);
});

test("баржа: гудок один раз за 400 px до встречи", () => {
  const { K, barge } = day2();
  K.G.pwy = barge.wy - 450;
  K.G.sfxLast = null;
  K.bargeHorn();
  assert.notEqual(K.G.sfxLast, "horn", "за 450 px ещё тихо");
  K.G.pwy = barge.wy - 390;
  K.bargeHorn();
  assert.equal(K.G.sfxLast, "horn", "за 390 px баржа гудит");
  assert.equal(K.save.seen.barge, 1, "после гудка знакомство запомнилось");
  K.startDay(1);
  assert.equal(K.G.bargeIntro, null, "повторно сценарная баржа не выходит");

  K.G.sfxLast = null;
  K.bargeHorn();
  assert.notEqual(K.G.sfxLast, "horn", "повторного гудка нет");
});

test("баржа: впереди висит маркер", () => {
  const { K, ctx } = day2();
  const barge = K.G.bargeIntro.barge;
  K.G.pwy = barge.wy - 300;
  const glyphs = [];
  ctx.fillText = text => glyphs.push(text);
  K.drwBargeWarn();
  assert.ok(glyphs.includes("!"), "над водой есть восклицательный знак");
});

test("баржа: после знакомства идёт обычная скорость", () => {
  const { K, barge } = day2();
  const wy = barge.wy;
  K.bargeStep(barge, 10);
  assert.equal(Math.round((barge.wy - wy) * 10) / 10, 6.5, "сценарная баржа плывёт на 0.65 скорости");
  delete barge.slow;
  const wy2 = barge.wy;
  K.bargeStep(barge, 10);
  assert.equal(Math.round((barge.wy - wy2) * 10) / 10, 10, "обычная баржа идёт с полной скоростью");
});
