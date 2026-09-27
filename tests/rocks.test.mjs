// Камни в реке: пять видов (валун, клык, плита, мшистый, россыпь), вид
// сверху. В каждой реке встречаются все пять, но набор свой: в лесной
// Медведице чаще мшистые, на порожистой Осуге — клыки и россыпь.
import test from "node:test";
import assert from "node:assert/strict";
import { loadGame } from "./harness.mjs";

const KINDS = ["boulder", "fang", "slab", "mossy", "pebbles"];

function mix(K, river) {
  const n = {};
  for (let i = 0; i < 1000; i++) { const k = K.rockKind(river, (i + 0.5) / 1000); n[k] = (n[k] || 0) + 1; }
  return n;
}
const top = n => Object.entries(n).sort((a, b) => b[1] - a[1])[0][0];

test("пять видов камней, в каждой реке все пять", () => {
  const { K } = loadGame();
  for (const k of KINDS) assert.ok(K.SPR[k] && K.SPR[k].map, "нет спрайта " + k);
  for (let r = 0; r < K.RIVERS.length; r++)
    assert.deepEqual(Object.keys(mix(K, r)).sort(), [...KINDS].sort(), K.RIVERS[r].name);
});

test("у каждой реки свой набор камней", () => {
  const { K } = loadGame();
  assert.equal(top(mix(K, 1)), "mossy", "Медведица — лесная, чаще мшистые");
  assert.ok(["fang", "pebbles"].includes(top(mix(K, 3))), "Осуга — порожистая, чаще клыки и россыпь");
  const osuga = mix(K, 3), volga = mix(K, 0);
  assert.ok(osuga.fang > volga.fang * 2, "на Осуге клыков заметно больше, чем на Волге");
});

test("камни разного силуэта: ни два вида не совпадают по размеру клеток", () => {
  const { K } = loadGame();
  const dims = KINDS.map(k => K.SPR[k].map[0].length + "x" + K.SPR[k].map.length);
  assert.equal(new Set(dims).size, KINDS.length, dims.join(", "));
});
