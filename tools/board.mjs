// Доска проекта: каждая просьба Максима — на каком она этапе, каким коммитом
// сделана, кто её сторожит и цел ли сторож.
//   node tools/board.mjs   → docs/board.html (её же публикуем артефактом)
// Данные: docs/requests.json, docs/.test-index.json (последний прогон сторожа,
// node tools/guard.mjs), git: что уже в origin/master — значит, на сайте.
import { readFileSync, writeFileSync, existsSync, statSync } from "node:fs";
const require_fs = () => ({ statSync });
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { stageOf, STAGES, guardMatches, NO_GUARD_KINDS } from "./guard-lib.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const REPO = "https://github.com/universal-beep/kayak-game";

export function buildData() {
  const reqs = JSON.parse(readFileSync(path.join(ROOT, "docs", "requests.json"), "utf8"));
  const idxFile = path.join(ROOT, "docs", ".test-index.json");
  const index = existsSync(idxFile) ? JSON.parse(readFileSync(idxFile, "utf8")) : { date: null, tests: [] };
  let site = new Set();
  try { site = new Set(execSync("git rev-list origin/master", { cwd: ROOT, encoding: "utf8", maxBuffer: 64 << 20 }).split("\n").map(h => h.slice(0, 7))); } catch (e) {}
  const onSite = { has: h => site.has(String(h).slice(0, 7)) };
  const rows = reqs.map(r => {
    const guards = (r.guards || []).map(gd => {
      const hits = index.tests.filter(t => guardMatches(gd, t.name));
      return { name: gd, state: !hits.length ? "lost" : hits.every(t => t.ok) ? "ok" : "fail", n: hits.length };
    });
    const gstate = r.status !== "done" ? "—" : NO_GUARD_KINDS.includes(r.kind) ? "nocode" : !guards.length ? "none" :
      guards.some(x => x.state === "fail") ? "fail" : guards.some(x => x.state === "lost") ? "lost" : "ok";
    return { id: r.id, date: r.date, ask: r.ask, result: r.result || "", stage: stageOf(r, onSite),
             commits: (r.commits || []).map(h => ({ h, site: onSite.has(h) })), guards, gstate, link: r.link || "" };
  });
  // Прогон сторожа старше кода — доска может врать (05.10.2026 так и вышло:
  // доску собрали по прогону с нарочно откаченным исправлением).
  let stale = false;
  try { const { statSync } = require_fs(); stale = !index.date || statSync(path.join(ROOT, "index.html")).mtimeMs > Date.parse(index.date); } catch (e) {}
  return { rows, stale, tests: index.tests.length, testsDate: index.date, built: new Date().toISOString(), stages: STAGES, repo: REPO };
}

export function boardHtml(data) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return `<meta charset="utf-8">
<title>Доска сплава</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Golos+Text:wght@400;500;600&family=JetBrains+Mono:wght@400;600&family=Unbounded:wght@600&display=swap">
<style>
/* Раскладка: сводка этапов лентой «как течёт река» → фильтры → список просьб, свежие сверху. */
:root{
  --bg:#f3f6f8; --panel:#ffffff; --ink:#132430; --muted:#5b6f7c; --line:#d9e2e8;
  --river:#1e6fb8; --river-soft:#e3eef8;
  --ok:#2e7d4f; --ok-soft:#e2f2e8; --warn:#9a6a00; --warn-soft:#fbf0d6; --bad:#b3261e; --bad-soft:#fbe4e2;
  --display:"Unbounded","Golos Text",system-ui,sans-serif; --body:"Golos Text",system-ui,sans-serif; --mono:"JetBrains Mono",ui-monospace,Consolas,monospace;
}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){
  --bg:#0d171e; --panel:#13212b; --ink:#dbe7ee; --muted:#8ea3b0; --line:#243642;
  --river:#5aa7e8; --river-soft:#16314a; --ok:#6cc68f; --ok-soft:#163323; --warn:#e2b54a; --warn-soft:#3a2e10; --bad:#ff8a80; --bad-soft:#3d1c1a; color-scheme:dark}}
:root[data-theme="dark"]{
  --bg:#0d171e; --panel:#13212b; --ink:#dbe7ee; --muted:#8ea3b0; --line:#243642;
  --river:#5aa7e8; --river-soft:#16314a; --ok:#6cc68f; --ok-soft:#163323; --warn:#e2b54a; --warn-soft:#3a2e10; --bad:#ff8a80; --bad-soft:#3d1c1a; color-scheme:dark}
*{box-sizing:border-box}
body{background:var(--bg);color:var(--ink);font:15px/1.5 var(--body);padding-inline:16px;padding-block:24px 48px}
.wrap{max-width:1080px;margin:0 auto;display:grid;gap:20px}
h1{font:600 22px/1.2 var(--display);margin:0;letter-spacing:.01em;text-wrap:balance}
.sub{color:var(--muted);font-size:13px;margin-top:6px}
.flow{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:2px;background:var(--line);border:1px solid var(--line);border-radius:10px;overflow:hidden}
.st{background:var(--panel);padding:12px 12px 10px;cursor:pointer;border:0;text-align:left;font:inherit;color:inherit}
.st:hover,.st:focus-visible{background:var(--river-soft);outline:none}
.st[aria-pressed="true"]{background:var(--river-soft);box-shadow:inset 0 -3px 0 var(--river)}
.st b{display:block;font:600 22px/1.1 var(--mono);font-variant-numeric:tabular-nums}
.st span{font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em}
.health{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.chip{border:1px solid var(--line);background:var(--panel);color:var(--ink);border-radius:999px;padding:5px 12px;font:500 13px var(--body);cursor:pointer}
.chip[aria-pressed="true"]{border-color:var(--river);color:var(--river);background:var(--river-soft)}
.chip:focus-visible{outline:2px solid var(--river);outline-offset:2px}
.chip.bad{color:var(--bad)} .chip.warn{color:var(--warn)} .chip.ok{color:var(--ok)}
#q{flex:1 1 220px;min-width:0;border:1px solid var(--line);background:var(--panel);color:var(--ink);border-radius:8px;padding:7px 10px;font:inherit}
.list{display:grid;gap:8px}
.row{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:12px 14px;display:grid;grid-template-columns:92px minmax(0,1fr);gap:4px 14px}
.row.fail,.row.lost{border-color:var(--bad);box-shadow:inset 4px 0 0 var(--bad)}
.meta{font:12px/1.5 var(--mono);color:var(--muted)}
.meta b{display:block;color:var(--ink);font-weight:600}
.ask{font-weight:600}
.res{color:var(--muted);font-size:14px}
.tags{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px;align-items:center}
.pill{font:600 11px var(--mono);text-transform:uppercase;letter-spacing:.04em;border-radius:5px;padding:2px 7px;background:var(--river-soft);color:var(--river)}
.pill.g-ok{background:var(--ok-soft);color:var(--ok)} .pill.g-fail,.pill.g-lost{background:var(--bad-soft);color:var(--bad)}
.pill.g-none{background:var(--warn-soft);color:var(--warn)} .pill.g-nocode{background:transparent;color:var(--muted);border:1px solid var(--line)}
.hash{font:12px var(--mono);color:var(--river);text-decoration:none} .hash.off{color:var(--warn)}
.hash:hover{text-decoration:underline}
details{grid-column:2;font-size:13px;color:var(--muted)}
details li.fail,details li.lost{color:var(--bad)}
summary{cursor:pointer}
.empty{color:var(--muted);padding:24px;text-align:center}
.stale{margin:8px 0 0;padding:8px 12px;border-radius:8px;background:var(--warn-soft);color:var(--warn);font-size:13px}
.legend{font-size:13px;color:var(--muted);line-height:1.7;max-width:70ch}
@media (max-width:720px){.flow{grid-template-columns:repeat(3,minmax(0,1fr))}.row{grid-template-columns:minmax(0,1fr)}details{grid-column:1}}
@media (prefers-reduced-motion:reduce){*{transition:none!important}}
</style>
<div class="wrap">
  <header>
    <h1>Доска сплава</h1>
    <div class="sub" id="sub"></div>
    <p class="stale" id="stale" hidden>Прогон сторожа старше кода — отметки «откат» и «цел» могут быть неверны. Пересобрать: node tools/guard.mjs, потом node tools/board.mjs.</p>
  </header>
  <nav class="flow" id="flow" aria-label="Этапы"></nav>
  <div class="health" id="health"></div>
  <div class="list" id="list"></div>
  <p class="legend"><b>Этапы.</b> Просьба → в работе → в коде (коммит есть, на сайт ещё не ушёл) → на сайте → проверено (ты посмотрел глазами — скажи номер, отмечу). «Сделано» — готово, но коммит не нашёлся.<br>
  <b>Сторож</b> — тест, который падает, если исправление откатилось. Перед каждой отправкой на GitHub сторожа прогоняются; упал — отправка стоит, и видно, какая просьба откатилась. «По словам» — связь найдена по совпадению слов, а не по коммиту: может промахнуться.</p>
</div>
<script id="data" type="application/json">${json}</script>
<script>
const D = JSON.parse(document.getElementById("data").textContent);
const G = { ok:"сторож цел", fail:"откат?", lost:"сторож потерян", none:"без сторожа", nocode:"сторож не нужен", "—":"" };
let stage = null, guard = null, q = "";
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;" }[c]));
const rows = D.rows.slice().reverse();
function counts(){ const c = {}; for (const s of D.stages) c[s] = 0; for (const r of D.rows) c[r.stage]++; return c; }
function drawFlow(){
  const c = counts();
  document.getElementById("flow").innerHTML = D.stages.map(s =>
    '<button class="st" aria-pressed="' + (stage === s) + '" data-s="' + s + '"><b>' + c[s] + '</b><span>' + s + '</span></button>').join("");
}
function drawHealth(){
  const n = k => D.rows.filter(r => r.gstate === k).length;
  const chips = [["fail","bad"],["lost","bad"],["none","warn"],["ok","ok"],["nocode",""]].filter(([k]) => n(k) || k === "fail");
  document.getElementById("health").innerHTML =
    '<button class="chip" data-g="" aria-pressed="' + (guard === null) + '">все ' + D.rows.length + '</button>' +
    chips.map(([k, cls]) => '<button class="chip ' + cls + '" data-g="' + k + '" aria-pressed="' + (guard === k) + '">' + G[k] + ' ' + n(k) + '</button>').join("") +
    '<button class="chip" data-g="words" aria-pressed="' + (guard === "words") + '">связь по словам ' + D.rows.filter(r => r.link === "слова").length + '</button>' +
    '<input id="q" type="search" placeholder="поиск по тексту или номеру" value="' + esc(q) + '">';
  document.getElementById("q").addEventListener("input", e => { q = e.target.value.toLowerCase(); drawList(); });
}
function drawList(){
  const list = rows.filter(r => (!stage || r.stage === stage) &&
    (!guard || (guard === "words" ? r.link === "слова" : r.gstate === guard)) &&
    (!q || (r.id + " " + r.ask + " " + r.result).toLowerCase().includes(q)));
  document.getElementById("list").innerHTML = list.length ? list.map(r =>
    '<article class="row ' + r.gstate + '">' +
      '<div class="meta"><b>' + esc(r.id) + '</b>' + esc(r.date) + '</div>' +
      '<div><div class="ask">' + esc(r.ask) + '</div>' + (r.result ? '<div class="res">' + esc(r.result) + '</div>' : '') +
      '<div class="tags"><span class="pill">' + esc(r.stage) + '</span>' +
        (G[r.gstate] ? '<span class="pill g-' + r.gstate + '">' + G[r.gstate] + (r.guards.length ? ' · ' + r.guards.length : '') + '</span>' : '') +
        (r.link === "слова" ? '<span class="pill g-none">по словам</span>' : '') +
        r.commits.map(c => '<a class="hash' + (c.site ? '' : ' off') + '" href="' + D.repo + '/commit/' + c.h + '" target="_blank" rel="noopener" title="' + (c.site ? 'на сайте' : 'ещё не на сайте') + '">' + c.h + '</a>').join(" ") +
      '</div></div>' +
      (r.guards.length ? '<details><summary>сторожа</summary><ul>' + r.guards.map(g => '<li class="' + g.state + '">' + esc(g.name) + (g.state === "lost" ? ' — нет такого теста' : g.state === "fail" ? ' — упал' : '') + '</li>').join("") + '</ul></details>' : '') +
    '</article>').join("") : '<div class="empty">Ничего не нашлось — сними фильтр.</div>';
}
document.getElementById("stale").hidden = !D.stale;
document.getElementById("sub").textContent = "Просьб " + D.rows.length + " · тестов " + D.tests +
  (D.testsDate ? " · прогон сторожа " + new Date(D.testsDate).toLocaleString("ru-RU") : "") + " · собрано " + new Date(D.built).toLocaleString("ru-RU");
document.addEventListener("click", e => {
  const s = e.target.closest("[data-s]"), g = e.target.closest("[data-g]");
  if (s){ stage = stage === s.dataset.s ? null : s.dataset.s; drawFlow(); drawList(); }
  if (g){ guard = g.dataset.g || null; drawHealth(); drawList(); }
});
drawFlow(); drawHealth(); drawList();
</script>
`;
}

if (process.argv[1] && path.resolve(process.argv[1]).toLowerCase() === path.resolve(fileURLToPath(import.meta.url)).toLowerCase()) {
  const html = boardHtml(buildData());
  writeFileSync(path.join(ROOT, "docs", "board.html"), html);
  console.log("docs/board.html: " + Math.round(html.length/1024) + " КБ");
}
