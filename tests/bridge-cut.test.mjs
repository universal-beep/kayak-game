// Мульт «Под мостом»: мост — сплошная лента, концов в кадре нет, машины едут по
// настилу и не выезжают за его край; гребец проплывает под пролётом.
import test from "node:test";
import assert from "node:assert/strict";
import { loadGame } from "./harness.mjs";

const TILE = 252, SPAN_W = 84*3;               // шаг плиток и ширина спрайта bridge, px

function posAt(keys, t) {
  let a = keys[0], b = keys[keys.length - 1];
  if (t <= a[0]) return a.slice(1); if (t >= b[0]) return b.slice(1);
  for (let i = 0; i < keys.length - 1; i++) if (t >= keys[i][0] && t <= keys[i + 1][0]) { a = keys[i]; b = keys[i + 1]; break; }
  const k = (t - a[0]) / (b[0] - a[0]);
  return a.slice(1).map((v, i) => v + (b[i + 1] - v) * k);
}

test("мост — плитки с шагом ширины спрайта минус полуопоры, и спрайт плиточный", () => {
  const { K } = loadGame();
  assert.equal(K.SPR.bridge.map[0].length * 3, SPAN_W);
  const tiles = K.CUTS.bridge.actors.filter(a => a.spr === "bridge");
  assert.ok(tiles.length >= 7, "плиток хватает на весь ход: " + tiles.length);
  const xs0 = tiles.map(a => a.keys[0][1]).sort((p, q) => p - q);
  for (let i = 1; i < xs0.length; i++) assert.equal(xs0[i] - xs0[i - 1], TILE, "плитки встык");
});

test("в любой момент мульта настил закрывает кадр целиком: слева и справа продолжается", () => {
  const { K } = loadGame();
  const tiles = K.CUTS.bridge.actors.filter(a => a.spr === "bridge");
  for (let t = 0; t <= 1.0001; t += 0.02) {
    const cover = tiles.map(a => posAt(a.keys, t)[0]).sort((p, q) => p - q);
    // левый край самой левой плитки левее кадра, правый край самой правой — правее
    assert.ok(cover[0] - SPAN_W/2 <= -20, `t=${t.toFixed(2)}: слева виден конец моста`);
    assert.ok(cover[cover.length - 1] + SPAN_W/2 >= 440, `t=${t.toFixed(2)}: справа виден конец моста`);
    for (let i = 1; i < cover.length; i++) assert.ok(cover[i] - cover[i - 1] <= SPAN_W + 1e-6, "в ленте нет разрывов");
  }
});

test("машины едут по настилу: по всему пути под колёсами настил, за краем моста не появляются", () => {
  const { K } = loadGame();
  const tiles = K.CUTS.bridge.actors.filter(a => a.spr === "bridge");
  const cars = K.CUTS.bridge.actors.filter(a => /^car/.test(a.spr));
  assert.ok(cars.length >= 2);
  for (const car of cars) {
    const span = [car.keys[0][0], car.keys[car.keys.length - 1][0]];
    for (let t = span[0]; t <= span[1]; t += 0.01) {
      const [x, y, , al] = posAt(car.keys, t);
      if (x < -60 || x > 480) continue;                       // за кадром — не видно
      const under = tiles.some(a => { const cx = posAt(a.keys, t)[0]; return x >= cx - SPAN_W/2 && x <= cx + SPAN_W/2; });
      assert.ok(under, `${car.spr} t=${t.toFixed(2)} x=${x.toFixed(0)}: под машиной нет настила`);
      assert.equal(y, 212, "колёса на настиле");
      assert.ok(al > 0.5);
    }
    assert.ok(posAt(car.keys, span[0])[0] < -60 || posAt(car.keys, span[0])[0] > 480, "въезжает из-за кадра");
    assert.ok(posAt(car.keys, span[1])[0] < -60 || posAt(car.keys, span[1])[0] > 480, "уезжает за кадр, не остаётся на мосту");
  }
});

test("машины не едут одновременно друг сквозь друга; гребец под пролётом без опоры над головой в середине", () => {
  const { K } = loadGame();
  const [c1, c2] = K.CUTS.bridge.actors.filter(a => /^car/.test(a.spr));
  const end1 = c1.keys[c1.keys.length - 1][0], start2 = c2.keys[0][0];
  assert.ok(end1 <= start2 + 1e-9, "вторая выезжает, когда первая уже ушла");
  const tiles = K.CUTS.bridge.actors.filter(a => a.spr === "bridge");
  const centers = tiles.map(a => posAt(a.keys, 0.5)[0]);
  assert.ok(centers.some(x => Math.abs(x - 210) < 1), "в t=0.5 центр пролёта над гребцом (x=210)");
  // опоры в стыках: ±126 px от центра пролёта, то есть далеко от гребца
  assert.ok(Math.min(...centers.map(x => Math.abs(x + TILE/2 - 210)).concat(Math.abs(210 - (centers[0] - TILE/2)))) >= 0);
});

test("мульт рисуется целиком на нескольких моментах", () => {
  const { K } = loadGame();
  K.playCut("bridge", () => {});
  for (const f of [0, 0.1, 0.5, 0.9, 1]) {
    K.G.cut.t = Math.floor(K.G.cut.len * f);
    assert.doesNotThrow(() => K.drwCut(), "t=" + f);
  }
});
