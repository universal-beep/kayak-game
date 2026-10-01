// Общая таблица рекордов: сервер (Cloudflare Worker) и клиент в игре.
import test from "node:test";
import assert from "node:assert/strict";
import worker, { cleanName, validPid, upsert, publicRows, RATE_PER_MIN, MAX_SCORE_DAY, MAX_SCORE_ALL } from "../server/leaderboard-worker.mjs";
import { loadGame } from "./harness.mjs";

const PID1 = "a".repeat(32), PID2 = "b".repeat(32);
function kv() {
  const m = new Map();
  return { get: async k => m.get(k) ?? null, put: async (k, v) => { m.set(k, v); }, _m: m };
}
const post = (env, body, ip = "1.1.1.1") => worker.fetch(new Request("https://x/", { method: "POST", headers: { "cf-connecting-ip": ip }, body: JSON.stringify(body) }), env);
const get = (env, q) => worker.fetch(new Request("https://x/?" + q), env);

test("сервер: результат принят, таблица отдаёт его; pid наружу не уходит", async () => {
  const env = { BOARD: kv() };
  const r = await post(env, { pid: PID1, day: 3, name: "маша", score: 1234 });
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.ok(j.ok && j.rank === 1);
  const t = await (await get(env, "day=3")).json();
  assert.deepEqual(t.rows, [{ name: "МАША", score: 1234, mine: false }]);
  assert.ok(!JSON.stringify(t).includes(PID1), "pid не отдаётся");
  const mine = await (await get(env, "day=3&pid=" + PID1)).json();
  assert.equal(mine.rows[0].mine, true);
  const other = await (await get(env, "day=3&pid=" + PID2)).json();
  assert.equal(other.rows[0].mine, false);
});

test("сервер: у игрока одна строка — лучший счёт, имя последнее; сортировка по очкам", async () => {
  const env = { BOARD: kv() };
  await post(env, { pid: PID1, day: 1, name: "ПУТНИК", score: 900 });
  await post(env, { pid: PID1, day: 1, name: "МАКС", score: 500 });      // слабее — счёт прежний, имя новое
  await post(env, { pid: PID2, day: 1, name: "ОЛЯ", score: 1500 });
  const t = (await (await get(env, "day=1")).json()).rows;
  assert.deepEqual(t.map(r => [r.name, r.score]), [["ОЛЯ", 1500], ["МАКС", 900]]);
});

test("сервер: плохие запросы отклоняются", async () => {
  const env = { BOARD: kv() };
  const bad = [
    { pid: "x", day: 1, name: "A", score: 10 },
    { pid: PID1, day: 10, name: "A", score: 10 },
    { pid: PID1, day: -1, name: "A", score: 10 },
    { pid: PID1, day: 1, name: "A", score: -5 },
    { pid: PID1, day: 1, name: "A", score: 1.5 },
    { pid: PID1, day: 1, name: "A", score: MAX_SCORE_DAY + 1 },
    { pid: PID1, day: 0, name: "A", score: MAX_SCORE_ALL + 1 },
    { pid: PID1, day: 1, name: "A", score: "999" },
  ];
  for (const b of bad) assert.equal((await post(env, b)).status, 400, JSON.stringify(b));
  assert.equal((await post(env, { pid: PID1, day: 0, name: "A", score: MAX_SCORE_ALL })).status, 200, "потолок за поход");
  assert.equal((await get(env, "day=11")).status, 400);
  const r = await worker.fetch(new Request("https://x/", { method: "POST", body: "не json" }), env);
  assert.equal(r.status, 400);
  assert.equal((await worker.fetch(new Request("https://x/", { method: "DELETE" }), env)).status, 405);
});

test("сервер: имя чистится от разметки и ограничивается", () => {
  assert.equal(cleanName("<b>маша</b>"), "BМАША/B".replace("/", ""));
  assert.equal(cleanName("   "), "ПУТНИК");
  assert.equal(cleanName("абвгдеёжзийклмнопр"), "АБВГДЕЁЖЗИЙК");
  assert.equal(cleanName(null), "ПУТНИК");
  assert.ok(validPid(PID1) && !validPid("zz") && !validPid(5));
});

test("сервер: частота запросов ограничена по адресу", async () => {
  const env = { BOARD: kv() };
  let last;
  for (let i = 0; i < RATE_PER_MIN + 1; i++) last = await post(env, { pid: PID1, day: 1, name: "A", score: i });
  assert.equal(last.status, 429);
  assert.equal((await post(env, { pid: PID1, day: 1, name: "A", score: 1 }, "2.2.2.2")).status, 200, "другой адрес не заблокирован");
});

test("сервер: таблица хранит 200, отдаёт 50; CORS для игры на другом домене", async () => {
  let rows = [];
  for (let i = 0; i < 260; i++) rows = upsert(rows, { pid: i.toString(16).padStart(16, "0"), name: "N" + i, score: i, ts: i });
  assert.equal(rows.length, 200);
  assert.equal(rows[0].score, 259);
  assert.equal(publicRows(rows, null).length, 50);
  const r = await get({ BOARD: kv() }, "day=1");
  assert.equal(r.headers.get("access-control-allow-origin"), "*");
  const o = await worker.fetch(new Request("https://x/", { method: "OPTIONS" }), { BOARD: kv() });
  assert.equal(o.status, 204);
});

// ---------- клиент ----------
function store() {
  const m = new Map();
  return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) };
}
const URL_ = "https://board.example";

test("клиент: очередь хранит один результат на день, лучший счёт", () => {
  const { K } = loadGame(); K.resetSave();
  const st = store();
  K.outboxPush(K.onlinePayload(3, "маша", 500), st);
  K.outboxPush(K.onlinePayload(3, "маша", 900), st);
  K.outboxPush(K.onlinePayload(3, "маша", 700), st);
  K.outboxPush(K.onlinePayload(4, "маша", 100), st);
  const l = K.outboxLoad(st);
  assert.equal(l.length, 2);
  assert.equal(l.find(x => x.day === 3).score, 900);
  assert.equal(l[0].name, "МАША");
});

test("клиент: pid постоянный, 32 hex; payload валиден для сервера", () => {
  const { K } = loadGame(); K.resetSave();
  const a = K.playerId(), b = K.playerId();
  assert.equal(a, b);
  assert.ok(validPid(a));
  const p = K.onlinePayload(2, "x y", 12.9);
  assert.equal(p.score, 12);
  assert.ok(validPid(p.pid));
});

test("клиент: отправка очереди — успех очищает, сеть и 429/5xx оставляют, 4xx выбрасывает", async () => {
  const { K } = loadGame(); K.resetSave();
  const st = store();
  K.outboxPush(K.onlinePayload(1, "а", 100), st);
  K.outboxPush(K.onlinePayload(2, "а", 200), st);
  K.outboxPush(K.onlinePayload(3, "а", 300), st);
  K.outboxPush(K.onlinePayload(4, "а", 400), st);
  const codes = { 1: 200, 2: 429, 3: 400, 4: "net" };
  const fetch = async (u, init) => {
    const day = JSON.parse(init.body).day, c = codes[day];
    if (c === "net") throw new Error("offline");
    return { ok: c === 200, status: c };
  };
  const r = await K.onlineFlush({ fetch, store: st, url: URL_ });
  assert.equal(r.sent, 1); assert.equal(r.left, 2);
  assert.equal(K.outboxLoad(st).map(x => x.day).sort().join(","), "2,4");
});

test("клиент: без адреса сервера ничего не отправляется и не падает", async () => {
  const { K } = loadGame(); K.resetSave();
  const st = store();
  assert.equal(await K.onlineReport(1, "а", 5, { store: st, fetch: async () => { throw new Error("не должно"); } }), null);
  assert.equal(K.outboxLoad(st).length, 0);
});

test("клиент: таблица игроков — строки, пустая, нет связи; имя экранируется, своя подсвечена", async () => {
  const { K } = loadGame(); K.resetSave();
  const rows = [{ name: "<img>", score: 900, mine: false }, { name: "МАША", score: 800, mine: true }];
  const fetch = async (u) => ({ ok: true, status: 200, json: async () => ({ rows }) });
  const res = await K.onlineTop(3, { fetch, url: URL_ });
  assert.ok(res.ok && res.rows.length === 2);
  const html = K.onlineHtml(res);
  assert.ok(html.includes("(ВЫ)") && !html.includes("<img>"));
  assert.ok(K.onlineHtml({ ok: true, rows: [] }).includes("БУДЬ ПЕРВЫМ"));
  assert.ok(K.onlineHtml({ ok: false, rows: [] }).includes("НЕТ СВЯЗИ"));
  const down = await K.onlineTop(3, { fetch: async () => { throw new Error("x"); }, url: URL_ });
  assert.equal(down.ok, false);
  assert.equal(await K.onlineTop(3, {}), null, "без адреса — null");
});
