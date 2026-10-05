// Сторож просьб: прогоняет все тесты и сверяет «сторожей» сделанных просьб
// (docs/requests.json → guards). Запускается перед каждой отправкой на GitHub
// (hooks/pre-push) и руками:
//   node tools/guard.mjs           — прогнать тесты и сверить
//   node tools/guard.mjs --no-run  — сверить по последнему прогону (docs/.test-index.json)
// Не пускает отправку, если: тест упал и при перезапуске его файла упал снова;
// сторож просьбы упал (вероятный откат старого исправления); сторожа больше
// нет среди тестов. Тест, упавший один раз и прошедший при перезапуске, —
// «случайный»: предупреждение, не стоп.
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { checkGuards } from "./guard-lib.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const INDEX = path.join(ROOT, "docs", ".test-index.json");
const REQ = path.join(ROOT, "docs", "requests.json");

function runTests(files) {
  const r = spawnSync(process.execPath, ["--test", "--test-reporter=./tools/test-reporter.mjs", ...files],
    { cwd: ROOT, encoding: "utf8", maxBuffer: 64 << 20 });
  return (r.stdout || "").split("\n").filter(l => l.startsWith("{")).map(l => JSON.parse(l));
}

export function runAll() {
  const files = readdirSync(path.join(ROOT, "tests")).filter(f => f.endsWith(".test.mjs")).map(f => "tests/" + f);
  let tests = runTests(files);
  const flaky = [];
  const failedFiles = [...new Set(tests.filter(t => !t.ok).map(t => t.file))];
  for (const f of failedFiles) {                          // перезапуск: случайное или настоящее
    const again = runTests([f]);
    for (const t of tests.filter(x => x.file === f && !x.ok)) {
      const b = again.find(x => x.name === t.name);
      if (b && b.ok){ t.ok = true; t.flaky = true; flaky.push(t); }
    }
  }
  const index = { date: new Date().toISOString(), tests };
  writeFileSync(INDEX, JSON.stringify(index, null, 1));
  return index;
}

function main() {
  const noRun = process.argv.includes("--no-run");
  if (noRun && !existsSync(INDEX)) { console.error("нет docs/.test-index.json — запусти без --no-run"); process.exit(2); }
  const index = noRun ? JSON.parse(readFileSync(INDEX, "utf8")) : runAll();
  const tests = index.tests;
  const reqs = JSON.parse(readFileSync(REQ, "utf8"));
  const real = tests.filter(t => !t.ok), flaky = tests.filter(t => t.flaky);
  const g = checkGuards(reqs, tests);
  const L = s => console.log(s);
  L("[сторож] тестов " + tests.length + ", упало " + real.length + (flaky.length ? ", случайных (прошли при перезапуске) " + flaky.length : ""));
  for (const t of flaky) L("  ~ случайный: «" + t.name + "» (" + t.file + ")");
  for (const t of real) L("  ✖ упал: «" + t.name + "» (" + t.file + ")" + (t.error ? " — " + t.error : ""));
  L("[сторож] просьб сделано " + reqs.filter(r => r.status === "done").length + ": под охраной " + g.ok.length +
    ", без сторожа " + g.unguarded.length + ", откат? " + g.broken.length + ", сторож потерян " + g.lost.length);
  for (const r of g.broken) L("  ✖ ОТКАТ? " + r.id + " (" + r.date + ") «" + r.ask.slice(0, 90) + "» — упал: " + r.failed.map(t => "«" + t.name + "»").join(", "));
  for (const r of g.lost) L("  ✖ сторож потерян: " + r.id + " «" + r.ask.slice(0, 90) + "» — нет теста: " + r.gone.map(s => "«" + s + "»").join(", "));
  const bad = real.length || g.broken.length || g.lost.length;
  L(bad ? "[сторож] СТОП: исправь, потом отправляй." : "[сторож] OK");
  process.exit(bad ? 1 : 0);
}
if (process.argv[1] && path.resolve(process.argv[1]).toLowerCase() === path.resolve(fileURLToPath(import.meta.url)).toLowerCase()) main();
