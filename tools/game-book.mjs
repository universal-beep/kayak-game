// Книга игры: журнал просьб, по блоку на каждый день (особенности и свои
// спрайты), общие спрайты с правилами, правила движения и рисовки.
// Собирается из данных самой игры — не устаревает.
//   node tools/game-book.mjs  →  docs/game-book.html (двойной клик)
//                                docs/game-book.artifact.html (для публикации)
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { loadGame } from "../tests/harness.mjs";
import { sampleDay, daySvg } from "./river-map.mjs";
import { loadSprites, isMain } from "./sprites-lib.mjs";

const DOCS = fileURLToPath(new URL("../docs/", import.meta.url));
export const BOOK = DOCS + "game-book.html";
export const BOOK_ART = DOCS + "game-book.artifact.html";

// ---------- Что умеет каждый объект (сверено с кодом: chkCl, apBn, logStep, bargeStep) ----------
const RULES = {
  log: "Плывёт по течению (0,22 скорости реки). На изгибах сносит к внешнему берегу; о песок тормозит по углу касания: в лоб почти останавливается, вскользь — чуть. Заранее обходит то, что догоняет. Удар — минус сердце.",
  branch: "Легче бревна: плывёт быстрее (0,30) и рыскает. Обходит то, что впереди. Удар — минус сердце.",
  snag: "Коряга, стоит на месте. Удар — минус сердце.",
  boulder: "Валун, стоит на месте. Удар — минус сердце.",
  fang: "Острый камень, стоит на месте. Удар — минус сердце.",
  slab: "Плита — самый широкий камень, не всегда оставляет проход. Удар — минус сердце.",
  shallows: "Мель: не ранит, но срезает скорость до 65%. На третьем дне цель — задеть не больше одной.",
  barge: "Идёт своим ходом (0,30), медленно отворачивает от препятствий; на её полосе впереди ничего не появляется. Столкновение — сразу конец попытки, спасает только спасжилет.",
  rower: "Соперник на байдарке (0,40) — обгон даёт очки. Уворачивается от препятствий впереди.",
  rower_wind: "Агрессивный соперник замахивается веслом, когда ты борт о борт. Удар можно парировать.",
  rower_strike: "Кадр удара веслом. Попадает, только если ты всё ещё рядом.",
  rower_flip: "Парированный соперник переворачивается и тонет.",
  bread: "Гребок в 1,5 раза мощнее, течение сносит вдвое слабее — 8 секунд. +20 очков.",
  whisky: "6 секунд неуязвимости: препятствия разлетаются в щепки, очки ×2. +50.",
  medkit: "+1 сердце; если все целы — щит на один удар. +15.",
  axe: "Расчищает путь: разбивает препятствие, которое стоит на курсе впереди.",
  sun: "+80 очков и продлевает комбо.",
  kayak_center: "Игрок. Гребёт вперёд и назад, рулит; к берегу подходит вплотную.",
  tree: "Большое дерево у лагерей и деревень. Выше человека.",
  sfir: "Декор берега: не ближе 39 px друг к другу, не на песчаных отмелях и не рядом с жителями; выплывает из тумана.",
  sbirch: "Декор берега, как ёлка.",
  sbush: "Декор у кромки: не чаще 26 px.",
  bush: "Куст — житель берега.",
  tower: "Смотровая вышка на берегу.",
  fisher: "Рыбак: удочка ходит, леска в воду, иногда клюёт — выпрыгивает рыба.",
  fish: "Рыба, выпрыгивающая у рыбака.",
  duck: "Стайка на воде у берега. Подплывёшь вплотную к их берегу — взлетают.",
  duckfly0: "Кадр взлёта (крылья подняты).",
  duckfly1: "Кадр взлёта (крылья раскинуты).",
  person: "Турист. Пара уходит в палатку, после чего палатку потряхивает.",
  girl: "Девушка — вторая в паре, идущей в палатку. Через раз блондинка.",
  sitter: "Сидит у костра — всегда под огнём, вдоль берега.",
  fire: "Костёр: пламя пляшет, летят искры.",
  tent: "Палатка в лагере.",
  tent2: "Купольная палатка.",
  pack: "Рюкзак у лагеря на финише.",
  bear: "Медведь бродит вдоль берега (только лесные реки).",
  church: "Церковь у места прибытия.",
  house: "Дом у места прибытия.",
  sunbather: "Загорающий на полотенце: лежит вдоль реки, целиком на песке.",
  sunbather_f: "Загорающая: волосы веером, купальник с лифом. Через раз вместо парня.",
  towel: "Пустое полотенце на классическом пляже.",
  umbrella: "Пляжный зонтик с тенью.",
  swimmer0: "Ребёнок в воде по плечи.",
  swimmer1: "Он же машет рукой.",
  guitarist: "Гитарист у костра: гитара на коленях, гриф с колками, бьёт по струнам (два кадра).",
  note: "Ноты поднимаются от гитары вглубь берега.",
  bridge: "Мост: пройти в пролёт — +40 очков, в опору — удар. Первый пролёт за день — мультик.",
  truss: "Ферма моста.", deck: "Настил моста.", pier: "Опора моста — в неё не въезжать.",
};

// Что появляется только в некоторых днях (иначе — «общее»).
function uniqueOf(L, R) {
  const u = [];
  if (L.river === 0) u.push(["Пляж", ["sunbather", "sunbather_f", "towel", "umbrella", "swimmer0", "swimmer1"]],
                            ["Компания с гитарой", ["guitarist", "note"]]);
  if (L.river !== 0) u.push(["Лесной берег", ["bear"]]);
  if (L.barges) u.push(["Баржи", ["barge"]]);
  if (L.snags) u.push(["Коряги", ["snag"]]);
  if (L.bridges) u.push(["Мосты", ["bridge", "truss", "deck", "pier"]]);
  if (L.aggro > 0) u.push(["Агрессивные соперники", ["rower_wind", "rower_strike", "rower_flip"]]);
  if (L.arrive === "church" || L.arrive === "town") u.push(["Место прибытия", ["church", "house"]]);
  if (L.arrive === "village") u.push(["Место прибытия", ["house"]]);
  return u;
}
const ARRIVE = { camp: "палаточный лагерь", church: "у церкви", village: "деревня", town: "город" };
const GOAL_HINT = { bonuses: "собирать бонусы", passed: "обгонять соперников", shallowsmax: "не задевать мели",
  parries: "парировать удары", bridges: "проходить мосты в пролёт", hearts: "беречь сердца",
  cleanrapids: "проходить пороги чисто", combo: "держать комбо" };

function features(L, R) {
  const f = [];
  f.push(R.rapids ? "Пороги: русло сужается, течение быстрее, бонусов на порогах нет." : "Порогов нет — большая спокойная вода.");
  if (L.barges) f.push("Баржи: идут своим ходом по фарватеру, столкновение — конец попытки.");
  if (L.forks) f.push("Развилки: остров делит реку на широкий и узкий рукав, бонус — в узком.");
  if (L.snags) f.push("Коряги: неподвижные препятствия.");
  if (L.bridges) f.push("Мосты: в пролёт — очки, в опору — удар.");
  if (L.rain) f.push("Дождь: гребок слабее на " + Math.round(25 * L.rain) + "%.");
  f.push(L.aggro > 0 ? "Агрессивных соперников — около " + Math.round(L.aggro * 100) + "%: замахиваются веслом, удар можно парировать."
                     : "Соперники мирные.");
  if (L.river === 0) f.push("На берегах пляжи и компании с гитарой.");
  else f.push("Лесной берег: бывает медведь.");
  return f;
}

// ---------- Сборка ----------
export function buildBook() {
  const data = loadSprites();
  const { K } = loadGame();
  const levels = K.LEVELS.map(l => ({ ...l }));
  const rivers = K.RIVERS.map(r => ({ ...r }));
  const pools = K.BEV_POOLS.map(p => [...p]);
  const requests = JSON.parse(readFileSync(DOCS + "requests.json", "utf8"));

  const uniq = new Set();
  const days = levels.map(L => {
    const R = rivers[L.river];
    const u = uniqueOf(L, R);
    u.forEach(([, names]) => names.forEach(n => uniq.add(n)));
    return { L, R, u, f: features(L, R), pool: [...new Set(pools[L.river] || [])] };
  });
  const SKIP = new Set(["kayak_left", "kayak_right", "shallows", "sitter_guitar_b", "guitarist_b"]);
  const commonGroups = data.groups.filter(g => g !== "Катсцены и прочее" && g !== "Мосты")
    .map(g => [g, Object.keys(data.sprites).filter(n => data.sprites[n].group === g && !uniq.has(n) && !SKIP.has(n))])
    .filter(([, n]) => n.length);
  // Спрайты, которых нет в группах редактора, но они живут в игре.
  const extra = ["sfir", "sbirch", "sbush", "girl"].filter(n => data.sprites[n] && !uniq.has(n) &&
    !commonGroups.some(([, ns]) => ns.includes(n)));
  if (extra.length) commonGroups.push(["Берег: декор и люди", extra]);

  const used = new Set([...uniq, ...commonGroups.flatMap(([, n]) => n)]);
  const spr = {};
  for (const n of used) if (data.sprites[n]) spr[n] = { map: data.sprites[n].map, variants: data.sprites[n].variants };
  const payload = { PAL: data.PAL, spr };

  const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const fig = (n, bg) => data.sprites[n] ? `<figure class="spr ${bg}"><canvas data-spr="${n}"></canvas><figcaption><code>${n}</code><span>${esc(RULES[n] || "")}</span></figcaption></figure>` : "";
  const STATUS = { done: ["сделано", "ok"], todo: ["не начато", "todo"], wait: ["ждёт решения", "wait"], work: ["в работе", "work"] };
  const nDone = requests.filter(r => r.status === "done").length;

  const body = `
<header class="top">
  <p class="eyebrow">«Сплав на байдарке» · рабочая книга</p>
  <h1>Книга похода</h1>
  <p class="lead">Что ты просил поправить и что сделано; чем живёт каждый из девяти дней; общие спрайты и правила, по которым они работают. Собирается из самой игры командой <code>node tools/game-book.mjs</code>.</p>
  <nav class="toc">
    <a href="#map">Карта</a>
    <a href="#requests">Просьбы <b>${nDone}/${requests.length}</b></a>
    ${days.map(d => `<a href="#day${d.L.day}">День ${d.L.day}</a>`).join("")}
    <a href="#common">Общее</a>
    <a href="#rules">Правила</a>
  </nav>
</header>

<section id="map">
  <h2>Карта похода</h2>
  <p class="lead">Девять дней, четыре реки. Каждая полоса снята с геометрии самой игры (<code>tools/river-map.mjs</code>): старт слева, финиш справа, левый берег по ходу лодки — сверху. Пороги, развилки и мосты в игре случайны — здесь показан типичный заход с постоянным зерном, чтобы по карте было удобно прорисовывать берега.</p>
  <ul class="legend">
    <li><i style="background:#1565c0"></i>вода</li><li><i style="background:#d2b674"></i>песчаная отмель</li>
    <li><i class="rap"></i>порог</li><li><i style="background:#4b9c48"></i>остров развилки</li><li><i style="background:#4a3018"></i>мост</li>
  </ul>
  <div class="atlas">
  ${levels.map((L, i) => `<a class="strip" href="#day${L.day}"><span class="sd"><b>${L.day}</b>${esc(rivers[L.river].name)}</span><span class="sv">${daySvg(sampleDay(i))}</span></a>`).join("\n  ")}
  </div>
</section>

<section id="requests">
  <h2>Просьбы и правки</h2>
  <ol class="req">
    ${requests.map(r => {
      const [label, cls] = STATUS[r.status] || [r.status, "todo"];
      return `<li class="${cls}"><span class="pill ${cls}">${label}</span><div><p class="ask">${esc(r.ask)}</p>${r.result ? `<p class="res">${esc(r.result)}</p>` : ""}</div><time>${esc(r.date)}</time></li>`;
    }).join("\n    ")}
  </ol>
</section>

<section id="days">
  <h2>Дни похода</h2>
  ${days.map(({ L, R, u, f, pool }) => `
  <article class="day" id="day${L.day}" style="--river:${R.water};--grass:${R.grass}">
    <header>
      <span class="num">${L.day}</span>
      <div><h3>${esc(R.name)} · ${esc(L.place)}</h3><p>${esc(R.note)}</p></div>
    </header>
    <dl class="facts">
      <div><dt>Длина</dt><dd>${L.len} м</dd></div>
      <div><dt>Третья звезда</dt><dd>${esc(L.goalText)}</dd></div>
      <div><dt>Прибытие</dt><dd>${esc(ARRIVE[L.arrive] || L.arrive || "лагерь")}</dd></div>
      <div><dt>Река</dt><dd>ширина ×${R.width} · изгибы ×${R.bend} · камни ×${R.rocks} · течение ×${R.speed}</dd></div>
    </dl>
    <ul class="feat">${f.map(x => `<li>${esc(x)}</li>`).join("")}</ul>
    <p class="pool"><b>Жители берега:</b> ${pool.map(esc).join(", ")}</p>
    ${u.length ? u.map(([title, names]) => `<h4>${esc(title)}</h4><div class="sprites">${names.map(n => fig(n, ["barge", "snag", "bridge", "truss", "deck", "pier", "rower_wind", "rower_strike", "rower_flip", "swimmer0", "swimmer1"].includes(n) ? "water" : ["sunbather", "sunbather_f", "towel", "umbrella"].includes(n) ? "sand" : "grass")).join("")}</div>`).join("") : `<p class="none">Своих спрайтов нет — только общие.</p>`}
  </article>`).join("")}
</section>

<section id="common">
  <h2>Общее для всех дней</h2>
  <p class="lead">Эти объекты встречаются на любой реке. Подпись — что объект делает в игре.</p>
  ${commonGroups.map(([g, names]) => `<h3>${esc(g)}</h3><div class="sprites">${names.map(n => fig(n, /Река|Бонусы|Лодки/.test(g) ? "water" : "grass")).join("")}</div>`).join("")}
</section>

<section id="rules">
  <h2>Правила</h2>
  <div class="cols">
    <div>
      <h3>Движение по реке</h3>
      <table class="speeds"><thead><tr><th>Кто</th><th>Скорость<br>от течения</th></tr></thead><tbody>
        <tr><td>Камни, мели, заросли, коряги, бонусы</td><td>0</td></tr>
        <tr><td>Бревно</td><td>0,22</td></tr>
        <tr><td>Ветка, баржа</td><td>0,30</td></tr>
        <tr><td>Соперник</td><td>0,40</td></tr>
      </tbody></table>
      <ul>
        <li>Каждый плывущий заранее отворачивает от ближайшего более медленного впереди — того, кого догоняет.</li>
        <li>Пока баржа на реке, на её полосе впереди (~620 px пути) не появляются камни и бонусы.</li>
        <li>Если объекты всё же сошлись, они расходятся плавно — не больше 1,5 px за раз, без рывков.</li>
        <li>У развилки объект выбирает рукав один раз и не перелетает через остров.</li>
        <li>Бревно на изгибах сносит к внешнему берегу; о песок оно тормозит по углу касания.</li>
        <li>Байдарка упирается в берег бортом корпуса — весло ложится на песок.</li>
        <li>Трава на воде — участок, а не препятствие: заводь у берега (гуще) или пряди посреди реки с водой между ними. Пока лодка в траве, скорость тянется к 42% (заводь) или 60% (пряди); трава не исчезает.</li>
        <li>Звуки батона и виски — свои файлы: перетащить mp3/wav/ogg на «Звук батона.bat» или «Звук виски.bat». Пока файла нет — звон бонуса.</li>
        <li>Баржа гудит один раз, когда въезжает в кадр.</li>
        <li>Финишная лента и лагерь выставляются за 46 м до конца, над экраном, и въезжают вместе с рекой.</li>
      </ul>
    </div>
    <div>
      <h3>Рисовка</h3>
      <ul>
        <li>Один размер пикселя — ×3 у всех спрайтов игры.</li>
        <li>Свет сверху-слева; три тона на материал; тёмная обводка снаружи, детали внутри — тоном.</li>
        <li>Предмет узнаётся силуэтом и в 3 раза меньше; одна характерная деталь ломает простую форму.</li>
        <li>Размер по смыслу: человек 48 px, дерево выше, рюкзак по пояс.</li>
        <li>Жители берега — целиком на суше; декор не ставится на песчаные отмели и рядом с жителями.</li>
        <li>Подробно — <code>docs/art-rules.md</code>; рисовать — «Редактор спрайтов.bat».</li>
      </ul>
    </div>
  </div>
</section>
<footer>Собрано из index.html · ${new Date().toLocaleDateString("ru-RU")} · правки просьб — docs/requests.json</footer>

<script type="application/json" id="book-data">${JSON.stringify(payload).replace(/</g, "\\u003c")}</script>
<script>
(function(){
  var D = JSON.parse(document.getElementById("book-data").textContent);
  var hex = function(h){ return h; };
  document.querySelectorAll("canvas[data-spr]").forEach(function(c){
    var s = D.spr[c.dataset.spr]; if (!s) return;
    var m = s.map, W = m[0].length, H = m.length;
    var sc = Math.max(2, Math.min(4, Math.floor(96 / Math.max(W, H))));
    if (W * sc > 150) sc = Math.max(1, Math.floor(150 / W));
    c.width = W * sc; c.height = H * sc;
    var x = c.getContext("2d");
    for (var r = 0; r < H; r++) for (var q = 0; q < W; q++){
      var ch = m[r][q]; if (ch === "." || !D.PAL[ch]) continue;
      x.fillStyle = hex(D.PAL[ch]); x.fillRect(q * sc, r * sc, sc, sc);
    }
  });
})();
</script>`;

  const style = `
<title>Книга похода</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Press+Start+2P&family=PT+Sans:ital,wght@0,400;0,700;1,400&family=JetBrains+Mono:wght@400;600&display=swap">
<style>
:root{
  --ground:#eef3f4; --surface:#ffffff; --ink:#15262e; --muted:#566b75; --line:#cfdde2;
  --accent:#1f6fb8; --ok:#2f7a3a; --okbg:#e2f1e3; --todo:#8a5a12; --todobg:#f7ecd6; --wait:#9b2f5b; --waitbg:#f6e1ea;
  --water:#1565c0; --grass:#4b9c48; --sand:#d2b674;
  --pix:"Press Start 2P", ui-monospace, monospace; --body:"PT Sans", "Segoe UI", Arial, sans-serif; --mono:"JetBrains Mono", ui-monospace, Consolas, monospace;
}
@media (prefers-color-scheme: dark){ :root:not([data-theme="light"]){
  color-scheme:dark; --ground:#0d171c; --surface:#142229; --ink:#e2ecf0; --muted:#93a8b2; --line:#24363f;
  --accent:#6aaef0; --ok:#7fd08a; --okbg:#173022; --todo:#e8b565; --todobg:#33260f; --wait:#ef8ab3; --waitbg:#35172a; }}
:root[data-theme="dark"]{
  color-scheme:dark; --ground:#0d171c; --surface:#142229; --ink:#e2ecf0; --muted:#93a8b2; --line:#24363f;
  --accent:#6aaef0; --ok:#7fd08a; --okbg:#173022; --todo:#e8b565; --todobg:#33260f; --wait:#ef8ab3; --waitbg:#35172a; }
*{box-sizing:border-box}
body{margin:0;background:var(--ground);color:var(--ink);font:16px/1.55 var(--body);padding-inline:16px;padding-block:24px 48px}
main{max-width:1040px;margin:0 auto;display:grid;gap:48px}
main>section{min-width:0}
h1,h2{font-family:var(--pix);font-weight:400;letter-spacing:.02em;text-wrap:balance;margin:0}
h1{font-size:clamp(22px,4vw,34px);line-height:1.3}
h2{font-size:18px;line-height:1.5;margin-bottom:16px}
h3{font-size:19px;margin:24px 0 10px;text-wrap:balance}
h4{font-size:13px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin:18px 0 8px}
code{font-family:var(--mono);font-size:.86em}
.eyebrow{font-size:13px;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);margin:0 0 10px}
.lead{color:var(--muted);max-width:66ch;margin:12px 0 0}
.toc{display:flex;flex-wrap:wrap;gap:6px;margin-top:20px}
.toc a{color:var(--ink);text-decoration:none;border:1px solid var(--line);background:var(--surface);padding:4px 10px;border-radius:4px;font-size:14px}
.toc a:hover,.toc a:focus-visible{border-color:var(--accent);outline:none}
.toc b{font-variant-numeric:tabular-nums;color:var(--ok)}
.req{list-style:none;margin:0;padding:0;border-top:1px solid var(--line)}
.req li{display:grid;grid-template-columns:118px 1fr auto;gap:14px;align-items:start;padding:12px 0;border-bottom:1px solid var(--line)}
.req .ask{margin:0;font-weight:700}
.req .res{margin:2px 0 0;color:var(--muted)}
.req time{font-size:13px;color:var(--muted);font-variant-numeric:tabular-nums;white-space:nowrap}
.pill{display:inline-block;font-size:12px;font-weight:700;padding:2px 8px;border-radius:3px;justify-self:start}
.pill.ok{color:var(--ok);background:var(--okbg)} .pill.todo{color:var(--todo);background:var(--todobg)}
.pill.wait,.pill.work{color:var(--wait);background:var(--waitbg)}
#days{display:grid;gap:22px}
.day{background:var(--surface);border:1px solid var(--line);border-radius:6px;overflow:hidden;padding:0 20px 20px}
.day>header{display:flex;gap:16px;align-items:center;margin:0 -20px 16px;padding:14px 20px;
  background:linear-gradient(90deg,var(--grass) 0 10px,var(--river) 10px 22px,transparent 22px),var(--surface);padding-left:40px;border-bottom:1px solid var(--line)}
.day .num{font-family:var(--pix);font-size:22px;color:var(--accent);min-width:1.4em}
.day>header>div{min-width:0}
.day h3{margin:0;font-size:20px;overflow-wrap:anywhere}
.day>header p{margin:2px 0 0;color:var(--muted)}
.facts{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(200px,100%),1fr));gap:10px 20px;margin:0}
.facts dt{font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted)}
.facts dd{margin:2px 0 0;font-variant-numeric:tabular-nums}
.feat{margin:14px 0 0;padding-left:20px;max-width:72ch}
.pool{margin:10px 0 0;color:var(--muted)}
.none{color:var(--muted);font-style:italic;margin:14px 0 0}
.sprites{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(210px,100%),1fr));gap:12px}
.spr{margin:0;display:grid;grid-template-columns:auto 1fr;gap:12px;align-items:center;border:1px solid var(--line);border-radius:5px;padding:10px;background:var(--surface)}
.spr canvas{image-rendering:pixelated;display:block;padding:6px;border-radius:3px;max-width:min(150px,40vw);height:auto}
.spr.water canvas{background:var(--water)} .spr.grass canvas{background:var(--grass)} .spr.sand canvas{background:var(--sand)}
.spr figcaption{display:grid;gap:3px;font-size:14px;line-height:1.4;min-width:0;overflow-wrap:anywhere}
.spr figcaption code{font-weight:600}
.spr figcaption span{color:var(--muted)}
.cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(300px,100%),1fr));gap:28px}
.cols ul{padding-left:20px;margin:0} .cols li{margin:6px 0}
.speeds{border-collapse:collapse;margin:0 0 12px;font-size:15px;max-width:100%}
.speeds th,.speeds td{text-align:left;padding:6px 14px 6px 0;border-bottom:1px solid var(--line)}
.speeds td:last-child{font-variant-numeric:tabular-nums;font-family:var(--mono)}
.speeds th{font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);font-weight:700}
.legend{list-style:none;display:flex;flex-wrap:wrap;gap:6px 18px;margin:14px 0 12px;padding:0;font-size:14px;color:var(--muted)}
.legend i{display:inline-block;width:14px;height:10px;margin-right:6px;vertical-align:-1px;border-radius:2px}
.legend i.rap{background:repeating-linear-gradient(90deg,#1565c0 0 3px,#bcd6f0 3px 5px)}
.atlas{display:grid;gap:6px;overflow-x:auto;padding-bottom:4px}
.strip{display:grid;grid-template-columns:92px 1fr;gap:12px;align-items:center;min-width:640px;color:var(--ink);text-decoration:none;padding:6px 8px;border-radius:5px;border:1px solid transparent}
.strip:hover,.strip:focus-visible{border-color:var(--line);background:var(--surface);outline:none}
.sd{display:grid;font-size:12px;letter-spacing:.06em;color:var(--muted)}
.sd b{font-family:var(--pix);font-weight:400;font-size:16px;color:var(--accent)}
.sv svg{display:block;width:100%;height:auto;overflow:visible}
.sv .lbl{font:11px var(--body);fill:var(--muted)} .sv .lbl.b{font-weight:700;fill:var(--ink)} .sv .tick{stroke:var(--muted);stroke-width:1}
footer{max-width:1040px;margin:40px auto 0;color:var(--muted);font-size:13px}
@media (max-width:560px){ .req li{grid-template-columns:1fr} .req time{order:-1} .spr{grid-template-columns:1fr} }
</style>`;

  const fragment = style + "\n<main>" + body.replace(/<footer>[\s\S]*?<\/footer>/, "") + "</main>\n" +
    body.match(/<footer>[\s\S]*?<\/footer>/)[0];
  const full = "<!DOCTYPE html>\n<html lang=\"ru\">\n<head>\n<meta charset=\"UTF-8\">\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n" +
    style + "\n</head>\n<body>\n<main>" + body.replace(/<footer>[\s\S]*?<\/footer>/, "").replace(/<script[\s\S]*$/, "") + "</main>\n" +
    body.match(/<footer>[\s\S]*$/)[0] + "\n</body>\n</html>\n";
  return { full, fragment };
}

if (isMain(import.meta.url)) {
  const { full, fragment } = buildBook();
  writeFileSync(BOOK, full);
  writeFileSync(BOOK_ART, fragment);
  console.log("docs/game-book.html: " + Math.round(full.length / 1024) + " КБ");
}
