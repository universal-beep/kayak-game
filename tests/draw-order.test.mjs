// Z-порядок отрисовки препятствий.
// Мель (песок) и ряска — под всем плавающим; плавающие — зад-на-перед по wy.
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadGame } from "./harness.mjs";

const { K } = loadGame();

function pos(names) {
  return typeof names === "string" ? names.split(" ").map((n, i) => [n, i]) : names;
}

test("мель и ряска рисуются раньше плавающих объектов", () => {
  const obs = [
    { type: "kayaker", wy: 500 },
    { type: "shallows", wy: 500 },
    { type: "seaweed", wy: 100 },
    { type: "barge", wy: 900 },
  ];
  const order = K.drawOrderOf(obs).map(o => o.type);
  assert.ok(order.indexOf("shallows") < order.indexOf("kayaker"), "песок должен быть ПОД байдаркой");
  assert.ok(order.indexOf("seaweed") < order.indexOf("barge"), "ряска должна быть ПОД баржой");
  assert.ok(order.indexOf("shallows") < order.indexOf("barge"), "песок должен быть ПОД кораблём");
});

test("плавающие объекты сортируются по глубине (wy): ближний поверх дальнего", () => {
  const obs = [
    { type: "barge", wy: 300 },
    { type: "log", wy: 150 },
    { type: "rock", wy: 250 },
    { type: "kayaker", wy: 200 },
  ];
  const order = K.drawOrderOf(obs);
  const floats = order.map(o => o.type);
  const wys = order.map(o => o.wy);
  for (let i = 1; i < wys.length; i++)
    assert.ok(wys[i] >= wys[i - 1], "порядок по wy должен расти: " + wys.join(","));
  assert.equal(floats.join(","), "log,kayaker,rock,barge");
});