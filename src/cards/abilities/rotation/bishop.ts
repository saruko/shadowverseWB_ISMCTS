// ローテーションのカード能力（bishop。トークン・クレスト含む）。書き方は docs/rotation-authoring.md

import type { CardAbilities } from "../../../engine/dsl";

export const BISHOP_ROT: Record<string, CardAbilities> = {};

/** このクラスのカードが与えるクレストの能力（キーは crestIdOf("カード名")） */
export const BISHOP_ROT_CRESTS: Record<string, CardAbilities> = {};
