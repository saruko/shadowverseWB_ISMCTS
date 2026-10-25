// カード・クレストの能力定義（カードIDをキーにする）

import type { CardAbilities } from "../../engine/dsl";
import { BISHOP } from "./bishop";
import { CRESTS } from "./crests";
import { DRAGON } from "./dragon";
import { ELF } from "./elf";
import { NEMESIS } from "./nemesis";
import { NEUTRAL } from "./neutral";
import { NIGHTMARE } from "./nightmare";
import { ROTATION_ABILITIES, ROTATION_CREST_ABILITIES } from "./rotation";
import { ROYAL } from "./royal";
import { WITCH } from "./witch";

const STARTER_ABILITIES: Readonly<Record<string, CardAbilities>> = {
  ...NEUTRAL,
  ...ELF,
  ...ROYAL,
  ...WITCH,
  ...DRAGON,
  ...NIGHTMARE,
  ...BISHOP,
  ...NEMESIS,
};

/** 定義を合わせる。スターターの定義をローテーションの定義で上書きしない（同じキーがあればエラー） */
function merge(
  a: Readonly<Record<string, CardAbilities>>,
  b: Readonly<Record<string, CardAbilities>>,
  what: string,
): Readonly<Record<string, CardAbilities>> {
  const dup = Object.keys(b).filter((k) => k in a);
  if (dup.length > 0) throw new Error(`${what}の能力の定義が重なっています: ${dup.join(", ")}`);
  return { ...a, ...b };
}

export const CARD_ABILITIES: Readonly<Record<string, CardAbilities>> = merge(STARTER_ABILITIES, ROTATION_ABILITIES, "カード");

export const CREST_ABILITIES: Readonly<Record<string, CardAbilities>> = merge(CRESTS, ROTATION_CREST_ABILITIES, "クレスト");
