// Панч-тест драки вёслами.
// Красный сценарий: сейчас
//   1) нет пиксельных кадров rower_wind/rower_strike/rower_flip (только процедурные rect);
//   2) нет функции выбора кадра fightFrame();
//   3) парирование мгновенно удаляет соперника через splice — без переворота лодки.
// После фичи: кадры есть, fightFrame() выбирает их по swingT, парирование
// переворачивает лодку (flipT), и она плавно исчезает.
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadGame, setupWorld } from "./harness.mjs";

const { K } = loadGame();

function makeAggressor(K, { swingT = 50, aggro = true, flipT = 0, t = 0.2 } = {}) {
  setupWorld(K);
  K.G.s = "playing";
  const o = { t, wy: K.G.pwy, type: "kayaker", size: 20, halfPx: 14, visHalf: 28,
              sprite: undefined, variant: 0, vt: 0, swingT, aggro, flipT };
  K.G.obs.push(o);
  return o;
}

test("SPR имеет пиксельные кадры драки (wind/strike/flip)", () => {
  assert.ok(K.SPR.rower_wind, "нужен кадр замаха rower_wind");
  assert.ok(K.SPR.rower_strike, "нужен кадр удара rower_strike");
  assert.ok(K.SPR.rower_flip, "нужен кадр переворота rower_flip");
  // Кадры должны отличаться от покоя
  assert.notDeepEqual(K.SPR.rower_wind.map, K.SPR.rower.map);
  assert.notDeepEqual(K.SPR.rower_strike.map, K.SPR.rower.map);
});

test("fightFrame() выбирает кадр по состоянию", () => {
  assert.equal(typeof K.fightFrame, "function", "нужен экспорт fightFrame()");

  // замах идёт (swingT > PARRY_WINDOW) → кадр замаха
  const wind = makeAggressor(K, { swingT: K.SWING_FRAMES });
  assert.equal(K.fightFrame(wind), "rower_wind");

  // окно парирования (swingT <= PARRY_WINDOW) → кадр удара
  K.G.obs = [];
  const strike = makeAggressor(K, { swingT: K.PARRY_WINDOW });
  assert.equal(K.fightFrame(strike), "rower_strike");

  // перевёрнутая лодка первенствует
  K.G.obs = [];
  const flip = makeAggressor(K, { swingT: -1, aggro: false, flipT: 30 });
  assert.equal(K.fightFrame(flip), "rower_flip");

  // спокойный гребец → без кадра
  K.G.obs = [];
  const idle = makeAggressor(K, { swingT: -1, aggro: false });
  assert.equal(K.fightFrame(idle), null);
});

test("парирование переворачивает лодку, а не удаляет мгновенно", () => {
  const o = makeAggressor(K, { swingT: K.PARRY_WINDOW - 5 }); // в окне → паррируется
  K.G.obs = [o];
  K.G.inv = 0; K.G.whiskyT = 0; K.G.parries = 0; K.G.shake = 0;
  K.paddleStrike();
  const survivor = K.G.obs.find(x => x.type === "kayaker");
  assert.ok(survivor, "соперник должен остаться в мире после парирования (переворачивается, а не исчезает)");
  assert.ok(survivor.flipT > 0, "у перевёрнутой лодки должен быть flipT > 0");
  assert.equal(survivor.aggro, false, "после парирования соперник больше не агрессивен");
  assert.equal(survivor.swingT, -1, "замах сброшен");
});

test("перевёрнутая лодка дрейфует до конца отсчёта и тонет (splice)", () => {
  const o = makeAggressor(K, { flipT: 1, t: 0.8 });
  K.G.obs = [o];
  K.G.t = 0.0; // далеко от игрока, chkCl не съест объект за контакт с игроком
  K.upd();
  assert.ok(!K.G.obs.includes(o), "после истечения flipT перевёрнутая лодка удаляется из мира");
});