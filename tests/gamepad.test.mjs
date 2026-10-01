// Геймпад, пульт эмулятора, меню с клавиатуры.
import test from "node:test";
import assert from "node:assert/strict";
import { loadGame, setupWorld } from "./harness.mjs";

const pad = (o = {}) => {
  const buttons = Array.from({ length: 16 }, (_, i) => ({ pressed: !!(o.b && o.b.includes(i)), value: o.b && o.b.includes(i) ? 1 : 0 }));
  return { connected: true, axes: o.axes || [0, 0, 0, 0], buttons };
};

test("разбор геймпада: крестовина, стик с мёртвой зоной, A/X/B/RB/Start", () => {
  const { K } = loadGame();
  assert.equal(K.gpRead(pad({ b: [14] })).steer, -1);
  assert.equal(K.gpRead(pad({ b: [15] })).steer, 1);
  assert.equal(K.gpRead(pad({ axes: [0.2, 0] })).steer, 0, "мёртвая зона");
  const half = K.gpRead(pad({ axes: [0.64, 0] })).steer;
  assert.ok(half > 0.4 && half < 0.6, "плавный руль: " + half);
  assert.equal(K.gpRead(pad({ axes: [1, 0] })).steer, 1);
  assert.equal(K.gpRead(pad({ axes: [-1, 0] })).steer, -1);
  assert.ok(K.gpRead(pad({ b: [0] })).fwd, "A — вперёд");
  assert.ok(K.gpRead(pad({ b: [7] })).fwd, "правый триггер — вперёд");
  assert.ok(K.gpRead(pad({ axes: [0, -0.9] })).fwd, "стик вверх — вперёд");
  assert.ok(K.gpRead(pad({ b: [2] })).back, "X — табанить");
  assert.ok(K.gpRead(pad({ axes: [0, 0.9] })).back, "стик вниз — табанить");
  const s = K.gpRead(pad({ b: [1, 5, 9] }));
  assert.ok(s.btn[1] && s.btn[5] && s.btn[9]);
  assert.ok(K.gpRead(pad({ axes: [0, -0.9] })).navPrev && K.gpRead(pad({ b: [13] })).navNext);
  assert.ok(!K.gpRead(null).fwd, "пусто — не падает");
});

test("клавиши в меню: стрелки двигают, Enter/Z — OK, Esc/Backspace/X — назад", () => {
  const { K } = loadGame();
  assert.deepEqual(Object.assign({}, K.menuKeyAction("ArrowUp")), { move: -1 });
  assert.deepEqual(Object.assign({}, K.menuKeyAction("ArrowDown")), { move: 1 });
  assert.deepEqual(Object.assign({}, K.menuKeyAction("ArrowLeft")), { move: -1 });
  assert.deepEqual(Object.assign({}, K.menuKeyAction("ArrowRight")), { move: 1 });
  for (const k of ["Enter", " ", "z", "Z", "я", "Я"]) assert.ok(K.menuKeyAction(k).ok, k);
  for (const k of ["Escape", "Backspace", "x", "X", "ч", "Ч"]) assert.ok(K.menuKeyAction(k).back, k);
  assert.equal(K.menuKeyAction("q"), null);
  assert.equal(K.menuStep(4, 3, 1), 0, "по кругу вперёд");
  assert.equal(K.menuStep(4, 0, -1), 3, "по кругу назад");
  assert.equal(K.menuStep(0, 0, 1), 0);
});

function fakeDom(sandbox, screens) {
  const clicks = [];
  const els = {};
  const mk = (id, buttons, hidden) => {
    const set = new Set(hidden ? ["hidden"] : []);
    const el = { id, classList: { add: c => set.add(c), remove: c => set.delete(c), contains: c => set.has(c) } };
    el.querySelectorAll = () => buttons.map(bid => {
      const b = { id: bid, disabled: false, parentElement: null, clicked: 0, scrollIntoView() {} };
      const cs = new Set();
      b.classList = { add: c => cs.add(c), remove: c => cs.delete(c), contains: c => cs.has(c) };
      b.click = () => { clicks.push(bid); };
      els[bid] = b;
      return b;
    });
    els[id] = el;
    return el;
  };
  const base = sandbox.document.getElementById;
  for (const [id, spec] of Object.entries(screens)) mk(id, spec.buttons, spec.hidden);
  sandbox.document.getElementById = id => els[id] || base(id);
  return { clicks, els };
}

test("меню: стрелка ставит фокус на первую кнопку, дальше по кругу; Enter нажимает; до фокуса Enter — как раньше", () => {
  const { K, sandbox } = loadGame();
  const dom = fakeDom(sandbox, { mapScreen: { buttons: ["a", "b", "c"] }, diaryScreen: { buttons: ["diaryBack"], hidden: true } });
  const ev = key => ({ key, preventDefault() {} });
  assert.equal(K.menuKey(ev("Enter")), false, "без фокуса Enter не перехватывается");
  assert.equal(K.menuKey(ev("ArrowDown")), true);
  assert.ok(dom.els.a.classList.contains("gpf"), "фокус на первой");
  K.menuKey(ev("ArrowDown")); K.menuKey(ev("ArrowDown")); K.menuKey(ev("ArrowDown"));
  assert.ok(dom.els.a.classList.contains("gpf"), "вернулся по кругу к первой");
  K.menuKey(ev("ArrowUp"));
  assert.ok(dom.els.c.classList.contains("gpf"), "вверх — на последнюю");
  assert.equal(K.menuKey(ev("Enter")), true);
  assert.deepEqual(dom.clicks, ["c"]);
});

test("меню: «назад» нажимает кнопку возврата открытого экрана", () => {
  const { K, sandbox } = loadGame();
  const dom = fakeDom(sandbox, { mapScreen: { buttons: ["a"], hidden: true }, diaryScreen: { buttons: ["diaryBack"] } });
  const ev = key => ({ key, preventDefault() {} });
  assert.equal(K.menuKey(ev("Escape")), false, "кнопка возврата ещё не создана — не падает");
  K.menuMove(1);                                // создаёт элементы кнопок
  assert.equal(K.menuKey(ev("Escape")), true);
  assert.ok(dom.clicks.includes("diaryBack"));
});

test("геймпад в заплыве: руль, гребок вперёд, удар на B, пауза на Start; Z на клавиатуре тоже гребёт", () => {
  const { K, sandbox } = loadGame();
  K.resetSave(); K.G.day = 0; K.sg(); setupWorld(K, { wy: 5000 });
  K.G.s = "playing";
  let state = pad({ b: [0], axes: [1, 0] });
  sandbox.navigator = { getGamepads: () => [state] };
  K.pollGamepad();
  assert.ok(K.gpState.fwd && K.gpState.steer === 1, "A и стик вправо");
  assert.ok(K.rowInput() > 0, "гребок вперёд идёт в rowInput");
  state = pad({ b: [1], axes: [0, 0] });          // B: удар (по фронту)
  K.G.strikeT = 0;
  K.pollGamepad();
  assert.ok(K.G.strikeT > 0, "взмах");
  K.G.strikeT = 0;
  K.pollGamepad();                                // B удерживается — второго удара нет
  assert.equal(K.G.strikeT, 0);
  state = pad({ b: [9] });
  K.pollGamepad();
  assert.equal(K.G.s, "paused", "Start — пауза");
  state = pad({});
  K.pollGamepad();
  state = pad({ b: [9] });
  K.pollGamepad();
  assert.equal(K.G.s, "playing", "Start снова — играем");
});

test("геймпад в мульте: любая кнопка пропускает; без геймпада всё спокойно", () => {
  const { K, sandbox } = loadGame();
  K.resetSave();
  assert.doesNotThrow(() => K.pollGamepad());                 // navigator в пробе нет
  sandbox.navigator = { getGamepads: () => [null] };
  assert.doesNotThrow(() => K.pollGamepad());
  K.playCut("night", () => {});
  assert.ok(K.G.cut);
  sandbox.navigator = { getGamepads: () => [pad({ b: [0] })] };
  K.pollGamepad();
  assert.equal(K.G.cut, null, "мульт пропущен");
});
