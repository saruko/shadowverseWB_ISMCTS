// 画面で選ぶフォーマット（スターター・ローテーション・第9弾ローテーション）。デッキの一覧・ランダムなデッキ・デッキ構築のカードと規則をこれで切り替える。
// 選んだフォーマットはブラウザに保存する（localStorage）。

import { CARDS_BY_ID, ROTATION, ROTATION_9, STARTER, deckProblems, type Card, type Format } from "../cards";
import type { Deck } from "../cards/deck";
import { DEFAULT_DECKS, ROTATION_9_DECKS, ROTATION_DECKS, type DefaultDeck } from "../cards/defaultDecks";

export type FormatId = "starter" | "rotation" | "rotation9";

export const FORMATS: Record<FormatId, Format> = { starter: STARTER, rotation: ROTATION, rotation9: ROTATION_9 };

/** ヘッダーに出すフォーマットの説明 */
export const FORMAT_LABELS: Record<FormatId, string> = {
  starter: "スターター（ベーシック＋伝説の幕開け）",
  rotation: "ローテーション（ベーシック＋直近6パック）",
  rotation9: "第9弾ローテーション（ベーシック＋第4〜9弾）",
};

/** フォーマットのデフォルトデッキ（スターターは data/decks、ローテーションは data/decks-rotation、第9弾ローテーションは data/decks-rotation-9） */
export function formatDecks(format: FormatId): readonly DefaultDeck[] {
  return format === "starter" ? DEFAULT_DECKS : format === "rotation" ? ROTATION_DECKS : ROTATION_9_DECKS;
}

/**
 * デフォルトデッキの選択肢のキー（スターターは "default:<key>"、ほかは "<フォーマット>:<key>"）。
 * フォーマットどうしで同じファイル名のデッキがあるので、前置きで分ける
 */
export function defaultDeckChoice(format: FormatId, key: string): string {
  return `${format === "starter" ? "default" : format}:${key}`;
}

/** デッキがそのフォーマットの対戦に使えるか */
export function isPlayableIn(format: FormatId, deck: Deck): boolean {
  const cards = deck.cards.map((id) => CARDS_BY_ID.get(id)).filter((c): c is Card => c !== undefined);
  return cards.length === deck.cards.length && deckProblems(FORMATS[format], deck.class, cards).length === 0;
}

const KEY = "svwb-sim:format:v1";

export function loadFormat(): FormatId {
  try {
    const v = localStorage.getItem(KEY);
    return v === "rotation" || v === "rotation9" ? v : "starter";
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
