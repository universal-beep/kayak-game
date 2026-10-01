// Гонка с призраком в игре: широкая река из генератора конструктора, запись
// своего заезда, призрак друга плывёт по записи, итог — кто быстрее, ссылка
// ?race=КОД для вызова друга.
import test from "node:test";
import assert from "node:assert/strict";
import { loadGame } from "./harness.mjs";
import { validGhost } from "../server/race.mjs";

function game() {
  const { K } = loadGame();
  K.resetSave(); K.setAudio(null);
  return K;
}
function play(K, max = 20000) {
  let f = 0;
  while (K.G.s === "playing" && f++ < max) { K.G.inv = 1e9; K.upd(); }
  return f;
}

test("гоночный уровень: одно зерно — одна река, проход есть, уровень целиком в данных", () => {
  const K = game();
  const a = K.raceLevel(7), b = K.raceLevel(7), c = K.raceLevel(8);
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
  assert.equal(K.customBlockedRow(a.items, K.customRows(a.lenIdx)), -1);
  assert.deepEqual(Object.keys(a).sort(), ["items", "lenIdx", "river"]);
});

test("гонка: река широкая, случайных жителей берега нет, заезд пишется", () => {
  const K = game();
  const lvl = K.raceLevel(3);
  K.startRace(lvl);
  assert.ok(K.G.custom && K.G.custom.race, "режим гонки");
  const wy = K.itemWy({ r: 1 });
  const wide = K.widthAt(wy);
  K.G.custom.wide = false;
  const usual = K.widthAt(wy);
  K.G.custom.wide = true;
  assert.ok(wide > usual*1.3, "шире: " + Math.round(wide) + " против " + Math.round(usual));
  for (let i = 0; i < 120; i++) K.upd();
  const R = K.G.custom.race;
  assert.equal(R.track.length % 2, 0);
  assert.ok(R.track.length >= 2*Math.floor(120/K.GHOST_STEP) - 2, "след: " + R.track.length);
  assert.ok(R.track[R.track.length - 2] > R.track[0], "плывём вперёд");
});

test("финиш гонки: время до ленты, призрак с этим заездом проходит проверку сервера", () => {
  const K = game();
  const lvl = K.raceLevel(5);
  K.startRace(lvl);
  play(K);
  const R = K.G.custom.race;
  assert.ok(R.end > 0, "лента пересечена");
  const ghost = K.racePayload("Макс");
  assert.equal(ghost.frames, R.end);
  assert.deepEqual(ghost.lvl, lvl);
  assert.ok(validGhost(ghost), "сервер такой примет");
});

test("призрак: положение по кадру — между точками плавно, после финиша — на ленте", () => {
  const K = game();
  const ghost = { name: "МАКС", frames: 24, track: [100, 0, 160, 500, 220, 1000, 280, 1000, 340, 1000] };
  const p0 = K.ghostAt(ghost, 0), p3 = K.ghostAt(ghost, 3), p6 = K.ghostAt(ghost, 6), pEnd = K.ghostAt(ghost, 999);
  assert.equal(p0.wy, 100); assert.equal(p0.t, 0);
  assert.equal(p3.wy, 130); assert.equal(p3.t, 0.25);
  assert.equal(p6.wy, 160);
  assert.equal(pEnd.wy, 340); assert.ok(pEnd.done);
});

test("гонка с призраком: рисуется, отставание считается, итог — кто быстрее", () => {
  const K = game();
  const lvl = K.raceLevel(5);
  // призрак — заранее записанный свой же заезд
  K.startRace(lvl); play(K);
  const mine = K.racePayload("Я");
  const slow = Object.assign({}, mine, { name: "МЕДЛЕННЫЙ", frames: mine.frames + 300 });
  K.startRace(lvl, slow);
  for (let i = 0; i < 200; i++) K.upd();
  assert.doesNotThrow(() => K.rndr());
  assert.equal(typeof K.raceGap(), "number");
  play(K);
  const res = K.raceResult();
  assert.ok(res.win, "быстрее медленного призрака");
  assert.equal(res.ghost, slow.frames);
  assert.match(K.raceTime(3725), /^1:02\.0$/);
  const fast = Object.assign({}, mine, { name: "БЫСТРЫЙ", frames: 60 });
  K.startRace(lvl, fast); play(K);
  assert.equal(K.raceResult().win, false);
});

test("ссылка: код из адреса, отправка заезда на сервер", async () => {
  const K = game();
  assert.equal(K.raceIdFrom("?race=abc234"), "abc234");
  assert.equal(K.raceIdFrom("?race=../../x"), null);
  assert.equal(K.raceIdFrom(""), null);
  K.startRace(K.raceLevel(2)); play(K);
  let sent = null;
  const fetch = async (u, o) => { sent = { u, body: JSON.parse(o.body) }; return { ok: true, status: 200, json: async () => ({ id: "k7m2qa" }) }; };
  const id = await K.raceUpload("Макс", { fetch, url: "https://srv" });
  assert.equal(id, "k7m2qa");
  assert.equal(sent.u, "https://srv/ghost");
  assert.ok(validGhost(sent.body));
  assert.match(K.raceLink("k7m2qa", "https://site/game/index.html?x=1"), /^https:\/\/site\/game\/index\.html\?race=k7m2qa$/);
});

test("гонка не трогает рекорд своего уровня в редакторе и подписана «ГОНКА»", () => {
  const K = game();
  const cs = K.getCs(); cs.best = 123;
  K.startRace(K.raceLevel(9)); play(K);
  while (K.G.s === "arrive") K.upd();
  assert.equal(K.getCs().best, 123, "рекорд редактора прежний");
  K.startRace(K.raceLevel(9));
  assert.match(K.panelLeftHtml(), /ГОНКА/, "в заплыве гонки панель подписана");
});

test("ширина гонки одна для всех рек и умещается в кадр", () => {
  const K = game();
  const ws = [];
  for (let seed = 0; seed < 4; seed++) {                 // река = зерно % 4: все четыре
    K.startRace(K.raceLevel(seed));
    ws.push(Math.round(K.baseWidthAt(K.itemWy({ r: 1 }))));   // базовая: пороги реки сужают и в гонке
  }
  assert.equal(new Set(ws).size, 1, "одинаково: " + ws);
  assert.ok(ws[0] > 300 && ws[0] < K.W - 40, "широкая, но берега видны: " + ws[0]);
});
