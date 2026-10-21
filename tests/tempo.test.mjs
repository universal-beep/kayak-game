// Темп дня: затишье, нарастание, пик, улово. После пика река отпускает,
// и в улове гарантированно лежит бонус.
import test from "node:test";
import assert from "node:assert/strict";
import { loadGame, setupWorld } from "./harness.mjs";

test("темп: плотность не растёт монотонно", () => {
  const { K } = loadGame();
  assert.ok(K.tempoAt(0.02) < K.tempoAt(0.18), "от затишья к нарастанию плотность растёт");
  assert.ok(K.tempoAt(0.32) > K.tempoAt(0.42), "после пика плотность падает");
  assert.ok(K.tempoAt(0.42) < K.tempoAt(0.18), "в улове легче, чем на нарастании");
  assert.ok(K.tempoAt(0.42) < K.tempoAt(0.60), "после улова река снова плотнее");
});

test("темп: после пика есть улово с бонусом", () => {
  const { K } = loadGame();
  K.resetSave();
  K.save.seen.tutorial = 1;
  K.startDay(1);
  setupWorld(K, { wy: 5000 });
  K.G.s = "playing";
  const len = K.LEVELS[1].len;

  K.G.dist = len*0.39;
  K.tempoTick();
  assert.equal(K.G.tempo.lull, false, "до 40% улова ещё нет");

  K.G.dist = len*0.41;
  K.tempoTick();
  assert.equal(K.G.tempo.lull, true, "улово началось");
  assert.ok(K.G.tempo.restT > 0, "после пика есть пауза без спавна");
  assert.equal(K.spawnAllowed(), false, "новые препятствия не сыплются");
  assert.ok(K.G.bns.some(b => b.tempo), "в улове лежит гарантированный бонус");
  assert.equal(K.G.bns.find(b => b.tempo).type, "bread");
});
