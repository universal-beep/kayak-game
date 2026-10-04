// Слои: велодорога — по траве, самым нижним слоем (раньше перекрывала охотника,
// медведя, деревья); дальний декор не наваливается друг на друга кучей.
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
  let seq = 0;
  const rec = { fills: [], images: [] };
  const grad = () => ({ addColorStop() {} });
  return Object.assign(rec, {
    canvas: { width: 1600, height: 900 }, createLinearGradient: grad, createRadialGradient: grad,
    save() {}, restore() {}, clearRect() {}, strokeRect() {}, fillText() {}, measureText: () => ({ width: 10 }),
    beginPath() {}, arc() {}, ellipse() {}, moveTo() {}, lineTo() {}, closePath() {}, quadraticCurveTo() {},
    fill() {}, stroke() {}, scale() {}, translate() {}, rotate() {}, setTransform() {}, clip() {}, rect() {},
    fillRect(x, y, w, h) { rec.fills.push({ x, y, w, h, style: String(rec.fillStyle), seq: seq++ }); },
    drawImage(img, x, y, w, h) { rec.images.push({ x, y, w: w || img.width, h: h || img.height, seq: seq++ }); },
    fillStyle: "", strokeStyle: "", globalAlpha: 1, lineWidth: 1, font: "", imageSmoothingEnabled: false, textAlign: "left"
  });
}

test("велодорога рисуется раньше всех спрайтов — нижним слоем, по траве", () => {
  const K = world(2);
  const e = { type: "cyclists", side: -1, wy: K.G.pwy + 300, phase: 0, count: 3, f0: K.G.frame };
  K.G.bev = [e];
  const rec = recorder();
  K.rndrWide(rec, X0, X1);
  const road = rec.fills.filter(f => f.style === "#a08354");
  assert.ok(road.length > 10, "дорога нарисована");
  const lastRoad = Math.max(...road.map(f => f.seq));
  const before = rec.images.filter(im => im.seq < lastRoad);
  assert.equal(before.length, 0, "спрайтов под дорогой: " + before.length);
});

test("дальний декор не наваливается: заметных наложений нет", () => {
  for (const day of [2, 6]) {
    const K = world(day);
    K.G.bev = [];
    const items = [];
    for (let vwx = 301; vwx < 2400; vwx += 3) for (const side of [-1, 1]) items.push(...K.deepItems(vwx, side, X0, X1));
    assert.ok(items.length > 200, "декор есть: " + items.length);
    let bad = 0;
    for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
      const a = items[i], b = items[j];
      if (Math.abs(a.swy - b.swy) > 120 || Math.abs(a.x - b.x) > 80) continue;
      const ox = Math.min(a.x + a.w/2, b.x + b.w/2) - Math.max(a.x - a.w/2, b.x - b.w/2);
      const oy = Math.min(a.swy + a.h, b.swy + b.h) - Math.max(a.swy, b.swy);
      if (ox > 0.4*Math.min(a.w, b.w) && oy > 0.3*Math.min(a.h, b.h)) bad++;
    }
    assert.equal(bad, 0, "день " + (day + 1) + ": наложений " + bad);
  }
});

// Дальние сцены у верхнего края тают в дымке, как ближний декор: прозрачные
// выше fy=0.85 (y < 48), полностью видимые ниже fy=0.45 (y > 176).
test("дальние сцены вверху тают в дымке, внизу — в полную силу", async () => {
  const { runInContext } = await import("node:vm");
  const { K, ctx, sandbox } = loadGame();
  K.startDay(1); setupWorld(K, { wy: 3000 });
  const alphas = [];
  ctx.drawImage = function () { alphas.push(this.globalAlpha); };
  const at = y => { alphas.length = 0; sandbox.__pw = K.worldYOf(y);
    runInContext('farQueue = [{ spr: "fisher", x: -200, pw: __pw, oy: 0, v: 0 }]', sandbox);
    K.drwFarQueue(-560, 980); return alphas.length ? Math.min(...alphas) : 0; };
  assert.ok(at(500) > 0.99, "внизу видно целиком");
  const mid = at(110);
  assert.ok(mid > 0.05 && mid < 0.95, "в дымке полупрозрачно: " + mid);
  assert.equal(at(20), 0, "у самого верха не видно");
});
