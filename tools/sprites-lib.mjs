// Общая часть инструментов для спрайтов: достать карты из index.html,
// разложить по группам, вписать исправленную карту обратно.
// Игра грузится тем же VM-харнессом, что и тесты (tests/harness.mjs), —
// поэтому карты, собранные кодом (rep(...), swapPalette), приходят
// уже развёрнутыми, ровно такими, какими их видит игра.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { loadGame } from "../tests/harness.mjs";

export const ROOT = fileURLToPath(new URL("..", import.meta.url));

// Запущен ли модуль напрямую (node tools/x.mjs), а не импортирован.
// Сравнение без учёта регистра: на Windows буква диска бывает то C:, то c:.
export function isMain(metaUrl) {
  if (!process.argv[1]) return false;
  return path.resolve(fileURLToPath(metaUrl)).toLowerCase() === path.resolve(process.argv[1]).toLowerCase();
}
export const INDEX = fileURLToPath(new URL("../index.html", import.meta.url));

// Группы для редактора и листа спрайтов. Спрайт, которого здесь нет,
// попадает в «Катсцены и прочее».
export const GROUPS = [
  ["Река: препятствия", ["log", "branch", "snag", "boulder", "fang", "slab", "mossy", "pebbles", "barge", "boat", "shallows"]],
  ["Бонусы", ["bread", "whisky", "medkit", "axe", "sun"]],
  ["Лодки", ["kayak_center", "kayak_left", "kayak_right", "rower", "rower_flip", "oar"]],
  ["Берег и финиш: природа", ["tree", "sfir", "sbirch", "sbush", "bush", "bear", "bear_b", "bear_swim", "bear_swim_b", "bear_wave", "bear_wave_b", "dog_lie", "dog_run", "dog_run_b", "dog_jump", "dog_swim", "badge", "hare_isle", "yacht", "duck", "duckfly0", "duckfly1", "fish"]],
  ["Берег и финиш: люди и лагерь", ["person", "girl", "sitter", "guitarist", "guitarist_b", "night_guitar", "night_guitar_b", "note", "fisher", "tent", "tent2", "pack", "fire", "tower", "church", "house"]],
  ["Пляж", ["sunbather", "sunbather_f", "towel", "umbrella", "swimmer0", "swimmer1"]],
  ["Мосты", ["bridge", "truss", "deck", "pier", "shadow"]],
];
export const OTHER_GROUP = "Катсцены и прочее";

// Где в исходнике лежит литерал карты: `  name:{map:[ ... ]` внутри блока
// `const SPR = { ... };`. Возвращает границы массива [start, end) или null.
export function findMapSpan(src, name) {
  const sprStart = src.indexOf("const SPR = {");
  if (sprStart < 0) return null;
  const re = new RegExp("(^|[\\r\\n])[ \\t]*" + name + "\\s*:\\s*\\{\\s*map\\s*:\\s*\\[", "g");
  re.lastIndex = sprStart;
  const m = re.exec(src);
  if (!m) return null;
  const start = m.index + m[0].length - 1;      // позиция «[»
  // Конец массива: считаем скобки вне строковых литералов.
  let depth = 0, q = null;
  for (let i = start; i < src.length; i++) {
    const ch = src[i];
    if (q) { if (ch === "\\") i++; else if (ch === q) q = null; continue; }
    if (ch === '"' || ch === "'") { q = ch; continue; }
    if (ch === "[") depth++;
    else if (ch === "]" && --depth === 0) return { start, end: i + 1 };
  }
  return null;
}

// Спрайт, целиком пересобранный из другого (tent_lit = swapPalette(tent)),
// в редакторе не правится: править надо исходный.
export function derivedFrom(src, name) {
  const m = src.match(new RegExp("SPR\\." + name + "\\s*=\\s*\\{\\s*map\\s*:\\s*swapPalette\\(\\s*SPR\\.(\\w+)\\.map"));
  return m && m[1] !== name ? m[1] : null;
}

export function loadSprites(htmlPath = INDEX) {
  const src = readFileSync(htmlPath, "utf8");
  const { K } = loadGame(htmlPath);
  const groupOf = {};
  for (const [g, names] of GROUPS) for (const n of names) groupOf[n] = g;
  const sprites = {};
  for (const name of Object.keys(K.SPR)) {
    const s = K.SPR[name];
    if (!s || !Array.isArray(s.map)) continue;
    const base = derivedFrom(src, name);
    const span = findMapSpan(src, name);
    sprites[name] = {
      map: [...s.map],          // массив этого процесса, а не песочницы VM
      scale: K.spriteSize(name).w / s.map[0].length,
      // Варианты одежды/окраски — перекраска по таблице «символ → символ».
      variants: Array.isArray(s.variants) ? s.variants.map(v => ({ ...v })) : [],
      group: groupOf[name] || OTHER_GROUP,
      editable: !base && !!span,
      note: base ? "собран из «" + base + "» — правь исходный" : (!span ? "не найден литерал карты" : ""),
    };
  }
  return { PAL: { ...K.PAL }, SCALE: K.SCALE, groups: [...GROUPS.map(g => g[0]), OTHER_GROUP], sprites };
}

// Проверка карты перед записью: прямоугольная, только ключи палитры и точка.
export function validateMap(map, PAL) {
  const errs = [];
  if (!Array.isArray(map) || !map.length) return ["пустая карта"];
  const w = map[0].length;
  map.forEach((row, y) => {
    if (typeof row !== "string") { errs.push("строка " + y + " не текст"); return; }
    if (row.length !== w) errs.push("строка " + y + ": длина " + row.length + " вместо " + w);
    for (const ch of row) if (ch !== "." && !(ch in PAL)) { errs.push("строка " + y + ": символа «" + ch + "» нет в палитре"); break; }
  });
  return errs;
}

// Вписать новую карту вместо старой. Перенос строк берётся из самого файла.
export function replaceMap(src, name, map) {
  const span = findMapSpan(src, name);
  if (!span) throw new Error("в index.html не найден литерал карты «" + name + "»");
  const eol = src.includes("\r\n") ? "\r\n" : "\n";
  const body = "[" + map.map(r => JSON.stringify(r)).join("," + eol + "    ") + "]";
  return src.slice(0, span.start) + body + src.slice(span.end);
}
