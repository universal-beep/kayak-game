// На Медведице по дороге вдоль берега едут велосипедисты — сверху вниз по
// экрану, навстречу байдарке, и негромко звенят, появившись в кадре. На Волге
// их нет: там своё — пляжи и купающиеся.
import test from "node:test";
import assert from "node:assert/strict";
import { loadGame, setupWorld } from "./harness.mjs";

test("велосипедисты на Медведице, не на Волге", () => {
  const { K } = loadGame();
  assert.ok(K.BEV_POOLS[1].includes("cyclists"), "Медведица");
  assert.ok(!K.BEV_POOLS[0].includes("cyclists"), "не Волга");
  for (const n of ["cyclist0", "cyclist1"]) assert.ok(K.SPR[n], "нет спрайта " + n);
});

test("трое едут сверху вниз по экрану и один раз негромко звенят, появившись в кадре", () => {
  const { K } = loadGame();
  setupWorld(K, { wy: 1000 });
  const e = { type: "cyclists", side: 1, wy: 1400, phase: 0, count: 3 };
  K.G.frame = 0; K.G.sfxLast = "";
  const y0 = [0, 1, 2].map(i => K.screenYOf(K.cyclistWy(e, i)));
  let rang = 0;
  for (let f = 1; f <= 600; f++) {
    K.G.frame = f; K.G.sfxLast = ""; K.updBev(e);
    if (K.G.sfxLast === "ring") rang++;
  }
  const y1 = [0, 1, 2].map(i => K.screenYOf(K.cyclistWy(e, i)));
  for (let i = 0; i < 3; i++) assert.ok(y1[i] > y0[i] + 100, "едет вниз по экрану: " + i);
  assert.equal(new Set(y0).size, 3, "едут друг за другом, не в одной точке");
  assert.equal(rang, 1, "звонок один раз");
});

test("колея из двух широких тропок: по одной едет один, по другой — двое", () => {
  const { K } = loadGame();
  const lanes = [0, 1, 2].map(i => K.cyclistLane(i, 3));
  assert.notEqual(lanes[0], lanes[1], "первый — на своей тропке");
  assert.equal(lanes[1], lanes[2], "двое других — на второй");
  assert.ok(Math.abs(lanes[0] - lanes[1]) >= 36, "тропки разнесены: " + Math.abs(lanes[0] - lanes[1]));
});

test("колея — это дорога: сплошное земляное полотно, на нём колеи темнее", () => {
  const { K, ctx } = loadGame();
  setupWorld(K, { wy: 1400 - K.PY + 360 });
  K.G.rBend = 0; K.G.frame = 10;
  const rects = [];
  const orig = ctx.fillRect;
  ctx.fillRect = function (x, y, w, h) { rects.push({ w, h, c: this.fillStyle }); };
  // Дорога рисуется слоем земли (drwCycRoads), отдельно от ездоков.
  K.G.bev = [{ type: "cyclists", side: 1, wy: 1400, phase: 0, f0: 0 }];
  K.drwCycRoads();
  ctx.fillRect = orig;
  const bed = rects.filter(r => r.w >= 40);
  assert.ok(bed.length > 10, "полотно дороги: широких полос " + bed.length);
  const colors = new Set(rects.map(r => r.c));
  assert.ok(colors.size >= 3, "полотно, колеи и трава между ними: цветов " + colors.size);
});

// Дорога не обрывается посреди берега: у реки идёт вдоль, а концами уходит
// вглубь суши за край экрана. Велосипедистов бывает 1, 2, 3 и группа из 7.
test("дорога концами уходит за край экрана, а не обрывается", () => {
  const { K } = loadGame();
  assert.equal(K.cycRoadOff(0), K.cycRoadOff(200), "у реки — вдоль берега");
  assert.ok(K.cycRoadOff(K.CYC_SPAN) >= 260 && K.cycRoadOff(-K.CYC_SPAN) >= 260, "концы — за краем");
  let prev = 0;
  for (let d = 0; d <= K.CYC_SPAN; d += 20) { const o = K.cycRoadOff(d); assert.ok(o >= prev, "плавно уходит"); prev = o; }
  assert.ok(K.CYC_SPAN >= 800, "дорога длинная: " + K.CYC_SPAN);
});

test("едут то один, то двое, то трое, то группа из семи — по обеим колеям", () => {
  const { K } = loadGame();
  const counts = new Set();
  for (let wy = 1000; wy < 80000; wy += 373) counts.add(K.cyclistCount({ wy }));
  assert.deepEqual([...counts].sort((a, b) => a - b), [1, 2, 3, 7]);
  const lanes7 = new Set([0, 1, 2, 3, 4, 5, 6].map(i => K.cyclistLane(i, 7)));
  assert.equal(lanes7.size, 2, "группа — по обеим колеям");
  const e = { type: "cyclists", side: 1, wy: 3000, count: 7, f0: 0 };
  const ws = [0, 1, 2, 3, 4, 5, 6].map(i => K.cyclistWy(e, i) + "/" + K.cyclistLane(i, 7));
  assert.equal(new Set(ws).size, 7, "никто не едет в одной точке с другим");
  assert.notEqual(K.cyclistLane(0, 2), K.cyclistLane(1, 2), "двое — по одному на колее");
});

// «На дороге не должны стоять палатки и дома» (05.10.2026): расстановка
// жителей берега не знала про велодорогу — лагерь или деревня вставали на неё,
// и дорога ложилась через стоящую деревню. Дальний декор сверялся с дорогой
// только у основания, а она изгибается — верх высокого дома заходил на неё.
test("жители берега не встают на велодорогу, и дорога не ложится через них", () => {
  const { K } = loadGame();
  K.startDay(2);
  for (const side of [-1, 1]) for (const dy of [-300, -120, 0, 150, 400]) {
    setupWorld(K, { wy: 3000 });
    K.G.bev = [];
    const road = { type: "cyclists", side, wy: 3600, phase: 0, count: 2 };
    K.G.bev.push(road);
    for (const type of ["camp", "village", "banya"]) {
      K.placeBev({ type, side, wy: 3600 + dy, off: 40, phase: 0, mode: "sit", seed: 5 }, 1);
    }
    for (const e of K.G.bev) if (e !== road) assert.ok(!K.roadHitsBox(road, K.measureBev(e)), e.type + " на дороге (сдвиг " + dy + ")");
  }
  // наоборот: деревня стоит — дорога через неё не прокладывается
  setupWorld(K, { wy: 3000 });
  K.G.bev = [];
  K.placeBev({ type: "village", side: 1, wy: 3600, off: 40, phase: 0, seed: 5 }, 1);
  const vil = K.G.bev[0];
  const road = { type: "cyclists", side: 1, wy: 3600, phase: 0, count: 2 };
  const placed = K.placeBev(road, 1);
  assert.ok(!placed || !K.roadHitsBox(road, K.measureBev(vil)), "дорога через деревню");
});

test("дальний декор не задевает велодорогу и верхушкой", () => {
  const { K } = loadGame();
  K.startDay(2);
  const { setupWorld: sw } = { setupWorld };
  sw(K, { wy: 3000 });
  for (const side of [-1, 1]) {
    K.G.bev = [{ type: "cyclists", side, wy: 3600, phase: 0, count: 2 }];
    for (let v = Math.floor(3000/13); v < Math.floor(4300/13); v++)
      for (const it of K.deepItems(v, side, -560, 980))
        for (let h = 0; h <= it.h; h += 5) {            // дорога на высоте предмета — считаем сами
          const w = it.swy + h, rx = K.centerAt(w) + side*(K.widthAt(w)/2 + K.cycRoadOff(w - 3600));
          assert.ok(Math.abs(it.x - rx) >= it.w/2 + 21, it.name + " на дороге на высоте " + h);
        }
  }
});
