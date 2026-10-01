# Общая таблица рекордов (онлайн)

**Развёрнуто 01.10.2026:** `https://kayak-board.kayak-splav.workers.dev` (аккаунт
Cloudflare Максима, KV `kayak-board`, id в `server/wrangler.toml`). Адрес вписан в
`ONLINE_DEFAULT_URL` в `index.html`.

Обновить сервер после правки `leaderboard-worker.mjs` (из папки `server`):

```
npx wrangler login      # один раз на компьютере
npx wrangler deploy
```

Ограничение бесплатного KV — 1000 записей в сутки; результат стоит две записи
(строка таблицы + счётчик частоты), то есть около 500 результатов в день.

Игра работает и без сервера: таблица тогда локальная. Чтобы игроки видели друг
друга, нужен маленький сервер. Подойдёт бесплатный **Cloudflare Workers + KV**
(кредитная карта не нужна).

## Развернуть (≈5 минут, через сайт)

1. Зарегистрируйся на <https://dash.cloudflare.com> (бесплатно).
2. **Workers & Pages → Create → Create Worker**, назови `kayak-board`, нажми Deploy.
3. **Storage & Databases → KV → Create namespace**, имя `kayak-board`.
4. Открой Worker → **Settings → Bindings → Add → KV namespace**: переменная
   `BOARD`, пространство `kayak-board`.
5. Worker → **Edit code**: вставь содержимое `server/leaderboard-worker.mjs`
   (целиком, вместо шаблона), **Deploy**.
6. Скопируй адрес Worker (вида `https://kayak-board.<имя>.workers.dev`).

## Подключить к игре

- Быстрая проверка: открой игру как `index.html?board=https://kayak-board.<имя>.workers.dev` —
  адрес запомнится в браузере.
- Насовсем для всех: впиши адрес в константу `ONLINE_DEFAULT_URL` в `index.html`.

## Что умеет сервер

- `GET /?day=N` — таблица (N: 1…9 — дни, 0 — весь поход), 50 лучших.
- `POST /` `{pid, day, name, score}` — результат; у игрока одна строка в таблице дня
  (лучший результат). Проверяются форма запроса, имя, потолок очков
  (60000 за день, 400000 за поход) и частота запросов (40 в минуту с адреса).
- Защита от подделок простая: игра одним файлом, очки считает клиент, поэтому
  честность держится на потолках и ограничении частоты, а не на криптографии.

Проверка логики сервера — `npm test` (`tests/leaderboard-worker.test.mjs`).
