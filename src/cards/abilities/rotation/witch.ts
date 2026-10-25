// ローテーションのカード能力（witch。トークン・クレスト含む）。書き方は docs/rotation-authoring.md

import type { Ability, CardAbilities, Effect } from "../../../engine/dsl";
import {
  ENHANCED,
  EVENT,
  FAITH,
  OPP_LEADER,
  RELEASED_ULTIMATE,
  SELF_LEADER,
  SIGILS,
  THIS,
  THIS_ATTACK,
  THIS_X,
  ULTIMATE,
  addFaith,
  addSigils,
  addToDeck,
  addToHand,
  addToHandAs,
  allFollowers,
  allyFollowers,
  buff,
  choose,
  costChange,
  crest,
  crestIdOf,
  crestsOf,
  damage,
  destroy,
  discard,
  distribute,
  draw,
  earthRite,
  enteredCount,
  evolveIt,
  fanfare,
  fromZone,
  gainPp,
  grant,
  grantAttacks,
  grantNoAttack,
  handCards,
  heal,
  id,
  inHand,
  lastWords,
  mode,
  modeAll,
  onAllyAttack,
  onAllyEnter,
  onAllyPlay,
  onEarthRite,
  onEnter,
  onEvolve,
  onFused,
  onOpponentTurnEnd,
  onSpellboost,
  onSuperEvolve,
  onTurnEnd,
  onTurnStart,
  oncePerOwnTurn,
  opponentDraws,
  oppFollowers,
  otherAllyFollowers,
  otherFollowers,
  payPp,
  random,
  randomEffects,
  repeat,
  rid,
  silence,
  slot,
  spell,
  spellboost,
  splitRandom,
  summon,
  transform,
  transformFrom,
  union,
  v,
  valueAtLeast,
  when,
} from "../helpers";

/** 【スペルブースト時】これのXを+1する */
const addX: Effect = { op: "addX", target: THIS, amount: 1 };
/** 【スペルブースト時】これのコストを-1する */
const cheaper = onSpellboost(costChange(THIS, -1));
const thisXAtLeast = (value: number) => ({ kind: "thisXAtLeast", value }) as const;
const FUSED = { kind: "fused" } as const;

const MANO = { ids: [id("天晶の魔手")] };
const SUBJECT = { ids: [id("没入の実験体")] };
/** 「自分の『天晶の魔手』が場に出たとき、信仰値を+1する。」（旧き天晶・カルギデンスラ・天晶の深淵の信仰） */
const manoFaith = { abilities: [onAllyEnter(MANO, addFaith(1))] };
/** 手札で働く。自分が【土の秘術】したとき、これのコストを-1する。 */
const cheaperOnEarthRite: Ability = inHand(onEarthRite(costChange(THIS, -1)));

/**
 * 【土の秘術_N】【モード】…: モードは先に選ぶ（docs/rules.md 11章）ので、土の印が足りるときだけモードを選び、
 * 選んだ能力の中で土の秘術する（足りなければ選ばず何もしない）
 */
const earthRiteMode = (n: number, ...options: Effect[][]): Effect =>
  when(valueAtLeast(SIGILS, n), [mode(...options.map((o) => [earthRite(n, ...o)]))]);

// 【進化時】【ファンファーレ】と同じ能力が働く
const littleBeast: Effect[] = [choose(oppFollowers()), damage(slot(), 1), addSigils(1)];
const greenJoy: Effect[] = [choose(oppFollowers()), damage(slot(), 1), spellboost(handCards(), 1)];
const sweetEntity: Effect[] = [earthRiteMode(1, [damage(oppFollowers(), 3)], [draw(2)])];

export const WITCH_ROT: Record<string, CardAbilities> = {
  // ---- 第4弾 ----
  [id("不可思議な哲学者・フィラソピラ")]: { abilities: [fanfare(draw(1, { type: "spell" }))] },
  [id("さすらいの家庭教師・スフラマール")]: {
    // X回スペルブースト（X はこれの攻撃力）は「1回スペルブースト」を X 回繰り返す
    abilities: [onTurnEnd(repeat(THIS_ATTACK, spellboost(handCards(), 1))), onEvolve(grantNoAttack(THIS))],
  },
  [id("ルーン・リチュオル")]: { abilities: [spell(damage(oppFollowers(), 6), heal(3))] },
  [id("復讐の占師・エゼクレイン")]: {
    abilities: [fanfare(choose(oppFollowers(), 2), damage(slot(), 4), addSigils(2))],
  },
  [id("辛苦の旅路・ミレイユ＆リゼット")]: {
    abilities: [
      fanfare(summon("辛苦の旅路・ミレイユ＆リゼット", 1, "s"), earthRite(2, evolveIt(slot("s")), evolveIt(THIS))),
    ],
  },
  [id("アンリーシュ")]: {
    abilities: [
      spell(
        mode(
          [draw(1), random(oppFollowers(), 1, "r"), damage(slot("r"), 4)],
          [draw(2), random(oppFollowers(), 2, "r"), damage(slot("r"), 4), damage(SELF_LEADER, 2)],
        ),
      ),
    ],
  },
  [id("懐旧の送り火・エルモート")]: {
    abilities: [
      fanfare(choose(oppFollowers()), silence(slot()), damage(slot(), 3)),
      onSuperEvolve(crest("懐旧の送り火・エルモート")),
    ],
  },
  [id("アルケミック・フレア")]: {
    abilities: [spell(choose(oppFollowers()), damage(slot(), 4), addSigils(1), when(ULTIMATE, [damage(OPP_LEADER, 2)]))],
  },
  [id("水の理・ワムデュス")]: {
    abilities: [
      onSpellboost(buff(THIS, 1, 1)),
      fanfare(spellboost(handCards(), 1)),
      onSuperEvolve(mode([grant(otherAllyFollowers(), ["barrier"])], [distribute(oppFollowers(), THIS_ATTACK)])),
    ],
  },
  [id("天才美少女錬金術師・カリオストロ")]: {
    abilities: [
      fanfare(
        addSigils(2),
        addToHand("アルス・マグナ"),
        when(ULTIMATE, [evolveIt()]),
        when(RELEASED_ULTIMATE, [crest("天才美少女錬金術師・カリオストロ")]),
      ),
    ],
  },

  // ---- 第5弾 ----
  [id("シェイプウィザード")]: {
    abilities: [fanfare(addSigils(2)), onSuperEvolve(summon("ガーディアンゴーレム", 2))],
  },
  [id("流動の符操師")]: {
    abilities: [fanfare(random(oppFollowers(), 3, "r"), damage(slot("r"), 3), spellboost(handCards(), 3))],
  },
  [id("明越花の転変")]: { abilities: [spell(choose(handCards()), discard(slot()), draw(2))] },
  [id("インソムニアウィッチ")]: {
    abilities: [fanfare(crest("インソムニアウィッチ")), onEvolve(destroy(crestsOf("self", "インソムニアウィッチ")))],
  },
  [id("余情の俳人")]: {
    abilities: [cheaper, fanfare(draw(1)), lastWords(spellboost(handCards(), 1))],
  },
  [id("キティトリック")]: {
    abilities: [spell(earthRite(2, randomEffects(2, [summon("クレイゴーレム")], [heal(2)], [addSigils(3)])))],
  },
  [id("エレメンタルガバナー")]: {
    abilities: [
      fanfare(summon("ガーディアンゴーレム", 2)),
      onAllyEnter({ type: "follower", tribe: "ゴーレム" }, earthRite(1, evolveIt(EVENT))),
    ],
  },
  [id("壮美なる明越花")]: {
    abilities: [spell(transformFrom(allyFollowers(), fromZone("deck", "self", "random", { type: "follower" })))],
  },
  [id("歩む《愚者》・リンクル")]: {
    abilities: [fanfare(crest("歩む《愚者》・リンクル")), onSuperEvolve(addToDeck("歩む《愚者》・リンクル", 10))],
  },
  [id("明越花・アラ")]: {
    abilities: [
      cheaper,
      fanfare(choose(oppFollowers()), damage(slot(), 10)),
      onEvolve(choose(otherFollowers()), transform(slot(), "壮麗なる隼")),
    ],
  },

  // ---- 第6弾 ----
  [id("空想の司書")]: {
    abilities: [fanfare(summon("キャラバンマンモス")), onSuperEvolve(grant(otherAllyFollowers(), ["rush"]))],
  },
  [id("天晶授与")]: { abilities: [spell(summon("天晶の魔手", 2))] },
  [id("魔境の生徒")]: {
    abilities: [fanfare(summon("天晶の魔手", 2)), onAllyEnter(MANO, heal(1))],
  },
  [id("ベンチャーグリモワール")]: {
    abilities: [
      fanfare(when(ENHANCED, [summon("ベンチャーグリモワール", 2)])),
      lastWords(spellboost(handCards(), 1)),
    ],
  },
  [id("正常の侵食")]: {
    abilities: [spell(choose(allyFollowers(MANO)), destroy(slot()), draw(2))],
  },
  [id("魔酔の教師")]: {
    abilities: [fanfare(summon("天晶の魔手", 2)), onEvolve(buff(allyFollowers(MANO), 1, 0))],
  },
  [id("魔恋の天晶")]: {
    abilities: [
      spell(
        modeAll(
          ENHANCED,
          [summon("天晶の魔手", 1, "a"), buff(slot("a"), 1, 0), grant(slot("a"), ["storm"])],
          [summon("天晶の魔手", 2, "b"), buff(slot("b"), 1, 0)],
        ),
      ),
    ],
  },
  [id("魔恋の慕情・シイム")]: {
    abilities: [fanfare(summon("天晶の魔手", 2)), onSuperEvolve(crest("魔恋の慕情・シイム"))],
  },
  [id("旧き天晶・カルギデンスラ")]: {
    abilities: [
      inHand(onAllyEnter(MANO, costChange(THIS, -1))),
      fanfare(summon("天晶の魔手", 2, "s"), grant(slot("s"), ["storm"])),
      onEvolve(addToHand("天晶の深淵")),
    ],
    faith: manoFaith,
  },

  // ---- 第7弾 ----
  [id("ディンキークリーチャー")]: { abilities: [fanfare(earthRite(1, evolveIt()))] },
  [id("リトルビースト")]: { abilities: [fanfare(...littleBeast), onEvolve(...littleBeast)] },
  [id("スレイヴコール")]: { abilities: [cheaperOnEarthRite, spell(draw(2), addSigils(1))] },
  [id("チャーミングモンスター")]: {
    abilities: [lastWords(addSigils(2)), onSuperEvolve(earthRite(2, summon("チャーミングモンスター", 2)))],
  },
  [id("プリティープレデター")]: { abilities: [fanfare(addSigils(2))] },
  [id("暴食の間食")]: {
    abilities: [spell(mode([addSigils(4)], [earthRite(2, damage(oppFollowers(), 2))]))],
  },
  [id("スウィートエンティティ")]: { abilities: [fanfare(...sweetEntity), onEvolve(...sweetEntity)] },
  [id("グラトンスペル")]: {
    abilities: [cheaperOnEarthRite, spell(choose(oppFollowers()), destroy(slot()), addSigils(2))],
  },
  [id("万食のアナテマ・ララアンセム")]: {
    abilities: [
      fanfare(earthRite(1, crest("万食のアナテマ・ララアンセム"))),
      // 選ぶのは土の秘術より先。土の印があれば、選べる相手のフォロワーがいなくても土の秘術する（推定）
      onEvolve(when(valueAtLeast(SIGILS, 1), [choose(oppFollowers()), earthRite(1, destroy(slot()))])),
    ],
  },
  [id("ラブリーマスターピース")]: {
    abilities: [
      fanfare(damage(oppFollowers(), 6)),
      lastWords(earthRite(2, damage(OPP_LEADER, 3))),
      onSuperEvolve(summon("ラブリーマスターピース")),
    ],
  },

  // ---- 第8弾 ----
  [id("緑の幸・ムニャール＆マンマル2号＆ジーナ")]: { abilities: [fanfare(...greenJoy), onEvolve(...greenJoy)] },
  [id("マナリアクラーク・ポピー")]: { abilities: [fanfare(addToHand("マナリアの魔弾"))] },
  // 第1弾の再録（能力はスターターの定義と同じ）
  [rid("ストームブラスト")]: {
    initialX: 2,
    abilities: [onSpellboost(addX), spell(choose(oppFollowers()), damage(slot(), THIS_X))],
  },
  [id("ハッピーフラワー・サミー＆マリー")]: {
    abilities: [cheaper, fanfare(draw(2), opponentDraws(1))],
  },
  [id("睦まやかな団欒")]: { abilities: [spell(heal(2), spellboost(handCards(), 1))] },
  [id("地を這う雷撃")]: {
    abilities: [
      spell(
        random({ kind: "maxAttack", of: oppFollowers() }, 1, "r"),
        damage(slot("r"), 8),
        damage(OPP_LEADER, 2),
        earthRite(2, addToHand("地を這う雷撃")),
      ),
    ],
  },
  [id("マナリアスクリプター・ティコ")]: {
    abilities: [
      fanfare(addToHand("マナリアの魔弾", 2)),
      onEvolve(costChange(handCards({ type: "spell", tribe: "マナリア" }), -1)),
      onSuperEvolve(crest("マナリアスクリプター・ティコ")),
    ],
  },
  [id("鋼鉄の微睡み")]: {
    initialX: 0,
    // 「Xが5以上なら、」は回復と PP の回復の両方にかかるものとする（推定）
    abilities: [onSpellboost(addX), spell(draw(2), when(thisXAtLeast(5), [heal(2), gainPp(2)]))],
  },
  [id("恩愛の大地・テトラ＆ラティカ")]: {
    initialX: 0,
    abilities: [
      onSpellboost(addX),
      fanfare(
        when(thisXAtLeast(10), [addToHand("ソニック・フォー")]),
        when(thisXAtLeast(20), [addToHand("大いなる回帰")]),
      ),
    ],
  },
  [id("災いの言霊・ジンジャー")]: {
    abilities: [
      fanfare(summon("ガーディアンゴーレム", 2)),
      onAllyEnter({ type: "follower" }, grant(EVENT, ["rush"]), spellboost(handCards(), 1)),
      onEvolve(summon("ガーディアンゴーレム")),
    ],
  },

  // ---- 第9弾 ----
  [id("没入の実験体")]: {
    abilities: [
      onEnter(when(valueAtLeast(enteredCount({ ...SUBJECT, excludeSelf: true }), 5), [buff(THIS, 3, 3)])),
    ],
  },
  [id("キースピリット")]: {
    abilities: [
      fanfare(choose(oppFollowers()), damage(slot(), 7), damage(OPP_LEADER, 4)),
      onEvolve(choose(handCards({ spellboost: true })), spellboost(slot(), 4)),
    ],
  },
  [id("過剰反応")]: { abilities: [spell(addToHand("真理の召喚", 3))] },
  [id("心酔の研究者")]: {
    abilities: [
      fanfare(
        when(ENHANCED, [summon("没入の実験体", 3, "s"), grant(slot("s"), ["ward"])], [summon("没入の実験体", 2)]),
      ),
      onEvolve(choose(allyFollowers(SUBJECT)), grant(slot(), ["bane"])),
    ],
  },
  [id("高潔なる哲学者")]: {
    abilities: [fanfare({ op: "returnToDeck", target: handCards(), countVar: "n" }, draw(v("n")))],
  },
  [id("人らしい愛")]: {
    abilities: [
      spell(
        summon("没入の実験体", 1, "s"),
        buff(slot("s"), 1, 0),
        addToHandAs("没入の実験体", "h"),
        buff(slot("h"), 1, 0),
      ),
    ],
  },
  [id("恍惚の才媛")]: {
    fusion: {},
    abilities: [
      fanfare(draw(2), summon("没入の実験体")),
      onSuperEvolve(when(FUSED, [choose(allyFollowers(SUBJECT)), grant(slot(), ["drain"])])),
    ],
  },
  [id("烏ノ涅")]: {
    abilities: [spell(summon("没入の実験体"), repeat(2, random(oppFollowers(), 1, "r"), damage(slot("r"), 7)))],
  },
  [id("万術の咎人・セフィー")]: {
    fusion: {},
    abilities: [
      onFused(payPp(2, summon("没入の実験体"))),
      fanfare(summon("没入の実験体", 2)),
      onSuperEvolve(crest("万術の咎人・セフィー")),
    ],
  },
  [id("破式の変貌・フィーリン")]: { abilities: [cheaper] },

  // ---- トークン ----
  [id("マナリアの魔弾")]: { abilities: [spell(random(oppFollowers(), 1, "r"), damage(slot("r"), 3))] },
  [id("アルス・マグナ")]: {
    abilities: [spell(choose(union(oppFollowers(), OPP_LEADER)), damage(slot(), 2), heal(1))],
  },
  [id("天晶の深淵")]: {
    abilities: [
      spell(
        // X/Y/Z は合計が信仰値になる0以上の整数（信仰値は減らない。docs/rules.md 12章）
        splitRandom(FAITH, "x", "y", "z"),
        summon("天晶の魔手", 1, "s"),
        buff(slot("s"), v("x"), v("x")),
        heal(v("y")),
        damage(OPP_LEADER, v("z")),
      ),
    ],
    faith: manoFaith,
  },
  [id("ソニック・フォー")]: { abilities: [spell(damage(oppFollowers(), 5))] },
  [id("大いなる回帰")]: { abilities: [spell(choose(allyFollowers()), grantAttacks(slot(), 2))] },
};

/** このクラスのカードが与えるクレストの能力（キーは crestIdOf("カード名")） */
export const WITCH_ROT_CRESTS: Record<string, CardAbilities> = {
  [crestIdOf("懐旧の送り火・エルモート")]: { abilities: [onTurnStart(damage(OPP_LEADER, 1))] },
  [crestIdOf("天才美少女錬金術師・カリオストロ")]: {
    abilities: [onTurnStart(earthRite(1, addToHand("アルス・マグナ")))],
  },
  // 【カウントダウン_2】は data/crests.json から読む
  [crestIdOf("インソムニアウィッチ")]: { abilities: [lastWords(damage(allFollowers(), 3))] },
  [crestIdOf("歩む《愚者》・リンクル")]: {
    abilities: [
      onAllyEnter({ ids: [id("歩む《愚者》・リンクル")] }, { op: "addLeaderMaxHp", side: "opponent", amount: -2 }),
    ],
  },
  [crestIdOf("魔恋の慕情・シイム")]: { abilities: [onAllyAttack(MANO, buff(EVENT, 1, 0))] },
  // 【カウントダウン_1】は data/crests.json から読む
  [crestIdOf("万食のアナテマ・ララアンセム")]: {
    abilities: [onOpponentTurnEnd(summon("万食のアナテマ・ララアンセム", 1, "s"), evolveIt(slot("s")))],
  },
  [crestIdOf("マナリアスクリプター・ティコ")]: {
    abilities: [onAllyPlay({ type: "spell", tribe: "マナリア" }, damage(OPP_LEADER, 1))],
  },
  [crestIdOf("万術の咎人・セフィー")]: {
    abilities: [oncePerOwnTurn(onAllyEnter(SUBJECT, grant(EVENT, ["storm"])))],
  },
};
