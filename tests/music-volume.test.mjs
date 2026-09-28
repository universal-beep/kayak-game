// Фоновая мелодия на 20% тише прежней (просьба Максима 28.09.2026):
// ноты мелодии и баса играются с множителем MUSIC_VOL.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadGame } from "./harness.mjs";

test("мелодия на 20% тише: множитель 0,8 на мелодию и бас", () => {
  const { K } = loadGame();
  assert.equal(K.MUSIC_VOL, 0.8);
  const src = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const body = src.slice(src.indexOf("function musicTick(){"), src.indexOf("function sfx(kind){"));
  assert.equal((body.match(/\*MUSIC_VOL/g) || []).length, 2, "мелодия и бас — через MUSIC_VOL");
});
