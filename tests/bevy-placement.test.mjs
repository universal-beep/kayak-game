// Размещение береговых актёров и утки.
// 1) Пляж целиком виден в кадре даже при сильном завале берега — сцена
//    сдвигается, песок никогда не уезжает за края.
// 2) Утки всегда в воде и разлетаются, когда байдарка подплывает.
// 3) wy для визуальных тестов берём ВНЕ финишной зоны (len-120), чтобы
//    финишный рельеф (сдвиг оси/сужение) не влиял на «виден ли берег».
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadGame } from "./harness.mjs";

const W = 420;

function recordingCtx(raw) {
  const calls = [];
  let path = [];
  raw.beginPath = () => { path = []; };
  raw.closePath = () => { if (path.length) path.push(path[0]); };
  raw.moveTo = (x, y) => { path.push([x, y]); };
  raw.lineTo = (x, y) => { path.push([x, y]); };
  raw.arc = (x, y, r) => { path.push([x - r, y - r], [x + r, y + r]); };
  raw.ellipse = (x, y, rx, ry) => { path.push([x - rx, y - ry], [x + rx, y + ry]); };
  raw.fill = function () { if (path.length) calls.push({ pts: path.slice() }); };
  raw.fillRect = function (x, y, w, h) { calls.push({ x, y, w, h }); };
  return calls;
}

const span = c => c.w !== undefined
  ? { x0: c.x, x1: c.x + c.w }
  : { x0: Math.min(...c.pts.map(p => p[0])), x1: Math.max(...c.pts.map(p => p[0])) };

test("пляж целиком в кадре даже при сильном завале берега (вне финишной зоны)", () => {
  const { K, ctx } = loadGame();
  const calls = recordingCtx(ctx);
  const wy = 250;   // день 0: len=800, финишная рампа начинается на len-120=680
  K.G.scroll = wy; K.G.s = "playing";
  K.G.rWidth = 1; K.G.rBend = 2.2;
  K.G.segs = [{ type: "calm", start: 0, end: 1e9 }];
  K.G.frame = 30;
  K.drwBev({ type: "beach", side: -1, wy, off: 40, phase: 1.3, mode: "sit" });
  assert.ok(K.finishGain(wy) === 0, "тест вне финишного рельефа");
  assert.ok(calls.length > 0, "пляж нарисован");
  for (const c of calls){
    const s = span(c);
    assert.ok(s.x0 >= -1, "отмель не уходит за левый край: x0=" + s.x0);
    assert.ok(s.x1 <= W + 1, "отмель не уходит за правый край: x1=" + s.x1);
  }
});

test("все береговые актёры прижаты к видимой части кадра и к суше (вне финишной зоны)", () => {
  const { K, ctx } = loadGame();
  const calls = recordingCtx(ctx);
  const wy = 400;   // вне финишной зоны, но кромка левого берега гуляет: суша
                    // видна, а off=84 выбрасывает актёра далеко за левый край
  K.G.scroll = wy; K.G.s = "playing";
  K.G.rWidth = 1; K.G.rBend = 1;
  K.G.segs = [{ type: "calm", start: 0, end: 1e9 }];
  K.G.frame = 10;
  K.drwBev({ type: "fire", side: -1, wy, off: 84, phase: 1, mode: "sit" });
  assert.ok(K.finishGain(wy) === 0, "тест вне финишного рельефа");
  assert.ok(calls.length > 0, "кострище нарисовано");
  for (const c of calls){
    const s = span(c);
    assert.ok(s.x0 >= -1, "актёр не рисуется за левой кромкой: x0=" + s.x0);
    assert.ok(s.x1 <= W + 1, "актёр не рисуется за правой кромкой: x1=" + s.x1);
  }
});

test("утки встречают игрока на воде и разлетаются при сближении", () => {
  const { K } = loadGame();
  const e = { type: "ducks", side: 1, wy: 1050, off: 0, phase: 1.1, mode: "swim" };
  K.G.pwy = 1000;
  K.G.t = 0.9;                       // гребец близко к их (правому) берегу
  K.updBev(e);
  assert.equal(e.away, 1, "при сближении утки встревожены");
  e.fl = 69; K.updBev(e);
  assert.ok(!e.dead, "полёт ещё не закончен");
  K.updBev(e);
  assert.equal(e.dead, true, "после разлёта утки убраны");
});

test("утки пугаются в любом режиме (и «на суше» не сидят)", () => {
  const { K } = loadGame();
  const e = { type: "ducks", side: -1, wy: 1050, phase: 2, mode: "sit" };
  K.G.pwy = 1000;
  K.G.t = -0.9;                      // гребец близко к их (левому) берегу
  K.updBev(e);
  assert.equal(e.away, 1, "сидящие «на песке» тоже встречают игрока взлётом");
});

test("утки не пугаются, когда игрок плывёт серединой или по другому берегу", () => {
  const { K } = loadGame();
  const e = { type: "ducks", side: 1, wy: 1040, phase: 4, mode: "swim" };
  K.G.pwy = 1000;
  K.G.t = 0.05;                      // середина русла
  K.updBev(e);
  assert.equal(e.away, undefined, "по середине утки спокойны");
  K.G.t = -0.9;                      // противоположный берег
  K.updBev(e);
  assert.equal(e.away, undefined, "у противоположного берега утки не трогаются");
  K.G.t = 0.9;                       // их берег
  K.updBev(e);
  assert.equal(e.away, 1, "вплотную к их берегу утки взлетают");
});

test("утки не срываются издалека — только вплотную (одна лодка)", () => {
  const { K } = loadGame();
  const e = { type: "ducks", side: 1, wy: 1300, phase: 3, mode: "swim" };
  K.G.pwy = 1000;
  K.G.t = 0.9;                       // у их берега, но далеко по трассе
  K.updBev(e);
  assert.equal(e.away, undefined, "за 300px до стаи утки спокойны");
  e.wy = 1040;
  K.updBev(e);
  assert.equal(e.away, 1, "на расстоянии одной лодки утки взлетают");
});

test("группа у костра целиком стоит на суше, а не в воде", () => {
  const { K, ctx } = loadGame();
  const wy = 0;     // старт уровня: русло по центру, оба берега широкие (вне финишной зоны)
  K.G.scroll = wy; K.G.s = "playing";
  K.G.rWidth = 1; K.G.rBend = 1;
  K.G.segs = [{ type: "calm", start: 0, end: 1e9 }];
  K.G.frame = 10;
  for (const side of [-1, 1]){
    const calls = recordingCtx(ctx);
    const edg = K.centerAt(wy) + side * K.widthAt(wy) / 2;   // кромка воды
    K.drwBev({ type: "guitar", side, wy, off: 40, phase: 1, mode: "sit" });
    assert.ok(calls.length > 0, "компания нарисована (side=" + side + ")");
    for (const c of calls){
      const s = span(c);
      if (side < 0)
        assert.ok(s.x1 <= edg + 0.5, "левый берег: всё сухо над кромкой x1=" + s.x1.toFixed(1) + " edg=" + edg.toFixed(1));
      else
        assert.ok(s.x0 >= edg - 0.5, "правый берег: всё сухо над кромкой x0=" + s.x0.toFixed(1) + " edg=" + edg.toFixed(1));
    }
  }
});

test("bankAnchor на узком берегу не выталкивает спрайт в воду", () => {
  const { K } = loadGame();
  // Левый берег: узкая полоска суши у левого края экрана (edg=29).
  // До фикса внешний зажим Math.max(18,...) перебивал margin кромки
  // и якорь уезжал в воду: банк получал bx=18, а 18+24=42 > edg=29.
  const b = K.bankAnchor(29, -1, 29 - 40, 24);
  assert.equal(b, 5, "узкий левый берег: якорь упирается в кромку суши (edg-24)");
  assert.ok(b + 24 <= 29 + 0.001, "слева: спрайт + margin целиком на суше");
  // Крайнее левое положение: даже для глубоко ушедшего в сушу off якорь не уходит
  // дальше dry-границы edg-m и не пинается назад к 18 (где была бы вода).
  const b2 = K.bankAnchor(29, -1, -50, 16);
  assert.equal(b2, 13, "маленький спрайт на той же полоске: edg-16");
  // Правый берег у правого края экрана — зеркально.
  const W = 420;
  const br = K.bankAnchor(W - 29, 1, W - 29 + 40, 24);
  assert.ok(br - 24 >= (W - 29) - 0.001 || br === W, "справа: margin в суше, иначе упор в край экрана");
  // Широкая полоса берега НЕ меняет поведение (регрессия по «группе у костра»).
  assert.equal(K.bankAnchor(160, -1, 120, 24), 120, "широкий берег: canopy без изменений");
});

test("updBev не трогает не-уток", () => {
  const { K } = loadGame();
  const e = { type: "fire", side: 1, wy: 1050 };
  K.G.pwy = 1000;
  K.updBev(e);
  assert.equal(e.away, undefined, "костёр не встревожен");
  assert.equal(e.dead, undefined, "костёр не удаляется");
});