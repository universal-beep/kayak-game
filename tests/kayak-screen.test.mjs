// Байдарка на изгибе русла должна достигать УРЕЗА ВОДЫ, а не застревать у
// кромки экрана. Раньше lateralBounds был «экранным стражником»: клэмп по краям
// холста останавливал лодку за 15-20px до берега, когда изгиб прижимал русло к
// кромке, — «экран не пускал» доплыть. Теперь предел — та граница, что дальше:
// кромка экрана ИЛИ урез воды. Ось русла (centerAt) сама зажата в
// [2+hw, W-2-hw], поэтому причаливание к урезу держит корпус целиком в кадре.
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadGame } from "./harness.mjs";

const W = 420;

function setupLean(K) {
  K.G.day = 0;
  K.G.rWidth = 1;
  K.G.rBend = 2.2;                              // сильный завал русла к кромке
  K.G.landSide = 1;
  K.G.segs = [{ type: "calm", start: 0, end: 1e9 }];
  K.G.forks = []; K.G.bns = []; K.G.obs = []; K.G.pts = [];
  K.G.t = 0; K.G.vt = 0;
}

// Точка, где ось русла сильнее всего смещается влево (к левой кромке).
function worstLeftLean(K) {
  let wMin = 1000, cMin = 1e9;
  for (let w = 1000; w <= 2900; w++) {
    const cs = K.centerSines(w);
    if (cs < cMin) { cMin = cs; wMin = w; }
  }
  return wMin;
}

// Точка, где ось русла сильнее всего смещается вправо (к правой кромке).
function worstRightLean(K) {
  let wMax = 1000, cMax = -1e9;
  for (let w = 1000; w <= 2900; w++) {
    const cs = K.centerSines(w);
    if (cs > cMax) { cMax = cs; wMax = w; }
  }
  return wMax;
}

test("байдарка на изгибе дожимается к левому урезу воды (а не застревает у кромки)", () => {
  const { K } = loadGame();
  setupLean(K);
  const w = worstLeftLean(K);
  K.G.pwy = w; K.G.scroll = w;

  // До фикса: screenXOf(t,w) - half = 18 при любом дожиме — на 15-20px дальше
  // от берега, чем edg (урез), когда русло прижато к кромке.
  const edg = K.centerAt(w) - K.widthAt(w) / 2;
  for (let i = 0; i < 600 && K.G.t > -1.05; i++) K.stepLateral(-1);   // жмём влево
  assert.ok(K.G.t < 0, "гребец дожимается к левому берегу");

  const x = K.screenXOf(K.G.t, w);
  const half = K.spriteSize("kayak_center").w / 2;
  const boatLeft = x - half;
  assert.ok(boatLeft <= edg + 7, "корпус доходит до уреза воды: boatLeft=" +
    boatLeft.toFixed(1) + " edg=" + edg.toFixed(1) + " (t=" + K.G.t.toFixed(2) + ")");
  assert.ok(boatLeft >= -1, "причаливая, корпус не уходит за левую кромку холста");
});

test("байдарка на изгибе дожимается к правому урезу воды (зеркально)", () => {
  const { K } = loadGame();
  setupLean(K);
  const w = worstRightLean(K);
  K.G.pwy = w; K.G.scroll = w; K.G.t = 0; K.G.vt = 0;

  const edg = K.centerAt(w) + K.widthAt(w) / 2;
  for (let i = 0; i < 600 && K.G.t < 1.05; i++) K.stepLateral(1);     // жмём вправо
  assert.ok(K.G.t > 0, "гребец дожимается к правому берегу");

  const x = K.screenXOf(K.G.t, w);
  const half = K.spriteSize("kayak_center").w / 2;
  const boatRight = x + half;
  assert.ok(boatRight >= edg - 7, "корпус доходит до уреза воды: boatRight=" +
    boatRight.toFixed(1) + " edg=" + edg.toFixed(1) + " (t=" + K.G.t.toFixed(2) + ")");
  assert.ok(boatRight <= W + 1, "причаливая, корпус не уходит за правую кромку холста");
});

test("на широкой центрированной реке предел остаётся экранным (бонусы у берегов доступны)", () => {
  const { K } = loadGame();
  setupLean(K);
  K.G.rBend = 0.2; K.G.landSide = 0;            // почти прямая, река в центре
  K.G.pwy = 1600; K.G.scroll = 1600; K.G.t = 0; K.G.vt = 0;

  for (let i = 0; i < 600 && K.G.t < 1.05; i++) K.stepLateral(1);
  const x = K.screenXOf(K.G.t, 1600);
  const half = K.spriteSize("kayak_center").w / 2;
  // Русло не прижато к кромке — за урез выезжать не нужно, бонусы в русле
  // (t до ~±0.75) должны оставаться досягаемыми без «берегового» клэмпа:
  // дожимаем до TMAX и оказываемся дальше правого уреза.
  const bankR = K.centerAt(1600) + K.widthAt(1600) / 2;
  assert.ok(x + half > bankR, "бонусы у дальнего берега не отрезаны: x+half=" +
    (x + half).toFixed(1) + " bankR=" + bankR.toFixed(1) + " t=" + K.G.t.toFixed(2));
});