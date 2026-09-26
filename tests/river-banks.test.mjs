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
  K.G.rWidth = K.RIVERS[0].width; K.G.rBend = K.RIVERS[0].bend;
  return K;
}

// Мир в пикселях: конец дистанции — len·25 (1 м = 25 px). Раньше тесты брали
// len в метрах за пиксели и проверяли только первые ~670 px дня (3% пути) —
// поэтому не видели, что финишная рампа сдвигала русло весь день.
const END = K => K.level().len * 25;

test("оба уреза воды не ближе 20px к кромке холста весь сплав", () => {
  const { K } = loadGame();
  volga(K);
  for (let wy = 0; wy <= END(K) + 400; wy += 20) {
    const c = K.centerAt(wy), hw = K.widthAt(wy) / 2;
    assert.ok(c - hw >= 19.5, "левый урез с запасом: edgL=" + (c - hw).toFixed(1) + " wy=" + wy);
    assert.ok(c + hw <= W - 19.5, "правый урез с запасом: edgR=" + (c + hw).toFixed(1) + " wy=" + wy);
  }
});

test("к урезу можно дойти ВПЛОТНУЮ с любой стороны по всему дню 1", () => {
  const { K } = loadGame();
  volga(K);
  const half = K.spriteSize("kayak_center").w / 2;
  for (let wy = 0; wy <= END(K); wy += 20) {
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
  const w = END(K) - 830;               // старт финишной рампы
  K.G.pwy = w; K.G.t = 0; K.G.vt = 0; K.G.breadT = 0;
  for (let i = 0; i < 600; i++) K.stepLateral(-1);
  assert.ok(K.G.t < 0, "дожим влево приводит к левому берегу даже у финиша: t=" + K.G.t.toFixed(2));
  const half = K.spriteSize("kayak_center").w / 2;
  const c = K.centerAt(w), hw = K.widthAt(w) / 2;
  assert.ok(K.screenXOf(K.G.t, w) - half <= c - hw + 8,
    "корпус дотягивается до левого уреза: x=" + K.screenXOf(K.G.t, w).toFixed(1) + " edgL=" + (c - hw).toFixed(1));
});
test("финишная рампа включается только у финиша, на всех девяти днях", () => {
  const { K } = loadGame();
  for (let day = 0; day < 9; day++) {
    K.G.day = day;
    let on = 0, n = 0;
    for (let w = 0; w <= END(K); w += 50) { n++; if (K.finishGain(w) > 0) on++; }
    assert.ok(on / n < 0.06, "день " + (day + 1) + ": рампа включена на " + Math.round(100 * on / n) + "% пути");
    assert.equal(K.finishGain(END(K)), 1, "день " + (day + 1) + ": у финиша рампа полная");
  }
});

test("берега одинаково доступны: вне финиша русло в среднем по центру экрана", () => {
  const { K } = loadGame();
  for (const day of [0, 2, 4, 6]) {
    K.G.day = day;
    const R = K.RIVERS[K.level().river]; K.G.rWidth = R.width; K.G.rBend = R.bend; K.G.landSide = 1;
    let sum = 0, n = 0;
    for (let w = 0; w < END(K) - 900; w += 25) { sum += K.centerAt(w) - W / 2; n++; }
    assert.ok(Math.abs(sum / n) < 8, "день " + (day + 1) + ": русло в среднем сдвинуто на " + (sum / n).toFixed(0) + " px — один берег шире другого");
  }
});
