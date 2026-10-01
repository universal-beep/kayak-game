// Цапля на Медведице вместо уток — стоит на одной ноге у берега и улетает,
// когда байдарка подходит к её берегу. Пастух с коровами на Осуге: пара
// коров заходит в воду у берега и мешает проплыть, но не разлетается от
// виски и топора, как камень.
import test from "node:test";
import assert from "node:assert/strict";
import { loadGame, setupWorld } from "./harness.mjs";

test("цапля живёт на Медведице вместо уток, коровы — на Осуге", () => {
  const { K } = loadGame();
  const P = K.BEV_POOLS;
  assert.ok(P[1].includes("heron") && !P[1].includes("ducks"), "Медведица: цапля вместо уток");
  assert.ok(P[3].includes("cows"), "Осуга: пастух с коровами");
  for (const r of [0, 2]) assert.ok(!P[r].includes("cows") && !P[r].includes("heron"), "река " + r);
  for (const n of ["heron", "heron_fly0", "heron_fly1", "cow", "cow_b", "cow_water", "shepherd"])
    assert.ok(K.SPR[n] && K.SPR[n].map, "нет спрайта " + n);
});

test("цапля улетает, только когда байдарка подошла к её берегу", () => {
  const { K } = loadGame();
  setupWorld(K, { wy: 1000 });
  const far = { type: "heron", side: 1, wy: 1000, phase: 0 };
  K.G.t = -0.6; K.updBev(far);
  assert.ok(!far.away, "с другого берега не пугается");
  const near = { type: "heron", side: 1, wy: 1000, phase: 0, hops: K.HERON_HOPS };   // перелёты уже были
  K.G.t = 0.5; K.updBev(near);
  assert.ok(near.away, "подошли к её берегу — улетает");
  for (let i = 0; i < 200; i++) K.updBev(near);
  assert.ok(near.dead, "улетела и убралась");
});

function osuga(K) {
  K.G.day = 6;                                     // день 7 — Осуга
  const R = K.RIVERS[K.LEVELS[6].river];
  setupWorld(K, { wy: 1000, rWidth: R.width });
  K.G.rBend = 0;
}

test("коровы заходят в воду у берега своего пастуха", () => {
  const { K } = loadGame();
  osuga(K);
  const e = { type: "cows", side: -1, wy: 1300, phase: 0 };
  K.cowsWade(e);
  const cows = K.G.obs.filter(o => o.cow);
  assert.ok(cows.length >= 1 && cows.length <= 2, "в воде " + cows.length);
  for (const o of cows) {
    assert.equal(o.type, "rock", "мешает как камень");
    assert.equal(o.sprite, "cow_water");
    assert.ok(o.t * e.side >= 0.5, "у своего берега: t=" + o.t);
    assert.ok(Math.abs(o.wy - e.wy) < 200, "рядом с пастухом");
  }
});

test("корова не разлетается от виски и топора; удар о корову — урон, она остаётся", () => {
  const { K } = loadGame();
  osuga(K);
  const cow = { type: "rock", sprite: "cow_water", cow: true, t: 0, wy: 1000, vt: 0, halfPx: 30, visHalf: 40, visHalfY: 20 };
  K.G.obs = [cow]; K.G.t = 0; K.G.pwy = 1000; K.G.whiskyT = 100; K.G.inv = 0;
  K.chkCl();
  assert.ok(K.G.obs.includes(cow), "под виски корова осталась");
  K.G.whiskyT = 0; K.G.hp = 3; K.G.inv = 0; K.G.sh = false;
  K.chkCl();
  assert.equal(K.G.hp, 2, "удар о корову — минус сердце");
  assert.ok(K.G.obs.includes(cow), "корова осталась на месте");
  K.G.obs = [Object.assign({}, cow, { wy: K.G.pwy + 200 })];
  K.apBn({ type: "axe", t: 0, wy: K.G.pwy });
  assert.equal(K.G.obs.length, 1, "топор корову не трогает");
});

test("корова мычит: при ударе и один раз, когда стадо рядом", () => {
  const { K } = loadGame();
  osuga(K);
  assert.ok("moo" in K.SOUNDS, "слот для своей записи мычания");
  const e = { type: "cows", side: -1, wy: 1100, phase: 0 };
  K.G.pwy = 400; K.G.sfxLast = ""; K.updBev(e);
  assert.notEqual(K.G.sfxLast, "moo", "далеко — молчат");
  K.G.pwy = 900; K.updBev(e);
  assert.equal(K.G.sfxLast, "moo", "подплыли — замычали");
  K.G.sfxLast = ""; K.updBev(e);
  assert.equal(K.G.sfxLast, "", "мычат один раз, а не каждый кадр");
  const cow = { type: "rock", sprite: "cow_water", cow: true, t: 0, wy: 1000, vt: 0, halfPx: 30, visHalf: 40, visHalfY: 20 };
  K.G.obs = [cow]; K.G.t = 0; K.G.pwy = 1000; K.G.whiskyT = 0; K.G.inv = 0; K.G.hp = 3; K.G.sh = false;
  K.chkCl();
  assert.equal(K.G.sfxLast, "moo", "удар о корову — мычание");
});

// Стада разные: целиком одной масти, «двое одной, третья другой» и все
// разные; где-то бык, где-то телёнок; пастухи трёх видов. Голов в стаде —
// 2, 3 или 4 вместе с теми, что в воде; в воде хотя бы одна, на берегу тоже.
test("стада: 2–4 головы, масти одной/пара/разные, бык, телёнок, разные пастухи", () => {
  const { K } = loadGame();
  const modes = new Set(), kinds = new Set(), herders = new Set(), totals = new Set();
  for (let seed = 0; seed < 90; seed++) {
    const h = K.herdOf({ seed });
    herders.add(h.shepherd);
    const all = h.animals.concat(h.water);
    totals.add(all.length);
    assert.ok(h.animals.length >= 1, "на берегу хотя бы одна");
    assert.ok(h.water.length >= 1 && h.water.every(a => a.spr === "cow"), "в воде — коровы, хотя бы одна");
    const cows = all.filter(a => a.spr !== "bull");
    const vs = cows.map(a => a.v), uniq = new Set(vs).size;
    for (const a of all) kinds.add(a.spr === "cow" ? "cow" + a.v : a.spr);
    if (vs.length >= 2) modes.add(uniq === 1 ? "same" : uniq === vs.length ? "mixed" : "pair");
    if (h.mode === "same") assert.equal(uniq, 1, "одной масти: " + vs);
  }
  assert.deepEqual([...totals].sort(), [2, 3, 4], "голов в стаде");
  assert.deepEqual([...modes].sort(), ["mixed", "pair", "same"]);
  for (const k of ["cow0", "cow1", "cow2", "bull", "calf"]) assert.ok(kinds.has(k), "нет " + k);
  assert.equal(herders.size, 3, "три вида пастухов");
  for (const n of ["bull", "calf", "shepherd_old", "shepherd_girl"]) assert.ok(K.SPR[n], "нет спрайта " + n);
  assert.equal(K.SPR.cow.variants.length, 3, "три масти коровы");
});

test("в воду заходят коровы своего стада — сколько решило стадо", () => {
  const { K } = loadGame();
  K.G.day = 6; const R = K.RIVERS[K.LEVELS[6].river];
  setupWorld(K, { wy: 1000, rWidth: R.width }); K.G.rBend = 0;
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    K.G.obs = [];
    const e = { type: "cows", side: -1, wy: 1300, phase: 0, seed };
    K.cowsWade(e);
    const h = K.herdOf(e);
    assert.ok(K.G.obs.filter(o => o.cow).length <= h.water.length, "не больше, чем решило стадо");
  }
});
