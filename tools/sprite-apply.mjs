// Вписывает спрайт из редактора обратно в index.html.
//   node tools/sprite-apply.mjs путь\sprite-log.json
//   node tools/sprite-apply.mjs --latest   — свежий sprite-*.json из «Загрузок»
//   --force — записать, даже если спрайт в игре успели поменять после выгрузки
//
// Защита от затирания: редактор кладёт в файл исходную карту (base). Если
// в index.html сейчас другая — значит, спрайт правили параллельно, и запись
// отменяется, пока не скажешь --force.
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { INDEX, loadSprites, validateMap, replaceMap, findMapSpan, isMain } from "./sprites-lib.mjs";
import { DATA_FILE, renderDataFile } from "./sprite-data.mjs";

export function applySprite(job, { htmlPath = INDEX, force = false } = {}) {
  const { name, map, base } = job;
  const before = loadSprites(htmlPath);
  const cur = before.sprites[name];
  if (!cur) throw new Error("в игре нет спрайта «" + name + "»");
  if (!cur.editable) throw new Error("«" + name + "» так не правится: " + cur.note);
  const errs = validateMap(map, before.PAL);
  if (errs.length) throw new Error("карта с ошибками:\n  " + errs.join("\n  "));
  if (base && !force && JSON.stringify(base) !== JSON.stringify(cur.map))
    throw new Error("«" + name + "» в игре изменился после выгрузки в редактор. " +
      "Открой редактор заново или запусти с --force, чтобы перезаписать.");
  const src = readFileSync(htmlPath, "utf8");
  if (!findMapSpan(src, name)) throw new Error("не найден литерал карты «" + name + "»");
  writeFileSync(htmlPath, replaceMap(src, name, map));
  // Проверяем, что игра грузится и видит ровно новую карту.
  const after = loadSprites(htmlPath);
  if (JSON.stringify(after.sprites[name].map) !== JSON.stringify(map)) {
    writeFileSync(htmlPath, src);
    throw new Error("после записи игра видит другую карту — откатил index.html");
  }
  return { before: cur.map, after: map, data: after };
}

function latestDownload() {
  const dir = join(homedir(), "Downloads");
  const files = readdirSync(dir).filter(f => /^sprite-.+\.json$/i.test(f))
    .map(f => ({ f: join(dir, f), t: statSync(join(dir, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t);
  if (!files.length) throw new Error("в " + dir + " нет файлов sprite-*.json — сначала «Сохранить» в редакторе");
  return files[0].f;
}

if (isMain(import.meta.url)) {
  const args = process.argv.slice(2);
  const force = args.includes("--force");
  try {
    const file = args.includes("--latest") ? latestDownload() : args.find(a => !a.startsWith("--"));
    if (!file) throw new Error("укажи файл sprite-*.json или --latest");
    const job = JSON.parse(readFileSync(file, "utf8"));
    const r = applySprite(job, { force });
    writeFileSync(DATA_FILE, renderDataFile(r.data));
    console.log("Файл:   " + file);
    console.log("Спрайт: " + job.name + "  " + r.before[0].length + "x" + r.before.length +
      " -> " + r.after[0].length + "x" + r.after.length);
    console.log("index.html обновлён, tools/sprite-data.js пересобран.");
  } catch (e) {
    console.error("НЕ ПРИМЕНЕНО: " + e.message);
    process.exitCode = 1;
  }
}
