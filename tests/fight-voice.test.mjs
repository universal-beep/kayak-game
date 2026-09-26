// Голоса агрессивных соперников и анимация драки вёслами.
import test from "node:test";
import assert from "node:assert/strict";
import { loadGame, setupWorld } from "./harness.mjs";

function world() {
  const { K, ctx } = loadGame();
  setupWorld(K, { wy: 5000 });
  K.G.s = "playing"; K.G.day = 4; K.G.inv = 0; K.G.whiskyT = 0; K.G.obs = []; K.G.bns = []; K.G.bev = [];
  K.G.voiceCount = 0; K.G.voiceLast = -1; K.G.voiceUntil = 0;
  return { K, ctx };
}
const rower = (K, o) => Object.assign({ type: "kayaker", t: 0, wy: K.G.pwy, size: 18, halfPx: 14, visHalf: 30,
  variant: 0, vt: 0, aggro: true, swingT: -1, flipT: 0 }, o);

test("первой в уровне всегда звучит «ты не с нашего турклуба», дальше — без повтора подряд", () => {
  const { K } = world();
  const said = [];
  for (let i = 0; i < 40; i++) { K.G.voiceUntil = 0; said.push(K.tauntVoice()); }
  assert.equal(said[0], "voice_turclub");
  for (let i = 1; i < said.length; i++) assert.notEqual(said[i], said[i - 1], "одна и та же фраза подряд");
  for (const v of ["voice_turclub", "voice_chapalah", "voice_batony"]) assert.ok(said.includes(v), "не звучит " + v);
  K.sg();                                              // новый уровень — снова с турклуба
  K.G.voiceUntil = 0;
  assert.equal(K.tauntVoice(), "voice_turclub");
});

test("злой кричит один раз — когда близко, но чуть не достаёт до удара; мирный молчит", () => {
  const { K } = world();
  const angry = rower(K, { wy: K.G.pwy + 130, t: 0.7 });
  const calm = rower(K, { wy: K.G.pwy + 130, t: -0.7, aggro: false });
  K.G.t = -0.1;
  K.G.obs.push(angry, calm);
  const voices = [];
  for (let i = 0; i < 30; i++) {
    K.G.sfxLast = null; K.upd(); K.G.s = "playing";
    if (String(K.G.sfxLast).startsWith("voice_")) voices.push(K.G.sfxLast);
  }
  assert.deepEqual(voices, ["voice_turclub"]);
  assert.ok(angry.taunted && !calm.taunted);
  assert.equal(angry.swingT, -1, "крикнул уже в замахе — поздно");
});

test("фразы не накладываются друг на друга", () => {
  const { K } = world();
  const a = rower(K, { wy: K.G.pwy + 120, t: 0.7 }), b = rower(K, { wy: K.G.pwy + 130, t: -0.7 });
  K.G.t = 0; K.G.obs.push(a, b);
  let n = 0;
  for (let i = 0; i < 20; i++) { K.G.sfxLast = null; K.upd(); K.G.s = "playing"; if (String(K.G.sfxLast).startsWith("voice_")) n++; }
  assert.equal(n, 1, "две фразы одновременно");
});

test("весло: поднимается над головой, заносится и обрушивается в сторону игрока", () => {
  const { K } = world();
  K.G.t = 0;
  const o = rower(K, { t: 0.4 });
  const s = Math.sign(K.G.t - o.t);                   // игрок слева от соперника
  const at = swingT => { o.swingT = swingT; return K.paddlePose(o); };
  const start = at(K.SWING_FRAMES), up = at(K.PARRY_WINDOW + 8), hit = at(1);
  assert.equal(K.fightPhase(Object.assign(o, { swingT: K.SWING_FRAMES })), "raise");
  assert.equal(K.fightPhase(Object.assign(o, { swingT: K.PARRY_WINDOW + 8 })), "hold");
  assert.equal(K.fightPhase(Object.assign(o, { swingT: 5 })), "strike");
  assert.ok(start.tipZ < 15, "в начале весло ещё не поднято");
  assert.ok(up.tipZ > 35, "в замахе весло не над головой: z=" + up.tipZ.toFixed(0));
  assert.ok(hit.tipZ < 12, "удар не опустился к воде");
  assert.ok((hit.tipX - up.pivotX) * s > 40, "удар не в сторону игрока");
});

test("успешное парирование — искра в точке встречи вёсел", () => {
  const { K } = world();
  K.G.t = 0;
  const o = rower(K, { t: 0.4, swingT: K.PARRY_WINDOW - 4 });
  K.G.obs.push(o);
  K.paddleStrike();
  assert.ok(K.G.clash && K.G.clash.life > 0, "нет искры");
  const px = K.screenXOf(K.G.t, K.G.pwy), ox = K.screenXOf(o.t, o.wy);
  assert.ok(K.G.clash.x > Math.min(px, ox) && K.G.clash.x < Math.max(px, ox), "искра не между лодками");
});

test("далеко злой не кричит — только когда почти достаёт", () => {
  const { K } = world();
  const far = rower(K, { wy: K.G.pwy + 400, t: 0.7 });
  K.G.t = -0.1; K.G.obs.push(far);
  K.G.sfxLast = null; K.upd();
  assert.ok(!far.taunted, "кричит издалека");
});

test("злого рядом можно ударить первым, не дожидаясь его замаха", () => {
  const { K } = world();
  K.G.t = 0;
  const o = rower(K, { t: 0.4, swingT: -1 });
  K.G.obs.push(o);
  K.paddleStrike();
  assert.ok(o.flipT > 0, "удар по злому рядом не сработал");
  const calm = rower(K, { t: -0.4, aggro: false });
  K.G.obs = [calm]; K.paddleStrike();
  assert.ok(!(calm.flipT > 0), "мирного бить нельзя");
  const far = rower(K, { t: 0.4, wy: K.G.pwy + 300 });
  K.G.obs = [far]; K.paddleStrike();
  assert.ok(!(far.flipT > 0), "достал веслом того, кто далеко");
});

test("бревно у моста уходит в средний пролёт, а не проходит сквозь опору", () => {
  const { K } = world();
  K.G.day = 4; K.G.rWidth = K.RIVERS[2].width;
  const b = { wy: K.G.pwy + 900, passed: false };
  K.G.bridges_ = [b];
  for (const t0 of [0.44, -0.44, 0.6, -0.3]) {
    const log = { type: "log", t: t0, wy: b.wy - 500, vt: 0, visHalf: 27, visHalfY: 10, halfPx: 20 };
    let at = null;
    for (let i = 0; i < 2000 && at === null; i++) { K.logStep(log, 0.6); K.bridgeGuard(log); if (log.wy >= b.wy) at = log.t; }
    assert.notEqual(at, null, "бревно не доплыло до моста");
    const hw = K.widthAt(b.wy) / 2;
    const toPier = Math.min(Math.abs((at - 0.44) * hw), Math.abs((at + 0.44) * hw));
    assert.ok(toPier > 12 + log.visHalf - 1, "бревно в опору: t=" + at.toFixed(2));
  }
});

test("злых видно издалека: своя окраска (чёрная куртка, тёмно-красная лодка) и трясут веслом", () => {
  const { K } = world();
  K.G.day = 8;
  const kinds = { angry: new Set(), calm: new Set() };
  for (let i = 0; i < 400; i++) {
    K.G.obs = []; K.G.scroll += 900;
    K.spOb();
    for (const o of K.G.obs) if (o.type === "kayaker") (o.aggro ? kinds.angry : kinds.calm).add(o.variant);
  }
  assert.deepEqual([...kinds.angry], [K.AGGRO_VARIANT], "у злых не своя окраска");
  assert.ok(![...kinds.calm].includes(K.AGGRO_VARIANT), "мирный в окраске злого");
  const v = K.SPR.rower.variants[K.AGGRO_VARIANT];
  assert.ok(v && v.z === "K" && v.p === "R", "окраска злого не та");
  assert.ok(K.SPR.rower_flip.variants[K.AGGRO_VARIANT], "у перевёрнутого нет окраски злого");
  const o = rower(K, { t: 0.5, wy: K.G.pwy + 300 });
  let shakes = 0;
  for (let f = 0; f < 240; f++) { K.G.frame = f; if (K.brandishing(o)) shakes++; }
  assert.ok(shakes > 20 && shakes < 200, "не трясёт веслом: " + shakes);
});
