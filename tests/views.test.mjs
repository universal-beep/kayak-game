// Тесты двух версий игры — мобильной (видно только поле) и десктопной (видно
// всё окно, по бокам — продолжение берегов). Игра крутится по каждому дню,
// на каждом кадре записывается, какие спрайты где нарисованы. Проверяется:
//  • на берегу и по бокам ничего не возникает и не пропадает посреди экрана
//    (рядом с каждым спрайтом на соседнем кадре есть спрайт; цапля, пара у
//    палатки, велосипедисты, дальние сцены приходят и уходят за край);
//  • на телефоне ничего не рисуется за краем экрана;
//  • ошибок нет.
// Река не проверяется: там бонусы подбирают, препятствия разбиваются.
import test from "node:test";
import assert from "node:assert/strict";
import { runInContext } from "node:vm";
import { loadGame, setupWorld } from "./harness.mjs";

const PHONE = null, DESK = [-560, 980];
// Нарочно возникающее и тающее на месте: рыба выпрыгивает у рыбака, ноты над
// гитарой всплывают и тают («!» и дым рисуются не спрайтами).
const SPAWN_OK = /^(fish|note|catch)/;

function runDay(day, view, frames = 300, warm = 1200) {
  const { K, sandbox } = loadGame();
  runInContext("(function(){ let a = 4242; Math.random = function(){ a = (a*1103515245 + 12345) >>> 0; return a/4294967296; }; })()", sandbox);
  K.resetSave(); K.setAudio(null);
  K.startDay(day); setupWorld(K, { wy: 400 });
  const g = K.G; g.s = "playing"; g.bridgeCinema = true;
  const x0 = view ? view[0] : 0, x1 = view ? view[1] : K.W;
  let shot = null;
  sandbox.__wrapDS = orig => function (name, x, y, v) { if (shot) shot.push({ name, x, y }); return orig.apply(this, arguments); };
  runInContext("drawSprite = __wrapDS(drawSprite)", sandbox);
  const frames_ = [], errors = [];
  // Разгон без отрисовки: к началу записи на берегах уже есть жители.
  for (let f = 0; f < warm && g.s === "playing"; f++) { g.inv = 1e9; try { K.upd(); } catch (e) { errors.push("upd: " + e.message); break; } }
  for (let f = 0; f < frames && g.s === "playing"; f++) {
    g.inv = 1e9;
    try { K.upd(); } catch (e) { errors.push("upd: " + e.message); break; }
    shot = [];
    try { K.withView(x0, x1, () => K.rndr()); } catch (e) { errors.push("rndr: " + e.message); break; }
    // на суше: центр вне русла (с запасом)
    frames_.push(shot.filter(s => {
      const wy = K.worldYOf(s.y), c = K.centerAt(wy), hw = K.widthAt(wy)/2;
      return s.x < c - hw - 12 || s.x > c + hw + 12;
    }));
    shot = null;
  }
  return { K, frames: frames_, errors, x0, x1 };
}
// Возникло или пропало внутри экрана (не у краёв).
function pops(r) {
  const { K, frames, x0, x1 } = r, out = [];
  const inner = s => s.x > x0 + 50 && s.x < x1 - 50 && s.y > 70 && s.y < K.H - 70;
  const near = (s, list) => list.some(q => Math.abs(q.x - s.x) < 24 && Math.abs(q.y - s.y) < 24);
  for (let f = 1; f < frames.length; f++) {
    for (const s of frames[f - 1]) if (inner(s) && !SPAWN_OK.test(s.name) && !near(s, frames[f])) out.push("кадр " + f + ": пропал " + s.name + " (" + Math.round(s.x) + "," + Math.round(s.y) + ")");
    for (const s of frames[f]) if (inner(s) && !SPAWN_OK.test(s.name) && !near(s, frames[f - 1])) out.push("кадр " + f + ": возник " + s.name + " (" + Math.round(s.x) + "," + Math.round(s.y) + ")");
  }
  return out;
}

for (const day of [0, 1, 2, 3, 4, 5, 6, 7, 8]) {
  test("мобильная версия, день " + (day + 1) + ": без ошибок, ничего за краем, на берегу ничего не возникает из воздуха", () => {
    const r = runDay(day, PHONE);
    assert.deepEqual(r.errors, []);
    const outside = r.frames.flat().filter(s => s.x < -40 || s.x > r.K.W + 40);
    assert.equal(outside.length, 0, "за краем экрана: " + outside.slice(0, 3).map(s => s.name).join(", "));
    const p = pops(r);
    assert.equal(p.length, 0, p.slice(0, 5).join("; "));
  });
  test("десктопная версия, день " + (day + 1) + ": без ошибок, по бокам и на берегу ничего не возникает и не пропадает посреди окна", () => {
    const r = runDay(day, DESK);
    assert.deepEqual(r.errors, []);
    const p = pops(r);
    assert.equal(p.length, 0, p.slice(0, 5).join("; "));
  });
}
