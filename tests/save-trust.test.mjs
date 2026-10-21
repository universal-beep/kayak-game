// Надёжность: сохранение похода, подтверждение выхода, таймер «Продолжить?»
// и автопауза. Пробы-сторожа R210 (итерация 0, задачи A1a–A1c).
import test from "node:test";
import assert from "node:assert/strict";
import { loadGame, makeStorage } from "./harness.mjs";

const KEY = "kayak_campaign";
const BAK = KEY + ".bak";

test("сохранение: смена версии не стирает поход", () => {
  const storage = makeStorage({
    [KEY]: JSON.stringify({ v: 1, day: 2, wallet: 500, stars: { 1: 3 }, gear: ["helmet"], diary: [1] }),
  });
  const { K } = loadGame(undefined, { storage });
  assert.equal(K.save.wallet, 500, "кошелёк потерян");
  assert.equal(K.save.day, 2, "день потерян");
  assert.equal(JSON.stringify(K.save.stars), JSON.stringify({ 1: 3 }), "звёзды потеряны");
  assert.equal(K.save.gear.join(","), "helmet", "снаряжение потеряно");
  assert.equal(K.save.v, K.SAVE_VERSION, "версия не обновлена");
});

test("сохранение: битый файл читается из резервной копии", () => {
  const storage = makeStorage({
    [KEY]: "{ это не json",
    [BAK]: JSON.stringify({ v: 1, wallet: 777, day: 3 }),
  });
  const { K } = loadGame(undefined, { storage });
  assert.equal(K.save.wallet, 777, "резервная копия не прочитана");
  assert.equal(K.save.day, 3);
});

test("сохранение: удачная загрузка оставляет резервную копию", () => {
  const storage = makeStorage({ [KEY]: JSON.stringify({ v: 1, wallet: 42 }) });
  loadGame(undefined, { storage });
  assert.ok(storage.data.has(BAK), "резервная копия не создана");
});

test("сохранение: мусор в главном ключе не затирает хорошую копию", () => {
  for (const junk of ['{"oops":1}', "[]", '"str"', "42", "true"]) {
    const storage = makeStorage({
      [KEY]: junk,
      [BAK]: JSON.stringify({ v: 1, wallet: 777, day: 3 }),
    });
    const { K } = loadGame(undefined, { storage });
    assert.equal(K.save.wallet, 777, "потерян поход при main=" + junk);
    assert.equal(K.save.day, 3, "потерян день при main=" + junk);
    assert.equal(JSON.parse(storage.getItem(BAK)).wallet, 777, "копия затёрта при main=" + junk);
  }
});

test("сохранение: первая запись создаёт резервную копию", () => {
  const storage = makeStorage();
  const { K } = loadGame(undefined, { storage });
  K.save.wallet = 321;
  assert.equal(K.commitSave(), true);
  assert.ok(storage.data.has(BAK), "копии нет после первой записи");
  assert.equal(JSON.parse(storage.getItem(BAK)).wallet, 321);
  storage.setItem(KEY, "{bad");
  const again = loadGame(undefined, { storage }).K;
  assert.equal(again.save.wallet, 321, "копия не спасла первую сессию");
});

test("сохранение: регата и незнакомые поля переживают загрузку и запись", () => {
  const storage = makeStorage({
    [KEY]: JSON.stringify({ v: 1, wallet: 10, regatta: { osuga: 2 }, futureField: "keep" }),
  });
  const { K } = loadGame(undefined, { storage });
  assert.equal(K.save.regatta.osuga, 2, "регата потеряна при загрузке");
  assert.equal(K.save.futureField, "keep", "незнакомое поле потеряно");
  K.commitSave();
  const raw = JSON.parse(storage.getItem(KEY));
  assert.equal(raw.regatta.osuga, 2, "регата потеряна при записи");
  assert.equal(raw.futureField, "keep");
});

test("сохранение: битые типы не роняют рекорды и сумму похода", () => {
  const storage = makeStorage({
    [KEY]: JSON.stringify({ v: 1, wallet: 5, stars: [3, 2], best: { 1: "9" }, board: { 1: "x" } }),
  });
  const { K } = loadGame(undefined, { storage });
  assert.equal(JSON.stringify(K.save.stars), "{}", "массив звёзд не вычищен");
  assert.equal(K.campaignSum(), 9, "строка в лучшем результате сломала сумму");
  assert.doesNotThrow(() => K.boardView(1), "битая таблица роняет экран рекордов");
});

test("запись: отказ хранилища не роняет игру и возвращает false", () => {
  const storage = makeStorage();
  const { K } = loadGame(undefined, { storage });
  storage.failWrites = true;
  K.save.wallet = 999;
  assert.doesNotThrow(() => K.commitSave());
  assert.equal(K.commitSave(), false, "отказ записи не замечен");
  assert.equal(K.save.wallet, 999, "прогресс в памяти потерян");
});

test("запись: после успешной записи баннер снимается", () => {
  const storage = makeStorage();
  const { K } = loadGame(undefined, { storage });
  storage.failWrites = true;
  assert.equal(K.commitSave(), false);
  assert.equal(K.saveProblem(), true, "флаг ошибки не поднят");
  storage.failWrites = false;
  assert.equal(K.commitSave(), true);
  assert.equal(K.saveProblem(), false, "флаг ошибки не снят");
});

test("выход: первый клик просит подтверждение, второй выходит на карту", () => {
  const { K } = loadGame(undefined, { storage: makeStorage() });
  K.G.s = "paused";
  K.G.dist = 100;
  K.requestMapExit();
  assert.equal(K.G.s, "paused", "вышло без подтверждения");
  K.requestMapExit();
  assert.equal(K.G.s, "map", "второй клик не вышел");
});

test("выход: в начале дня выходит сразу", () => {
  const { K } = loadGame(undefined, { storage: makeStorage() });
  K.G.s = "paused";
  K.G.dist = 0;
  K.requestMapExit();
  assert.equal(K.G.s, "map");
});

test("продолжить: таймер на нуле не завершает день", () => {
  const { K } = loadGame(undefined, { storage: makeStorage() });
  K.G.s = "continue";
  K.G.contT = 2;
  K.G.lives = 2;
  K.G.obs = [];
  K.upd();
  K.upd();
  assert.equal(K.G.s, "playing", "день завершился по таймеру");
  assert.equal(K.G.hp, 1, "после таймера не одно сердце");
});

test("продолжить: скрытая вкладка не тикает", () => {
  const { K, sandbox } = loadGame(undefined, { storage: makeStorage() });
  sandbox.document.visibilityState = "hidden";
  K.G.s = "continue";
  K.G.contT = 2;
  K.upd();
  assert.equal(K.G.contT, 2, "таймер шёл в скрытой вкладке");
  assert.equal(K.G.s, "continue");
});

test("пауза: потеря фокуса останавливает заплыв", () => {
  const { K } = loadGame(undefined, { storage: makeStorage() });
  K.G.s = "playing";
  K.G.day = 0;
  K.onWindowBlur();
  assert.equal(K.G.s, "paused", "потеря фокуса не поставила паузу");
});

test("пауза: потеря фокуса сбрасывает зажатый гребок", () => {
  const { K } = loadGame(undefined, { storage: makeStorage() });
  K.G.s = "playing";
  K.G.day = 0;
  K.G.mSpeed = 1;
  K.onWindowBlur();
  assert.equal(K.G.mSpeed, null, "лодка продолжила грести сама");
});

test("продолжить: потеря фокуса останавливает таймер", () => {
  const { K } = loadGame(undefined, { storage: makeStorage() });
  K.G.s = "continue";
  K.G.contT = 30;
  K.onWindowBlur();
  K.upd();
  assert.equal(K.G.contT, 30, "таймер шёл без фокуса");
  K.onWindowFocus();
  K.upd();
  assert.equal(K.G.contT, 29, "таймер не возобновился");
});

test("пауза: скрытие вкладки останавливает заплыв", () => {
  const { K, sandbox } = loadGame(undefined, { storage: makeStorage() });
  sandbox.document.visibilityState = "hidden";
  K.G.s = "playing";
  K.G.day = 0;
  K.onVisibilityChange();
  assert.equal(K.G.s, "paused", "скрытие вкладки не поставило паузу");
});
