// Вшивает свой звук в игру: node tools/add-sound.mjs <гнездо> <файл>
// Гнёзда — ключи SOUNDS в index.html (crunch — батон, gulp — виски).
// Файл (mp3/wav/ogg) кладётся как data:-URL, игра остаётся одним файлом.
import { readFileSync, writeFileSync, statSync } from "node:fs";
import { extname } from "node:path";
import { fileURLToPath } from "node:url";

const INDEX = fileURLToPath(new URL("../index.html", import.meta.url));
const MIME = { ".mp3": "audio/mpeg", ".wav": "audio/wav", ".ogg": "audio/ogg", ".m4a": "audio/mp4" };
export const SOUND_MAX = 120 * 1024;

export function addSound(slot, file, htmlPath = INDEX) {
  const mime = MIME[extname(file).toLowerCase()];
  if (!mime) throw new Error("Нужен mp3, wav, ogg или m4a, а не " + (extname(file) || "файл без расширения"));
  const size = statSync(file).size;
  if (size > SOUND_MAX) throw new Error("Файл " + Math.round(size / 1024) + " КБ — больше " + SOUND_MAX / 1024 +
    " КБ. Обрежь до 1–2 секунд или сохрани в mp3 96 кбит/с.");
  const html = readFileSync(htmlPath, "utf8");
  const re = new RegExp("(\\n  " + slot + ": )\"[^\"]*\"(,)");
  if (!re.test(html)) throw new Error("В игре нет гнезда «" + slot + "». Есть: crunch (батон), gulp (виски).");
  const url = "data:" + mime + ";base64," + readFileSync(file).toString("base64");
  writeFileSync(htmlPath, html.replace(re, (m, a, b) => a + JSON.stringify(url) + b));
  return { slot, bytes: size };
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url).toLowerCase() === process.argv[1].toLowerCase();
if (isMain) {
  const [slot, file] = process.argv.slice(2);
  if (!slot || !file) { console.log("Использование: node tools/add-sound.mjs crunch|gulp <файл>"); process.exit(1); }
  try {
    const r = addSound(slot, file);
    console.log("Звук «" + r.slot + "» вшит в index.html (" + Math.round(r.bytes / 1024) + " КБ). Обнови страницу игры.");
  } catch (e) { console.error("Не получилось: " + e.message); process.exit(1); }
}
