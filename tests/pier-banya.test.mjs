// Мостки с привязанной лодкой (Волга, Тверца) и баня с дымком (Медведица,
// Осуга). Лодка у мостков — препятствие у своего берега: врезался — удар,
// лодка остаётся; виски и топор её не разбивают.
import test from "node:test";
import assert from "node:assert/strict";
import { loadGame, setupWorld } from "./harness.mjs";

test("мостки на Волге и Тверце, баня на Медведице и Осуге", () => {
  const { K } = loadGame();
  const P = K.BEV_POOLS;
  for (const r of [0, 2]) assert.ok(P[r].includes("pier"), "мостки, река " + r);
  for (const r of [1, 3]) assert.ok(P[r].includes("banya"), "баня, река " + r);
  for (const n of ["walkway", "rowboat", "banya"]) assert.ok(K.SPR[n] && K.SPR[n + "_l"], "нет " + n);
});

test("у мостков лодка у своего берега; врезался — удар, лодка остаётся; виски и топор не разбивают", () => {
  const { K } = loadGame();
  K.G.day = 4; const R = K.RIVERS[K.LEVELS[4].river];
  setupWorld(K, { wy: 1000, rWidth: R.width }); K.G.rBend = 0; K.G.s = "playing";
  let wy = 1300; while (K.pierKind({ wy }) === 1) wy += 9;   // вид с лодкой
  K.pierBoat({ type: "pier", side: 1, wy });
  const b = K.G.obs.find(o => o.tied);
  assert.ok(b, "лодка у мостков");
  assert.ok(b.t > 0.5, "у своего берега: " + b.t);
  b.t = 0; b.wy = K.G.pwy; K.G.t = 0; K.G.whiskyT = 100; K.G.inv = 0;
  K.chkCl();
  assert.ok(K.G.obs.includes(b), "под виски не разлетается");
  K.G.whiskyT = 0; K.G.hp = 3; K.G.sh = false; K.G.inv = 0;
  K.chkCl();
  assert.equal(K.G.hp, 2, "удар — минус сердце");
  assert.ok(K.G.obs.includes(b), "лодка на месте");
  b.wy = K.G.pwy + 200;
  K.apBn({ type: "axe", t: 0, wy: K.G.pwy });
  assert.ok(K.G.obs.includes(b), "топор не трогает");
});

test("мостки трёх видов: с лодкой, с купающимися, с человеком у края", () => {
  const { K } = loadGame();
  const kinds = new Set();
  for (let wy = 1000; wy < 40000; wy += 97) kinds.add(K.pierKind({ wy }));
  assert.deepEqual([...kinds].sort(), [0, 1, 2]);
});

// По картинке: купающиеся у мостков не наслаиваются, человек стоит ногами
// на настиле, а не над водой за его краем.
test("мостки: купающиеся не наслаиваются, человек стоит на настиле", () => {
  const { K, ctx } = loadGame();
  for (const side of [-1, 1]) for (const kind of [1, 2]) {
    let wy = 1000; while (K.pierKind({ wy }) !== kind) wy += 9;
    setupWorld(K, { wy: wy - K.PY + 360 }); K.G.rBend = 0; K.G.frame = 10;
    const calls = [];
    const orig = ctx.drawImage;
    ctx.drawImage = (img, x, y, w, h) => calls.push({ img, x, y, w: w || img.width, h: h || img.height });
    K.drwBev({ type: "pier", side, wy, phase: 0 });
    ctx.drawImage = orig;
    const deck = calls.find(c => c.img === K.SPR["walkway" + (side > 0 ? "_l" : "")].img);
    assert.ok(deck, "настил нарисован");
    if (kind === 1) {
      const sw = calls.filter(c => c.img === K.SPR.swimmer0.img || c.img === K.SPR.swimmer1.img);
      assert.equal(sw.length, 2, "двое купающихся");
      const [a, b] = sw;
      const ov = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 0 && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 0;
      assert.ok(!ov, "купающиеся наслаиваются, берег " + side);
    } else {
      const p = calls.find(c => c.img === (K.SPR.person.imgs ? K.SPR.person.imgs[2] : K.SPR.person.img) || c.img === K.SPR.person.img);
      assert.ok(p, "человек нарисован");
      const cxp = p.x + p.w/2, feet = p.y + p.h;
      assert.ok(cxp > deck.x + 6 && cxp < deck.x + deck.w - 6, "человек над настилом, берег " + side);
      assert.ok(feet >= deck.y + 3 && feet <= deck.y + 15, "ноги на досках: ноги " + Math.round(feet - deck.y) + " от верха настила");
    }
  }
});
