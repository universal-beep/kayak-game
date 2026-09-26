// Между камнями всегда можно проскочить: любой новый камень ставится так,
// чтобы поперёк реки оставался проход не уже PASS_GAP — байдарка (корпус
// 33 px) проходит с запасом.
import test from "node:test";
import assert from "node:assert/strict";
import { loadGame, setupWorld } from "./harness.mjs";

function maxGap(K, wy) {
  const c = K.centerAt(wy), hw = K.widthAt(wy) / 2;
  const iv = [];
  for (const o of K.G.obs) {
    if (Math.abs(o.wy - wy) > (o.visHalfY || 24)) continue;
    const x = K.screenXOf(o.t, o.wy), h = o.visHalf || 24;
    iv.push([x - h, x + h]);
  }
  iv.sort((a, b) => a[0] - b[0]);
  let at = c - hw, best = 0;
  for (const [a, b] of iv) { best = Math.max(best, a - at); at = Math.max(at, b); }
  return Math.max(best, c + hw - at);
}

for (const day of [2, 6, 8]) {
  test("день " + (day + 1) + ": поперёк реки всегда остаётся проход для байдарки", () => {
    const { K } = loadGame();
    setupWorld(K, { wy: 6000 });
    K.G.day = day; const R = K.RIVERS[K.LEVELS[day].river]; K.G.rWidth = R.width; K.G.rBend = R.bend;
    K.G.segs = []; K.ensureSegments(80000); K.G.forks = []; K.G.bev = []; K.G.bns = []; K.G.weeds = [];
    let worst = Infinity, where = 0;
    for (let step = 0; step < 60; step++) {
      K.G.scroll = 6000 + step * 400;
      K.G.obs = [];
      for (let i = 0; i < 80; i++) K.spOb();         // густо, как в худшем случае
      K.G.obs = K.G.obs.filter(o => o.type !== "barge" && o.type !== "boat");
      const sw = K.spawnWy();
      for (let wy = sw - 120; wy <= sw + 120; wy += 6) {
        const gp = maxGap(K, wy);
        if (gp < worst) { worst = gp; where = wy; }
      }
    }
    assert.ok(worst >= K.PASS_GAP - 1, "самый узкий проход " + worst.toFixed(0) + " px (нужно " + K.PASS_GAP + ") на wy=" + Math.round(where));
  });
}
