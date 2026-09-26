// Инструменты спрайтов (tools/) и арт-правило «один размер пикселя».
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { INDEX, loadSprites, findMapSpan } from "../tools/sprites-lib.mjs";
import { DATA_FILE, renderDataFile } from "../tools/sprite-data.mjs";
import { applySprite } from "../tools/sprite-apply.mjs";

const data = loadSprites();

test("tools/sprite-data.js совпадает с index.html (иначе редактор покажет старые спрайты)", () => {
  assert.equal(readFileSync(DATA_FILE, "utf8"), renderDataFile(data),
    "устарел — запусти: node tools/sprite-data.mjs");
});

// Арт-правило: у всех спрайтов на экране один размер пикселя (×3).
// Спрайт с другим увеличением выглядит «из другой игры» (миксели).
// Список ниже — старый долг. Он может только сокращаться: когда спрайт
// перерисован под ×3, его надо убрать из списка, иначе тест упадёт.
// Остались только кадры костра из мультов: мульты сознательно не трогаем.
const MIXEL_DEBT = ["fire0", "fire1", "fire2"];

test("один размер пикселя: новые спрайты только ×" + data.SCALE, () => {
  const off = Object.entries(data.sprites)
    .filter(([n, s]) => Math.abs(s.scale - data.SCALE) > 1e-9).map(([n]) => n).sort();
  const fresh = off.filter(n => !MIXEL_DEBT.includes(n));
  assert.deepEqual(fresh, [], "новые спрайты с чужим размером пикселя: " + fresh.join(", "));
  const repaid = MIXEL_DEBT.filter(n => !off.includes(n));
  assert.deepEqual(repaid, [], "уже ×" + data.SCALE + " — убери из MIXEL_DEBT: " + repaid.join(", "));
});

function withCopy(fn) {
  const dir = mkdtempSync(join(tmpdir(), "kayak-spr-"));
  const html = join(dir, "index.html");
  writeFileSync(html, readFileSync(INDEX));
  try { return fn(html); } finally { rmSync(dir, { recursive: true, force: true }); }
}

test("sprite-apply: новая карта попадает в игру, остальные спрайты не задеты", () => {
  withCopy(html => {
    const map = ["..kk..", ".kOOk.", "kOnnOk", ".kOOk."];
    applySprite({ name: "log", map, base: data.sprites.log.map }, { htmlPath: html });
    const after = loadSprites(html);
    assert.deepEqual(after.sprites.log.map, map);
    for (const n of ["bread", "barge", "tent", "rower"])
      assert.deepEqual(after.sprites[n].map, data.sprites[n].map, n + " изменился, а не должен");
    // Стиль переносов строк файла сохраняется (сейчас LF; был бы CRLF — остался бы CRLF).
    const crlf = s => s.includes("\r\n");
    assert.equal(crlf(readFileSync(html, "utf8")), crlf(readFileSync(INDEX, "utf8")), "сменился стиль переносов строк");
  });
});

test("sprite-apply: отказывает на кривой карте, чужой палитре и производном спрайте", () => {
  withCopy(html => {
    const before = readFileSync(html, "utf8");
    assert.throws(() => applySprite({ name: "log", map: ["kkk", "kk"] }, { htmlPath: html }), /длина/);
    assert.throws(() => applySprite({ name: "log", map: ["k#k"] }, { htmlPath: html }), /палитре/);
    assert.throws(() => applySprite({ name: "tent_lit", map: ["kkk"] }, { htmlPath: html }), /tent/);
    assert.equal(readFileSync(html, "utf8"), before, "после отказа файл изменился");
  });
});

test("sprite-apply: не затирает спрайт, изменённый после выгрузки в редактор", () => {
  withCopy(html => {
    const stale = ["kk", "kk"];                       // «исходник», которого в игре уже нет
    assert.throws(() => applySprite({ name: "log", map: ["OO"], base: stale }, { htmlPath: html }), /изменился/);
    applySprite({ name: "log", map: ["OO"], base: stale }, { htmlPath: html, force: true });
    assert.deepEqual(loadSprites(html).sprites.log.map, ["OO"]);
  });
});

test("replaceMap в файле с CRLF пишет CRLF", async () => {
  const { replaceMap } = await import("../tools/sprites-lib.mjs");
  const src = "const SPR = {\r\n  log:{map:[\"kk\",\r\n    \"kk\"]},\r\n};\r\n";
  const out = replaceMap(src, "log", ["OO", "OO", "OO"]);
  assert.ok(!/[^\r]\n/.test(out), "есть LF без CR");
  assert.ok(out.includes('"OO",\r\n    "OO"'));
});

test("findMapSpan находит карты, собранные выражениями rep(...)", () => {
  const src = readFileSync(INDEX, "utf8");
  for (const n of ["rower_wind", "barge", "log", "fire0"]) {
    const s = findMapSpan(src, n);
    assert.ok(s, n + " не найден");
    assert.equal(src[s.start], "[");
    assert.equal(src[s.end - 1], "]");
  }
});
