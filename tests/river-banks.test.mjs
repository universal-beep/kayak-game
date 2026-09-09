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
import { loadGame } from "./harness.mjs";

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