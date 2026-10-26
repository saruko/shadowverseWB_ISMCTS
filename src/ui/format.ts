// 画面で選ぶフォーマット（スターター・ローテーション）。デッキの一覧・ランダムなデッキ・デッキ構築のカードと規則をこれで切り替える。
// 選んだフォーマットはブラウザに保存する（localStorage）。

import { CARDS_BY_ID, ROTATION, STARTER, deckProblems, type Card, type Format } from "../cards";
import type { Deck } from "../cards/deck";
import { DEFAULT_DECKS, ROTATION_DECKS, type DefaultDeck } from "../cards/defaultDecks";

export type FormatId = "starter" | "rotation";

export const FORMATS: Record<FormatId, Format> = { starter: STARTER, rotation: ROTATION };

/** ヘッダーに出すフォーマットの説明 */
export const FORMAT_LABELS: Record<FormatId, string> = {
  starter: "スターター（ベーシック＋伝説の幕開け）",
  rotation: "ローテーション（ベーシック＋直近6パック）",
};

/** フォーマットのデフォルトデッキ（スターターは data/decks、ローテーションは data/decks-rotation） */
export function formatDecks(format: FormatId): readonly DefaultDeck[] {
  return format === "starter" ? DEFAULT_DECKS : ROTATION_DECKS;
}

/**
 * デフォルトデッキの選択肢のキー（スターターは "default:<key>"、ローテーションは "rotation:<key>"）。
 * 2 つのフォーマットに同じファイル名のデッキがあるので、前置きで分ける
 */
export function defaultDeckChoice(format: FormatId, key: string): string {
  return `${format === "starter" ? "default" : "rotation"}:${key}`;
}

/** デッキがそのフォーマットの対戦に使えるか */
export function isPlayableIn(format: FormatId, deck: Deck): boolean {
  const cards = deck.cards.map((id) => CARDS_BY_ID.get(id)).filter((c): c is Card => c !== undefined);
  return cards.length === deck.cards.length && deckProblems(FORMATS[format], deck.class, cards).length === 0;
}

const KEY = "svwb-sim:format:v1";

export function loadFormat(): FormatId {
  try {
    return localStorage.getItem(KEY) === "rotation" ? "rotation" : "starter";
  } catch {
    return "starter";
  }
}

export function saveFormat(format: FormatId): void {
  try {
    localStorage.setItem(KEY, format);
  } catch {
    // 保存できなくても動作には影響しない
  }
}
