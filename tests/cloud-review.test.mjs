// Разбор облачных фич 01.10.2026: что было видно в игре и чинится здесь.
// Надписи над лодкой слипались («МЕДВЕДЕДВИНАЛ»), подсказка лежала прямо в
// зоне надписей, мульт моста был солнечным в дождливые дни Тверцы, машины
// на мосту стояли в кадре и наезжали друг на друга, по бокам десктопа дома,
// зонтики и палатки стояли сплошь по траве, без деревень и пляжей.
import test from "node:test";
import assert from "node:assert/strict";
import { loadGame, setupWorld } from "./harness.mjs";

test("две надписи подряд не ложатся друг на друга", () => {
  const { K } = loadGame();
  setupWorld(K, { wy: 1000 });
  K.G.pops = [];
  K.popText("МЕДВЕДЬ! ГРЕБИ ВПЕРЁД!", "#ff5252");
  K.popText("МЕДВЕДЬ ДОГНАЛ", "#ff5252");
  K.popText("ЗАЯЦ 3/10", "#fff");
  const ys = K.G.pops.map(p => p.y).sort((a, b) => a - b);
  for (let i = 1; i < ys.length; i++) assert.ok(ys[i] - ys[i - 1] >= 12, "между строками " + (ys[i] - ys[i - 1]));
});

test("подсказка не лежит в зоне надписей над лодкой", () => {
  const { K } = loadGame();
  setupWorld(K, { wy: 1000 });
  // Лодка ходит по экрану от PY_MIN до PY_MAX: подсказка — на другой половине.
  for (const py of [K.PY_MIN, K.PY, K.PY_MAX]) for (const lines of [1, 3, 5]) {
    K.G.py = py;
    const box = K.hintBox(lines);
    const top = py - 34 - 0.8*55 - 12, bot = py + 30;   // надписи (живут 55 кадров, всплывают на 0,8 px) и лодка
    assert.ok(box.y + box.h < top || box.y > bot, "лодка на " + py + ", строк " + lines + ": подсказка " + box.y + "…" + (box.y + box.h));
    assert.ok(box.y >= 70 && box.y + box.h <= K.H - 40, "в кадре, ниже счёта: " + box.y);
  }
});

test("мульт «Под мостом» в дождливый день — под дождём", () => {
  const { K } = loadGame();
  const rainy = K.LEVELS.findIndex(L => L.bridges && L.rain);
  assert.ok(rainy >= 0);
  K.G.day = rainy; K.bridgeWeather();
  assert.ok(K.CUTS.bridge.rain > 0, "дождь");
  assert.equal(K.CUTS.bridge.sky, "rain");
  const clouds = K.CUTS.bridge.actors.filter(a => a.spr === "cloud");
  assert.ok(clouds.every(a => a.keys.every(k => k[4] === 0)), "в дождь без белых облачков");
  const dry = K.LEVELS.findIndex(L => !L.rain);
  K.G.day = dry; K.bridgeWeather();
  assert.ok(!(K.CUTS.bridge.rain > 0)); assert.equal(K.CUTS.bridge.sky, "day");
  assert.ok(clouds.every(a => a.keys.every(k => k[4] > 0)), "в ясный день облачка на месте");
});

test("машины на мосту не стоят в кадре и не едут друг сквозь друга", () => {
  const { K } = loadGame();
  const cut = K.CUTS.bridge, len = cut.len || K.CUT_LEN;
  K.G.cut = { name: "bridge", t: 0, len };
  const cars = cut.actors.filter(a => /^car/.test(a.spr));
  assert.equal(cars.length, 2);
  // Видно при 16:9: от W/2 − 640 до W/2 + 640 игровых px.
  const lo = K.W/2 - 640 - 40, hi = K.W/2 + 640 + 40, vis = x => x > lo && x < hi;
  for (const a of cars) for (const t of [0, len]) assert.ok(!vis(K.cutState(a, t).x), a.spr + " в кадре на t=" + t);
  for (let t = 0; t <= len; t += 3) {
    const [p, q] = cars.map(a => K.cutState(a, t));
    if (vis(p.x) && vis(q.x)) assert.ok(Math.abs(p.x - q.x) > 80, "сошлись на t=" + t);
  }
});

test("дома, зонтики и палатки по бокам — только рядом со своим жителем берега", () => {
  const { K } = loadGame();
  K.G.day = 4; setupWorld(K, { wy: 3000 });                  // Тверца
  K.G.bev = [];
  for (const n of ["house", "church", "banya", "umbrella", "tent2"])
    assert.notEqual(K.deepPick(n, 3000, -1), n, n + " без деревни");
  assert.equal(K.deepPick("sbirch", 3000, -1), "sbirch", "природное не трогаем");
  K.G.bev = [{ type: "village", side: -1, wy: 3100 }];
  assert.equal(K.deepPick("house", 3000, -1), "house", "у деревни дом остаётся");
  assert.notEqual(K.deepPick("house", 3000, 1), "house", "на другом берегу деревни нет");
  assert.notEqual(K.deepPick("house", 4000, -1), "house", "далеко от деревни");
  K.G.bev = [{ type: "beach", side: 1, wy: 3000 }];
  assert.equal(K.deepPick("umbrella", 3050, 1), "umbrella", "зонтик за пляжем");
});
