// Ночёвки: пропуск мульта глушит его звук; ночи разные, но узнаваемые;
// вторая ночь — «о-о, батарейка» и разговор двух туристов.
import test from "node:test";
import assert from "node:assert/strict";
import { loadGame } from "./harness.mjs";

function fakeAudio() {
  const log = { started: 0, stopped: 0, at: [] };
  const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} });
  const node = () => ({ connect() {}, disconnect() {}, type: "", buffer: null, frequency: param(), gain: param(), Q: param(),
    start(t) { log.started++; log.at.push(t || 0); }, stop() { log.stopped++; } });
  return { log, ctx: { currentTime: 0, sampleRate: 44100, destination: {}, state: "running",
    createOscillator: node, createGain: node, createBiquadFilter: node, createBufferSource: node,
    decodeAudioData: (arr, ok) => ok({ duration: 3 }) } };
}

test("пропуск мульта (пробел) глушит его звук", () => {
  const { K } = loadGame();
  const a = fakeAudio();
  K.setAudio(a.ctx);
  K.playCut("night", () => {});
  const srcs = K.cutSources().length;
  assert.ok(srcs > 0, "ночной мульт без звука");
  K.endCut();
  assert.equal(K.cutSources().length, 0, "источники звука мульта не остановлены");
  assert.ok(a.log.stopped >= srcs, "остановлено " + a.log.stopped + " из " + srcs);
});

test("ночи по дням: после 1, 3, 5, 7 и 8 дня — пять разных ночей", () => {
  const { K } = loadGame();
  const names = [1, 3, 5, 7, 8].map(d => K.nightName(d));
  assert.deepEqual(names, ["night", "night2", "night3", "night4", "night5"]);
  for (const n of names) assert.ok(K.CUTS[n], "нет мульта " + n);
});

test("ночи непохожие, но узнаваемые: те же палатки, костёр и герой — другой расклад и пейзаж", () => {
  const { K } = loadGame();
  const base = K.CUTS.night;
  const sig = sc => JSON.stringify([sc.mirror || false, sc.ground, sc.water, sc.moon, (sc.actors || []).map(a => a.spr + (a.var || 0)).join(",")]);
  const seen = new Set([sig(base)]);
  for (const n of ["night2", "night3", "night4", "night5"]) {
    const sc = K.CUTS[n];
    const count = s => sc.actors.filter(a => a.spr === s).length;
    assert.ok(count("tent") + count("tent2") >= 6, n + ": палаток меньше");
    assert.ok(sc.actors.some(a => a.spr === "night_guitar"), n + ": нет гитариста");
    assert.ok(sc.actors.some(a => a.spr === "fire0"), n + ": нет костра");
    const s = sig(sc);
    assert.ok(!seen.has(s), n + " повторяет другую ночь");
    seen.add(s);
  }
});

test("вторая ночь: «о-о, батарейка», потом двое у костра говорят — без текста, с движением", () => {
  const { K } = loadGame();
  const sc = K.CUTS.night2;
  assert.equal(sc.song, false, "целая песня (со «спать») во второй ночи не нужна");
  assert.deepEqual(Array.from(sc.sounds, s => s.key), ["n2_song", "n2_a1", "n2_b1", "n2_a2"]);
  assert.ok(!sc.lines || sc.lines.length === 0, "текст облачков не нужен");
  const talkers = sc.actors.filter(a => a.talk);
  assert.equal(talkers.length, 2, "говорящих должно быть двое");
  const [A, B] = talkers, kx = a => a.keys[0][1], ky = a => a.keys[0][2];
  assert.ok(Math.abs(kx(A) - kx(B)) < 40 && Math.abs(ky(A) - ky(B)) < 12, "двое не рядом");
  const fire = sc.actors.find(a => a.spr === "fire0");
  assert.ok(Math.abs(kx(B) - kx(fire.keys ? fire : fire)) < 60, "двое не у костра");
  const talks = (a, sec) => a.talk.some(p => sec*60 >= p[0] && sec*60 < p[1]);
  for (const snd of sc.sounds.slice(1)) {
    const who = snd.key === "n2_b1" ? B : A, other = who === A ? B : A;
    assert.ok(talks(who, snd.at + 0.5), snd.key + ": не двигается тот, кто говорит");
    assert.ok(!talks(other, snd.at + 0.5), snd.key + ": двигается тот, кто молчит");
  }
  assert.ok(sc.tallies.some(t => t.spr === "icon_battery") && sc.tallies.some(t => t.spr === "icon_horse"), "нет батареек и коней");
});

test("вторая ночь идёт в полном кадре — без наезда камеры (крупно пиксели грубые)", () => {
  const { K } = loadGame();
  const sc = K.CUTS.night2;
  for (let sec = 0; sec < sc.len/60; sec += 0.5) assert.equal(K.cutCam(sc, sec*60, 1024, 768, 768/720).z, 1, "наезд на " + sec + " с");
});

test("вторая ночь: после разговора остаются двое, гитарист и один у палатки; остальные уходят; медведь; затемнение", () => {
  const { K } = loadGame();
  const sc = K.CUTS.night2;
  const len = sc.len;
  const shown = (a, sec) => { const k = a.keys; const f = sec*60/len; let i = 0; while (i < k.length - 2 && f > k[i+1][0]) i++;
    const k0 = k[i], k1 = k[Math.min(i+1, k.length-1)], u = Math.max(0, Math.min(1, (f - k0[0]) / Math.max(1e-6, k1[0] - k0[0]))); return k0[4] + (k1[4] - k0[4])*u; };
  const people = sc.actors.filter(a => a.spr === "person");
  const during = people.filter(a => shown(a, 14) > 0.5).length, after = people.filter(a => shown(a, 19.8) > 0.5).length;
  assert.ok(during >= 3, "во время разговора уже разошлись: осталось " + during);
  assert.equal(after, 1, "после ухода у палатки должен остаться один, осталось " + after);
  assert.ok(sc.actors.filter(a => a.talk).every(a => shown(a, 19.8) > 0.5), "говорящие ушли");
  assert.ok(shown(sc.actors.find(a => a.spr === "night_guitar"), 19.8) > 0.5, "гитарист ушёл");
  const bear = sc.actors.find(a => a.spr === "bear");
  assert.ok(shown(bear, 15) < 0.1 && shown(bear, 19.2) > 0.9, "медведь не выходит после разговора");
  assert.ok(sc.fadeOut && sc.fadeOut.len >= 90 && sc.fadeOut.len <= 150, "нет затемнения в конце");
  assert.ok(sc.len/60 - 15.8 >= 5, "после разговора меньше 3–4 с на уход и медведя + затемнение");
});

test("мульт второй ночи планирует свои звуки по времени и не играет целую ночную песню", () => {
  const { K } = loadGame();
  const a = fakeAudio();
  K.setAudio(a.ctx);
  K.G.day = 3;
  K.playCut(K.nightName(3), () => {});
  assert.equal(K.G.cut.name, "night2");
  const at = a.log.at.slice().sort((x, y) => x - y);
  assert.equal(at.length, 4, "звуков запланировано: " + at.length);
  assert.ok(Math.abs(at[1] - K.CUTS.night2.sounds[1].at) < 0.01);
  K.endCut();
});
