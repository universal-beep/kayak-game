// Десктоп без «вставного куска посередине». Раньше поле (420 px) рисовалось
// на своём холсте со всеми слоями, а боковые зоны — отдельно, только фон и
// простая дымка: мосты и дороги обрывались на краю поля, туман по бокам был
// слабее, жители берега у кромки обрезались. Теперь на широком экране сцена
// рисуется одним проходом на всю ширину окна (rndrWide), и каждый слой
// доходит до краёв. На телефоне всё по-прежнему в пределах поля.
import test from "node:test";
import assert from "node:assert/strict";
import { loadGame, setupWorld } from "./harness.mjs";

// Холст-самописец: запоминает прямоугольники заливки и картинки.
function recorder() {
  const rec = { fills: [], images: [] };
  const grad = () => ({ addColorStop() {} });
  return Object.assign(rec, {
    canvas: { width: 1600, height: 900 },
    createLinearGradient: grad, createRadialGradient: grad,
    save() {}, restore() {}, clearRect() {}, strokeRect() {}, fillText() {}, measureText: () => ({ width: 10 }),
    beginPath() {}, arc() {}, ellipse() {}, moveTo() {}, lineTo() {}, closePath() {}, quadraticCurveTo() {},
    fill() {}, stroke() {}, scale() {}, translate() {}, rotate() {}, setTransform() {}, clip() {}, rect() {},
    fillRect(x, y, w, h) { rec.fills.push({ x, y, w, h, style: rec.fillStyle }); },
    drawImage(img, x, y, w, h) { rec.images.push({ x, y, w: w || img.width, h: h || img.height }); },
    fillStyle: "", strokeStyle: "", globalAlpha: 1, lineWidth: 1, font: "", imageSmoothingEnabled: false, textAlign: "left"
  });
}
const X0 = -560, X1 = 980;                     // ширина сцены 1540 игровых px (окно 1600 при поле 420)
const spans = (f, a, b) => f.x <= a + 1 && f.x + f.w >= b - 1;

function world(day) {
  const { K } = loadGame();
  K.resetSave(); K.setAudio(null);
  K.startDay(day); setupWorld(K, { wy: 3000 });
  K.G.s = "playing";
  return K;
}

test("дождь и дымка дождя — на всю ширину окна, на телефоне — по полю", () => {
  const K = world(4);                                    // день 5 — дождь
  const rec = recorder();
  K.rndrWide(rec, X0, X1);
  assert.ok(rec.fills.some(f => spans(f, X0, X1) && /20,32,48/.test(String(f.style))), "затемнение дождя от края до края");
  const ph = recorder();
  K.rndrWide(ph, 0, K.W);
  assert.ok(!ph.fills.some(f => f.x < -1 || f.x + f.w > K.W + 1 && /20,32,48/.test(String(f.style))), "на телефоне не шире поля");
});

test("туман: дымка и клубы по всей ширине, а не только над полем", () => {
  const K = world(7);                                    // день 8 — туман
  const rec = recorder();
  K.rndrWide(rec, X0, X1);
  assert.ok(rec.fills.some(f => spans(f, X0, X1) && f.y === 0), "дымка от края до края");
  const clumps = rec.fills.filter(f => f.w >= 100 && f.w <= 220 && f.w === f.h);
  assert.ok(clumps.some(f => f.x + f.w/2 < 0) && clumps.some(f => f.x + f.w/2 > K.W), "клубы и слева, и справа от поля");
});

test("мост: дорога и перила уходят до краёв окна, а не обрываются у поля", () => {
  const K = world(4);
  K.ensureBridges(K.G.scroll + 2000);
  const b = K.G.bridges_[0];
  assert.ok(b, "мост есть");
  K.G.scroll = b.wy - 300; K.G.pwy = K.G.scroll;           // мост в кадре
  const rec = recorder();
  K.rndrWide(rec, X0, X1);
  const road = rec.fills.filter(f => spans(f, X0, X1) && f.h >= 20 && f.h <= 40);
  assert.ok(road.length >= 1, "полотно дороги на всю ширину");
});

test("кромка берега в широком режиме видна и за краем поля", () => {
  const K = world(0);
  assert.equal(K.bankVisible(1, K.W + 40), false, "на телефоне правее поля — не видно");
  let wide = null;
  K.withView(X0, X1, () => { wide = K.bankVisible(1, K.W + 40); });
  assert.equal(wide, true, "на десктопе видно");
});

test("у моста по бокам ни деревьев, ни домов поверх дороги", () => {
  const K = world(4);
  K.ensureBridges(K.G.scroll + 2000);
  const b = K.G.bridges_[0];
  K.G.scroll = b.wy - 300; K.G.pwy = K.G.scroll;
  const rec = recorder();
  K.rndrWide(rec, X0, X1);
  const y = K.screenYOf(b.wy), top = y - 42, bot = y + 26;
  const side = rec.images.filter(im => (im.x + im.w < -10 || im.x > K.W + 10) && im.y < bot && im.y + im.h > top);
  assert.equal(side.length, 0, "по бокам на полосе дороги: " + side.length);
});

test("дальние сцены — только на десктопе и у каждой реки свои", () => {
  const K = world(0);
  const kinds = new Set();
  for (let r = 0; r < 4; r++) {
    const set = new Set();
    for (let slot = 0; slot < 4000; slot++) { const sc = K.farScene(slot, r); if (sc) set.add(sc.name); }
    assert.ok(set.size >= 2, "река " + r + ": сцен " + set.size);
    for (const n of set) kinds.add(r + ":" + n);
  }
  assert.ok(kinds.size >= 8, "всего разных сцен: " + kinds.size);
  // на телефоне (видимая ширина = поле) дальних сцен нет: они дальше 140 px от края поля
  for (let slot = 0; slot < 4000; slot++) {
    const sc = K.farScene(slot, 0);
    if (sc) for (const p of sc.parts) assert.ok(p.dx >= 140, "сцена у самого поля: " + sc.name);
  }
});

test("дальние сцены рисуются в широкой отрисовке и не рисуются на телефоне", () => {
  const K = world(2);
  let wideFar = 0, phoneFar = 0;
  for (let k = 0; k < 40; k++) {
    K.G.scroll += 300; K.G.pwy = K.G.scroll;
    const rec = recorder(); K.rndrWide(rec, X0, X1);
    wideFar += rec.images.filter(im => im.x + im.w < -140 || im.x > K.W + 140).length;
    const ph = recorder(); K.rndrWide(ph, 0, K.W);
    phoneFar += ph.images.filter(im => im.x + im.w < -140 || im.x > K.W + 140).length;
  }
  assert.ok(wideFar > 0, "на десктопе есть");
  assert.equal(phoneFar, 0, "на телефоне нет");
});

test("на полосе дороги велосипедистов по бокам нет деревьев и камней", () => {
  const K = world(2);
  const e = { type: "cyclists", side: -1, wy: K.G.pwy + 300, phase: 0, count: 2, f0: K.G.frame };
  K.G.bev = [e];
  // дорога в мире: x(w) = кромка + сдвиг; любая точка декора на ней — помеха
  for (let w = e.wy - 1500; w < e.wy + 1500; w += 40) {
    const rx = K.centerAt(w) - (K.widthAt(w)/2 + K.cycRoadOff(w - e.wy));
    assert.equal(K.onCycRoad(rx, w, 20), true, "середина дороги — занято");
    assert.equal(K.onCycRoad(rx - 200, w, 20), false, "в стороне — свободно");
  }
});
