// Автопилот прогона (tools/playthrough.mjs): короткий заход отрабатывает без
// ошибок, считает удары, а сводка по дням собирается из заходов.
import test from "node:test";
import assert from "node:assert/strict";
import { runDay, summarize } from "../tools/playthrough.mjs";

test("автопилот: короткий заход первого дня — плывёт вперёд, без ошибок", () => {
  const r = runDay(0, 1, { maxFrames: 900 });
  assert.equal(r.day, 1);
  assert.deepEqual(r.errors, []);
  assert.ok(r.dist > 60, "проплыл: " + r.dist);
  assert.ok(r.hits >= 0 && typeof r.hitBy === "object");
});

test("сводка: доля дошедших и среднее по ударам по каждому дню", () => {
  const s = summarize([
    { day: 3, done: true, hits: 2, deaths: 0, sec: 120, errors: [] },
    { day: 3, done: false, hits: 4, deaths: 1, sec: 100, errors: ["x"] },
    { day: 5, done: true, hits: 1, deaths: 0, sec: 130, errors: [] }
  ]);
  const d3 = s.find(x => x.day === 3);
  assert.equal(d3.done, "1/2"); assert.equal(d3.hits, 3); assert.equal(d3.errors, 1);
  assert.equal(s.find(x => x.day === 5).hits, 1);
});
