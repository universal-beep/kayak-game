// Пять рыбаков: сидит на ведре, стоит, папа с сыном, с «Нивой», с
// велосипедом. У каждого удочка идёт из рук (комель в рисунке). Машина и
// велосипед — на Волге; в дождь (Тверца) — только те, кого можно одеть в
// дождевик.
import test from "node:test";
import assert from "node:assert/strict";
import { loadGame } from "./harness.mjs";

const ALL = ["fisher", "fisher_stand", "fisher_kid", "fisher_car", "fisher_bike"];

test("пять рыбаков, у каждого — отражённый и комель удочки в руках", () => {
  const { K } = loadGame();
  for (const n of ALL) {
    assert.ok(K.SPR[n] && K.SPR[n + "_l"], "нет " + n);
    const a = K.rodAnchor(n), m = K.SPR[n].map, w = m[0].length*3, h = m.length*3;
    assert.ok(a && Math.abs(a.x) < w/2 && Math.abs(a.y) < h/2, n + ": комель внутри рисунка");
    // у папы с сыном ближе к воде стоит сын — папин комель в левой половине
    if (n === "fisher_kid") assert.ok(a.x < 0, n + ": комель у папы");
    else assert.ok(a.x > 0, n + ": комель ближе к воде (вправо)");
  }
});

test("по рекам: с машиной и велосипедом — Волга; в дождь — только в дождевиках", () => {
  const { K } = loadGame();
  const kinds = K.FISHER_KINDS;
  assert.deepEqual([...kinds[0]].sort(), [...ALL].sort(), "на Волге все пять");
  for (let r = 1; r < 4; r++) {
    assert.ok(kinds[r].length >= 2, "река " + r);
    assert.ok(!kinds[r].includes("fisher_car") && !kinds[r].includes("fisher_bike"), "машина и велик только на Волге");
  }
  K.LEVELS.forEach(L => { if (L.rain) for (const n of kinds[L.river]) assert.ok(K.SPR[n + "_rain"], L.day + ": " + n + " без дождевика"); });
  const seen = new Set();
  for (let wy = 1000; wy < 60000; wy += 777) seen.add(K.fisherKind({ type: "fisher", wy }, 0));
  assert.equal(seen.size, 5, "на Волге встречаются все пятеро");
});
