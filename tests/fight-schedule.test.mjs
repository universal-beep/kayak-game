// Злые гребцы: день 3 — только развилки и коряги, бой начинается на 4-м дне.
// Там знакомство с ватагой, потом по одному-два как элемент реки, а финал
// (день 9) — конвой без парирований. Расписание встреч выполняется на деле.
import test from "node:test";
import assert from "node:assert/strict";
import { loadGame, setupWorld } from "./harness.mjs";

test("расписание: день 3 без боя, знакомство на 4-м густое, финал — конвой", () => {
  const { K } = loadGame();
  const total = d => K.fightsTotal(K.LEVELS[d - 1]);
  assert.equal(total(1), 0); assert.equal(total(2), 0); assert.equal(total(3), 0);
  assert.ok(total(4) >= 8, "знакомство: " + total(4));
  for (const d of [5, 6, 7, 8]) assert.ok(total(d) >= 1 && total(d) <= 3, `день ${d}: ${total(d)}`);
  assert.equal(total(9), 0, "финал без расписания боёв");
  for (const m of [5, 6, 7, 8]) assert.ok(total(4) > total(m), `день 4 гуще дня ${m}`);
});

test("случайная доля злых: до боя ноль, после знакомства падает", () => {
  const { K } = loadGame();
  const a = d => K.LEVELS[d - 1].aggro;
  assert.equal(a(3), 0, "на 3-м дне злых нет");
  assert.ok(a(4) > a(5));
  for (const d of [5, 6, 7, 8]) assert.ok(a(d) <= 0.15, `день ${d}`);
});

test("цели парирований достижимы: злых больше, чем нужно парировать", () => {
  const { K } = loadGame();
  for (const L of K.LEVELS) if (L.goal === "parries") assert.ok(K.fightsTotal(L) >= L.need*2, `день ${L.day}`);
});

function day(d) {
  const { K } = loadGame();
  K.resetSave();
  K.G.day = d - 1; K.sg();
  setupWorld(K, { wy: 5000 });
  K.G.s = "playing";
  return K;
}

test("до своей доли пути встреча не выходит; одиночные встречи идут по одному с паузой", () => {
  const K = day(7), L = K.LEVELS[6];                 // 7-й день: два гребца подряд
  K.G.dist = L.len*0.05;
  for (let i = 0; i < 5; i++) K.fightStep();
  assert.equal(K.G.obs.length, 0, "рано");
  K.G.dist = L.len*L.fights[0].at + 1;
  K.fightStep();
  assert.equal(K.G.obs.length, 1, "первый");
  for (let i = 0; i < K.FIGHT_GAP - 5; i++) K.fightStep();
  assert.equal(K.G.obs.length, 1, "второй ждёт паузу");
  K.G.obs = [];
  for (let i = 0; i < 20; i++) K.fightStep();
  assert.equal(K.G.obs.length, 1, "второй вышел");
  assert.ok(K.G.obs[0].aggro && K.G.obs[0].variant === K.AGGRO_VARIANT);
});

test("все встречи дня выполняются и выпускают ровно столько гребцов, сколько в расписании", () => {
  for (const d of [4, 5, 6, 7, 8]) {
    const K = day(d), L = K.LEVELS[d - 1];
    let spawned = 0, f = 0;
    const seen = new Set();
    for (; f < 20000 && (K.G.fightIdx < L.fights.length || K.G.fightLeft); f++) {
      K.G.dist = L.len*L.fights[Math.min(K.G.fightIdx, L.fights.length - 1)].at + 1;
      K.fightStep();
      for (const o of K.G.obs) if (!seen.has(o)) { seen.add(o); spawned++; }
      K.G.obs = [];                              // уплыли — место свободно
    }
    assert.ok(f < 20000, "день " + d + " не уложился");
    assert.equal(spawned, K.fightsTotal(L), "день " + d);
  }
});

test("первая встреча объясняется один раз", () => {
  const K = day(4);
  K.G.dist = K.LEVELS[3].len*0.16;
  for (let i = 0; i < 3; i++) K.fightStep();
  assert.ok(K.G.fightShown);
});

test("на своём уровне и в дни без расписания встреч нет", () => {
  for (const d of [1, 3, 9]) {
    const K = day(d);
    K.G.dist = 400; for (let i = 0; i < 50; i++) K.fightStep();
    assert.equal(K.G.obs.length, 0, "день " + d);
  }
});

test("знакомство: сначала один, потом сразу три на одном экране", () => {
  const K = day(4), L = K.LEVELS[3];
  assert.equal(L.fights[0].n, 1, "первая встреча — один");
  assert.ok(!L.fights[0].pack);
  assert.equal(L.fights[1].n, 3);
  assert.ok(L.fights[1].pack, "вторая — ватага разом");
  // первая встреча
  K.G.dist = L.len*L.fights[0].at + 1;
  K.fightStep();
  assert.equal(K.G.obs.filter(o => o.aggro).length, 1);
  K.G.obs = []; K.G.fightLeft = 0;
  // вторая — три сразу, в одном экране, и по ширине не в одной точке
  K.G.dist = L.len*L.fights[1].at + 1;
  K.fightStep();
  const pack = K.G.obs.filter(o => o.type === "kayaker" && o.aggro);
  assert.equal(pack.length, 3, "три гребца за один шаг");
  const ys = pack.map(o => o.wy), span = Math.max(...ys) - Math.min(...ys);
  assert.ok(span <= 2*K.PACK_GAP + 1 && span < 420, "в одном экране: " + span);
  assert.ok(new Set(pack.map(o => Math.round(o.t*10))).size >= 2, "не в одной колонне");
});

test("ватагу не выпускают поверх прежней: ждёт, пока уплывёт", () => {
  const K = day(4), L = K.LEVELS[3];
  K.G.dist = L.len*L.fights[1].at + 1;
  K.G.fightIdx = 1;
  assert.ok(K.spPack(3));
  assert.ok(!K.spPack(3), "вторая ватага поверх первой не выходит");
});
