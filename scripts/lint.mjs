// Линтер для kayak-game/index.html.
// В проекте нет eslint/prettier — гейт проверяет то, что реально ломает игру:
//  1. inline-скрипт компилируется (без SyntaxError);
//  2. игра грузится в VM-харнессе и экспортирует __KAYAK__;
//  3. все SPR-карты имеют строки одинаковой ширины;
//  4. спрайты из CUTS существуют в SPR;
//  5. у каждого спрайта, на который ведёт CUTS, есть варианты, если на них есть ссылки.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Script } from "node:vm";
import { loadGame } from "../tests/harness.mjs";

const FILE = fileURLToPath(new URL("../index.html", import.meta.url));
const html = readFileSync(FILE, "utf8");
let errors = 0;

function err(msg) { console.error("LINT ERROR: " + msg); errors++; }

// 1. Синтаксис — компилируем без исполнения
const src = html.match(/<script>([\s\S]*)<\/script>/);
if (!src) { err("нет <script>"); process.exit(1); }
try {
  new Script(src[1], { filename: "index-inline.js" });
} catch (e) {
  err("SyntaxError: " + e.message);
  process.exit(1);
}

// 2. Полная загрузка в харнессе
let K;
try {
  K = loadGame().K;
} catch (e) {
  err("игра не загрузилась в VM: " + e.message);
  process.exit(1);
}
if (!K || !K.SPR || !K.CUTS) err("экспорт неполон: нет SPR/CUTS");

// 3. Ширины строк карт
// shadow — тень-эллипс, строки намеренно разной ширины (растр рисует каждую по себе);
// sitter_guitar_b — «качающийся» кадр гитариста, строки смещены для цикла покачивания.
const ALLOW_UNEVEN = new Set(["shadow", "sitter_guitar_b"]);
for (const [name, spr] of Object.entries(K.SPR)) {
  if (ALLOW_UNEVEN.has(name)) continue;
  if (!spr || !spr.map || !spr.map.length) { err(`SPR.${name}: нет map`); continue; }
  const w = spr.map[0].length;
  spr.map.forEach((row, i) => {
    if (row.length !== w) err(`SPR.${name}: строка ${i} шириной ${row.length}, ожидалось ${w} («${row}»)`);
  });
}

// 4. Ссылки CUTS → SPR
for (const [cname, cut] of Object.entries(K.CUTS)) {
  for (const a of cut.scene || []) {
    if (a.spr && !K.SPR[a.spr]) err(`CUTS.${cname}: нет SPR.${a.spr}`);
    if (a.actor && a.actor.spr && !K.SPR[a.actor.spr]) err(`CUTS.${cname}: нет SPR.${a.actor.spr}`);
  }
}

console.log(errors ? `lint: FAIL (${errors} ошибок)` : "lint: OK");
process.exit(errors ? 1 : 0);