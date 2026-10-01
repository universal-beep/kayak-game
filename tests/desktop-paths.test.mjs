// На десктопе видно шире, и всё, что раньше пропадало за краем поля, должно
// уходить за край ОКНА. Цапля и утки улетали по таймеру (110 и 70 кадров) —
// на десктопе исчезали посреди боковой зоны. Теперь — когда улетели за край
// видимой сцены (вбок или вверх). Собака не зажата в пределах поля.
import test from "node:test";
import assert from "node:assert/strict";
import { loadGame, setupWorld } from "./harness.mjs";

const X0 = -560, X1 = 980;
function world(day) {
  const { K } = loadGame();
  K.resetSave(); K.setAudio(null);
  K.startDay(day); setupWorld(K, { wy: 3000 });
  K.G.s = "playing";
  return K;
}
// Летит, пока не исчезнет; возвращает кадр и положение ведущей птицы при исчезновении.
function flyAway(K, type, x0, x1) {
  const e = { type, side: 1, wy: K.G.pwy + 380, phase: 0, hops: 99 };
  K.G.bev = [e];
  e.away = 1; e.fl = 0;
  let f = 0, last = null;
  while (!e.dead && f++ < 2000) {
    K.withView(x0, x1, () => { K.rndr(); });          // rndr запоминает видимую ширину
    last = K.flightPos(e);
    K.updBev(e);
  }
  return { f, last };
}

test("цапля улетает за край видимой сцены, а не по таймеру", () => {
  for (const [x0, x1, name] of [[0, null, "телефон"], [X0, X1, "десктоп"]]) {
    const K = world(2);
    const r = flyAway(K, "heron", x0, x1 == null ? K.W : x1);
    assert.ok(r.f < 2000, name + ": улетела");
    const right = x1 == null ? K.W : x1;
    assert.ok(r.last.x > right + 20 || r.last.y < -20, name + ": исчезла за краем: x=" + Math.round(r.last.x) + " y=" + Math.round(r.last.y));
  }
  const Kp = world(2), Kd = world(2);
  assert.ok(flyAway(Kd, "heron", X0, X1).f > flyAway(Kp, "heron", 0, Kp.W).f, "на десктопе полёт длиннее");
});

test("утки тоже улетают за край видимой сцены", () => {
  const K = world(0);
  const r = flyAway(K, "ducks", X0, X1);
  assert.ok(r.last.x > X1 + 20 || r.last.y < -20, "x=" + Math.round(r.last.x) + " y=" + Math.round(r.last.y));
});

test("собака на десктопе не прижата к краю поля", () => {
  const K = world(0);
  let ok = null;
  K.withView(X0, X1, () => { ok = K.clampView(K.W + 120, 14); });
  assert.equal(ok, K.W + 120, "за краем поля — там, где есть");
  assert.equal(K.clampView(K.W + 120, 14), K.W - 14, "на телефоне — у края экрана");
});

test("дальние сцены живые: коровы щиплют траву, медведь бродит, над костром дым", () => {
  const K = world(0);
  const at = (spr, f) => K.farPart({ spr, dx: 200 }, 0, f);
  const cows = new Set(), bearX = new Set();
  for (let f = 0; f < 600; f += 15) { cows.add(at("cow", f).spr); bearX.add(Math.round(at("bear", f).ox)); }
  assert.ok(cows.has("cow") && cows.has("cow_b"), "корова опускает и поднимает голову");
  assert.ok(bearX.size > 3, "медведь ходит");
  assert.ok(at("fire", 100).smoke, "у костра дым");
});

// Велосипедисты: дорога на концах уходит от реки за край экрана. На десктопе
// экран шире — дорога обрывалась у края поля, а ездоки пропадали в конце
// пути (±CYC_SPAN) посреди луга. Теперь дорога загибается дальше, пока не уйдёт
// за край окна, и ездоки едут по ней до края.
test("велосипедисты: дорога и ездоки уходят за край окна, а не обрываются у поля", () => {
  const K = world(2);
  assert.ok(K.cycRoadOff(2*K.CYC_SPAN) > 800, "дальше загибается: " + K.cycRoadOff(2*K.CYC_SPAN));
  const e = { type: "cyclists", side: 1, wy: K.G.pwy + 300, phase: 0, count: 1, f0: K.G.frame };
  const ax = w => K.centerAt(w) + K.widthAt(w)/2;
  // ездок на 1000 px ниже места дороги: раньше его уже не рисовали
  const w = e.wy - 1000, x = ax(w) + K.cycRoadOff(w - e.wy);
  let wide = null, phone = null;
  K.withView(X0, X1, () => { wide = K.cyclistShown(e, w); });
  phone = K.cyclistShown(e, w);
  assert.equal(wide, x < X1 + 30 && K.screenYOf(w) > -40 && K.screenYOf(w) < K.H + 40, "на десктопе виден, пока в окне");
  assert.equal(phone, x < K.W + 30 && K.screenYOf(w) > -40 && K.screenYOf(w) < K.H + 40, "на телефоне — пока на экране");
});

test("медведь на берегу бродит шире на десктопе, но не дальше 260 px от воды", () => {
  const K = world(2);
  const e = { type: "bear", side: 1, wy: K.G.pwy + 200, phase: 0 };
  const phone = K.bearRoam(e);
  let wide = null;
  K.withView(X0, X1, () => { wide = K.bearRoam(e); });
  assert.ok(wide > phone, "шире: " + Math.round(wide) + " против " + Math.round(phone));
  assert.ok(wide <= 260, "не дальше 260: " + Math.round(wide));
});

// Ещё живые сцены только для десктопа, по разным рекам: лоси щиплют траву
// (Тверца, Осуга), грибники (Медведица, Осуга), охотник с собакой гонит
// медведя (Медведица).
test("новые сцены: спрайты и разнесены по рекам", () => {
  const K = world(0);
  for (const n of ["hunter", "hunter_b", "mushroomer", "mushroomer_b", "mushrooms", "bear_run", "bear_run_b"]) {
    assert.ok(K.SPR[n], "нет " + n);
    if (n !== "mushrooms") assert.ok(K.SPR[n + "_l"], "нет отражения " + n);
  }
  const names = r => K.FAR_SCENES[r].map(s => s.name);
  assert.ok(names(1).includes("hunt") && names(1).includes("mushrooms"), "Медведица: " + names(1));
  assert.ok(names(2).includes("moosegraze"), "Тверца: " + names(2));
  assert.ok(names(3).includes("mushrooms") && names(3).includes("moose"), "Осуга: " + names(3));
  for (let r = 0; r < 4; r++) for (const sc of K.FAR_SCENES[r]) for (const p of sc.parts) assert.ok(p.dx >= 140, sc.name + " у поля");
});

test("погоня: медведь впереди, собака за ним, охотник сзади; бегут, пока сцена проплывает", () => {
  const K = world(2);
  const hunt = K.FAR_SCENES[1].find(s => s.name === "hunt");
  const a = K.farChase({ side: -1, parts: hunt.parts }, 100, 0), b = K.farChase({ side: -1, parts: hunt.parts }, 500, 0);
  const dx = (r, spr) => r.find(p => p.spr.startsWith(spr)).dx;
  for (const r of [a, b]) {
    assert.ok(dx(r, "bear_run") < dx(r, "dog_run") && dx(r, "dog_run") < dx(r, "hunter"), "медведь ближе к реке, охотник дальше всех");
    for (const p of r) assert.ok(p.dx >= 140, "только на десктопе");
  }
  assert.ok(dx(b, "bear_run") < dx(a, "bear_run"), "бегут к реке, пока сцена проплывает вниз");
  const right = K.farChase({ side: 1, parts: hunt.parts }, 300, 0);
  assert.ok(right.every(p => p.spr.endsWith("_l")), "на правом берегу бегут влево — отражены");
  assert.notEqual(K.farChase({ side: -1, parts: hunt.parts }, 300, 0)[0].spr, K.farChase({ side: -1, parts: hunt.parts }, 300, 7)[0].spr, "лапы переступают");
});

test("грибница наклоняется к грибам", () => {
  const K = world(2);
  const s = new Set();
  for (let f = 0; f < 400; f += 10) s.add(K.farPart({ spr: "mushroomer", dx: 200 }, 0, f).spr);
  assert.ok(s.has("mushroomer") && s.has("mushroomer_b"));
});

test("грибники разные; сектанты у огня — только на 7-м дне и ходят по кругу", () => {
  const K = world(6);
  assert.equal(K.SPR.mushroomer.variants.length, 3, "три расцветки грибницы");
  assert.ok(K.SPR.grandpa && K.SPR.grandpa_l, "дед-грибник");
  const cultOn = d => { for (let s = 0; s < 6000; s++) { const sc = K.farScene(s, 3, d); if (sc && sc.name === "cult") return true; } return false; };
  assert.equal(cultOn(7), true, "на 7-м дне есть");
  for (const d of [8, 9]) assert.equal(cultOn(d), false, "на " + d + "-м нет");
  const cult = K.FAR_SCENES[3].find(s => s.name === "cult");
  const ring = cult.parts.filter(p => p.ring !== undefined);
  assert.equal(ring.length, 5, "пятеро");
  const a = K.farPart(ring[0], 1, 0), b = K.farPart(ring[0], 1, 300);
  assert.ok(Math.abs(a.ox - b.ox) > 5 || Math.abs(a.dy - b.dy) > 3, "ходят по кругу");
  const arms = new Set(); for (let f = 0; f < 320; f += 10) arms.add(K.farPart(ring[0], 1, f).spr);
  assert.ok(arms.has("cultist") && arms.has("cultist_b"), "поднимают руки");
});
