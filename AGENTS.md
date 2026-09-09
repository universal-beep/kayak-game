# kayak-game (Сплав на байдарке)

Одностраничная canvas-игра в `index.html`. Стек: чистый JS в одном HTML-файле, без сборщика и зависимостей. Тесты и линтер — через Node (node:vm на mock-DOM).

## Quality Gates

Команды (package.json):

- `npm run lint` — структурный линтер inline-скрипта: синтаксис, загрузка в VM-харнессе, равная ширина строк всех SPR-карт (кроме whitelist-`shadow`/`sitter_guitar_b`), ссылки CUTS→SPR.
- `npm test` — весь набор: `node --test tests/*.test.mjs`.
- `npm run test:affected` — на этом проекте (один файл) совпадает с `npm test`.
- `npm run analyze` — размер `index.html` против базлайна `quality-gates/baseline.json`.

Правила:

- Перед каждым `git commit` — `npm run lint` (хук pre-commit).
- Перед каждым `git push` — `npm test` (хук pre-push).
- Новый/изменённый функционал — с тестами. Багфикс — спутник-тест (красный до фикса).
- Тесты пишутся: юнит — на экспортированные функции через `__KAYAK__`; интеграция — на рендер катсцен/сцен (прогон `drwCut`); регрессии — на VM-sandbox (`tests/harness.mjs`).
- `tests/harness.mjs` — единственная точка загрузки игры в VM. Не мокать `Math.random` в тестах, затрагивающих спавн, — вместо этого ставить `K.G.df = 0`.

## Разработка

- Правки только в `index.html` (в `E:\OpenCode\kayak-game.html` — старая непубликуемая копия).
- Экспорт для тестов — `globalThis.__KAYAK__` (в конце файла), пополнять при добавлении функций, которые нужны тестам.
- Катсцены: `CUTS` в `index.html`, просмотр `?cut=bridge|morning|night|drive|finale`.