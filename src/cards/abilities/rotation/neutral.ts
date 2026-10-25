// ローテーションのカード能力（neutral。トークン・クレスト含む）。書き方は docs/rotation-authoring.md

import type { CardAbilities } from "../../../engine/dsl";

export const NEUTRAL_ROT: Record<string, CardAbilities> = {};

/** このクラスのカードが与えるクレストの能力（キーは crestIdOf("カード名")） */
export const NEUTRAL_ROT_CRESTS: Record<string, CardAbilities> = {};
