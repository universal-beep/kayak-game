// Лес по бокам: камней почти нет (их было по 3–4 из 10 мест на лесных реках —
// «слишком много»), вместо них — муравейник, веточки, полянка с цветами,
// можжевельник, шиповник, папоротник, камушек во мху.
import test from "node:test";
import assert from "node:assert/strict";
import { loadGame } from "./harness.mjs";

const STONES = ["boulder", "mossy", "slab", "pebbles", "boulder_side"];
const NEW = ["anthill", "twigs", "flowers", "juniper", "rosehip", "fern", "mossrock"];

test("новые лесные спрайты есть", () => {
  const { K } = loadGame();
  for (const n of NEW) assert.ok(K.SPR[n] && K.SPR[n].map, "нет спрайта " + n);
});

test("в наборах боковых зон камней почти нет, новых элементов хватает", () => {
  const { K } = loadGame();
  const all = new Set();
  K.DEEP_SETS.forEach((set, r) => {
    const stones = set.filter(n => STONES.includes(n) || n === "mossrock").length;
    assert.ok(stones <= 1, "река " + r + ": камней " + stones + " из " + set.length);
    for (const n of set) all.add(n);
  });
  for (const n of NEW) assert.ok(all.has(n), "нигде нет " + n);
});
