// Вдвоём на одном экране (десктоп, 05.10.2026): страница ?split=1 ставит
// рядом две копии игры (?seat=1 и ?seat=2). Связь — тем же протоколом, что
// гонка по сети, только «комната» — сама страница (splitRoom). Геймпады и
// клавиатуру читает страница: первый геймпад / WASD+пробел — левой половине,
// второй / стрелки+Enter — правой. Start на любом — пауза у обоих.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadGame } from "./harness.mjs";

const wait = ms => new Promise(r => setTimeout(r, ms));

test("комната страницы: уровень от хозяина гостю, общий старт, пересылка ходов", () => {
  const { K } = loadGame();
  const out = [];
  const room = K.splitRoom((seat, m) => out.push([seat, m]));
  room(2, { type: "hello", name: "ОЛЯ" });
  assert.equal(out.length, 0, "гость раньше хозяина — ждёт");
  const lvl = { river: 1, lenIdx: 0, items: [] };
  room(1, { type: "hello", name: "МАКС", lvl });
  const lvlMsg = out.find(([s, m]) => s === 2 && m.type === "lvl");
  assert.ok(lvlMsg && lvlMsg[1].name === "МАКС" && lvlMsg[1].lvl.river === 1);
  assert.ok(out.some(([s, m]) => s === 1 && m.type === "joined" && m.name === "ОЛЯ"));
  assert.equal(out.filter(([, m]) => m.type === "start").length, 2, "старт обоим");
  out.length = 0;
  for (const m of [{ type: "pos", f: 1, wy: 2, t: 3 }, { type: "hit" }, { type: "trap", wy: 5, t: 6 }, { type: "fin", frames: 9 }]) room(1, m);
  assert.deepEqual(out.map(([s, m]) => s + ":" + m.type), ["2:pos", "2:hit", "2:trap", "2:fin"]);
  out.length = 0;
  room(2, { type: "hit" }); room(2, { type: "evil" });
  assert.deepEqual(out.map(([s, m]) => s + ":" + m.type), ["1:hit"]);
});

test("клавиатура как геймпад: WASD+пробел — левому, стрелки+Enter — правому", () => {
  const { K } = loadGame();
  const p1 = K.gpRead(K.splitKeyPad(new Set(["KeyA", "KeyW", "Space"]), 1));
  assert.equal(p1.steer, -1); assert.ok(p1.fwd); assert.ok(p1.btn[1], "удар");
  const p2 = K.gpRead(K.splitKeyPad(new Set(["ArrowRight", "ArrowDown", "Enter"]), 2));
  assert.equal(p2.steer, 1); assert.ok(p2.back); assert.ok(p2.btn[1]);
  assert.equal(K.gpRead(K.splitKeyPad(new Set(["ArrowLeft"]), 1)).steer, 0, "стрелки — не левому");
  const real = { axes: [0.9, 0], buttons: Array.from({ length: 16 }, (_, i) => ({ pressed: i === 9 })) };
  const m = K.splitMerge(real, K.splitKeyPad(new Set(["Space"]), 1));
  const r = K.gpRead(m);
  assert.ok(r.steer > 0.5 && r.btn[1] && r.btn[9], "геймпад и клавиши вместе");
  assert.ok(!K.gpRead(K.splitStrip(m)).btn[9], "Start страница забирает себе — пауза обоим");
});

test("половина экрана читает геймпад, присланный страницей", () => {
  const { K } = loadGame();
  K.resetSave(); K.setAudio(null);
  K.startRace(K.splitLevel("volga"));
  K.G.s = "playing";
  K.setExtPad({ axes: [-1, 0], buttons: [] });
  K.pollGamepad();
  assert.equal(K.gpState.steer, -1, "руль от присланного геймпада");
  K.setExtPad(null);
  K.pollGamepad();
  assert.equal(K.gpState.steer, 0);
});

test("трассы: четыре регатных и случайная", () => {
  const { K } = loadGame();
  assert.equal(JSON.stringify(K.splitLevel("medv")), JSON.stringify(K.regattaLevel(K.REGATTA_TRACKS[1])));
  assert.equal(JSON.stringify(K.splitLevel("rnd", 4242)), JSON.stringify(K.raceLevel(4242)));
  assert.equal(K.SPLIT_TRACKS.length, 5);
  const p = K.seatParams("?seat=2&track=osuga&seed=7");
  assert.equal(p.seat, 2); assert.equal(p.track, "osuga"); assert.equal(p.seed, 7);
  assert.equal(K.seatParams("?day=3"), null);
});

test("две копии игры через комнату страницы: старт вместе, видят друг друга, удар и коряга доходят", async () => {
  const A = loadGame().K, B = loadGame().K;
  for (const K of [A, B]) { K.resetSave(); K.setAudio(null); }
  const inbox = { 1: [], 2: [] };
  const room = A.splitRoom((seat, m) => (seat === 1 ? A : B).seatDeliver(m));
  A.setSeatLink({ post: m => room(1, m) });
  B.setSeatLink({ post: m => room(2, m) });
  A.seatStart({ seat: 1, track: "volga", name: "МАКС" });
  B.seatStart({ seat: 2, name: "ОЛЯ" });
  await wait(30);
  assert.equal(A.G.s, "countdown"); assert.equal(B.G.s, "countdown");
  assert.equal(JSON.stringify(B.G.custom.race.lvl), JSON.stringify(A.G.custom.race.lvl), "одна трасса");
  for (let i = 0; i < 400; i++) for (const K of [A, B]) { K.G.inv = 1e9; K.upd(); }
  assert.ok(A.G.custom.race.net.show && B.G.custom.race.net.show, "видят друг друга");
  assert.ok(Math.abs(A.G.custom.race.net.show.wy - B.G.pwy) < 80, "лодка друга там, где он есть");
  B.G.raceFlipT = 0; B.G.raceHits = 0;
  A.netSend({ type: "hit" }); A.netSend({ type: "hit" });
  assert.ok(B.G.raceFlipT > 0, "удар дошёл — перевернулся");
  A.G.traps = 1; A.dropTrap();
  assert.ok(B.G.custom.race.traps.some(t => t.owner === "net"), "коряга дошла");
  void inbox;
});

test("в меню гонки — кнопка «вдвоём на одном экране» (только десктоп)", () => {
  const src = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  assert.match(src, /id="rsSplit"[^>]*>ВДВОЁМ НА ОДНОМ ЭКРАНЕ</);
  const { K } = loadGame();
  assert.equal(K.splitAllowed({ innerWidth: 1600, touch: false }), true);
  assert.equal(K.splitAllowed({ innerWidth: 400, touch: true }), false);
});

test("пауза — общим состоянием: «да» ставит, «нет» снимает, повтор ничего не ломает", () => {
  const { K } = loadGame();
  K.resetSave(); K.setAudio(null);
  K.startRace(K.splitLevel("volga")); K.G.s = "playing";
  K.seatPause(true); assert.equal(K.G.s, "paused");
  K.seatPause(true); assert.equal(K.G.s, "paused", "повтор не снимает");
  K.seatPause(false); assert.equal(K.G.s, "playing");
  K.seatPause(false); assert.equal(K.G.s, "playing");
});

test("авария в гонке на одном экране: «продолжить» само через полторы секунды", () => {
  const { K } = loadGame();
  K.resetSave(); K.setAudio(null);
  K.startRace(K.splitLevel("volga")); K.G.s = "playing";
  K.setExtPad(null);
  K.G.s = "continue"; K.G.contT = 600;
  K.seatAutoContinue(); assert.equal(K.G.s, "continue", "сразу — нет");
  K.G.contT = 500; K.seatAutoContinue();
  assert.notEqual(K.G.s, "continue", "через 1,5 с — плывёт дальше");
});
