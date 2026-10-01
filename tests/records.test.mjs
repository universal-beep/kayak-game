// Таблица рекордов: игрок виден и подписан, строка ниже восьмого места не
// пропадает, итог захода и рекорд считаются, имя меняется во всех днях.
import test from "node:test";
import assert from "node:assert/strict";
import { loadGame } from "./harness.mjs";

function fresh() {
  const { K } = loadGame();
  K.resetSave();
  return K;
}

test("таблица дня: игрок ниже восьмого места всё равно виден, с настоящим местом", () => {
  const K = fresh();
  K.ensureBoard(1);
  K.addResult(1, "МАКС", 1);          // заведомо ниже всех соперников
  const v = K.boardView(1, 5);
  assert.equal(v.rows.length, 7, "5 строк, разрыв и строка игрока");
  assert.ok(v.rows[5].gap, "разрыв перед строкой игрока");
  assert.equal(v.rows[6].name, "МАКС");
  assert.equal(v.rows[6].rank, v.total, "место — последнее из всех");
  assert.ok(v.rows[6].mine);
});

test("строка игрока подписана (ВЫ), чужие — нет, имя в таблице экранируется", () => {
  const K = fresh();
  K.addResult(1, "<b>X</b>", 99999);
  const html = K.boardHtml(1);
  assert.ok(html.includes("(ВЫ)"));
  assert.equal(html.split("(ВЫ)").length - 1, 1, "только одна строка — твоя");
  assert.ok(!html.includes("<b>X</b>"), "имя не исполняется как HTML");
  assert.ok(html.includes("&lt;b&gt;X"));
});

test("итог захода: рекорд, не рекорд и первый результат", () => {
  const K = fresh();
  K.addResult(1, "МАКС", 500);
  let r = K.runSummary(1, 500, 0);
  assert.ok(r.record && r.first, "первый результат дня");
  K.addResult(1, "МАКС", 700);
  r = K.runSummary(1, 700, 500);
  assert.ok(r.record && !r.first && r.best === 700, "новый рекорд");
  K.addResult(1, "МАКС", 300);        // хуже прежнего
  r = K.runSummary(1, 300, 700);
  assert.ok(!r.record, "слабый заход рекордом не считается");
  assert.equal(r.run, 300);
  assert.equal(r.best, 700, "лучший остаётся прежним, но заход показан отдельно");
});

test("смена имени правит все дни, а не только текущий", () => {
  const K = fresh();
  K.addResult(1, "ПУТНИК", 400);
  K.addResult(2, "ПУТНИК", 500);
  assert.ok(K.renameMe("  маша  "));
  assert.equal(K.save.name, "МАША");
  for (const d of [1, 2]) assert.equal(K.mineRow(d).name, "МАША", "день " + d);
  assert.ok(!K.renameMe("   "), "пустое имя не принимается");
  assert.equal(K.save.name, "МАША");
});

test("имя обрезается до 12 знаков", () => {
  const K = fresh();
  assert.equal(K.cleanName("абвгдеёжзийклмнопр"), "АБВГДЕЁЖЗИЙК");
});

test("экран рекордов листает только открытые дни", () => {
  const K = fresh();
  assert.doesNotThrow(() => K.showRecords());
  assert.doesNotThrow(() => K.showRecords(5));   // закрытый день — зажимается
});
