// Топор в запас: подобрал — лежит (до двух), двойной тап кидает его в
// ближайшее на курсе: бревно и корягу раскалывает, лодку соперника топит, от
// камня отскакивает. Нет топора — двойной тап машет веслом, как раньше.
// Туман на 8-м дне прячет даль; встречный ветер на 6-м порывами тормозит,
// у берега тише.
import test from "node:test";
import assert from "node:assert/strict";
import { loadGame, setupWorld } from "./harness.mjs";

function world() {
  const { K } = loadGame();
  setupWorld(K, { wy: 1000 }); K.G.s = "playing"; K.G.t = 0; K.G.axes = 0; K.G.rBend = 0;
  return K;
}
const fly = K => { for (let i = 0; i < 120 && K.G.axeFly; i++) K.axeStep(); };

test("топор ложится в запас (до двух) и сам ничего не рубит", () => {
  const K = world();
  const log = { type: "log", t: 0, wy: K.G.pwy + 150, vt: 0, visHalf: 40, visHalfY: 12, halfPx: 30 };
  K.G.obs.push(log);
  K.apBn({ type: "axe", t: 0, wy: K.G.pwy });
  assert.equal(K.G.axes, 1);
  assert.ok(K.G.obs.includes(log), "сам не рубит");
  K.apBn({ type: "axe", t: 0, wy: K.G.pwy }); K.apBn({ type: "axe", t: 0, wy: K.G.pwy });
  assert.equal(K.G.axes, 2, "больше двух не носим");
});

test("двойной тап с топором: соперник тонет, бревно раскалывается, от камня отскакивает", () => {
  let K = world();
  const kay = { type: "kayaker", t: 0.05, wy: K.G.pwy + 160, vt: 0, visHalf: 31, visHalfY: 24, halfPx: 26, swingT: -1, aggro: false, flipT: 0 };
  K.G.obs.push(kay); K.G.axes = 1;
  K.paddleStrike();
  assert.equal(K.G.axes, 0, "топор потрачен");
  assert.ok(K.G.axeFly, "топор летит");
  fly(K);
  assert.ok(kay.flipT > 0, "лодка соперника тонет");

  K = world();
  const log = { type: "log", t: 0, wy: K.G.pwy + 150, vt: 0, visHalf: 40, visHalfY: 12, halfPx: 30 };
  K.G.obs.push(log); K.G.axes = 1; K.paddleStrike(); fly(K);
  assert.ok(!K.G.obs.includes(log), "бревно расколото");

  K = world();
  const rock = { type: "rock", t: 0, wy: K.G.pwy + 150, vt: 0, visHalf: 27, visHalfY: 22, halfPx: 22, sprite: "boulder" };
  K.G.obs.push(rock); K.G.axes = 1; K.paddleStrike(); fly(K);
  assert.ok(K.G.obs.includes(rock), "камень топором не взять");
});

test("без топора двойной тап — взмах веслом", () => {
  const K = world();
  K.paddleStrike();
  assert.equal(K.G.axeFly || null, null, "топор не летит");
  assert.equal(K.G.strikeT, 12, "взмах");
});

test("туман на 8-м дне: даль скрыта, у лодки ясно; в другие дни тумана нет", () => {
  const { K } = loadGame();
  K.LEVELS.forEach((L, d) => assert.equal(!!L.fog, d === 7, "день " + L.day));
  K.G.day = 7;
  assert.ok(K.fogAlpha(0) > 0.6, "у верхней кромки — густо");
  assert.equal(K.fogAlpha(9999), 0, "у лодки — ясно");
  K.G.day = 0;
  assert.equal(K.fogAlpha(0), 0);
});

test("встречный ветер на 6-м дне: порывами тормозит, у берега тише; в другие дни нет", () => {
  const { K } = loadGame();
  K.LEVELS.forEach((L, d) => assert.equal(!!L.wind, d === 5, "день " + L.day));
  K.G.day = 5;
  let minC = 1, atMin = 0;
  for (let f = 0; f < 1200; f++) { const m = K.windMul(f, 0); if (m < minC) { minC = m; atMin = f; } }
  assert.ok(minC < 0.8, "порыв тормозит: " + minC.toFixed(2));
  assert.ok(K.windMul(atMin, 0.8) > minC + 0.1, "у берега тише");
  const calm = [...Array(1200).keys()].some(f => K.windMul(f, 0) === 1);
  assert.ok(calm, "между порывами тихо");
  K.G.day = 0;
  assert.equal(K.windMul(atMin, 0), 1);
});
