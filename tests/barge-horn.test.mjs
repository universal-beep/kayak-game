// Баржа гудит один раз — когда въезжает в кадр: слышно, что идёт большая.
import test from "node:test";
import assert from "node:assert/strict";
import { loadGame, setupWorld } from "./harness.mjs";

test("баржа гудит один раз, когда появляется в кадре", () => {
  const { K } = loadGame();
  setupWorld(K, { wy: 6000 });
  K.G.day = 1; K.G.s = "playing"; K.G.inv = 1e9; K.G.bev = [];
  const s = K.spriteSize("barge");
  const o = { type: "barge", t: 0, wy: K.worldYOf(-s.h / 2 - 40), vt: 0, visHalf: s.w / 2, visHalfY: s.h / 2, halfPx: s.w / 2 };
  K.G.obs = [o];
  const horns = [];
  for (let f = 0; f < 400; f++) {
    K.G.sfxLast = null;
    K.bargeHorn();
    if (K.G.sfxLast === "horn") horns.push(Math.round(K.screenYOf(o.wy)));
    K.G.scroll += 1;                                   // камера догоняет баржу
  }
  assert.equal(horns.length, 1, "гудков: " + horns.length);
  assert.ok(horns[0] + s.h / 2 >= 0 && horns[0] - s.h / 2 < 40, "гудок не у верхней кромки: y=" + horns[0]);
});

test("гудок строится без ошибок и заметно длиннее обычных звуков", () => {
  const { K } = loadGame();
  const made = [];
  const node = () => ({ connect() {}, start() {}, stop(t) { made.push(t); }, frequency: { setValueAtTime() {}, value: 0 },
    gain: { setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, type: "" });
  K.setAudio({ currentTime: 0, destination: {}, createOscillator: node, createGain: node, createBiquadFilter: node });
  K.sfx("horn");
  assert.ok(made.length >= 2 && Math.max(...made) >= 2, "гудок короче 2 с");
});
