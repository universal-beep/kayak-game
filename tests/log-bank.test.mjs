// Бревно у берега: снос на изгибах, упор в кромку воды, торможение по углу касания.
import test from "node:test";
import assert from "node:assert/strict";
import { loadGame, setupWorld } from "./harness.mjs";

const FLOW = 1.2;   // px/кадр по течению — типичная скорость бревна

function fresh() {
  const { K } = loadGame();
  setupWorld(K, { wy: 1000 });
  K.G.rBend = 1;
  return K;
}
function log(K, t, wy, vt = 0) {
  return { type: "log", t, wy, vt, size: 48, visHalf: K.spriteSize("log").w / 2 };
}
// Край спрайта бревна со стороны берега, в пикселях от оси русла.
const edgePx = (K, o) => Math.abs(o.t) * K.widthAt(o.wy) / 2 + o.visHalf;

// Участок, где русло 150 px подряд изгибается в одну сторону.
function bendAt(K) {
  for (let w = 400; w < 20000; w += 10) {
    const s = Math.sign(K.curvBend(w));
    let ok = Math.abs(K.curvBend(w)) > 1;
    for (let d = 0; ok && d <= 150; d += 10) ok = Math.sign(K.curvBend(w + d)) === s;
    if (ok) return { w, s };
  }
  throw new Error("нет участка с устойчивым изгибом");
}

test("бревно на изгибе сносит к внешнему берегу, как байдарку", () => {
  const K = fresh();
  const { w, s } = bendAt(K);
  const o = log(K, 0, w);
  for (let i = 0; i < 120; i++) K.logStep(o, FLOW);
  // curvBend > 0 — ось выгибается вправо, уносит влево (t уменьшается).
  assert.ok(-s * o.t > 0.02, "бревно не сместилось к внешнему берегу: t=" + o.t.toFixed(3));
});

test("бревно не заезжает на песок: край спрайта не дальше кромки воды", () => {
  const K = fresh();
  const o = log(K, 0.3, 1000, 0.03);          // сильно гребёт к правому берегу
  let worst = -1e9;
  for (let i = 0; i < 200; i++) {
    K.logStep(o, FLOW);
    worst = Math.max(worst, edgePx(K, o) - K.widthAt(o.wy) / 2);
  }
  assert.ok(worst <= 0.5, "бревно заехало на берег на " + worst.toFixed(1) + " px");
});

test("удар в лоб тормозит бревно сильнее, чем касание вскользь", () => {
  const K = fresh();
  const hw = K.widthAt(1000) / 2;
  const nearBank = 1 - (K.spriteSize("log").w / 2 + 1) / hw;   // в 1 px от кромки
  const steep = log(K, nearBank, 1000, 0.03);     // летит на берег
  const glance = log(K, nearBank, 1000, 0.002);   // почти параллельно берегу
  K.logStep(steep, FLOW);
  K.logStep(glance, FLOW);
  assert.ok(steep.vk < glance.vk, "в лоб vk=" + steep.vk + ", вскользь vk=" + glance.vk);
  assert.ok(steep.vk < 0.5, "удар в лоб должен почти остановить бревно, vk=" + steep.vk);
  assert.ok(glance.vk > 0.85, "касание вскользь — лёгкое торможение, vk=" + glance.vk);
});

test("пока бревно трётся о берег на изгибе, оно замедляется", () => {
  const K = fresh();
  const { w, s } = bendAt(K);
  const o = log(K, -s * 0.5, w, -s * 0.004);   // у внешнего берега, куда и сносит
  const moved = [];
  for (let i = 0; i < 80; i++) { const w0 = o.wy; K.logStep(o, FLOW); moved.push(o.wy - w0); }
  assert.ok(o.onBank, "бревно не прижато к внешнему берегу");
  assert.ok(o.vk < 0.6, "трение о песок не тормозит: vk=" + o.vk);
  assert.ok(moved[79] < moved[0] * 0.6, "бревно у берега плывёт почти так же быстро");
});

test("оторвавшись от берега, бревно разгоняется течением", () => {
  const K = fresh();
  const o = log(K, 0, 1000);
  o.vk = 0.2;
  for (let i = 0; i < 40; i++) { K.logStep(o, FLOW); assert.ok(!o.onBank, "бревно дошло до берега"); }
  assert.ok(o.vk > 0.5, "течение не разогнало бревно: vk=" + o.vk.toFixed(2));
});
