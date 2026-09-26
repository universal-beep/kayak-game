// Декор вдоль берега (ёлки, берёзы, кусты в drwBg): не слипается в столб,
// не налезает на жителей берега и не заходит в воду.
import test from "node:test";
import assert from "node:assert/strict";
import { loadGame, setupWorld } from "./harness.mjs";

const HTML = process.env.KAYAK_HTML || undefined;   // для проверки «красным» на старой копии

// Прогоняет drwBg и возвращает нарисованные деревья: {name, x, y, w, h} (x, y — центр).
function trees(K, ctx) {
  const imgs = new Map([[K.SPR.sfir.img, "sfir"], [K.SPR.sbirch.img, "sbirch"]]);
  const out = [];
  const orig = ctx.drawImage;
  ctx.drawImage = (img, x, y) => {
    if (imgs.has(img)) out.push({ name: imgs.get(img), x: x + img.width / 2, y: y + img.height / 2, w: img.width, h: img.height });
  };
  try { K.drwBg(); } finally { ctx.drawImage = orig; }
  return out;
}

function world(wy) {
  const { K, ctx } = loadGame(HTML);
  setupWorld(K, { wy });
  K.G.rBend = 1; K.G.frame = 0; K.G.bev = [];
  return { K, ctx };
}

test("деревья вдоль берега стоят не чаще, чем через 39 px — не слипаются в полосатый столб", () => {
  for (const wy of [1000, 2600, 5200]) {
    const { K, ctx } = world(wy);
    const t = trees(K, ctx);
    assert.ok(t.length > 0, "на берегах нет ни одного дерева (wy=" + wy + ")");
    for (const side of [-1, 1]) {
      const ys = t.filter(d => Math.sign(d.x - K.screenXOf(0, K.worldYOf(d.y))) === side).map(d => d.y + d.h / 2).sort((a, b) => a - b);   // низы стволов
      for (let i = 1; i < ys.length; i++)
        // Шаг 39 px по миру; декор привязан к миру, на экране те же 39 px
        // с точностью до округления спрайта к целому пикселю.
        assert.ok(ys[i] - ys[i - 1] >= 37.5, "два дерева на одном берегу в " + (ys[i] - ys[i - 1]).toFixed(0) + " px друг от друга (wy=" + wy + ")");
    }
  }
});

test("декор не ставится там, где стоит житель берега", () => {
  const { K, ctx } = world(1000);
  const all = trees(K, ctx);
  assert.ok(all.length > 0);
  // Ставим рыбака на берег, где рядом было дерево.
  const d = all[0];
  const wy = K.worldYOf(d.y + d.h / 2);                  // полоса, на которой стоит дерево
  const side = Math.sign(d.x - K.screenXOf(0, wy));
  K.G.bev = [{ type: "fisher", side, wy, off: 30, phase: 0, mode: "sit" }];
  const near = trees(K, ctx).filter(t => Math.sign(t.x - K.screenXOf(0, wy)) === side &&
    Math.abs(K.worldYOf(t.y + t.h / 2) - wy) < 70);
  assert.equal(near.length, 0, "рядом с рыбаком осталось деревьев: " + near.length);
});

test("деревья выше человека и целиком на суше", () => {
  const { K, ctx } = world(2600);
  const person = K.spriteSize("person").h;
  for (const n of ["sfir", "sbirch"]) assert.ok(K.spriteSize(n).h > person, n + " ниже человека");
  for (const d of trees(K, ctx)) {
    const wy = K.worldYOf(d.y + d.h / 2);
    const hw = K.widthAt(wy) / 2, c = K.centerAt(wy);
    const inner = Math.abs(d.x - c) - d.w / 2;               // край кроны со стороны воды
    assert.ok(inner >= hw - 0.5, d.name + " заходит в воду на " + (hw - inner).toFixed(1) + " px");
  }
});

// Баг: hsh считал n*n*15731 в дробных числах. Уже при n в сотни произведение
// больше 2^53, младшие биты теряются, и hsh почти всегда давал 0. Итог:
// деревья были только на первых ~780 px дня, кусты — на ~1560 px, а дальше
// (95% пути: день 800 м = 20 000 px) берега стояли голыми.
test("hsh равномерен и на больших номерах", () => {
  const { K } = world(1000);
  for (const [a, b] of [[0, 2000], [5000, 7000], [100000, 102000]]) {
    let hi = 0;
    for (let v = a; v < b; v++) hi += K.hsh(v * 17 + 5) > 0.5 ? 1 : 0;
    const share = hi / (b - a);
    assert.ok(share > 0.4 && share < 0.6, "доля значений > 0.5 на " + a + "–" + b + ": " + share.toFixed(3));
  }
});

test("деревья и кусты есть по всей длине дня, а не только в начале", () => {
  for (const wy of [5000, 12000, 19000]) {
    const { K, ctx } = world(wy);
    const names = new Map([[K.SPR.sfir.img, 1], [K.SPR.sbirch.img, 1], [K.SPR.sbush.img, 1]]);
    let n = 0;
    const orig = ctx.drawImage;
    ctx.drawImage = img => { if (names.has(img)) n++; };
    try { K.drwBg(); } finally { ctx.drawImage = orig; }
    assert.ok(n >= 5, "на " + wy + " px от старта дня декора " + n + " шт. — берега голые");
  }
});

test("песчаные отмели время от времени встречаются на обоих берегах, на них не растут деревья", () => {
  const { K } = world(1000);
  const segs = { "-1": 0, "1": 0 };
  let total = 0;
  for (let seg = 0; seg < 400; seg++) {
    total++;
    for (const side of [-1, 1]) {
      let any = false;
      for (let wy = seg * 260; wy < (seg + 1) * 260; wy += 8) if (K.sandBar(wy, side) > 4) any = true;
      if (any) segs[side]++;
    }
  }
  const share = (segs["-1"] + segs["1"]) / total;
  assert.ok(share > 0.12 && share < 0.35, "отмели на " + (share * 100).toFixed(0) + "% участков — должно быть «время от времени»");
  assert.ok(segs["-1"] > 10 && segs["1"] > 10, "отмели есть на обоих берегах: " + JSON.stringify(segs));
  // На отмели деревьев нет.
  for (let wy = 0; wy < 60000; wy += 13) {
    for (const side of [-1, 1]) if (K.sandBar(wy, side) > 1) {
      const w = world(wy + 200);
      const onBar = trees(w.K, w.ctx).filter(d => {
        const foot = w.K.worldYOf(d.y + d.h / 2);
        return Math.sign(d.x - w.K.screenXOf(0, foot)) === side && w.K.sandBar(foot, side) > 1;
      });
      assert.equal(onBar.length, 0, "дерево стоит на песчаной отмели");
      return;
    }
  }
  assert.fail("не нашлось ни одной отмели для проверки");
});
