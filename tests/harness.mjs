// VM-харнесс для тестов одностраничника kayak-game/index.html.
// Игра исполняется в node:vm с mock-DOM/canvas; игровой цикл (requestAnimationFrame)
// подавлен флагом __KAYAK_TEST__, логика дёргается вручную вызовами K.upd()/рендера.
// Канонический вызов всего набора: `node --test tests/*.test.mjs`.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createContext, runInContext } from "node:vm";

const FILE = fileURLToPath(new URL("../index.html", import.meta.url));

function makeCtx() {
  return {
    canvas: { width: 420, height: 720 },
    createLinearGradient: () => ({ addColorStop() {} }),
    createRadialGradient: () => ({ addColorStop() {} }),
    save() {}, restore() {},
    fillRect() {}, clearRect() {}, strokeRect() {}, fillText() {},
    beginPath() {}, arc() {}, ellipse() {}, moveTo() {}, lineTo() {}, closePath() {}, quadraticCurveTo() {},
    fill() {}, stroke() {}, scale() {}, translate() {}, rotate() {}, setTransform() {},
    drawImage(img) {
      if (!img) throw new Error("drawImage(img=undefined)");
      if (img.width === undefined && img.canvas === undefined) throw new Error("drawImage: нет width");
    },
    fillStyle: "", strokeStyle: "", globalAlpha: 1, lineWidth: 1, font: "",
    imageSmoothingEnabled: true, textAlign: "left",
  };
}

// opts.boot = true — загрузить «как в браузере»: без флага __KAYAK_TEST__,
// с настоящим стартовым кодом и адресной строкой opts.search. Кадры не
// крутятся: requestAnimationFrame только считает вызовы (sandbox.__raf),
// по нему видно, запустился ли главный цикл.
export function loadGame(htmlPath, opts = {}) {
  const path = htmlPath || FILE;
  const html = readFileSync(path, "utf8");
  const src = html.match(/<script>([\s\S]*)<\/script>/)[1];

  const ctx = makeCtx();
  const dummy = (id) => ({
    id, style: {}, classList: { add() {}, remove() {}, contains() { return false; } },
    textContent: "", innerHTML: "",
    width: id && id.indexOf("game") >= 0 ? 420 : 0,
    height: id && id.indexOf("game") >= 0 ? 720 : 0,
    getContext() { return ctx; },
    getBoundingClientRect() { return { left: 0, top: 0, width: 420, height: 720 }; },
    addEventListener() {}, appendChild() {}, removeChild() {},
    querySelector() { return null; }, querySelectorAll() { return []; },
  });
  const document = {
    getElementById: (id) => dummy(id),
    createElement(tag) { const o = dummy(tag); if (tag === "canvas") { o.width = 10; o.height = 10; } o.getContext = () => ctx; return o; },
    body: dummy("body"), addEventListener() {}, documentElement: { style: {} },
  };
  const sandbox = {
    innerWidth: 420, innerHeight: 720,
    document,
    addEventListener() {},
    Image: function () { this.width = 0; this.height = 0; this.addEventListener = () => {}; },
    requestAnimationFrame: () => 0,
    // Таймеры игры (подсказки, мульты, музыка) не держат процесс пробы:
    // иначе node --test «висит» после конца пробы, ожидая их.
    setInterval: (...a) => { const t = setInterval(...a); t.unref?.(); return t; },
    setTimeout: (...a) => { const t = setTimeout(...a); t.unref?.(); return t; },
    clearInterval, clearTimeout,
    atob: (x) => Buffer.from(x, "base64").toString("binary"),
    AudioContext: function () { this.decodeAudioData = (a, cb) => { try { cb({}); } catch (e) {} }; this.createBufferSource = () => ({}); this.createGain = () => ({ connect() {} }); this.destination = {}; },
    Audio: function () { this.play = () => Promise.resolve(); },
    performance: { now: () => 0 },
    console: { log: () => {}, warn: () => {}, error: () => {} },
    URLSearchParams, location: { search: opts.search || "" },
    __KAYAK_TEST__: true,
  };
  if (opts.boot) {
    delete sandbox.__KAYAK_TEST__;
    sandbox.__raf = 0;
    sandbox.requestAnimationFrame = () => { sandbox.__raf++; return 0; };
  }
  sandbox.window = { innerWidth: 420, innerHeight: 720, document, addEventListener: sandbox.addEventListener, AudioContext: sandbox.AudioContext, Audio: sandbox.Audio, requestAnimationFrame: sandbox.requestAnimationFrame };

  createContext(sandbox);
  runInContext(src, sandbox, { filename: "game.js" });
  const K = sandbox.__KAYAK__;
  if (!K) throw new Error("Нет __KAYAK__ в sandbox");
  return { K, ctx, sandbox };
}

// Минимальный мир для упрощённого теста (без случайного спавна).
export function setupWorld(K, { wy = 1000, t = 0, rWidth = 1 } = {}) {
  K.G.scroll = wy;
  K.G.pwy = wy;
  K.G.t = t;
  K.G.rWidth = rWidth;
  K.G.segs = [{ type: "calm", start: 0, end: 1e9 }];
  K.G.forks = [];
  K.G.bns = [];
  K.G.obs = [];
  K.G.pts = [];
  K.G.df = 0;
}