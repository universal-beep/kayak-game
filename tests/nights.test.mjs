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
    // В четвёртой ночи гитару ищут — вместо сидящего гитариста ходит Андрюха.
    assert.ok(sc.actors.some(a => a.spr === "night_guitar" || a.andr), n + ": нет гитариста");
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

test("третья ночь: гитарист приходит, просят без батарейки, он поёт «о-о, канарейка», второй замечает сходство", () => {
  const { K } = loadGame();
  const sc = K.CUTS.night3;
  assert.equal(sc.song, false, "целая ночная песня в третьей ночи не нужна");
  assert.deepEqual(Array.from(sc.sounds, s => s.key), ["n3_a1", "n3_g1", "n3_g2", "n3_b1"]);
  for (let i = 1; i < sc.sounds.length; i++) assert.ok(sc.sounds[i].at > sc.sounds[i - 1].at + 1, "реплики налезают");
  const len = sc.len;
  const shown = (a, sec) => { const k = a.keys; const f = sec*60/len; let i = 0; while (i < k.length - 2 && f > k[i+1][0]) i++;
    const k0 = k[i], k1 = k[Math.min(i+1, k.length-1)], u = Math.max(0, Math.min(1, (f - k0[0]) / Math.max(1e-6, k1[0] - k0[0])));
    return { al: k0[4] + (k1[4] - k0[4])*u, x: k0[1] + (k1[1] - k0[1])*u, y: k0[2] + (k1[2] - k0[2])*u }; };
  const guitar = sc.actors.find(a => a.spr === "night_guitar");
  const walker = sc.actors.find(a => a.walkIn);
  assert.ok(walker, "гитарист не приходит к костру");
  assert.ok(shown(guitar, 0.5).al < 0.1 && shown(walker, 0.5).al > 0.9, "в начале гитарист уже сидит");
  const g1 = sc.sounds.find(s => s.key === "n3_g1").at;
  assert.ok(shown(guitar, g1).al > 0.9 && shown(walker, g1).al < 0.1, "к ответу гитарист не сел");
  const w0 = shown(walker, 0.1), w1 = shown(walker, g1 - 1.2);
  assert.ok(Math.hypot(w1.x - w0.x, w1.y - w0.y) > 60, "гитарист не идёт, а стоит");
  const talkers = sc.actors.filter(a => a.talk);
  const who = key => { const at = sc.sounds.find(s => s.key === key).at + 0.4; return talkers.filter(a => a.talk.some(p => at*60 >= p[0] && at*60 < p[1])); };
  assert.equal(who("n3_a1").length, 1); assert.equal(who("n3_b1").length, 1);
  assert.notEqual(who("n3_a1")[0], who("n3_b1")[0], "просит и замечает сходство один и тот же");
  assert.equal(who("n3_g1")[0], guitar, "отвечает не гитарист");
  assert.ok(sc.actors.some(a => a.spr === "canary0" || (a.cycle && a.cycle.spr.includes("canary0"))), "нет канарейки");
  const last = sc.sounds[sc.sounds.length - 1].at + 2.5;
  assert.ok(len/60 - last >= 4.5, "после разговора нет 3–4 с на уход и затемнения");
  assert.ok(sc.fadeOut && sc.fadeOut.len >= 90, "нет затемнения");
});

test("третья ночь: гитарист идёт в одной и той же одежде; вместо домов тёмный лес сзади; поляна пустая, по бокам лес", () => {
  const { K } = loadGame();
  const sc = K.CUTS.night3;
  const walker = sc.actors.find(a => a.walkIn);
  const frames = walker.cycle ? Array.from(walker.cycle.spr) : [walker.spr];
  const colors = n => { const set = new Set(K.SPR[n].map.join("").replace(/[.kK]/g, "")); return [...set].sort().join(""); };
  for (const f of frames) assert.equal(colors(f), colors(frames[0]), "на шаге меняется одежда: " + f);
  assert.ok(walker.var == null || walker.var === 0, "вариант окраски на кадрах шага не применяется — нужен свой спрайт");
  assert.ok(!sc.actors.some(a => a.spr === "house" || a.spr === "church"), "дома и церковь лишние");
  assert.ok(sc.far, "нет тёмного фона сзади");
  const seat = sc.actors.find(a => a.spr === "seat_log"), g = sc.actors.find(a => a.spr === "night_guitar");
  assert.ok(seat, "бревна-сиденья нет до прихода гитариста");
  assert.deepEqual(Array.from(seat.keys[0]).slice(1, 4), Array.from(g.keys[0]).slice(1, 4), "бревно не под гитаристом");
  assert.equal(seat.keys[0][4], 1, "бревно не видно с начала");
  assert.ok(sc.actors.indexOf(seat) < sc.actors.indexOf(g), "бревно рисуется поверх гитариста");
  const tents = sc.actors.filter(a => a.spr === "tent" || a.spr === "tent2").map(a => a.keys[0]);
  const trees = sc.actors.filter(a => ["sfir", "sbirch"].includes(a.spr)).map(a => a.keys[0]);
  // Поляна пустая: у палаток и костра деревьев нет; лес — по бокам.
  const fire = sc.actors.find(a => a.spr === "fire0").keys[0];
  const onClearing = trees.filter(t => tents.some(p => Math.hypot(t[1] - p[1], t[2] - p[2]) < 45) || Math.hypot(t[1] - fire[1], t[2] - fire[2]) < 80);
  assert.deepEqual(Array.from(onClearing, t => t[1] + "," + t[2]), [], "деревья на поляне");
  const front = trees.filter(t => t[1] >= 0 && t[1] <= 420 && t[2] > 290).length;
  assert.equal(front, 0, "внутри сцены перед лагерем деревья: " + front);
  const sides = trees.filter(t => t[1] < 0 || t[1] > 420).length;
  assert.ok(sides >= 150, "по бокам мало леса: " + sides);
});

test("четвёртая ночь: Андрюха ищет гитару, у костра шестеро играют в мафию, двое у палатки, песчаный берег, лес реже и дальше", () => {
  const { K } = loadGame();
  const sc = K.CUTS.night4, len = sc.len;
  assert.equal(sc.song, false);
  assert.deepEqual(Array.from(sc.sounds, s => s.key), ["n4_g1", "n4_a1", "n4_b1", "n4_g2", "n4_b2", "n4_g3"]);
  for (let i = 1; i < sc.sounds.length; i++) assert.ok(sc.sounds[i].at > sc.sounds[i - 1].at + 0.4, "реплики налезают");
  assert.ok(!sc.actors.some(a => a.spr === "night_guitar" || a.spr === "guitar_walk0"), "гитары быть не должно — её ищут");
  const shown = (a, sec) => { const k = a.keys; const f = sec*60/len; let i = 0; while (i < k.length - 2 && f > k[i+1][0]) i++;
    const k0 = k[i], k1 = k[Math.min(i+1, k.length-1)], u = Math.max(0, Math.min(1, (f - k0[0]) / Math.max(1e-6, k1[0] - k0[0])));
    return { al: k0[4] + (k1[4] - k0[4])*u, x: k0[1] + (k1[1] - k0[1])*u, y: k0[2] + (k1[2] - k0[2])*u }; };
  const andr = sc.actors.filter(a => a.andr);
  const visible = sec => andr.filter(a => shown(a, sec).al > 0.5).length;
  for (const sec of [0.3, 2, 4, 9, 13, 16]) assert.equal(visible(sec), 1, "Андрюха не один/не виден на " + sec + " с");
  const walker = andr.find(a => a.cycle);
  const p0 = shown(walker, 0.1), p1 = shown(walker, 2.5);
  assert.ok(Math.hypot(p1.x - p0.x, p1.y - p0.y) > 80, "Андрюха не ходит, ищет");
  const sitters = sc.actors.filter(a => /^sitter/.test(a.spr) && !a.andr && !a.tentSit);
  assert.equal(sitters.length, 6, "у костра должно сидеть шестеро, сидит " + sitters.length);
  const fire = sc.actors.find(a => a.spr === "fire0").keys[0];
  assert.ok(sitters.every(a => Math.hypot(a.keys[0][1] - fire[1], a.keys[0][2] - fire[2]) < 70), "сидят не у костра");
  const talkers = sc.actors.filter(a => a.talk && !a.andr);
  const who = key => { const at = (sc.sounds.find(s => s.key === key).at + 0.2)*60; return sc.actors.filter(a => a.talk && a.talk.some(p => at >= p[0] && at < p[1])); };
  assert.ok(who("n4_g1")[0].andr && who("n4_g2")[0].andr && who("n4_g3")[0].andr, "говорит не Андрюха");
  assert.equal(who("n4_b1")[0], who("n4_b2")[0], "«наконец-то» и «в мафию» — один и тот же");
  assert.notEqual(who("n4_a1")[0], who("n4_b1")[0]);
  assert.equal(talkers.length, 2);
  const standing = sc.actors.filter(a => a.spr === "person" && a.keys.every(k => k[4] === 1 && k[1] === a.keys[0][1]));
  const tents = sc.actors.filter(a => a.spr === "tent" || a.spr === "tent2").map(a => a.keys[0]);
  assert.equal(standing.filter(p => tents.some(t => Math.hypot(t[1] - p.keys[0][1], t[2] - p.keys[0][2]) < 50)).length, 1, "у палатки должен стоять один");
  const tentSit = sc.actors.filter(a => a.tentSit);
  assert.equal(tentSit.length, 1, "у палатки должен сидеть один");
  assert.ok(sc.sand && sc.sand.y < sc.water, "нет песчаного берега");
  const trees = sc.actors.filter(a => ["sfir", "sbirch"].includes(a.spr)).map(a => a.keys[0]);
  assert.ok(trees.every(t => t[2] < sc.sand.y - 40), "лес подходит к воде");
  const t3 = K.CUTS.night3.actors.filter(a => ["sfir", "sbirch"].includes(a.spr)).length;
  assert.ok(trees.length < t3 * 0.6 && trees.length > t3 * 0.25, "лес не вдвое реже: " + trees.length + " против " + t3);
  const last = sc.sounds[sc.sounds.length - 1].at;
  assert.ok(shown(sitters[0], last).al > 0.5 && andr.some(a => /^sitter/.test(a.spr) && shown(a, len/60 - 0.5).al > 0.5), "Андрюха не садится играть");
  assert.ok(sc.fadeOut && sc.fadeOut.len >= 90);
});

test("четвёртая ночь: Андрюха обходит людей, а не идёт сквозь круг", () => {
  const { K } = loadGame();
  const sc = K.CUTS.night4, len = sc.len;
  const at = (a, f) => { const k = a.keys; let i = 0; while (i < k.length - 2 && f > k[i+1][0]) i++;
    const k0 = k[i], k1 = k[Math.min(i+1, k.length-1)], u = Math.max(0, Math.min(1, (f - k0[0]) / Math.max(1e-6, k1[0] - k0[0])));
    return [k0[1] + (k1[1] - k0[1])*u, k0[2] + (k1[2] - k0[2])*u, k0[4] + (k1[4] - k0[4])*u]; };
  const walker = sc.actors.find(a => a.andr && a.cycle);
  const people = sc.actors.filter(a => (/^sitter/.test(a.spr) || a.spr === "person") && !a.andr).map(a => a.keys[0]);
  const bad = [];
  for (let fr = 0; fr <= len; fr += 3) {
    const [x, y, al] = at(walker, fr/len);
    if (al < 0.5) continue;
    for (const p of people) if (Math.hypot(x - p[1], (y - p[2])*1.4) < 26) bad.push(Math.round(fr/6)/10 + " с у " + p[1] + "," + p[2]);
  }
  assert.deepEqual([...new Set(bad)].slice(0, 5), [], "Андрюха идёт сквозь людей");
});

test("край песка у травы — волнистый, не по линейке", () => {
  const { K } = loadGame();
  const sc = K.CUTS.night4;
  const ys = []; for (let x = -300; x <= 700; x += 5) ys.push(K.sandEdge(sc, x));
  const span = Math.max(...ys) - Math.min(...ys);
  assert.ok(span >= 12 && span <= 40, "край песка гуляет на " + span.toFixed(1) + " px");
  let turns = 0; for (let i = 2; i < ys.length; i++) if (Math.sign(ys[i] - ys[i-1]) !== Math.sign(ys[i-1] - ys[i-2])) turns++;
  assert.ok(turns >= 12, "край почти прямой: изгибов " + turns);
  assert.ok(ys.every(y => y < sc.water - 12), "песок пропал у воды");
});

test("во всех ночах у палаток кто-то сидит, кто-то стоит", () => {
  const { K } = loadGame();
  for (const n of ["night", "night2", "night3", "night4", "night5"]) {
    const sc = K.CUTS[n];
    const tents = sc.actors.filter(a => a.spr === "tent" || a.spr === "tent2").map(a => a.keys[0]);
    const nearTent = a => tents.some(t => Math.hypot(t[1] - a.keys[0][1], t[2] - a.keys[0][2]) < 50);
    const sit = sc.actors.filter(a => a.tentSit && /^sitter/.test(a.spr) && nearTent(a) && a.keys.every(k => k[4] === 1));
    const stand = sc.actors.filter(a => a.spr === "person" && nearTent(a) && a.keys[0][4] === 1);
    assert.ok(sit.length >= 1, n + ": у палаток никто не сидит");
    assert.ok(stand.length >= 1, n + ": у палаток никто не стоит");
  }
});
