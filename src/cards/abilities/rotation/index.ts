// ローテーションのカード・クレストの能力（スターターの定義と同じ形。キーが重なったらエラー）

import type { CardAbilities } from "../../../engine/dsl";
import { BISHOP_ROT, BISHOP_ROT_CRESTS } from "./bishop";
import { DRAGON_ROT, DRAGON_ROT_CRESTS } from "./dragon";
import { ELF_ROT, ELF_ROT_CRESTS } from "./elf";
import { NEMESIS_ROT, NEMESIS_ROT_CRESTS } from "./nemesis";
import { NEUTRAL_ROT, NEUTRAL_ROT_CRESTS } from "./neutral";
import { NIGHTMARE_ROT, NIGHTMARE_ROT_CRESTS } from "./nightmare";
import { ROYAL_ROT, ROYAL_ROT_CRESTS } from "./royal";
import { WITCH_ROT, WITCH_ROT_CRESTS } from "./witch";

export const ROTATION_ABILITIES: Readonly<Record<string, CardAbilities>> = {
  ...NEUTRAL_ROT,
  ...ELF_ROT,
  ...ROYAL_ROT,
  ...WITCH_ROT,
  ...DRAGON_ROT,
  ...NIGHTMARE_ROT,
  ...BISHOP_ROT,
  ...NEMESIS_ROT,
};

export const ROTATION_CREST_ABILITIES: Readonly<Record<string, CardAbilities>> = {
  ...NEUTRAL_ROT_CRESTS,
  ...ELF_ROT_CRESTS,
  ...ROYAL_ROT_CRESTS,
  ...WITCH_ROT_CRESTS,
  ...DRAGON_ROT_CRESTS,
  ...NIGHTMARE_ROT_CRESTS,
  ...BISHOP_ROT_CRESTS,
  ...NEMESIS_ROT_CRESTS,
};
