// Прогон всей игры автопилотом: каждый день похода по нескольку заходов
// с постоянными зёрнами случайности. Автопилот рулит в свободный коридор
// (камни, брёвна, гребцы, острова развилок, опоры мостов), гребёт, пока
// есть силы, и отбивается веслом от злых гребцов. Мульты проматываются.
//
// Что считается: дошёл ли до финиша, время, сколько раз потерял сердце и
// обо что (функция игры, которая отняла сердце, + ближайшее препятствие),
// сколько раз перевернулся, ошибки (исключения) игры.
//
// Результаты фиксируются: полный прогон — docs/playthrough/<дата>.json,
// строка сводки — docs/playthrough/history.md; в конце — сравнение с прошлым
// прогоном по дням. Код выхода 1, если какой-то заход не дошёл или упал.
//
//   node tools/playthrough.mjs                 все 9 дней × зёрна 1,2,3
//   node tools/playthrough.mjs --days 3,4      только дни 3 и 4 (с единицы)
//   node tools/playthrough.mjs --seeds 1,2,3,4,5
//   node tools/playthrough.mjs --no-save       не записывать результаты
import { runInContext } from "node:vm";
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, appendFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { loadGame, setupWorld } from "../tests/harness.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const OUT = ROOT + "docs/playthrough/";
const MAX_FRAMES = 30000;

// Детерминированный Math.random в песочнице игры: один и тот же заход при том же зерне.
function seedRandom(sandbox, seed) {
  runInContext(`(function(){ let a = ${seed} * 2654435761 >>> 0;
    Math.random = function(){ a = (a + 0x6D2B79F5) >>> 0; let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })()`, sandbox);
}

// Лучшая поперечная позиция t: меньше всего штрафа от того, что впереди.
function pickLane(K, g) {
  let best = g.t, bestC = Infinity;
  for (let t = -0.85; t <= 0.85; t += 0.05) {
    let c = Math.abs(t - g.t)*0.3 + Math.abs(t)*0.2;
    for (const o of g.obs) {
      if (o.flipT > 0 || o.sinkT > 0) continue;
      const ahead = g.py - K.screenYOf(o.wy);
      if (ahead < -30 || ahead > 260) continue;
      const d = Math.abs(t - o.t)*K.widthAt(o.wy)/2, need = (o.visHalf || 24) + 22;
      if (d < need) c += (need - d)*(300 - ahead)/30;
    }
    // Остров развилки — с запасом: точкой у самого края лодка бортом задевает остров.
    for (const ah of [40, 100, 160, 220]) {
      const sh = K.forkShape(g.pwy + ah);
      if (sh && Math.abs(t - sh.c) < sh.h + 0.12) c += (300 - ah)*3;
    }
    for (const b of g.bridges_ || []) {
      const ah = b.wy - g.pwy;
      if (ah > -20 && ah < 220) for (const s of [-1, 1]) if (Math.abs(t - s*0.44) < 0.2) c += 400;
    }
    if (c < bestC) { bestC = c; best = t; }
  }
  return best;
}

function nearestKind(K, g) {
  let nb = null, nd = Infinity;
  for (const o of g.obs) {
    if (o.flipT > 0) continue;
    const d = Math.hypot((o.t - g.t)*K.widthAt(o.wy)/2, o.wy - g.pwy);
    if (d < nd) { nd = d; nb = o; }
  }
  if (!nb || nd >= 110) return "-";
  if (nb.type === "kayaker") return nb.aggro || nb.swingT >= 0 ? "злой гребец" : "гребец";
  return nb.cow ? "корова" : nb.tied ? "лодка у мостков" : nb.type;
}

// Один заход: день (с нуля) и зерно.
export function runDay(day, seed, opts = {}) {
  const max = opts.maxFrames || MAX_FRAMES;
  const { K, sandbox } = loadGame();
  seedRandom(sandbox, seed);
  const keys = runInContext("keys", sandbox);
  // Кто отнял сердце: обёртка над damage() запоминает вызвавшую функцию игры.
  sandbox.__wrap = orig => function () {
    const st = new Error().stack.split("\n")[2] || "";
    sandbox.__lastCaller = (st.trim().split(" ")[1] || "?");
    return orig.apply(this, arguments);
  };
  runInContext("damage = __wrap(damage)", sandbox);
  K.resetSave();
  K.startDay(day); setupWorld(K, { wy: 400 });
  const g = K.G; g.s = "playing"; K.setAudio(null);
  const L = K.level();
  const r = { day: day + 1, seed, done: false, len: L.len, dist: 0, sec: 0, hits: 0, deaths: 0, cuts: 0, parries: 0, hitBy: {}, errors: [] };
  let frames = 0;
  while (frames < max && g.dist < L.len - 1) {
    frames++;
    if (g.s === "cutscene") {                    // мульт проматываем
      r.cuts++;
      g.cut.t = g.cut.len;
      try { K.upd(); } catch (e) { r.errors.push("мульт: " + e.message); }
      if (g.s === "cutscene" && g.cut) { const then = g.cut.then; g.cut = null; g.s = "playing"; if (then) then(); }
      g.s = "playing"; K.setAudio(null);        // мульт включает звук — в песочнице он не нужен
      continue;
    }
    if (g.s === "continue" || g.s === "over" || g.hp <= 0) { r.deaths++; g.hp = 3; g.inv = 90; }
    g.s = "playing";
    const lane = pickLane(K, g);
    for (const k of ["ArrowLeft", "ArrowRight", "ArrowUp"]) keys[k] = false;
    if (lane < g.t - 0.02) keys.ArrowLeft = true; else if (lane > g.t + 0.02) keys.ArrowRight = true;
    keys.ArrowUp = g.stam > 40;
    for (const o of g.obs)
      if (o.type === "kayaker" && o.aggro && o.swingT >= 0 && o.swingT < 10 && Math.abs(o.wy - g.pwy) < 80) {
        try { K.paddleStrike(); r.parries++; } catch (e) { r.errors.push("удар веслом: " + e.message); }
      }
    const hp0 = g.hp, near = nearestKind(K, g);
    try { K.upd(); if (frames % 7 === 0) K.rndr(); }
    catch (e) { r.errors.push(e.message); if (r.errors.length > 5) break; }
    if (g.hp < hp0) {
      r.hits++;
      const k = (sandbox.__lastCaller || "?") + " · " + near;
      r.hitBy[k] = (r.hitBy[k] || 0) + 1;
    }
  }
  r.dist = Math.round(g.dist); r.done = g.dist >= L.len - 1; r.sec = Math.round(frames/60);
  r.errors = [...new Set(r.errors)];
  return r;
}

// Сводка по дням: доля дошедших, удары в среднем, ошибки.
export function summarize(runs) {
  const by = {};
  for (const r of runs) (by[r.day] = by[r.day] || []).push(r);
  return Object.entries(by).map(([day, rs]) => ({
    day: +day,
    done: rs.filter(r => r.done).length + "/" + rs.length,
    hits: +(rs.reduce((a, r) => a + r.hits, 0)/rs.length).toFixed(1),
    deaths: +(rs.reduce((a, r) => a + r.deaths, 0)/rs.length).toFixed(1),
    sec: Math.round(rs.reduce((a, r) => a + r.sec, 0)/rs.length),
    errors: rs.reduce((a, r) => a + r.errors.length, 0)
  }));
}

function arg(name, def) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : def;
}
function commitOf() {
  try { return execSync("git rev-parse --short HEAD", { cwd: ROOT }).toString().trim(); } catch { return "?"; }
}
function previous() {
  if (!existsSync(OUT)) return null;
  const files = readdirSync(OUT).filter(f => f.endsWith(".json")).sort();
  if (!files.length) return null;
  try { return JSON.parse(readFileSync(OUT + files[files.length - 1], "utf8")); } catch { return null; }
}

function main() {
  const seeds = arg("--seeds", "1,2,3").split(",").map(Number);
  const days = arg("--days", "1,2,3,4,5,6,7,8,9").split(",").map(n => Number(n) - 1);
  const save = !process.argv.includes("--no-save");
  const runs = [];
  for (const d of days) for (const s of seeds) {
    const r = runDay(d, s);
    runs.push(r);
    console.log(`день ${r.day} зерно ${s}: ${r.done ? "дошёл" : "НЕ ДОШЁЛ " + r.dist + "/" + r.len} · ударов ${r.hits} · ` +
                `переворотов ${r.deaths} · ${r.sec} с${r.errors.length ? " · ОШИБКИ: " + r.errors.join(" | ") : ""}`);
  }
  const sum = summarize(runs);
  console.log("\nСводка по дням:");
  console.table(sum);
  const prev = previous();
  if (prev) {
    const old = Object.fromEntries((prev.summary || []).map(s => [s.day, s]));
    console.log(`Сравнение с прогоном ${prev.date} (${prev.commit}):`);
    for (const s of sum) {
      const o = old[s.day];
      if (!o) continue;
      const dh = +(s.hits - o.hits).toFixed(1);
      console.log(`  день ${s.day}: ударов ${o.hits} → ${s.hits} (${dh > 0 ? "+" : ""}${dh}), дошли ${o.done} → ${s.done}`);
    }
  }
  const now = new Date(), pad = n => String(n).padStart(2, "0");
  const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
  const date = `${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
  if (save) {
    mkdirSync(OUT, { recursive: true });
    const commit = commitOf();
    writeFileSync(OUT + stamp + ".json", JSON.stringify({ date, commit, seeds, summary: sum, runs }, null, 2) + "\n");
    const hist = OUT + "history.md";
    if (!existsSync(hist))
      writeFileSync(hist, "# Прогоны автопилотом\n\nСвежее снизу. Ударов — в среднем за заход; «дошли» — сколько заходов дня дошло до финиша.\n" +
        "Полные данные каждого прогона — рядом, в JSON. Запуск: `node tools/playthrough.mjs` или «Прогон игры.bat».\n\n" +
        "| Дата | Коммит | Зёрна | " + [1,2,3,4,5,6,7,8,9].map(d => "Д" + d).join(" | ") + " | Ошибки |\n" +
        "|---|---|---|" + "---|".repeat(9) + "---|\n");
    const cell = d => { const s = sum.find(x => x.day === d); return s ? `${s.hits}${s.done.split("/")[0] === s.done.split("/")[1] ? "" : " ⚠" + s.done}` : "—"; };
    appendFileSync(hist, `| ${date} | ${commit} | ${seeds.join(",")} | ${[1,2,3,4,5,6,7,8,9].map(cell).join(" | ")} | ${sum.reduce((a, s) => a + s.errors, 0)} |\n`);
    console.log("\nЗаписано: docs/playthrough/" + stamp + ".json и docs/playthrough/history.md");
  }
  const bad = runs.filter(r => !r.done || r.errors.length);
  if (bad.length) { console.log("\nПРОБЛЕМЫ: " + bad.map(r => "день " + r.day + "/зерно " + r.seed).join(", ")); process.exitCode = 1; }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
