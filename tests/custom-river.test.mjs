// Конструктор: кроме препятствий и бонусов — сама река и берег. Сужение
// русла на ряд, остров-развилка, трава на воде (у берега или посреди),
// жители берега (рыбак, пляж, лагерь, стадо, цапля, лоси, деревня, баня,
// мостки). Всё стоит там, где нарисовано; проход проверяется с учётом
// сужения и острова.
import test from "node:test";
import assert from "node:assert/strict";
import { loadGame } from "./harness.mjs";

function game() {
  const { K } = loadGame();
  K.resetSave(); K.setAudio(null);
  return K;
}
function run(K, until, max = 4000) {
  let f = 0;
  while (!until() && f++ < max && K.G.s === "playing") K.upd();
  return f < max;
}

test("новые инструменты есть в палитре, с названиями и значками", () => {
  const K = game();
  for (const k of ["narrow", "fork", "weeds", ...K.CUSTOM_SHORE]) {
    assert.ok(K.CUSTOM_TOOLS.includes(k), "нет инструмента " + k);
    assert.ok(K.CUSTOM_NAMES[k], "нет названия " + k);
  }
  for (const k of ["fisher", "beach", "camp", "cows", "heron", "village", "banya", "pier"])
    assert.ok(K.CUSTOM_SHORE.includes(k), "на берег нельзя поставить " + k);
  const cs = K.getCs();
  cs.items = [{ c: 0, r: 2, k: "narrow" }, { c: 2, r: 4, k: "fork" }, { c: 6, r: 3, k: "weeds" }, { c: 0, r: 5, k: "fisher" }];
  assert.doesNotThrow(() => { K.showEditor(); K.drwEditor(); });
});

test("проход: в суженном ряду крайние клетки — берег, остров закрывает середину на четыре ряда", () => {
  const K = game();
  const rows = 20;
  assert.equal(K.customBlockedRow([{ c: 3, r: 5, k: "narrow" }], rows), -1, "одно сужение проход не закрывает");
  // в суженном ряду камни в клетках 1–5 — прохода нет (0 и 6 — берег)
  const items = [{ c: 3, r: 5, k: "narrow" }];
  for (const c of [1, 2, 4, 5]) items.push({ c, r: 5, k: "rock" });
  assert.equal(K.customBlockedRow(items, rows), -1, "клетка с меткой сужения сама свободна");
  items.push({ c: 3, r: 6, k: "narrow" });
  for (const c of [1, 2, 3, 4, 5]) items.push({ c, r: 6, k: "rock" });
  assert.equal(K.customBlockedRow(items, rows), 6, "ряд сужен, середина в камнях");
  // остров посередине: камни у обоих берегов в ряду острова — прохода нет
  const isl = [{ c: 3, r: 8, k: "fork" }];
  for (const c of [0, 1, 2, 4, 5, 6]) isl.push({ c, r: 10, k: "rock" });
  assert.equal(K.customBlockedRow(isl, rows), 10, "остров + камни по краям");
  assert.equal(K.customBlockedRow([{ c: 3, r: 8, k: "fork" }], rows), -1, "остров один проход не закрывает");
  assert.ok(K.customIsland({ c: 3, r: 8, k: "fork" }).rows >= 3);
});

test("сужение в игре: русло в этом ряду заметно уже, вдали — как было", () => {
  const K = game();
  const cs = K.getCs();
  cs.river = 0; cs.lenIdx = 1;
  cs.items = [{ c: 3, r: 6, k: "narrow" }];
  K.startCustom();
  const wy = K.itemWy({ r: 6 });
  const near = K.widthAt(wy), far = K.widthAt(K.itemWy({ r: 1 }));
  assert.ok(near < far*0.7, "уже: " + Math.round(near) + " против " + Math.round(far));
  assert.ok(near > 110, "байдарка проходит: " + Math.round(near));
});

test("остров: развилка там, где поставлен; клетка слева — узкий левый рукав", () => {
  const K = game();
  const cs = K.getCs();
  cs.river = 1; cs.lenIdx = 1;
  cs.items = [{ c: 1, r: 4, k: "fork" }, { c: 5, r: 10, k: "fork" }];
  K.startCustom();
  const a = K.forkAt(K.itemWy({ r: 4 }) + 200), b = K.forkAt(K.itemWy({ r: 10 }) + 200);
  assert.ok(a && b, "обе развилки на месте");
  assert.ok(a.center < 0 && a.narrowLeft, "левый рукав узкий");
  assert.ok(b.center > 0 && !b.narrowLeft, "правый рукав узкий");
  assert.equal(K.forkAt(K.itemWy({ r: 1 })), null, "в начале острова нет");
  for (let i = 0; i < 600 && K.G.s === "playing"; i++) K.upd();
  assert.ok(K.forkAt(K.itemWy({ r: 10 }) + 200), "случайные развилки не подменили нарисованные");
});

test("трава: у крайней клетки — заводь у своего берега, в середине — пряди по течению", () => {
  const K = game();
  const cs = K.getCs();
  cs.river = 2; cs.lenIdx = 1;
  cs.items = [{ c: 0, r: 3, k: "weeds" }, { c: 4, r: 6, k: "weeds" }];
  K.startCustom();
  assert.ok(run(K, () => K.G.weeds.length >= 2), "трава появилась");
  const bank = K.G.weeds.find(z => z.kind === "bank"), mid = K.G.weeds.find(z => z.kind === "mid");
  assert.ok(bank && bank.side === -1, "заводь у левого берега");
  assert.ok(mid && Math.abs(mid.t - K.colT(4)) < 0.05, "пряди в своей колонке");
  assert.ok(Math.abs(bank.wy + bank.len/2 - K.itemWy({ r: 3 })) < 140, "трава вокруг своего ряда");
});

test("жители берега: стоят на своей стороне; если нарисован хоть один — случайных нет", () => {
  const K = game();
  const cs = K.getCs();
  cs.river = 3; cs.lenIdx = 1;
  cs.items = [{ c: 0, r: 3, k: "fisher" }, { c: 6, r: 6, k: "cows" }, { c: 5, r: 9, k: "banya" }];
  K.startCustom();
  // За весь заплыв: кто появлялся на берегу (жители из пулов рек; финишная стоянка не в счёт).
  const kinds = new Set(Object.values(K.BEV_POOLS).flat()), seen = new Set();
  let cow = false;
  run(K, () => { if (K.G.dist < K.level().len - K.FIN_SPAWN_M - 20) for (const e of K.G.bev) if (kinds.has(e.type)) seen.add(e.type + ':' + e.side); if (K.G.obs.some(o => o.cow)) cow = true; return false; }, 9000);
  assert.deepEqual([...seen].sort(), ['banya:1', 'cows:1', 'fisher:-1'], 'только нарисованные');
  assert.ok(cow, 'коровы заходят в воду, как в походе');
});

test("генератор кладёт и реку, и берег, и проход остаётся", () => {
  const K = game();
  let shore = 0, river = 0;
  for (let seed = 1; seed <= 30; seed++) for (let len = 0; len < 3; len++) {
    const items = K.genCustom(seed % 4, len, seed % 3, seed);
    assert.equal(K.customBlockedRow(items, K.customRows(len)), -1, "зерно " + seed + " длина " + len);
    shore += items.filter(it => K.CUSTOM_SHORE.includes(it.k)).length;
    river += items.filter(it => ["narrow", "fork", "weeds"].includes(it.k)).length;
  }
  assert.ok(shore > 30, "жители берега: " + shore);
  assert.ok(river > 30, "сужения, острова, трава: " + river);
});
