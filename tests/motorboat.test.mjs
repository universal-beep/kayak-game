// Катер на Тверце (день 6): мчится навстречу по своей полосе, обходит
// препятствия, у моста уходит в средний пролёт и гонит волны, которые
// раскачивают байдарку.
import test from "node:test";
import assert from "node:assert/strict";
import { runInContext } from "node:vm";
import { loadGame, setupWorld } from "./harness.mjs";

function day6(wy = 6000) {
  const { K, ctx } = loadGame();
  setupWorld(K, { wy });
  K.G.day = 5; const R = K.RIVERS[K.LEVELS[5].river]; K.G.rWidth = R.width; K.G.rBend = R.bend;
  K.G.segs = [{ type: "calm", start: 0, end: 1e9 }]; K.G.forks = []; K.G.bridges_ = [];
  K.G.s = "playing"; K.G.bev = []; K.G.obs = []; K.G.bns = []; K.G.waves = []; K.G.weeds = [];
  return { K, ctx };
}
const boats = K => K.G.obs.filter(o => o.type === "boat");

test("катера только во второй день Тверцы (день 6)", () => {
  for (let d = 0; d < 9; d++) {
    const { K } = day6(); K.G.day = d;
    K.spBoat();
    assert.equal(boats(K).length > 0, d === 5, "день " + (d + 1));
  }
});

test("катер появляется над экраном и мчится навстречу быстрее течения", () => {
  const { K } = day6();
  K.spBoat();
  const o = boats(K)[0];
  assert.ok(K.screenYOf(o.wy) + o.visHalfY < 0, "катер возник в кадре");
  const y0 = K.screenYOf(o.wy);
  for (let i = 0; i < 60; i++) K.boatStep(o);
  assert.ok(K.screenYOf(o.wy) - y0 > 120, "за секунду прошёл меньше 120 px по экрану");
});

test("катер идёт по воде и обходит камень на своей полосе", () => {
  const { K } = day6();
  K.spBoat();
  const o = boats(K)[0];
  const rock = { type: "rock", t: o.t, wy: o.wy - 420, halfPx: 20, visHalf: 21, visHalfY: 21 };
  K.G.obs.push(rock);
  let minGap = Infinity;
  for (let i = 0; i < 400; i++) {
    K.boatStep(o);
    const hw = K.widthAt(o.wy) / 2;
    assert.ok(Math.abs(o.t) * hw + o.visHalf <= hw + 2, "катер вылез на берег");
    if (Math.abs(o.wy - rock.wy) < o.visHalfY + rock.visHalfY)
      minGap = Math.min(minGap, Math.abs((o.t - rock.t) * K.widthAt(rock.wy) / 2) - o.visHalf - rock.visHalf);
  }
  assert.ok(minGap > 0, "катер прошёл сквозь камень: " + minGap.toFixed(1));
});

test("у моста катер уходит в средний пролёт и не задевает опоры", () => {
  const { K } = day6();
  K.spBoat();
  const o = boats(K)[0];
  const b = { wy: o.wy - 500, passed: false };
  K.G.bridges_.push(b);
  let at = null;
  for (let i = 0; i < 400 && at === null; i++) { K.boatStep(o); if (o.wy <= b.wy) at = o.t; }
  assert.notEqual(at, null, "не дошёл до моста");
  const hw = K.widthAt(b.wy) / 2;
  assert.ok(Math.abs(at) * hw + o.visHalf < 0.44 * hw - 12, "в опору: t=" + at.toFixed(2));
});

test("волны от катера раскачивают байдарку в сторону от его хода", () => {
  const { K } = day6();
  K.spBoat();
  const o = boats(K)[0];
  const hw = K.widthAt(K.G.pwy) / 2;
  K.G.t = o.t > 0 ? o.t - 0.7 : o.t + 0.7;             // байдарка в стороне от полосы катера
  const away = K.G.t < o.t ? -1 : 1;
  let push = 0, shake = 0;
  for (let i = 0; i < 700; i++) {
    K.boatStep(o);
    K.waveStep();
    const vt = K.G.vt; K.G.vt = 0;
    push += vt; shake = Math.max(shake, K.G.shake || 0);
    K.G.shake = 0;
  }
  assert.ok(K.G.waves.length >= 0);
  assert.ok(push * away > 0.01, "волны не толкнули байдарку от хода катера: " + push.toFixed(3));
  assert.ok(shake > 1, "байдарку не качнуло");
  void hw;
});

test("удар о катер — минус сердце", () => {
  const { K } = day6();
  K.spBoat();
  const o = boats(K)[0];
  o.wy = K.G.pwy; o.t = K.G.t;
  K.G.hp = 3; K.G.inv = 0; K.G.whiskyT = 0; K.G.sh = false;
  K.chkCl();
  assert.equal(K.G.hp, 2);
});

test("волны рисуются и со временем гаснут", () => {
  const { K, ctx } = day6();
  K.spBoat();
  const o = boats(K)[0];
  for (let i = 0; i < 200; i++) { K.boatStep(o); K.waveStep(); }
  assert.ok(K.G.waves.length > 5, "волн нет");
  let n = 0; ctx.fillRect = () => n++;
  K.drwWaves();
  assert.ok(n > 10, "волны не рисуются");
  K.G.obs = [];
  for (let i = 0; i < 400; i++) K.waveStep();
  assert.equal(K.G.waves.length, 0, "волны не гаснут");
});

test("на Тверце мостов вдвое меньше, но на цель дня 5 («4 моста») хватает", async () => {
  const { sampleDay } = await import("../tools/river-map.mjs");
  for (const d of [4, 5]) {
    for (const seed of [1, 2, 3, 4, 5]) {
      const n = sampleDay(d, seed).bridges.length;
      assert.ok(n >= 5 && n <= 8, "день " + (d + 1) + ", заход " + seed + ": мостов " + n);
    }
  }
});

test("на Тверце изгибы вдвое реже — длинные плёсы для катера", () => {
  const { K } = day6();
  const turns = f => {
    K.G.rFreq = f; let n = 0, prev = null;
    for (let w = 0; w < 25000; w += 20) {
      const d = K.centerSines(w + 20) - K.centerSines(w);
      if (prev !== null && Math.sign(d) !== Math.sign(prev) && Math.abs(d) > 0.05) n++;
      prev = d;
    }
    return n;
  };
  assert.equal(K.RIVERS[2].freq, 0.5);
  const slow = turns(0.5), fast = turns(1);
  assert.ok(slow <= fast * 0.6, "изгибов " + slow + " против " + fast);
});

test("Тверца шире прежнего — есть где разъехаться с катером", () => {
  const { K } = day6();
  assert.ok(K.RIVERS[2].width >= 1.2, "ширина Тверцы " + K.RIVERS[2].width);
});

test("за день катера ни разу не наезжают на камни и коряги (плывущее — лишь редкий толчок бортами)", () => {
  let hard = 0, soft = 0, seen = 0;
  // Зёрна случайности постоянные: проба не должна то проходить, то падать
  // (перед push она блокирует отправку).
  for (const seed of [3, 17, 42, 80, 123, 777]) {
    const { K, sandbox } = loadGame();
    runInContext(`(function(){ let a = ${seed} * 2654435761 >>> 0;
      Math.random = function(){ a = (a + 0x6D2B79F5) >>> 0; let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })()`, sandbox);
    setupWorld(K, { wy: 400 });
    K.G.day = 5; const R = K.RIVERS[K.LEVELS[5].river]; K.G.rWidth = R.width; K.G.rBend = R.bend; K.G.rFreq = R.freq || 1;
    K.G.forks = []; K.G.bridges_ = []; K.G.s = "playing"; K.G.bev = []; K.G.obs = []; K.G.bns = []; K.G.waves = []; K.G.weeds = [];
    K.G.segs = []; K.ensureSegments(40000); K.G.inv = 1e9; K.G.df = 1;
    // До финиша: там игра ставит таймеры мультика.
    for (let f = 0; f < 3500 && K.G.dist < K.level().len - 60; f++) {
      K.setAudio(null);
      K.upd();
      K.G.s = "playing"; K.G.hp = 3; K.G.inv = 1e9;
      for (const b of K.G.obs) if (b.type === "boat") {
        seen++;
        for (const q of K.G.obs) {
          if (q === b || !["rock", "snag", "log", "branch", "kayaker"].includes(q.type)) continue;
          const hw = K.widthAt(b.wy) / 2;
          if (Math.abs(b.wy - q.wy) < b.visHalfY + (q.visHalfY || 20) - 6 &&
              Math.abs((b.t - q.t) * hw) < b.visHalf + (q.visHalf || 20) - 6) {
            if (q.type === "rock" || q.type === "snag") hard++; else soft++;
          }
        }
      }
    }
  }
  assert.ok(seen > 600, "катеров почти не было: " + seen);
  assert.equal(hard, 0, "катер на камне или коряге, кадров: " + hard);
  assert.ok(soft <= seen * 0.015, "толчков с плывущим слишком много: " + soft + " из " + seen);
});
test("катера не заходят на пороги", () => {
  const { K } = day6();
  K.G.segs = [{ type: "calm", start: 0, end: K.G.scroll + 700 }, { type: "rapid", start: K.G.scroll + 700, end: 1e9 }];
  for (let i = 0; i < 20; i++) { K.G.obs = []; K.spBoat(); assert.equal(boats(K).length, 0, "катер на пороге"); }
});
