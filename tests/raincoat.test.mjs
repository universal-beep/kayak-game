// В дождливые дни (Тверца, дни 5–6) люди в дождевиках: капюшон закрывает
// голову, открыто лицо, плащ длиннее куртки и блестит. Наш гребец и
// соперники — тоже; в дождливом утреннем мульте — тоже.
import test from "node:test";
import assert from "node:assert/strict";
import { loadGame } from "./harness.mjs";

const count = (m, ch) => m.join("").split(ch).length - 1;

test("в дождь люди и гребцы в дождевиках, в сухие дни — как обычно", () => {
  const { K } = loadGame();
  const rainy = K.LEVELS.findIndex(L => L.rain), dry = K.LEVELS.findIndex(L => !L.rain);
  for (const n of ["kayak_center", "kayak_left", "kayak_right", "rower", "person", "girl", "sitter", "fisher", "fisher_l"]) {
    K.G.day = rainy; assert.equal(K.wearName(n), n + "_rain", "дождь: " + n);
    K.G.day = dry;   assert.equal(K.wearName(n), n, "сухо: " + n);
  }
  K.G.day = rainy; assert.equal(K.wearName("tent"), "tent", "палатке дождевик не нужен");
});

test("дождевик: капюшон закрывает лоб, плащ длиннее куртки", () => {
  const { K } = loadGame();
  const p = K.SPR.person.map, r = K.SPR.person_rain.map;
  const firstFace = m => m.findIndex(row => row.includes("t"));
  assert.ok(firstFace(r) > firstFace(p), "лоб под капюшоном");
  assert.ok(count(r, "r") > count(p, "r"), "плаща больше, чем куртки");
  assert.ok(count(r, "f") > 0, "плащ блестит");
});

test("в дождливом утреннем мульте люди в дождевиках", () => {
  const { K } = loadGame();
  assert.equal(K.cutWear(K.CUTS.morning_rain, "person"), "person_rain");
  assert.equal(K.cutWear(K.CUTS.morning_rain, "person_paddle"), "person_paddle_rain");
  assert.equal(K.cutWear(K.CUTS.morning, "person"), "person");
});
