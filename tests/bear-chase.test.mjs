// День 8: медведь выходит из воды позади лодки и плывёт следом. Стоя на месте,
// от него не уйти; гребля вперёд рывками (на силы) уводит от него до конца погони.
import test from "node:test";
import assert from "node:assert/strict";
import { loadGame, setupWorld } from "./harness.mjs";

const STEP = 3.2;

function start(day = 7) {
  const { K } = loadGame();
  K.resetSave();
  K.G.day = day;
  K.sg();
  setupWorld(K, { wy: 5000 });
  K.G.s = "playing";
  return K;
}
// Один кадр движения без спавна: греби, если rowing; медведь шагает следом.
function frame(K, rowing) {
  const g = K.G;
  g.btnFwd = rowing;
  K.rowStep(STEP);
  K.tickStamina();
  g.scroll += STEP;
  g.frame++;
  K.bearStep(STEP);
}

test("погоня есть только на 8-м дне", () => {
  const K = start(7);
  assert.ok(K.LEVELS[7].bearChase);
  K.G.dist = K.LEVELS[7].len * 0.3;
  assert.ok(K.bearChaseDue(), "день 8 после 28% пути");
  K.G.dist = 10;
  assert.ok(!K.bearChaseDue(), "рано");
  for (const d of [0, 1, 2, 3, 4, 5, 6, 8]) {
    const k = start(d);
    k.G.dist = k.LEVELS[d].len * 0.5;
    assert.ok(!k.bearChaseDue(), "день " + (d + 1));
  }
});

test("стоя на месте, лодку догоняют и кусают", () => {
  const K = start();
  K.G.hp = 3; K.G.inv = 0;
  K.startBearChase(-1, true);
  let bitten = -1;
  for (let i = 0; i < K.BEAR_FRAMES && K.G.bc && bitten < 0; i++) {
    frame(K, false);
    if (K.G.hp < 3) bitten = i;
  }
  assert.ok(bitten > K.BEAR_GRACE, "укус не раньше, чем медведь поплыл: " + bitten);
  assert.ok(bitten < 360, "догнал меньше чем за 6 секунд: " + bitten);
  assert.equal(K.G.hp, 2);
});

test("рывками вперёд от медведя уходят: он отстаёт, очки идут", () => {
  const K = start();
  K.G.hp = 3; K.G.inv = 0;
  K.startBearChase(1, true);
  const before = K.G.bsc;
  let burst = true;
  for (let i = 0; i < K.BEAR_FRAMES + 260 && K.G.bc; i++) {
    // Рывок, пока есть силы, потом пауза, пока не накопятся.
    if (K.G.stam < 8) burst = false;
    if (K.G.stam > 55) burst = true;
    frame(K, burst);
  }
  assert.equal(K.G.hp, 3, "не догнал");
  assert.equal(K.G.bearsLost, 1, "отстал");
  assert.equal(K.G.bc, null, "медведь ушёл из кадра");
  assert.ok(K.G.bsc > before, "награда за побег");
});

test("медведь рисуется в кадре и за кадром без ошибок", () => {
  const K = start();
  K.startBearChase(-1, true);
  assert.doesNotThrow(() => K.drwBearSwim());          // за нижним краем: знак тревоги
  K.G.bc.d = 30; K.G.bc.wy = K.G.pwy - 30;
  assert.doesNotThrow(() => K.drwBearSwim());          // рядом с лодкой
  K.G.bc.state = "gone"; K.G.bc.fade = 10;
  assert.doesNotThrow(() => K.drwBearSwim());
  assert.doesNotThrow(() => K.rndr());
});

test("после переворота лодки погоня сброшена", () => {
  const K = start();
  K.startBearChase(1, true);
  K.loseAttempt();
  assert.equal(K.G.bc, null);
});

test("не догнал — вылезает на берег и машет лапой вслед, потом уходит", () => {
  const K = start();
  K.startBearChase(1, true);
  K.G.bc.age = K.BEAR_FRAMES;            // время вышло
  K.G.bc.d = 120;
  frame(K, false);
  const b = K.G.bc;
  assert.equal(b.state, "wave");
  assert.equal(K.G.bearsLost, 1);
  assert.ok(b.wy <= K.G.pwy - 60 && b.wy >= K.G.pwy - 75, "вылез сразу за кормой, где его видно");
  const t0 = b.t;
  for (let i = 0; i < 40; i++) frame(K, false);
  assert.ok(Math.abs(K.G.bc.t) > Math.abs(t0), "прижимается к берегу");
  assert.doesNotThrow(() => K.drwBearSwim());      // машет лапой — рисуется без ошибок
  for (let i = 0; i < 200; i++) frame(K, false);
  assert.equal(K.G.bc, null, "ушёл с экрана");
  assert.equal(K.G.hp, 3, "махавший медведь не кусает");
});

test("оторвался далеко — медведь бросает погоню сразу", () => {
  const K = start();
  K.startBearChase(-1, true);
  K.G.bc.d = K.BEAR_QUIT;
  K.G.rowing = 1; K.G.btnFwd = true;
  K.bearStep(STEP);
  assert.equal(K.G.bc.state, "wave");
});

test("медведь сначала гуляет по берегу, у лодки прыгает в воду, ныряет и выныривает позади", () => {
  const K = start();
  assert.ok(K.startBearChase(), "нашлось место на берегу");
  const bc = K.G.bc;
  assert.equal(bc.state, "walk");
  assert.ok(K.G.bev.includes(bc.ev) && bc.ev.type === "bear", "обычный житель берега, ходит по берегу");
  // Далеко впереди — просто гуляет, погони нет.
  bc.ev.wy = K.G.pwy + 600;
  for (let i = 0; i < 30; i++) frame(K, false);
  assert.equal(K.G.bc.state, "walk");
  assert.equal(K.G.hp, 3);
  // Лодка подплыла — прыгает: с берега пропал, под водой.
  K.G.bc.ev.wy = K.G.pwy + K.BEAR_JUMP - 1;
  frame(K, false);
  assert.equal(K.G.bc.state, "dive");
  assert.ok(bc.ev.dead, "с берега исчез");
  assert.doesNotThrow(() => K.drwBearSwim());
  // Нырнул — выныривает уже позади лодки, в погоне.
  for (let i = 0; i < K.BEAR_DIVE + 2 && K.G.bc.state === "dive"; i++) frame(K, false);
  assert.equal(K.G.bc.state, "swim");
  assert.ok(K.G.bc.wy < K.G.pwy, "позади лодки");
  assert.ok(K.G.bc.d > K.BEAR_BITE);
  assert.equal(K.G.hp, 3, "нырок не кусает");
});

test("бродит по берегу, пока лодка далеко: за кадром без погони не ныряет", () => {
  const K = start();
  K.startBearChase();
  K.G.bc.ev.wy = K.G.pwy + 5000;
  for (let i = 0; i < 60; i++) frame(K, false);
  assert.equal(K.G.bc.state, "walk");
  assert.equal(K.G.bcIdx, 1);
});
