import { describe, expect, it } from "vitest";
import { ALL_CARDS, ALL_CRESTS, ROTATION, STARTER, inFormat, type Card } from "../src/cards";
import { CARD_ABILITIES, CREST_ABILITIES } from "../src/cards/abilities";
import type { Ability, Effect } from "../src/engine/dsl";

/** 能力定義が不要な行（常在型キーワード、カウントダウン等はエンジンがテキストから読む） */
const STATIC_LINE = /^(【(守護|疾走|突進|必殺|ドレイン|潜伏|威圧|バリア|オーラ|土の印|カウントダウン_\d+)】|1ターンに\d回攻撃できる。)$/;

/** 能力テキストがあるのに定義がないカード */
const missingAbilities = (cards: readonly Card[]) =>
  cards
    .filter((c) => c.text.split("\n").some((line) => line !== "" && !STATIC_LINE.test(line)) && !CARD_ABILITIES[c.id])
    .map((c) => `${c.id} ${c.name}`);

/** スターターのカードと、そこから生成・参照するカード */
const starterPool = (): Card[] => {
  const byId = new Map(ALL_CARDS.map((c) => [c.id, c]));
  const pool = new Map(ALL_CARDS.filter((c) => inFormat(STARTER, c)).map((c) => [c.id, c]));
  const queue = [...pool.values()];
  while (queue.length > 0) {
    for (const ref of (queue.pop() as Card).related) {
      const r = byId.get(ref);
      if (r && !pool.has(ref)) {
        pool.set(ref, r);
        queue.push(r);
      }
    }
  }
  return [...pool.values()];
};

describe("カード能力の定義", () => {
  it("能力テキストを持つスターターの全カード（生成するトークンを含む）に定義がある", () => {
    expect(missingAbilities(starterPool())).toEqual([]);
  });

  // ローテーションのカードは実装の途中なので、未定義の数を報告するだけにする（揃ったら上と同じ検査にする）
  it("ローテーションのカードの実装状況", () => {
    const rotation = ALL_CARDS.filter((c) => inFormat(ROTATION, c));
    const missing = missingAbilities(rotation);
    console.log(`ローテーション: ${rotation.length} 枚のうち、能力の定義が無いもの ${missing.length} 枚`);
    expect(rotation.length).toBeGreaterThan(0);
  });

  it("スターターのカードが与える全クレストに定義がある", () => {
    const ids = new Set(starterPool().map((c) => c.id));
    expect(ALL_CRESTS.filter((c) => ids.has(c.source) && !CREST_ABILITIES[c.id]).map((c) => c.name)).toEqual([]);
  });

  it("プレイ・進化・アクトで選ぶ対象とモードは、ほかの効果より先に選ぶ（docs/rules.md 11章）", () => {
    // 行動で働く能力（超進化では【進化時】のあとに【超進化時】が働く）
    const onAction = (abilities: Ability[]): Effect[][] => {
      const of = (on: Ability["trigger"]["on"]) => abilities.filter((a) => a.trigger.on === on).flatMap((a) => a.effects);
      const evolve = of("evolve");
      const superEvolve = abilities.filter((a) => a.trigger.on === "superEvolve");
      return [
        of("fanfare"),
        of("spell"),
        of("act"),
        of("fused"),
        evolve,
        superEvolve.some((a) => a.replacesEvolve)
          ? superEvolve.flatMap((a) => a.effects)
          : [...evolve, ...superEvolve.flatMap((a) => a.effects)],
      ];
    };
    const hasChoice = (e: Effect): boolean =>
      e.op === "choose" ||
      e.op === "mode" ||
      (e.op === "if" && [...e.then, ...(e.else ?? [])].some(hasChoice)) ||
      (e.op === "repeat" && e.effects.some(hasChoice)) ||
      ((e.op === "earthRite" || e.op === "necromancy") && e.then.some(hasChoice));
    // 選ぶ効果より前にほかの効果があれば false
    const choicesFirst = (effects: Effect[]): boolean => {
      let other = false;
      for (const e of effects) {
        if (hasChoice(e)) {
          if (other) return false;
          if (e.op === "if" && !(choicesFirst(e.then) && choicesFirst(e.else ?? []))) return false;
          if (e.op === "mode" && !e.options.every(choicesFirst)) return false;
          if (e.op === "repeat" || e.op === "earthRite" || e.op === "necromancy") return false;
        }
        const onlyChoices = e.op === "choose" || e.op === "mode" || (e.op === "if" && [...e.then, ...(e.else ?? [])].every(hasChoice));
        if (!onlyChoices) other = true;
      }
      return true;
    };
    const late = Object.entries(CARD_ABILITIES)
      .filter(([, a]) => !onAction(a.abilities).every(choicesFirst))
      .map(([cardId]) => `${cardId} ${ALL_CARDS.find((c) => c.id === cardId)?.name}`);
    expect(late).toEqual([]);
  });

  it("定義のキーは実在するカード", () => {
    const ids = new Set(ALL_CARDS.map((c) => c.id));
    expect(Object.keys(CARD_ABILITIES).filter((k) => !ids.has(k))).toEqual([]);
  });
});
