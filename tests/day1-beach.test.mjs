// День 1 «Пляж»: СМЯГЧЁННАЯ песчаная отмель вдоль кромки (не прямоугольник,
// не коса в реку), плавно переходящая в траву. ТРИ варианта (e.variant),
// различающихся длиной отмели и набором отдыхающих, плюс КЛАССИЧЕСКИЙ:
//   0 — короткая отмель, ОДИН загорающий на полотенце;
//   1 — средняя, ОДИН загорающий под зонтиком;
//   2 — длинная, ДВОЕ загорающих;
//   3 — КЛАССИЧЕСКИЙ пляж: полотенце + зонтик + ДВОЕ ДЕТЕЙ В ВОДЕ.
// Отдыхающие — пиксельные спрайты вида сверху (sunbather, towel, umbrella,
// swimmer0/1). Загорающие лежат ВДОЛЬ реки и КРУПНЫЕ — длиннее стоящего
// человека (по просьбе Максима: «вдоль реки, тогда размер будет больше»).
// Волейбола нет. Всё — один составной берег ("beach").
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadGame, setupWorld } from "./harness.mjs";


// Длина отмели (мир. px) по варианту — для теста «3 длины».
const SPAN = { 0: 132, 1: 180, 2: 210 };
// Сколько загорающих по варианту (классический — дети в воде).
const PEOPLE = { 0: 1, 1: 1, 2: 2 };

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
  raw.drawImage = function (img, x, y) {
    calls.push({ kind: "img", img, x, y, w: img.width, h: img.height });
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
// Картинки спрайта name (с вариантами окраски) среди отрисованного.
const imgsOf = (K, name) => [K.SPR[name].img, ...(K.SPR[name].imgs || [])];
const drawn = (K, calls, name) => calls.filter(c => c.kind === "img" && imgsOf(K, name).includes(c.img));

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
  // 01.10.2026 по просьбе Максима пляжи иногда бывают и на узких Медведице и Осуге;
  // на дождливой Тверце — нет.
  assert.ok(!K.BEV_POOLS[2].includes("beach"), "на дождливой Тверце без пляжа");
});

test("beach рисует МЯГКУЮ отмель вдоль кромки: вытянута по y, тонка поперёк, без квадратных углов", () => {
  const { K, ctx } = loadGame();
  const calls = recordingCtx(ctx);
  paintBeach(K, ctx, -1, 1);
  // Тело песка — единственная отрисовка вытянутой полосой (pathfill с высотой ≥90).
  const body = calls.find(c => c.kind === "pathfill" && bbox(c).h >= 90);
  assert.ok(body, "нарисован песчаный берег (вытянутая отмель)");
  const sz = bbox(body);
  // Глубина песка под полотенца (~40 px от воды) с запасом, но не коса в полберега.
  assert.ok(sz.w <= 90, "отмель не шире 90 px поперёк: w=" + sz.w);
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
  assert.ok(hs[0] < 150, "короткая отмель короткая: h=" + hs[0]);
  assert.ok(hs[2] > 190, "длинная отмель длинная: h=" + hs[2]);
  // Длина тела песка согласуется с мировой длиной отмели варианта (screenYOf — 1:1).
  assert.ok(Math.abs(hs[1] - (SPAN[1] + 8)) < 14, "средняя ≈ " + (SPAN[1] + 8) + ": " + hs[1]);
});

test("beach: загорающих РОВНО N по варианту, каждый на своём полотенце, лежат вдоль реки и на суше", () => {
  const { K, ctx } = loadGame();
  const person = K.spriteSize("person").h;
  for (const v of [0, 1, 2]){
    const calls = recordingCtx(ctx);
    paintBeach(K, ctx, -1, v);
    const sun = [...drawn(K, calls, "sunbather"), ...drawn(K, calls, "sunbather_f")];
    assert.equal(sun.length, PEOPLE[v], "вариант " + v + ": число загорающих = " + PEOPLE[v]);
    const edg = K.centerAt(1000) - K.widthAt(1000) / 2;
    for (const s of sun){
      assert.ok(s.h > s.w * 1.8, "лежит вдоль реки: " + s.w + "×" + s.h);
      assert.ok(s.h > person, "крупнее стоящего человека: " + s.h + " против " + person);
      assert.ok(s.x + s.w <= edg + 1, "на суше, не в воде: край " + (s.x + s.w).toFixed(1) + ", кромка " + edg.toFixed(1));
    }
  }
});

test("beach: на вариантах с загорающими (0-2) ДЕТЕЙ В ВОДЕ НЕТ", () => {
  const { K, ctx } = loadGame();
  for (const v of [0, 1, 2]){
    const calls = recordingCtx(ctx);
    paintBeach(K, ctx, -1, v);
    const kids = drawn(K, calls, "swimmer0").length + drawn(K, calls, "swimmer1").length;
    assert.equal(kids, 0, "вариант " + v + ": детей в воде нет");
  }
});

test("beach: КЛАССИЧЕСКИЙ пляж (вариант 3) — полотенце, зонтик и ДВОЕ ДЕТЕЙ В ВОДЕ", () => {
  const { K, ctx } = loadGame();
  const calls = recordingCtx(ctx);
  paintBeach(K, ctx, -1, 3);
  const edg = K.centerAt(1000) - K.widthAt(1000) / 2;
  const kids = [...drawn(K, calls, "swimmer0"), ...drawn(K, calls, "swimmer1")];
  assert.equal(kids.length, 2, "в классическом пляже двое детей");
  for (const k of kids) assert.ok(k.x >= edg, "ребёнок в воде: x=" + k.x.toFixed(1) + " кромка " + edg.toFixed(1));
  assert.ok(drawn(K, calls, "towel").length >= 1, "на классическом пляже лежит полотенце");
  assert.equal(drawn(K, calls, "umbrella").length, 1, "зонтик на классическом пляже есть");
  assert.equal(drawn(K, calls, "sunbather").length + drawn(K, calls, "sunbather_f").length, 0, "загорающих на классическом нет — там дети");
});

test("beach: у двоих загорающих разные полотенца, у среднего пляжа зонтик, волейбола нет", () => {
  const { K, ctx } = loadGame();
  let calls = recordingCtx(ctx);
  paintBeach(K, ctx, -1, 2);
  const imgs = new Set([...drawn(K, calls, "sunbather"), ...drawn(K, calls, "sunbather_f")].map(c => c.img));
  assert.equal(imgs.size, 2, "двое загорающих на полотенцах разного цвета");
  calls = recordingCtx(ctx);
  paintBeach(K, ctx, -1, 1);
  assert.equal(drawn(K, calls, "umbrella").length, 1, "у среднего пляжа зонтик");
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
// Жалоба Максима: «загорающие сейчас на траве». Полотенца и зонтик обязаны
// лежать на песке ЦЕЛИКОМ — на всех видах берега и составах, на обоих берегах.
test("beach: полотенца, загорающие и зонтик целиком на песке", () => {
  const { K, ctx } = loadGame();
  const inside = (pts, x, y) => {
    let c = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i], [xj, yj] = pts[j];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
    }
    return c;
  };
  for (const side of [-1, 1]) for (const shape of [0, 1, 2]) for (const variant of [0, 1, 2, 3]) {
    setupWorld(K, { wy: 1000, t: 0 });
    K.G.frame = 50; K.G.rBend = 1;
    const calls = recordingCtx(ctx);
    K.drwBev({ type: "beach", side, wy: 1000, off: 40, phase: 1.3, mode: "sit", variant, shape });
    const body = calls.find(c => c.kind === "pathfill" && typeof c.color === "object");
    assert.ok(body, "песок нарисован");
    const items = ["sunbather", "sunbather_f", "towel", "umbrella"].flatMap(n => drawn(K, calls, n));
    assert.ok(items.length > 0, "на пляже кто-то лежит");
    for (const it of items) {
      const m = 3;                                  // отступ от края спрайта (обводка)
      for (const [x, y] of [[it.x + m, it.y + m], [it.x + it.w - m, it.y + m], [it.x + m, it.y + it.h - m], [it.x + it.w - m, it.y + it.h - m]])
        assert.ok(inside(body.pts, x, y), "берег " + side + ", вид " + shape + ", состав " + variant + ": угол (" + x.toFixed(0) + ", " + y.toFixed(0) + ") не на песке");
    }
  }
});
