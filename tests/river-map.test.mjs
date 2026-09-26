// Карта рек в книге похода снимается с настоящей геометрии игры.
import test from "node:test";
import assert from "node:assert/strict";
import { sampleDay, daySvg } from "../tools/river-map.mjs";
import { loadGame } from "./harness.mjs";

const { K } = loadGame();

test("карта дня покрывает весь путь от старта до финиша", () => {
  for (let d = 0; d < K.LEVELS.length; d++) {
    const m = sampleDay(d);
    assert.equal(m.len, K.LEVELS[d].len);
    assert.ok(m.samples[0].m <= 0 && m.samples.at(-1).m >= m.len, "день " + (d + 1) + ": карта не до финиша");
    for (const s of m.samples) {
      assert.ok(s.l >= 0 && s.r <= 420 && s.r - s.l > 40, "день " + (d + 1) + ": русло вне экрана на " + s.m + " м");
    }
  }
});

test("одна и та же карта при каждой сборке книги", () => {
  assert.deepEqual(sampleDay(4), sampleDay(4));
});

test("на карте то, что есть в дне: пороги, развилки, мосты", () => {
  for (let d = 0; d < K.LEVELS.length; d++) {
    const L = K.LEVELS[d], R = K.RIVERS[L.river], m = sampleDay(d);
    const rapids = m.samples.some(s => s.rapid > 0.5);
    assert.equal(rapids, R.rapids !== false, "день " + (d + 1) + ": пороги " + rapids);
    assert.equal(m.bridges.length > 0, !!L.bridges, "день " + (d + 1) + ": мосты");
    assert.equal(m.forks.length > 0, !!L.forks, "день " + (d + 1) + ": развилки");
    for (const b of m.bridges) assert.ok(b > 0 && b < m.len, "мост за пределами дня");
  }
});

test("карта дня — строки по 250 м с водой, мостами, финишем и отметками метров", () => {
  const svg = daySvg(sampleDay(0));
  assert.match(svg, /^<svg[^>]+viewBox/);
  assert.match(svg, /750–800 м · финиш/);
  assert.match(svg, />250–500 м</);
  assert.equal((svg.match(/<rect x="0" y="[\d.]+" width="[\d.]+" height="[\d.]+" fill="#/g) || []).length, 4, "800 м — это 4 строки по 250 м");
  assert.match(daySvg(sampleDay(4)), />мост</, "на Тверце мосты подписаны");
});
