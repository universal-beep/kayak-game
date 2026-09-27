// Семья лосей на Тверце вместо медведя: лось, лосиха и лосёнок пьют у воды,
// а когда байдарка рядом — поднимают головы. Медведь остаётся на лесных
// Медведице и Осуге.
import test from "node:test";
import assert from "node:assert/strict";
import { loadGame, setupWorld } from "./harness.mjs";

test("лоси на Тверце вместо медведя, медведь — на Медведице и Осуге", () => {
  const { K } = loadGame();
  const P = K.BEV_POOLS;
  assert.ok(P[2].includes("moose") && !P[2].includes("bear"), "Тверца: лоси, не медведь");
  assert.ok(P[1].includes("bear") && P[3].includes("bear"), "медведь остался в лесу");
  for (const n of ["moose", "moose_b", "moosecow", "moosecow_b", "moosecalf"])
    assert.ok(K.SPR[n] && K.SPR[n].map, "нет спрайта " + n);
});

test("лоси поднимают головы, когда байдарка рядом", () => {
  const { K } = loadGame();
  setupWorld(K, { wy: 400 });
  const e = { type: "moose", side: 1, wy: 1000, phase: 0 };
  K.updBev(e);
  assert.ok(!e.alert, "далеко — пьют");
  K.G.pwy = 950; K.updBev(e);
  assert.ok(e.alert, "рядом — насторожились");
});
