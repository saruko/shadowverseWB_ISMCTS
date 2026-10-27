// ローテーションのカード能力（royal。トークン・クレスト含む）。書き方は docs/rotation-authoring.md

import type { CardAbilities, CardFilter, Effect, Target } from "../../../engine/dsl";
import {
  ENHANCED,
  EVENT,
  OPP_LEADER,
  OWN_TURN,
  RELEASED_ULTIMATE,
  SELF_LEADER,
  FROM_THIS,
  SUPER_EVOLVE_TURN,
  THIS,
  THIS_ATTACK,
  THIS_DEFENSE,
  THIS_EVOLVED,
  ULTIMATE,
  actedThisTurn,
  addFaith,
  addToHand,
  addToHandAs,
  allyAmulets,
  allyCards,
  allyFollowers,
  banish,
  buff,
  choose,
  copy,
  count,
  countAtLeast,
  crest,
  crestIdOf,
  crestsOf,
  cycleEffects,
  damage,
  destroy,
  discard,
  draw,
  enhancedAtLeast,
  evolveIt,
  fanfare,
  gainEp,
  gainPp,
  grant,
  grantAttacks,
  grantFaith,
  handCards,
  heal,
  id,
  inHand,
  lastWords,
  leftmost,
  link,
  mode,
  modeAll,
  onAllyEnter,
  onAllyPlay,
  onAllySuperEvolve,
  onAttack,
  onDrawn,
  onEnhancePlay,
  onEvidenceAct,
  onEvolve,
  onEvolved,
  onSuperEvolve,
  onTurnEnd,
  oncePerOwnTurn,
  oppFollowers,
  otherAllyFollowers,
  otherFollowers,
  random,
  repeat,
  returnToDeck,
  setCost,
  setStats,
  slot,
  slotMatches,
  spell,
  spendFaith,
  sub,
  summon,
  superEvolveIt,
  swapStats,
  union,
  valueAtLeast,
  when,
} from "../helpers";

const royalFollower: CardFilter = { class: "royal", type: "follower" };
const spellCard: CardFilter = { type: "spell" };
const FLAG = "戦慄の海賊旗";

/** 相手の場のフォロワー1枚を選ぶ。それに n ダメージ */
const chooseDamage = (n: number): Effect[] => [choose(oppFollowers()), damage(slot(), n)];
/** 相手の場のフォロワーからランダム1枚に n ダメージ */
const randomDamage = (n: number): Effect[] => [random(oppFollowers(), 1, "r"), damage(slot("r"), n)];
/** カウントを amount する（+で増やす・-で減らす。アミュレット・クレスト） */
const countdownOf = (target: Target, amount: number): Effect => ({ op: "countdown", target, amount });
/** 相手のターン終了まで、それは「フォロワーやリーダーを攻撃できない。」を持つ */
const noAttackUntilOppTurnEnd = (target: Target = slot()): Effect => ({
  op: "cannotAttack",
  target,
  until: "opponentTurnEnd",
});

// 武力と治安・ナハト・ナハト＆ヴィンセント（【超進化時】は【ファンファーレ】と同じ能力）
const nachtEffects: Effect[] = [summon("ナハトの私兵"), damage(oppFollowers(), 3)];
// 波濤の副船長（【進化時】は【ファンファーレ】と同じ能力）
const firstMateEffects: Effect[] = [...chooseDamage(3), summon(FLAG)];

// ---- 第10弾の共通部品 ----
const CLUE = "神域の物証";
const NEWSBOY = "無垢なる新聞売り";
/** 手札で働く。自分が証拠・アミュレットを【アクト】したとき、これの攻撃力と体力を入れ替える。これは+1/+0する */
const swapInHand = inHand(onEvidenceAct(swapStats(THIS), buff(THIS, 1, 0)));
// 変心の衛士（【超進化時】は【ファンファーレ】と同じ能力）
const turncoatEffects: Effect[] = [
  when(countAtLeast(allyAmulets(), 1), [choose(oppFollowers()), banish(slot())]),
];

export const ROYAL_ROT: Record<string, CardAbilities> = {
  // ---- 第4弾 ----
  [id("信念の蹴撃・ランドル")]: { abilities: [fanfare(when(ENHANCED, [grant(THIS, ["storm"])]))] },
  [id("決意の輝竜・アーサー")]: { abilities: [onEvolve(summon("迷夢の獅子・モルドレッド"))] },
  [id("迷夢の獅子・モルドレッド")]: { abilities: [onEvolve(summon("決意の輝竜・アーサー"))] },
  [id("氷心の覇王・アグロヴァル")]: { abilities: [fanfare(damage(oppFollowers(), 3))] },
  [id("真王の刃・黄金の騎士")]: {
    abilities: [fanfare(modeAll(ENHANCED, [superEvolveIt(THIS)], [damage(oppFollowers(), 4)], [heal(4)]))],
  },
  [id("リッター・シュナイト")]: {
    abilities: [
      spell(
        mode(
          [grantAttacks(leftmost(allyFollowers({ class: "royal" })), 2)],
          [buff(allyFollowers({ class: "royal" }), 1, 1), grant(allyFollowers({ class: "royal" }), ["barrier"])],
          [gainPp(2), gainEp(1)],
          [heal(6)],
        ),
      ),
    ],
  },
  [id("真紅と群青・ゼタ＆ベアトリクス")]: {
    abilities: [
      fanfare(
        summon("真紅と群青・ゼタ＆ベアトリクス", 1, "s"),
        when(ENHANCED, [grant(slot("s"), ["bane"]), grant(THIS, ["storm"])]),
      ),
    ],
  },
  [id("十天衆の頭目・シエテ")]: {
    abilities: [
      fanfare(
        // 【解放奥義】なら進化するのではなく超進化する（これ自身も含む）
        when(
          RELEASED_ULTIMATE,
          [superEvolveIt(allyFollowers({ notEvolved: true }))],
          [when(ULTIMATE, [evolveIt(allyFollowers({ notEvolved: true }))])],
        ),
      ),
    ],
  },

  // ---- 第5弾 ----
  [id("喜捨の名士")]: {
    abilities: [fanfare(choose(handCards()), discard(slot()), when(slotMatches("t", spellCard), [heal(6)], [heal(3)]))],
  },
  [id("煙管の美玉")]: {
    abilities: [
      fanfare(when(countAtLeast(handCards(spellCard), 2), [buff(THIS, 1, 1), grant(THIS, ["ward"])])),
      onEvolve(addToHand("輝く金貨")),
    ],
  },
  [id("麗金花の散財")]: {
    abilities: [spell(choose(handCards(spellCard)), discard(slot()), repeat(2, ...randomDamage(3)))],
  },
  [id("剽疾の武闘家")]: {
    abilities: [onDrawn(setCost(THIS, 3, "endOfTurn")), fanfare(draw(1), heal(3))],
  },
  [id("吉祥蛙")]: {
    abilities: [
      onTurnEnd(when(countAtLeast(handCards(spellCard), 2), [damage(oppFollowers(), 5)])),
      onEvolve(addToHand("輝く金貨", 2)),
    ],
  },
  [id("優しき援軍")]: { abilities: [spell(when(ENHANCED, [summon("ナイト", 4)], [summon("ナイト", 2)]))] },
  [id("不動の将校")]: {
    cannotAttack: true,
    abilities: [onTurnEnd(summon("スティールナイト")), onSuperEvolve(buff(otherAllyFollowers(), 3, 3))],
  },
  [id("栄耀なる麗金花")]: {
    abilities: [spell(when(ENHANCED, [addToHand("輝く金貨", 4)], [addToHand("輝く金貨", 2)]))],
  },
  [id("猛る《戦車》・オルオーン")]: {
    abilities: [
      onTurnEnd(
        when(
          THIS_EVOLVED,
          [repeat(3, random(union(otherFollowers(), SELF_LEADER, OPP_LEADER), 1, "r"), damage(slot("r"), 7))],
          [damage(oppFollowers(), 7)],
        ),
      ),
    ],
  },
  [id("麗金花・ウンケイ")]: {
    abilities: [
      fanfare(choose(oppFollowers()), banish(slot()), addToHand("輝く金貨")),
      onSuperEvolve(crest("麗金花・ウンケイ")),
    ],
  },

  // ---- 第6弾 ----
  [id("勇烈の兵士")]: { abilities: [fanfare(when(ENHANCED, [buff(THIS, 1, 1)]))] },
  [id("レイジーメイド")]: {
    abilities: [fanfare(choose(handCards()), returnToDeck(slot()), draw(2, royalFollower))],
  },
  [id("天剣授与")]: {
    abilities: [spell(summon("勇烈の兵士", 3, "s"), when(ENHANCED, [buff(slot("s"), 2, 2)]))],
  },
  [id("忠烈の近衛兵")]: {
    abilities: [fanfare(when(ENHANCED, [buff(THIS, 2, 2)])), onEvolve(...chooseDamage(3))],
  },
  [id("キャットネイビー")]: { abilities: [fanfare(destroy(oppFollowers({ defenseMax: 1 })))] },
  [id("威風の行軍")]: {
    abilities: [spell(crest("威風の行軍"), when(ENHANCED, [countdownOf(crestsOf("self", "威風の行軍"), 2)]))],
  },
  [id("苛烈の参謀")]: {
    abilities: [
      fanfare(choose(oppFollowers()), destroy(slot()), when(ENHANCED, [gainPp(3), addToHand("勇烈の兵士")])),
    ],
  },
  [id("凄烈の天剣")]: { abilities: [spell(modeAll(ENHANCED, [draw(1)], randomDamage(3)))] },
  [id("凄烈の剣王・ロードノエル四世")]: {
    abilities: [
      fanfare(
        summon("勇烈の兵士", 1, "a"),
        grant(slot("a"), ["bane"]),
        when(enhancedAtLeast(7), [summon("勇烈の兵士", 1, "b"), grant(slot("b"), ["drain"])]),
        when(enhancedAtLeast(8), [summon("勇烈の兵士", 1, "c"), grant(slot("c"), ["storm"])]),
      ),
      onSuperEvolve(buff(otherAllyFollowers(), 1, 1)),
    ],
  },
  [id("旧き天剣・イドメタ")]: {
    // 信仰: 自分がカードを【エンハンス】でプレイしたとき、信仰値を+1する
    faith: { abilities: [onEnhancePlay(addFaith(1))] },
    abilities: [
      fanfare(addToHand("天剣の深淵")),
      onEvolve(spendFaith(5, grantFaith(onEnhancePlay(buff(allyFollowers(), 1, 1))))),
    ],
  },

  // ---- 第7弾 ----
  [id("曲走の工兵")]: {
    abilities: [inHand(onAllySuperEvolve({ type: "follower" }, setCost(THIS, 1))), fanfare(...chooseDamage(3))],
  },
  [id("調伝の連絡兵")]: { abilities: [fanfare(summon("ナイト"), addToHand("スティールナイト"))] },
  [id("彼我の調律")]: {
    abilities: [spell(...chooseDamage(3), when(link(10), [noAttackUntilOppTurnEnd()]))],
  },
  [id("聴略の諜報兵")]: { abilities: [lastWords(summon("ナイト")), onEvolve(...chooseDamage(3))] },
  [id("斬奏の衛生兵")]: {
    abilities: [fanfare(draw(2), summon("ナイト", 2)), onEvolve(...chooseDamage(3))],
  },
  [id("無音の包囲")]: {
    abilities: [
      spell(
        when(
          link(10),
          [addToHandAs("スティールナイト", "h", 2), grant(slot("h"), ["rush"])],
          [addToHandAs("スティールナイト", "h", 1), grant(slot("h"), ["rush"])],
        ),
      ),
    ],
  },
  [id("響爪の分班長")]: {
    abilities: [
      // モードはプレイしたときに選ぶ（選ぶは他の効果より前）。ナイトを出してから選んだ能力が働くよう、各選択肢の先頭で出す
      fanfare(
        mode(
          [summon("ナイト", 3), buff(otherAllyFollowers(), 1, 0), grant(otherAllyFollowers(), ["rush"])],
          [summon("ナイト", 3), buff(otherAllyFollowers(), 0, 1), grant(otherAllyFollowers(), ["ward"])],
        ),
      ),
    ],
  },
  [id("静粛齎す抜刀")]: {
    abilities: [spell(...chooseDamage(6), when(link(10), [damage(oppFollowers(), count(allyFollowers()))]))],
  },
  [id("統音のアナテマ・ギルダリア")]: {
    abilities: [
      fanfare(when(link(20), [crest("統音のアナテマ・ギルダリア"), evolveIt(THIS)])),
      onAllyEnter({ type: "follower" }, when(OWN_TURN, [grant(EVENT, ["rush"])])),
      onEvolved(summon("スティールナイト", 2)),
    ],
  },
  [id("寛厳の音帥・セザール")]: {
    abilities: [
      fanfare(
        summon("スティールナイト", 2),
        buff(otherAllyFollowers({ class: "royal" }), 1, 3),
        grant(otherAllyFollowers({ class: "royal" }), ["ward"]),
      ),
      onSuperEvolve(choose(oppFollowers()), destroy(slot())),
    ],
  },

  // ---- 第8弾 ----
  [id("武力と治安・ナハト・ナハト＆ヴィンセント")]: {
    abilities: [fanfare(...nachtEffects), onSuperEvolve(...nachtEffects)],
  },
  [id("寡黙なアサシン・シャイリィ")]: {
    abilities: [onEvolve(choose(oppFollowers()), noAttackUntilOppTurnEnd())],
  },
  [id("悠久の騎士・サーシャ")]: {
    abilities: [
      fanfare(summon("スティールナイト", 1, "s"), grant(slot("s"), ["rush"])),
      onEvolve(summon("スティールナイト", 1, "s"), grant(slot("s"), ["ward"])),
    ],
  },
  [id("ジェイルブレイク・カッツェ")]: {
    abilities: [oncePerOwnTurn(onAllyPlay(spellCard, ...randomDamage(2))), onEvolve(addToHand("輝く金貨"))],
  },
  [id("織田信長")]: { abilities: [fanfare(damage(oppFollowers(), 6))] },
  [id("リライブリライフ")]: {
    abilities: [
      spell(
        random({ kind: "maxAttack", of: oppFollowers() }, 1, "r"),
        buff(slot("r"), -10, -10),
        when(ENHANCED, [summon("異形", 3)]),
      ),
    ],
  },
  [id("沖田総司")]: {
    abilities: [
      fanfare(when(SUPER_EVOLVE_TURN, [evolveIt(THIS)])),
      onAttack(
        when({ kind: "attackingFollower" }, [when(THIS_EVOLVED, [repeat(3, damage(EVENT, 3))], [damage(EVENT, 3)])]),
      ),
    ],
  },
  [id("二等分の日常")]: {
    abilities: [spell(modeAll(countAtLeast(allyCards(), 2), randomDamage(4), [heal(2)]))],
  },
  [id("天命の弾丸・バニー＆バロン")]: {
    abilities: [
      fanfare(summon("天命の弾丸・バニー＆バロン"), when(link(20), [damage(OPP_LEADER, 4)])),
      onEvolve(addToHand("デスペラードショット")),
    ],
  },
  [id("焦がれし炎将・マーズ")]: {
    abilities: [
      fanfare(summon("ナイト", 3)),
      onAllyEnter({ type: "follower", tribe: "兵士" }, buff(EVENT, 2, 0), grant(EVENT, ["rush"]), buff(THIS, 1, 0)),
      onSuperEvolve(summon("ナイト")),
    ],
  },

  // ---- 第9弾 ----
  [id("海域の斥候")]: { abilities: [fanfare(summon(FLAG)), onEvolve(addToHand("黄金の靴"))] },
  [id("ファランクス")]: {
    abilities: [
      spell(
        when(
          ENHANCED,
          [summon("スティールナイト", 5, "s"), grant(slot("s"), ["ward"])],
          [summon("スティールナイト", 1, "s"), grant(slot("s"), ["ward"])],
        ),
      ),
    ],
  },
  [id("渦潮の砲手")]: { abilities: [fanfare(summon(FLAG), addToHand("黄金の杯"))] },
  [id("獰猛なる指揮官")]: {
    abilities: [
      fanfare(
        summon("スティールナイト", 2, "s"),
        when(ENHANCED, [buff(union(slot("s"), THIS), 3, 0), grant(union(slot("s"), THIS), ["rush"])]),
      ),
    ],
  },
  [id("燃え落ちる縁")]: {
    abilities: [
      spell(
        ...chooseDamage(5),
        // 「これのコストが3なら」はプレイしたときのコスト。加えたもの（コスト1）からは続かない
        when({ kind: "thisCostEq", value: 3 }, [addToHandAs("燃え落ちる縁", "h"), setCost(slot("h"), 1)]),
      ),
    ],
  },
  [id("波濤の副船長")]: {
    abilities: [
      fanfare(...firstMateEffects),
      onEvolve(...firstMateEffects),
      onSuperEvolve(
        addToHandAs("黄金の小剣", "a"),
        addToHandAs("黄金の首飾り", "b"),
        setCost(union(slot("a"), slot("b")), 0),
      ),
    ],
  },
  [id("アージュドール")]: {
    abilities: [
      spell(when(ENHANCED, [summon(FLAG, 2), damage(oppFollowers(), 4)], [summon(FLAG, 1), damage(oppFollowers(), 2)])),
    ],
  },
  [id("逆行の咎人・バルバロス")]: {
    abilities: [fanfare(summon(FLAG), countdownOf(allyAmulets({ ids: [id(FLAG)] }), -5))],
  },

  // ---- 第10弾「ニーゲルヘリア神殺事件」 ----
  [id("ノー・ライフの問答")]: {
    abilities: [spell(summon(CLUE), when(actedThisTurn(true), [summon(NEWSBOY)]))],
  },
  [id(NEWSBOY)]: {
    // 「これのコピー」は同名のカード（手札で入れ替え・+1/+0 した攻撃力・体力は写さない）
    abilities: [swapInHand, fanfare(when(ENHANCED, [copy(FROM_THIS, 1, "board")])), lastWords(summon(CLUE))],
  },
  [id("表裏の現場検証")]: {
    abilities: [spell(choose(oppFollowers()), when(actedThisTurn(true), [damage(slot(), 10)], [damage(slot(), 5)]))],
  },
  [id("チーキーデザイナー")]: {
    abilities: [
      swapInHand,
      // X はプレイしたとき（場に出た後）のこれの攻撃力（手札で入れ替え・+1/+0 したものを含む）
      fanfare(choose(oppFollowers()), damage(slot(), THIS_ATTACK), summon(CLUE)),
      onEvolve(summon(NEWSBOY)),
    ],
  },
  [id("千金の大参謀・アルメリゼ")]: {
    abilities: [
      fanfare(addToHand("輝く金貨")),
      onEvolve(crest("千金の大参謀・アルメリゼ")),
      // 超進化では【進化時】（クレストを持つ）の後に働く
      onSuperEvolve(countdownOf(crestsOf("self", "千金の大参謀・アルメリゼ"), 2)),
    ],
  },
  [id("ジュエルレディー")]: {
    abilities: [
      fanfare(addToHand("黄金の首飾り")),
      oncePerOwnTurn(onAllyPlay(spellCard, damage(union(oppFollowers(), OPP_LEADER), 2))),
    ],
  },
  [id("安穏の好事家")]: {
    abilities: [
      swapInHand,
      // X/Y はプレイしたとき（場に出た後）のこれの攻撃力/体力
      fanfare(summon(NEWSBOY, 2, "s"), setStats(slot("s"), THIS_ATTACK, THIS_DEFENSE)),
      onEvolve(grant(otherAllyFollowers(), ["bane"])),
    ],
  },
  [id("突撃の号令")]: {
    abilities: [spell(summon("スティールナイト", 2, "s"), evolveIt(slot("s")), grant(slot("s"), ["barrier"]))],
  },
  [id("変心の衛士")]: {
    // 「自分の場にアミュレットがあるなら」は証拠・アミュレットを含む
    abilities: [fanfare(...turncoatEffects), onSuperEvolve(...turncoatEffects)],
  },
  [id("表裏探偵・ノー・ライフ")]: {
    abilities: [
      swapInHand,
      // 「これのコピー」は同名のカード（元の 5/6）。比べるのはコピーを出した後のこれ（場に出た後）の攻撃力と体力。
      // 等しいならどちらも働かない
      fanfare(
        copy(FROM_THIS, 1, "board", { slot: "c" }),
        when(valueAtLeast(sub(THIS_DEFENSE, THIS_ATTACK), 1), [grant(slot("c"), ["bane"]), grant(THIS, ["drain"])]),
        when(valueAtLeast(sub(THIS_ATTACK, THIS_DEFENSE), 1), [grant(slot("c"), ["ward"]), grant(THIS, ["storm"])]),
      ),
    ],
  },

  // ---- トークン ----
  [id("戦慄の海賊旗")]: {
    abilities: [onAllyPlay(spellCard, countdownOf(THIS, -1)), lastWords(damage(OPP_LEADER, 2))],
  },
  [id("黄金の小剣")]: { abilities: [spell(choose(union(oppFollowers(), OPP_LEADER)), damage(slot(), 1))] },
  [id("黄金の杯")]: { abilities: [spell(heal(2))] },
  [id("黄金の靴")]: { abilities: [spell(choose(allyFollowers()), buff(slot(), 1, 0), grant(slot(), ["rush"]))] },
  [id("黄金の首飾り")]: { abilities: [spell(choose(allyFollowers()), buff(slot(), 0, 1), grant(slot(), ["ward"]))] },
  [id("輝く金貨")]: { abilities: [spell(mode([draw(1)], randomDamage(2)))] },
  [id("天剣の深淵")]: {
    abilities: [spell(choose(oppFollowers()), when(ENHANCED, [damage(slot(), 3)], [damage(slot(), 1)]))],
  },
  [id("デスペラードショット")]: { abilities: [spell(repeat(2, ...randomDamage(4)))] },
};

/** このクラスのカードが与えるクレストの能力（キーは crestIdOf("カード名")） */
export const ROYAL_ROT_CRESTS: Record<string, CardAbilities> = {
  [crestIdOf("麗金花・ウンケイ")]: { abilities: [onTurnEnd(addToHand("輝く金貨"))] },
  [crestIdOf("威風の行軍")]: { abilities: [onEnhancePlay(summon("勇烈の兵士"))] },
  [crestIdOf("統音のアナテマ・ギルダリア")]: {
    abilities: [onAllyEnter({ type: "follower" }, when(OWN_TURN, [damage(OPP_LEADER, 1)]))],
  },
  // ---- 第10弾「ニーゲルヘリア神殺事件」 ----
  // 【カウントダウン_2】（初期値は crests.json から）。自分のターン終了時、下記の能力から順に1つ
  [crestIdOf("千金の大参謀・アルメリゼ")]: {
    abilities: [
      onTurnEnd(
        cycleEffects(
          [addToHandAs("黄金の小剣", "h"), setCost(slot("h"), 0)],
          [addToHandAs("黄金の杯", "h"), setCost(slot("h"), 0)],
        ),
      ),
    ],
  },
};
