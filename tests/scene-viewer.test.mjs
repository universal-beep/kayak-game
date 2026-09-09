// Служебный режим просмотра сцен без прохождения уровня.
// ?day=N&scene=beach|finish|camp|ducks и ?day=N&at=M ставят камеру прямо
// на картинку; кадр готов в момент входа в уровень.
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadGame, setupWorld } from "./harness.mjs";

function prepare(K) {
  K.G.s = "playing";
  K.G.day = 0;
  K.G.landSide = 1;
  K.G.bev = [];
  K.G.frame = 30;
  K.G.rWidth = 1; K.G.rBend = 0;
}

test("teleportTo ставит камеру так, что точка w — по центру экрана", () => {
  const { K } = loadGame();
  prepare(K);
  K.ensureSegments(2000);
  K.teleportTo(1000);
  assert.equal(K.G.scroll, 1000 - 720 / 2, "scroll захватывает точку по центру");
  assert.equal(K.G.pwy, 1000, "игрок в той же точке");
  assert.equal(K.G.dist, 1000, "дистанция синхронна");
  // Точка ровно по центру по вертикали (screenYOf(w) = PY + scroll - w = PY - 360).
  assert.equal(K.screenYOf(1000), K.PY - 360);
});

test("sceneAt('beach') спавнит только пляж и телепортирует к нему", () => {
  const { K } = loadGame();
  prepare(K);
  K.sceneAt("beach");
  assert.equal(K.G.bev.length, 1, "спавнится одна сцена (пляж)");
  assert.equal(K.G.bev[0].type, "beach", "это пляж");
  const wy = 460;
  assert.equal(K.G.scroll, Math.max(0, wy - 720/2), "камера на пляже");
  assert.equal(K.G.bev[0].wy, wy, "актёр точно на сцене");
  assert.equal(K.screenYOf(wy), K.PY - 360, "пляж по центру кадра");
});

test("sceneAt('ducks') спавнит уток в воде и телепортирует к ним", () => {
  const { K } = loadGame();
  prepare(K);
  K.sceneAt("ducks");
  assert.equal(K.G.bev[0].type, "ducks", "утки на сцене");
  assert.equal(K.G.bev[0].mode, "swim", "утки плавают (покой), не разлёт");
});

test("sceneAt('finish') ставит ленту и лагерь, камера вплотную к сужению", () => {
  const { K } = loadGame();
  prepare(K);
  K.sceneAt("finish");
  const tape = Math.max(60, K.level().len - 30);
  assert.equal(K.G.tapeWy, tape, "лента на дистанции уровня");
  // Лагерь заспавнен (палатки и огонь присутствуют).
  const kinds = new Set(K.G.bev.map(e => e.type));
  assert.ok(kinds.has("tent") || kinds.has("tent2"), "палатки у лагеря");
  assert.ok(kinds.has("fire"), "костёр у лагеря");
  // Камера не за лентой: сужение административно плавно по дистанции.
  assert.ok(K.G.scroll < tape, "камера ниже ленты — виден сухой берег и палатки");
});

test("applyDebugScene с ?at=M телепортирует на метры", () => {
  const { K, sandbox } = loadGame();
  prepare(K);
  sandbox.location.search = "?day=1&at=555";
  K.applyDebugScene();
  assert.equal(K.G.pwy, 555, "телепорт на 555 м");
  assert.equal(K.G.dist, 555);
  assert.equal(K.G.bev.length, 1, "на точке одна случайная береговая сцена");
});

test("downloadShot безопасно молчит без toDataURL (не падает в харнессе)", () => {
  const { K } = loadGame();
  prepare(K);
  // В VM-харнессе canvas без toDataURL; вызов не должен бросить исключение.
  K.downloadShot();
});