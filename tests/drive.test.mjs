// Мульты переезда: у каждой смены реки свой (сельская дорога, трасса, лесная
// грунтовка). Машины на широком экране не стоят и не торчат по бокам —
// въезжают из-за края и уезжают за край, в кадре только едут.
import test from "node:test";
import assert from "node:assert/strict";
import { loadGame } from "./harness.mjs";

test("три переезда — три разных дороги, выбор по реке, с которой уезжаем", () => {
  const { K } = loadGame();
  const names = [0, 1, 2].map(r => K.driveName(r));
  assert.deepEqual(names, ["drive1", "drive2", "drive3"]);
  const kinds = names.map(n => K.CUTS[n].road.kind);
  assert.deepEqual(kinds, ["country", "highway", "dirt"]);
  assert.equal(new Set(names.map(n => K.CUTS[n].caption)).size, 3, "подписи должны различаться");
  for (const n of names) {
    const sprs = K.CUTS[n].actors.map(a => a.spr);
    for (const s of ["car", "trailer", "kayak_side"]) assert.ok(sprs.includes(s), n + ": нет " + s);
  }
});

test("переезды: встречные и попутные машины в кадре широкого экрана только едут", () => {
  const { K } = loadGame();
  const at = (a, f) => { const k = a.keys; let i = 0; while (i < k.length - 2 && f > k[i+1][0]) i++;
    const k0 = k[i], k1 = k[Math.min(i+1, k.length-1)], u = Math.max(0, Math.min(1, (f - k0[0]) / Math.max(1e-6, k1[0] - k0[0])));
    return k0[1] + (k1[1] - k0[1])*u; };
  // Видимая ширина: экран 21:9 (2560×1080) — арт-x от −1111 до 1531.
  const L = -1150, R = 1570;
  for (const n of ["drive1", "drive2", "drive3"]) {
    const traffic = K.CUTS[n].actors.filter(a => a.traffic);
    assert.ok(traffic.length >= 1, n + ": встречных нет");
    const bad = [];
    for (const a of traffic) for (let f = 0; f <= 1; f += 0.005) {
      const x = at(a, f), x2 = at(a, Math.min(1, f + 0.005));
      if (x > L && x < R && Math.abs(x2 - x) < 0.5 && f < 0.995) bad.push(a.spr + " стоит на x=" + Math.round(x) + " в " + f.toFixed(3));
    }
    assert.deepEqual([...new Set(bad)].slice(0, 6), [], n + ": машины стоят в кадре");
  }
  assert.ok(K.CUTS.drive2.actors.filter(a => a.traffic).length >= 7, "на трассе машин мало");
});

test("обочина прокручивается сплошь: на широком экране по краям не пусто ни в начале, ни в конце", () => {
  const { K } = loadGame();
  for (const n of ["drive1", "drive2", "drive3"]) {
    const side = K.CUTS[n].actors.filter(a => a.roadside);
    assert.ok(side.length >= 10, n + ": обочина пустая");
    for (const f of [0, 1]) {
      const xs = side.map(a => f === 0 ? a.keys[0][1] : a.keys[a.keys.length - 1][1]);
      for (const edge of [-1100, 1520]) assert.ok(xs.some(x => Math.abs(x - edge) < 260),
        n + ": у края " + edge + " пусто в " + f);
    }
  }
});
