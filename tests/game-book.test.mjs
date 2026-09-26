// Книга похода собирается из игры: девять дней, все просьбы, спрайты с правилами.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildBook } from "../tools/game-book.mjs";

test("книга похода собирается: 9 дней, все просьбы, спрайты рисуются из данных", () => {
  const { full, fragment } = buildBook();
  for (let d = 1; d <= 9; d++) assert.ok(full.includes('id="day' + d + '"'), "нет блока дня " + d);
  const req = JSON.parse(readFileSync(new URL("../docs/requests.json", import.meta.url), "utf8"));
  assert.equal((full.match(/<li class="(ok|todo|wait|work)">/g) || []).length, req.length, "не все просьбы в книге");
  const data = JSON.parse(full.match(/<script type="application\/json" id="book-data">([\s\S]*?)<\/script>/)[1]);
  for (const n of full.matchAll(/data-spr="([^"]+)"/g)) assert.ok(data.spr[n[1]], "в книге нет карты спрайта " + n[1]);
  assert.ok(!/<!DOCTYPE|<html|<body/i.test(fragment), "версия для публикации — без каркаса страницы");
});
