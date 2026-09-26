// Волга — большая вода: больше реки, меньше берега, жителей по минимуму.
// Пляжам и компаниям при этом хватает места: русло отступает от их берега.
import test from "node:test";
import assert from "node:assert/strict";
import { loadGame, setupWorld } from "./harness.mjs";

function volga(K, day = 0) {
  setupWorld(K, { wy: 4000 });
  K.G.day = day;
  const R = K.RIVERS[0];
  K.G.rWidth = R.width; K.G.rBend = R.bend; K.G.landSide = 1;
  return R;
}

test("Волга: воды больше, чем берега — река занимает не меньше 80% экрана", () => {
  const { K } = loadGame();
  volga(K);
  let river = 0, n = 0;
  for (let w = 0; w < 18000; w += 50) { river += K.widthAt(w); n++; }
  assert.ok(river / n / 420 >= 0.8, "река занимает " + Math.round(100 * river / n / 420) + "% ширины экрана");
});

test("Волга: жителей на берегу по минимуму — реже, чем на лесных реках", () => {
  const counts = {};
  for (const day of [0, 2]) {
    const { K } = loadGame();
    setupWorld(K, { wy: 400 });
    K.G.day = day; K.G.s = "playing"; K.G.df = 0; K.G.inv = 1e9;
    const L = K.level(), R = K.RIVERS[L.river];
    K.G.rWidth = R.width; K.G.rBend = R.bend; K.G.segs = []; K.ensureSegments(40000);
    K.G.ned = 0; K.G.bev = [];
    let spawned = 0;
    for (let f = 0; f < 12000; f++) {
      const before = K.G.bev.length;
      try { K.upd(); } catch (e) { break; }
      K.G.s = "playing"; K.G.hp = 3;
      if (K.G.bev.length > before) spawned += K.G.bev.length - before;
    }
    counts[day] = spawned;
  }
  assert.ok(counts[0] * 2 <= counts[2], "на Волге жителей " + counts[0] + ", на Медведице " + counts[2]);
});

test("Волга: у пляжа и компании с гитарой хватает берега — сцена целиком в кадре", () => {
  const { K, ctx } = loadGame();
  for (const [type, variant] of [["beach", 1], ["beach", 2], ["guitar", 0]]) {
    for (const side of [-1, 1]) {
      volga(K);
      const wy = 9000;
      K.G.bev = [];
      K.placeBev({ type, side, wy, off: 30, phase: 1.3, mode: "sit", variant, shape: 0 }, 1);
      const e = K.G.bev[0];
      let x0 = Infinity, x1 = -Infinity;
      Object.assign(ctx, { drawImage(img, x) { x0 = Math.min(x0, x); x1 = Math.max(x1, x + img.width); } });
      K.G.scroll = e.wy - K.PY + 360; K.G.frame = 40;
      K.drwBev(e);
      assert.ok(x0 >= -1 && x1 <= 421, type + " на берегу " + side + " режется краем экрана: " + x0.toFixed(0) + ".." + x1.toFixed(0));
    }
  }
});

// Баг: житель, под которого сужено русло, удалялся, едва уйдя за нижнюю
// кромку, — и русло на экране прыгало назад (до 85 px за кадр).
test("Волга: русло на экране не прыгает, когда жители появляются и уходят", () => {
  const { K } = loadGame();
  setupWorld(K, { wy: 400 });
  K.G.day = 0; K.G.s = "playing"; K.G.df = 1; K.G.inv = 1e9;
  const R = K.RIVERS[0]; K.G.rWidth = R.width; K.G.rBend = R.bend;
  K.G.segs = []; K.ensureSegments(40000); K.G.ned = 0;
  let prev = null, worst = 0;
  for (let f = 0; f < 8000; f++) {
    K.G.inv = 1e9; K.G.hp = 3;
    K.upd(); K.G.s = "playing";
    const edges = [0, 200, 400, 700].map(y => { const w = K.worldYOf(y), c = K.centerAt(w), hw = K.widthAt(w) / 2; return [c - hw, c + hw]; });
    if (prev) edges.forEach((e, i) => { worst = Math.max(worst, Math.abs(e[0] - prev[i][0]), Math.abs(e[1] - prev[i][1])); });
    prev = edges;
  }
  assert.ok(worst < 6, "кромка воды прыгнула на " + worst.toFixed(1) + " px за кадр");
});
