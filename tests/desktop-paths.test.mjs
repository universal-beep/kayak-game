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
