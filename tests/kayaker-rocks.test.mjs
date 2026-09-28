// Соперники не проплывают сквозь камни. Раньше на Осуге (много камней,
// «клыки») байдарочник въезжал в камень: уклонение складывало опасности
// слева и справа, и они гасили друг друга, а расталкивание упиралось в край
// русла и не пробовало обойти с другой стороны.
import test from "node:test";
import assert from "node:assert/strict";
import { runInContext } from "node:vm";
import { loadGame, setupWorld } from "./harness.mjs";

test("за день на Осуге байдарочник ни разу не заезжает глубоко на камень", () => {
  let deep = 0, seen = 0; const ex = [];
  for (const day of [6, 7]) for (const seed of [3, 17, 42, 80]) {
    const { K, sandbox } = loadGame();
    runInContext(`(function(){ let a = ${seed} * 2654435761 >>> 0;
      Math.random = function(){ a = (a + 0x6D2B79F5) >>> 0; let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })()`, sandbox);
    setupWorld(K, { wy: 400 });
    K.G.day = day; const R = K.RIVERS[K.LEVELS[day].river]; K.G.rWidth = R.width; K.G.rBend = R.bend; K.G.rFreq = R.freq || 1;
    K.G.forks = []; K.G.bridges_ = []; K.G.s = "playing"; K.G.bev = []; K.G.obs = []; K.G.bns = []; K.G.waves = []; K.G.weeds = [];
    K.G.segs = []; K.ensureSegments(40000); K.G.inv = 1e9; K.G.df = 1;
    for (let f = 0; f < 3000 && K.G.dist < K.level().len - 60; f++) {
      K.setAudio(null); K.upd(); K.G.s = "playing"; K.G.hp = 3; K.G.inv = 1e9;
      for (const b of K.G.obs) if (b.type === "kayaker" && !(b.flipT > 0)) {
        seen++;
        for (const q of K.G.obs) {
          if (q.type !== "rock") continue;
          const hw = K.widthAt(b.wy) / 2;
          if (Math.abs(b.wy - q.wy) < 0.55 * ((b.visHalfY || 20) + (q.visHalfY || 20)) &&
              Math.abs((b.t - q.t) * hw) < 0.55 * (b.visHalf + (q.visHalf || 20))) {
            deep++; if (ex.length < 3) ex.push("день " + (day + 1) + " зерно " + seed + " кадр " + f + " " + q.sprite);
          }
        }
      }
    }
  }
  assert.ok(seen > 3000, "байдарочников почти не было: " + seen);
  assert.equal(deep, 0, "на камне, кадров: " + deep + " — " + ex.join("; "));
});
