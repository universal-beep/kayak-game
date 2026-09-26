// Выгружает палитру и все спрайты игры в tools/sprite-data.js — из него
// читает редактор спрайтов. Отдельный .js, а не fetch(index.html), чтобы
// редактор открывался двойным кликом (по file:// fetch запрещён).
//   node tools/sprite-data.mjs
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { loadSprites, isMain } from "./sprites-lib.mjs";

export const DATA_FILE = fileURLToPath(new URL("./sprite-data.js", import.meta.url));

export function renderDataFile(data = loadSprites()) {
  return "// Сгенерировано tools/sprite-data.mjs из index.html — руками не править.\n" +
    "window.SPRITE_DATA = " + JSON.stringify(data) + ";\n";
}

if (isMain(import.meta.url)) {
  const data = loadSprites();
  writeFileSync(DATA_FILE, renderDataFile(data));
  console.log("sprite-data.js: " + Object.keys(data.sprites).length + " спрайтов");
}
