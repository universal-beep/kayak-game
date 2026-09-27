// «Появление с опозданием»: ничто не должно возникать разом в кадре.
// Деревья выплывают из тумана постепенно, финишная лента и лагерь
// выставляются, пока они ещё выше верхней кромки экрана.
import test from "node:test";
import assert from "node:assert/strict";
import { loadGame, setupWorld } from "./harness.mjs";

// Декор кадра: [{img, x, y, a}] — где и с какой прозрачностью нарисован.
function decor(K, ctx) {
  const imgs = new Set([K.SPR.sfir.img, K.SPR.sbirch.img, K.SPR.sbush.img]);
  const out = [], orig = ctx.drawImage;
  ctx.drawImage = (img, x, y) => { if (imgs.has(img)) out.push({ img, x, y, a: ctx.globalAlpha }); };
  try { K.drwBg(); } finally { ctx.drawImage = orig; }
  return out;
}

// Баг: декор рисовался только ниже линии тумана (fy < 0.45, y > 176) и
// с полной непрозрачностью — дерево в 63 px выскакивало целиком, «росло».
test("деревья выплывают из тумана постепенно, а не выскакивают целиком", () => {
  const { K, ctx } = loadGame();
  let worst = 0;
  for (let s = 3000; s < 3400; s += 2) {
    setupWorld(K, { wy: s }); K.G.rBend = 1; K.G.bev = [];
    const prev = decor(K, ctx);
    setupWorld(K, { wy: s + 2 }); K.G.rBend = 1; K.G.bev = [];
    for (const d of decor(K, ctx)) {
      // Тот же объект кадром раньше был ровно на 2 px выше (камера уехала вперёд):
      // декор привязан к миру, поэтому ни дрожи по полосам, ни сдвига вбок.
      const was = prev.find(p => p.img === d.img && Math.abs(p.x - d.x) < 0.5 && Math.abs(p.y + 2 - d.y) < 0.5);
      const jump = d.a - (was ? was.a : 0);
      if (jump > worst) worst = jump;
    }
    // Обратное: дерево, верх которого ещё на экране, не пропадает у нижней кромки.
    const next = decor(K, ctx);
    for (const p of prev) {
      if (p.y + 2 >= 720) continue;                      // уже целиком ушло вниз
      const still = next.find(d => d.img === p.img && Math.abs(p.x - d.x) < 0.5 && Math.abs(p.y + 2 - d.y) < 0.5);
      assert.ok(still, "дерево пропало у нижней кромки, когда его верх был ещё на y=" + (p.y + 2).toFixed(0));
    }
  }
  assert.ok(worst < 0.1, "дерево появилось скачком непрозрачности на " + worst.toFixed(2));
});

// Баг: tapeWy = scroll + H - 120 ставил ленту на y=30 — В КАДР, и лагерь
// прибытия возникал в верхней части экрана разом, хотя комментарий обещал
// «за экран».
test("финишная лента и лагерь выставляются заранее, выше верхней кромки экрана", () => {
  for (let day = 0; day < 9; day++) {
    const { K } = loadGame();
    setupWorld(K, { wy: 20000 });
    K.G.day = day;
    const L = K.level();
    K.G.s = "playing"; K.G.tapeWy = -1; K.G.bev = [];
    K.G.dist = L.len - K.FIN_SPAWN_M + 1;                // в момент, когда игра выставляет лагерь
    K.G.pwy = K.G.scroll;
    K.upd();
    assert.ok(K.G.tapeWy > 0, "день " + (day + 1) + ": лента не выставлена за 45 м до конца");
    assert.ok(K.screenYOf(K.G.tapeWy) < -40, "день " + (day + 1) + ": лента видна сразу, y=" + K.screenYOf(K.G.tapeWy).toFixed(0));
    const camp = K.G.bev.filter(e => e.atCamp);
    assert.ok(camp.length > 0, "день " + (day + 1) + ": лагерь не выставлен");
    for (const e of camp)
      assert.ok(K.screenYOf(e.wy) < -60, "день " + (day + 1) + ": «" + e.type + "» возник в кадре, y=" + K.screenYOf(e.wy).toFixed(0));
  }
});

test("финиш на прежнем месте: лента в 150 px до конца дистанции", () => {
  const { K } = loadGame();
  setupWorld(K, { wy: 20000 });
  const L = K.level();
  K.G.s = "playing"; K.G.tapeWy = -1; K.G.bev = [];
  K.G.dist = L.len - 45; K.G.pwy = K.G.scroll;
  const scroll0 = K.G.scroll, dist0 = K.G.dist;
  K.upd();
  // Мир: 1 м = 25 px. Конец дистанции — scroll + (len − dist)·25; лента на 150 px раньше.
  const end = scroll0 + (L.len - dist0) * 25;
  assert.ok(Math.abs(K.G.tapeWy - (end - 150)) < 40, "лента не там: " + (K.G.tapeWy - end).toFixed(0) + " px от конца");
});
