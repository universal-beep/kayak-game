// Все экраны меню лежат внутри #ui. Лишний </div> сразу после заставки
// закрывал #ui, и пауза, финиш, лагерь, маршрут, редактор и прочие экраны
// становились детьми body. Пока холст был без z-index, это не мешало; когда
// для боковых зон холсту дали z-index:1, он лёг поверх этих экранов — их не
// было видно и по кнопкам не нажать.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const html = readFileSync(fileURLToPath(new URL("../index.html", import.meta.url)), "utf8");
const body = html.slice(html.indexOf("<body>"), html.indexOf("<script>"));

const SCREENS = ["startScreen", "continueScreen", "pauseScreen", "endScreen", "mapScreen", "finishScreen", "failScreen",
                 "campScreen", "diaryScreen", "recordsScreen", "editScreen", "customEnd"];

test("каждый экран меню вложен в #ui", () => {
  const start = body.indexOf('<div id="ui">');
  assert.ok(start >= 0);
  // где закрывается #ui
  const re = /<div\b|<\/div>/g;
  re.lastIndex = start;
  let depth = 0, end = -1, m;
  while ((m = re.exec(body))) {
    depth += m[0] === "</div>" ? -1 : 1;
    if (depth === 0) { end = m.index; break; }
  }
  assert.ok(end > start, "#ui закрывается");
  for (const id of SCREENS) {
    const at = body.indexOf('id="' + id + '"');
    assert.ok(at > 0, "нет экрана " + id);
    assert.ok(at > start && at < end, id + " вне #ui");
  }
});

test("div в разметке сбалансированы", () => {
  const open = (body.match(/<div\b/g) || []).length, close = (body.match(/<\/div>/g) || []).length;
  assert.equal(close, open);
});
