// Финальный мульт: закат, вокзал «ТВЕРЬ», перрон; поезд подъезжает и стоит; пассажиры идут
// именно к дверям вагонов и садятся до отправления; подпись меняется.
import test from "node:test";
import assert from "node:assert/strict";
import { loadGame } from "./harness.mjs";

function posAt(keys, t) {
  let a = keys[0], b = keys[keys.length - 1];
  if (t <= a[0]) return a.slice(1); if (t >= b[0]) return b.slice(1);
  for (let i = 0; i < keys.length - 1; i++) if (t >= keys[i][0] && t <= keys[i + 1][0]) { a = keys[i]; b = keys[i + 1]; break; }
  const k = (t - a[0]) / (b[0] - a[0]);
  return a.slice(1).map((v, i) => v + (b[i + 1] - v) * k);
}
const F = K => K.CUTS.finale;

test("вокзал нарисован крупно, с вывеской: спрайт 72×40, есть буквы ТВЕРЬ", () => {
  const { K } = loadGame();
  assert.equal(K.SPR.station.map[0].length, 72);
  assert.equal(K.SPR.station.map.length, 40);
  const rows = K.SPR.station.map.slice(12, 20).join("\n");
  assert.ok((rows.match(/w/g) || []).length > 40, "белые буквы на зелёной вывеске");
  assert.ok(K.SPR.lamp && K.SPR.bench && K.SPR.train.map[0].length === 240);
});

test("поезд стоит с 0.36 до 0.66 на center=484, а потом уезжает за правый край", () => {
  const { K } = loadGame();
  const train = F(K).actors.find(a => a.spr === "train");
  for (const t of [0.36, 0.45, 0.6, 0.66]) assert.equal(posAt(train.keys, t)[0], 484, "t=" + t);
  assert.ok(posAt(train.keys, 0.08)[0] < -300, "в начале пути пусто");
  assert.ok(posAt(train.keys, 1)[0] - 360 > 420, "в конце поезд ушёл за правый край кадра");
});

test("пассажиры идут к дверям вагонов, садятся и исчезают до отправления поезда", () => {
  const { K } = loadGame();
  const doors = [136, 277, 316];                   // двери: центр поезда 484, вагон 180 px, двери на +12 и +153
  const walkers = F(K).actors.filter(a => a.cycle);
  const people = walkers.filter(a => /^(person|girl)$/.test(a.spr));
  assert.equal(people.length, 6, "вся компания");
  for (const a of people) {
    const end = a.keys[a.keys.length - 1];
    assert.ok(end[4] === 0, "в конце хода невидим — сел");
    assert.ok(end[0] <= 0.66, "сел до отправления");
    assert.ok(doors.some(d => Math.abs(d - end[1]) < 2), "дошёл до двери: x=" + end[1]);
    const mid = posAt(a.keys, 0.46);
    assert.ok(mid[3] >= 0.99, "виден на ходу");
  }
  // пока стоят — рисуется стоячий спрайт, при ходьбе — два кадра ходьбы
  for (const a of people) assert.ok(a.cycle.spr.length === 2 && /_w1$/.test(a.cycle.spr[1]));
});

test("до отправления у платформы пусто для езды: поезд приезжает, когда все ещё стоят", () => {
  const { K } = loadGame();
  const train = F(K).actors.find(a => a.spr === "train");
  const walkers = F(K).actors.filter(a => a.cycle && /^(person|girl)$/.test(a.spr));
  const startWalk = Math.min(...walkers.map(a => a.keys[1][0]));
  const arrived = train.keys.find(k => k[1] === 484)[0];
  assert.ok(arrived < startWalk, "сначала подъехал, потом пошли");
});

test("подпись меняется на прощальную, длина мульта 480 кадров", () => {
  const { K } = loadGame();
  assert.equal(F(K).len, 480);
  assert.ok(F(K).captions.length >= 1 && F(K).captions[0][0] > 0.5);
  K.playCut("finale", () => {});
  for (const f of [0, 0.2, 0.4, 0.5, 0.7, 0.99]) {
    K.G.cut.t = Math.floor(480*f);
    assert.doesNotThrow(() => K.drwCut(), "t=" + f);
  }
});
