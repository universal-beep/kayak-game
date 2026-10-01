// Проходимость: подвижные препятствия (бревно, ветка, соперник) не должны
// сходиться с камнями так, чтобы лодка не пролезала; ватага идёт по
// расширенному руслу; тройки только на 3-м и 9-м днях.
import test from "node:test";
import assert from "node:assert/strict";
import { loadGame, setupWorld } from "./harness.mjs";

function world(day = 7, rWidth = 0.72) {
  const { K } = loadGame();
  K.resetSave();
  K.G.day = day - 1; K.sg();
  setupWorld(K, { wy: 5000, rWidth });
  K.G.s = "playing"; K.G.py = 630;
  return K;
}
function ob(K, type, t, wy, half = 26) {
  const o = { type, t, wy, vt: 0, size: 18, halfPx: half, visHalf: half, visHalfY: half, aggro: false, swingT: -1 };
  K.G.obs.push(o);
  return o;
}

test("бревно, догнавшее камень на узкой реке: щель восстанавливается или бревно тонет, пока его не видно", () => {
  const K = world();
  K.G.scroll = 5000; K.G.pwy = 5000;
  const rock = ob(K, "rock", 0.30, 5000 + 260, 33);
  const log = ob(K, "log", -0.15, 5000 + 300, 39);          // у камня почти вплотную, над экраном
  assert.ok(K.gapFor(log, log.t) < K.PASS_MIN, "сначала проход закрыт");
  for (let i = 0; i < 80; i++) K.keepPassage();
  const alive = K.G.obs.includes(log);
  assert.ok(!alive || log.sinkT > 0 || K.gapFor(log, log.t) >= K.PASS_MIN, "щель есть, бревно тонет или его нет");
  assert.ok(K.G.obs.includes(rock), "камень остался");
});

test("соперник и мель без решения: далеко от лодки — переворачивается и тонет", () => {
  const K = world();
  K.G.scroll = 5000; K.G.pwy = 5000;
  ob(K, "shallows", -0.50, 5000 + 300, 51);
  const foe = ob(K, "kayaker", 0.30, 5000 + 300, 32);
  foe.variant = 0;
  const burst0 = K.G.pts.length;
  K.keepPassage();
  assert.ok(foe.flipT > 0 || !K.G.obs.includes(foe), "соперник не остался стеной");
  assert.equal(K.G.pts.length, burst0, "без вспышки брызг: переворот тихий");
});

test("рядом с лодкой подвижное не убирают внезапно", () => {
  const K = world();
  K.G.scroll = 5000; K.G.pwy = 5000;
  ob(K, "shallows", -0.50, 5000 + 40, 51);
  const foe = ob(K, "kayaker", 0.30, 5000 + 40, 32);
  K.keepPassage();
  assert.ok(K.G.obs.includes(foe) && !(foe.flipT > 0), "у самой лодки не трогаем");
});

test("в своём уровне страж не вмешивается", () => {
  const K = world();
  K.G.custom = { custom:true, day:0, river:3, len:500, dens:1e-9, items:[] };
  K.G.scroll = 5000; K.G.pwy = 5000;
  const rock = ob(K, "rock", 0.30, 5000 + 260, 33);
  const log = ob(K, "log", -0.15, 5000 + 300, 39);
  const t0 = log.t;
  K.keepPassage();
  assert.equal(log.t, t0); assert.ok(K.G.obs.includes(rock));
});

test("расширение русла на ватаге: полное внутри зоны, плавное снаружи, ноль далеко", () => {
  const K = world(3, 1);
  K.G.packZones = [{ a: 6000, b: 6600 }];
  assert.equal(K.packBlend(6300), 1);
  const mid = K.packBlend(6000 - 100);
  assert.ok(mid > 0 && mid < 1, "плавный спад: " + mid);
  assert.equal(K.packBlend(2000), 0);
  const base = K.widthAt(2000);
  assert.ok(Math.abs(K.widthAt(6300)/base - (1 + K.PACK_WIDEN)) < 0.01, "ширина выросла на PACK_WIDEN");
});

test("ватага расширяет реку и не выходит на пороге", () => {
  const K = world(3, 1);
  K.G.forks = [];
  assert.ok(K.spPack(3));
  assert.equal(K.G.packZones.length, 1);
  const z = K.G.packZones[0];
  assert.ok(K.packBlend((z.a + z.b)/2) === 1);
  // все трое внутри зоны расширения
  for (const o of K.G.obs.filter(o => o.aggro)) assert.ok(o.wy >= z.a && o.wy <= z.b, "гребец в зоне");
});

test("тройки (pack) только на 3-м и 9-м днях", () => {
  const { K } = loadGame();
  K.LEVELS.forEach((L, i) => {
    const packs = (L.fights || []).filter(f => f.pack);
    if (L.day === 3 || L.day === 9) assert.ok(packs.length >= 2 && packs.every(f => f.n === 3), "день " + L.day);
    else assert.equal(packs.length, 0, "день " + L.day);
  });
});

test("бревно без решения далеко от лодки тонет медленно (не пропадает вспышкой)", () => {
  const K = world();
  K.G.scroll = 5000; K.G.pwy = 5000;
  ob(K, "shallows", -0.50, 5000 + 300, 51);
  const log = ob(K, "log", 0.30, 5000 + 300, 39);
  const burst0 = K.G.pts.length;
  K.keepPassage();
  assert.ok(log.sinkT > 0, "начало тонуть");
  assert.equal(K.G.pts.length, burst0, "без частиц");
  const left = log.sinkT;
  assert.ok(K.G.obs.includes(log), "ещё на месте, исчезает постепенно");
  for (let i = 0; i < left + 2; i++) { K.G.s = "playing"; K.upd(); }
  assert.ok(!K.G.obs.includes(log), "утонуло");
});

test("новый камень не ставится туда, куда придёт плывущее бревно и закроет проход", () => {
  const K = world();
  K.G.scroll = 5000; K.G.pwy = 5000;
  ob(K, "log", -0.10, 5000 + 100, 39);                     // бревно ниже по реке
  const wy = 5000 + 500, vis = 33;
  assert.equal(K.leavesPassage(-0.10 + 0.55, wy, vis, vis), false, "справа от бревна щель закрылась бы — отказ");
  assert.equal(K.leavesPassage(0.55, wy + 2000, vis, vis), true, "далеко за пределами — можно");
});
