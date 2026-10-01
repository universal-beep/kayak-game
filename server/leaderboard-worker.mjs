// Общая таблица рекордов «Сплава на байдарке» — Cloudflare Worker + KV.
// Бесплатного тарифа хватает с запасом. Деплой: см. server/README.md.
//
//   GET  /?day=N[&pid=ПИД]   -> { day, rows:[{name, score, mine}] }   (N: 0 — весь поход, 1…9 — дни)
//   POST /  { pid, day, name, score }  -> { ok:true, rank, total }
//
// Один игрок (pid) — одна строка в таблице дня; хранится лучший результат, имя —
// последнее. pid наружу не отдаётся: сервер лишь помечает строку mine, когда
// в GET пришёл тот же pid. Всё проверяется: форма запроса, имя, потолок очков,
// частота запросов с одного адреса.
import { ghostRoute } from "./race.mjs";

export const MAX_DAY = 9;
export const MAX_SCORE_DAY = 60000;        // потолок очков за один день
export const MAX_SCORE_ALL = 400000;       // потолок за весь поход (день 0)
export const KEEP = 200, SHOW = 50, RATE_PER_MIN = 40;

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type",
};
const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json; charset=utf-8", ...CORS } });

// Имя: буквы (латиница, кириллица), цифры, пробел, дефис, подчёркивание; до 12 знаков, верхний регистр.
export function cleanName(v) {
  const s = String(v == null ? "" : v).replace(/[^0-9A-Za-zА-Яа-яЁё _\-]/g, "").trim().slice(0, 12).toUpperCase();
  return s || "ПУТНИК";
}
export function validPid(p) { return typeof p === "string" && /^[0-9a-f]{16,32}$/.test(p); }
export function validDay(d) { return Number.isInteger(d) && d >= 0 && d <= MAX_DAY; }
export function maxScore(day) { return day === 0 ? MAX_SCORE_ALL : MAX_SCORE_DAY; }

// Вставка результата в таблицу дня: лучший результат игрока, сортировка, обрезка.
export function upsert(rows, entry) {
  const i = rows.findIndex(r => r.pid === entry.pid);
  if (i >= 0) {
    const prev = rows[i];
    rows[i] = { pid: entry.pid, name: entry.name, score: Math.max(prev.score, entry.score), ts: entry.ts };
  } else rows.push({ pid: entry.pid, name: entry.name, score: entry.score, ts: entry.ts });
  rows.sort((a, b) => b.score - a.score || a.ts - b.ts);
  return rows.slice(0, KEEP);
}
export function publicRows(rows, pid) {
  return rows.slice(0, SHOW).map(r => ({ name: r.name, score: r.score, mine: !!pid && r.pid === pid }));
}

async function limited(env, ip) {
  const key = "rl:" + ip + ":" + Math.floor(Date.now() / 60000);
  const n = parseInt((await env.BOARD.get(key)) || "0", 10) + 1;
  await env.BOARD.put(key, String(n), { expirationTtl: 120 });
  return n > RATE_PER_MIN;
}

export default {
  async fetch(req, env) {
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
    const url = new URL(req.url);
    const ip = req.headers.get("cf-connecting-ip") || "local";
    // Гонка с призраком (server/race.mjs). Запись — под тем же ограничением частоты.
    if (url.pathname === "/ghost") {
      if (req.method === "POST" && await limited(env, ip)) return json({ error: "rate" }, 429);
      return ghostRoute(req, env, url, { json, cleanName });
    }
    if (req.method === "GET") {
      const day = parseInt(url.searchParams.get("day"), 10);
      if (!validDay(day)) return json({ error: "day" }, 400);
      const rows = JSON.parse((await env.BOARD.get("day:" + day)) || "[]");
      const pid = url.searchParams.get("pid");
      return json({ day, rows: publicRows(rows, validPid(pid) ? pid : null) });
    }
    if (req.method === "POST") {
      if (await limited(env, ip)) return json({ error: "rate" }, 429);
      let b;
      try { b = await req.json(); } catch (e) { return json({ error: "json" }, 400); }
      if (!b || !validPid(b.pid) || !validDay(b.day) || !Number.isInteger(b.score) || b.score < 0 || b.score > maxScore(b.day))
        return json({ error: "payload" }, 400);
      const key = "day:" + b.day;
      const rows = upsert(JSON.parse((await env.BOARD.get(key)) || "[]"), { pid: b.pid, name: cleanName(b.name), score: b.score, ts: Date.now() });
      await env.BOARD.put(key, JSON.stringify(rows));
      const rank = rows.findIndex(r => r.pid === b.pid) + 1;
      return json({ ok: true, rank, total: rows.length });
    }
    return json({ error: "method" }, 405);
  },
};
