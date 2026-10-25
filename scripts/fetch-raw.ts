// 公式サイトのカード一覧APIのレスポンスを、そのまま data/raw/cardList_<offset>.json に保存する（npm run cards の元データ）。
// 使い方: npm run fetch-cards
// 1 回 30 枚ずつ、全件を取るまで offset を進める。サイトに負荷をかけないよう、1 回ごとに 1 秒待つ。
// 新弾の実装後に取り直すと、そのパックのカードが入り、ローテーションの範囲（is_include_rotation）も今のものになる。

import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const API = "https://shadowverse-wb.com/web/CardList/cardList";
const RAW_DIR = "data/raw";
const WAIT_MS = 1000;

interface Page {
  data_headers: { result_code: number };
  data: { count: number; sort_card_id_list: number[] };
}

async function fetchPage(offset: number): Promise<{ page: Page; text: string }> {
  const res = await fetch(`${API}?offset=${offset}`, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error(`offset=${offset}: HTTP ${res.status}`);
  const text = await res.text();
  const page = JSON.parse(text) as Page;
  if (page.data_headers.result_code !== 1) throw new Error(`offset=${offset}: result_code=${page.data_headers.result_code}`);
  return { page, text };
}

mkdirSync(RAW_DIR, { recursive: true });
// 前回の取得分を消す（パックが減ったときに古いページが残らないように）
for (const f of readdirSync(RAW_DIR)) if (/^cardList_\d+\.json$/.test(f)) rmSync(join(RAW_DIR, f));

const listed = new Set<number>();
let total = Infinity;
for (let offset = 0; offset < total; offset += 30) {
  if (offset > 0) await new Promise((r) => setTimeout(r, WAIT_MS));
  const { page, text } = await fetchPage(offset);
  total = page.data.count;
  for (const id of page.data.sort_card_id_list) listed.add(id);
  writeFileSync(join(RAW_DIR, `cardList_${String(offset).padStart(4, "0")}.json`), text);
}

console.log(`${RAW_DIR} に保存しました（公式の枚数 ${total}、取得できたカード ${listed.size} 枚）`);
if (listed.size !== total) {
  console.warn("警告: 公式の枚数と取得できたカードの数が一致しません");
  process.exitCode = 1;
}
