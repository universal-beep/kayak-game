// Связать просьбы (docs/requests.json) с коммитами и тестами-сторожами.
//   node tools/link-requests.mjs          — проставить там, где связи ещё нет
//   node tools/link-requests.mjs --dry    — только показать, что нашлось
// Как ищется: коммиты того же дня или двух следующих, у которых больше всего
// общих слов с просьбой (коммиты docs — мимо). Сторожа — тесты, которые эти
// коммиты добавили и которые есть сейчас (link: "коммит"). Если таких нет —
// тесты, чьё название ближе всего по словам (link: "слова", слабее).
// Связь, поставленная руками (link: "руками"), не трогается. Номера просьб
// (id: R001…) раздаются по порядку в файле.
// Нужен свежий docs/.test-index.json — сначала node tools/guard.mjs.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { linkScore, dayNum, guardMatches, isNoCode } from "./guard-lib.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const REQ = path.join(ROOT, "docs", "requests.json"), INDEX = path.join(ROOT, "docs", ".test-index.json");
const git = cmd => execSync("git " + cmd, { cwd: ROOT, encoding: "utf8", maxBuffer: 256 << 20 });

// Коммиты: хэш, день, тема.
export function loadCommits() {
  return git("log --format=%h%x09%ad%x09%s --date=format:%d.%m.%Y").trim().split("\n").map(l => {
    const [h, d, s] = l.split("\t");
    return { h, d, day: dayNum(d), s, tests: [] };
  });
}
// Какие тесты добавил каждый коммит: строки «+test("…"» в диффе tests/.
// Название со склейкой («… день " + day …») становится шаблоном «…*».
export function addedTests(commits) {
  const by = new Map(commits.map(c => [c.h, c]));
  let cur = null;
  for (const line of git("log -p --unified=0 --format=@@C%h -- tests/").split("\n")) {
    if (line.startsWith("@@C")) { cur = by.get(line.slice(3).trim()) || null; continue; }
    if (!cur || !line.startsWith("+")) continue;
    const m = /^\+\s*test\(\s*(["'`])(.*?)\1\s*(\+)?/.exec(line);
    if (m) cur.tests.push(m[2] + (m[3] ? "*" : ""));
  }
  return commits;
}

export function linkOne(r, commits, names) {
  const d = dayNum(r.date);
  const cand = commits.filter(c => d != null && c.day >= d && c.day <= d + 2 && !/^docs/.test(c.s))
    .map(c => ({ c, sc: linkScore(r, c.s) })).filter(x => x.sc >= 2);
  const best = Math.max(0, ...cand.map(x => x.sc));
  const chosen = cand.filter(x => x.sc >= Math.max(2, best*0.6)).map(x => x.c);
  const exists = gd => names.some(n => guardMatches(gd, n));
  // Из тестов коммита — только те, что по словам про эту просьбу: крупные
  // коммиты добавляли десятки тестов, и без отбора к просьбе «прилипали» чужие.
  const own = [...new Set(chosen.flatMap(c => c.tests).filter(exists))]
    .map(n => ({ n, sc: linkScore(r, n.replace(/\*$/, "")) })).filter(x => x.sc >= 1).sort((a, b) => b.sc - a.sc).slice(0, 4);
  let guards = own.map(x => x.n), link = guards.length ? "коммит" : null;
  if (!guards.length){
    const near = names.map(n => ({ n, sc: linkScore(r, n) })).filter(x => x.sc >= 3).sort((a, b) => b.sc - a.sc).slice(0, 3);
    guards = near.map(x => x.n); link = guards.length ? "слова" : null;
  }
  return { commits: chosen.map(c => c.h), guards, link };
}

function main() {
  if (!existsSync(INDEX)) { console.error("нет docs/.test-index.json — сначала node tools/guard.mjs"); process.exit(2); }
  const dry = process.argv.includes("--dry");
  const raw = readFileSync(REQ, "utf8"), reqs = JSON.parse(raw);
  const names = JSON.parse(readFileSync(INDEX, "utf8")).tests.map(t => t.name);
  const commits = addedTests(loadCommits());
  const st = { id: 0, commit: 0, words: 0, none: 0, kept: 0 };
  reqs.forEach((r, i) => {
    if (!r.id){ r.id = "R" + String(i + 1).padStart(3, "0"); st.id++; }
    if (r.link === "руками" || r.link === "коммит"){ st.kept++; return; }
    if (r.status !== "done") return;
    if (isNoCode(r.ask)){ r.kind = "без кода"; st.nocode = (st.nocode || 0) + 1; return; }
    const l = linkOne(r, commits, names);
    if (l.commits.length) r.commits = l.commits;
    if (l.guards.length){ r.guards = l.guards; r.link = l.link; st[l.link === "коммит" ? "commit" : "words"]++; }
    else st.none++;
    if (dry) console.log(r.id, r.date, (l.link || "—").padEnd(6), l.commits.join(","), "|", r.ask.slice(0, 60), "→", l.guards.slice(0, 2).join(" ; ").slice(0, 120));
  });
  console.log("номеров выдано " + st.id + "; связь по коммиту " + st.commit + ", по словам " + st.words + ", без кода " + (st.nocode || 0) + ", не нашлось " + st.none + ", не тронуто " + st.kept);
  if (!dry) writeFileSync(REQ, JSON.stringify(reqs, null, 2) + (raw.endsWith("\n") ? "\n" : ""));
}
if (process.argv[1] && path.resolve(process.argv[1]).toLowerCase() === path.resolve(fileURLToPath(import.meta.url)).toLowerCase()) main();
