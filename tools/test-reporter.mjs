// Отчётчик node:test для сторожа просьб (tools/guard.mjs): по строке JSON на
// каждый тест верхнего уровня — файл, название, прошёл ли. Стандартный вывод
// не говорит, из какого файла тест, а сторожу это нужно, чтобы перезапустить
// упавший файл и отличить случайное падение от настоящего.
//   node --test --test-reporter=./tools/test-reporter.mjs tests/*.test.mjs
import path from "node:path";

export default async function* reporter(source) {
  for await (const ev of source) {
    if (ev.type !== "test:pass" && ev.type !== "test:fail") continue;
    const d = ev.data;
    if (d.nesting !== 0 || (d.details && d.details.type === "suite")) continue;
    const file = d.file ? path.relative(process.cwd(), d.file).replace(/\\/g, "/") : "";
    if (!/\.test\.mjs$/.test(file)) continue;          // сам файл как «тест» — пропускаем
    const out = { file, name: d.name, ok: ev.type === "test:pass" };
    if (!out.ok && d.details && d.details.error) out.error = String(d.details.error.message || d.details.error).split("\n")[0].slice(0, 300);
    yield JSON.stringify(out) + "\n";
  }
}
