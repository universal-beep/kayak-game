// Драки в гонках: весло бьёт соперника, два попадания — лодка переворачивается
// на 2 секунды и почти стоит (сердца не тратятся). В регате задира и лихач
// сами нападают борт о борт (замах «!» → удар), ударить первым в замах — отбил.
// Вдвоём удар уходит сопернику через сервер, перевёрнутая лодка видна обоим.
import test from "node:test";
import assert from "node:assert/strict";
import { runInContext } from "node:vm";
import { loadGame } from "./harness.mjs";
import { RaceRoom } from "../server/race.mjs";

function game() {
  const { K, sandbox } = loadGame();
  runInContext("(function(){ let a = 99; Math.random = function(){ a = (a*1103515245 + 12345) >>> 0; return a/4294967296; }; })()", sandbox);
  K.resetSave(); K.setAudio(null);
  return K;
}
function regattaGo(K) {
  K.startRegatta(K.REGATTA_TRACKS[0]);
  let f = 0;
  while (K.G.s !== "playing" && f++ < 400) K.upd();
  for (let i = 0; i < 20; i++) { K.G.inv = 1e9; K.upd(); }
  return K.G.custom.race;
}
// Поставить бота борт о борт с игроком, остальных убрать подальше.
function alongside(K, R, b) {
  for (const o of R.bots) if (o !== b) o.wy = K.G.pwy - 900;
  b.wy = K.G.pwy; b.t = K.G.t + 0.25; b.vt = 0; b.goal = b.t; b.stunT = 0;
}

test("регата: два попадания веслом — бот переворачивается и почти стоит", () => {
  const K = game(), R = regattaGo(K);
  const b = R.bots.find(o => o.style === "steady");
  alongside(K, R, b);
  K.paddleStrike();
  assert.equal(b.hits, 1, "первое попадание");
  assert.ok(!(b.flipT > 0));
  K.G.raceHitCool = 0; alongside(K, R, b);
  K.paddleStrike();
  assert.ok(b.flipT > 0, "перевернулся");
  const other = R.bots.find(o => o !== b && !o.end);
  const w0 = b.wy, o0 = other.wy;
  for (let i = 0; i < 30; i++) { K.G.inv = 1e9; K.upd(); }
  assert.ok(b.wy - w0 < (other.wy - o0)*0.4, "перевёрнутый почти стоит");
  assert.ok(K.RACE_FLIP >= 110 && K.RACE_FLIP <= 130, "на 2 секунды");
});

test("регата: задира бьёт борт о борт; два удара — переворачиваешься, сердца целы", () => {
  const K = game(), R = regattaGo(K);
  const bully = R.bots.find(o => o.style === "bully");
  const hp = K.G.hp;
  for (let round = 0; round < 2; round++) {
    let f = 0;
    const hits0 = K.G.raceHits || 0, flip0 = K.G.raceFlipT > 0;
    while (f++ < 400) {
      alongside(K, R, bully);
      K.G.inv = 0; K.upd();
      if ((K.G.raceHits || 0) !== hits0 || (!flip0 && K.G.raceFlipT > 0)) break;
    }
    assert.ok(f < 400, "задира ударил (раунд " + (round + 1) + ")");
  }
  assert.ok(K.G.raceFlipT > 0, "после двух ударов — переворот");
  assert.equal(K.G.hp, hp, "сердца не тратятся");
  const p0 = K.G.pwy;
  for (let i = 0; i < 30; i++) { K.G.inv = 1e9; K.upd(); }
  assert.ok(K.G.pwy - p0 < 40, "перевёрнутый почти стоит: " + Math.round(K.G.pwy - p0));
});

test("регата: ударить первым, пока задира заносит весло, — отбил", () => {
  const K = game(), R = regattaGo(K);
  const bully = R.bots.find(o => o.style === "bully");
  let f = 0;
  while (!(bully.swingT > 0) && f++ < 400) { alongside(K, R, bully); K.G.inv = 0; K.upd(); }
  assert.ok(bully.swingT > 0, "замахнулся");
  K.G.raceHitCool = 0;
  K.paddleStrike();
  assert.ok(!(bully.swingT > 0), "замах сорван");
  assert.equal(bully.hits, 1, "попадание засчитано тебе");
  assert.ok(!(K.G.raceHits > 0), "по тебе не попал");
});

function FakeWS() {
  const all = [];
  class WS {
    constructor(url) { this.url = url; this.sent = []; this.readyState = 1; all.push(this); }
    send(m) { this.sent.push(JSON.parse(m)); } close() {}
    open() { this.onopen && this.onopen(); }
    recv(m) { this.onmessage && this.onmessage({ data: JSON.stringify(m) }); }
  }
  WS.all = all;
  return WS;
}

test("вдвоём: удар уходит сопернику; два полученных удара — переворот, сопернику видно", () => {
  const K = game(), WS = FakeWS();
  K.netJoin("K7MQ", "Оля", { WebSocket: WS, url: "https://srv" });
  const ws = WS.all[0]; ws.open();
  ws.recv({ type: "lvl", lvl: K.raceLevel(5), name: "МАКС" });
  ws.recv({ type: "start", in: 100 });
  for (let i = 0; i < 20; i++) K.upd();
  // соперник идёт борт о борт: шлёт своё место рядом с нами каждый кадр
  for (let i = 0; i < 40; i++) { ws.recv({ type: "pos", f: 20 + i, wy: Math.round(K.G.pwy), t: Math.round((K.G.t + 0.25)*1000) }); K.G.inv = 1e9; K.upd(); }
  ws.sent.length = 0;
  K.paddleStrike();
  assert.ok(ws.sent.some(m => m.type === "hit"), "удар отправлен");
  ws.recv({ type: "hit" }); ws.recv({ type: "hit" });
  assert.ok(K.G.raceFlipT > 0, "перевернулся");
  ws.sent.length = 0;
  for (let i = 0; i < 12; i++) { K.G.inv = 1e9; K.upd(); }
  assert.ok(ws.sent.some(m => m.type === "pos" && m.fl === 1), "сопернику видно, что перевёрнут");
  ws.recv({ type: "pos", f: 80, wy: K.G.pwy + 50, t: 0, fl: 1 });
  assert.equal(K.G.net.pos.fl, 1);
  assert.doesNotThrow(() => K.rndr());
});

test("сервер: пересылает удар и признак переворота", async () => {
  const socks = [], store = new Map();
  const ws = role => { let att = { role, name: "X" }; return { sent: [], send(m) { this.sent.push(JSON.parse(m)); }, serializeAttachment(a) { att = a; }, deserializeAttachment() { return att; } }; };
  const ctx = { getWebSockets: () => socks.slice(), storage: { get: async k => store.get(k), put: async (k, v) => store.set(k, v) } };
  const room = new RaceRoom(ctx, {});
  const a = ws("host"), b = ws("guest"); socks.push(a, b);
  await room.webSocketMessage(a, JSON.stringify({ type: "hit" }));
  assert.deepEqual(b.sent, [{ type: "hit" }]);
  await room.webSocketMessage(a, JSON.stringify({ type: "pos", f: 1, wy: 2, t: 3, fl: 1 }));
  assert.deepEqual(b.sent[1], { type: "pos", f: 1, wy: 2, t: 3, fl: 1 });
});
