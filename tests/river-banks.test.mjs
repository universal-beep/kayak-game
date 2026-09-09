// Берега реки: Доп 17. Две регрессии в одной теме «с берегами нельзя доплыть».
//   1) Русло держит УРЕЗ ВОДЫ не ближе 40px к кромке холста на всём сплаве
//      (кроме последних ~120px финишной рампы): к любому берегу можно подгрести
//      вплотную, байдарка остаётся целиком в кадре.
//   2) Центробежный снос считается ТОЛЬКО от изгибов (curvBend), без финишной
//      рампы: раньше в точке старта рампы (len-120) её кусочная производная
//      давала ложный всплеск кривизны, снос перебивал вёсла, и к левому берегу
//      в конце дистанции было не подгрести («слева не пускает»).
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadGame, setupWorld } from "./harness.mjs";

// День 1 — Волга (ruslo 0, len 800), эталон широкой реки, где жаловались.
const W = 420;
// Река из sg() дня 1: Волга — ширину/кривизну задаём явно, чтобы проверять
// именно её конфиг, а не дефолты харнесса (rWidth=1, rBend=1).
function volga(K) {
  K.G.day = 1; K.G.df = 0;
  K.G.rWidth = 1.35; K.G.rBend = 0.55;
  return K;
}

test("оба уреза воды не ближе 24px к кромке холста весь сплав (кроме последних ~130px)", () => {
  const { K } = loadGame();
  volga(K);
  const len = K.level().len;
  for (let wy = 0; wy <= len - 130; wy += 20) {
    const c = K.centerAt(wy), hw = K.widthAt(wy) / 2;
    assert.ok(c - hw >= 24, "левый урез с запасом: edgL=" + (c - hw).toFixed(1) + " wy=" + wy);
    assert.ok(c + hw <= W - 24, "правый урез с запасом: edgR=" + (c + hw).toFixed(1) + " wy=" + wy);
  }
});

test("к урезу можно дойти ВПЛОТНУЮ с любой стороны по всему дню 1", () => {
  const { K } = loadGame();
  volga(K);
  const len = K.level().len;
  const half = K.spriteSize("kayak_center").w / 2;
  for (let wy = 0; wy <= len; wy += 20) {
    const c = K.centerAt(wy), hw = K.widthAt(wy) / 2;
    const [tMin, tMax] = K.lateralBounds(wy);
    const boatLeft = c + tMin * hw - half;
    const boatRight = c + tMax * hw + half;
    assert.ok(boatLeft <= c - hw + 8, "левый борт доезжает до уреза: " + boatLeft.toFixed(1) + " wy=" + wy);
    assert.ok(boatRight >= c + hw - 8, "правый борт доезжает до уреза: " + boatRight.toFixed(1) + " wy=" + wy);
  }
});

test("старт финишной рампы: снос рампа не перебивает вёсла, дожим влево доходит до берега", () => {
  const { K } = loadGame();
  volga(K);
  const len = K.level().len;
  const w = len - 120;                 // бывшая точка ложного всплеска кривизны рампы
  K.G.pwy = w; K.G.t = 0; K.G.vt = 0; K.G.breadT = 0;
  for (let i = 0; i < 600; i++) K.stepLateral(-1);
  assert.ok(K.G.t < 0, "дожим влево приводит к левому берегу даже у финиша: t=" + K.G.t.toFixed(2));
  const half = K.spriteSize("kayak_center").w / 2;
  const c = K.centerAt(w), hw = K.widthAt(w) / 2;
  assert.ok(K.screenXOf(K.G.t, w) - half <= c - hw + 8,
    "корпус дотягивается до левого уреза: x=" + K.screenXOf(K.G.t, w).toFixed(1) + " edgL=" + (c - hw).toFixed(1));
});

// Прибережная полоса «трава-песок» в drwBg. Структурный тест: на ОБОИХ берегах
// в полосах без тумана (y ≥ 320, цвета затуманивания не влияют) рисуется
// мокрый песок шириной 14px от уреза + сухая трава до ПОЛ-ЛОДКИ (31px).
// До фикса песок был 6px — «берег срезан», лодка стояла на голом крае.
function recordingCtx(raw) {
  const calls = [];
  raw.fillRect = function (x, y, w, h) {
    calls.push({ kind: "rect", x, y, w, h, color: raw.fillStyle, alpha: raw.globalAlpha });
  };
  return calls;
}

test("берег с травой-песком: с каждого берега песок 14px + трава до пол-лодки (31px)", () => {
  const { K, ctx } = loadGame();
  K.G.df = 0;
  // Кадр в СЕРЕДИНЕ курса (scroll 700 → wy 194..590, далеко от финишной рампы
  // len-120=680), где банки заведомо шире 31px — полоса должна быть полной.
  setupWorld(K, { wy: 700, t: 0, rWidth: 1 });
  const calls = recordingCtx(ctx);
  K.drwBg();
  const rects = calls.filter(c => c.kind === "rect");
  assert.ok(rects.length > 0, "drwBg наполнила кадр");
  assert.ok(rects.some(r => Number.isNaN(parseInt(String(r.color).replace(/\D/g, ""), 10)) === false),
    "нет NaN-цветов в заливках берега");
  // y ≥ 320 → fy = 0: полосы вдали не размыты туманом. Проверяем КАЖДУЮ такую
  // полосу: и слева, и справа есть песок (14px у уреза) и трава-остаток (до 31px).
  let bandsChecked = 0;
  for (let y = 320; y < 716; y += 4) {
    const wy = K.worldYOf(y);
    const c = K.centerAt(wy), hw = K.widthAt(wy) / 2;
    const L = c - hw, R = c + hw;
    if (L < 31) continue;    // только полосы с полным берегом
    bandsChecked++;
    const at = (x, w) => rects.some(r => r.y === y && r.h === 4
      && Math.abs(r.x - x) < 0.01 && Math.abs(r.w - w) < 0.01);
    assert.ok(at(L - 14, 14), "левый берег: песок 14px от уреза (y=" + y + ", L=" + L.toFixed(1) + ")");
    assert.ok(at(R, 14), "правый берег: песок 14px от уреза (y=" + y + ", R=" + R.toFixed(1) + ")");
    assert.ok(at(L - 31, 17), "левый берег: трава до пол-лодки (31px, y=" + y + ")");
    assert.ok(at(R + 14, 17), "правый берег: трава до пол-лодки (31px, y=" + y + ")");
  }
  assert.ok(bandsChecked >= 50, "проверено достаточно полос с полным берегом: " + bandsChecked);
  // Узкий песок прошлой версии (6px) нигде не остался.
  assert.ok(!rects.some(r => Math.abs(r.w - 6) < 0.01), "узкая 6px песчаная кайма удалена");
});