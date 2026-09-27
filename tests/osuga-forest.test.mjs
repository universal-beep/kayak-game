// Осуга — лесная река: деревьев заметно больше, чем на других, и местами
// глухой лес — ёлки в несколько рядов вглубь берега.
import test from "node:test";
import assert from "node:assert/strict";
import { loadGame } from "./harness.mjs";

function treesPerScreen(dayIdx) {
  const { K, ctx } = loadGame();
  K.startDay(dayIdx);
  const firs = [K.SPR.sfir.img, K.SPR.sbirch.img];
  let n = 0; const per = [];
  ctx.drawImage = (img) => { if (firs.includes(img)) n++; };
  for (let s = 2000; s < 26000; s += 800) {
    K.G.scroll = s; K.G.pwy = s + 300; n = 0; K.drwBg(); per.push(n);
  }
  return per;
}

test("на Осуге лес гуще, чем на Медведице, и есть участки глухого леса", () => {
  const osuga = treesPerScreen(6), medv = treesPerScreen(2);
  const sum = a => a.reduce((x, y) => x + y, 0);
  assert.ok(sum(osuga) >= 1.8 * sum(medv), "Осуга " + sum(osuga) + " против Медведицы " + sum(medv));
  assert.ok(Math.max(...osuga) >= 2 * Math.max(...medv), "глухой лес: на экране " + Math.max(...osuga) + " деревьев");
  assert.ok(Math.min(...osuga) < Math.max(...osuga) / 2, "не везде глухо — есть и светлые места");
});
