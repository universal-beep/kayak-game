// Провал объясняет, обо что ударились: имя объекта, контур и последние удары.
import test from "node:test";
import assert from "node:assert/strict";
import { loadGame, setupWorld } from "./harness.mjs";

test("провал: назван объект и показаны последние удары", () => {
  const { K, ctx, sandbox } = loadGame();
  K.resetSave();
  K.startDay(0);
  setupWorld(K, { wy: 5000 });
  K.G.s = "playing";
  K.G.bonuses = 2;

  const texts = [];
  const fillText = ctx.fillText;
  ctx.fillText = (s) => texts.push(String(s));
  K.rndr();
  ctx.fillText = fillText;
  assert.ok(texts.includes("Собрать 5 бонусов · 2 / 5"), "в HUD виден прогресс цели");

  K.G.hp = 3; K.G.inv = 0; K.G.whiskyT = 0; K.G.yacht = false;
  K.G.dist = 120;
  K.damage({ type: "log", wy: K.G.pwy + 60, t: K.G.t, r: 24 });
  assert.equal(K.G.lastHit.type, "log");
  assert.equal(K.G.lastHit.r, 24);
  assert.equal(K.G.hitLog[0].name, "БРЕВНО");
  assert.equal(K.G.hitLog[0].at, 120);
  assert.ok(K.G.pops.some(p => p.text === "БРЕВНО!"), "объект назван в popText");

  K.G.frame = 100;
  K.G.lastHit.until = K.G.frame + 30;
  const arcs = [];
  const arc = ctx.arc;
  ctx.arc = (...a) => arcs.push(a);
  K.rndr();
  ctx.arc = arc;
  assert.ok(arcs.some(a => a[2] === 24), "вокруг места удара нарисован контур");

  for (const [type, at, name] of [["rock", 150, "КАМЕНЬ"], ["snag", 180, "КОРЯГА"],
                                  ["kayaker", 210, "БАЙДАРОЧНИК"]]) {
    K.G.hp = 3; K.G.inv = 0;
    K.G.dist = at;
    K.damage({ type, wy: K.G.pwy + 40, t: K.G.t });
    assert.equal(K.G.hitLog[K.G.hitLog.length - 1].name, name);
  }
  assert.equal(K.G.hitLog.length, 3, "хранятся только последние три удара");
  assert.equal(K.G.hitLog[0].name, "КАМЕНЬ", "самый старый удар вытеснен");

  K.G.hp = 3; K.G.inv = 0; K.G.lives = 3;
  K.G.dist = 250;
  K.crush({ type: "barge", wy: K.G.pwy + 80, t: K.G.t, r: 52 });
  assert.equal(K.G.lastHit.type, "barge");
  assert.equal(K.G.hitLog[K.G.hitLog.length - 1].name, "БАРЖА");

  const els = {};
  const getElementById = sandbox.document.getElementById;
  sandbox.document.getElementById = id => els[id] || (els[id] = getElementById(id));
  K.failLevel();

  assert.equal(K.G.s, "fail");
  assert.match(els.failHits.innerHTML, /ПОСЛЕДНИЕ УДАРЫ/);
  assert.match(els.failHits.innerHTML, /БАРЖА · 250 м/);
  assert.match(els.failHits.innerHTML, /БАЙДАРОЧНИК · 210 м/);
});
