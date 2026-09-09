// День 1 «Пляж»: СМЯГЧЁННАЯ песчаная отмель вдоль кромки (не прямоугольник,
// не коса в реку), плавно переходящая в траву. ТРИ варианта (e.variant),
// различающихся длиной отмели и набором отдыхающих, плюс КЛАССИЧЕСКИЙ:
//   0 — короткая отмель, ОДИН КРУПНЫЙ загорающий на коврике;
//   1 — средняя, двое КРУПНЫХ на ковриках + зонтик;
//   2 — длинная, двое КРУПНЫХ на ковриках;
//   3 — КЛАССИЧЕСКИЙ пляж (как на основном сайте): полотенца + зонтик +
//       отдыхающий + ДВОЕ ДЕТЕЙ В ВОДЕ по грудь (низ скрыт водой).
// Загорающие лежат БЕЗ одежды (силуэт: спина, руки вдоль тела, ноги, макушка
// волос) и КРУПНЫЕ — размером с человека. Волейбола нет. Всё — один составной
// берег ("beach").
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadGame, setupWorld } from "./harness.mjs";

const HAIR = ["#4a2e17", "#8a5a2b"];
const MATS = ["#ff5252", "#4fc3f7"];
const WATER_LINE = "rgba(21,101,192,0.5)";
const KID_HAIR = "#4a2e17";

// Длина отмели (мир. px) по варианту — для теста «3 длины».
const SPAN = { 0: 72, 1: 112, 2: 158 };
// Сколько загорающих на ковриках по варианту (классический — дети, не коврики).
const PEOPLE = { 0: 1, 1: 2, 2: 2 };

function recordingCtx(raw) {
  const calls = [];
  let path = [];
  raw.beginPath = () => { path = []; };
  raw.closePath = () => { if (path.length) path.push(path[0]); };
  raw.moveTo = (x, y) => { path.push([x, y]); };
  raw.lineTo = (x, y) => { path.push([x, y]); };
  raw.arc = (x, y, r) => { path.push([x - r, y - r], [x + r, y + r]); };
  raw.ellipse = (x, y, rx, ry) => { path.push([x - rx, y - ry], [x + rx, y + ry]); };
  raw.fill = function () {
    if (path.length) calls.push({ kind: "pathfill", color: raw.fillStyle, alpha: raw.globalAlpha, pts: path.slice() });
  };
  raw.fillRect = function (x, y, w, h) {
    calls.push({ kind: "rect", x, y, w, h, color: raw.fillStyle, alpha: raw.globalAlpha });
  };
  return calls;
}

const bbox = c => {
  const xs = c.pts.map(p => p[0]), ys = c.pts.map(p => p[1]);
  return {
    x0: Math.min(...xs), x1: Math.max(...xs),
    y0: Math.min(...ys), y1: Math.max(...ys),
    w: Math.max(...xs) - Math.min(...xs),
    h: Math.max(...ys) - Math.min(...ys),
  };
};
const girth = c => Math.abs(c.pts[0][0] - c.pts[1][0]); // диаметр дуги (две угловые точки)

function paintBeach(K, raw, side, variant) {
  setupWorld(K, { wy: 1000, t: 0 });
  K.G.frame = 50;
  K.G.rBend = 1;
  K.drwBev({ type: "beach", side, wy: 1000, off: 40, phase: 1.3, mode: "sit", variant });
}

test("beach есть в пуле берегов Волги (тип состава для дней 1-2)", () => {
  const { K } = loadGame();
  assert.ok(Array.isArray(K.BEV_POOLS), "BEV_POOLS должен экспортироваться");
  assert.ok(K.BEV_POOLS[0].includes("beach"), "Волга — людная река, на ней пляж");
  assert.ok(!K.BEV_POOLS[1].includes("beach"), "лесные Медведица/Тверца/Осуга — без пляжа");
});

test("beach рисует МЯГКУЮ отмель вдоль кромки: вытянута по y, тонка поперёк, без квадратных углов", () => {
  const { K, ctx } = loadGame();
  const calls = recordingCtx(ctx);
  paintBeach(K, ctx, -1, 1);
  // Тело песка — единственная отрисовка вытянутой полосой (pathfill с высотой ≥90).
  const body = calls.find(c => c.kind === "pathfill" && bbox(c).h >= 90);
  assert.ok(body, "нарисован песчаный берег (вытянутая отмель)");
  const sz = bbox(body);
  assert.ok(sz.w <= 58, "отмель тонка поперёк (не коса, не квадрат): w=" + sz.w);
  // Мокрая кромка у воды — отдельная узкая полоса вдоль берега.
  const wet = calls.filter(c => c.kind === "pathfill" && c.color === "#c8a860");
  assert.ok(wet.length === 1 && bbox(wet[0]).h >= 90, "мокрая кромка тянется вдоль берега");
});

test("beach: песок ПЛАВНО переходит в траву (зелёные пучки на стыке)", () => {
  const { K, ctx } = loadGame();
  const calls = recordingCtx(ctx);
  paintBeach(K, ctx, -1, 1);
  // Тело песка залито градиентом в жёлто-зелёный (объект fillStyle, не строка).
  const body = calls.find(c => c.kind === "pathfill" && typeof c.color === "object" && bbox(c).h >= 90);
  assert.ok(body, "тело песка залито градиентом песок-трава");
  const tufts = calls.filter(c => c.kind === "rect" && c.color === "#2f7434");
  assert.ok(tufts.length >= 6, "на стыке песок/трава вклиниваются зелёные пучки: " + tufts.length);
});

test("beach: 3 ВАРИАНТА длины отмели — длинная > средняя > короткая", () => {
  const { K, ctx } = loadGame();
  const hs = {};
  for (const v of [0, 1, 2]){
    const calls = recordingCtx(ctx);
    paintBeach(K, ctx, -1, v);
    const body = calls.find(c => c.kind === "pathfill" && typeof c.color === "object");
    assert.ok(body, "отмель нарисована (вариант " + v + ")");
    hs[v] = bbox(body).h;
  }
  assert.ok(hs[0] < hs[1] && hs[1] < hs[2], "длины упорядочены: " + JSON.stringify(hs));
  assert.ok(hs[0] < 100, "короткая отмель короткая: h=" + hs[0]);
  assert.ok(hs[2] > 150, "длинная отмель длинная: h=" + hs[2]);
  // Длина тела песка согласуется с мировой длиной отмели варианта (screenYOf — 1:1).
  assert.ok(Math.abs(hs[1] - (SPAN[1] + 8)) < 14, "средняя ≈ " + (SPAN[1] + 8) + ": " + hs[1]);
});

test("beach: на КРУПНЫХ ковриках лежат РОВНО N загорающих по варианту (без одежды, силуэтом)", () => {
  const { K, ctx } = loadGame();
  for (const v of [0, 1, 2]){
    const calls = recordingCtx(ctx);
    paintBeach(K, ctx, -1, v);
    // Загорающий = макушка волос (pathfill) + крупный коврик под ним (rect).
    const heads = calls.filter(c => c.kind === "pathfill" && HAIR.includes(c.color));
    const mats = calls.filter(c => c.kind === "rect" && MATS.includes(c.color));
    assert.equal(heads.length, PEOPLE[v], "вариант " + v + ": число загорающих = " + PEOPLE[v]);
    assert.equal(mats.length, PEOPLE[v], "вариант " + v + ": каждому загорающему — свой коврик");
    // ЛЮДИ КРУПНЫЕ: диаметр головы > 10px (загорающий размером с человека).
    for (const h of heads) assert.ok(girth(h) > 10, "голова загорающего крупная (диаметр " + girth(h) + ")");
    // Коврик широкий — под целого лежащего человека, не «обрывок».
    for (const m of mats) assert.ok(m.w >= 40, "коврик широкий (w=" + m.w + ")");
    // Лежат НА ПЕСКЕ / НА КОВРИКЕ: силуэт не выходит за кромку воды (для ЛЕВОГО
    // берега суша слева; голова у ИНЛАНД-конца, ноги к воде, но НЕ в воду).
    for (const h of heads){
      const b = bbox(h);
      const edg = K.centerAt(1000) - K.widthAt(1000) / 2;
      assert.ok(b.x1 <= edg + 1, "загорающий лежит на суше, не в воде: x1=" + b.x1.toFixed(1) + " edg=" + edg.toFixed(1));
    }
  }
});

test("beach: на вариантах-ковриках (0-2) ДЕТЕЙ В ВОДЕ НЕТ", () => {
  const { K, ctx } = loadGame();
  for (const v of [0, 1, 2]){
    const calls = recordingCtx(ctx);
    paintBeach(K, ctx, -1, v);
    const edg = K.centerAt(1000) - K.widthAt(1000) / 2;
    assert.ok(!calls.some(c => c.kind === "rect" && c.color === WATER_LINE),
      "вариант " + v + ": нет полупрозрачной воды по грудь");
    // Детская голова (дуга r4.5, тёмные волосы) В ВОДЕ не рисуется.
    const kids = calls.filter(c => c.kind === "pathfill" && c.color === KID_HAIR
      && Math.abs(girth(c) - 9) < 0.01 && bbox(c).x0 >= edg);
    assert.equal(kids.length, 0, "вариант " + v + ": детей в воде нет");
  }
});

test("beach: КЛАССИЧЕСКИЙ пляж (вариант 3) — полотенца, зонтик и ДВОЕ ДЕТЕЙ В ВОДЕ", () => {
  const { K, ctx } = loadGame();
  const calls = recordingCtx(ctx);
  paintBeach(K, ctx, -1, 3);
  const edg = K.centerAt(1000) - K.widthAt(1000) / 2;
  // Дети: головы (дуга r4.5) тёмные, В ВОДЕ (x за кромкой).
  const kids = calls.filter(c => c.kind === "pathfill" && c.color === KID_HAIR
    && Math.abs(girth(c) - 9) < 0.01 && bbox(c).x0 >= edg);
  assert.equal(kids.length, 2, "в классическом пляже двое детей в воде");
  // Низ каждого скрыт полупрозрачной водой — «наполовину видны».
  const water = calls.filter(c => c.kind === "rect" && c.color === WATER_LINE);
  assert.equal(water.length, 2, "у каждого ребёнка вода перекрывает низ");
  // Полотенца, зонтик.
  const TOWELS = ["#ff5252", "#4fc3f7", "#66bb6a", "#ab47bc"];
  const seen = new Set(calls.filter(c => TOWELS.includes(c.color)).map(c => c.color));
  assert.ok(seen.size >= 3, "на классическом пляже лежат полотенца: " + [...seen].join(","));
  assert.ok(calls.some(c => c.kind === "pathfill" && c.color === "#4fc3f7"), "зонтик на классическом пляже есть");
});

test("beach: коврики под загорающими, волейбола нет", () => {
  const { K, ctx } = loadGame();
  const calls = recordingCtx(ctx);
  paintBeach(K, ctx, -1, 1);
  const seen = new Set(calls.filter(c => MATS.includes(c.color)).map(c => c.color));
  assert.ok(seen.has(MATS[0]) && seen.has(MATS[1]), "под загорающими лежат коврики: " + [...seen].join(","));
  assert.ok(!calls.some(c => c.color === "#e57373"), "волейбольного мяча больше нет");
  assert.ok(!calls.some(c => c.color === "#5a4a2a"), "волейбольной сетки больше нет");
});

test("beach СТАТИЧЕН в МИРЕ: прокрутка камеры не шевелит край отмели", () => {
  const { K, ctx } = loadGame();
  const bodyAt = scroll => {
    setupWorld(K, { wy: 1000, t: 0 });
    K.G.scroll = scroll;
    K.G.frame = 50; K.G.rBend = 1;
    const calls = recordingCtx(ctx);
    K.drwBev({ type: "beach", side: -1, wy: 1000, off: 40, phase: 1.3, mode: "sit", variant: 1 });
    const body = calls.find(c => c.kind === "pathfill" && bbox(c).h >= 90);
    assert.ok(body, "отмель нарисована при scroll=" + scroll);
    return body;
  };
  const a = bodyAt(1000), b = bodyAt(1012);   // камера сдвинулась на 12px
  const A = bbox(a), B = bbox(b);
  // Края и ширина отмели в МИРЕ не должны меняться от прокрутки —
  // иначе волнистый край «ползёт» по берегу.
  assert.ok(Math.abs(A.x0 - B.x0) < 0.6 && Math.abs(A.x1 - B.x1) < 0.6,
    "края отмели не сдвигаются при прокрутке: " + A.x0 + "->" + B.x0 + ", " + A.x1 + "->" + B.x1);
  assert.ok(Math.abs(A.w - B.w) < 0.6, "ширина отмели не меняется: " + A.w + "->" + B.w);
  // По экрану отмель обязана съехать РОВНО на величину прокрутки камеры.
  assert.ok(Math.abs((B.y0 - A.y0) - 12) < 0.6, "отмель переносится ровно на прокрутку (" + (B.y0 - A.y0) + "), а не дрейфует");
});