// Логика плывущих объектов: кто кого обходит, никто не проезжает сквозь
// других и не перескакивает рывком на другую сторону.
import test from "node:test";
import assert from "node:assert/strict";
import { loadGame, setupWorld } from "./harness.mjs";

const FLOW = 1.2;

function fresh(wy = 1000) {
  const { K } = loadGame();
  setupWorld(K, { wy });
  K.G.rBend = 0;                                 // прямое русло: снос на изгибах не мешает
  return K;
}
function thing(K, type, t, wy, sprite) {
  const s = K.spriteSize(sprite || type);
  return { type, t, wy, vt: 0, size: 40, sprite, visHalf: s.w / 2, visHalfY: s.h / 2, halfPx: s.w / 2 * 0.82, swingT: -1 };
}
// Наименьший зазор по ширине, пока объекты перекрываются по длине реки.
function minGap(K, a, b) {
  const hw = K.widthAt(a.wy) / 2;
  if (Math.abs(a.wy - b.wy) >= a.visHalfY + b.visHalfY) return Infinity;
  return Math.abs(a.t - b.t) * hw - (a.visHalf + b.visHalf);
}

// Баг: бревно «обходило» камни ПОЗАДИ себя (знак dy перепутан — сравнить с
// соперником), а на камень впереди въезжало, и дальше его выдёргивало рывком.
test("бревно заранее обходит камень впереди по течению, а не въезжает в него", () => {
  const K = fresh();
  const rock = thing(K, "rock", 0, 1200, "boulder");
  const log = thing(K, "log", 0.02, 1000);
  K.G.obs = [rock, log];
  let worst = Infinity;
  for (let i = 0; i < 400 && log.wy < rock.wy + 60; i++) { K.logStep(log, FLOW); worst = Math.min(worst, minGap(K, log, rock)); }
  assert.ok(worst > -6, "бревно въехало в камень на " + (-worst).toFixed(0) + " px");
});

test("баржа обходит камни и бонусы впереди, а не проходит сквозь них", () => {
  const K = fresh();
  K.G.rWidth = 1.35;                               // баржи ходят по Волге (день 2)
  const barge = thing(K, "barge", 0, 1000);
  const rock = thing(K, "rock", 0.05, 1300, "boulder");
  K.G.obs = [barge, rock];
  const bread = { type: "bread", t: -0.05, wy: 1500, visHalf: K.spriteSize("bread").w / 2, visHalfY: K.spriteSize("bread").h / 2 };
  K.G.bns = [bread];
  let worst = Infinity;
  for (let i = 0; i < 800 && barge.wy < bread.wy + 120; i++) {
    K.bargeStep(barge, FLOW);
    worst = Math.min(worst, minGap(K, barge, rock), minGap(K, barge, bread));
  }
  assert.ok(worst > -6, "баржа прошла сквозь камень или бонус на " + (-worst).toFixed(0) + " px");
});

test("в полосе баржи впереди не появляются новые камни и бонусы", () => {
  const K = fresh(3000);
  const barge = thing(K, "barge", 0, K.spawnWy() - 150);
  let bad = 0, spawned = 0;
  for (let i = 0; i < 400; i++) {
    K.G.obs = [barge]; K.G.bns = [];
    K.spOb(); K.spBn();
    const hw = K.widthAt(K.spawnWy()) / 2;
    for (const o of [...K.G.obs, ...K.G.bns]) {
      if (o === barge) continue;
      spawned++;
      if (Math.abs(o.t - barge.t) * hw < barge.visHalf + (o.visHalf || 20) + 4) bad++;
    }
  }
  assert.ok(spawned > 20, "почти ничего не появилось: " + spawned);
  assert.equal(bad, 0, "в полосе баржи появилось объектов: " + bad + " из " + spawned);
});

// Баг: расталкивание выдёргивало объект за один вызов на всю глубину
// перекрытия (до ~50 px), и так 4 прохода за кадр — бревно «прыгало».
test("расталкивание сдвигает плавно, без рывков", () => {
  const K = fresh();
  const rock = thing(K, "rock", 0, 1000, "boulder");
  const log = thing(K, "log", 0.01, 1000);
  K.G.obs = [rock, log];
  const hw = K.widthAt(1000) / 2;
  const t0 = log.t;
  K.separate(log);
  assert.ok(Math.abs(log.t - t0) * hw <= 2.01, "за один вызов сдвиг " + (Math.abs(log.t - t0) * hw).toFixed(1) + " px");
  for (let i = 0; i < 200; i++) K.separate(log);
  // Игра допускает перекрытие до 15% суммы полуширин: у спрайтов прозрачные поля.
  const need = (log.visHalf + rock.visHalf) * 0.85;
  assert.ok(Math.abs(log.t - rock.t) * hw >= need - 1, "со временем разошлись");
});

// Баг: у острова объект выталкивался «в ближайший рукав»; стоя почти
// посередине, он от кадра к кадру менял рукав и перелетал через остров.
test("у острова объект не перескакивает на другую сторону", () => {
  const K = fresh();
  K.G.forks = [{ start: 800, end: 1600, center: 0, half: 0.3 }];
  const o = thing(K, "log", 0.01, 1200);
  K.pushOutOfIsland(o);
  const side = Math.sign(o.t);
  o.t = -0.01;                                     // качнуло на другую половину острова
  K.pushOutOfIsland(o);
  assert.equal(Math.sign(o.t), side, "объект перелетел через остров");
});
