// Debug-прыжок в уровень: ?day=N.
// Парсер dayFromParam() живёт в boot-блоке браузера (в VM не исполняется),
// поэтому тестируем его как чистую функцию.
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadGame } from "./harness.mjs";

const { K } = loadGame();

test("dayFromParam: номер дня → индекс уровня", () => {
  assert.equal(K.dayFromParam("1"), 0);   // день 1 → индекс 0
  assert.equal(K.dayFromParam("4"), 3);   // день 4 → индекс 3
  assert.equal(K.dayFromParam("9"), 8);   // день 9 → индекс 8
});

test("dayFromParam: зажим по границам LEVELS", () => {
  assert.equal(K.dayFromParam("0"), 0);   // меньше первого → день 1
  assert.equal(K.dayFromParam("99"), 8);  // больше последнего → день 9
});

test("dayFromParam: мусор → undefined", () => {
  assert.equal(K.dayFromParam(undefined), undefined);
  assert.equal(K.dayFromParam(""), undefined);
  assert.equal(K.dayFromParam("all"), undefined);
  assert.equal(K.dayFromParam("abc"), undefined);
});