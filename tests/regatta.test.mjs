// Регата: 8 лодок — ты и 7 ботов с характерами — стартуют строем на широкой
// реке; боты видят камни, мели и острова по карте уровня, ударившись —
// замедляются; лодки толкаются бортами без потери сердец; место N/8 на
// экране, таблица мест на финише. В гонках гребок ускоряет лодку.
import test from "node:test";
import assert from "node:assert/strict";
import { runInContext } from "node:vm";
import { loadGame } from "./harness.mjs";

// Случайность в песочнице постоянная: брёвна и прочее не меняют исход от прогона к прогону.
function game(seed = 777) {
  const { K, sandbox } = loadGame();
  runInContext("(function(){ let a = " + seed + "; Math.random = function(){ a = (a*1103515245 + 12345) >>> 0; return a/4294967296; }; })()", sandbox);
  K.resetSave(); K.setAudio(null);
  return { K, keys: runInContext("keys", sandbox) };
}
function run(K, until = () => false, max = 30000) {
  let f = 0;
  while (!until() && f++ < max) {
    if (K.G.s === "countdown" || K.G.s === "playing") { K.G.inv = 1e9; K.upd(); }
    else if (K.G.s === "arrive") K.upd();
    else break;
  }
  return f;
}

test("трассы: четыре именных + случайная; уровень постоянный, проходимый, без гребцов-препятствий", () => {
  const { K } = game();
  const T = K.REGATTA_TRACKS;
  assert.equal(T.length, 4);
  assert.equal(JSON.stringify(T.map(t => t.river)), "[0,1,2,3]", "по одной на реку");   // массивы из VM — через JSON
  for (const tr of T) {
    const a = K.regattaLevel(tr), b = K.regattaLevel(tr);
    assert.equal(JSON.stringify(a), JSON.stringify(b), tr.name + ": одна и та же");
    assert.equal(a.river, tr.river);
    assert.equal(K.customBlockedRow(a.items, K.customRows(a.lenIdx)), -1, tr.name + ": проход есть");
    assert.ok(!a.items.some(it => it.k === "kayaker" || it.k === "aggro"), "гребцы — это гонщики, а не препятствия");
  }
  assert.ok(K.regattaLevel(T[1]).items.filter(it => it.k === "fork").length >= 2, "в слаломе развилки");
  assert.equal(K.regattaLevel(T[2]).lenIdx, 2, "марафон длинный");
  assert.equal(K.regattaLevel(T[3]).lenIdx, 0, "спринт короткий");
});

test("старт: восемь лодок строем поперёк реки, отсчёт; до выстрела боты стоят", () => {
  const { K } = game();
  K.startRegatta(K.REGATTA_TRACKS[0]);
  const R = K.G.custom.race;
  assert.equal(R.bots.length, 7);
  assert.equal(K.G.s, "countdown");
  // Два ряда по четыре: в одну шеренгу восемь лодок стояли борт к борту,
  // толкались сразу после выстрела, а имена сливались.
  const boats = [{ t: K.G.t, wy: K.G.pwy }, ...R.bots.map(b => ({ t: b.t, wy: b.wy }))];
  const hw = K.widthAt(K.G.pwy)/2;
  for (let i = 0; i < 8; i++) for (let j = i + 1; j < 8; j++) {
    const a = boats[i], b = boats[j];
    assert.ok(Math.abs((a.t - b.t)*hw) > 50 || Math.abs(a.wy - b.wy) > 50, "лодки " + i + " и " + j + " не касаются");
  }
  for (const b of boats) assert.ok(Math.abs(b.t) <= 0.85);
  assert.equal(new Set(boats.map(b => Math.round(b.wy))).size, 2, "два ряда");
  assert.ok(boats[0].wy <= Math.min(...boats.map(b => b.wy)), "ты во втором ряду — весь строй в кадре");
  for (const b of boats) assert.ok(K.screenYOf(b.wy) < K.H - 60, "лодка выше нижней подписи");
  assert.equal(new Set(R.bots.map(b => b.name)).size, 7, "имена разные");
  const wy0 = R.bots.map(b => b.wy);
  for (let i = 0; i < 60; i++) K.upd();
  assert.deepEqual(R.bots.map(b => b.wy), wy0, "в отсчёт не плывут");
});

test("заезд: боты плывут, обходят камни, все финишируют; места 1–8 без повторов", () => {
  const { K } = game();
  K.startRegatta(K.REGATTA_TRACKS[0]);
  run(K);
  const res = K.regattaResult();
  assert.ok(res, "итог есть");
  assert.equal(res.rows.length, 8);
  assert.equal(JSON.stringify(res.rows.map(r => r.place)), "[1,2,3,4,5,6,7,8]");
  assert.equal(res.rows.filter(r => r.me).length, 1);
  assert.ok(res.place >= 1 && res.place <= 8);
  for (let i = 1; i < 8; i++) assert.ok(res.rows[i].frames >= res.rows[i - 1].frames, "время по порядку");
  const R = K.G.custom.race;
  const avgHits = R.bots.reduce((a, b) => a + b.hits, 0)/7;
  assert.ok(avgHits < 6, "в среднем бот бьётся не больше 5 раз: " + avgHits.toFixed(1));
});

test("характеры: новичок бьётся чаще осторожной, быстрый в среднем впереди новичка", () => {
  const { K } = game();
  let rookie = 0, careful = 0, fastBetter = 0;
  for (const tr of K.REGATTA_TRACKS) {
    K.startRegatta(tr);
    run(K);
    const R = K.G.custom.race, by = s => R.bots.find(b => b.style === s);
    rookie += by("rookie").hits; careful += by("careful").hits;
    const rows = K.regattaResult().rows, place = s => rows.find(r => r.name === by(s).name).place;
    if (place("fast") < place("rookie")) fastBetter++;
  }
  assert.ok(rookie > careful, "новичок " + rookie + " против осторожной " + careful);
  assert.ok(fastBetter >= 3, "быстрый обгонял новичка на " + fastBetter + " трассах из 4");
});

test("борт о борт: лодки расходятся и теряют ход, сердце не тратится", () => {
  const { K } = game();
  K.startRegatta(K.REGATTA_TRACKS[0]);
  run(K, () => K.G.s === "playing");
  for (let i = 0; i < 30; i++) K.upd();
  const b = K.G.custom.race.bots[0];
  for (const o of K.G.custom.race.bots) if (o !== b) o.wy = K.G.pwy - 600;   // остальные далеко
  b.wy = K.G.pwy; b.t = K.G.t + 0.02; b.stunT = 0;
  K.G.inv = 0; const hp = K.G.hp;
  K.regattaBump(K.G.custom.race);
  assert.equal(K.G.hp, hp, "сердце на месте");
  assert.ok(Math.abs(b.t - K.G.t) > 0.03, "разошлись");
  assert.ok(b.stunT > 0, "бот потерял ход");
});

test("гребок в гонке ускоряет лодку (в походе — нет)", () => {
  // Уровень без гребцов-препятствий и с постоянной случайностью: иначе время
  // заезда гуляет на несколько процентов само по себе.
  const time = row => {
    const { K, sandbox } = loadGame(); K.resetSave(); K.setAudio(null);
    runInContext("(function(){ let a = 12345; Math.random = function(){ a = (a*1103515245 + 12345) >>> 0; return a/4294967296; }; })()", sandbox);
    const keys = runInContext("keys", sandbox);
    K.startRace({ river: 0, lenIdx: 1, items: [] });           // чистая вода: меряем только гребок
    let f = 0;
    while (K.G.s === "playing" && f++ < 20000) { K.G.inv = 1e9; keys.ArrowUp = row && K.G.stam > 40; K.upd(); }
    return K.G.custom.race.end;
  };
  const idle = time(false), rowing = time(true);
  assert.ok(rowing < idle*0.95, "с греблей быстрее: " + rowing + " против " + idle);
});

test("место на экране, таблица справа, итог и лучшее место трассы", () => {
  const { K } = game();
  const tr = K.REGATTA_TRACKS[3];
  K.startRegatta(tr);
  run(K, () => K.G.s === "playing");
  for (let i = 0; i < 200; i++) { K.G.inv = 1e9; K.upd(); }
  const st = K.regattaStandings();
  assert.equal(st.length, 8);
  assert.equal(K.regattaPlace(), st.findIndex(r => r.me) + 1);
  assert.doesNotThrow(() => K.rndr());
  assert.match(K.panelRightHtml(), /РЕГАТА/);
  run(K);
  const res = K.regattaResult();
  assert.equal(K.save.regatta[tr.id], res.place, "лучшее место запомнено");
});

test("бот рядом с бонусом забирает его", () => {
  const { K } = game();
  K.startRegatta(K.REGATTA_TRACKS[0]);
  run(K, () => K.G.s === "playing");
  const b = K.G.custom.race.bots[2];
  const bn = { t: b.t, wy: b.wy + 2, type: "bread", visHalf: 16, visHalfY: 10 };
  K.G.bns.push(bn);
  K.upd();
  assert.ok(!K.G.bns.includes(bn), "бонус забран");      // число бонусов не меряем: в гонке появляются новые
  assert.ok(b.boostT > 0, "бот ускорился");
});

test("разбился в регате — экран «НЕ ДОШЛИ» без ошибки, с местами на момент схода", () => {
  const { K } = game();
  K.startRegatta(K.REGATTA_TRACKS[0]);
  run(K, () => K.G.s === "playing");
  for (let i = 0; i < 300; i++) { K.G.inv = 1e9; K.upd(); }
  K.G.inv = 0; K.G.lives = 1; K.G.hp = 1; K.G.sh = false; K.G.whiskyT = 0;
  assert.doesNotThrow(() => K.damage());
  assert.equal(K.G.s, "customEnd");
  assert.equal(K.regattaResult(), null, "итога нет — не доплыл");
});

test("«ЕЩЁ РАЗ» после регаты — снова регата на той же трассе", () => {
  const { K } = game();
  const tr = K.REGATTA_TRACKS[3];
  K.startRegatta(tr);
  run(K);
  assert.equal(K.G.s, "customEnd");
  K.raceAgain();
  assert.ok(K.G.custom.race.bots && K.G.custom.race.bots.length === 7, "снова 8 лодок");
  assert.equal(K.G.custom.race.bots.track.id, tr.id, "та же трасса");
  assert.equal(K.G.s, "countdown");
});

test("итог регаты — таблица в три колонки, шрифт растёт с высотой окна", async () => {
  const { K } = game();
  const rows = Array.from({ length: 8 }, (_, i) => ({ place: i + 1, name: "Б" + i, frames: 3000 + i*60, me: i === 3 }));
  const html = K.regattaTableHtml(rows);
  assert.match(html, /class="regtab"/);
  assert.equal((html.match(/<span class="rp/g) || []).length, 8, "8 строк");
  assert.match(html, /class="rp me"/, "своя строка выделена");
  const src = (await import("node:fs")).readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const css = /\.regtab\s*\{([^}]*)\}/.exec(src);
  assert.ok(css, "стиль .regtab");
  assert.match(css[1], /font-size:\s*clamp\([^)]*vh/, "размер от высоты окна");
});

test("трассы регаты нарисованы картой: ширина 7, длина по трассе, знаки из легенды, жители только у берега", () => {
  const { K } = game();
  for (const tr of K.REGATTA_TRACKS) {
    assert.ok(Array.isArray(tr.map), tr.name + ": есть карта");
    assert.equal(tr.map.length, K.customRows(tr.lenIdx), tr.name + ": рядов");
    tr.map.forEach((row, r) => {
      assert.equal(row.length, 7, tr.name + " ряд " + r);
      [...row].forEach((ch, c) => {
        assert.ok(ch === "." || K.REG_LEGEND[ch], tr.name + ": знак «" + ch + "» в ряду " + r);
        if (ch !== "." && K.CUSTOM_SHORE.includes(K.REG_LEGEND[ch])) assert.ok(c === 0 || c === 6, tr.name + ": житель не у берега, ряд " + r);
      });
    });
    const L = K.regattaLevel(tr);
    assert.equal(L.items.length, tr.map.join("").replace(/\./g, "").length, tr.name + ": всё с карты");
  }
});
