// リポジトリ同梱のデフォルトデッキ（スターターは data/decks/*.txt、ローテーションは data/decks-rotation/*.txt、
// 第9弾環境のローテーションは data/decks-rotation-9/*.txt）。
// 形式は src/cards/deck.ts を参照。

import { parseDeckText, type Deck } from "./deck";

const files = import.meta.glob<string>("../../data/decks/*.txt", { query: "?raw", import: "default", eager: true });
const rotationFiles = import.meta.glob<string>("../../data/decks-rotation/*.txt", {
  query: "?raw",
  import: "default",
  eager: true,
});
const rotation9Files = import.meta.glob<string>("../../data/decks-rotation-9/*.txt", {
  query: "?raw",
  import: "default",
  eager: true,
});

export interface DefaultDeck extends Deck {
  /** ファイル名（拡張子なし） */
  key: string;
}

export interface DefaultDeckError {
  file: string;
  errors: string[];
}

function load(files: Record<string, string>): { decks: DefaultDeck[]; errors: DefaultDeckError[] } {
  const decks: DefaultDeck[] = [];
  const errors: DefaultDeckError[] = [];
  for (const [path, text] of Object.entries(files).sort(([a], [b]) => a.localeCompare(b))) {
    const key = path.replace(/^.*\//, "").replace(/\.txt$/, "");
    const result = parseDeckText(text, key);
    if (result.deck) decks.push({ ...result.deck, key });
    else errors.push({ file: path, errors: result.errors });
  }
  return { decks, errors };
}

const loaded = load(files);
const loadedRotation = load(rotationFiles);
const loadedRotation9 = load(rotation9Files);

/** 読み込めたデフォルトデッキ（スターター） */
export const DEFAULT_DECKS: readonly DefaultDeck[] = loaded.decks;
/** 読み込めなかったファイル（テストで検出する） */
export const DEFAULT_DECK_ERRORS: readonly DefaultDeckError[] = loaded.errors;
/** 読み込めたローテーションのデッキ（名前はスターターのデッキと重なることがある） */
export const ROTATION_DECKS: readonly DefaultDeck[] = loadedRotation.decks;
/** 読み込めなかったローテーションのデッキのファイル（テストで検出する） */
export const ROTATION_DECK_ERRORS: readonly DefaultDeckError[] = loadedRotation.errors;
/** 読み込めた第9弾環境のローテーションのデッキ（ローテーションの補正 m1 はこの 14 デッキで学んだ） */
export const ROTATION_9_DECKS: readonly DefaultDeck[] = loadedRotation9.decks;
/** 読み込めなかった第9弾環境のローテーションのデッキのファイル（テストで検出する） */
export const ROTATION_9_DECK_ERRORS: readonly DefaultDeckError[] = loadedRotation9.errors;
