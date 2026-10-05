// Влияние на ход гонки (05.10.2026): в гонках чаще топоры, «подлянки» —
// коряга за корму, мотор на 5 секунд. Боты тоже подбирают и пускают в ход
// всё это — друг против друга и против тебя. Карта гонки: на десктопе в
// панели, на телефоне — маленькая в углу.
import test from "node:test";
import assert from "node:assert/strict";
import { runInContext } from "node:vm";
import { loadGame } from "./harness.mjs";
import { RaceRoom } from "../server/race.mjs";

function game(seed = 77) {
  const { K, sandbox } = loadGame();
  runInContext("(function(){ let a = " + seed + "; Math.random = function(){ a = (a*1103515245 + 12345) >>> 0; return a/4294967296; }; })()", sandbox);
  K.resetSave(); K.setAudio(null);
  return { K, sandbox };
}
function regatta(K, i = 0) {
  K.startRegatta(K.REGATTA_TRACKS[i]);
  let f = 0;
  while (K.G.s !== "playing" && f++ < 400) K.upd();
  return K.G.custom.race;
}
function step(K, n) { for (let i = 0; i < n && K.G.s === "playing"; i++) { K.G.inv = 1e9; K.upd(); } }
const RACE_TYPES = ["axe", "trap", "motor"];

test("в гонке на реке появляются топоры, подлянки и моторы — одни и те же у всех", () => {
  const seen = [];
  for (const seed of [1, 2]) {
    const { K } = game(seed);
    regatta(K);
    const got = new Map();
    for (let i = 0; i < 1500 && K.G.s === "playing"; i++) {
      for (const b of K.G.bns) if (RACE_TYPES.includes(b.type)) got.set(Math.round(b.wy), b.type + "@" + b.t.toFixed(3));
      K.G.inv = 1e9; K.upd();
    }
    seen.push(got);
  }
  const types = new Set([...seen[0].values()].map(v => v.split("@")[0]));
  for (const t of RACE_TYPES) assert.ok(types.has(t), "есть " + t);
  const common = [...seen[0].keys()].filter(k => seen[1].has(k));
  assert.ok(common.length >= 3, "общие места: " + common.length);
  for (const k of common) assert.equal(seen[0].get(k), seen[1].get(k), "тот же бонус на " + k);
});

test("мотор: 5 секунд лодка идёт в 1,6 раза быстрее", () => {
  const { K } = game();
  regatta(K);
  const base = K.raceRowMul();
  K.apBn({ type: "motor", t: 0, wy: K.G.pwy });
  assert.equal(K.G.motorT, 300);
  assert.ok(Math.abs(K.raceRowMul() / base - 1.6) < 0.01, "×" + (K.raceRowMul() / base));
  step(K, 301);
  assert.ok(!(K.G.motorT > 0), "кончился");
});

test("топор по лодке впереди переворачивает её", () => {
  const { K } = game();
  const R = regatta(K);
  const b = R.bots[0];
  for (const o of R.bots) if (o !== b) o.wy = K.G.pwy - 900;
  K.G.obs = [];
  b.wy = K.G.pwy + 180; b.t = K.G.t; b.vt = 0; b.goal = b.t;
  K.G.axes = 1;
  K.paddleStrike();
  assert.ok(K.G.axeFly, "топор летит");
  for (let i = 0; i < 60 && K.G.axeFly; i++) { b.t = K.G.t; K.G.inv = 1e9; K.upd(); }
  assert.ok(b.flipT > 0, "перевёрнут");
});

test("подлянка: кто-то сзади — коряга за корму; бот налетает и встаёт", () => {
  const { K } = game();
  const R = regatta(K);
  const b = R.bots[1];
  for (const o of R.bots) if (o !== b) o.wy = K.G.pwy - 900;
  b.wy = K.G.pwy - 120; b.t = K.G.t; b.goal = b.t; b.vt = 0; b.stunT = 0;
  K.G.traps = 1;
  K.paddleStrike();
  assert.equal(K.G.traps, 0);
  assert.equal(R.traps.length, 1, "коряга сброшена");
  assert.equal(R.traps[0].owner, "me");
  const tr = R.traps[0];
  let hit = false;
  for (let i = 0; i < 200 && !hit; i++) { b.t = tr.t; b.goal = tr.t; K.G.inv = 1e9; K.upd(); hit = b.stunT > 0 && !R.traps.includes(tr); }
  assert.ok(hit, "бот налетел, коряга ушла");
});

test("боты подбирают предметы и пускают в ход: топор в того, кто впереди, коряга — когда сзади", () => {
  const { K } = game();
  const R = regatta(K);
  const [a, c] = R.bots;
  for (const o of R.bots) if (o !== a && o !== c) o.wy = K.G.pwy - 2000;
  c.wy = K.G.pwy - 2000;
  a.axes = 1;
  let flipped = false;
  for (let i = 0; i < 120 && !flipped; i++) { a.wy = K.G.pwy - 160; a.t = K.G.t; K.G.inv = 1e9; K.upd(); flipped = K.G.raceFlipT > 0; }
  assert.ok(flipped, "игрок перевёрнут топором бота");
  K.G.raceFlipT = 0;
  c.traps = 1; c.wy = K.G.pwy + 600; c.t = 0.4; a.wy = c.wy - 150; a.t = 0.4; a.stunT = 0;
  let dropped = null;
  for (let i = 0; i < 40 && !dropped; i++) { K.G.inv = 1e9; K.upd(); dropped = R.traps.find(t => t.owner === c); }
  assert.ok(dropped, "бот сбросил корягу");
  let hit = false;
  for (let i = 0; i < 200 && !hit; i++) { a.t = dropped.t; a.goal = dropped.t; K.G.inv = 1e9; K.upd(); hit = !R.traps.includes(dropped); }
  assert.ok(hit && a.stunT > 0, "другой бот налетел");
});

test("бот не налетает на свою корягу; игрок на чужой — встаёт без потери сердца", () => {
  const { K } = game();
  const R = regatta(K);
  const b = R.bots[2];
  for (const o of R.bots) if (o !== b) o.wy = K.G.pwy - 2000;
  b.wy = K.G.pwy + 400;
  R.traps.push({ wy: b.wy + 20, t: b.t, owner: b, life: 999 });
  b.stunT = 0;
  K.G.inv = 1e9; K.upd();
  assert.equal(R.traps.length, 1, "своя не трогает");
  const hp = K.G.hp;
  R.traps.push({ wy: K.G.pwy + 10, t: K.G.t, owner: b, life: 999 });
  K.G.inv = 0; K.upd();
  assert.ok(K.G.raceStunT > 0, "игрок встал");
  assert.equal(K.G.hp, hp, "сердце цело");
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
test("вдвоём: коряга уходит другу и приходит от него; топор в друга — два удара", () => {
  const { K } = game();
  const WS = FakeWS();
  K.netJoin("K7MQ", "Оля", { WebSocket: WS, url: "https://srv" });
  const ws = WS.all[0]; ws.open();
  ws.recv({ type: "lvl", lvl: K.raceLevel(5), name: "МАКС" });
  ws.recv({ type: "start", in: 100 });
  for (let i = 0; i < 20; i++) K.upd();
  const R = K.G.custom.race;
  for (let i = 0; i < 30; i++) { ws.recv({ type: "pos", f: 10 + i, wy: Math.round(K.G.pwy - 150), t: Math.round(K.G.t*1000) }); K.G.inv = 1e9; K.upd(); }
  ws.sent.length = 0;
  K.G.traps = 1; K.paddleStrike();
  assert.ok(ws.sent.some(m => m.type === "trap"), "коряга отправлена");
  ws.recv({ type: "trap", wy: Math.round(K.G.pwy + 300), t: 0 });
  assert.ok(R.traps.some(t => t.owner === "net"), "коряга друга на реке");
  for (let i = 0; i < 30; i++) { ws.recv({ type: "pos", f: 50 + i, wy: Math.round(K.G.pwy + 180), t: Math.round(K.G.t*1000) }); K.G.inv = 1e9; K.upd(); }
  ws.sent.length = 0;
  K.G.axes = 1; K.paddleStrike();
  for (let i = 0; i < 60; i++) { ws.recv({ type: "pos", f: 90 + i, wy: Math.round(K.G.pwy + 180), t: Math.round(K.G.t*1000) }); K.G.inv = 1e9; K.upd(); }
  assert.equal(ws.sent.filter(m => m.type === "hit").length, 2, "два удара — переворот");
});

test("сервер пересылает корягу", async () => {
  const socks = [], store = new Map();
  const ws = role => { let att = { role, name: "X" }; return { sent: [], send(m) { this.sent.push(JSON.parse(m)); }, serializeAttachment(a) { att = a; }, deserializeAttachment() { return att; } }; };
  const ctx = { getWebSockets: () => socks.slice(), storage: { get: async k => store.get(k), put: async (k, v) => store.set(k, v) } };
  const room = new RaceRoom(ctx, {});
  const a = ws("host"), b = ws("guest"); socks.push(a, b);
  await room.webSocketMessage(a, JSON.stringify({ type: "trap", wy: 1200, t: -300 }));
  assert.deepEqual(b.sent, [{ type: "trap", wy: 1200, t: -300 }]);
});

test("карта гонки: все лодки по порядку от старта к финишу, ты отмечен", () => {
  const { K } = game();
  regatta(K);
  step(K, 400);
  const pts = K.raceMapPoints();
  assert.equal(pts.length, 8);
  assert.equal(pts.filter(p => p.me).length, 1);
  for (const p of pts) assert.ok(p.k >= 0 && p.k <= 1, p.name + " " + p.k);
  const st = K.regattaStandings().map(r => r.name);
  const byK = [...pts].sort((a, b) => b.k - a.k).map(p => p.name);
  assert.equal(JSON.stringify(byK.slice(0, 3)), JSON.stringify(st.slice(0, 3)), "лидеры совпадают");
  assert.match(K.panelRightHtml(), /id=.raceMap/, "на десктопе карта в панели");
  assert.ok(K.raceChaseText().length > 0, "строка «кто догоняет»");
});

test("с мотором на корме виден мотор, за лодкой — белая полоса пены; у бота тоже", () => {
  const { K, sandbox } = game();
  const R = regatta(K);
  const { ctx } = { ctx: runInContext("cx", sandbox) };
  const imgs = [], whites = [];
  const di = ctx.drawImage, fr = ctx.fillRect;
  ctx.drawImage = function (img) { imgs.push(img); };
  ctx.fillRect = function (x, y, w, h) { if (/^(#fff|rgba\(255,\s*255,\s*255)/i.test(String(this.fillStyle))) whites.push([x, y, w, h]); };
  K.G.motorT = 100;
  const b = R.bots[0]; b.motorT = 100; b.wy = K.G.pwy + 200;
  K.rndr();
  ctx.drawImage = di; ctx.fillRect = fr;
  assert.ok(imgs.filter(i => i === K.SPR.motor.img).length >= 2, "мотор на корме у игрока и бота");
  const behind = whites.filter(([x, y]) => y > K.G.py + 10 && y < K.G.py + 120 && Math.abs(x - K.screenXOf(K.G.t, K.G.pwy)) < 30);
  assert.ok(behind.length >= 6, "пена за кормой: " + behind.length);
});

test("карта гонки — только пока идёт гонка: после финиша её нет", () => {
  const { K } = game();
  const R = regatta(K);
  step(K, 50);
  assert.match(K.panelRightHtml(), /raceMap/);
  R.end = R.f;
  assert.doesNotMatch(K.panelRightHtml(), /raceMap/, "после финиша карты нет");
  assert.equal(K.raceMapOn(), false);
});
