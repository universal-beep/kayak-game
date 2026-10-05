// Замок рисунков (05.10.2026): каждый спрайт сверяется с отпечатком в
// tests/sprite-lock.json. Раньше рисунок мог тихо откатиться при переделке
// (куст пришлось возвращать из коммита). Нарочно перерисовал — обнови отпечаток:
// node tools/sprite-lock.mjs имя (sprite-apply делает это сам).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadSprites } from "../tools/sprites-lib.mjs";
import { spriteHash } from "../tools/sprite-lock.mjs";

const lock = JSON.parse(readFileSync(new URL("./sprite-lock.json", import.meta.url), "utf8"));
const { sprites } = loadSprites();

test("у каждого спрайта есть отпечаток в замке", () => {
  const missing = Object.keys(sprites).filter(n => !lock[n]);
  assert.deepEqual(missing, [], "новый спрайт — node tools/sprite-lock.mjs " + missing.join(" "));
});
for (const name of Object.keys(lock)) {
  test("рисунок не откатился: " + name, () => {
    assert.ok(sprites[name], "спрайта «" + name + "» больше нет в игре");
    assert.equal(spriteHash(sprites[name]), lock[name], "«" + name + "» изменился. Нарочно — node tools/sprite-lock.mjs " + name);
  });
}
