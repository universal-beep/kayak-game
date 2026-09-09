// Большой участок земли у финиша обеспечен рельефом, привязанным к дистанции
// уровня (level().len постоянен). Ключевая идея: река ДО финиша остаётся
// ШИРОКОЙ (Волга не должна суживаться на пол-уровня), а широкий берег
// причаливания даёт СДВИГ ОСИ к противоположному от лагеря берегу + лёгкое
// поджатие (-22%) только в самый короткий момент перед лентой. Рампа короткая
// и плавная — при появлении ленты сцена НЕ прыгает.
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadGame } from "./harness.mjs";

const W = 420;

test("финиш: река остаётся широкой, широкий берег даёт сдвиг оси", () => {
  const { K } = loadGame();
  K.G.day = 0;              // len = 800 (День 1, Волга)
  K.G.landSide = 1;         // причаливаем к правому берегу
  K.G.rWidth = 1; K.G.rBend = 0;
  K.G.segs = [{ type: "calm", start: 0, end: 1e9 }];
  const len = K.level().len;

  const w0 = 0;                       // далеко до финиша — русло обычное
  const w1 = len + 5000;              // за финишем — gain=1
  assert.ok(K.finishGain(w1) === 1 && K.finishGain(w0) === 0);

  // Волга у финиша НЕ сужается вдвое — остаётся не уже ~78% базовой ширины.
  const w0w = K.widthAt(w0), w1w = K.widthAt(w1);
  assert.ok(w1w >= w0w * 0.75, "река у финиша не схлопывается: " + w1w + " против " + w0w);

  // Сдвиг оси — строго терм -72*gain*landSide поверх базовых синусов.
  assert.ok(K.centerAt(w1) - K.centerSines(w1) === W/2 - 72, "ось ушла влево — правый (лагерный) берег расширяется");
  assert.ok(K.centerAt(w0) - K.centerSines(w0) === W/2, "далеко от финиша сдвига оси нет");

  // Широкий сухой берег у места причаливания: правая кромка воды далеко от
  // правого края холста (заведомо шире, чем без рельефа — там ~48px).
  const R = K.centerAt(w1) + K.widthAt(w1) / 2;
  assert.ok(W - R > 130, "у места причаливания широкий сухой берег: " + (W - R));
});

test("финиш НЕ дёргается: рампа короткая, плавная, начинается только у ленты", () => {
  const { K } = loadGame();
  K.G.day = 0;
  K.G.landSide = 1;
  K.G.rWidth = 1; K.G.rBend = 0;
  K.G.segs = [{ type: "calm", start: 0, end: 1e9 }];
  const len = K.level().len;

  // Пол-уровня до финиша русло вообще не тронуто (Волга остаётся широкой).
  assert.ok(K.finishGain(len - 300) === 0, "далеко от финиша русло обычное");
  assert.ok(K.finishGain(len - 120) === 0, "рампа начинается только от len-120");
  const bw = K.baseWidthAt(len - 120);
  assert.ok(K.widthAt(len - 120) === bw, "у ленты ширина пока базовая — нет резкого сужения");
  // Рампа растёт плавно и не переносит весь сдвиг одним кадром.
  const step = K.finishGain(len + 100) - K.finishGain(len + 50);
  assert.ok(step > 0 && step < 0.5, "плавный рост: " + step);
  assert.ok(K.finishGain(len + 260) === 1, "полное сужение к len+260");
});

test("река НЕ уходит за экран: финишный сдвиг оси и сильные синусы зажаты", () => {
  const { K } = loadGame();
  K.G.day = 0;
  K.G.landSide = 1;
  K.G.rWidth = 1; K.G.rBend = 2;
  K.G.segs = [{ type: "calm", start: 0, end: 1e9 }];
  for (const w of [0, 300, 650, 780, 800, 900, 1200, 3000]){
    const hw = K.widthAt(w)/2;
    const c = K.centerAt(w);
    assert.ok(c - hw >= 1 && c + hw <= W - 1,
      "река уходит за экран на w=" + w + ": [" + (c - hw).toFixed(1) + ", " + (c + hw).toFixed(1) + "]");
  }
});