// Замок рисунков: отпечаток каждого спрайта (карта + расцветки) лежит в
// tests/sprite-lock.json; тест tests/sprite-lock.test.mjs сверяет. Рисунок,
// случайно откатившийся при переделке, роняет тест «рисунок не откатился: имя».
// Нарочно перерисовал — обнови отпечаток:
//   node tools/sprite-lock.mjs            — все спрайты
//   node tools/sprite-lock.mjs pack oar   — только эти
// tools/sprite-apply.mjs обновляет отпечаток записанного спрайта сам.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { loadSprites, isMain } from "./sprites-lib.mjs";

export const LOCK = fileURLToPath(new URL("../tests/sprite-lock.json", import.meta.url));
export function spriteHash(s) {
  return createHash("sha1").update(JSON.stringify({ map: s.map, variants: s.variants || [] })).digest("hex").slice(0, 12);
}
export function updateLock(names) {
  const { sprites } = loadSprites();
  const lock = existsSync(LOCK) ? JSON.parse(readFileSync(LOCK, "utf8")) : {};
  // С рисунком обновляются и собранные из него (зеркальные «_l», перекраски):
  // их карта меняется вместе с исходной.
  let list = names && names.length ? names.slice() : Object.keys(sprites);
  if (names && names.length) for (const [n, s] of Object.entries(sprites))
    if (names.some(b => (s.note || "").includes("«" + b + "»") || n === b + "_l")) list.push(n);   // _l — зеркальная копия из цикла
  for (const n of list) if (sprites[n]) lock[n] = spriteHash(sprites[n]);
  const sorted = Object.fromEntries(Object.keys(lock).sort().map(k => [k, lock[k]]));
  writeFileSync(LOCK, JSON.stringify(sorted, null, 1) + "\n");
  return sorted;
}
if (isMain(import.meta.url)) {
  const lock = updateLock(process.argv.slice(2));
  console.log("tests/sprite-lock.json: " + Object.keys(lock).length + " спрайтов");
}
