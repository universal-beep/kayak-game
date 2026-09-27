// Утро перед дождливым днём (Тверца, дни 5–6) — дождливое: серое небо, без
// восхода и птиц, с дождём и его звуком. В солнечные дни утро прежнее.
// Ночные пейзажи не берут речные камни (они теперь вида сверху).
import test from "node:test";
import assert from "node:assert/strict";
import { loadGame } from "./harness.mjs";

test("перед дождливым днём утро дождливое, перед сухим — солнечное", () => {
  const { K } = loadGame();
  const rainy = [];
  K.LEVELS.forEach((L, i) => {
    const want = L.rain ? "morning_rain" : "morning";
    assert.equal(K.morningName(i), want, "день " + L.day);
    if (L.rain) rainy.push(L.day);
  });
  assert.ok(rainy.length >= 1, "нет дождливых дней");
});

test("дождливое утро: серое небо, дождь со звуком, без восхода", () => {
  const { K } = loadGame();
  const sc = K.CUTS.morning_rain;
  assert.ok(sc, "нет мульта morning_rain");
  assert.equal(sc.sky, "rain");
  assert.ok(sc.rain > 0 && sc.rainSound, "дождь и его звук");
  assert.ok(!sc.actors.some(a => a.spr === "sunrise"), "восход под дождём");
  assert.ok(K.CUT_SKY.rain, "нет цвета неба для дождя");
});

test("в ночах на горизонте не речные камни вида сверху", () => {
  const { K } = loadGame();
  const river = ["boulder", "fang", "slab", "mossy", "pebbles"];
  for (const [n, sc] of Object.entries(K.CUTS)) {
    const bad = [...sc.actors.filter(a => river.includes(a.spr)).map(a => a.spr)];
    assert.deepEqual(bad, [], n);
  }
});
