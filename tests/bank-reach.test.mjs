// Корпус байдарки (не спрайт с веслом!) упирается в урез воды с любой стороны,
// на любой реке и в любой точке дня. Прежние пробы мерили край спрайта — он
// шире корпуса на 15 px из-за весла, и зазор у берега проходил незамеченным.
import test from "node:test";
import assert from "node:assert/strict";
import { loadGame, setupWorld } from "./harness.mjs";

// Полуширина корпуса по карте спрайта: самый широкий ряд без весла (ряды,
// где закрашено больше 3/4 ширины, — это весло поперёк).
function hullHalf(K) {
  const m = K.SPR.kayak_center.map, W = m[0].length;
  let w = 0;
  for (const r of m) {
    const a = r.search(/[^.]/), b = r.length - 1 - [...r].reverse().join("").search(/[^.]/);
    if (a >= 0 && b - a + 1 < W * 0.75) w = Math.max(w, b - a + 1);
  }
  return w * K.SCALE / 2;
}

for (const day of [0, 2, 4, 6]) {
  test("день " + (day + 1) + ": корпус доходит до уреза с обеих сторон и не уходит за кадр", () => {
    const { K } = loadGame();
    setupWorld(K, { wy: 4000 });
    K.G.day = day; K.G.bev = [];
    const R = K.RIVERS[K.LEVELS[day].river];
    K.G.rWidth = R.width; K.G.rBend = R.bend; K.G.landSide = 1;
    K.G.segs = []; K.ensureSegments(40000);
    const hull = hullHalf(K), half = K.spriteSize("kayak_center").w / 2;
    const END = K.LEVELS[day].len * 25;
    const bad = [];
    for (let wy = 600; wy < END; wy += 97) {
      K.G.pwy = wy;
      const c = K.centerAt(wy), hw = K.widthAt(wy) / 2;
      for (const side of [-1, 1]) {
        K.G.t = 0; K.G.vt = 0;
        for (let i = 0; i < 300; i++) K.stepLateral(side);
        const x = K.screenXOf(K.G.t, wy);
        const gap = side * (c + side * hw - (x + side * hull));   // >0 — вода между бортом и берегом
        if (gap > 2) bad.push((side < 0 ? "левый" : "правый") + " зазор " + gap.toFixed(0) + " px на " + Math.round(wy / 25) + " м");
        // Лодка заходит к берегу глубоко: борт на песке не меньше чем на 10 px —
        // кроме мест, где дальше не пускает край кадра.
        const roomLeft = side < 0 ? x - half : 420 - (x + half);
        if (gap > -10 && roomLeft > 3) bad.push((side < 0 ? "левый" : "правый") + " мелко: борт на песке " + (-gap).toFixed(0) + " px на " + Math.round(wy / 25) + " м");
        if (x - half < -1 || x + half > 421) bad.push("спрайт за кадром на " + Math.round(wy / 25) + " м");
      }
    }
    assert.deepEqual(bad.slice(0, 6), [], "всего проблем: " + bad.length);
  });
}
