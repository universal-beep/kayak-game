// Медведь бродит по берегу целиком в кадре и целиком на суше — и на узком
// берегу лесной реки, и у развилки. Ходит в профиль: смотрит туда, куда идёт.
import test from "node:test";
import assert from "node:assert/strict";
import { loadGame, setupWorld } from "./harness.mjs";

test("медведь целиком в кадре и на суше на всех лесных днях", () => {
  const bad = [];
  let checked = 0;
  for (const day of [2, 3, 4, 6, 8]) {
    const { K, ctx } = loadGame();
    setupWorld(K, { wy: 3000 });
    K.G.day = day; const R = K.RIVERS[K.LEVELS[day].river]; K.G.rWidth = R.width; K.G.rBend = R.bend;
    K.G.segs = []; K.ensureSegments(60000); K.G.forks = []; K.ensureForks(60000);
    let box = null;
    ctx.drawImage = (img, x, y) => { box = [x, x + img.width]; };
    for (let wy = 4000; wy < 26000; wy += 1300) for (const side of [-1, 1]) {
      K.G.bev = [];
      const e = { type: "bear", side, wy, off: 40, phase: wy % 7, mode: "sit", variant: 0, shape: 0 };
      K.G.bev.push(e);
      K.G.scroll = wy - K.PY + 360;
      for (const f of [0, 130, 260, 390, 520]) {
        K.G.frame = f; box = null;
        K.drwBev(e);
        if (!box) continue;
        checked++;
        const edg = K.centerAt(wy) + side * K.widthAt(wy) / 2;
        if (box[0] < -1 || box[1] > 421) bad.push("день " + (day + 1) + ": за кадром " + box.map(Math.round));
        if (side < 0 ? box[1] > edg + 1 : box[0] < edg - 1) bad.push("день " + (day + 1) + ": лапы в воде");
      }
    }
  }
  assert.ok(checked > 400, "медведь почти не рисовался: " + checked);
  assert.deepEqual([...new Set(bad)].slice(0, 5), [], "всего: " + bad.length);
});

test("медведь анфас, как был, и переступает лапами на ходу", () => {
  const { K, ctx } = loadGame();
  setupWorld(K, { wy: 3000 });
  K.G.day = 2; K.G.rWidth = 0.7; K.G.bev = [];
  assert.equal(K.SPR.bear_l, undefined, "зеркальных кадров профиля больше нет");
  const e = { type: "bear", side: 1, wy: 5000, off: 40, phase: 0, mode: "sit", variant: 0, shape: 0 };
  K.G.bev.push(e); K.G.scroll = 5000 - K.PY + 360;
  const names = new Map([[K.SPR.bear.img, "bear"], [K.SPR.bear_b.img, "bear_b"]]);
  const seen = new Set(); let xs = new Set();
  ctx.drawImage = (img, x) => { seen.add(names.get(img)); xs.add(Math.round(x)); };
  for (let f = 0; f < 1100; f += 3) { K.G.frame = f; K.drwBev(e); }
  assert.ok(seen.has("bear") && seen.has("bear_b"), "лапы не переступают");
  assert.ok(xs.size > 10, "медведь не ходит");
});
