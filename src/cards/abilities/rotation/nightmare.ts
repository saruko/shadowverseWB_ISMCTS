// ローテーションのカード能力（nightmare。トークン・クレスト含む）。書き方は docs/rotation-authoring.md

import type { CardAbilities, Effect } from "../../../engine/dsl";
import {
  BOTH_LEADERS,
  ENHANCED,
  EVENT,
  FROM_THIS,
  MIN_HP_LEADERS,
  OPP_LEADER,
  OWN_TURN,
  RELEASED_ULTIMATE,
  SELF_LEADER,
  SUPER_EVOLVE_TURN,
  THIS,
  addToDeck,
  addToHand,
  allFollowers,
  allyCards,
  allyFollowers,
  banish,
  buff,
  choose,
  copy,
  costChange,
  countAtLeast,
  crest,
  crestIdOf,
  crestsOf,
  damage,
  destroy,
  distribute,
  draw,
  drawAs,
  evolveIt,
  fanfare,
  fromSlot,
  gainEp,
  gainPp,
  grant,
  grantAbilities,
  grantAttacks,
  handCards,
  heal,
  id,
  inHand,
  lastWords,
  loseLastWords,
  mode,
  modePick,
  necromancy,
  onAllyEnter,
  onAllyPlay,
  onAttack,
  onClash,
  onDestroyed,
  onEvolve,
  onEvolved,
  onSuperEvolve,
  onSuperEvolved,
  onTurnEnd,
  oppFollowers,
  otherAllyFollowers,
  otherFollowers,
  random,
  repeat,
  slot,
  spell,
  summon,
  transform,
  union,
  when,
} from "../helpers";

/** 【リアニメイト_N】（slot を付けると「それは〜」で出したカードを指せる） */
const reanimate = (cost: number, slotName?: string): Effect =>
  slotName ? { op: "reanimate", cost, slot: slotName } : { op: "reanimate", cost };
/** 自分の手札に4枚以上同じコストがある */
const HAND_SAME_COST_4 = { kind: "handSameCostAtLeast", atLeast: 4 } as const;

// 【進化時】【ファンファーレ】と同じ能力が働く（効果の配列を共有する）
const KONPAKU = [reanimate(2)];
const AOONI: Effect[] = [
  choose(oppFollowers()),
  { op: "cannotAttack", target: slot(), until: "opponentTurnEnd" },
  draw(1),
];
const TIGHTROPE: Effect[] = [choose(oppFollowers()), damage(slot(), 3), summon("スケルトン")];
const RIMIRU: Effect[] = [when({ kind: "leaderHpGreater" }, [summon("バット", 2)])];
const MARSHA: Effect[] = [damage(union(oppFollowers(), BOTH_LEADERS), 1)];
// 奥夜花・シャクドウ: 「手札すべてをデッキに戻し、その枚数引く。その後、手札に4枚以上同じコストがあるなら…」を2回
const SHAKUDOU: Effect[] = [
  repeat(
    2,
    { op: "returnToDeck", target: handCards(), countVar: "n" },
    draw({ kind: "var", name: "n" }),
    when(HAND_SAME_COST_4, [damage(union(oppFollowers(), OPP_LEADER), 4)]),
  ),
];
// 鉄鎖の繋がり: 「相手の場のフォロワーからランダム1枚に3ダメージ。リーダーすべてに1ダメージ。」
const TESSA: Effect[] = [random(oppFollowers()), damage(slot(), 3), damage(BOTH_LEADERS, 1)];

export const NIGHTMARE_ROT: Record<string, CardAbilities> = {
  // ---- 第4弾 ----
  [id("憧憬の鉄槌・アルメイダ")]: { abilities: [fanfare(when(ENHANCED, [evolveIt(), buff(THIS, 1, 1)]))] },
  [id("不屈の鋭刃・バザラガ")]: {
    abilities: [lastWords(summon("不屈の鋭刃・バザラガ"), damage(SELF_LEADER, 2))],
  },
  [id("ヴァリアントエッジ")]: { abilities: [spell(damage(SELF_LEADER, 2), crest("ヴァリアントエッジ"))] },
  [id("覇空の武神・ナタク")]: {
    abilities: [
      onTurnEnd(
        random(oppFollowers(), 1, "a"),
        damage(slot("a"), 4),
        random(oppFollowers(), 1, "b"),
        damage(slot("b"), 2),
      ),
    ],
  },
  [id("愛の旅人・サテュロス")]: {
    abilities: [fanfare(when(countAtLeast(allyFollowers({ evolved: true }), 1), [evolveIt()]))],
  },
  [id("元素の共鳴・バアル")]: {
    abilities: [
      fanfare(
        mode(
          [random(otherAllyFollowers(), 1, "r"), buff(union(slot("r"), THIS), 1, 1)],
          [random(oppFollowers()), damage(slot(), 3)],
        ),
      ),
    ],
  },
  // 「自分の場の進化前のフォロワーすべて」にはこれ自身も含む
  [id("生滅の技巧・ネハン")]: {
    abilities: [fanfare(evolveIt(allyFollowers({ notEvolved: true })), damage(SELF_LEADER, 2))],
  },
  [id("コラプション")]: {
    abilities: [
      spell(
        buff(allFollowers(), -2, -2),
        crest("コラプション", "self"),
        crest("コラプション", "opponent"),
        when(RELEASED_ULTIMATE, [destroy(crestsOf("self", "コラプション"))]),
      ),
    ],
  },
  [id("闇の理・フェディエル")]: {
    abilities: [
      fanfare(necromancy(6, reanimate(2, "a"), reanimate(1, "b"), evolveIt(union(slot("a"), slot("b"))))),
      onTurnEnd(buff(oppFollowers(), -2, -2)),
    ],
  },
  [id("狡知の堕天司・ベリアル")]: {
    abilities: [
      fanfare(damage(otherFollowers(), 10), when(RELEASED_ULTIMATE, [crest("狡知の堕天司・ベリアル")])),
      onSuperEvolve({ op: "countdown", target: crestsOf("self", "狡知の堕天司・ベリアル"), amount: -1 }),
    ],
  },

  // ---- 第5弾 ----
  [id("リリーブウルフ")]: {
    abilities: [fanfare(when(ENHANCED, [buff(THIS, 0, 6), grant(THIS, ["bane", "barrier"])]))],
  },
  [id("紅札の魂魄使い")]: { abilities: [fanfare(...KONPAKU), onEvolve(...KONPAKU)] },
  [id("奥夜花の開戦")]: {
    abilities: [spell(choose(oppFollowers()), damage(slot(), 5), addToDeck("奥夜花の開戦"))],
  },
  [id("トラブルネクロマンサー")]: {
    abilities: [fanfare(summon("ゴースト"), summon("スケルトン")), onEvolve(summon("腐臭のゾンビ"))],
  },
  [id("橋渡しの青鬼")]: { abilities: [fanfare(...AOONI), onEvolve(...AOONI)] },
  [id("残虐の炸裂")]: { abilities: [spell(damage(MIN_HP_LEADERS, 3))] },
  [id("フェイタルテイカー")]: {
    abilities: [
      fanfare(transform(otherFollowers(), "スケルトン")),
      // どちらの場の『スケルトン』でも働く（docs/rules.md 12章）
      onDestroyed("both", { ids: [id("スケルトン")] }, heal(1)),
      onEvolve(damage(otherFollowers(), 1)),
    ],
  },
  [id("厳酷なる奥夜花")]: { abilities: [spell(crest("厳酷なる奥夜花"))] },
  [id("充つ《恋人と節制》・ミルティオ＆ルーゼン")]: {
    abilities: [
      fanfare(reanimate(4), reanimate(2)),
      // 「これが進化したとき」は超進化でも働く
      onEvolved(random(otherFollowers(), 6, "r"), destroy(slot("r"))),
      onSuperEvolved(crest("充つ《恋人と節制》・ミルティオ＆ルーゼン")),
    ],
  },
  [id("奥夜花・シャクドウ")]: { abilities: [fanfare(...SHAKUDOU), onSuperEvolve(...SHAKUDOU)] },

  // ---- 第6弾 ----
  [id("渇仰の悪魔")]: { abilities: [lastWords(draw(1), damage(SELF_LEADER, 1))] },
  [id("ゴーストエスケーパー")]: { abilities: [lastWords(addToHand("ゴースト"))] },
  [id("天眼授与")]: { abilities: [spell(draw(2), necromancy(4, heal(2)))] },
  [id("渇欲のネクロマンサー")]: { abilities: [fanfare(when(ENHANCED, [reanimate(9)]))] },
  [id("ロストラブデビル")]: {
    abilities: [
      fanfare(when(ENHANCED, [grant(THIS, ["storm"])])),
      onEvolve(choose(oppFollowers()), damage(slot(), 4)),
    ],
  },
  // 消滅したあと、選んだときのカードと同名のカードを自分の場に出す
  [id("『最強』の魅惑")]: {
    abilities: [spell(choose(oppFollowers()), banish(slot()), copy(fromSlot(), 1, "board"))],
  },
  [id("渇命の破壊者")]: {
    abilities: [
      fanfare(choose(otherAllyFollowers()), when(countAtLeast(slot(), 1), [destroy(slot()), evolveIt()])),
      onEvolved(summon("バット", 1, "b"), evolveIt(slot("b"))),
    ],
  },
  [id("枯渇の天眼")]: { abilities: [spell(mode([gainEp(1)], [damage(oppFollowers(), 2)]))] },
  [id("枯渇の神魔・アルメス")]: {
    indestructible: true,
    abilities: [onClash(destroy(EVENT)), onSuperEvolve(grantAttacks(THIS, 3))],
  },
  [id("旧き天眼・ビバティー")]: {
    abilities: [fanfare(necromancy(4, evolveIt())), onEvolved(addToHand("天眼の深淵"))],
  },

  // ---- 第7弾 ----
  [id("ヴァンプキーボード・ルルミ")]: { abilities: [lastWords(addToHand("バット"))] },
  [id("デーモンドラム・ラズ")]: {
    abilities: [lastWords(summon("スケルトン")), onEvolve(choose(oppFollowers()), damage(slot(), 3))],
  },
  [id("ソウルチューニング")]: { abilities: [spell(choose(allyFollowers(), 2), buff(slot(), 0, 1), draw(1))] },
  [id("タイトロープキャット")]: { abilities: [fanfare(...TIGHTROPE), onEvolve(...TIGHTROPE)] },
  [id("ジャグラークロウ")]: { abilities: [fanfare(choose(oppFollowers()), destroy(slot()), reanimate(2))] },
  [id("青春の謳歌")]: {
    abilities: [
      spell(
        summon("ゴースト", 1, "a"),
        summon("バット", 1, "b"),
        summon("スケルトン", 1, "c"),
        evolveIt(union(slot("a"), slot("b"), slot("c"))),
      ),
    ],
  },
  [id("テイマースケルトン")]: {
    abilities: [
      fanfare(summon("腐臭のゾンビ"), summon("スケルトン")),
      onAllyEnter({ type: "follower", tribe: "死者" }, grant(EVENT, ["storm"])),
      // 「選んだなら」は相手のフォロワーの破壊にもかかると読む（選ばなければどちらも破壊しない）
      onSuperEvolve(
        choose(otherAllyFollowers(), 1, "t"),
        when(countAtLeast(slot("t"), 1), [destroy(slot("t")), random(oppFollowers(), 1, "r"), destroy(slot("r"))]),
      ),
    ],
  },
  [id("夜の唱のライブ")]: {
    abilities: [spell(distribute(oppFollowers(), 6), necromancy(6, damage(OPP_LEADER, 2)))],
  },
  [id("傍死のアナテマ・徒姫")]: {
    abilities: [
      fanfare({ op: "summonFromDeck", filter: { type: "follower", class: "nightmare", costMax: 2 }, kinds: 2 }),
      onAllyEnter({ type: "follower", class: "nightmare" }, grant(EVENT, ["rush"])),
      onSuperEvolve(buff(otherAllyFollowers({ class: "nightmare" }), 2, 2)),
    ],
  },
  [id("デッドプレゼンター・マクミラン")]: {
    abilities: [
      fanfare(necromancy(10, summon("腐臭のゾンビ", 3))),
      onAllyEnter(
        { type: "follower", tribe: "死者" },
        when(OWN_TURN, [buff(EVENT, 1, 0), grant(EVENT, ["rush", "ward"]), damage(OPP_LEADER, 1)]),
      ),
    ],
  },

  // ---- 第8弾 ----
  [id("透き通る信念・アンサージュ")]: { ignoreWard: true, abilities: [] },
  [id("キュートな悪魔・リリム")]: { abilities: [onAttack(damage(BOTH_LEADERS, 1)), lastWords(addToHand("バット"))] },
  [id("バニーな悪魔・リミル")]: { abilities: [fanfare(...RIMIRU), onEvolve(...RIMIRU)] },
  [id("マザーな悪魔・フィオレ")]: {
    abilities: [fanfare(summon("バット", 3)), onAllyEnter({ ids: [id("バット")] }, grant(EVENT, ["rush"]))],
  },
  [id("ダークナイト・マーシャ")]: { abilities: [fanfare(...MARSHA), onEvolve(...MARSHA)] },
  [id("旅立ちの退出")]: {
    abilities: [
      spell(
        modePick(
          2,
          [damage(OPP_LEADER, 1)],
          [heal(2)],
          [random(oppFollowers()), damage(slot(), 3)],
          [{ op: "addGraveyard", amount: 4 }],
        ),
      ),
    ],
  },
  [id("誠実なる呪い屋・スージー")]: {
    abilities: [
      fanfare(choose(oppFollowers()), buff(slot(), 0, -3)),
      onEvolve(choose(handCards({ type: "follower" })), buff(slot(), 3, 0)),
    ],
  },
  // 「それのコストを-1」は引いた2枚と読む
  [id("変わりし流れ")]: {
    abilities: [
      spell(
        choose(handCards()),
        { op: "returnToDeck", target: slot() },
        drawAs(2, "d"),
        when(SUPER_EVOLVE_TURN, [costChange(slot("d"), -1)]),
      ),
    ],
  },
  [id("出発の憧憬・イツルギ＆タケツミ")]: {
    abilities: [
      fanfare(mode([damage(OPP_LEADER, 4), heal(4)], [damage(oppFollowers(), 5), gainEp(1)])),
      onEvolve(mode([draw(2)], [gainPp(2)])),
    ],
  },
  [id("陽と月の薔薇・セレス")]: {
    abilities: [
      fanfare(necromancy(20, costChange(handCards({ class: "nightmare" }), -2))),
      onClash(damage(EVENT, 4)),
      onTurnEnd(heal(4)),
    ],
  },

  // ---- 第9弾 ----
  [id("強襲の特攻隊長")]: { abilities: [fanfare(damage(BOTH_LEADERS, 2))] },
  [id("幽冥の中尉")]: {
    abilities: [
      lastWords(
        summon("幽冥の中尉", 1, "s"),
        buff(slot("s"), 1, 0),
        grant(slot("s"), ["rush"]),
        loseLastWords(slot("s")),
      ),
    ],
  },
  [id("ホラーサプライズ")]: { abilities: [spell(summon("ゴースト"), summon("腐臭のゾンビ"))] },
  [id("淵底の大佐")]: {
    abilities: [lastWords(random(oppFollowers()), destroy(slot()), heal(2))],
    // 結晶: コスト2、【カウントダウン_4】【ラストワード】『淵底の大佐』1枚を自分の場に出す。
    crystallize: { cost: 2, countdown: 4, abilities: [lastWords(summon("淵底の大佐"))] },
  },
  [id("トゥインクルデビル")]: {
    abilities: [fanfare(choose(oppFollowers()), destroy(slot()), damage(OPP_LEADER, 2))],
  },
  [id("鉄鎖の繋がり")]: { abilities: [spell(when(ENHANCED, [repeat(2, ...TESSA)], TESSA))] },
  [id("激烈の副総長")]: {
    abilities: [
      fanfare(damage(oppFollowers(), 3), damage(BOTH_LEADERS, 3)),
      onSuperEvolve(draw(2), damage(BOTH_LEADERS, 1)),
    ],
  },
  // 付与する【ラストワード】の「これ」は付与されたフォロワー
  [id("死神払い")]: {
    abilities: [
      spell(choose(allyFollowers()), grantAbilities(slot(), [lastWords(copy(FROM_THIS, 1, "board"))])),
    ],
  },
  [id("イステンデッドVSマルチルゲート")]: {
    abilities: [
      fanfare(repeat(3, reanimate(2)), damage(oppFollowers(), 2)),
      onSuperEvolve(crest("イステンデッドVSマルチルゲート")),
    ],
  },
  [id("ガロダートVSゼット")]: {
    abilities: [
      inHand(onTurnEnd(when({ kind: "leaderHpAtMost", side: "self", value: 12 }, [costChange(THIS, -1)]))),
      fanfare(
        mode(
          [grant(THIS, ["storm"]), damage(SELF_LEADER, 2)],
          [grant(THIS, ["ward"]), damage(oppFollowers(), 8)],
        ),
      ),
    ],
  },

  // ---- トークン ----
  [id("腐臭のゾンビ")]: {
    abilities: [lastWords(summon("腐臭のゾンビ", 1, "s"), loseLastWords(slot("s")))],
  },
  [id("天眼の深淵")]: { abilities: [spell(draw(2))] },
};

/** このクラスのカードが与えるクレストの能力（キーは crestIdOf("カード名")） */
export const NIGHTMARE_ROT_CRESTS: Record<string, CardAbilities> = {
  [crestIdOf("ヴァリアントエッジ")]: {
    abilities: [onTurnEnd(random(oppFollowers()), damage(slot(), 2), heal(1))],
  },
  // 相手が持ったものは相手のターン終了時に相手のリーダーにダメージ（クレストの持ち主から見た「自分」）
  [crestIdOf("コラプション")]: { abilities: [onTurnEnd(damage(SELF_LEADER, 2))] },
  [crestIdOf("狡知の堕天司・ベリアル")]: { abilities: [lastWords(damage(OPP_LEADER, 20))] },
  [crestIdOf("厳酷なる奥夜花")]: {
    abilities: [
      onTurnEnd(draw(1), when(HAND_SAME_COST_4, [summon("スケルトン", 1, "s"), grant(slot("s"), ["ward"])])),
    ],
  },
  [crestIdOf("充つ《恋人と節制》・ミルティオ＆ルーゼン")]: {
    suppressFanfare: true,
    abilities: [onAllyPlay({ type: "follower" }, evolveIt(EVENT))],
  },
  [crestIdOf("イステンデッドVSマルチルゲート")]: {
    abilities: [
      onTurnEnd(
        when(countAtLeast(allyCards({ hasLastWords: true }), 1), [
          random(allyCards({ hasLastWords: true }), 1, "a"),
          random(oppFollowers(), 1, "b"),
          destroy(union(slot("a"), slot("b"))),
        ]),
      ),
    ],
  },
};
