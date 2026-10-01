// Гонки: призрак (запись заезда) — хранится в том же KV, что и таблица рекордов.
//
//   POST /ghost  { pid, name, lvl:{river, lenIdx, items:[{c,r,k}]}, frames, track:[wy,t1000, …] }
//                -> { id }        код из 6 знаков, живёт 90 дней
//   GET  /ghost?id=КОД  -> { name, lvl, frames, track }
//
// lvl — уровень целиком (как в конструкторе), поэтому друг плывёт ровно ту же
// реку. track — положение лодки раз в GHOST_STEP кадров: мировой y и
// поперечное t×1000. frames — кадров от старта до финишной ленты.
export const GHOST_STEP = 6;
export const GHOST_TTL = 60*60*24*90;
const MAX_FRAMES = 60*60*15;                        // 15 минут — заведомо длиннее любого уровня
const MAX_ITEMS = 600, RIVERS = 4, LENS = 3, COLS = 7, MAX_ROW = 200;

export function validLevel(l) {
  if (!l || !Number.isInteger(l.river) || l.river < 0 || l.river >= RIVERS) return false;
  if (!Number.isInteger(l.lenIdx) || l.lenIdx < 0 || l.lenIdx >= LENS) return false;
  if (!Array.isArray(l.items) || l.items.length > MAX_ITEMS) return false;
  return l.items.every(it => it && Number.isInteger(it.c) && it.c >= 0 && it.c < COLS &&
    Number.isInteger(it.r) && it.r >= 0 && it.r < MAX_ROW && typeof it.k === "string" && /^[a-z0-9_]{1,12}$/.test(it.k));
}
export function validGhost(b) {
  if (!b || typeof b.pid !== "string" || !/^[0-9a-f]{16,32}$/.test(b.pid)) return false;
  if (!Number.isInteger(b.frames) || b.frames <= 0 || b.frames > MAX_FRAMES) return false;
  if (!Array.isArray(b.track) || b.track.length % 2 || b.track.length > 2*(MAX_FRAMES/GHOST_STEP + 2)) return false;
  if (b.track.length < 4 || !b.track.every(Number.isInteger)) return false;
  return validLevel(b.lvl);
}
export function newId() {
  const a = new Uint8Array(6), abc = "abcdefghijkmnpqrstuvwxyz23456789";   // без l, o, 0, 1 — не спутать
  crypto.getRandomValues(a);
  return [...a].map(x => abc[x % abc.length]).join("");
}
// Обработчик /ghost. json — функция ответа, cleanName — та же, что для таблицы.
export async function ghostRoute(req, env, url, { json, cleanName }) {
  if (req.method === "GET") {
    const id = url.searchParams.get("id") || "";
    if (!/^[a-z0-9]{6}$/.test(id)) return json({ error: "id" }, 400);
    const v = await env.BOARD.get("ghost:" + id);
    if (!v) return json({ error: "nf" }, 404);
    const g = JSON.parse(v);
    return json({ name: g.name, lvl: g.lvl, frames: g.frames, track: g.track });
  }
  if (req.method === "POST") {
    let b;
    try { b = await req.json(); } catch (e) { return json({ error: "json" }, 400); }
    if (!validGhost(b)) return json({ error: "payload" }, 400);
    const id = newId();
    await env.BOARD.put("ghost:" + id, JSON.stringify({ name: cleanName(b.name), lvl: b.lvl, frames: b.frames, track: b.track, ts: Date.now() }),
                        { expirationTtl: GHOST_TTL });
    return json({ id });
  }
  return json({ error: "method" }, 405);
}
