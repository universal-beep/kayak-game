// Батон и виски — свои звуки Максима: файл вшивается в гнездо SOUNDS
// инструментом tools/add-sound.mjs. Пустое гнездо — общий звон бонуса.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadGame, setupWorld } from "./harness.mjs";
import { addSound } from "../tools/add-sound.mjs";

const INDEX = fileURLToPath(new URL("../index.html", import.meta.url));

function fakeAudio() {
  const log = { osc: 0, buf: 0, decoded: 0 };
  const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} });
  const node = () => ({ connect() {}, start() {}, stop() {}, type: "", buffer: null, frequency: param(), gain: param(), Q: param() });
  return { log, ctx: { currentTime: 0, sampleRate: 44100, destination: {},
    createOscillator: () => { log.osc++; return node(); }, createGain: node, createBiquadFilter: node,
    createBufferSource: () => { log.buf++; return node(); },
    decodeAudioData: (arr, ok) => { log.decoded++; ok({ fake: true }); } } };
}

for (const [type, slot] of [["bread", "crunch"], ["whisky", "gulp"]]) {
  test(type + ": пустое гнездо — звон бонуса, вшитый файл — свой звук", () => {
    const { K } = loadGame();
    setupWorld(K, { wy: 5000 });
    let a = fakeAudio(); K.setAudio(a.ctx);
    K.SOUNDS[slot] = "";
    K.apBn({ type, t: 0, wy: K.G.pwy });
    assert.equal(K.G.sfxLast, slot);
    assert.ok(a.log.osc >= 3 && a.log.buf === 0, "без файла должен звучать звон бонуса");

    a = fakeAudio(); K.setAudio(a.ctx);
    K.SOUNDS[slot] = "data:audio/wav;base64," + Buffer.from("RIFF-test").toString("base64");
    K.apBn({ type, t: 0, wy: K.G.pwy });
    K.apBn({ type, t: 0, wy: K.G.pwy });
    assert.equal(a.log.osc, 0, "со своим файлом звона бонуса быть не должно");
    assert.equal(a.log.buf, 2, "свой звук не проигран");
    assert.equal(a.log.decoded, 1, "файл декодируется один раз и дальше берётся готовым");
  });
}

test("add-sound вшивает файл в гнездо и не пускает чужие форматы и большие файлы", () => {
  const dir = mkdtempSync(join(tmpdir(), "kayak-snd-"));
  const html = join(dir, "index.html");
  copyFileSync(INDEX, html);
  const wav = join(dir, "хрум.wav");
  writeFileSync(wav, Buffer.from("RIFF1234WAVEfmt "));
  addSound("crunch", wav, html);
  const s = readFileSync(html, "utf8");
  assert.match(s, /\n  crunch: "data:audio\/wav;base64,UklGRjEyMzRXQVZFZm10IA==",/);
  const gulpLine = t => t.match(/\n  gulp: "[^"]*",/)[0];
  assert.equal(gulpLine(s), gulpLine(readFileSync(INDEX, "utf8")), "соседнее гнездо изменилось");
  writeFileSync(join(dir, "x.txt"), "a");
  assert.throws(() => addSound("gulp", join(dir, "x.txt"), html), /mp3/);
  writeFileSync(join(dir, "big.mp3"), Buffer.alloc(200 * 1024));
  assert.throws(() => addSound("gulp", join(dir, "big.mp3"), html), /КБ/);
  assert.throws(() => addSound("whistle", wav, html), /гнезда/);
});

test("звуки распаковываются заранее, как только включён звук — первый раз играют без задержки", () => {
  const { K } = loadGame();
  setupWorld(K, { wy: 5000 });
  let decoded = 0;
  const pending = [];
  K.SOUNDS.gulp = "data:audio/wav;base64," + Buffer.from("RIFF-test").toString("base64");
  K.SOUNDS.voice_turclub = "data:audio/wav;base64," + Buffer.from("RIFF-voice").toString("base64");
  const a = fakeAudio();
  a.ctx.decodeAudioData = (arr, ok) => { decoded++; pending.push(() => ok({ fake: true })); };
  K.setAudio(a.ctx);
  K.preloadSounds();
  const filled = Object.values(K.SOUNDS).filter(Boolean).length;
  assert.equal(decoded, filled, "распаковано не всё заранее");
  pending.forEach(f => f());                             // распаковка закончилась
  a.log.buf = 0;
  K.playSample("voice_turclub");
  assert.equal(a.log.buf, 1, "первое воспроизведение не сразу");
  assert.equal(decoded, filled, "распаковал повторно");
});
