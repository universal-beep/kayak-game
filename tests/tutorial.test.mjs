// Первый день: ручной учебный плёс. Случайные препятствия молчат, подсказка
// меняется от действия, а не по таймеру, а «Я УМЕЮ» запоминается.
import test from "node:test";
import assert from "node:assert/strict";
import { loadGame } from "./harness.mjs";

function fresh(){
  const { K } = loadGame();
  K.resetSave();
  K.startDay(0);
  return K;
}

test("обучение: первые 60 м без случайных препятствий", () => {
  const K = fresh();
  assert.ok(K.G.tut, "день 1 начинается с обучения");
  K.G.dist = 50;
  assert.equal(K.spawnAllowed(), false, "случайный спавн выключен");
  assert.ok(!K.G.obs.some(o => !o.tut), "в воде только сценарные объекты");
  K.finishTutorial();
  assert.equal(K.spawnAllowed(), true, "после обучения спавн возвращается");
});

test("обучение: подсказка гаснет от действия", () => {
  const K = fresh();
  assert.match(K.G.tut.hint.text, /РУЛЬ/);
  K.tutAction("steer");
  assert.match(K.G.tut.hint.text, /ГРЕБИ/);
  K.tutAction("row");
  assert.match(K.G.tut.hint.text, /КОЛЬЦО/);
  assert.ok(K.G.tut.hint.life > 1e8, "таймер не подъедает подсказку");
});

test("обучение: кольцо, батон по курсу и камень у берега", () => {
  const K = fresh();
  K.tutAction("steer");
  K.tutAction("row");

  K.G.dist = 78;
  K.tutTick();
  const ring = K.G.tut.ring;
  assert.ok(ring, "на 78 м появилось кольцо");
  assert.match(K.G.tut.hint.text, /КОЛЬЦО/);
  K.G.pwy = ring.wy + 1;
  K.G.t = ring.t;
  K.tutTick();
  assert.equal(K.G.tut.ringDone, true, "кольцо пройдено");

  K.G.dist = 118;
  K.tutTick();
  const bonus = K.G.tut.bonus;
  assert.ok(bonus && K.G.bns.includes(bonus), "батон лежит по курсу");
  K.apBn(bonus);
  assert.equal(K.G.tut.bonusDone, true, "батон собран");

  K.G.dist = 158;
  K.tutTick();
  const rock = K.G.tut.rock;
  assert.ok(rock && K.G.obs.includes(rock), "камень появился");
  assert.ok(rock.t > 0.4, "камень у берега, а не по центру: " + rock.t);
  K.G.pwy = rock.wy + 100;
  K.tutTick();

  assert.equal(K.G.tut.done, true, "обучение закончилось");
  assert.equal(K.save.seen.tutorial, 1, "прохождение запомнено");
});

test("обучение: «я умею» пропускает и запоминается", () => {
  const K = fresh();
  K.skipTutorial();
  assert.equal(K.G.tut.done, true);
  assert.equal(K.save.seen.tutorial, 1);
  K.startDay(0);
  assert.equal(K.G.tut, null, "во второй раз обучения нет");
});

test("обучение: с карты можно пройти заново", () => {
  const K = fresh();
  K.skipTutorial();
  K.startDay(0);
  assert.equal(K.G.tut, null);
  K.G.tutForce = true;
  K.startDay(0);
  assert.ok(K.G.tut, "принудительный повтор включает обучение");
  assert.equal(K.G.tutForce, false, "флаг повтора сброшен");
});
