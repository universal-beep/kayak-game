// D2: hit stop — удар/парирование/баржа замирают на 4 кадра, лодка сжимается,
// но кадр продолжает рисоваться. Логика после заморозки идёт дальше.
import test from "node:test";
import assert from "node:assert/strict";
import { loadGame, setupWorld } from "./harness.mjs";

function world(){
  const { K } = loadGame();
  K.resetSave(); K.startDay(0); setupWorld(K, { wy: 5000 });
  K.G.s = "playing"; K.G.frame = 10; K.G.stam = 100;
  return K;
}

test("удар: заморозка 4 кадра и сжатие лодки", () => {
  const K = world();
  K.damage({ type:"rock", wy:5000, t:0.2, r:20 });
  assert.equal(K.G.hp, 2);
  assert.equal(K.G.freeze, 4);
  assert.equal(K.G.squash, 2);

  for (let i = 0; i < 4; i++) K.upd();
  assert.equal(K.G.frame, 10, "во время заморозки кадр не идёт");
  assert.equal(K.G.freeze, 0);
  K.upd();
  assert.equal(K.G.frame, 11, "после заморозки логика продолжается");
});

test("парирование: тот же hit stop, но только за точный удар", () => {
  const K = world();
  K.G.obs = [{ type:"kayaker", aggro:true, swingT:10, wy:5000, t:0.2, visHalf:20, flipT:0 }];
  K.paddleStrike();
  assert.equal(K.G.parries, 1);
  assert.equal(K.G.freeze, 4);
  assert.equal(K.G.squash, 2);
});

test("баржа: заморозка есть, щит её не отменяет", () => {
  const K = world();
  K.G.hp = 3; K.G.lives = 3; K.G.inv = 0; K.G.whiskyT = 0;
  K.crush({ type:"barge", wy:5000, t:0, r:60 });
  assert.equal(K.G.freeze, 4);
  assert.equal(K.G.squash, 2);
});
