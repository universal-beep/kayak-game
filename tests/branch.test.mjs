// Ветки плывут по воде: не вылезают на берег и не наезжают на камни.
// Раньше у ветки не было обработки берега (как у бревна) — на изгибах её
// выносило на сушу.
import test from "node:test";
import assert from "node:assert/strict";
import { runInContext } from "node:vm";
import { loadGame, setupWorld } from "./harness.mjs";

test("ветки плывут по воде: ни на берегу, ни на камнях", () => {
  let frames = 0, land = 0, rock = 0;
  for (const [day, seed] of [[2, 5], [4, 9], [8, 13]]) {
    const { K, sandbox } = loadGame();
    runInContext(`(function(){ let a = ${seed} * 2654435761 >>> 0;
      Math.random = function(){ a = (a + 0x6D2B79F5) >>> 0; let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })()`, sandbox);
    setupWorld(K, { wy: 400 });
    K.G.day = day; const R = K.RIVERS[K.LEVELS[day].river]; K.G.rWidth = R.width; K.G.rBend = R.bend; K.G.rFreq = R.freq || 1;
    K.G.forks = []; K.G.bridges_ = []; K.G.s = "playing"; K.G.bev = []; K.G.obs = []; K.G.bns = []; K.G.waves = []; K.G.weeds = [];
    K.G.segs = []; K.ensureSegments(60000); K.G.inv = 1e9; K.G.df = 1;
    const vis = K.spriteSize("branch");
    for (let f = 0; f < 2500 && K.G.dist < K.level().len - 60; f++) {
      // Веток больше, чем в обычной игре, — чтобы проверка что-то значила.
      if (f % 90 === 0) K.G.obs.push({ type: "branch", t: ((f / 90 * 0.37) % 1.2) - 0.6, wy: K.spawnWy(), size: 28, halfPx: 14,
        visHalf: vis.w / 2, visHalfY: vis.h / 2, vt: 0, swingT: -1 });
      K.setAudio(null); K.upd(); K.G.s = "playing"; K.G.hp = 3; K.G.inv = 1e9;
      for (const b of K.G.obs) {
        if (b.type !== "branch") continue;
        const y = K.screenYOf(b.wy);
        if (y < -40 || y > 760) continue;
        frames++;
        const hw = K.widthAt(b.wy) / 2;
        if (Math.abs(b.t) * hw + b.visHalf > hw + 3) land++;
        for (const q of K.G.obs) if (q !== b && (q.type === "rock" || q.type === "snag") &&
          Math.abs(q.wy - b.wy) < (q.visHalfY || 20) + b.visHalfY - 4 &&
          Math.abs((q.t - b.t) * hw) < (q.visHalf || 20) + b.visHalf - 6) rock++;
      }
    }
  }
  assert.ok(frames > 1500, "веток почти не было: " + frames);
  assert.equal(land, 0, "кадров, где ветка на берегу: " + land + " из " + frames);
  assert.ok(rock <= frames * 0.002, "кадров, где ветка на камне: " + rock + " из " + frames);
});
