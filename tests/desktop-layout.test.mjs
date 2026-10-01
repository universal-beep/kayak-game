// Десктоп: берега и панели по бокам широкого окна, на телефоне — как раньше.
import test from "node:test";
import assert from "node:assert/strict";
import { loadGame, setupWorld } from "./harness.mjs";

test("раскладка: на широком окне поле по центру и панели, на узком — без панелей", () => {
  const { K } = loadGame();
  const wide = K.sideLayout(1920, 1080, 420, 720);
  assert.equal(wide.cssH, 1080);
  assert.equal(wide.cssW, 630);
  assert.equal(wide.side, 645);
  assert.ok(wide.panels);
  const phone = K.sideLayout(390, 800, 420, 720);
  assert.equal(phone.side, 0);
  assert.ok(!phone.panels);
  const tablet = K.sideLayout(1024, 768, 420, 720);        // поле ~448 px, по бокам по ~288 — панели есть
  assert.equal(tablet.side, Math.floor((1024 - tablet.cssW)/2));
  assert.equal(tablet.panels, tablet.side >= K.PANEL_MIN_SIDE);
  const narrow = K.sideLayout(700, 720, 420, 720);          // по бокам по 140 — панелей нет
  assert.ok(!narrow.panels);
});

test("цель дня: понятный счёт по каждому виду цели", () => {
  const { K } = loadGame();
  const L = (goal, need) => ({ goal, need });
  const st = { bonuses: 3, passed: 2, shallowsHit: 1, parries: 4, bridges: 1, hp: 2, cleanRapids: 0, maxCombo: 12 };
  assert.equal(K.goalProgress(L("bonuses", 5), st), "3 / 5");
  assert.equal(K.goalProgress(L("passed", 6), st), "2 / 6");
  assert.match(K.goalProgress(L("shallowsmax", 1), st), /мелей: 1/);
  assert.equal(K.goalProgress(L("parries", 3), st), "4 / 3");
  assert.equal(K.goalProgress(L("bridges", 4), st), "1 / 4");
  assert.match(K.goalProgress(L("hearts", 1), st), /сердец: 2/);
  assert.equal(K.goalProgress(L("cleanrapids", 3), st), "0 / 3");
  assert.match(K.goalProgress(L("combo", 20), st), /12 \/ 20/);
  assert.equal(K.goalProgress(L("нет", 1), st), "");
});

test("панели: левая — день, цель, маршрут и справка; правая — таблица, бонусы, управление", () => {
  const { K } = loadGame();
  K.resetSave(); K.G.day = 4; K.sg(); setupWorld(K, { wy: 5000 }); K.G.s = "playing";
  const left = K.panelLeftHtml(), right = K.panelRightHtml();
  assert.ok(left.includes("ДЕНЬ 5") && left.includes("ТВЕРЦА"));
  assert.ok(left.includes("ЦЕЛЬ ДНЯ") && left.includes("Пройти 4 моста"));
  assert.ok(left.includes("ПОХОД") && (left.match(/class='rt/g) || []).length === 9, "девять дней маршрута");
  assert.ok(left.includes("cur"), "текущий день выделен");
  assert.ok(left.includes("Тверца"), "справка о месте");
  assert.ok(right.includes("ТАБЛИЦА") && right.includes("БОНУСЫ") && right.includes("УПРАВЛЕНИЕ") && right.includes("геймпад"));
  assert.equal((right.match(/data-ic=/g) || []).length, 5, "иконки пяти бонусов");
  K.G.mazai = { n: 10, spawned: 4, got: 3, gone: 0, wait: 0, t: 100, done: false };
  K.G.yacht = true;
  assert.ok(K.panelLeftHtml().includes("МАЗАЙ") && K.panelLeftHtml().includes("ЯХТА"));
});

test("панели: имя и текст экранируются, свой уровень без маршрута похода", () => {
  const { K } = loadGame();
  K.resetSave(); K.G.day = 0; K.sg();
  K.G.custom = { custom: true, day: 0, river: 0, len: 500, goal: "none", need: 0, goalText: "<b>Дойти</b>", place: "СВОЙ УРОВЕНЬ", items: [] };
  const left = K.panelLeftHtml();
  assert.ok(left.includes("СВОЙ УРОВЕНЬ") && !left.includes("class='rt"), "маршрута нет");
  assert.ok(!left.includes("<b>Дойти</b>"), "текст экранирован");
  assert.ok(K.panelRightHtml().includes("РЕКОРД УРОВНЯ"));
});

test("фон по бокам и панели рисуются без ошибок; на телефоне ничего не рисуют", () => {
  const { K, sandbox } = loadGame();
  K.resetSave(); K.G.day = 2; K.sg(); setupWorld(K, { wy: 5000 }); K.G.s = "playing";
  assert.doesNotThrow(() => K.drwSides(), "ширина поля = окну: боков нет");
  sandbox.innerWidth = 1600; sandbox.innerHeight = 900;
  assert.doesNotThrow(() => K.layoutSides(630, 900, false));
  assert.doesNotThrow(() => K.drwSides());
  assert.doesNotThrow(() => K.updPanels(true));
  for (const d of [0, 1, 2, 3]) { K.G.day = d * 2; assert.doesNotThrow(() => K.drwSides(), "река " + d); }
  assert.doesNotThrow(() => K.layoutSides(420, 720, true));
});

test("боковые зоны — продолжение уровня: тот же drwBg шире поля, у каждой реки свой декор, холст игры не подменяется", () => {
  const { K, sandbox } = loadGame();
  K.resetSave(); K.sg();
  sandbox.innerWidth = 1600; sandbox.innerHeight = 900;
  K.layoutSides(630, 900, false);
  const ctx = sandbox.document.getElementById("bgCanvas").getContext("2d");
  const base = ctx.drawImage, xs = [];
  const seen = day => {
    K.G.day = day; setupWorld(K, { wy: 9000 }); K.G.s = "playing"; xs.length = 0;
    ctx.drawImage = function (img, x, y) { xs.push(x); return base.apply(this, arguments); };
    K.drwSides();
    ctx.drawImage = base;
    return xs.slice();
  };
  const volga = seen(0);
  assert.ok(volga.some(x => x < -40), "декор в левой боковой зоне (за краем поля)");
  assert.ok(volga.some(x => x > 420 + 40), "и в правой");
  // Набор декора разных рек различается: Осуга — глухая тайга, Тверца — деревня.
  assert.notDeepEqual(K.DEEP_SETS[3], K.DEEP_SETS[2]);
  assert.ok(K.DEEP_SETS[2].includes("house") && K.DEEP_SETS[3].every(n => n !== "house"));
  assert.ok(seen(7).length > 0, "Осуга рисуется");
  // Меню: продолжение заставки по бокам, без ошибок.
  K.G.s = "start";
  assert.doesNotThrow(() => K.drwSides());
  // Холст игры после рисования боков тот же, что был (cx не остался на фоновом).
  K.G.s = "playing";
  assert.doesNotThrow(() => K.rndr());
});
