// ローテーションのカード能力（nemesis。トークン・クレスト含む）。書き方は docs/rotation-authoring.md

import type { CardAbilities, CardFilter, Effect } from "../../../engine/dsl";
import {
  DECK_NO_DUPLICATES,
  ENHANCED,
  EVENT,
  OPP_LEADER,
  RELEASED_ULTIMATE,
  SELF_LEADER,
  SUPER_EVOLVE_TURN,
  THIS,
  THIS_EVOLVED,
  ULTIMATE,
  addGauge,
  addToHand,
  allyFollowers,
  banish,
  boardCards,
  buff,
  choose,
  copy,
  costChange,
  costChangeTemp,
  count,
  countAtLeast,
  crest,
  crestIdOf,
  damage,
  destroy,
  destroyedCards,
  discard,
  distribute,
  draw,
  enteredKinds,
  evolveIt,
  fanfare,
  fromSlot,
  gainEp,
  gainPp,
  grant,
  handCards,
  heal,
  id,
  inHand,
  lastWords,
  loseLastWords,
  mode,
  modeAll,
  onAllyEnter,
  onAllyPlay,
  onClash,
  onEnemyAttackLeader,
  onEnter,
  onEvolve,
  onEvolved,
  onSuperEvolve,
  onTurnEnd,
  onTurnStart,
  oncePerOwnTurn,
  oppFollowers,
  oppHand,
  otherAllyFollowers,
  random,
  randomUnused,
  repeat,
  silence,
  slot,
  slotStat,
  spell,
  summon,
  transform,
  union,
  valueAtLeast,
  when,
} from "../helpers";

// ---- 共通の部品 ----

const artifactFollower: CardFilter = { type: "follower", tribe: "アーティファクト" };
/** このバトル中に場に出た自分のアーティファクト・フォロワーの種類が3以上 */
const ARTIFACT_KINDS_3 = valueAtLeast(enteredKinds(artifactFollower), 3);
const ARTIFACT_KINDS = enteredKinds(artifactFollower);
/** 自分の場に元のコスト5以上のフォロワーがある */
const HAS_BIG_ALLY = countAtLeast(allyFollowers({ originalCostMin: 5 }), 1);
/** 【必殺】を持つネメシス・フォロワー（デッキから引く） */
const baneNemesis: CardFilter = { type: "follower", class: "nemesis", cardKeyword: "bane" };
/** 「相手の場のフォロワーからランダム1枚にNダメージ。」を times 回行う */
const randomPings = (times: number, amount: number): Effect =>
  repeat(times, random(oppFollowers(), 1, "r"), damage(slot("r"), amount));
/** 相手の場のフォロワー1枚を選ぶ。それを破壊 */
const chooseDestroy = [choose(oppFollowers()), destroy(slot())];

// 【進化時】【ファンファーレ】と同じ能力が働く 等、同じ効果を2か所で使うもの
const chillSkaterEffect = addToHand("エンシェントアーティファクト");
const twinDroneEffect = summon("アナライズアーティファクト");
const eyesEdenEffect = summon("撃針の看守");

export const NEMESIS_ROT: Record<string, CardAbilities> = {
  // ---- 第4弾 ----
  [id("再起の夜王・ショウ")]: {
    abilities: [fanfare(when(SUPER_EVOLVE_TURN, [grant(THIS, ["barrier"])]))],
  },
  [id("爆燃の総長・ツバサ")]: { abilities: [fanfare(addGauge(handCards(), 1))] },
  [id("報恩の技師・アイザック")]: { abilities: [lastWords(addToHand("アタックアーティファクト"))] },
  [id("轟雷の閃狼・ユーステス")]: {
    abilities: [
      // 選ぶ対象がいなくても、これは進化する（選ぶ0枚で続ける。エンジンの「選ぶ」の挙動のまま）
      fanfare(
        when(ULTIMATE, [choose(otherAllyFollowers({ notEvolved: true })), evolveIt(union(slot(), THIS))]),
      ),
      onClash(damage(EVENT, 3)),
    ],
  },
  [id("厳烈なる教官・イルザ")]: {
    abilities: [fanfare(mode([randomPings(3, 4)], [damage(OPP_LEADER, 4)]))],
  },
  [id("ストーン・ブレイク")]: { abilities: [spell(randomPings(6, 1))] },
  [id("空慕う帰還者・カシウス")]: {
    abilities: [
      fanfare(choose(handCards(artifactFollower)), damage(oppFollowers(), slotStat("t", "attack"))),
      lastWords(addToHand("キャッスルアーティファクト")),
    ],
  },
  [id("ケイオス・レギオン")]: {
    abilities: [
      spell(
        when(
          RELEASED_ULTIMATE,
          [damage(union(oppFollowers(), OPP_LEADER), 6)],
          [damage(union(oppFollowers(), OPP_LEADER), 3)],
        ),
      ),
    ],
  },
  [id("光の理・ル・オー")]: {
    abilities: [
      fanfare(
        randomPings(6, 1),
        buff(oppHand({ type: "follower" }), 1, 0),
        when(ULTIMATE, [crest("光の理・ル・オー")]),
      ),
    ],
  },
  [id("全一の王・ベルゼバブ")]: {
    abilities: [
      fanfare(
        choose(oppFollowers(), 2),
        silence(slot()),
        damage(slot(), 9),
        { op: "leaderStatus", side: "opponent", plus: 1 },
      ),
    ],
  },

  // ---- 第5弾 ----
  [id("ステージメーカー")]: {
    abilities: [
      fanfare(
        summon("改良型・操り人形", 1, "a"),
        summon("操り人形", 1, "b"),
        when(ENHANCED, [grant(union(slot("a"), slot("b")), ["storm"])]),
      ),
    ],
  },
  [id("満開の技術屋")]: {
    abilities: [fanfare(draw(1, { type: "spell" })), onAllyPlay({ type: "spell" }, damage(oppFollowers(), 3))],
  },
  [id("尽小花の照臨")]: { abilities: [spell(draw(1))] },
  [id("ネオジオグラファー")]: {
    abilities: [
      fanfare(addToHand("デストロイアーティファクトβ")),
      onSuperEvolve(
        choose(handCards({ type: "follower", tribe: "アーティファクト", costMax: 5 })),
        copy(fromSlot(), 1, "board"),
      ),
    ],
  },
  [id("清宵の偶兎")]: { abilities: [onAllyPlay({ type: "spell" }, evolveIt(THIS))] },
  [id("リヴァイブチューニング")]: {
    abilities: [
      spell(
        choose(handCards()),
        discard(slot()),
        copy(destroyedCards({ type: "follower" }), 2, "hand", { kinds: true, hidden: true }),
      ),
    ],
  },
  [id("ニューロンインタラプター")]: {
    abilities: [fanfare(gainPp(count(otherAllyFollowers()))), lastWords(draw(2))],
  },
  [id("誠心なる尽小花")]: {
    abilities: [spell(choose(boardCards("both")), transform(slot(), "イマリの小鬼"))],
  },
  [id("廻る《運命の輪》・スロース")]: {
    abilities: [
      onTurnEnd(when(THIS_EVOLVED, [crest("廻る《運命の輪》・スロース", "opponent"), banish(THIS)])),
      onTurnStart(
        randomUnused(
          [costChangeTemp(handCards(), -1)],
          [buff(allyFollowers(), 2, 2)],
          [heal(3)],
        ),
      ),
    ],
  },
  [id("尽小花・イマリ")]: {
    abilities: [
      fanfare(choose(handCards()), discard(slot()), draw(1, { type: "spell" })),
      onAllyPlay({ type: "spell" }, when(THIS_EVOLVED, [summon("イマリの小鬼")])),
      onSuperEvolve({ op: "draw", count: 2, filter: { type: "spell", costIn: [1] }, kinds: true }),
    ],
  },

  // ---- 第6弾 ----
  [id("低劣の玩具")]: {
    abilities: [fanfare(draw(3))],
    accelerate: { cost: 2, abilities: [spell(summon("低劣の玩具"))] },
  },
  [id("ブライトクリエイター")]: {
    abilities: [fanfare(summon("デストロイアーティファクトα", 1, "s"), grant(slot("s"), ["bane", "ward"]))],
  },
  [id("天斧授与")]: {
    abilities: [spell(choose(oppFollowers()), damage(slot(), 4), when(HAS_BIG_ALLY, [draw(1)]))],
  },
  [id("拙劣の人形")]: {
    abilities: [fanfare(summon("拙劣の人形", 1, "s"), evolveIt(union(slot("s"), THIS)))],
    accelerate: { cost: 3, abilities: [spell(summon("拙劣の人形", 2))] },
  },
  [id("小胆のパイオニア")]: {
    abilities: [fanfare(choose(oppFollowers({ defenseMax: 3 })), banish(slot()))],
  },
  [id("凡百の製図")]: {
    abilities: [
      spell(
        summon("愚劣の兵器", 1, "a"),
        summon("低劣の玩具", 1, "b"),
        summon("拙劣の人形", 1, "c"),
        buff(union(slot("a"), slot("b"), slot("c")), 0, 1),
      ),
    ],
  },
  [id("愚劣の兵器")]: {
    abilities: [
      fanfare(summon("愚劣の兵器", 2)),
      onTurnEnd(distribute(oppFollowers(), 3)),
      onEvolve(distribute(oppFollowers(), 3)),
    ],
    accelerate: { cost: 4, abilities: [spell(summon("愚劣の兵器"))] },
  },
  [id("劣悪の天斧")]: {
    abilities: [
      inHand(onAllyEnter({ type: "follower", originalCostMin: 5 }, costChangeTemp(THIS, -1))),
      spell(
        random(allyFollowers({ originalCostMin: 5, notEvolved: true }), 1, "e"),
        evolveIt(slot("e")),
        random(oppFollowers(), 1, "r"),
        damage(slot("r"), 6),
      ),
    ],
  },
  [id("劣悪の純心・カミシラ")]: {
    abilities: [
      fanfare(summon("低劣の玩具"), summon("拙劣の人形")),
      onAllyEnter({ type: "follower", originalCostMin: 5 }, evolveIt(EVENT)),
      onSuperEvolve(damage(OPP_LEADER, count(allyFollowers({ originalCostMin: 5 })))),
    ],
  },
  [id("旧き天斧・ヨグゼンタ")]: {
    abilities: [fanfare(when(HAS_BIG_ALLY, [addToHand("天斧の深淵")]))],
  },

  // ---- 第7弾 ----
  [id("エッジーマスター")]: {
    abilities: [onAllyEnter(artifactFollower, heal(1)), onEvolve(summon("ミスティックアーティファクト"))],
  },
  [id("ドープダンサー")]: {
    abilities: [fanfare(when(ARTIFACT_KINDS_3, [summon("ドープダンサー", 2)], [summon("ドープダンサー")]))],
  },
  [id("ストリートラン")]: {
    abilities: [
      spell(
        modeAll(ARTIFACT_KINDS_3, [addToHand("アナライズアーティファクト")], [addToHand("エンシェントアーティファクト")]),
      ),
    ],
  },
  [id("チルスケーター")]: { abilities: [fanfare(chillSkaterEffect), onEvolve(chillSkaterEffect)] },
  [id("ボールドペインター")]: {
    abilities: [
      fanfare(
        ...chooseDestroy,
        when(ARTIFACT_KINDS_3, [summon("エンシェントアーティファクト"), summon("ミスティックアーティファクト")]),
      ),
    ],
  },
  [id("フラッシュブリンク")]: {
    abilities: [
      spell(buff(allyFollowers(), 1, 0), when(SUPER_EVOLVE_TURN, [buff(handCards({ type: "follower" }), 1, 0)])),
    ],
  },
  [id("ワイルドキャスター")]: {
    abilities: [
      fanfare(summon("アナライズアーティファクト"), when(ENHANCED, [summon("ミスティックアーティファクト")])),
      onAllyEnter(artifactFollower, grant(EVENT, ["rush"])),
    ],
  },
  [id("テレポートスラッシュ")]: {
    abilities: [spell(damage(oppFollowers(), ARTIFACT_KINDS), damage(OPP_LEADER, 1))],
  },
  [id("虚刻のアナテマ・スカーレット")]: { abilities: [fanfare(damage(oppFollowers(), ARTIFACT_KINDS))] },
  [id("奮励の追走・ミュー")]: {
    abilities: [
      onAllyEnter(artifactFollower, random(oppFollowers(), 1, "r"), damage(slot("r"), 3)),
      onEvolve(summon("エンシェントアーティファクト")),
      // 「その後」: 【超進化時】は【進化時】の後に働く
      onSuperEvolve(when(ARTIFACT_KINDS_3, [grant(THIS, ["storm"])])),
    ],
  },

  // ---- 第8弾 ----
  [id("ありふれた幸福・クラトス")]: {
    abilities: [lastWords(summon("ありふれた幸福・クラトス", 1, "s"), loseLastWords(slot("s")))],
  },
  [id("エクセシブガーディアン・リオナ")]: {
    abilities: [onSuperEvolve(choose(otherAllyFollowers()), grant(slot(), ["ambush"]))],
  },
  [id("デバイスマニピュレーター・ジルク")]: {
    abilities: [fanfare(copy(destroyedCards(artifactFollower), 1, "hand", { hidden: true }))],
  },
  [id("アーティフィシャルギフト・レイラ")]: { abilities: [lastWords(addToHand("エンシェントアーティファクト"))] },
  [id("ポータルコネクター・ラズリ")]: { abilities: [fanfare(addToHand("レディアントアーティファクト"))] },
  [id("穢れなき日々")]: { abilities: [spell(draw(2), when(SUPER_EVOLVE_TURN, [heal(2)]))] },
  [id("レシプロケイト・ミリアム")]: {
    abilities: [fanfare(...chooseDestroy, summon("レディアントアーティファクト"))],
  },
  [id("切り拓く未来")]: {
    abilities: [spell(choose(oppFollowers()), damage(slot(), 6), when(ARTIFACT_KINDS_3, [gainEp(1)]))],
  },
  [id("決断の交差・アシュレイ＆リディア")]: {
    abilities: [
      fanfare(
        choose(oppFollowers()),
        grant(slot(), ["ward"]),
        when(ENHANCED, [evolveIt(THIS), grant(THIS, ["storm"])]),
      ),
      onEvolved(random(oppFollowers({ keyword: "ward" }), 2, "r"), destroy(slot("r"))),
    ],
  },
  [id("アナタの先輩・エース")]: {
    abilities: [
      fanfare(addToHand("アナライズアーティファクト")),
      onEvolve(choose(otherAllyFollowers({ notEvolved: true })), evolveIt(slot())),
    ],
  },

  // ---- 第9弾 ----
  [id("青錆の下っ端")]: {
    abilities: [fanfare(when(DECK_NO_DUPLICATES, [choose(oppFollowers()), damage(slot(), 5)]))],
  },
  [id("ツインドローンガール")]: { abilities: [fanfare(twinDroneEffect), onEvolve(twinDroneEffect)] },
  [id("次元の選定")]: {
    abilities: [spell(mode([damage(oppFollowers(), 5)], [summon("ミスティックアーティファクト", 2)]))],
  },
  [id("錬磨の用心棒")]: {
    // 「自分のリーダーを4回復」も重複がないときだけ働くとした（テキストの区切りからの推定）
    abilities: [fanfare(when(DECK_NO_DUPLICATES, [choose(oppFollowers()), damage(slot(), 4), heal(4)]))],
  },
  [id("ナイフストリンガー")]: {
    abilities: [
      fanfare(summon("改良型・操り人形"), summon("操り人形")),
      onAllyEnter({ type: "follower", tribe: "人形" }, damage(OPP_LEADER, 1)),
    ],
  },
  [id("屈辱なる放逐")]: {
    abilities: [
      spell(choose(handCards()), discard(slot()), draw(1, baneNemesis), when(DECK_NO_DUPLICATES, [draw(2)])),
    ],
  },
  [id("鋳鉄の腹心")]: {
    abilities: [fanfare(...chooseDestroy, when(DECK_NO_DUPLICATES, [grant(THIS, ["storm"])]))],
  },
  [id("ハクガ燐斂")]: {
    abilities: [spell(when(DECK_NO_DUPLICATES, [destroy(oppFollowers())], chooseDestroy))],
  },
  [id("束刃の咎人・カットスロート")]: {
    abilities: [onEvolve(draw(1, baneNemesis), when(DECK_NO_DUPLICATES, [crest("束刃の咎人・カットスロート")]))],
  },
  [id("弾哭の変貌・アイズエデン")]: {
    abilities: [
      fanfare(eyesEdenEffect),
      onAllyEnter(artifactFollower, random(oppFollowers(), 1, "r"), destroy(slot("r"))),
      onSuperEvolve(eyesEdenEffect),
    ],
  },

  // ---- トークン ----
  [id("アナライズアーティファクト")]: { abilities: [onEnter(draw(1))] },
  [id("撃針の看守")]: { abilities: [lastWords(heal(2))] },
  [id("天斧の深淵")]: {
    abilities: [
      spell(
        choose(allyFollowers({ originalCostMin: 5 })),
        copy(fromSlot(), 1, "hand", { hidden: true, slot: "h" }),
        costChange(slot("h"), -3),
      ),
    ],
  },
};

/** このクラスのカードが与えるクレストの能力（キーは crestIdOf("カード名")） */
export const NEMESIS_ROT_CRESTS: Record<string, CardAbilities> = {
  [crestIdOf("光の理・ル・オー")]: {
    abilities: [onEnemyAttackLeader({ type: "follower", keyword: "storm" }, buff(EVENT, -3, 0, "endOfTurn"))],
  },
  // 持つのは相手（スロースの持ち主から見て）。「自分」はクレストを持つプレイヤー
  [crestIdOf("廻る《運命の輪》・スロース")]: {
    abilities: [
      onTurnStart(
        randomUnused([costChangeTemp(handCards(), 1)], [buff(allyFollowers(), -2, -2)], [damage(SELF_LEADER, 3)]),
      ),
    ],
  },
  [crestIdOf("束刃の咎人・カットスロート")]: {
    abilities: [oncePerOwnTurn(onAllyPlay({ type: "follower" }, evolveIt(EVENT)))],
  },
};
