// Запуск страницы «как в браузере» (стартовый код без флага тестов).
import test from "node:test";
import assert from "node:assert/strict";
import { loadGame } from "./harness.mjs";

test("обычный запуск без параметров крутит главный цикл", () => {
  const { sandbox } = loadGame(null, { boot: true, search: "" });
  assert.ok(sandbox.__raf > 0, "главный цикл не запросил ни одного кадра");
});

// Баг: с ?day=N стартовый код вызывал startDay и applyDebugScene, но не lp(),
// поэтому отладочные сцены (?day=1&scene=beach|finish|camp|ducks) давали
// чёрный экран — игра стояла на кадре 0.
test("отладочный запуск ?day=N&scene=... тоже крутит главный цикл", () => {
  for (const search of ["?day=1", "?day=1&scene=beach", "?day=1&scene=finish"]) {
    const { K, sandbox } = loadGame(null, { boot: true, search });
    assert.ok(sandbox.__raf > 0, search + ": главный цикл не запущен — чёрный экран");
    assert.equal(K.G.s, "playing", search + ": день не начался");
  }
});
