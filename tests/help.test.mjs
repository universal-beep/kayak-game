// Справка: одна и та же «ПОМОЩЬ» со старта, из паузы и с карты; возвращает
// туда, откуда пришли. Подсказку можно повторить кнопкой из паузы.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { loadGame } from "./harness.mjs";

const html = readFileSync(fileURLToPath(new URL("../index.html", import.meta.url)), "utf8");
const css = html.match(/<style>([\s\S]*?)<\/style>/)[1];

test("справка доступна из паузы и повторяется по кнопке", () => {
  for (const id of ["startHelpBtn", "pauseHelpBtn", "pauseHintBtn", "mapTutBtn"]){
    assert.ok(html.includes('id="' + id + '"'), "нет кнопки " + id);
  }
  assert.match(css, /@media \(max-width:768px\) \{ \.diary \{ font-size:10px; \}/);

  const { K, sandbox } = loadGame();
  const els = {};
  const orig = sandbox.document.getElementById;
  sandbox.document.getElementById = id => els[id] || (els[id] = orig(id));
  K.G.s = "paused";
  K.showHelp("pause");
  for (const part of ["УПРАВЛЕНИЕ", "ЦЕЛИ ДНЯ", "БАТОН", "ВИСКИ"]) {
    assert.ok(els.diaryText.innerHTML.includes(part), "в справке нет раздела " + part);
  }

  K.backFromDiary();
  assert.equal(K.G.s, "paused", "из справки вернулись в паузу");

  K.repeatHint();
  assert.ok(K.G.hint && /РУЛЬ/.test(K.G.hint.text), "подсказка повторена");
  assert.equal(K.G.s, "playing", "пауза снята");
});
