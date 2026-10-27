// ローテーションのカード能力（dragon。トークン・クレスト含む）。書き方は docs/rotation-authoring.md

import type { CardAbilities, Effect } from "../../../engine/dsl";
import {
  ATTACKED_LEADER_LAST_TURN,
  AWAKENED,
  ENHANCED,
  EVENT,
  EVIDENCE_AMULET,
  OPP_LEADER,
  RELEASED_ULTIMATE,
  SELF_LEADER,
  THIS,
  THIS_COST,
  THIS_EVOLVED,
  ULTIMATE,
  addToDeck,
  addToHand,
  addToHandAs,
  allFollowers,
  allyFollowers,
  banish,
  boardCards,
  buff,
  choose,
  copy,
  count,
  crest,
  crestIdOf,
  crestsOf,
  damage,
  deckCards,
  destroy,
  discard,
  distribute,
  draw,
  drawAs,
  enteredCount,
  evolveIt,
  fanfare,
  fromSlot,
  gainPp,
  grant,
  grantAttacksTemp,
  handCards,
  heal,
  id,
  inHand,
  lastWords,
  leaderMissingHp,
  leftmost,
  loseLastWords,
  mode,
  modePick,
  onAllyAttack,
  onAllyEnter,
  onAllySuperEvolve,
  onAttack,
  onDiscarded,
  onEvolve,
  onEvolved,
  onLeaderHealed,
  onSuperEvolve,
  onSuperEvolveInstead,
  onTurnEnd,
  onTurnStart,
  oncePerOwnTurn,
  oppFollowers,
  otherAllyFollowers,
  random,
  repeat,
  setCost,
  slot,
  slotStat,
  spell,
  summon,
  superEvolveIt,
  transform,
  union,
  v,
  when,
} from "../helpers";

const addMaxPp = (amount: number): Effect => ({ op: "addMaxPp", amount });
const MAX_PP_10 = { kind: "maxPp", atLeast: 10 } as const;
const OPP_ALL = union(oppFollowers(), OPP_LEADER);

// 【進化時】【ファンファーレ】と同じ能力が働く カードの効果
const WILNAS: Effect[] = [choose(oppFollowers()), damage(slot(), 8)];
const SHADAN: Effect[] = [choose(handCards()), discard(slot()), random(oppFollowers(), 1, "r"), damage(slot("r"), 6)];
const KIMIKA: Effect[] = [choose(handCards()), discard(slot()), draw(1), heal(1)];
const NOMAGDARA: Effect[] = [mode([draw(1), heal(3)], [buff(oppFollowers(), 0, -4)])];

/** 自分の手札に証拠・アミュレットがあるなら、その中のランダム1枚を捨てる（第10弾。無ければ何もしない） */
const DISCARD_EVIDENCE: Effect[] = [random(handCards(EVIDENCE_AMULET), 1, "e"), discard(slot("e"))];

export const DRAGON_ROT: Record<string, CardAbilities> = {
  // ---- 第4弾 ----
  [id("メグの親友・まりっぺ")]: {
    abilities: [
      // 手札で働く。自分の元のコスト3のフォロワーが超進化したとき（効果による超進化を含む）、ターン終了まで、これのコストを0にする
      inHand(onAllySuperEvolve({ type: "follower", originalCostEq: 3 }, setCost(THIS, 0, "endOfTurn"))),
      onTurnEnd(random(allyFollowers({ superEvolved: true })), buff(slot(), 1, 1)),
    ],
  },
  [id("クレッセント・チューブ・ライド")]: { abilities: [spell(crest("クレッセント・チューブ・ライド"))] },
  [id("凍てつく定め・イシュミール")]: {
    abilities: [fanfare(when(MAX_PP_10, [evolveIt()])), onEvolved(damage(oppFollowers(), 3))],
  },
  [id("純朴の鋼体・ムゲン")]: {
    abilities: [
      fanfare(when(RELEASED_ULTIMATE, [grant(THIS, ["storm"])])),
      onSuperEvolve(choose(oppFollowers(), 2), destroy(slot())),
    ],
  },
  [id("ラヴマックス・ボンバー")]: {
    abilities: [
      spell(choose(oppFollowers()), damage(slot(), 3), { op: "cannotAttack", target: slot(), until: "opponentTurnEnd" }),
    ],
  },
  [id("どこにでもいるフツーの女の子・メグ")]: {
    abilities: [
      fanfare(when(ULTIMATE, [superEvolveIt(THIS)])),
      onAllyEnter({ type: "follower", originalCostEq: 2 }, grant(THIS, ["ward"])),
    ],
  },
  [id("星晶獣の吸収")]: {
    // 相手の場のカード（フォロワー・アミュレット）。消滅した後、選んだときのカードと同名のカードを手札に加える
    abilities: [spell(choose(boardCards("opponent")), banish(slot()), copy(fromSlot(), 1, "hand"))],
  },
  [id("炎の理・ウィルナス")]: { abilities: [fanfare(...WILNAS), onEvolve(...WILNAS)] },
  [id("世界の味方・ゾーイ")]: {
    abilities: [
      fanfare(
        addMaxPp(1),
        when(ENHANCED, [
          grant(THIS, ["storm"]),
          { op: "setLeaderMaxHp", side: "self", value: 1 },
          { op: "leaderStatus", side: "self", cap: { atLeast: 1, to: 0 }, duration: "untilOpponentTurnEnd" },
        ]),
      ),
    ],
  },

  // ---- 第5弾 ----
  [id("湧水の汲み手")]: {
    abilities: [
      onEvolve(choose(oppFollowers()), damage(slot(), 5)),
      onSuperEvolveInstead(choose(oppFollowers(), 2), damage(slot(), 5)),
    ],
  },
  [id("雫の囃子方")]: {
    abilities: [fanfare(summon("大海のオルカ")), onAllyEnter({ type: "follower", tribe: "海洋" }, heal(2))],
  },
  [id("波揺花の断裁")]: {
    abilities: [
      spell(drawAs(1, "d", { type: "follower" }), random(oppFollowers(), 1, "r"), damage(slot("r"), slotStat("d", "cost"))),
    ],
  },
  [id("鉄槌のドラグーン")]: {
    abilities: [fanfare(choose(oppFollowers()), damage(slot(), 7), summon("大翼のドラゴン"))],
  },
  [id("クラゲの舞姫")]: {
    abilities: [
      fanfare(addToHand("大海のオルカ")),
      onAllyEnter({ type: "follower", tribe: "海洋" }, grant(THIS, ["rush", "bane"])),
    ],
  },
  [id("プロミネンスロア")]: { abilities: [spell(damage(allFollowers(), count(allFollowers())))] },
  [id("ルインジェノサイダー")]: {
    abilities: [
      onSuperEvolve(
        { op: "banish", target: deckCards({ costIn: [1, 3, 5, 7, 9] }), countVar: "n" },
        distribute(oppFollowers(), v("n")),
      ),
    ],
  },
  [id("怠惰なる波揺花")]: {
    abilities: [
      spell(repeat(2, random(oppFollowers(), 1, "r"), damage(slot("r"), 2)), when(AWAKENED, [damage(OPP_LEADER, 2)])),
    ],
  },
  [id("律する《正義》・イランツァ")]: {
    abilities: [
      onTurnEnd(
        when(THIS_EVOLVED, [damage(OPP_LEADER, 8)], [random(oppFollowers(), 2, "r"), damage(slot("r"), 8), heal(8)]),
      ),
      onEvolve({ op: "loseKeyword", target: THIS, keyword: "ward" }, grant(THIS, ["intimidate"])),
    ],
  },
  [id("波揺花・ユウベ")]: {
    abilities: [
      fanfare(summon("大海のオルカ")),
      onEvolve(choose(handCards()), discard(slot()), crest("波揺花・ユウベ")),
    ],
  },

  // ---- 第6弾 ----
  [id("果断のドラゴニュート")]: {
    abilities: [fanfare(choose(handCards()), discard(slot())), lastWords(draw(2))],
  },
  [id("完熟の海魚")]: {
    abilities: [fanfare(when(ENHANCED, [summon("完熟の海魚", 2)])), lastWords(heal(1))],
  },
  [id("天刀授与")]: {
    abilities: [
      // THIS_COST は捨てられたときのコスト
      onDiscarded(when({ kind: "thisCostEq", value: 4 }, [addToHandAs("天刀授与", "h"), setCost(slot("h"), 2)])),
      spell(choose(allyFollowers()), buff(slot(), 2, 2)),
    ],
  },
  [id("即断の剣聖")]: { abilities: [fanfare(choose(handCards()), discard(slot()))] },
  [id("スパイクドラゴン")]: {
    abilities: [onTurnEnd(evolveIt()), onEvolved(damage(OPP_ALL, 3))],
  },
  [id("赤色流し")]: {
    abilities: [spell(choose(handCards()), choose(oppFollowers(), 1, "o"), discard(slot()), destroy(slot("o")))],
  },
  [id("遮断の竜闘士")]: { abilities: [fanfare(...SHADAN), onEvolve(...SHADAN)] },
  [id("断頭の天刀")]: {
    abilities: [
      onDiscarded(
        when(
          { kind: "thisCostEq", value: 7 },
          [addToHandAs("断頭の天刀", "h"), setCost(slot("h"), 5)],
          [when({ kind: "thisCostEq", value: 5 }, [addToHandAs("断頭の天刀", "h"), setCost(slot("h"), 3)])],
        ),
      ),
      // X はプレイしたときのコスト
      spell(damage(oppFollowers(), THIS_COST)),
    ],
  },
  [id("断頭の斬姫・サガツマツ")]: {
    abilities: [fanfare(choose(handCards()), discard(slot()), addToHand("赤色流し", 2))],
  },
  [id("旧き天刀・ヴォーラライ")]: {
    abilities: [
      onDiscarded(summon("旧き天刀・ヴォーラライ")),
      onEvolve(addToHand("天刀の深淵")),
      onSuperEvolveInstead(addToHand("天刀の深淵", 3)),
    ],
  },

  // ---- 第7弾 ----
  [id("喧伝の龍人")]: { abilities: [fanfare(when(ENHANCED, [summon("喧伝の龍人", 2)]))] },
  [id("キャリーワイバーン")]: {
    abilities: [
      fanfare(choose(otherAllyFollowers()), buff(slot(), 2, 2)),
      onEvolve(choose(handCards({ type: "follower" })), buff(slot(), 2, 2)),
    ],
  },
  [id("退屈な睥睨")]: {
    abilities: [
      spell(
        addMaxPp(1),
        transform(union(handCards({ ids: [id("退屈な睥睨")] }), deckCards({ ids: [id("退屈な睥睨")] })), "焦龍の午睡"),
      ),
    ],
  },
  [id("豪龍の門番")]: { abilities: [fanfare(choose(oppFollowers()), destroy(slot()))] },
  [id("ドラゴニックサーバー")]: {
    abilities: [fanfare(when(MAX_PP_10, [evolveIt()])), onTurnEnd(when(THIS_EVOLVED, [heal(2)], [heal(1)]))],
  },
  [id("焦龍の午睡")]: { abilities: [spell(heal(3), when(AWAKENED, [draw(1)]))] },
  [id("ドラゴニュートの先導者")]: {
    abilities: [
      fanfare(
        mode([evolveIt()], [grant(THIS, ["ambush"])]),
        random({ kind: "maxAttack", of: oppFollowers() }, 1, "r"),
        destroy(slot("r")),
      ),
    ],
  },
  [id("黒炎の奔流")]: { abilities: [spell(damage(oppFollowers(), 5), damage(OPP_LEADER, 3))] },
  [id("焦灰のアナテマ・バーンドナイト")]: {
    abilities: [
      fanfare(damage(oppFollowers(), 9)),
      onSuperEvolve(crest("焦灰のアナテマ・バーンドナイト", "opponent")),
    ],
  },
  [id("龍谷のエルダードラゴン")]: {
    abilities: [
      fanfare(summon("大翼のドラゴン"), crest("龍谷のエルダードラゴン")),
      onSuperEvolve({ op: "countdown", target: crestsOf("self", "龍谷のエルダードラゴン"), amount: 2 }),
    ],
  },

  // ---- 第8弾 ----
  [id("人狼族の長・ギド")]: {
    abilities: [fanfare(when({ kind: "leaderHpAtMost", side: "self", value: 10 }, [evolveIt()]))],
  },
  [id("砂塵の宝物番")]: { abilities: [lastWords(draw(3))] },
  [id("わだつみの精")]: {
    abilities: [fanfare(addToHand("大海のオルカ")), onEvolve(crest("わだつみの精"))],
  },
  [id("キラキラサウンド・リーフ＆ロロ")]: {
    abilities: [fanfare(summon("キラキラサウンド・リーフ＆ロロ")), onTurnEnd(addToHand("大海のオルカ"))],
  },
  [id("笑顔の調理・キミカ")]: { abilities: [fanfare(...KIMIKA), onEvolve(...KIMIKA)] },
  [id("末世死化粧")]: {
    abilities: [spell(random(oppFollowers(), 1, "r"), damage(slot("r"), 4), damage(OPP_LEADER, 4))],
  },
  [id("天頂の戦火・ジェアーダ")]: {
    abilities: [
      onAttack(grant(THIS, ["barrier"]), when({ kind: "attackingFollower" }, [grantAttacksTemp(THIS, 2)])),
    ],
  },
  [id("狐火陽炎")]: {
    abilities: [
      spell(
        choose(union(oppFollowers(), OPP_LEADER)),
        damage(slot(), 1),
        addToDeck("狐火陽炎"),
        when(AWAKENED, [draw(1)]),
      ),
    ],
  },
  [id("反照の赤紅・ドラーク＆アルザード")]: {
    abilities: [
      fanfare(
        { op: "setVar", name: "x", value: enteredCount({ ids: [id("反照の赤紅・ドラーク＆アルザード")], excludeSelf: true }) },
        buff(THIS, v("x"), v("x")),
        when({ kind: "varAtLeast", name: "x", value: 2 }, [evolveIt()]),
      ),
      lastWords(crest("反照の赤紅・ドラーク＆アルザード")),
    ],
  },
  [id("金銀絢爛・リュミオール＆アルジャンテ")]: {
    abilities: [
      fanfare(choose(handCards(), 2), discard(slot()), damage(OPP_ALL, 4)),
      onSuperEvolve(draw(3)),
    ],
    accelerate: { cost: 3, abilities: [spell(addMaxPp(1))] },
  },

  // ---- 第9弾 ----
  [id("寸裂の盗人")]: {
    abilities: [
      fanfare(when(ATTACKED_LEADER_LAST_TURN, [grant(THIS, ["storm"])])),
      lastWords(addToHandAs("寸裂の盗人", "h"), loseLastWords(slot("h"))),
    ],
  },
  [id("ケイブドラゴン")]: { abilities: [fanfare(when(AWAKENED, [evolveIt()]))] },
  [id("幼竜の癇癪")]: {
    abilities: [
      spell(summon("ベビーファイアドレイク"), when(ENHANCED, [random(oppFollowers(), 1, "r"), damage(slot("r"), 3)])),
    ],
  },
  [id("絶倒の襲撃者")]: {
    abilities: [onAttack(when(ATTACKED_LEADER_LAST_TURN, [buff(THIS, 1, 0, "endOfTurn")]))],
  },
  [id("ドラゴニュートバトラー")]: {
    abilities: [fanfare(heal(3), gainPp(3)), onEvolve(choose(otherAllyFollowers()), buff(slot(), 3, 3))],
  },
  [id("顎門の別れ")]: {
    abilities: [
      spell(choose(handCards(), 2), discard(slot()), random(oppFollowers(), 1, "r"), damage(union(slot("r"), OPP_LEADER), 3)),
    ],
  },
  [id("塵土の無頼漢")]: {
    abilities: [
      fanfare(
        when(
          ATTACKED_LEADER_LAST_TURN,
          [repeat(2, random(oppFollowers(), 1, "r"), damage(slot("r"), 4))],
          [random(oppFollowers(), 1, "r"), damage(slot("r"), 4)],
        ),
      ),
      onEvolve(summon("絶倒の襲撃者")),
    ],
  },
  [id("ウンギア")]: {
    abilities: [
      spell(when(ATTACKED_LEADER_LAST_TURN, [distribute(oppFollowers(), 6)], [distribute(oppFollowers(), 3)])),
    ],
  },
  [id("穿孔の咎人・アンテマリア")]: {
    abilities: [fanfare(when(ATTACKED_LEADER_LAST_TURN, [grant(THIS, ["storm"])]))],
    ignoreWard: true,
  },
  [id("禁牙の変貌・ノマグダラ")]: { abilities: [fanfare(...NOMAGDARA), onEvolve(...NOMAGDARA)] },

  // ---- 第10弾「ニーゲルヘリア神殺事件」 ----
  [id("天喰の暴行者")]: { abilities: [lastWords(addToHand("神域の物証"))] },
  [id("蒐集の発露")]: {
    // 証拠・アミュレットを捨てられなくても（手札に無くても）、引く効果は働く
    abilities: [
      spell(random(oppFollowers(), 1, "r"), damage(slot("r"), 4), ...DISCARD_EVIDENCE, draw(1, { originalCostMin: 5 })),
    ],
  },
  [id("アイシクルリザード")]: {
    abilities: [
      fanfare(
        when(
          ENHANCED,
          [repeat(3, random(oppFollowers(), 1, "r"), damage(slot("r"), 3)), buff(THIS, 5, 5)],
          [random(oppFollowers(), 1, "r"), damage(slot("r"), 3)],
        ),
      ),
    ],
  },
  [id("水竜神の慈雨")]: { abilities: [spell(draw(1), heal(1), when(AWAKENED, [addMaxPp(1)]))] },
  [id("偵察のドラゴニュート")]: {
    // 進化前（進化・超進化していない）の自分の他のフォロワー。効果による進化なので EP は使わない
    abilities: [onAttack(random(otherAllyFollowers({ notEvolved: true }), 1, "r"), evolveIt(slot("r")))],
  },
  [id("俯瞰の眼差し")]: {
    // 選んだ2つは（1）（2）…の順に働く（（1）と（2）なら出した『好奇のネズミ』も「左から2枚」に数える）
    abilities: [
      spell(
        modePick(
          2,
          [summon("好奇のネズミ")],
          [buff(leftmost(allyFollowers(), 2), 1, 0)],
          [addToHand("神域の物証", 3)],
          [random(oppFollowers(), 1, "r"), damage(slot("r"), 4)],
        ),
      ),
    ],
  },
  [id("天喰の強奪犯")]: {
    // PP最大値の+1は、証拠・アミュレットを捨てたかによらず働く
    abilities: [fanfare(...DISCARD_EVIDENCE, addMaxPp(1)), onEvolve(choose(oppFollowers()), damage(slot(), 3))],
  },
  [id("ドラゴニックフィアー・ギルヴァ")]: {
    // X はファンファーレが働いたときの値
    abilities: [
      fanfare(distribute(oppFollowers(), leaderMissingHp("opponent"))),
      onSuperEvolve(grant(THIS, ["storm", "ward"])),
    ],
  },
  [id("天喰の運び屋")]: {
    abilities: [fanfare(choose(oppFollowers(), 2), destroy(slot()), addToHand("神域の物証", 2))],
  },
  [id("天喰の三悪・ライトオフ")]: {
    abilities: [
      fanfare(
        banish(deckCards({ originalCostMax: 4 })),
        discard(handCards(EVIDENCE_AMULET), "n"),
        repeat(v("n"), random(oppFollowers(), 1, "r"), damage(slot("r"), 8)),
      ),
    ],
  },

  // ---- トークン ----
  [id("天刀の深淵")]: {
    abilities: [onDiscarded(damage(OPP_LEADER, 1), heal(1)), spell(damage(OPP_LEADER, 1), heal(1))],
  },
};

/** このクラスのカードが与えるクレストの能力（キーは crestIdOf("カード名")） */
export const DRAGON_ROT_CRESTS: Record<string, CardAbilities> = {
  // 【カウントダウン_4】は自動で読む
  [crestIdOf("クレッセント・チューブ・ライド")]: {
    abilities: [onTurnEnd(random(allyFollowers()), buff(slot(), 1, 1))],
  },
  [crestIdOf("波揺花・ユウベ")]: {
    abilities: [
      onAllyAttack({ type: "follower", tribe: "海洋" }, buff(EVENT, 1, 0, "endOfTurn")),
      // 「自分のターンごとに1回」は同じ誘発（海洋・フォロワーが攻撃するとき）の後半だけに掛かる
      oncePerOwnTurn(onAllyAttack({ type: "follower", tribe: "海洋" }, addToHand("大海のオルカ"))),
    ],
  },
  // 相手が持つクレスト（self はクレストの持ち主）
  [crestIdOf("焦灰のアナテマ・バーンドナイト")]: {
    abilities: [onTurnStart(damage(SELF_LEADER, 2)), onLeaderHealed(damage(SELF_LEADER, 1))],
  },
  [crestIdOf("龍谷のエルダードラゴン")]: { abilities: [onTurnEnd(summon("大翼のドラゴン"))] },
  [crestIdOf("わだつみの精")]: {
    abilities: [onAllyEnter({ type: "follower", tribe: "海洋" }, buff(EVENT, 1, 1))],
  },
  [crestIdOf("反照の赤紅・ドラーク＆アルザード")]: {
    abilities: [lastWords(addToHandAs("反照の赤紅・ドラーク＆アルザード", "h"), setCost(slot("h"), 2))],
  },
};
