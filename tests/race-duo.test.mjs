// Гонка вдвоём по ссылке ?room=КОД: хозяин создаёт комнату и уровень, гость
// подключается, по общему старту оба плывут ту же широкую реку после отсчёта
// 3-2-1; положение уходит сопернику, его лодка видна; финиш — кто быстрее.
import test from "node:test";
import assert from "node:assert/strict";
import { loadGame } from "./harness.mjs";

function game() {
  const { K } = loadGame();
  K.resetSave(); K.setAudio(null);
  return K;
}
function FakeWS() {
  const all = [];
  class WS {
    constructor(url) { this.url = url; this.sent = []; this.readyState = 1; all.push(this); }
    send(m) { this.sent.push(JSON.parse(m)); }
    close() { this.readyState = 3; }
    open() { this.onopen && this.onopen(); }
    recv(m) { this.onmessage && this.onmessage({ data: JSON.stringify(m) }); }
  }
  WS.all = all;
  return WS;
}
const deps = WS => ({ WebSocket: WS, url: "https://srv.example" });

test("код комнаты и ссылка", () => {
  const K = game();
  for (let i = 0; i < 30; i++) assert.match(K.roomCode(), /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$/);
  assert.equal(K.roomFrom("?room=K7MQ"), "K7MQ");
  assert.equal(K.roomFrom("?room=k7mq"), null);
  assert.equal(K.roomLink("K7MQ", "https://site/g/index.html?day=2"), "https://site/g/index.html?room=K7MQ");
});

test("хозяин: комната, уровень уходит при подключении, старт после гостя — отсчёт", () => {
  const K = game(), WS = FakeWS();
  const h = K.netHost("Макс", deps(WS));
  assert.match(h.code, /^[A-Z2-9]{4}$/);
  const ws = WS.all[0];
  assert.equal(ws.url, "wss://srv.example/room?code=" + h.code + "&role=host");
  ws.open();
  assert.equal(ws.sent[0].type, "hello");
  assert.ok(ws.sent[0].lvl && Array.isArray(ws.sent[0].lvl.items), "уровень отправлен");
  ws.recv({ type: "joined", name: "ОЛЯ" });
  assert.equal(K.G.net.rival.name, "ОЛЯ");
  ws.recv({ type: "start", in: 3000 });
  assert.equal(K.G.s, "countdown");
  assert.ok(K.G.custom && K.G.custom.race && K.G.custom.race.net, "гонка с соперником по сети");
  assert.equal(JSON.stringify(K.G.custom.race.lvl), JSON.stringify(ws.sent[0].lvl), "та же река");   // объекты из VM — сравнение через JSON
  for (let i = 0; i < 180; i++) K.upd();
  assert.equal(K.G.s, "playing", "отсчёт кончился — поплыли");
  assert.doesNotThrow(() => K.rndr());
});

test("гость: получает уровень хозяина и его имя, плывёт ту же реку", () => {
  const K = game(), WS = FakeWS();
  K.netJoin("K7MQ", "Оля", deps(WS));
  const ws = WS.all[0];
  assert.equal(ws.url, "wss://srv.example/room?code=K7MQ&role=guest");
  ws.open();
  assert.deepEqual(ws.sent[0], { type: "hello", name: "Оля" });
  const lvl = K.raceLevel(77);
  ws.recv({ type: "lvl", lvl, name: "МАКС" });
  assert.equal(K.G.net.rival.name, "МАКС");
  ws.recv({ type: "start", in: 1000 });
  assert.deepEqual(K.G.custom.race.lvl, lvl);
});

test("в заезде: своё положение уходит сопернику, его лодка движется, финиш — кто быстрее", () => {
  const K = game(), WS = FakeWS();
  K.netJoin("K7MQ", "Оля", deps(WS));
  const ws = WS.all[0]; ws.open();
  ws.recv({ type: "lvl", lvl: K.raceLevel(5), name: "МАКС" });
  ws.recv({ type: "start", in: 100 });
  for (let i = 0; i < 10; i++) K.upd();                       // отсчёт
  ws.sent.length = 0;
  for (let i = 0; i < 60; i++) { K.G.inv = 1e9; K.upd(); }
  const pos = ws.sent.filter(m => m.type === "pos");
  assert.ok(pos.length >= 8 && pos.length <= 12, "10 раз в секунду: " + pos.length);
  ws.recv({ type: "pos", f: 60, wy: K.G.pwy + 250, t: 300 });
  for (let i = 0; i < 30; i++) K.upd();
  const show = K.G.custom.race.net.show;
  assert.ok(show && Math.abs(show.wy - (K.G.pwy + 250)) < 260 && show.t > 0.1, "лодка соперника подтянулась");
  assert.ok(K.raceGap() < 0, "соперник впереди");
  ws.recv({ type: "fin", frames: 99999 });                       // соперник уже доплыл — очень медленно
  let f = 0;
  while (K.G.s === "playing" && f++ < 20000) { K.G.inv = 1e9; K.upd(); }
  assert.ok(ws.sent.some(m => m.type === "fin" && m.frames === K.G.custom.race.end), "свой финиш отправлен");
  const res = K.raceResult();
  assert.equal(res.name, "МАКС"); assert.equal(res.ghost, 99999); assert.equal(res.win, true);
});

test("соперник ушёл или комнаты нет — сказано, игра не падает", () => {
  const K = game(), WS = FakeWS();
  K.netJoin("K7MQ", "Оля", deps(WS));
  const ws = WS.all[0]; ws.open();
  ws.recv({ type: "nohost" });
  assert.equal(K.G.net.state, "nohost");
  const K2 = game(), WS2 = FakeWS();
  K2.netJoin("K7MQ", "Оля", deps(WS2));
  const w2 = WS2.all[0]; w2.open();
  w2.recv({ type: "lvl", lvl: K2.raceLevel(5), name: "МАКС" });
  w2.recv({ type: "start", in: 100 });
  w2.recv({ type: "left" });
  assert.equal(K2.G.net.rival.left, true);
  for (let i = 0; i < 60; i++) K2.upd();
  assert.doesNotThrow(() => K2.rndr());
});
