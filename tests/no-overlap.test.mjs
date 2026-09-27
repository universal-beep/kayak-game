// Объекты на берегу не налезают друг на друга: человек не стоит «на ёлке»,
// рюкзак не лежит на палатке. Отпечаток жителя меряется здесь НЕЗАВИСИМО от
// игры — записью того, что реально рисуется во всех кадрах анимации.
import test from "node:test";
import assert from "node:assert/strict";
import { loadGame, setupWorld } from "./harness.mjs";

function recorder(ctx) {
  let tx = 0, ty = 0; const st = []; let box = null;
  const add = (x, y, w, h) => {
    x += tx; y += ty;
    box = box || { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity };
    box.x0 = Math.min(box.x0, x, x + w); box.x1 = Math.max(box.x1, x, x + w);
    box.y0 = Math.min(box.y0, y, y + h); box.y1 = Math.max(box.y1, y, y + h);
  };
  Object.assign(ctx, {
    save() { st.push([tx, ty]); }, restore() { const s = st.pop(); if (s) [tx, ty] = s; },
    translate(x, y) { tx += x; ty += y; }, rotate() {}, scale() {},
    drawImage(img, x, y) { add(x, y, img.width, img.height); },
    fillRect(x, y, w, h) { add(x, y, w, h); },
    beginPath() {}, closePath() {}, moveTo() {}, lineTo() {}, fill() {}, stroke() {},
    arc() {}, ellipse() {}, quadraticCurveTo() {},
  });
  return { take() { const b = box; box = null; return b; } };
}

// Отпечаток жителя в мировых координатах: вглубь берега от кромки воды и по реке.
function footprint(K, rec, e) {
  const G = K.G, s0 = G.scroll, f0 = G.frame;
  G.scroll = e.wy - K.PY + 360;                    // житель посреди экрана
  for (const f of [0, 60, 150, 300, 450, 600, 750]) { G.frame = f; K.drwBev(e); }
  G.scroll = s0; G.frame = f0;
  const b = rec.take();
  if (!b) return null;
  const G2 = K.G; G2.scroll = e.wy - K.PY + 360;
  const edg = K.centerAt(e.wy) + e.side * K.widthAt(e.wy) / 2, by = K.screenYOf(e.wy);
  G2.scroll = s0;
  return {
    in0: e.side > 0 ? b.x0 - edg : edg - b.x1, in1: e.side > 0 ? b.x1 - edg : edg - b.x0,
    hi: e.wy + (by - b.y0), lo: e.wy - (b.y1 - by), type: e.type, side: e.side,
  };
}
const overlap = (a, b, m = 3) => a.side === b.side &&
  a.in0 < b.in1 - m && b.in0 < a.in1 - m && a.lo < b.hi - m && b.lo < a.hi - m;

function world() {
  const { K, ctx } = loadGame();
  setupWorld(K, { wy: 20000 });
  K.G.rBend = 1; K.G.bev = [];
  return { K, rec: recorder(ctx) };
}

test("лагерь прибытия на финише: актёры не налезают друг на друга", () => {
  const bad = [];
  for (let day = 0; day < 9; day++) {
    const { K, rec } = world();
    K.G.day = day; K.G.landSide = 1;
    const L = K.level();
    K.G.rWidth = K.RIVERS[L.river].width;
    K.spawnCamp(20400);
    const fp = K.G.bev.map(e => footprint(K, rec, e)).filter(Boolean);
    for (let i = 0; i < fp.length; i++) for (let j = i + 1; j < fp.length; j++)
      if (overlap(fp[i], fp[j])) bad.push("день " + (day + 1) + ": " + fp[i].type + " на " + fp[j].type);
  }
  assert.deepEqual([...new Set(bad)], [], "наложения в лагере");
});

test("декор берега не налезает на жителей — по их настоящему размеру", () => {
  const { K, ctx } = loadGame();
  const bad = [];
  for (const [type, variant] of [["camp", 0], ["guitar", 0], ["beach", 2], ["fisher", 0], ["bear", 0]]) {
    for (const side of [-1, 1]) for (const wy0 of [5000, 9000, 13000]) {
      setupWorld(K, { wy: wy0 - K.PY + 360 });
      K.G.rBend = 1; K.G.frame = 0;
      const e = { type, side, wy: wy0, off: 40, phase: 1, mode: "sit", variant, shape: 0 };
      K.G.bev = [e];
      const rec = recorder(ctx);
      const fp = footprint(K, rec, e);
      // Где встал декор (ёлки, берёзы, кусты) при этом жителе.
      const deco = [];
      const imgs = new Set([K.SPR.sfir.img, K.SPR.sbirch.img, K.SPR.sbush.img]);
      Object.assign(ctx, { drawImage(img, x, y) { if (imgs.has(img)) deco.push({ x, y, w: img.width, h: img.height }); } });
      K.G.scroll = wy0 - K.PY + 360;
      K.drwBg();
      for (const d of deco) {
        const foot = K.worldYOf(d.y + d.h);
        const edg = K.centerAt(foot) + side * K.widthAt(foot) / 2;
        const box = { side, in0: side > 0 ? d.x - edg : edg - (d.x + d.w), in1: side > 0 ? d.x + d.w - edg : edg - d.x,
                      lo: foot, hi: foot + d.h };
        if (box.in1 > 0 && overlap(fp, box)) bad.push(type + " (берег " + side + ")");
      }
    }
  }
  assert.deepEqual([...new Set(bad)], [], "декор на жителе");
});
