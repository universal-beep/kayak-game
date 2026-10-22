// D6: щелчок интерфейса, общий mute и громкость SFX доступны без AudioContext
// и не зависят от музыки.
import test from "node:test";
import assert from "node:assert/strict";
import { loadGame } from "./harness.mjs";

test("звук: громкость SFX ограничена и запоминается", () => {
  const { K } = loadGame();
  assert.equal(K.sfxVolume(), 0.7);
  assert.equal(K.setSfxVol(0.35), 0.35);
  assert.equal(K.sfxVolume(), 0.35);
  assert.equal(K.setSfxVol(9), 1);
  assert.equal(K.setSfxVol(-9), 0);
});

test("звук: общий mute переключается и возвращает состояние", () => {
  const { K } = loadGame();
  assert.equal(K.muted(), false);
  assert.equal(K.toggleMute(), true);
  assert.equal(K.muted(), true);
  assert.equal(K.toggleMute(), false);
  assert.equal(K.muted(), false);
  assert.equal(K.setMuted(true), true);
  assert.equal(K.muted(), true);
});

test("звук: клик интерфейса помечается как звук click", () => {
  const { K } = loadGame();
  K.uiClick();
  assert.equal(K.G.sfxLast, "click");
});
