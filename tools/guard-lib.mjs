// Общая часть сторожа просьб и доски проекта (05.10.2026).
// Просьба (docs/requests.json): id, date, ask, status, result, а теперь ещё
//   commits  — коммиты, которыми сделана (короткие хэши);
//   guards   — тесты-сторожа: названия тестов; «*» в конце — любой хвост
//              (для тестов в цикле: «мобильная версия, день *»);
//   link     — как найдена связь: "коммит" (тест добавлен тем же коммитом),
//              "слова" (по совпадению слов), "руками";
//   verified — дата, когда Максим проверил глазами.

// Совпадает ли название теста со сторожем (точно или по шаблону «…*»).
export function guardMatches(guard, name) {
  return guard.endsWith("*") ? name.startsWith(guard.slice(0, -1)) : name === guard;
}

// Сверить сторожей с прогоном тестов (index: [{file, name, ok}]).
//   broken    — сторож есть, но упал (вероятный откат);
//   lost      — сторожа нет среди тестов (тест переименовали или удалили);
//   unguarded — сделано, а сторожа нет;
//   ok        — все сторожа на месте и прошли.
export function checkGuards(requests, index) {
  const out = { broken: [], lost: [], unguarded: [], ok: [] };
  for (const r of requests) {
    if (r.status !== "done") continue;
    if (!r.guards || !r.guards.length) { if (!NO_GUARD_KINDS.includes(r.kind)) out.unguarded.push(r); continue; }
    const fails = [], gone = [];
    for (const gd of r.guards) {
      const hits = index.filter(t => guardMatches(gd, t.name));
      if (!hits.length) gone.push(gd);
      else for (const t of hits) if (!t.ok) fails.push(t);
    }
    if (fails.length) out.broken.push(Object.assign({}, r, { failed: fails }));
    else if (gone.length) out.lost.push(Object.assign({}, r, { gone }));
    else out.ok.push(r);
  }
  return out;
}

// Каким просьбам сторож не нужен: без кода (вопрос, коммит, отметка размера)
// и промо (ролики, голос — вне игры, папка promo/).
export const NO_GUARD_KINDS = ["без кода", "промо"];
// Просьба без кода — вопрос, коммит, публикация, критика, поиск: сторож не нужен.
export function isNoCode(ask) {
  return /^\s*(закоммит|опублик|покритик|критик|поиска|поищи|найди|найти|показа|покажи|рассмотр|на каком|какой|какая|какие|что |почему|как |понять|объясни|расскажи|составь план|выгрузи|отправь|собери отч)/i.test(ask || "");
}
// Этап просьбы. onSite — коммиты, которые уже в origin/master (на сайте).
export const STAGES = ["просьба", "в работе", "в коде", "сделано", "на сайте", "проверено"];
export function stageOf(r, onSite) {
  if (r.status === "todo" || r.status === "wait" || r.status === "open") return "просьба";
  if (r.status !== "done") return "в работе";
  if (r.verified) return "проверено";
  if (!r.commits || !r.commits.length) return "сделано";
  return r.commits.every(c => onSite.has(c)) ? "на сайте" : "в коде";
}

// Основы слов: нижний регистр, слова от 4 букв, первые 5 букв (грубый стемминг
// для русского: «велодорога», «велодорогу» → «велод»). Служебные — вон.
const STOP = new Set(["чтобы", "когда", "теперь", "раньше", "можно", "нужно", "будет", "этого", "этот", "только",
  "больше", "очень", "тоже", "также", "через", "после", "перед", "сделать", "сделан", "сделано", "который", "которая",
  "fix", "feat", "docs", "chore", "desktop", "journal", "mobile"]);
export function stems(text) {
  const out = new Set();
  for (const w of String(text || "").toLowerCase().replace(/ё/g, "е").match(/[a-zа-я0-9]+/g) || []) {
    if (w.length < 4 || STOP.has(w)) continue;
    out.add(w.slice(0, 5));
  }
  return out;
}
// Сколько основ слов у просьбы и строки (сообщение коммита, название теста) общих.
export function linkScore(req, text) {
  const a = stems((req.ask || "") + " " + (req.result || "")), b = stems(text);
  let n = 0;
  for (const s of b) if (a.has(s)) n++;
  return n;
}
// Дата «дд.мм.гггг» → число дней (для «тот же или следующий день»).
export function dayNum(d) {
  const m = /^(\d\d)\.(\d\d)\.(\d{4})$/.exec(d || "");
  return m ? Math.round(Date.UTC(+m[3], +m[2] - 1, +m[1]) / 864e5) : null;
}
