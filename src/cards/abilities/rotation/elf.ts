// ローテーションのカード能力（elf。トークン・クレスト含む）。書き方は docs/rotation-authoring.md

import type { CardAbilities, Effect, Target } from "../../../engine/dsl";
import {
  COMBO,
  ENHANCED,
  EVENT,
  FROM_THIS,
  OPP_LEADER,
  RELEASED_ULTIMATE,
  SELF_LEADER,
  THIS,
  THIS_ATTACK,
  ULTIMATE,
  addFaith,
  addToHand,
  addToHandAs,
  allyFollowers,
  bounce,
  buff,
  choose,
  combo,
  copy,
  costChange,
  costChangeTemp,
  count,
  countAtLeast,
  crest,
  crestIdOf,
  damage,
  deckCards,
  destroy,
  discard,
  distribute,
  draw,
  evolveIt,
  fanfare,
  fromZone,
  gainEp,
  gainPp,
  grant,
  grantFaith,
  handCards,
  heal,
  id,
  inHand,
  lastWords,
  mode,
  modeAll,
  moveToBoard,
  onAllyEnter,
  onAllyEvolve,
  onAllyPlay,
  onAttack,
  onBuffed,
  onEnemyEnter,
  onEvolve,
  onEvolved,
  onSuperEvolve,
  onTurnEnd,
  oncePerOwnTurn,
  oppFollowers,
  otherAllyFollowers,
  random,
  repeat,
  returnToDeck,
  slot,
  spell,
  spendFaith,
  sub,
  summon,
  union,
  when,
} from "../helpers";

/** 自分の【コンボ】を+1する */
const addCombo1: Effect = { op: "addCombo", amount: 1 };
/** 相手の場の攻撃力最大のフォロワー */
const oppMaxAttack: Target = { kind: "maxAttack", of: oppFollowers() };

// 【進化時】【ファンファーレ】と同じ能力が働くカードの効果
const hagoitaFx = [summon("フェアリー")];
const sendoFx = [summon("フェアリー", 3)];
const mirokuFx = [mode([addToHand("フェアリー", 2)], [gainPp(2)], [distribute(oppFollowers(), 3)])];
const saihaishaFx = [choose(oppFollowers()), damage(slot(), 4), addCombo1];
const citrusFx = [summon("フェアリー", 2)];
const spaMonkeyFx = [copy(fromZone("hand", "opponent", "random"), 1, "hand", { hidden: true })];

export const ELF_ROT: Record<string, CardAbilities> = {
  // ---- 第4弾 ----
  [id("愛憎の舞手・コウ＆ヨウ")]: { abilities: [onAttack(heal(3, union(allyFollowers(), SELF_LEADER)))] },
  [id("カワイイ花マル・マナマル")]: {
    abilities: [onTurnEnd(evolveIt()), onEvolved(damage(oppFollowers(), 1))],
  },
  [id("箒星")]: {
    abilities: [
      spell(
        choose(oppFollowers()),
        damage(slot(), 4),
        when(countAtLeast(allyFollowers({ evolved: true }), 1), [draw(1)]),
      ),
    ],
  },
  [id("美粧の乙女・クロエ")]: {
    abilities: [
      fanfare(when(ENHANCED, [choose(handCards({ type: "follower" })), moveToBoard(slot()), bounce(THIS)])),
    ],
  },
  [id("緋焔の踊り子・アンスリア")]: { abilities: [fanfare(grant(allyFollowers(), ["barrier"]))] },
  [id("綺羅星")]: {
    abilities: [spell(random(oppFollowers()), damage(slot(), 2), when(combo(5), [crest("綺羅星")]))],
  },
  [id("虹色の弓使い・クピタン")]: {
    abilities: [
      fanfare(when(ULTIMATE, [evolveIt()]), when(RELEASED_ULTIMATE, [damage(OPP_LEADER, 3)])),
      onEvolved(repeat(7, random(oppFollowers()), damage(slot(), 1))),
    ],
  },
  [id("アルフヘイム")]: {
    abilities: [
      spell(
        modeAll(
          RELEASED_ULTIMATE,
          [draw(1), heal(1)],
          [buff(allyFollowers(), 1, 0), grant(allyFollowers(), ["rush"])],
          [buff(allyFollowers(), 0, 1), grant(allyFollowers(), ["ward"])],
        ),
      ),
    ],
  },
  [id("風の理・イーウィヤ")]: { abilities: [fanfare(when(ULTIMATE, [gainEp(1)]))] },
  [id("調和の舞手・ユエル＆ソシエ")]: {
    abilities: [
      fanfare(repeat(2, random(oppFollowers()), damage(slot(), 4))),
      onSuperEvolve(crest("調和の舞手・ユエル＆ソシエ")),
    ],
  },

  // ---- 第5弾 ----
  [id("賢慮の狸")]: { abilities: [onEvolve(draw(1))] },
  [id("森羽子板の匠")]: {
    abilities: [
      fanfare(...hagoitaFx),
      onAllyEnter({ type: "follower", tribe: "妖精" }, damage(OPP_LEADER, 1)),
      onEvolve(...hagoitaFx),
    ],
  },
  [id("虫風花の飛翔")]: { abilities: [spell(distribute(oppFollowers(), 3), addToHand("フェアリー"))] },
  [id("バディングバディーズ")]: {
    abilities: [
      fanfare(when(combo(5), [summon("バディングバディーズ", 1, "s"), evolveIt(slot("s")), evolveIt(THIS)])),
    ],
  },
  [id("静かなる応援")]: {
    abilities: [
      spell(
        when(
          combo(3),
          [damage(union(oppFollowers(), OPP_LEADER), 2)],
          [damage(union(oppFollowers(), OPP_LEADER), 1)],
        ),
      ),
    ],
  },
  [id("導きの船頭")]: {
    abilities: [
      fanfare(...sendoFx),
      onEvolve(...sendoFx),
      onSuperEvolve(grant(allyFollowers({ tribe: "妖精" }), ["bane"])),
    ],
  },
  // X は自分の【コンボ】（これのプレイを含む）
  [id("優雅なる虫風花")]: { abilities: [spell(draw(COMBO))] },
  [id("天踏む《吊るされた男》・ローフラッド")]: {
    abilities: [
      fanfare(buff(THIS, COMBO, COMBO)),
      onEvolve(discard(handCards()), copy(fromZone("deck", "opponent", "random"), 5, "hand", { hidden: true })),
    ],
  },
  [id("虫風花・ミロク")]: { abilities: [fanfare(...mirokuFx), onEvolve(...mirokuFx)] },

  // ---- 第6弾 ----
  [id("慈育の森人")]: {
    abilities: [fanfare(addToHand("新緑のフェアリー")), onEvolve(summon("新緑のフェアリー"))],
  },
  [id("パラダイスモンキー")]: { abilities: [fanfare(when(combo(3), [evolveIt()]))] },
  [id("天槍授与")]: { abilities: [spell(damage(oppFollowers(), 4), summon("新緑のフェアリー", 2))] },
  [id("慈顔の担い手")]: { abilities: [fanfare(addToHand("新緑のフェアリー"))] },
  [id("大輪への献上")]: {
    abilities: [inHand(onAllyEvolve({ type: "follower" }, costChange(THIS, -1))), spell(draw(2))],
  },
  [id("慈恵の側近")]: {
    abilities: [fanfare(summon("新緑のフェアリー")), onAllyEvolve({ type: "follower" }, heal(1))],
  },
  [id("慈愛の天槍")]: {
    abilities: [spell(mode([random(oppMaxAttack), destroy(slot())], [summon("新緑のフェアリー")]))],
  },
  [id("慈愛の凛華・オルテニア")]: {
    abilities: [fanfare(summon("新緑のフェアリー", 3)), onSuperEvolve(choose(oppFollowers()), destroy(slot()))],
  },
  [id("旧き天槍・ササニド")]: {
    abilities: [
      fanfare(
        spendFaith(
          10,
          addToHand("天槍の深淵"),
          grantFaith(onAllyEvolve({ type: "follower" }, damage(OPP_LEADER, 1))),
        ),
      ),
    ],
    faith: { abilities: [onAllyEvolve({ type: "follower" }, addFaith(1))] },
  },

  // ---- 第7弾 ----
  [id("グロースベア")]: { abilities: [fanfare(copy(FROM_THIS, 1, "board"))], damageCap: { atLeast: 4, to: 3 } },
  [id("エルフトラッパー")]: {
    abilities: [fanfare(choose(handCards()), returnToDeck(slot()), addToHand("フェアリー", 2))],
  },
  [id("マインドシフト")]: { abilities: [spell(choose(handCards(), 2), returnToDeck(slot()), draw(2))] },
  [id("緑風のレイピア使い")]: { abilities: [fanfare(when(combo(3), [grant(THIS, ["storm"])]))] },
  [id("弓兵の采配者")]: { abilities: [fanfare(...saihaishaFx), onEvolve(...saihaishaFx)] },
  [id("憂慮の縮小")]: { abilities: [spell(heal(1), when(combo(3), [crest("憂慮の縮小")]))] },
  [id("凍矢の射手")]: {
    abilities: [
      fanfare(choose(oppFollowers()), damage(slot(), THIS_ATTACK)),
      onTurnEnd(when(combo(3), [draw(1)])),
    ],
  },
  [id("害意の拡大")]: {
    abilities: [spell(random(oppFollowers()), damage(slot(), 2), when(combo(3), [crest("害意の拡大")]))],
  },
  [id("操嵩のアナテマ・ダストデイズ")]: {
    abilities: [
      fanfare(choose(oppFollowers()), buff(slot(), 0, sub(0, THIS_ATTACK)), addCombo1),
      onEvolve(crest("操嵩のアナテマ・ダストデイズ")),
    ],
  },
  [id("氷界の鹿王")]: {
    abilities: [
      fanfare(addToHand("森の神秘", 2)),
      onTurnEnd(distribute(oppFollowers(), THIS_ATTACK)),
      onSuperEvolve(crest("氷界の鹿王")),
    ],
  },

  // ---- 第8弾 ----
  // X = 相手の場のフォロワーの枚数 - 自分の場のフォロワーの枚数（これを含む）。0以下なら何も破壊しない
  [id("昔日の天秤・マーロン")]: {
    abilities: [
      fanfare(
        { op: "random", slot: "t", from: oppFollowers(), count: sub(count(oppFollowers()), count(allyFollowers())) },
        destroy(slot()),
      ),
    ],
  },
  [id("ヘレティックハーミット・シトラス")]: { abilities: [fanfare(...citrusFx), onEvolve(...citrusFx)] },
  [id("グルーミーガール・モエル")]: { abilities: [fanfare(choose(handCards()), returnToDeck(slot()), draw(1))] },
  [id("太古の妖精・ルフレ")]: {
    abilities: [oncePerOwnTurn(onBuffed(summon("フェアリー"))), lastWords(addToHand("フェアリー"))],
  },
  [id("情念の毒茨・リコリス")]: { abilities: [fanfare(summon("優しき読心者・ミツェル"))] },
  [id("穏やかなる孤独")]: { abilities: [spell(choose(oppFollowers()), destroy(slot()), heal(2))] },
  [id("優しき読心者・ミツェル")]: {
    abilities: [fanfare(summon("情念の毒茨・リコリス"), grant(allyFollowers(), ["barrier"]))],
  },
  [id("水鏡の信頼")]: {
    abilities: [
      spell({ op: "summonFromDeck", filter: { type: "follower", costMax: 2 }, kinds: 2 }, buff(allyFollowers(), 1, 1)),
    ],
  },
  [id("離合の有終・セタス＆メイシア")]: {
    abilities: [fanfare(choose(oppFollowers()), destroy(slot()), buff(otherAllyFollowers(), 1, 1))],
  },
  [id("エターナルクリスタリア・ティア")]: {
    abilities: [
      fanfare(when(ENHANCED, [buff(allyFollowers(), 1, 1)])),
      oncePerOwnTurn(onBuffed(addToHand("ソードクリスタリア・イヴ"))),
    ],
  },

  // ---- 第9弾 ----
  [id("発芽の組員")]: { abilities: [fanfare(when(combo(3), [draw(1)]))] },
  [id("森林の罠")]: { abilities: [onEnemyEnter({ type: "follower" }, destroy(EVENT), destroy(THIS))] },
  [id("根差の刺客")]: {
    abilities: [fanfare(addToHandAs("フェアリー", "h"), when(combo(3), [grant(slot("h"), ["bane"])]))],
  },
  [id("スパリゾートモンキー")]: { abilities: [fanfare(...spaMonkeyFx), onEvolve(...spaMonkeyFx)] },
  [id("緑傘会の二枚看板")]: {
    abilities: [
      spell(
        modeAll(
          combo(3),
          [random(oppFollowers()), damage(slot(), 4)],
          [addToHand("森の神秘"), addToHand("フェアリー")],
        ),
      ),
    ],
  },
  [id("枝葉の舎弟頭")]: {
    abilities: [
      fanfare(when(combo(3), [draw(2)])),
      onEvolve(choose(otherAllyFollowers()), buff(slot(), 1, 1), grant(slot(), ["rush"])),
    ],
  },
  [id("緋岸橙酔")]: {
    abilities: [
      inHand(onTurnEnd(when(combo(3), [costChange(THIS, -1)]))),
      spell(choose(oppFollowers()), destroy(slot()), draw(1)),
    ],
  },
  [id("煙管の咎人・マガチヨ")]: {
    abilities: [
      fanfare(when(combo(3), [damage(oppFollowers(), 4)], [choose(oppFollowers()), damage(slot(), 4)])),
      onSuperEvolve(grant(THIS, ["storm"])),
    ],
  },
  [id("香風の変貌・ヒエン")]: {
    abilities: [
      inHand(onAllyPlay({}, costChangeTemp(THIS, -1))),
      fanfare(choose(oppFollowers()), damage(slot(), 4)),
      lastWords(summon("香風の変貌・ヒエン")),
    ],
  },

  // ---- トークン ----
  [id("新緑のフェアリー")]: { abilities: [onTurnEnd(evolveIt())] },
  [id("天槍の深淵")]: { abilities: [spell(choose(allyFollowers({ notEvolved: true })), evolveIt(slot()))] },
};

/** このクラスのカードが与えるクレストの能力（キーは crestIdOf("カード名")） */
export const ELF_ROT_CRESTS: Record<string, CardAbilities> = {
  [crestIdOf("綺羅星")]: { abilities: [lastWords(damage(OPP_LEADER, 1), addToHand("綺羅星"))] },
  [crestIdOf("調和の舞手・ユエル＆ソシエ")]: {
    abilities: [oncePerOwnTurn(onAllyPlay({ type: "follower" }, evolveIt(EVENT)))],
  },
  [crestIdOf("憂慮の縮小")]: { abilities: [lastWords(addToHand("害意の拡大"))] },
  [crestIdOf("害意の拡大")]: { abilities: [lastWords(addToHand("憂慮の縮小"))] },
  [crestIdOf("操嵩のアナテマ・ダストデイズ")]: {
    abilities: [onTurnEnd(when(combo(3), [buff(deckCards({ type: "follower" }), 1, 1)]))],
  },
  [crestIdOf("氷界の鹿王")]: { abilities: [onTurnEnd(when(combo(3), [addToHand("森の神秘")]))] },
};
