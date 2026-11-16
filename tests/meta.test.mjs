// Мета похода: полные сердца на дне 6, цены и минусы снаряжения, звания,
// испытания с множителем и свой призрак рекорда в кампании.
import test from "node:test";
import assert from "node:assert/strict";
import { loadGame } from "./harness.mjs";

function game() {
  const { K } = loadGame();
  K.resetSave(); K.setAudio(null);
  return K;
}
function finish(K, idx) {
  K.startDay(idx);
  let f = 0;
  while ((K.G.s === "playing" || K.G.s === "arrive") && f++ < 30000) {
    K.G.inv = 1e9;
    K.upd();
  }
  return f;
}

test("день 6: третья звезда только с полными сердцами", () => {
  const K = game();
  K.startDay(5);
  K.G.hp = 1;
  assert.equal(K.goalMet(), false, "одно сердце — не «сохранил сердце»");
  K.G.hp = K.maxHp();
  assert.equal(K.goalMet(), true);
  K.save.gear.push("ration");
  K.startDay(5);
  K.G.hp = 3;
  assert.equal(K.goalMet(), false, "с сухпайком нужно четыре");
  K.G.hp = 4;
  assert.equal(K.goalMet(), true);
});

test("экономика: сумма цен снаряжения соразмерна доходу похода", () => {
  const K = game();
  const sum = K.GEAR.reduce((n, it) => n + it.price, 0);
  assert.ok(sum >= 5000 && sum <= 7000, "сумма цен: " + sum);
});

test("снаряжение: у предмета есть цена и честное описание", () => {
  const K = game();
  for (const it of K.GEAR){
    assert.ok(it.price > 0, it.id + ": цена");
    assert.ok(it.note && it.note.length > 5, it.id + ": описание");
  }
  const paddle = K.GEAR.find(it => it.id === "paddle");
  assert.match(paddle.note, /25/, "описание весла называет реальный +25%");
  assert.match(paddle.note, /6/, "и +6% скорости");
  assert.equal(K.PADDLE_ACC, 1.25);
  assert.equal(K.PADDLE_SPEED, 1.06);
  const helmet = K.GEAR.find(it => it.id === "helmet");
  const ration = K.GEAR.find(it => it.id === "ration");
  assert.ok(helmet.down && ration.down, "у бонусных предметов есть видимый минус");
});

test("звания: растут со звёздами и видны на карте", () => {
  const K = game();
  assert.equal(K.rankOf(0).name, "НОВИЧОК");
  assert.equal(K.rankOf(6).name, "ТУРИСТ");
  assert.equal(K.rankOf(27).name, "МАСТЕР ВОДЫ");
  K.save.stars = {1:3,2:3,3:3,4:3,5:3,6:3,7:3,8:3,9:3};
  assert.equal(K.totalStars(), 27);
  assert.equal(K.rankOf().name, "МАСТЕР ВОДЫ");
});

test("испытания: одно сердце, запрет удара и множитель очков", () => {
  const K = game();
  K.setChallenge("oneheart");
  assert.equal(K.save.challenge, "oneheart");
  K.startDay(1);
  assert.equal(K.G.hp, 1, "одно сердце на старте");
  assert.equal(K.award(100), 150, "множитель испытания в очках");

  K.setChallenge("nostrike");
  K.startDay(1);
  K.G.s = "playing";
  K.G.strikeT = 0;
  K.paddleStrike();
  assert.equal(K.G.strikeT, 0, "веслом бить нельзя");

  K.setChallenge("noaxe");
  K.startDay(1);
  K.G.s = "playing";
  const axe = { type: "axe", t: K.G.t, wy: K.G.pwy };
  K.apBn(axe);
  assert.equal(K.G.axes, 0, "топор не берём");
  assert.ok(K.G.bonuses > 0, "но бонус дня засчитан");
  K.setChallenge("none");
});

test("призрак кампании: заезд пишется, чистится в сохранении и рисуется", () => {
  const { K, ctx } = loadGame();
  K.resetSave(); K.setAudio(null);
  finish(K, 0);
  const gh = K.save.ghost[1];
  assert.ok(gh && gh.frames > 0, "лучший заезд дня записан");
  assert.equal(gh.track.length % 2, 0);
  assert.ok(gh.track.length >= 4);
  assert.ok(gh.track[gh.track.length - 2] > gh.track[0], "плывёт вперёд");

  const merged = K.mergeSave({ v: 2, ghost: {
    1: { frames: 12, track: [0, 0, 100, 500] },
    2: { frames: 4, track: [0, NaN] },
    3: { frames: -1, track: [0, 0, 10, 10] },
  }});
  assert.ok(merged.ghost[1], "годная запись осталась");
  assert.equal(merged.ghost[2], undefined, "битая запись выброшена");
  assert.equal(merged.ghost[3], undefined, "отрицательное время выброшено");

  K.G.custom = null;
  K.G.ghostRun = gh;
  K.G.s = "playing";
  K.G.frame = 0;
  K.G.scroll = 0;
  let images = 0;
  const drawImage = ctx.drawImage;
  ctx.drawImage = (...a) => { images++; return drawImage(...a); };
  K.drwGhost();
  ctx.drawImage = drawImage;
  assert.ok(images > 0, "полупрозрачная лодка рекорда нарисована");
});
