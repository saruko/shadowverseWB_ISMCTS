// フォーマットとデッキ構築ルール。数値の出典・確認状況は docs/rules.md を参照。

import { CARD_SETS, type Card, type CardSet, type ClassId } from "./types";

export const DECK_SIZE = 40;
export const MAX_COPIES = 3;

export interface Format {
  id: string;
  name: string;
  /** デッキに入れられるセット */
  sets: readonly CardSet[];
  /** さらに、今のローテーションで使えるカード（Card.rotation）に限る */
  rotationOnly?: boolean;
  /** sets の外で入れられるカード（カードID） */
  extraIds?: readonly string[];
}

/** スターター: 第1弾とベーシックのみ。能力調整されたカードは当時の能力で扱う（cards.json 側で表現）。 */
export const STARTER: Format = {
  id: "starter",
  name: "スターター",
  sets: ["basic", "legend_dawn"],
};

/**
 * ローテーション: 直近 6 パックとベーシック。どのパックが入るかは新弾のたびに変わるので、
 * セットでは絞らず公式データの is_include_rotation（Card.rotation）で決める。能力は今のもの。
 */
export const ROTATION: Format = {
  id: "rotation",
  name: "ローテーション",
  sets: CARD_SETS.filter((s) => s !== "token"),
  rotationOnly: true,
};

/**
 * 第9弾環境のローテーション（ベーシック＋第4〜9弾）。第10弾の追加で第4弾が外れる前のローテーション。
 * それまでのローテーションのデッキ（data/decks-rotation-9）をこのフォーマットとして残す（ユーザー判断 2026-10-27）。
 * ストームブラスト（第1弾）は、第9弾環境のローテーションでも使えたカード
 */
export const ROTATION_9: Format = {
  id: "rotation-9",
  name: "第9弾ローテーション",
  sets: ["basic", "set_04", "set_05", "set_06", "set_07", "set_08", "set_09"],
  extraIds: ["10131320"],
};

/** そのフォーマットのデッキに入れられるカードか */
export function inFormat(format: Format, card: Card): boolean {
  return (format.sets.includes(card.set) || format.extraIds?.includes(card.id) === true) && (!format.rotationOnly || card.rotation === true);
}

/** デッキ構築ルールに違反していれば理由の一覧を返す。空なら合法。 */
export function deckProblems(
  format: Format,
  deckClass: ClassId,
  cards: readonly Card[],
): string[] {
  const problems: string[] = [];
  if (deckClass === "neutral") problems.push("ニュートラルはデッキのクラスに指定できません");
  if (cards.length !== DECK_SIZE) {
    problems.push(`デッキは${DECK_SIZE}枚である必要があります（現在${cards.length}枚）`);
  }

  const copies = new Map<string, number>();
  for (const card of cards) {
    if (!inFormat(format, card)) {
      problems.push(`${card.name} は${format.name}で使用できません`);
    }
    if (card.class !== "neutral" && card.class !== deckClass) {
      problems.push(`${card.name} はデッキのクラスと異なります`);
    }
    copies.set(card.name, (copies.get(card.name) ?? 0) + 1);
  }
  for (const [name, n] of copies) {
    if (n > MAX_COPIES) problems.push(`${name} は${MAX_COPIES}枚までです（${n}枚）`);
  }
  // 同じカードの重複指摘をまとめる
  return [...new Set(problems)];
}
