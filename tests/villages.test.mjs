// Тверца — река деревень: за день 3–5 деревень, обычно по одному берегу.
// План дня детерминирован (от номера дня), чтобы не сдвигать случайность
// остальной игры.
import test from "node:test";
import assert from "node:assert/strict";
import { loadGame, setupWorld } from "./harness.mjs";

test("на Тверце 3–5 деревень за день, в основном по одному берегу; на других реках нет", () => {
  const { K } = loadGame();
  K.LEVELS.forEach((L, d) => {
    const plan = K.villagePlan(d);
    if (L.river !== 2) { assert.equal(plan.length, 0, "день " + L.day); return; }
    assert.ok(plan.length >= 3 && plan.length <= 5, "день " + L.day + ": " + plan.length);
    const left = plan.filter(v => v.side < 0).length, right = plan.length - left;
    assert.ok(Math.max(left, right) >= Math.ceil(plan.length * 0.6), "по одному берегу: " + left + "/" + right);
    for (const v of plan) assert.ok(v.at > 40 && v.at < L.len - 90, "не у старта и не у финиша: " + v.at);
    assert.deepEqual(K.villagePlan(d).map(v => v.at), plan.map(v => v.at), "план не случайный");
  });
});

test("деревня появляется на берегу, когда до неё доплыли", () => {
  const { K } = loadGame();
  const d = K.LEVELS.findIndex(L => L.river === 2);
  K.startDay(d);
  setupWorld(K, { wy: 3000 });
  K.G.bev = [];
  const plan = K.villagePlan(d);
  K.G.villages = plan.map(v => Object.assign({}, v));
  K.G.dist = plan[0].at;
  K.spVillage();
  const vil = K.G.bev.filter(e => e.type === "village");
  assert.equal(vil.length, 1, "одна деревня");
  assert.equal(vil[0].side, plan[0].side);
  K.spVillage();
  assert.equal(K.G.bev.filter(e => e.type === "village").length, 1, "та же деревня дважды не ставится");
});

// Дорога моста — полоса поперёк всего окна (от wy−30 до wy+46). Дом деревни
// или любой житель берега не должен оказаться под ней.
test("деревня и жители берега не встают под дорогу моста", () => {
  const { K } = loadGame();
  const d = K.LEVELS.findIndex(L => L.river === 2);
  let checked = 0;
  for (let k = -12; k <= 12; k++) {
    K.startDay(d);
    setupWorld(K, { wy: 3000 });
    K.G.bev = [];
    const at = K.spawnWy() + k*15;
    K.G.bridges_ = [{ wy: at, passed: false }];
    const plan = K.villagePlan(d);
    K.G.villages = plan.map(v => Object.assign({}, v));
    K.G.dist = plan[0].at;
    K.spVillage();
    for (const e of K.G.bev) {
      const b = K.measureBev(e);
      if (!b) continue;
      checked++;
      assert.ok(b.hi <= at - 30 || b.lo >= at + 46, "сдвиг " + k*15 + ": " + e.type + " " + Math.round(b.lo) + ".." + Math.round(b.hi) + " под мостом " + at);
    }
  }
  assert.ok(checked > 10, "проверено " + checked);
});
