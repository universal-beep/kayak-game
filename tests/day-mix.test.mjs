// День 3 — одна новая механика: развилки и коряги, без боя.
// День 9 — своя комбинация: туман и конвой катеров, а не вторые парирования.
import test from "node:test";
import assert from "node:assert/strict";
import { loadGame, setupWorld } from "./harness.mjs";

const L3 = K => K.LEVELS[2];
const L9 = K => K.LEVELS[8];

test("день 3: развилки и коряги, без fights и aggro", () => {
  const { K } = loadGame();
  const L = L3(K);
  assert.equal(L.goal, "shallowsmax");
  assert.equal(L.fights, undefined, "боёв на третий день нет");
  assert.equal(L.aggro, 0, "случайных злых гребцов нет");
  assert.equal(L.forks, true, "развилки остались");
  assert.equal(L.snags, true, "коряги остались");
});

test("день 9: туман и конвой вместо повторных парирований", () => {
  const { K } = loadGame();
  const L = L9(K);
  assert.equal(L.goal, "convoy");
  assert.equal(L.fights, undefined, "расписания боёв нет");
  assert.ok(L.fog >= 0.5, "туман есть");
  assert.equal(L.boats, true);
  assert.equal(L.convoy, true);
  assert.notEqual(L.goal, K.LEVELS[3].goal, "цель не повторяет день 4");
});

test("день 9: цель считается по разошедшимся катерам", () => {
  const { K } = loadGame();
  K.resetSave(); K.startDay(8); setupWorld(K, { wy: 5000 }); K.G.s = "playing";
  K.G.convoy = 2;
  assert.equal(K.goalProgress(L9(K), K.G), "катеров: 2 / 3");
  assert.equal(K.goalMet(), false);
  K.G.convoy = 3;
  assert.equal(K.goalMet(), true);
});
test("день 9: конвой выпускает пару по разным полосам и считает расход", () => {
  const { K } = loadGame();
  K.resetSave(); K.startDay(8); setupWorld(K, { wy: 5000 }); K.G.s = "playing";
  assert.equal(K.spBoat(), true);
  assert.equal(K.spBoat(), true);
  const boats = K.G.obs.filter(o => o.type === "boat");
  assert.equal(boats.length, 2, "в конвое пара катеров");
  assert.notEqual(boats[0].lane, boats[1].lane, "катера на разных полосах");
  assert.equal(K.spBoat(), false, "больше двух сразу не выходит");
  for (const o of boats) o.wy = K.G.pwy - 100;
  K.G.convoy = 0; K.G.inv = 1e9; K.upd();
  assert.equal(K.G.convoy, 2, "разошедшиеся катера засчитаны");
});
