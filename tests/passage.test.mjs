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
  assert.ok(!alive || K.gapFor(log, log.t) >= K.PASS_MIN, "щель есть или бревно ушло");
  assert.ok(!(log.sinkT > 0), "бревна не тонут");
  assert.ok(K.G.obs.includes(rock), "камень остался");
});

// Раньше соперник без щели сам переворачивался и тонул на виду — игрок
// видел, что «чужие лодки исчезают сами». Теперь он налегает на вёсла и
// проскакивает тесное место быстрее, а сам не тонет.
test("соперник у мели без щели: не тонет, а проскакивает быстрее", () => {
  const K = world();
  K.G.scroll = 5000; K.G.pwy = 5000;
  ob(K, "shallows", -0.50, 5000 + 300, 51);
  const foe = ob(K, "kayaker", 0.30, 5000 + 300, 32);
  foe.variant = 0;
  K.keepPassage();
  assert.ok(K.G.obs.includes(foe) && !(foe.flipT > 0), "на месте и не перевернулся");
  assert.ok(foe.rushT > 0, "налегает на вёсла");
  const wy0 = foe.wy;
  K.G.s = "playing"; K.upd();
  const fast = foe.wy - wy0;
  const calm = ob(K, "kayaker", 0.0, 5000 - 900, 32), c0 = calm.wy;
  K.G.s = "playing"; K.upd();
  assert.ok(fast > (calm.wy - c0)*1.8, "идёт заметно быстрее спокойного: " + fast + " / " + (calm.wy - c0));
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

// Бревно, которому нет места, не тонет: ближний соперник откидывает его
// веслом к своему берегу, и оно остаётся лежать у кромки.
test("бревно без щели: соперник откидывает его веслом на берег", () => {
  const K = world();
  K.G.scroll = 5000; K.G.pwy = 5000;
  ob(K, "shallows", -0.50, 5000 + 300, 51);
  const log = ob(K, "log", 0.30, 5000 + 300, 39);
  const foe = ob(K, "kayaker", 0.0, 5000 + 420, 32);
  K.keepPassage();
  assert.ok(!K.G.obs.includes(log), "из воды убрано — проход свободен");
  assert.ok(!(log.sinkT > 0), "не тонет");
  const a = K.G.ashore.find(e => e.o === log);
  assert.ok(a, "лежит у берега");
  assert.ok(a.t1 > 0.8, "к ближнему берегу (правому): " + a.t1);
  assert.ok(foe.pokeT > 0 && foe.pokeAt === a, "соперник ткнул веслом");
  for (let i = 0; i < 60; i++) { K.G.s = "playing"; K.upd(); }
  assert.ok(K.G.ashore.includes(a) && a.k >= 1, "доехало до кромки и лежит");
  assert.ok(K.G.obs.includes(foe) && !(foe.flipT > 0), "соперник цел");
});

test("бревно без щели и без соперников рядом — прибивает к берегу, а не топит", () => {
  const K = world();
  K.G.scroll = 5000; K.G.pwy = 5000;
  ob(K, "shallows", -0.50, 5000 + 300, 51);
  const log = ob(K, "log", 0.30, 5000 + 300, 39);
  K.keepPassage();
  assert.ok(!K.G.obs.includes(log) && K.G.ashore.some(e => e.o === log), "на берегу");
});

test("новый камень не ставится туда, куда придёт плывущее бревно и закроет проход", () => {
  const K = world();
  K.G.scroll = 5000; K.G.pwy = 5000;
  ob(K, "log", -0.10, 5000 + 100, 39);                     // бревно ниже по реке
  const wy = 5000 + 500, vis = 33;
  assert.equal(K.leavesPassage(-0.10 + 0.55, wy, vis, vis), false, "справа от бревна щель закрылась бы — отказ");
  assert.equal(K.leavesPassage(0.55, wy + 2000, vis, vis), true, "далеко за пределами — можно");
});
