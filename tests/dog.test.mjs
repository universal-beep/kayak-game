// Собака рыбака: лежит, пока лодка далеко от берега; близко — вскакивает,
// бежит, присаживается и прыгает. Увернулся — очки, попала — сердце.
import test from "node:test";
import assert from "node:assert/strict";
import { loadGame, setupWorld } from "./harness.mjs";

function world(day = 3) {
  const { K } = loadGame();
  K.resetSave();
  K.G.day = day - 1; K.sg();
  setupWorld(K, { wy: 5000 });
  K.G.s = "playing"; K.G.sp = 3; K.G.hp = 3; K.G.inv = 0;
  const e = { type: "fisher", kind: "fisher_kid", side: 1, wy: K.G.pwy + 120, off: 30, phase: 0 };
  e.dog = K.mkDog(e);
  K.G.bev = [e];
  return { K, e };
}
// Прокрутка кадров: лодка стоит у правого берега (t≈1) или уходит от него.
function run(K, e, frames, t) {
  for (let i = 0; i < frames; i++) { K.G.t = t; K.G.pwy += 3; K.G.scroll += 3; K.dogStep(e); if (e.dog.state === "swim") break; }
}

test("лодка далеко от берега — собака лежит", () => {
  const { K, e } = world();
  run(K, e, 300, -0.5);
  assert.equal(e.dog.state, "lie");
});

test("лодка у берега рядом по течению — вскакивает, бежит, присаживается и прыгает", () => {
  const { K, e } = world();
  const seen = new Set();
  for (let i = 0; i < 500 && e.dog.state !== "swim"; i++) { K.G.t = 0.9; K.G.pwy += 3; K.G.scroll += 3; K.dogStep(e); seen.add(e.dog.state); }
  for (const s of ["alert", "run", "tell", "leap", "swim"]) assert.ok(seen.has(s), "состояние " + s);
});

test("попала: минус сердце", () => {
  const { K, e } = world();
  run(K, e, 600, 0.9);
  assert.equal(e.dog.state, "swim");
  assert.equal(K.G.hp, 2);
});

test("увернулся — отвернул от берега в замахе: очки, сердце цело", () => {
  const { K, e } = world();
  const b0 = K.G.bsc;
  for (let i = 0; i < 600 && e.dog.state !== "swim"; i++) {
    K.G.t = e.dog.state === "tell" || e.dog.state === "leap" ? -0.5 : 0.9;   // видит замах и отворачивает
    K.G.pwy += 3; K.G.scroll += 3; K.dogStep(e);
    if (e.dog.state === "lie" && i > 100) break;
  }
  // Если отвернул раньше прыжка, собака теряет интерес и прыжка нет — тоже без урона.
  assert.equal(K.G.hp, 3);
  assert.ok(e.dog.state === "lie" || e.dog.state === "swim");
  if (e.dog.state === "swim") { assert.ok(K.G.bsc > b0); assert.equal(K.G.dogDodged, 1); }
});

test("прыжок мимо по течению: лодка рванула вперёд — собака промахивается, очки", () => {
  const { K, e } = world();
  for (let i = 0; i < 600 && e.dog.state !== "swim"; i++) {
    K.G.t = 0.9; K.G.pwy += 3; K.G.scroll += 3;
    if (e.dog.state === "leap") K.G.pwy += 120;                            // ушёл вперёд за время прыжка
    K.dogStep(e);
  }
  assert.equal(e.dog.state, "swim");
  assert.equal(K.G.hp, 3);
  assert.equal(K.G.dogDodged, 1);
});

test("после прыжка плывёт назад и сидит у берега: второго прыжка нет", () => {
  const { K, e } = world();
  run(K, e, 600, 0.9);
  for (let i = 0; i < K.DOG_SWIM + 2; i++) { K.G.t = 0.9; K.G.pwy += 3; K.dogStep(e); }
  assert.equal(e.dog.state, "done");
  const hp = K.G.hp;
  for (let i = 0; i < 300; i++) { K.G.t = 0.9; K.G.pwy += 3; K.dogStep(e); }
  assert.equal(K.G.hp, hp);
  assert.equal(e.dog.state, "done");
});

test("собака есть только у папы с сыном и у «Нивы», со 2-го дня", () => {
  const { K } = loadGame();
  for (const [day, expectDogs] of [[1, false], [3, true]]) {
    K.resetSave(); K.G.day = day - 1; K.sg(); setupWorld(K, { wy: 5000 }); K.G.s = "playing";
    let withDog = 0, kinds = new Set();
    for (let i = 0; i < 400; i++) {
      K.G.bev = [];
      K.G.scroll += 700; K.G.pwy += 700;
      K.G.dist = 400; K.G.ned = 0;
      for (const e of []) void e;
      // спавним береговые сцены вызовом игры
      K.G.ned = -1;
      K.upd();
      for (const e of K.G.bev) if (e.type === "fisher" && e.dog) { withDog++; kinds.add(e.kind); }
    }
    if (expectDogs) assert.ok(withDog > 0, "день " + day + " собаки бывают");
    else assert.equal(withDog, 0, "день " + day + " собак нет");
    for (const k of kinds) assert.ok(k === "fisher_kid" || k === "fisher_car", k);
  }
});

test("собака в деле держит сцену, пока не отплыла; рисуется в любом состоянии и с любого берега", () => {
  const { K, e } = world();
  e.dog.state = "run";
  assert.ok(K.dogBusy(e.dog));
  e.dog.state = "lie";
  assert.ok(!K.dogBusy(e.dog));
  for (const side of [-1, 1]) {
    e.side = side;
    for (const st of ["lie", "alert", "run", "tell", "leap", "swim", "done"]) {
      e.dog.state = st; e.dog.age = 5; e.dog.swy = K.G.pwy; e.dog.st = 0;
      assert.doesNotThrow(() => K.drwDog(e), st + " side " + side);
    }
  }
});
