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

// ---- Гонка вдвоём вживую: комната (Durable Object) ----
//
//   GET /room?code=КОД&role=host|guest  (Upgrade: websocket)
//
// Хозяин (host) приходит первым и приносит уровень; гость получает уровень
// и имя хозяина; когда оба на месте — обоим «старт через START_IN мс».
// Дальше комната только пересылает сопернику положение (pos) и финиш (fin).
// Физику каждый считает у себя: лодки друг друга не толкают, задержка не важна.
// Сокеты — «спящие» (acceptWebSocket): комната не держит память между
// сообщениями, роль и имя лежат во вложении сокета, уровень — в хранилище.
export const START_IN = 3500;
const CODE_ABC = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function validCode(c) { return typeof c === "string" && /^[A-Z2-9]{4}$/.test(c) && [...c].every(ch => CODE_ABC.includes(ch)); }
const okNum = v => Number.isFinite(v) && Math.abs(v) < 1e7;

export class RaceRoom {
  constructor(ctx, env) { this.ctx = ctx; this.env = env; }
  async fetch(req) {
    if ((req.headers.get("Upgrade") || "").toLowerCase() !== "websocket") return new Response("websocket", { status: 426 });
    const role = new URL(req.url).searchParams.get("role") === "host" ? "host" : "guest";
    if (this.ctx.getWebSockets().length >= 2 || this.ctx.getWebSockets(role).length) return new Response("full", { status: 409 });
    const pair = new WebSocketPair();
    this.ctx.acceptWebSocket(pair[1], [role]);
    pair[1].serializeAttachment({ role, name: "" });
    return new Response(null, { status: 101, webSocket: pair[0] });
  }
  other(ws) { return this.ctx.getWebSockets().find(s => s !== ws) || null; }
  send(ws, m) { try { ws.send(JSON.stringify(m)); } catch (e) {} }
  async webSocketMessage(ws, raw) {
    let m;
    try { m = JSON.parse(typeof raw === "string" ? raw : new TextDecoder().decode(raw)); } catch (e) { return; }
    if (!m || typeof m.type !== "string") return;
    const me = ws.deserializeAttachment() || {}, peer = this.other(ws);
    if (m.type === "hello") {
      const name = String(m.name || "").replace(/[^0-9A-Za-zА-Яа-яЁё _\-]/g, "").trim().slice(0, 12).toUpperCase() || "ПУТНИК";
      ws.serializeAttachment({ role: me.role, name });
      if (me.role === "host") {
        if (!validLevel(m.lvl)) return;
        await this.ctx.storage.put("lvl", m.lvl);
        await this.ctx.storage.put("host", name);
      } else {
        const lvl = await this.ctx.storage.get("lvl");
        if (!lvl || !peer) { this.send(ws, { type: "nohost" }); return; }
        this.send(ws, { type: "lvl", lvl, name: await this.ctx.storage.get("host") });
        this.send(peer, { type: "joined", name });
      }
      // Оба представились — общий старт.
      const all = this.ctx.getWebSockets();
      if (all.length === 2 && all.every(s => (s.deserializeAttachment() || {}).name) && await this.ctx.storage.get("lvl"))
        for (const s of all) this.send(s, { type: "start", in: START_IN });
      return;
    }
    if (!peer) return;
    if (m.type === "pos" && okNum(m.f) && okNum(m.wy) && okNum(m.t)) this.send(peer, { type: "pos", f: m.f, wy: m.wy, t: m.t });
    else if (m.type === "fin" && Number.isInteger(m.frames) && m.frames > 0) this.send(peer, { type: "fin", frames: m.frames });
  }
  async webSocketClose(ws) {
    const peer = this.other(ws);
    if (peer) this.send(peer, { type: "left" });
  }
  async webSocketError(ws) { return this.webSocketClose(ws); }
}
// Маршрут /room: код -> своя комната (один Durable Object на код).
export function roomRoute(req, env, url) {
  const code = url.searchParams.get("code") || "";
  if (!validCode(code)) return new Response("code", { status: 400 });
  if (!env.ROOM) return new Response("rooms off", { status: 503 });
  return env.ROOM.get(env.ROOM.idFromName(code)).fetch(req);
}
