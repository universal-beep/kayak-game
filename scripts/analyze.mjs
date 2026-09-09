// Анализ: размер единственного «бандла» (index.html) против базлайна.
import { readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";

const FILE = fileURLToPath(new URL("../index.html", import.meta.url));
const BASE = JSON.parse(readFileSync(new URL("../quality-gates/baseline.json", import.meta.url), "utf8"));

const size = statSync(FILE).size;
const base = BASE.indexHtmlBytes;
const growth = (size - base) / base;

console.log(`index.html: ${size} байт (base ${base}, рост ${(growth * 100).toFixed(2)}%)`);
if (growth > 0.05) {
  console.error(`analyze: FAIL — бандл вырос более чем на 5% (${(growth * 100).toFixed(2)}%). Обнови baseline.json явно с согласия пользователя.`);
  process.exit(1);
}
console.log("analyze: OK");