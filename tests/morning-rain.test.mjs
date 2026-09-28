// Утро перед дождливым днём (Тверца, дни 5–6) — дождливое: серое небо, без
// восхода и птиц, с дождём и его звуком. В солнечные дни утро прежнее.
// Ночные пейзажи не берут речные камни (они теперь вида сверху).
import test from "node:test";
import assert from "node:assert/strict";
import { loadGame } from "./harness.mjs";

test("перед дождливым днём утро дождливое, перед сухим — солнечное", () => {
  const { K } = loadGame();
  K.LEVELS.forEach((L, i) => { if (i === 0) return;
    const sc = K.CUTS[K.morningName(i)];
    assert.equal(!!sc.rain, !!L.rain, "день " + L.day);
    if (L.rain) assert.ok(sc.rainSound && sc.sky === "rain", "дождь со звуком и серым небом");
  });
});


test("в ночах на горизонте не речные камни вида сверху", () => {
  const { K } = loadGame();
  const river = ["boulder", "fang", "slab", "mossy", "pebbles"];
  for (const [n, sc] of Object.entries(K.CUTS)) {
    const bad = [...sc.actors.filter(a => river.includes(a.spr)).map(a => a.spr)];
    assert.deepEqual(bad, [], n);
  }
});
