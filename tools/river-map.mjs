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
  G.day = dayIdx; G.rWidth = R.width; G.rBend = R.bend; G.landSide = 1;
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

// Полоса дня: старт слева, финиш справа. Левый берег (по ходу лодки) — сверху,
// как если повернуть экран игры по часовой стрелке.
export function daySvg(map) {
  const W = 1000, K = 0.2, H = SCREEN_W * K, TOP = 4, AX = H + TOP + 16;
  const x = m => +(m / map.len * W).toFixed(1), y = px => +(TOP + px * K).toFixed(1);
  const S = map.samples;
  const edge = key => S.map(s => x(s.m) + "," + y(s[key])).join(" ");
  const water = `<polygon fill="${map.water}" points="${edge("l")} ${[...S].reverse().map(s => x(s.m) + "," + y(s.r)).join(" ")}"/>`;
  const sand = ["L", "R"].map(side => {
    const runs = [];
    let cur = null;
    for (const s of S) {
      const v = s["sand" + side];
      if (v > 1) { (cur = cur || []).push(s); } else if (cur) { runs.push(cur); cur = null; }
    }
    if (cur) runs.push(cur);
    return runs.map(run => {
      const e = side === "L" ? "l" : "r", sg = side === "L" ? -1 : 1;
      const out = run.map(s => x(s.m) + "," + y(s[e] + sg * s["sand" + side]));
      const inn = [...run].reverse().map(s => x(s.m) + "," + y(s[e]));
      return `<polygon fill="#d2b674" points="${out.join(" ")} ${inn.join(" ")}"/>`;
    }).join("");
  }).join("");
  // Пороги — белые штрихи поверх воды.
  const rapids = [];
  for (let i = 0; i < S.length; i += 2) {
    const s = S[i];
    if (s.rapid > 0.5) rapids.push(`<line x1="${x(s.m)}" x2="${x(s.m) + 3}" y1="${y(s.l + 6)}" y2="${y(s.r - 6)}" stroke="#fff" stroke-opacity=".55" stroke-width="1.2"/>`);
  }
  const islands = S.filter(s => s.island).map(s => `<rect x="${x(s.m)}" y="${y(s.island[0])}" width="${(STEP_M / map.len * W + 0.4).toFixed(1)}" height="${(Math.max(1, s.island[1] - s.island[0]) * K).toFixed(1)}" fill="${map.grass}"/>`).join("");
  const bridges = map.bridges.map(b => `<rect x="${x(b) - 2}" y="${TOP - 2}" width="4" height="${H + 4}" fill="#4a3018"/>`).join("");
  const fin = `<g><rect x="${W - 5}" y="${TOP}" width="5" height="${H}" fill="url(#chk)"/><text x="${W}" y="${AX + 13}" text-anchor="end" class="lbl b">финиш ${map.len} м</text></g>`;
  const ticks = [];
  for (let m = 100; m < map.len; m += 100) {
    ticks.push(`<line x1="${x(m)}" x2="${x(m)}" y1="${AX - 3}" y2="${AX + 2}" class="tick"/>`);
    if (m % 200 === 0 && map.len - m > 60) ticks.push(`<text x="${x(m)}" y="${AX + 13}" text-anchor="middle" class="lbl">${m} м</text>`);
  }
  const rLabel = (() => {                           // подпись первого порога
    const s = S.find(s => s.rapid > 0.5);
    return s ? `<text x="${x(s.m) + 4}" y="${TOP + H + 13}" class="lbl">порог</text>` : "";
  })();
  const fLabel = map.forks.length ? `<text x="${x(map.forks[0].from) + 4}" y="${TOP + H + 13}" class="lbl">развилка</text>` : "";
  return `<svg viewBox="0 -2 ${W} ${AX + 18}" role="img" aria-label="Карта дня ${map.day}: ${map.river}, ${map.len} м" preserveAspectRatio="xMinYMid meet">` +
    `<defs><pattern id="chk" width="5" height="5" patternUnits="userSpaceOnUse"><rect width="5" height="5" fill="#fff"/><rect width="2.5" height="2.5" fill="#15262e"/><rect x="2.5" y="2.5" width="2.5" height="2.5" fill="#15262e"/></pattern></defs>` +
    `<rect x="0" y="${TOP}" width="${W}" height="${H}" fill="${map.grass}"/>${sand}${water}${islands}${rapids.join("")}${bridges}${fin}` +
    `<text x="0" y="${AX + 13}" class="lbl b">старт</text>${rLabel}${fLabel}${ticks.join("")}</svg>`;
}
