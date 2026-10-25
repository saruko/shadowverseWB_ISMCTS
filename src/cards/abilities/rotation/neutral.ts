// ローテーションのカード能力（neutral。トークン・クレスト含む）。書き方は docs/rotation-authoring.md

import type { CardAbilities, Condition, Effect } from "../../../engine/dsl";
import {
  ENHANCED,
  EVENT,
  OPP_LEADER,
  RELEASED_ULTIMATE,
  SELF_LEADER,
  SUPER_EVOLVE_TURN,
  THIS,
  ULTIMATE,
  act,
  addToHand,
  allFollowers,
  allyFollowers,
  banish,
  boardCards,
  bounce,
  buff,
  choose,
  copy,
  costChange,
  count,
  countAtLeast,
  crest,
  crestIdOf,
  crestsOf,
  cycleEffects,
  damage,
  destroy,
  destroyedCards,
  directSummon,
  discard,
  draw,
  drawAs,
  eventStat,
  evolveIt,
  fanfare,
  fromZone,
  gainEp,
  gainPp,
  gainSep,
  grant,
  grantAbilities,
  grantNoAttack,
  handCards,
  heal,
  id,
  inDeck,
  lastWords,
  mode,
  onAllyPlay,
  onAttack,
  onDirectSummoned,
  onEvolve,
  onSuperEvolve,
  onTurnEnd,
  onTurnStart,
  oppFollowers,
  otherAllyFollowers,
  otherFollowers,
  random,
  randomEffects,
  randomKeywords,
  repeat,
  slot,
  spell,
  summon,
  transformFrom,
  triggerOwnFanfare,
  union,
  when,
} from "../helpers";

/** 自分の場のフォロワーすべてと自分のリーダーを1回復（ユニ・サンダルフォンのクレスト） */
const healAllies: Effect = heal(1, union(allyFollowers(), SELF_LEADER));

/** 忘失の無垢・アイカ: このバトル中に破壊された自分のフォロワーからランダム1枚と同名のカードを非公開で手札に */
const aikaEffects: Effect[] = [copy(destroyedCards({ type: "follower" }), 1, "hand", { hidden: true })];

/** 畏怖の象徴・オメガオテプ: 下記の能力からランダム2つ（【超進化時】も同じ） */
const omegaotepEffects: Effect[] = [
  randomEffects(
    2,
    [random(oppFollowers()), destroy(slot())],
    [damage(OPP_LEADER, 2)],
    [gainPp(2)],
    [buff(THIS, 4, 4), triggerOwnFanfare],
  ),
];

/** このバトル中に自分がプレイしたカードの元のコストに1～8すべてが含まれている（アズヴォルト・ゼラエル） */
const PLAYED_1_TO_8: Condition = { kind: "playedCostsCover", from: 1, to: 8 };

export const NEUTRAL_ROT: Record<string, CardAbilities> = {
  // ---- 第4弾 ----
  [id("空駆ける庇護者・カタリナ")]: {
    abilities: [fanfare(when(ULTIMATE, [random(oppFollowers(), 2), damage(slot(), 5)]))],
    damageCap: { atLeast: 4, to: 3 },
  },
  [id("愛すべき相棒・ビィ")]: { abilities: [fanfare(when(SUPER_EVOLVE_TURN, [evolveIt()]))] },
  [id("コスモスの御使い・ユニ")]: {
    abilities: [onTurnEnd(healAllies)],
  },
  // 【モード】を先に選び、そのあと【奥義】（どちらのモードでも働く）
  [id("蒼い空を征く騎空士・グラン＆ジータ")]: {
    abilities: [
      fanfare(
        mode([random(oppFollowers()), damage(slot(), 5)], [draw(2, { type: "follower" })]),
        when(ULTIMATE, [evolveIt()]),
      ),
    ],
  },
  [id("空の命運を握る少女・ルリア")]: {
    abilities: [fanfare(when(ENHANCED, [draw(1, { type: "follower", costMin: 7 }), gainPp(7)]))],
  },
  [id("天司長の後継・サンダルフォン")]: {
    abilities: [
      inDeck(onTurnStart(when({ kind: "evolvedCountAtLeast", atLeast: 6 }, [directSummon]))),
      onDirectSummoned(crest("天司長の後継・サンダルフォン"), bounce(THIS)),
      fanfare(when(RELEASED_ULTIMATE, [repeat(5, random(union(oppFollowers(), OPP_LEADER)), damage(slot(), 2))])),
    ],
  },

  // ---- 第5弾 ----
  // 「場に」は両方の場
  [id("達筆の怪異")]: {
    abilities: [
      fanfare(when(countAtLeast(boardCards("both", { originalCostEq: 1, excludeSelf: true }), 1), [buff(THIS, 1, 1)])),
    ],
  },
  [id("スターライトゴッデス")]: {
    abilities: [
      onEvolve(
        choose(handCards(), 3),
        discard(slot()),
        copy(fromZone("hand", "self", "left"), 3, "hand", { hidden: true }),
      ),
    ],
  },
  [id("軍配の偉丈夫")]: {
    abilities: [onEvolve(when({ kind: "handTopCostGreater", n: 3 }, [destroy(oppFollowers())]))],
  },
  // 「場にそれ以外の」: プレイしたカードを除く両方の場のカード（これ自身も数える）
  [id("大遊戯世界")]: {
    abilities: [
      onAllyPlay(
        {},
        when(
          countAtLeast(boardCards("both", { originalCostEqValue: eventStat("originalCost"), excludeEvent: true }), 1),
          [{ op: "countdown", target: THIS, amount: -1 }],
        ),
      ),
      lastWords(draw(2)),
    ],
  },
  [id("《世界》の提示")]: {
    abilities: [
      spell(
        draw(2),
        random({ kind: "maxAttack", of: oppFollowers() }),
        destroy(slot()),
        when(ENHANCED, [damage(union(oppFollowers(), OPP_LEADER), 4)]),
      ),
    ],
  },
  // 【モード】を先に選ぶ（手札すべてを捨てるのはどちらのモードでも先に働く）
  [id("八界花・ゲテンオウ")]: {
    abilities: [
      fanfare(mode([discard(handCards()), draw(8)], [discard(handCards()), drawAs(2, "d"), costChange(slot("d"), -8)])),
    ],
  },

  // ---- 第6弾 ----
  [id("混濁せし民")]: { abilities: [lastWords(damage(OPP_LEADER, 1))] },
  [id("這い寄られし者")]: { abilities: [fanfare(choose(oppFollowers()), destroy(slot()))] },
  [id("侵略されし世界")]: {
    abilities: [act(0, choose(handCards()), transformFrom(slot(), fromZone("deck", "opponent", "random")))],
  },
  [id("闇を彷徨う獣")]: {
    abilities: [fanfare(randomKeywords(THIS, ["storm", "bane", "intimidate", "drain", "aura", "barrier"], 3))],
  },
  [id("暗黒次元")]: { abilities: [onTurnEnd(damage(allFollowers({ notTribe: "アサイラント" }), 2))] },
  [id("畏怖の象徴・オメガオテプ")]: {
    abilities: [fanfare(...omegaotepEffects), onSuperEvolve(...omegaotepEffects)],
  },

  // ---- 第7弾 ----
  [id("ピュアリィキッズ")]: { abilities: [onEvolve(draw(1, { class: "neutral" }))] },
  [id("退廃の涙")]: { abilities: [spell(choose(boardCards("opponent")), banish(slot()))] },
  [id("ゴッズレポーター")]: { abilities: [lastWords(draw(1)), onSuperEvolve(summon("ゴッズレポーター", 2))] },
  [id("享楽の上位市民")]: { abilities: [fanfare(choose(handCards()), discard(slot()), damage(oppFollowers(), 2))] },
  [id("バベロンシティ")]: {
    abilities: [
      onTurnEnd(
        cycleEffects([random(oppFollowers()), damage(slot(), 2)], [heal(2)], [damage(OPP_LEADER, 2), destroy(THIS)]),
      ),
      act(1, choose(handCards()), discard(slot()), { op: "countdown", target: THIS, amount: 1 }),
    ],
  },
  // 交戦相手（攻撃先のフォロワー）が持つ「自分のターン終了時」は、交戦相手の持ち主のターン終了時
  [id("特記標的・ヘイレムハニィ")]: {
    abilities: [
      onAttack(
        when({ kind: "attackingFollower" }, [
          grant(THIS, ["barrier"]),
          grantNoAttack(EVENT),
          grantAbilities(EVENT, [onTurnEnd(banish(THIS))]),
        ]),
      ),
      lastWords(crest("特記標的・ヘイレムハニィ")),
    ],
  },
  [id("バベロンメイヤー・エルタロ")]: { abilities: [onTurnEnd(draw(1))] },

  // ---- 第8弾 ----
  [id("克己の聖鳥・ハンサ")]: { abilities: [onEvolve(buff(THIS, 5, 5))] },
  [id("タイムレスジャーニー・レイナ")]: { abilities: [fanfare(gainEp(1))] },
  [id("早鐘の歓喜・アルフィード")]: {
    abilities: [fanfare(choose(oppFollowers()), damage(slot(), 4)), onEvolve(grant(THIS, ["storm"]))],
  },
  [id("救世の勇姿")]: {
    abilities: [
      spell(
        copy(fromZone("hand", "opponent", "random"), 1, "hand", { hidden: true, slot: "c" }),
        costChange(slot("c"), -1),
        draw(1),
      ),
    ],
  },
  [id("忘失の無垢・アイカ")]: { abilities: [fanfare(...aikaEffects), onEvolve(...aikaEffects)] },
  [id("相承の意思")]: {
    abilities: [
      spell(
        mode([random(oppFollowers()), damage(slot(), 3)], [{ op: "reanimate", cost: 2 }], [buff(allyFollowers(), 1, 0)]),
      ),
    ],
  },
  [id("アルビオンバハムート")]: {
    abilities: [
      fanfare(
        mode([banish(otherFollowers())], [banish(boardCards("both", { type: "amulet" }))], [banish(crestsOf("both"))]),
      ),
    ],
  },
  [id("気高き黒翼・オリヴィエ")]: { abilities: [fanfare(gainSep(2))] },

  // ---- 第9弾 ----
  [id("最古の獄卒")]: {
    abilities: [
      fanfare(
        choose(oppFollowers()),
        damage(slot(), 6),
        random(oppFollowers({ notInSlot: "t" }), 1, "r"),
        damage(slot("r"), 2),
      ),
    ],
    accelerate: { cost: 1, abilities: [spell(random(oppFollowers()), damage(slot(), 2))] },
  },
  [id("輪廻転衝")]: {
    abilities: [spell(copy(destroyedCards({ type: "follower" }, true), 1, "deck"), draw(1))],
  },
  [id("ブレードエンジェル")]: { abilities: [fanfare(choose(otherAllyFollowers(), 2), buff(slot(), 3, 3))] },
  // X は『最古の獄卒』を加えた後の手札で数える
  [id("無我の看守")]: {
    abilities: [
      fanfare(
        addToHand("最古の獄卒"),
        random(oppFollowers(), 2),
        damage(slot(), count(handCards({ class: "neutral" }))),
      ),
      onEvolve(gainPp(1)),
    ],
  },
  [id("混迷の監獄・アズヴォルト")]: {
    abilities: [
      onTurnEnd(when(PLAYED_1_TO_8, [destroy(THIS)])),
      lastWords(copy(destroyedCards({ type: "follower" }), 4, "board", { kinds: true }), buff(allyFollowers(), 3, 3)),
    ],
  },
  [id("途絶した輪廻・ゼラエル")]: {
    abilities: [inDeck(onTurnEnd(when(PLAYED_1_TO_8, [directSummon]))), fanfare(choose(oppFollowers()), damage(slot(), 9))],
  },
};

/** このクラスのカードが与えるクレストの能力（キーは crestIdOf("カード名")） */
export const NEUTRAL_ROT_CRESTS: Record<string, CardAbilities> = {
  [crestIdOf("天司長の後継・サンダルフォン")]: {
    abilities: [onTurnEnd(healAllies)],
  },
  [crestIdOf("特記標的・ヘイレムハニィ")]: {
    abilities: [lastWords(summon("特記標的・ヘイレムハニィ", 1, "s"), evolveIt(slot("s")))],
  },
};
