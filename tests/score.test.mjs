// Один счёт дня: HUD, финиш и рекорд показывают одно и то же число.
import test from "node:test";
import assert from "node:assert/strict";
import { loadGame, setupWorld } from "./harness.mjs";

test("счёт: HUD, финиш и лучшее — одно число", () => {
  const { K, ctx, sandbox } = loadGame();
  K.resetSave();
  K.startDay(0);
  setupWorld(K, { wy: 5000 });
  K.G.s = "playing";
  K.G.dist = 123.7;
  K.G.sc = 40;
  K.G.bsc = 9;

  assert.equal(K.scoreNow(), 172, "метры + бонусы + трюки");

  const texts = [];
  const fillText = ctx.fillText;
  ctx.fillText = (s) => texts.push(String(s));
  K.rndr();
  ctx.fillText = fillText;
  assert.ok(texts.includes("ДИСТ: 123м"), "дистанция осталась отдельной строкой");
  assert.ok(texts.includes("ОЧКИ: 172"), "в HUD счёт включает дистанцию");

  const els = {};
  const getElementById = sandbox.document.getElementById;
  sandbox.document.getElementById = id => els[id] || (els[id] = getElementById(id));
  K.finishLevel();

  assert.equal(K.G.s, "finish");
  assert.equal(K.save.best[1], 172, "в рекорд дня попало то же число");
  assert.equal(els.finScore.textContent, 172, "на финише то же число");
  assert.equal(els.finDist.textContent, 123, "дистанция на финише отдельно");

  K.G.dist = 50;
  K.G.sc = 0;
  K.G.bsc = 0;
  K.finishLevel();
  assert.equal(K.save.best[1], 172, "слабый повтор не понижает рекорд");
});
