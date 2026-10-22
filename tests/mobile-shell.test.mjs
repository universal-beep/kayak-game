// Итерация E: мобильный ввод, оболочка, читаемость и доступность.
// Сторожа ловят откат к «палец вверху экрана», кнопке-диву и тексту 8 px.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { loadGame } from "./harness.mjs";

const html = readFileSync(fileURLToPath(new URL("../index.html", import.meta.url)), "utf8");
const css = html.match(/<style>([\s\S]*?)<\/style>/)[1];
const src = html.match(/<script>([\s\S]*)<\/script>/)[1];
const { K } = loadGame();

test("E1: скорость считается от лодки, а не от верха экрана", () => {
  assert.equal(K.speedFromBoat(500, 600), 1, "выше лодки — вперёд");
  assert.equal(K.speedFromBoat(510, 600), 1, "ровно на 90 px выше — вперёд");
  assert.equal(K.speedFromBoat(600, 600), 0, "у лодки — нейтрально");
  assert.equal(K.speedFromBoat(689, 600), 0, "на 89 px ниже — ещё нейтрально");
  assert.equal(K.speedFromBoat(690, 600), -1, "на 90 px ниже — табань");
  assert.equal(K.speedFromBoat(500, undefined), 0, "без лодки — нейтрально");
});

test("E1: второй палец не перехватывает управление", () => {
  assert.equal(K.activePointer(), null);
  assert.equal(K.pointerDown(7), true);
  assert.equal(K.pointerDown(8), false, "второй палец игнорируется");
  assert.equal(K.activePointer(), 7);
  assert.equal(K.pointerUp(8), false, "чужой палец не сбрасывает активный");
  assert.equal(K.activePointer(), 7);
  assert.equal(K.pointerUp(7), true);
  assert.equal(K.activePointer(), null);
});

test("E1: кнопка удара — 64×64, с подписью, и обработчик один", () => {
  assert.match(html, /<button type="button" id="strikeBtn"[^>]*aria-label="Удар веслом"/);
  assert.match(css, /#strikeBtn \{[^}]*width:64px/);
  assert.match(css, /#strikeBtn \{[^}]*height:64px/);
  assert.match(css, /@media \(pointer:coarse\)[^{]*\{[^}]*#strikeBtn/);
  assert.match(src, /getElementById\("strikeBtn"\)\.addEventListener\("click"/);
  assert.match(src, /pointerDown\(t\.identifier\)/);
  assert.match(src, /changedTouches\[0\]/);
});

test("E2: поле по центру, ввод на весь экран, без мёртвой зоны", () => {
  assert.match(css, /#game \{[^}]*position:fixed[^}]*top:50%[^}]*transform:translate\(-50%,-50%\)/);
  assert.match(css, /#ui \{[^}]*position:fixed[^}]*height:var\(--vvh,100%\)/);
  assert.match(css, /touch-action:none/);
  assert.match(html, /viewport-fit=cover/);
  assert.match(html, /id="touchLayer"/);
  assert.match(css, /#touchLayer \{[^}]*inset:0[^}]*touch-action:none/);
  assert.match(src, /bindTouch\(document\.getElementById\("touchLayer"\)\)/);
  assert.match(src, /getElementById\(id\)[\s\S]*?touchLayer/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
  assert.match(css, /@media \(pointer:coarse\)[^{]*\{[^}]*\.side[^}]*display:none/);
});

test("E2: ландшафт сначала просит повернуть, потом 60/40", () => {
  assert.match(html, /id="rotateHint"[\s\S]*?ПОВЕРНИТЕ ТЕЛЕФОН/);
  assert.match(src, /rotateOk[\s\S]*?landscape-ok/);
  assert.match(css, /\(orientation:landscape\) and \(pointer:coarse\)[\s\S]*?width:60vw/);
});

test("E3: зум разрешён, поле имени не вызывает autozoom", () => {
  const viewport = html.match(/<meta name="viewport" content="([^"]+)"/)[1];
  assert.ok(!/maximum-scale/.test(viewport), "зум запрещён maximum-scale");
  assert.ok(!/user-scalable=no/.test(viewport), "зум запрещён user-scalable");
  assert.match(html, /id="finName"[^>]*enterkeyhint="done"/);
  assert.match(css, /#finName,\.namerow input \{ font-size:16px/);
  assert.match(src, /visualViewport[\s\S]*?setProperty\("--vvh"/);
});

test("E4: reduced motion, пауза-кнопка и live-события", () => {
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?#startBtn \{ animation:none/);
  assert.match(html, /<button type="button" id="pauseBtn"[^>]*aria-label="Пауза"/);
  assert.match(html, /id="liveStatus"[^>]*aria-live="polite"/);
  assert.match(src, /function announce\(/);
  assert.match(src, /announce\("Гудок баржи/);
  assert.match(src, /announce\("Финиш/);
  assert.match(src, /announce\(name \+ "\. Удар\."\)/);
});

test("E4: общий mute остаётся на старте и в паузе", () => {
  assert.match(html, /id="startMuteBtn"/);
  assert.match(html, /id="pauseMuteBtn"/);
  assert.match(src, /function setMuted\(/);
});
