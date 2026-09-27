// Девять разных финишей — у каждого дня своя стоянка по месту прибытия.
// Раньше было четыре сцены (лагерь, церковь, деревня, город), лагерь — на
// пяти днях одинаковый, и всё стояло одной колонкой вдоль воды, с
// наложениями (утки на рыбаке, костёр над головой сидящего).
import test from "node:test";
import assert from "node:assert/strict";
import { loadGame } from "./harness.mjs";

const WATER = new Set(["ducks", "heron", "fisher"]);   // живут у самой воды

function finish(K, d) {
  K.startDay(d); K.sceneAt("finish");
  return K.G.bev.filter(e => e.atCamp);
}

test("девять финишей, все разные по составу", () => {
  const { K } = loadGame();
  assert.equal(K.FINISHES.length, 9);
  const keys = K.FINISHES.map(f => f.near.map(r => r[0] + (r[3] != null ? "/" + r[3] : "")).sort().join(","));
  assert.equal(new Set(keys).size, 9, keys.join("\n"));
  for (const f of K.FINISHES) assert.ok(f.near.length <= 8, "на берегу причаливания не толпа: " + f.near.length);
});

test("финиш: всё встало, ничего не налезает, не уходит за край и в воду, не в одну колонку", () => {
  const { K } = loadGame();
  const bad = [];
  for (let d = 0; d < 9; d++) {
    const bev = finish(K, d), near = bev.filter(e => e.side === K.G.landSide);
    const want = K.FINISHES[d].near.length;
    if (near.length !== want) bad.push("день " + (d + 1) + ": встало " + near.length + " из " + want);
    const box = bev.map(e => [e, K.measureBev(e)]).filter(([, b]) => b);
    for (let i = 0; i < box.length; i++) for (let j = i + 1; j < box.length; j++)
      if (K.boxesOverlap(box[i][1], box[j][1], 0)) bad.push("день " + (d + 1) + ": " + box[i][0].type + " на " + box[j][0].type);
    for (const [e, b] of box) {
      if (WATER.has(e.type)) continue;
      const wy = (b.lo + b.hi) / 2, edg = K.centerAt(wy) + e.side * K.widthAt(wy) / 2;
      const land = e.side > 0 ? 420 - edg : edg;
      if (b.in0 < -2) bad.push("день " + (d + 1) + ": " + e.type + " в воде (" + Math.round(b.in0) + ")");
      if (b.in1 > land + 2) bad.push("день " + (d + 1) + ": " + e.type + " за краем экрана (" + Math.round(b.in1) + " > " + Math.round(land) + ")");
    }
    const mids = box.filter(([e]) => e.side === K.G.landSide && !WATER.has(e.type)).map(([, b]) => (b.in0 + b.in1) / 2);
    if (Math.max(...mids) - Math.min(...mids) < 50) bad.push("день " + (d + 1) + ": всё в одну колонку");
  }
  assert.deepEqual(bad, []);
});

test("у костра турист сидит за огнём, а не под ним", () => {
  const { K, ctx } = loadGame();
  const calls = [];
  ctx.drawImage = (img, x, y) => calls.push({ img, y });
  K.G.scroll = 1000; K.G.rWidth = 1; K.G.rBend = 1; K.G.frame = 10;
  K.G.segs = [{ type: "calm", start: 0, end: 1e9 }];
  K.drwBev({ type: "fire", side: 1, wy: 1000, off: 40, phase: 1, mode: "sit" });
  const fire = calls.findIndex(c => c.img === K.SPR.fire.img), sit = calls.findIndex(c => c.img === K.SPR.sitter.img);
  assert.ok(fire >= 0 && sit >= 0, "нарисованы костёр и турист");
  assert.ok(sit < fire, "турист рисуется раньше — огонь перед ним");
  assert.ok(calls[sit].y < calls[fire].y, "турист выше по кадру — за костром");
});

// Звери не стоят рядом с людьми: на стоянке финиша их нет. Смотровую
// вышку Максим попросил убрать с берегов совсем.
test("на финише нет зверей, вышки нет нигде", () => {
  const { K } = loadGame();
  const beasts = ["ducks", "heron", "cows", "moose", "bear"];
  K.FINISHES.forEach((f, d) => {
    for (const r of f.near.concat(f.opp))
      assert.ok(!beasts.includes(r[0]), "день " + (d + 1) + ": зверь " + r[0] + " у стоянки");
    assert.ok(!f.near.concat(f.opp).some(r => r[0] === "tower"), "день " + (d + 1) + ": вышка");
  });
  K.BEV_POOLS.forEach((p, r) => assert.ok(!p.includes("tower"), "река " + r + ": вышка"));
  assert.ok(!K.SPR.tower, "спрайт вышки убран");
});
