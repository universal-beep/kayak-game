// Гонка с призраком: сервер хранит заезд (уровень + след лодки) по короткому
// коду; друг открывает ссылку ?race=КОД и плывёт ту же реку с призраком.
import test from "node:test";
import assert from "node:assert/strict";
import worker from "../server/leaderboard-worker.mjs";
import { validGhost, GHOST_STEP } from "../server/race.mjs";

const PID = "c".repeat(32);
function kv() {
  const m = new Map();
  return { get: async k => m.get(k) ?? null, put: async (k, v) => { m.set(k, v); }, _m: m };
}
const lvl = { river: 2, lenIdx: 1, items: [{ c: 1, r: 3, k: "rock" }, { c: 3, r: 5, k: "fork" }, { c: 0, r: 6, k: "fisher" }] };
function run(frames = 600) {
  const track = [];
  for (let f = 0; f <= frames; f += GHOST_STEP) track.push(400 + f*4, Math.round(Math.sin(f/50)*300));
  return { pid: PID, name: "макс", lvl, frames, track };
}
const send = (env, body, ip = "2.2.2.2") => worker.fetch(new Request("https://x/ghost", { method: "POST", headers: { "cf-connecting-ip": ip }, body: JSON.stringify(body) }), env);
const load = (env, id) => worker.fetch(new Request("https://x/ghost?id=" + id), env);

test("призрак: сохранить заезд и получить его по коду", async () => {
  const env = { BOARD: kv() };
  const r = await send(env, run());
  assert.equal(r.status, 200);
  const { id } = await r.json();
  assert.match(id, /^[a-z0-9]{6}$/);
  const g = await (await load(env, id)).json();
  assert.equal(g.name, "МАКС");
  assert.equal(g.frames, 600);
  assert.deepEqual(g.lvl, lvl);
  assert.equal(g.track.length, run().track.length);
  assert.ok(!JSON.stringify(g).includes(PID), "номер игрока наружу не уходит");
});

test("призрак: нет такого кода — 404, кривой код — 400", async () => {
  const env = { BOARD: kv() };
  assert.equal((await load(env, "zzzzzz")).status, 404);
  assert.equal((await load(env, "../x")).status, 400);
});

test("призрак: мусор не сохраняется", async () => {
  const bad = [
    Object.assign(run(), { pid: "x" }),
    Object.assign(run(), { frames: -5 }),
    Object.assign(run(), { frames: 60*60*30 }),                              // полчаса — не заезд
    Object.assign(run(), { track: [1, 2, 3] }),                              // нечётная длина
    Object.assign(run(), { track: new Array(20000).fill(1) }),              // слишком длинный
    Object.assign(run(), { lvl: { river: 9, lenIdx: 1, items: [] } }),
    Object.assign(run(), { lvl: { river: 1, lenIdx: 1, items: [{ c: 9, r: 1, k: "rock" }] } }),
    Object.assign(run(), { lvl: { river: 1, lenIdx: 1, items: [{ c: 1, r: 1, k: "<script>" }] } })
  ];
  for (const b of bad) assert.equal(validGhost(b), false, JSON.stringify(b).slice(0, 80));
  const env = { BOARD: kv() };
  assert.equal((await send(env, bad[0])).status, 400);
  assert.equal(env.BOARD._m.size <= 1, true, "в хранилище только счётчик частоты");
});

test("таблица рекордов по-прежнему работает рядом с призраками", async () => {
  const env = { BOARD: kv() };
  const r = await worker.fetch(new Request("https://x/", { method: "POST", headers: { "cf-connecting-ip": "3.3.3.3" },
    body: JSON.stringify({ pid: PID, day: 2, name: "оля", score: 100 }) }), env);
  assert.equal(r.status, 200);
  const t = await (await worker.fetch(new Request("https://x/?day=2"), env)).json();
  assert.equal(t.rows[0].name, "ОЛЯ");
});
