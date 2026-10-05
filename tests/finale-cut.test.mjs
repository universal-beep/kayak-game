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
    const mid = posAt(a.keys, (a.keys[1][0] + a.keys[2][0])/2);   // середина своего хода (идут по очереди)
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

// 04.10.2026: компания сбивалась в кучу у дверей и пропадала на месте;
// электричка стояла за перроном, ребята — без рюкзаков. Теперь поезд на
// ближнем пути перед перроном (рисуется поверх ребят: они уходят за вагон),
// к каждой двери по двое по очереди, у всех рюкзаки, у героя весло.
const PEOPLE = /^(person|girl)$/;
function visiblePeople(K, t) {
  return F(K).actors.filter(a => PEOPLE.test(a.spr)).map(a => posAt(a.keys, t)).filter(p => p[3] > 0.5);
}

test("электричка на ближнем пути перед перроном и рисуется поверх ребят", () => {
  const { K } = loadGame();
  const acts = F(K).actors, train = acts.find(a => a.spr === "train");
  assert.equal(train.keys[1][2], K.STATION.near[0], "колёса на ближнем пути");
  const lastPerson = Math.max(...acts.map((a, i) => PEOPLE.test(a.spr) ? i : -1));
  assert.ok(acts.indexOf(train) > lastPerson, "поезд рисуется после ребят");
});

test("ребята не сбиваются в кучу: идут к дверям по очереди", () => {
  const { K } = loadGame();
  for (let t = 0.3; t <= 0.66; t += 0.005) {
    const ps = visiblePeople(K, t);
    for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
      const d = Math.hypot(ps[i][0] - ps[j][0], ps[i][1] - ps[j][1]);
      assert.ok(d >= 18, "t=" + t.toFixed(3) + ": двое в " + d.toFixed(1) + " px");
    }
  }
});

test("у каждого рюкзак, который идёт вместе с ним; у героя весло", () => {
  const { K } = loadGame();
  const acts = F(K).actors;
  const walkers = acts.filter(a => a.cycle && PEOPLE.test(a.spr));
  const packs = acts.filter(a => a.spr === "pack");
  for (const w of walkers) {
    const own = packs.filter(p => p.with === w.id);
    assert.ok(own.length >= 1, "рюкзак у " + w.id);
    for (const t of [0.2, 0.45, 0.5]) {
      const a = posAt(w.keys, t), p = own.map(o => posAt(o.keys, t)).find(q => q[3] > 0.5);
      if (a[3] > 0.5) assert.ok(p && Math.abs(p[0] - a[0]) < 24 && Math.abs(p[1] - a[1]) < 30, w.id + " t=" + t);
    }
  }
  assert.ok(acts.some(a => a.spr === "oar" && a.with === "hero"), "весло у героя");
});

test("на ходу одежда не меняется: у кадра ходьбы те же расцветки, что у стоящего", () => {
  const { K } = loadGame();
  for (const a of F(K).actors.filter(a => a.cycle && PEOPLE.test(a.spr)))
    for (const fr of a.cycle.spr) {
      const n = (K.SPR[fr].variants || [{}]).length;
      assert.ok((a.var || 0) < n, fr + " без расцветки " + a.var);
    }
  assert.equal(JSON.stringify(K.SPR.person_w1.variants), JSON.stringify(K.SPR.person.variants));
});

// Мелочи 05.10.2026: рюкзаки разных цветов; весло героя крупнее и с древком
// толще одного пикселя; на высоком экране телефона низ кадра не пустой —
// машина с прицепом и байдарками на привокзальной дороге, в конце уезжает.
test("рюкзаки у ребят разных цветов", () => {
  const { K } = loadGame();
  const vars = new Set(F(K).actors.filter(a => a.spr === "pack").map(a => a.var || 0));
  assert.ok((K.SPR.pack.variants || []).length >= 4, "у рюкзака есть расцветки");
  assert.ok(vars.size >= 4, "цветов " + vars.size);
});

test("весло героя заметное: крупнее и древко толще пикселя", () => {
  const { K } = loadGame();
  const oar = F(K).actors.find(a => a.spr === "oar" && a.with === "hero");
  assert.ok(oar.keys[0][3] >= 1.3, "масштаб " + oar.keys[0][3]);
  const mid = K.SPR.oar.map[7].replace(/\./g, "");
  assert.ok(mid.length >= 2, "древко: " + K.SPR.oar.map[7]);
});

test("внизу кадра машина с прицепом и байдарками; уезжает в конце", () => {
  const { K } = loadGame();
  const acts = F(K).actors;
  for (const spr of ["car", "trailer", "kayak_side"]) {
    const a = acts.find(x => x.spr === spr);
    assert.ok(a, spr);
    const y = posAt(a.keys, 0.5)[1];
    assert.ok(y > 690 && y < 820, spr + " y=" + y);
    assert.ok(posAt(a.keys, 1)[0] > posAt(a.keys, 0.6)[0] + 400, spr + " уезжает вправо");
  }
});
