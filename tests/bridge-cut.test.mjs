// Мульт «Под мостом»: вид вперёд по реке — байдарка плывёт К арке и уходит ПОД мост
// (а не вдоль него); машины едут по настилу поперёк кадра и не выезжают за край моста.
import test from "node:test";
import assert from "node:assert/strict";
import { loadGame } from "./harness.mjs";

const ARCH_W = 140*3*1.5;                      // ширина одной арки на экране, px

function posAt(keys, t) {
  let a = keys[0], b = keys[keys.length - 1];
  if (t <= a[0]) return a.slice(1); if (t >= b[0]) return b.slice(1);
  for (let i = 0; i < keys.length - 1; i++) if (t >= keys[i][0] && t <= keys[i + 1][0]) { a = keys[i]; b = keys[i + 1]; break; }
  const k = (t - a[0]) / (b[0] - a[0]);
  return a.slice(1).map((v, i) => v + (b[i + 1] - v) * k);
}

test("мост спереди: арки встык и покрывают кадр, сбоку мост не кончается", () => {
  const { K } = loadGame();
  assert.equal(K.SPR.bridge_front.map[0].length, 140);
  const arches = K.CUTS.bridge.actors.filter(a => a.spr === "bridge_front");
  assert.ok(arches.length >= 3);
  const xs = arches.map(a => a.keys[0][1]).sort((p, q) => p - q);
  for (let i = 1; i < xs.length; i++) assert.equal(xs[i] - xs[i - 1], ARCH_W, "арки встык");
  assert.ok(xs[0] - ARCH_W/2 <= 0 && xs[xs.length - 1] + ARCH_W/2 >= 420);
});

test("лодка плывёт под мост: уходит вверх по кадру, уменьшается, в проёме арки по центру и гаснет за ним", () => {
  const { K } = loadGame();
  const acts = K.CUTS.bridge.actors;
  const boat = acts.find(a => /^kayak/.test(a.spr));
  assert.ok(boat, "гребец есть");
  assert.ok(!acts.some(a => a.spr === "kayak_man"), "вид сбоку (вдоль моста) убран");
  const first = boat.keys[0], last = boat.keys[boat.keys.length - 1];
  assert.ok(first[2] > 600, "стартует у зрителя, внизу кадра");
  assert.ok(last[2] < first[2] - 300, "уходит вглубь (вверх по кадру)");
  assert.ok(last[3] < first[3] / 4, "и становится маленькой");
  assert.equal(last[4], 0, "в конце скрыта за мостом/вдалеке");
  for (const k of boat.keys) assert.equal(k[1], 210, "идёт по центру, ровно в проём");
  let prevY = Infinity;
  for (const k of boat.keys) { assert.ok(k[2] <= prevY, "только вперёд, не возвращается"); prevY = k[2]; }
  // Лодка рисуется ДО арок: проём прозрачный, лодка видна в нём, а за опорами скрыта.
  const iBoat = acts.indexOf(boat), iArch = acts.findIndex(a => a.spr === "bridge_front");
  assert.ok(iBoat < iArch, "мост поверх лодки");
});

test("проём арки пустой (прозрачный) и достаточно широк и высок для лодки в тот момент, когда она под мостом", () => {
  const { K } = loadGame();
  const m = K.SPR.bridge_front.map, midX = 70;
  let open = 0;
  for (let r = 0; r < m.length; r++) if (m[r][midX] === ".") open++;
  assert.ok(open >= 20, "проём по центру высотой не меньше 20 клеток: " + open);
  const bottom = m[m.length - 3];
  assert.ok(bottom.slice(40, 100).split("").every(c => c === "."), "внизу арки — вода, не камень");
  const boat = K.CUTS.bridge.actors.find(a => /^kayak/.test(a.spr));
  const [x, y, s] = posAt(boat.keys, 0.62);
  const bridgeBottom = K.CUTS.bridge.actors.find(a => a.spr === "bridge_front").keys[0][2];
  assert.ok(y >= bridgeBottom - 30 && y <= bridgeBottom + 40, "в момент входа лодка у ватерлинии моста");
  assert.ok(s < 1.4, "и к тому времени уже вдвое меньше");
});

test("машины едут по настилу поперёк кадра и за край не выезжают", () => {
  const { K } = loadGame();
  const cars = K.CUTS.bridge.actors.filter(a => /^car/.test(a.spr));
  assert.ok(cars.length >= 2);
  const arches = K.CUTS.bridge.actors.filter(a => a.spr === "bridge_front");
  const deckY = arches[0].keys[0][2] - 43*3*1.5;            // верх настила
  for (const car of cars) {
    const span = [car.keys[0][0], car.keys[car.keys.length - 1][0]];
    for (let t = span[0]; t <= span[1]; t += 0.01) {
      const [x, y] = posAt(car.keys, t);
      if (x < -60 || x > 480) continue;
      assert.ok(Math.abs(y - deckY) <= 6, `${car.spr} t=${t.toFixed(2)}: колёса не на настиле (${y} vs ${deckY})`);
    }
    assert.ok(posAt(car.keys, span[0])[0] < -60 || posAt(car.keys, span[0])[0] > 480, "въезжает из-за кадра");
    assert.ok(posAt(car.keys, span[1])[0] < -60 || posAt(car.keys, span[1])[0] > 480, "уезжает за кадр");
  }
});

test("мульт рисуется без ошибок на всём протяжении", () => {
  const { K } = loadGame();
  K.playCut("bridge", () => {});
  for (const f of [0, 0.2, 0.5, 0.7, 0.9, 1]) { K.G.cut.t = Math.floor(K.G.cut.len * f); K.drwCut(); }
});
