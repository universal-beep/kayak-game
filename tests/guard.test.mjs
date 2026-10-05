// Сторож просьб (tools/guard.mjs, 05.10.2026): у сделанной просьбы есть тесты-
// сторожа; переделка, которая откатила старое исправление, роняет его сторожа —
// и отправка на GitHub не проходит, с именем просьбы. Раньше откаты (полоска
// пути, название заставки) находились глазами спустя дни.
import test from "node:test";
import assert from "node:assert/strict";
import { checkGuards, stageOf, linkScore, stems } from "../tools/guard-lib.mjs";

const idx = [
  { file: "tests/a.test.mjs", name: "полоска пути у края окна", ok: true },
  { file: "tests/b.test.mjs", name: "название на заставке видно", ok: false },
  { file: "tests/c.test.mjs", name: "мобильная версия, день 1: всё хорошо", ok: true }
];

test("сторож: упавший — откат, пропавший — потерян, без сторожа — отмечен", () => {
  const reqs = [
    { id: "R001", status: "done", ask: "полоска", guards: ["полоска пути у края окна"] },
    { id: "R002", status: "done", ask: "заставка", guards: ["название на заставке видно"] },
    { id: "R003", status: "done", ask: "куст", guards: ["куст на месте"] },
    { id: "R004", status: "done", ask: "без теста" },
    { id: "R005", status: "todo", ask: "ещё не сделано" },
    { id: "R006", status: "done", ask: "день", guards: ["мобильная версия, день *"] },
    { id: "R007", status: "done", ask: "закоммитить", kind: "без кода" }
  ];
  const r = checkGuards(reqs, idx);
  assert.deepEqual(r.broken.map(b => b.id), ["R002"], "упал сторож");
  assert.deepEqual(r.lost.map(b => b.id), ["R003"], "сторожа больше нет среди тестов");
  assert.deepEqual(r.unguarded.map(b => b.id), ["R004"], "сделано, но без сторожа");
  assert.equal(r.ok.length, 2, "R001 и R006 (шаблон с *) в порядке");
});

test("этап просьбы: от просьбы до «проверено»", () => {
  const onSite = new Set(["aaa"]);
  assert.equal(stageOf({ status: "todo" }, onSite), "просьба");
  assert.equal(stageOf({ status: "work" }, onSite), "в работе");
  assert.equal(stageOf({ status: "in_progress" }, onSite), "в работе");
  assert.equal(stageOf({ status: "done", commits: ["bbb"] }, onSite), "в коде");
  assert.equal(stageOf({ status: "done", commits: ["aaa"] }, onSite), "на сайте");
  assert.equal(stageOf({ status: "done", commits: ["aaa"], verified: "05.10.2026" }, onSite), "проверено");
  assert.equal(stageOf({ status: "done" }, onSite), "сделано");
});

test("связь просьбы с коммитом — по общим словам (основы слов)", () => {
  assert.ok(stems("Велодорога перекрывает охотника").has("велод"));
  const req = { ask: "велодорога перекрывает охотника и медведя", result: "дорога нижним слоем" };
  assert.ok(linkScore(req, "fix(desktop): велодорога нижним слоем по траве") >= 2);
  assert.ok(linkScore(req, "feat: бонус солнце — дорожка") < 2);
});

test("просьбы без кода (вопрос, коммит, критика) узнаются по началу", async () => {
  const { isNoCode } = await import("../tools/guard-lib.mjs");
  for (const a of ["Закоммитить сделанное", "Покритиковать, что на берегах", "На каком дне появляются музыканты?", "Поискать скиллы"]) assert.ok(isNoCode(a), a);
  for (const a of ["Перерисовать батон", "Батон в 1,5 раза меньше"]) assert.ok(!isNoCode(a), a);
});
