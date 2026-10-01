// Загорающие — на песке у воды, а не в лесу: дальней сцены «пляж» нет.
// Пляжей на Волге стало мало (за день 1–0) — их чаще; иногда и на узких
// реках (Медведица, Осуга). На дождливой Тверце пляжей нет.
import test from "node:test";
import assert from "node:assert/strict";
import { runInContext } from "node:vm";
import { loadGame, setupWorld } from "./harness.mjs";

function beachesOn(day, seed) {
  const { K, sandbox } = loadGame();
  runInContext("(function(){ let a = " + seed + "; Math.random = function(){ a = (a*1103515245 + 12345) >>> 0; return a/4294967296; }; })()", sandbox);
  K.resetSave(); K.setAudio(null);
  K.startDay(day); setupWorld(K, { wy: 400 }); K.G.s = "playing";
  const seen = new Set();
  for (let f = 0; f < 9000 && K.G.s === "playing"; f++) {
    K.G.inv = 1e9; K.upd();
    for (const e of K.G.bev) if (e.type === "beach") seen.add(e);
  }
  return seen.size;
}

test("загорающих нет в дальних сценах (в лесу)", () => {
  const { K } = loadGame();
  for (const set of K.FAR_SCENES) for (const sc of set)
    assert.ok(!sc.parts.some(p => /sunbather|umbrella|towel/.test(p.spr)), "сцена " + sc.name);
});

test("на Волге пляжей хватает, на узких реках иногда бывают, на Тверце нет", () => {
  const volga = [0, 1].map(d => beachesOn(d, 3) + beachesOn(d, 7));
  assert.ok(volga[0] >= 4 && volga[1] >= 4, "Волга, два захода: " + volga);
  const narrow = beachesOn(2, 3) + beachesOn(2, 7) + beachesOn(6, 3) + beachesOn(6, 7);
  assert.ok(narrow >= 2, "Медведица и Осуга: " + narrow);
  const { K } = loadGame();
  assert.ok(!K.BEV_POOLS[2].includes("beach"), "Тверца без пляжа");
});
