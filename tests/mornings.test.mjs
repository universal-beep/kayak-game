// Утро перед днём — тот же лагерь, что ночью: палатки на тех же местах и тех
// же цветов, тот же лес, песок, зеркальность, вода. Людей ночи, гитары и луны
// нет; встаёт солнце (или идёт дождь), герой идёт к лодке — не по ёлкам и не
// по палаткам. После переезда ночи не было — утро того лагеря, куда приехали.
import test from "node:test";
import assert from "node:assert/strict";
import { loadGame } from "./harness.mjs";

const PROPS = /^(tent|tent2|sfir|sbirch|sbush|fir|boulder_side|seat_log)$/;
const sig = sc => sc.actors.filter(a => PROPS.test(a.spr))
  .map(a => a.spr + "/" + (a.var || 0) + "@" + a.keys[0][1] + "," + a.keys[0][2]).sort().join(";");

test("утро — тот же лагерь, что ночью перед ним", () => {
  const { K } = loadGame();
  for (let d = 1; d < K.LEVELS.length; d++) {
    const night = K.nightBefore(d), m = K.CUTS[K.morningName(d)];
    assert.ok(m, "нет утра дня " + (d + 1));
    const n = K.CUTS[night];
    assert.equal(sig(m), sig(n), "день " + (d + 1) + ": палатки и лес как в " + night);
    for (const k of ["mirror", "water"]) assert.equal(m[k], n[k], "день " + (d + 1) + ": " + k);
    assert.equal(!!m.sand, !!n.sand, "песок");
    assert.equal(!!m.far, !!n.far, "дальний лес");
    assert.equal(!!m.rain, !!K.LEVELS[d].rain, "дождь по погоде дня");
  }
  assert.equal(K.nightBefore(1), "night", "после 1-го дня");
  assert.equal(K.nightBefore(2), K.nightName(3), "после переезда — ночь новой реки");
});

test("утром нет людей ночи, гитары и луны; есть восход, герой и лодка на воде", () => {
  const { K } = loadGame();
  const names = new Set();
  for (let d = 1; d < K.LEVELS.length; d++) names.add(K.morningName(d));
  for (const n of names) {
    const m = K.CUTS[n], sprs = m.actors.map(a => a.spr);
    for (const bad of ["sitter", "sitter_b", "sitter_girl", "night_guitar", "tent_lit", "sil", "note", "canary0", "bear", "girl"])
      assert.ok(!sprs.includes(bad), n + ": " + bad);
    assert.ok(!m.moon, n + ": луна");
    assert.equal(sprs.includes("sunrise"), !m.rain, n + ": восход — если не дождь");
    assert.ok(sprs.includes("person") && sprs.includes("person_paddle"), n + ": герой");
    const boat = m.actors.filter(a => a.spr === "kayak_side").some(a => a.keys[0][2] > m.water);
    assert.ok(boat, n + ": лодка на воде");
  }
});

test("утром герой идёт к лодке не по ёлкам и не по палаткам", () => {
  const { K } = loadGame();
  const bad = new Set();
  const names = new Set(); for (let d = 1; d < K.LEVELS.length; d++) names.add(K.morningName(d));
  for (const n of names) {
    const m = K.CUTS[n], hero = m.actors.find(a => a.spr === "person" && a.cycle);
    const props = m.actors.filter(a => PROPS.test(a.spr));
    for (let f = 0; f <= 0.9; f += 0.01) {
      const s = K.cutState(hero, f * (m.len || 300)); if (s.al < 0.5) continue;
      for (const p of props) {
        const pm = K.SPR[p.spr].map, sc = p.keys[0][3], w = pm[0].length*3*sc, h = pm.length*3*sc;
        const [px, py] = [p.keys[0][1], p.keys[0][2]];
        if (Math.abs(s.x - px) < w/2 - 3 && s.y < py - 2 && s.y > py - h + 3 && m.actors.indexOf(hero) > m.actors.indexOf(p))
          bad.add(n + ": герой на " + p.spr + " @" + px + "," + py);
      }
    }
  }
  assert.deepEqual([...bad], []);
});
