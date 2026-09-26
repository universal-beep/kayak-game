// Трава на воде: участок (заводь у берега или пряди посреди реки), а не
// одиночная кочка. Пока лодка идёт через траву — вязнет; трава не исчезает.
import test from "node:test";
import assert from "node:assert/strict";
import { loadGame, setupWorld } from "./harness.mjs";

function world(day = 0) {
  const { K, ctx } = loadGame();
  setupWorld(K, { wy: 6000 });
  K.G.day = day; K.G.s = "playing"; K.G.bev = []; K.G.obs = []; K.G.bns = [];
  const R = K.RIVERS[K.LEVELS[day].river]; K.G.rWidth = R.width; K.G.rBend = R.bend;
  K.G.segs = [{ type: "calm", start: 0, end: 1e9 }]; K.G.forks = [];
  K.G.weeds = [];
  return { K, ctx };
}

test("заводь прилегает к берегу и не перекрывает реку", () => {
  const { K } = world();
  for (let i = 0; i < 60; i++) {
    K.G.weeds = [];
    K.spWeed(K.spawnWy(), "bank");
    const z = K.G.weeds[0];
    assert.ok(z, "заводь не появилась");
    const mid = z.wy + z.len / 2, sp = K.weedSpan(z, mid);
    const c = K.centerAt(mid), hw = K.widthAt(mid) / 2, edge = c + z.side * hw;
    assert.ok(z.side < 0 ? sp[0] <= edge : sp[1] >= edge, "заводь оторвана от берега");
    assert.ok(sp[1] - sp[0] <= hw * 0.9 + 8, "заводь перекрыла больше половины реки");
    assert.ok(K.screenYOf(z.wy + z.len) < 0, "заводь возникла в кадре");
  }
});

test("пряди посреди реки: между ними вода — проход шире лодки не нужен, но просветы есть", () => {
  const { K } = world();
  K.spWeed(K.spawnWy(), "mid");
  const z = K.G.weeds[0];
  assert.equal(z.kind, "mid");
  assert.ok(z.len > 2.5 * (K.weedSpan(z, z.wy + z.len / 2)[1] - K.weedSpan(z, z.wy + z.len / 2)[0]) / 2,
    "поле посреди реки не вытянуто по течению");
  const strands = K.weedStrands(z);
  assert.ok(strands.length >= 3, "прядей меньше трёх");
  const xs = strands.map(s => s.dx).sort((a, b) => a - b);
  for (let i = 1; i < xs.length; i++) assert.ok(xs[i] - xs[i - 1] >= 9, "пряди слиплись — нет воды между ними");
});

test("в траве лодка вязнет, на чистой воде — нет; трава после проезда остаётся", () => {
  const { K } = world();
  K.spWeed(K.spawnWy(), "bank");
  const z = K.G.weeds[0];
  const mid = z.wy + z.len / 2, sp = K.weedSpan(z, mid);
  const hw = K.widthAt(mid) / 2, c = K.centerAt(mid);
  const run = (x) => {
    K.G.pwy = mid; K.G.t = (x - c) / hw; K.G.sp = 5;
    for (let i = 0; i < 90; i++) K.weedDrag(5);
    return K.G.sp;
  };
  const slow = run((sp[0] + sp[1]) / 2);
  const free = run(z.side < 0 ? c + hw * 0.7 : c - hw * 0.7);
  assert.ok(slow < 3, "в траве скорость не упала: " + slow.toFixed(2));
  assert.ok(free > 4.9, "на чистой воде лодка вязнет: " + free.toFixed(2));
  assert.equal(K.G.weeds.length, 1, "трава исчезла после проезда");
});

test("трава рисуется без синего — вода видна сквозь неё", () => {
  const { K, ctx } = world();
  for (const kind of ["bank", "mid"]) {
    K.G.weeds = [];
    K.spWeed(K.spawnWy(), kind);
    K.G.scroll = K.G.weeds[0].wy + K.G.weeds[0].len / 2 - K.PY + 300;
    const fills = [];
    let fs = "";
    Object.defineProperty(ctx, "fillStyle", { configurable: true, get: () => fs, set: v => { fs = v; } });
    ctx.fillRect = () => fills.push(fs);
    K.drwWeeds();
    assert.ok(fills.length > 40, kind + ": травы почти не нарисовано");
    for (const f of new Set(fills)) {
      const m = String(f).match(/^#(..)(..)(..)$/) || String(f).match(/^rgba?\((\d+),(\d+),(\d+)/);
      assert.ok(m, "неизвестный цвет " + f);
      const [r, g, b] = m.slice(1, 4).map(v => (v.length === 2 && /[a-f]/i.test(v)) || String(f)[0] === "#" ? parseInt(v, 16) : +v);
      assert.ok(b < g, kind + ": синий цвет в траве " + f);
    }
  }
});

test("ушедшая за нижний край трава убирается", () => {
  const { K } = world();
  K.spWeed(K.spawnWy(), "bank");
  const z = K.G.weeds[0];
  K.G.scroll = z.wy + z.len + 2000;
  K.dropWeeds();
  assert.equal(K.G.weeds.length, 0);
});
