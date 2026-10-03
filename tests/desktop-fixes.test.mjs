// Замечания Максима 03.10.2026 по десктопу: пара к палатке шла слишком быстро;
// на десктопе пропала полоска пути; церкви в лесу — только финиш Волги дня 2;
// цапля пропадала посередине; в меню регаты не вернуться с итога.
import test from "node:test";
import assert from "node:assert/strict";
import { loadGame, setupWorld } from "./harness.mjs";

const X0 = -560, X1 = 980;
function world(day) {
  const { K } = loadGame();
  K.resetSave(); K.setAudio(null);
  K.startDay(day); setupWorld(K, { wy: 3000 });
  K.G.s = "playing";
  return K;
}
function recorder() {
  const rec = { fills: [], images: [] };
  const grad = () => ({ addColorStop() {} });
  return Object.assign(rec, {
    canvas: { width: 1600, height: 900 }, createLinearGradient: grad, createRadialGradient: grad,
    save() {}, restore() {}, clearRect() {}, strokeRect() {}, fillText() {}, measureText: () => ({ width: 10 }),
    beginPath() {}, arc() {}, ellipse() {}, moveTo() {}, lineTo() {}, closePath() {}, quadraticCurveTo() {},
    fill() {}, stroke() {}, scale() {}, translate() {}, rotate() {}, setTransform() {}, clip() {}, rect() {},
    fillRect(x, y, w, h) { rec.fills.push({ x, y, w, h, style: rec.fillStyle }); },
    drawImage(img, x, y, w, h) { rec.images.push({ x, y, w: w || img.width, h: h || img.height }); },
    fillStyle: "", strokeStyle: "", globalAlpha: 1, lineWidth: 1, font: "", imageSmoothingEnabled: false, textAlign: "left"
  });
}

test("пара к палатке идёт шагом — и на телефоне, и на десктопе", () => {
  const K = world(0);
  for (const [x0, x1] of [[0, K.W], [X0, X1]]) {
    const e = { type: "camp", side: -1, wy: K.G.pwy + 300, phase: 0 };
    let sp = null;
    K.withView(x0, x1, () => { sp = K.campWalkSpeed(e); });
    assert.ok(sp > 0.1 && sp <= 0.3, "скорость " + sp.toFixed(2) + " px/кадр");
  }
});

test("полоска пути есть и на десктопе — у края окна", () => {
  const K = world(0);
  K.G.dist = 200;
  const strip = rec => rec.fills.find(f => f.w === 4 && f.h === K.H - 200);
  const ph = recorder(); K.rndrWide(ph, 0, K.W);
  assert.ok(strip(ph) && strip(ph).x === K.W - 6, "на телефоне — у края экрана");
  const wd = recorder(); K.rndrWide(wd, X0, X1);
  assert.ok(strip(wd) && strip(wd).x > K.W + 100, "на десктопе — у края окна: " + (strip(wd) && strip(wd).x));
});

test("церкви — только на финише Волги дня 2", () => {
  const K = world(0);
  for (let d = 0; d < 9; d++) {
    K.G.day = d;
    assert.ok(!K.deepDecor().includes("church"), "декор боков, день " + (d + 1));
  }
  for (const set of K.FAR_SCENES) for (const sc of set) assert.ok(!sc.parts.some(p => p.spr === "church"), "сцена " + sc.name);
  K.FINISHES.forEach((fin, d) => {
    const has = fin.near.some(r => r[0] === "church");
    assert.equal(has, d === 1, "финиш дня " + (d + 1));
  });
  assert.equal(K.VILLAGE_CHURCH, false, "в деревнях без церквей");
});

test("улетающая цапля видна, пока на экране, хотя её место уже ушло вниз", () => {
  const K = world(2);
  const e = { type: "heron", side: 1, wy: K.G.pwy - 600, phase: 0, hops: 99, away: 1, fl: 400 };
  K.G.bev = [e];
  const p = K.flightPos(e);
  assert.ok(K.screenYOf(e.wy) > K.H + 160 && p.y > 0 && p.y < K.H, "место за низом, птица в кадре: " + Math.round(p.y));
  let drawn = 0;
  K.withView(X0, X1, () => { const rec = recorder(); K.rndrWide(rec, X0, X1); drawn = rec.images.filter(im => Math.abs(im.x + im.w/2 - p.x) < 30 && Math.abs(im.y + im.h/2 - p.y) < 30).length; });
  assert.ok(drawn > 0, "птица нарисована");
  K.upd();
  assert.ok(K.G.bev.includes(e), "не удалена, пока летит в кадре");
});

test("из итога регаты — назад к трассам; из трасс — назад в меню гонок", () => {
  const K = world(0);
  assert.equal(typeof K.toRegattaMenu, "function");
  K.toRegattaMenu();
  assert.equal(K.G.s, "raceMenu");
});
