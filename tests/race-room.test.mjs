// Гонка вдвоём: комната на сервере (Durable Object). Первый (host) приносит
// уровень, второй (guest) получает его; когда оба на месте — общий старт;
// положения и финиш пересылаются сопернику; третий не входит.
import test from "node:test";
import assert from "node:assert/strict";
import { RaceRoom, START_IN, validCode } from "../server/race.mjs";

function fakeWs(role) {
  let att = { role };
  return { sent: [], closed: false, send(m) { this.sent.push(JSON.parse(m)); }, close() { this.closed = true; },
           serializeAttachment(a) { att = a; }, deserializeAttachment() { return att; } };
}
function room() {
  const socks = [];
  const store = new Map();
  const ctx = { getWebSockets: tag => tag ? socks.filter(s => s.deserializeAttachment().role === tag) : socks.slice(),
                storage: { get: async k => store.get(k), put: async (k, v) => { store.set(k, v); } } };
  const r = new RaceRoom(ctx, {});
  r._add = ws => socks.push(ws);
  r._drop = ws => socks.splice(socks.indexOf(ws), 1);
  return r;
}
const lvl = { river: 1, lenIdx: 1, items: [{ c: 2, r: 3, k: "rock" }] };
const msg = (r, ws, m) => r.webSocketMessage(ws, JSON.stringify(m));

test("код комнаты: 4 знака без путаных букв", () => {
  assert.ok(validCode("K7MQ"));
  assert.ok(!validCode("k7mq") && !validCode("K7M") && !validCode("K0O1") && !validCode("../x"));
});

test("комната: гость получает уровень и имя, оба — общий старт", async () => {
  const r = room(), h = fakeWs("host"), gst = fakeWs("guest");
  r._add(h);
  await msg(r, h, { type: "hello", name: "МАКС", lvl });
  assert.equal(h.sent.length, 0, "одному стартовать не с кем");
  r._add(gst);
  await msg(r, gst, { type: "hello", name: "ОЛЯ" });
  const lv = gst.sent.find(m => m.type === "lvl");
  assert.ok(lv, "гость получил уровень");
  assert.deepEqual(lv.lvl, lvl); assert.equal(lv.name, "МАКС");
  const hj = h.sent.find(m => m.type === "joined");
  assert.ok(hj && hj.name === "ОЛЯ", "хозяин узнал имя гостя");
  for (const ws of [h, gst]) {
    const st = ws.sent.find(m => m.type === "start");
    assert.ok(st && st.in === START_IN, "старт у обоих");
  }
});

test("комната: положение и финиш уходят сопернику, не себе", async () => {
  const r = room(), h = fakeWs("host"), gst = fakeWs("guest");
  r._add(h); await msg(r, h, { type: "hello", name: "А", lvl });
  r._add(gst); await msg(r, gst, { type: "hello", name: "Б" });
  h.sent.length = 0; gst.sent.length = 0;
  await msg(r, h, { type: "pos", f: 60, wy: 900, t: 120 });
  assert.deepEqual(gst.sent, [{ type: "pos", f: 60, wy: 900, t: 120 }]);
  assert.equal(h.sent.length, 0);
  await msg(r, gst, { type: "fin", frames: 3000 });
  assert.deepEqual(h.sent, [{ type: "fin", frames: 3000 }]);
  await msg(r, gst, { type: "pos", f: "x" });                       // мусор не пересылается
  await msg(r, gst, { type: "boom" });
  assert.equal(h.sent.length, 1);
});

test("комната: ушёл один — второй узнаёт", async () => {
  const r = room(), h = fakeWs("host"), gst = fakeWs("guest");
  r._add(h); await msg(r, h, { type: "hello", name: "А", lvl });
  r._add(gst); await msg(r, gst, { type: "hello", name: "Б" });
  r._drop(gst);
  await r.webSocketClose(gst);
  assert.ok(h.sent.some(m => m.type === "left"));
});

test("комната: гость без хозяина и третий лишний", async () => {
  const r = room(), gst = fakeWs("guest");
  r._add(gst); await msg(r, gst, { type: "hello", name: "Б" });
  assert.ok(gst.sent.some(m => m.type === "nohost"));
  const r2 = room(), h = fakeWs("host"), g2 = fakeWs("guest");
  r2._add(h); r2._add(g2);
  const res = await r2.fetch(new Request("https://x/room?code=K7MQ&role=guest", { headers: { Upgrade: "websocket" } }));
  assert.equal(res.status, 409);
});
