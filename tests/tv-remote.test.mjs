// Пульт ТВ-приставки (Android TV): крестовина и OK должны работать как стрелки
// и Enter, короткое нажатие не теряется, OK в заплыве — удар веслом.
import test from "node:test";
import assert from "node:assert/strict";
import { loadGame, setupWorld } from "./harness.mjs";

const ev = (o = {}) => Object.assign({ key: "", code: "", keyCode: 0, repeat: false, target: null, preventDefault() {} }, o);

test("пульт ТВ: коды и имена кнопок сводятся к обычным клавишам", () => {
  const { K } = loadGame();
  assert.equal(K.keyName(ev({ key: "Unidentified", keyCode: 19 })), "ArrowUp");
  assert.equal(K.keyName(ev({ key: "Unidentified", keyCode: 20 })), "ArrowDown");
  assert.equal(K.keyName(ev({ key: "Unidentified", keyCode: 21 })), "ArrowLeft");
  assert.equal(K.keyName(ev({ key: "Unidentified", keyCode: 22 })), "ArrowRight");
  assert.equal(K.keyName(ev({ keyCode: 38 })), "ArrowUp");
  assert.equal(K.keyName(ev({ keyCode: 37 })), "ArrowLeft");
  assert.equal(K.keyName(ev({ key: "Up" })), "ArrowUp");
  assert.equal(K.keyName(ev({ key: "Left" })), "ArrowLeft");
  assert.equal(K.keyName(ev({ key: "Unidentified", keyCode: 23 })), "Enter", "DPAD_CENTER");
  assert.equal(K.keyName(ev({ keyCode: 13 })), "Enter");
  assert.equal(K.keyName(ev({ key: "OK" })), "Enter");
  assert.equal(K.keyName(ev({ key: "Select" })), "Enter");
  assert.equal(K.keyName(ev({ keyCode: 4 })), "Escape", "Back на Android TV");
  assert.equal(K.keyName(ev({ key: "GoBack" })), "Escape");
  assert.equal(K.keyName(ev({ key: "w" })), "w", "обычные клавиши не трогаем");
  assert.equal(K.keyName(ev({ key: "Pause", keyCode: 19 })), "Pause", "клавиша Pause — не стрелка");
});

test("пульт ТВ: OK в заплыве — удар веслом, удержание не долбит, отпустил — можно снова", () => {
  const { K } = loadGame();
  K.resetSave(); K.G.day = 0; K.sg(); setupWorld(K, { wy: 5000 });
  K.G.s = "playing";
  const ok = ev({ key: "Unidentified", keyCode: 23 });
  K.G.strikeT = 0;
  let prevented = false; ok.preventDefault = () => { prevented = true; };
  K.onKeyDown(ok);
  assert.ok(K.G.strikeT > 0, "один OK — удар");
  assert.ok(prevented, "OK не должен нажимать кнопку под фокусом");
  K.G.strikeT = 0;
  K.onKeyDown(ok);                                  // кнопка удерживается
  assert.equal(K.G.strikeT, 0, "повтор удержания — без второго удара");
  K.onKeyUp(ok);
  K.onKeyDown(ok);
  assert.ok(K.G.strikeT > 0, "после отпускания удар снова возможен");
});

test("пульт ТВ: короткий тап крестовины не теряется между кадрами", () => {
  const { K } = loadGame();
  K.resetSave(); K.G.day = 0; K.sg(); setupWorld(K, { wy: 5000 });
  K.G.s = "playing";
  const up = ev({ key: "Unidentified", keyCode: 19 });
  K.onKeyDown(up); K.onKeyUp(up);                   // нажал и отпустил мгновенно
  assert.ok(K.keyHeld("ArrowUp"), "короткий тап ещё держится");
  assert.ok(K.rowInput() > 0, "короткий тап даёт гребок");
  const right = ev({ key: "Unidentified", keyCode: 22 });
  K.onKeyDown(right); K.onKeyUp(right);
  assert.ok(K.keyHeld("ArrowRight"), "короткий тап руля ещё держится");
  // Быстрый реверс: новый тап влево гасит «хвост» вправо.
  const left = ev({ key: "Unidentified", keyCode: 21 });
  K.onKeyDown(left);
  assert.ok(!K.keyHeld("ArrowRight"), "правый хвост погашен");
  assert.ok(K.keyHeld("ArrowLeft"), "руль ушёл влево");
});

test("пульт ТВ: в заплыве стрелки и OK не листают страницу и меню", () => {
  const { K } = loadGame();
  K.resetSave(); K.G.day = 0; K.sg(); setupWorld(K, { wy: 5000 });
  K.G.s = "playing";
  for (const keyCode of [19, 20, 21, 22, 23]) {
    let prevented = false;
    K.onKeyDown(ev({ keyCode, preventDefault: () => { prevented = true; } }));
    assert.ok(prevented, "код " + keyCode + " перехвачен");
  }
});

test("пульт ТВ: после имени фокус снимается, а клавиша из скрытого поля не пропадает", () => {
  const { K, sandbox } = loadGame();
  K.resetSave(); K.G.day = 0; K.sg(); setupWorld(K, { wy: 5000 });
  K.G.s = "playing";
  const orig = sandbox.document.getElementById;
  let saved = 0, blurred = 0, prevented = 0;
  sandbox.document.getElementById = id =>
    id === "saveNameBtn" ? { click: () => { saved++; } }
    : id === "finishScreen" ? { classList: { contains: () => true } }   // экран уже скрыт
    : orig(id);
  const input = { tagName: "INPUT", blur: () => { blurred++; } };
  K.onKeyDown(ev({ key: "Enter", keyCode: 13, target: input, preventDefault: () => { prevented++; } }));
  assert.equal(saved, 1, "имя сохранено");
  assert.equal(blurred, 1, "фокус снят — OK больше не застревает в поле");
  assert.equal(prevented, 1);
  // Экран с полем скрыт — стрелка должна дойти до игры, а не уснуть в поле.
  K.onKeyDown(ev({ key: "Unidentified", keyCode: 21, target: input, preventDefault: () => { prevented++; } }));
  assert.ok(blurred >= 2);
  assert.ok(K.keyHeld("ArrowLeft"), "руль получил клавишу");
});
