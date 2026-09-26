// Карта рек для книги похода: геометрия каждого дня, снятая с самой игры.
// Пороги, развилки и мосты в игре случайны, поэтому Math.random в песочнице
// заводится с зерном дня — карта одна и та же при каждой сборке книги и
// показывает типичный заход, а не какой-то конкретный.
import { runInContext } from "node:vm";
import { loadGame, setupWorld } from "../tests/harness.mjs";

const PX_PER_M = 25, STEP_M = 4, SCREEN_W = 420;

export function sampleDay(dayIdx, seed = dayIdx + 1) {
  const { K, sandbox } = loadGame();
  runInContext(`(function(){ let a = ${seed >>> 0} * 2654435761 >>> 0;
    Math.random = function(){ a = (a + 0x6D2B79F5) >>> 0; let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })()`, sandbox);
  setupWorld(K, { wy: 0 });
  const G = K.G, L = K.LEVELS[dayIdx], R = K.RIVERS[L.river];
  G.day = dayIdx; G.rWidth = R.width; G.rBend = R.bend; G.rFreq = R.freq || 1; G.landSide = 1;
  G.bev = []; G.segs = []; G.forks = []; G.bridges_ = [];
  const END = L.len * PX_PER_M;
  K.ensureSegments(END + 3000);

  const samples = [], forks = new Map(), bridges = new Set();
  for (let m = 0; m <= L.len + STEP_M; m += STEP_M) {
    const w = Math.min(m, L.len) * PX_PER_M;
    G.scroll = w;                                     // генераторы работают от камеры
    K.ensureForks(w + 3000); K.ensureBridges(w + 3000);
    for (const f of G.forks) if (f.start < END) forks.set(f.start, { from: f.start / PX_PER_M, to: Math.min(f.end, END) / PX_PER_M });
    for (const b of G.bridges_) if (b.wy < END - 200) bridges.add(Math.round(b.wy / PX_PER_M));
    const c = K.centerAt(w), hw = K.widthAt(w) / 2, sh = K.forkShape(w);
    samples.push({
      m: Math.min(m, L.len), l: +(c - hw).toFixed(1), r: +(c + hw).toFixed(1),
      rapid: +K.rapidBlend(w).toFixed(2),
      island: sh && sh.h > 0.02 ? [+(c + (sh.c - sh.h) * hw).toFixed(1), +(c + (sh.c + sh.h) * hw).toFixed(1)] : null,
      sandL: +K.sandBar(w, -1).toFixed(1), sandR: +K.sandBar(w, 1).toFixed(1),
    });
  }
  return { day: L.day, len: L.len, river: R.name, water: R.water, grass: R.grass,
           samples, forks: [...forks.values()], bridges: [...bridges].sort((a, b) => a - b) };
}

// Карта дня — строки по 250 м (как строки текста): старт слева вверху, финиш
// справа внизу. Масштаб по длине и по ширине почти один (4 px на метр против
// 4 по ширине), поэтому изгибы выглядят изгибами, а не зубьями. Левый берег
// по ходу лодки — сверху, как если повернуть экран игры по часовой стрелке.
const ROW_M = 250;
export function daySvg(map) {
  const W = 1000, K = 0.16, H = SCREEN_W * K, ROW_H = H + 40;
  const rows = Math.ceil(map.len / ROW_M);
  const parts = [];
  // Подписи мест, где начинается порог или развилка (по одной на участок).
  const rapidStarts = [];
  map.samples.forEach((s, i) => { if (s.rapid > 0.5 && !(map.samples[i - 1]?.rapid > 0.5)) rapidStarts.push(s.m); });
  for (let r = 0; r < rows; r++) {
    const m0 = r * ROW_M, m1 = Math.min(map.len, m0 + ROW_M), top = r * ROW_H + 16;
    const x = m => +((m - m0) / ROW_M * W).toFixed(1), y = px => +(top + px * K).toFixed(1);
    const S = map.samples.filter(s => s.m >= m0 - 4 && s.m <= m1 + 4).map(s => ({ ...s, m: Math.max(m0, Math.min(m1, s.m)) }));
    const wEnd = x(m1);
    let g = `<rect x="0" y="${top}" width="${wEnd}" height="${H}" fill="${map.grass}"/>`;
    for (const side of ["L", "R"]) {                 // песчаные отмели
      let run = [];
      const flush = () => {
        if (run.length > 1) {
          const e = side === "L" ? "l" : "r", sg = side === "L" ? -1 : 1;
          g += `<polygon fill="#d2b674" points="${run.map(s => x(s.m) + "," + y(s[e] + sg * s["sand" + side])).join(" ")} ${[...run].reverse().map(s => x(s.m) + "," + y(s[e])).join(" ")}"/>`;
        }
        run = [];
      };
      for (const s of S) { if (s["sand" + side] > 1) run.push(s); else flush(); }
      flush();
    }
    g += `<polygon fill="${map.water}" points="${S.map(s => x(s.m) + "," + y(s.l)).join(" ")} ${[...S].reverse().map(s => x(s.m) + "," + y(s.r)).join(" ")}"/>`;
    for (const s of S) if (s.island) g += `<rect x="${x(s.m)}" y="${y(s.island[0])}" width="${(STEP_M / ROW_M * W + 0.5).toFixed(1)}" height="${((s.island[1] - s.island[0]) * K).toFixed(1)}" fill="${map.grass}"/>`;
    for (let i = 0; i < S.length; i += 2) {           // пороги — белые штрихи
      const s = S[i];
      if (s.rapid > 0.5) g += `<line x1="${x(s.m)}" x2="${x(s.m) + 4}" y1="${y(s.l + 6)}" y2="${y(s.r - 6)}" stroke="#fff" stroke-opacity=".6" stroke-width="1.5"/>`;
    }
    const lblY = top + H + 12;
    for (const b of map.bridges) if (b >= m0 && b < m1)
      g += `<rect x="${x(b) - 3}" y="${top - 3}" width="6" height="${H + 6}" fill="#4a3018"/><text x="${x(b)}" y="${lblY}" text-anchor="middle" class="lbl">мост</text>`;
    for (const m of rapidStarts) if (m >= m0 && m < m1 - 10) g += `<text x="${Math.min(x(m) + 4, wEnd - 34)}" y="${lblY}" class="lbl">порог</text>`;
    for (const f of map.forks) if (f.from >= m0 && f.from < m1) g += `<text x="${x(f.from) + 4}" y="${lblY}" class="lbl">развилка</text>`;
    for (let m = m0 + 50; m < m1; m += 50) g += `<line x1="${x(m)}" x2="${x(m)}" y1="${top + H + 1}" y2="${top + H + 4}" class="tick"/>`;
    g += `<text x="0" y="${top - 5}" class="lbl b">${m0 === 0 ? "старт · " : ""}${m0}–${m1} м${m1 === map.len ? " · финиш" : ""}</text>`;
    if (m1 === map.len) g += `<rect x="${wEnd - 6}" y="${top}" width="6" height="${H}" fill="url(#chk)"/>`;
    parts.push(g);
  }
  return `<svg viewBox="0 -2 ${W} ${rows * ROW_H + 4}" role="img" aria-label="Карта дня ${map.day}: ${map.river}, ${map.len} м" preserveAspectRatio="xMinYMin meet">` +
    `<defs><pattern id="chk" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="#fff"/><rect width="3" height="3" fill="#15262e"/><rect x="3" y="3" width="3" height="3" fill="#15262e"/></pattern></defs>` +
    parts.join("") + "</svg>";
}
