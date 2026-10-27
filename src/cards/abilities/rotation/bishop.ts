// ローテーションのカード能力（bishop。トークン・クレスト含む）。書き方は docs/rotation-authoring.md

import type { Ability, CardAbilities, Effect } from "../../../engine/dsl";
import {
  ENHANCED,
  EVENT,
  FROM_EVENT,
  OPP_LEADER,
  OWN_TURN,
  RELEASED_ULTIMATE,
  SUPER_EVOLVE_TURN,
  THIS,
  THIS_EVOLVED,
  act,
  addFaith,
  addToHand,
  allFollowers,
  allyAmulets,
  allyCards,
  allyFollowers,
  banish,
  boardCards,
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
  draw,
  evolveIt,
  fanfare,
  fromCards,
  gainPp,
  grant,
  grantAttacksTemp,
  grantNoAttack,
  handCards,
  heal,
  id,
  inHand,
  lastWords,
  loseLastWords,
  minCost,
  mode,
  modeAll,
  onAllyAct,
  onAllyDestroyed,
  onAllyDraw,
  onAllySuperEvolve,
  onAttack,
  onBanishedSide,
  onEnter,
  onEvolve,
  onEvolved,
  onLeaderHealedEach,
  onSuperEvolve,
  onTurnEnd,
  onTurnStart,
  oppFollowers,
  otherAllyFollowers,
  otherFollowers,
  random,
  repeat,
  returnToDeck,
  silence,
  slot,
  slotMatches,
  spell,
  spendFaith,
  summon,
  superEvolveIt,
  transform,
  union,
  when,
} from "../helpers";

/** これのカウントを amount 進める（-1 で1減る） */
const countdown = (amount: number): Effect => ({ op: "countdown", target: THIS, amount });
/** 自分の場のアミュレットの枚数が3以上なら */
const AMULETS_3 = countAtLeast(allyAmulets(), 3);
/** 自分の場に元のコスト6以上のカードがあるなら */
const HAS_COST6 = countAtLeast(allyCards({ originalCostMin: 6 }), 1);
/** 場の他のカード（両方の場のフォロワー・アミュレット） */
const otherBoardCards = () => boardCards("both", { excludeSelf: true });
/** このバトル中に破壊された自分の「元のコスト2以下の、【ラストワード】を持つアミュレット」 */
const DESTROYED_LW_AMULETS = destroyedCards({ type: "amulet", originalCostMax: 2, hasLastWords: true });
/** 自分のアミュレットを選んだなら（選んだときのカードで判定） */
const CHOSE_OWN_AMULET = slotMatches("t", { type: "amulet" }, true);
/** 結晶: 【カウントダウン_N】【ラストワード】『name』1枚を自分の場に出す。（more は結晶の他の能力） */
const crystalOf = (name: string, cost: number, countdownN: number, ...more: Ability[]) => ({
  cost,
  countdown: countdownN,
  abilities: [lastWords(summon(name)), ...more],
});

// 【ファンファーレ】と同じ能力が【進化時】【超進化時】にも働くカード
const FORESIGHT: Effect[] = [choose(oppFollowers()), damage(slot(), 2)];
const CHOOSE_DESTROY: Effect[] = [choose(oppFollowers()), destroy(slot())];
const INITIA: Effect[] = [choose(oppFollowers()), banish(slot()), when(AMULETS_3, [heal(3)])];

// 第10弾: 相手の場のフォロワー1枚を選ぶ。それを消滅（ラピッドハット・亜教の偶像・地害の矯正者）
const CHOOSE_BANISH: Effect[] = [choose(oppFollowers()), banish(slot())];
/** 第10弾: 自分の『クレスト：地害の三悪・ラピッドハット』のカウントを+1する */
const RAPIDHAT_CREST_PLUS1: Effect = { op: "countdown", target: crestsOf("self", "地害の三悪・ラピッドハット"), amount: 1 };

export const BISHOP_ROT: Record<string, CardAbilities> = {
  // ---- 第4弾 ----
  [id("英雄幻視・トルー")]: { abilities: [onAllyAct(grant(THIS, ["drain"]))] },
  [id("清く正しい修道女・ラムレッダ")]: {
    abilities: [onTurnEnd(when(THIS_EVOLVED, [damage(allFollowers(), 2)])), onEvolve(grantNoAttack(THIS, "endOfTurn"))],
  },
  [id("リーリエ・ライツ")]: {
    // アクトでは選ぶのを「これを破壊」より先にする（docs/rules.md 11章）
    abilities: [act(2, choose(allyFollowers()), destroy(THIS), transform(slot(), "リーリエ・ライツ"), draw(1))],
  },
  [id("砂神の巫女・サラ")]: {
    abilities: [
      fanfare(when(ENHANCED, [buff(THIS, 0, 10)])),
      onEvolve(choose(oppFollowers({ damaged: true })), destroy(slot())),
    ],
  },
  [id("ゼエン教の僧侶・ソフィア")]: {
    abilities: [
      fanfare({ op: "summonFromDeck", filter: { type: "follower", class: "bishop", costMax: 2 }, kinds: 1 }),
      onSuperEvolve(grant(otherAllyFollowers(), ["barrier"])),
    ],
  },
  [id("空を征く艇")]: {
    abilities: [
      inHand(onAllyAct(costChange(THIS, -1))),
      act(0, choose(allyFollowers({ notEvolved: true })), destroy(THIS), evolveIt(slot())),
    ],
  },
  [id("魔杖の外科医・ティコ")]: {
    abilities: [onAllyAct(heal(1)), onEvolve(choose(oppFollowers()), damage(slot(), 3))],
  },
  [id("レ・フィーエの宝石")]: {
    // モードは「これを破壊」より先に選ぶ。破壊は各モードの先頭で行い、書かれた順を保つ
    abilities: [
      act(0, mode([destroy(THIS), random(oppFollowers(), 1, "r"), destroy(slot("r"))], [destroy(THIS), draw(2)])),
    ],
  },
  [id("土の理・ガレヲン")]: {
    cannotAttack: true,
    // 「自分の場の」なのでこれ自身も候補（攻撃できないので常に「攻撃していない」）
    abilities: [
      onTurnEnd(
        when(SUPER_EVOLVE_TURN, [random(allyFollowers({ notAttacked: true, notEvolved: true }), 1, "r"), evolveIt(slot("r"))]),
      ),
    ],
  },
  [id("威容なる星晶騎士・ヴィーラ")]: {
    damageCap: { atLeast: 4, to: 3 },
    abilities: [fanfare(choose(oppFollowers(), 2), banish(slot()), when(RELEASED_ULTIMATE, [superEvolveIt(THIS)]))],
  },

  // ---- 第5弾 ----
  [id("フォアサイトプリースト")]: { abilities: [fanfare(...FORESIGHT), onEvolve(...FORESIGHT)] },
  [id("結びの使徒")]: {
    abilities: [
      fanfare(when(ENHANCED, [draw(1), grant(THIS, ["bane"])])),
      onAllyDraw({}, when(OWN_TURN, [grant(THIS, ["rush"])])),
    ],
  },
  [id("霧巻花の激憤")]: { abilities: [spell(random(handCards(), 1, "r"), returnToDeck(slot("r")), draw(3))] },
  [id("イムーバブルパラディン")]: { abilities: [fanfare(summon("イムーバブルパラディン", 3))] },
  [id("窮鼠の斎女")]: {
    abilities: [
      fanfare(draw(1)),
      onAllyDraw({}, when(OWN_TURN, [damage(oppFollowers(), 1)])),
      onEvolve(draw(1)),
    ],
  },
  [id("プロテクションシェル")]: {
    abilities: [act(0, destroy(THIS), draw(count(allyFollowers({ keyword: "ward" }))))],
  },
  [id("威徳の至聖")]: {
    // 超進化では【進化時】と【超進化時】の両方が働く（1回復が2回）
    abilities: [
      fanfare(heal(1)),
      onLeaderHealedEach(when(OWN_TURN, [summon("清純なる白狐")])),
      onEvolve(heal(1)),
      onSuperEvolve(heal(1)),
    ],
  },
  [id("堅固なる霧巻花")]: {
    abilities: [
      fanfare(choose(oppFollowers()), damage(slot(), 5)),
      act(0, destroy(THIS), random(handCards(), 2, "r"), returnToDeck(slot("r")), draw(2)),
    ],
  },
  [id("想う《力》・ソフィーナ")]: {
    abilities: [
      fanfare(
        mode(
          [evolveIt(THIS)],
          [
            random(otherAllyFollowers({ keyword: "ward", notEvolved: true }), 1, "r"),
            evolveIt(slot("r")),
            buff(slot("r"), 1, 1),
          ],
        ),
      ),
      onTurnEnd(when(THIS_EVOLVED, [buff(otherFollowers(), -1, -1)])),
    ],
  },
  [id("霧巻花・クキシロ")]: {
    abilities: [fanfare(crest("霧巻花・クキシロ"), random(handCards(), 2, "r"), returnToDeck(slot("r")), draw(2))],
  },

  // ---- 第6弾 ----
  [id("崇奉の怯者")]: {
    abilities: [onEnter(heal(2))],
    crystallize: crystalOf("崇奉の怯者", 2, 3),
  },
  [id("汚濁の聖水")]: {
    abilities: [lastWords(draw(1), random(oppFollowers(), 1, "r"), destroy(slot("r"))), act(1, countdown(-1))],
  },
  [id("天書授与")]: { abilities: [spell(draw(2, { type: "amulet" }))] },
  [id("崇敬の塗布者")]: { abilities: [], crystallize: crystalOf("崇敬の塗布者", 1, 3) },
  [id("ペガサスの乗り手")]: {
    abilities: [fanfare(summon("ホーリーファルコン")), onEvolve(summon("ホーリーファルコン"))],
  },
  [id("救済の聖典")]: { abilities: [lastWords(draw(2), damage(oppFollowers(), 2), heal(2))] },
  [id("崇拝の聖騎士")]: {
    abilities: [fanfare(summon("崇拝の聖騎士")), onEvolve(...CHOOSE_DESTROY)],
    crystallize: crystalOf("崇拝の聖騎士", 1, 3),
  },
  [id("崇高の天書")]: {
    abilities: [
      fanfare(choose(otherBoardCards()), destroy(slot()), when(CHOSE_OWN_AMULET, [gainPp(2)])),
      lastWords(copy(DESTROYED_LW_AMULETS, 1, "board")),
    ],
  },
  [id("崇高の憎悪・カンディマ")]: {
    abilities: [
      fanfare(copy(DESTROYED_LW_AMULETS, 2, "board", { kinds: true })),
      onSuperEvolve(choose(otherBoardCards()), destroy(slot()), when(CHOSE_OWN_AMULET, [damage(oppFollowers(), 3)])),
    ],
  },
  [id("旧き天書・リアントース")]: {
    abilities: [
      fanfare(choose(otherBoardCards(), 3), destroy(slot())),
      onTurnEnd(spendFaith(10, addToHand("天書の深淵"))),
    ],
    faith: { abilities: [onAllyDestroyed({ type: "amulet" }, addFaith(1))] },
  },

  // ---- 第7弾 ----
  [id("営利の支援者")]: {
    abilities: [fanfare(when(AMULETS_3, [summon("営利の支援者")])), lastWords(draw(1))],
  },
  [id("ブロードミッショナリー")]: {
    abilities: [
      fanfare(draw(2, { type: "amulet" })),
      onEvolve(damage(oppFollowers(), count(handCards({ type: "amulet" })))),
    ],
  },
  [id("陽光の耳飾り")]: {
    abilities: [
      fanfare(choose(handCards()), returnToDeck(slot()), draw(1)),
      act(0, choose(handCards()), destroy(THIS), returnToDeck(slot()), draw(1)),
    ],
  },
  [id("ホーリープランナー")]: {
    abilities: [fanfare(when(AMULETS_3, [choose(oppFollowers()), damage(slot(), 5)]))],
  },
  [id("伝達の聖鳥")]: {
    abilities: [fanfare(choose(oppFollowers()), banish(slot()), when(AMULETS_3, [heal(3)]))],
  },
  [id("無欠の時計")]: {
    abilities: [
      fanfare(when(ENHANCED, [damage(oppFollowers(), 1)])),
      act(0, destroy(THIS), damage(oppFollowers(), 1)),
    ],
  },
  [id("審理の守衛")]: {
    // 「3以上なら、これは進化する。これは【バリア】を持つ。」の条件は両方に掛かるものとした（推定）
    abilities: [fanfare(when(AMULETS_3, [evolveIt(THIS), grant(THIS, ["barrier"])])), lastWords(heal(3))],
  },
  [id("海蝕の三叉槍")]: {
    abilities: [
      fanfare(choose(oppFollowers()), damage(slot(), 4)),
      act(0, choose(oppFollowers()), destroy(THIS), damage(slot(), 2)),
    ],
  },
  [id("裁神のアナテマ・ロデオ")]: {
    abilities: [
      fanfare(summon("月影の指輪")),
      onEvolve(random(allyAmulets({ ids: [id("月影の指輪")] }), 1, "r"), { op: "countdown", target: slot("r"), amount: 1 }),
    ],
  },
  [id("アドアマネージャー・イニシア")]: { abilities: [fanfare(...INITIA), onSuperEvolve(...INITIA)] },

  // ---- 第8弾 ----
  [id("図書室の魔女・リリウム")]: {
    abilities: [lastWords(draw(1)), onEvolve(choose(oppFollowers()), silence(slot()), damage(slot(), 2))],
  },
  [id("エルゴンプリーステス・テレサ")]: {
    abilities: [fanfare(summon("癒しのシスター", 1, "s"), buff(slot("s"), 2, -2), grant(slot("s"), ["storm"]))],
  },
  [id("イモータルハンター・グラント")]: { abilities: [fanfare(...CHOOSE_DESTROY), onEvolve(...CHOOSE_DESTROY)] },
  [id("天陽の使徒・エーディット")]: {
    abilities: [
      lastWords(summon("天陽の使徒・エーディット", 1, "s"), loseLastWords(slot("s"))),
      onSuperEvolve(...CHOOSE_DESTROY),
    ],
  },
  [id("アビスリサーチャー・ヴィーチェ")]: {
    abilities: [inHand(onAllySuperEvolve({ type: "follower" }, costChange(THIS, -3)))],
  },
  [id("脅威の残滓")]: {
    // 【エンハンス_5】なら選ばずにすべて
    abilities: [
      spell(
        when(ENHANCED, [banish(oppFollowers({ defenseMax: 3 }))], [choose(oppFollowers({ defenseMax: 3 })), banish(slot())]),
      ),
    ],
  },
  [id("セイントエクソシスト・コレット")]: {
    abilities: [
      fanfare(when(countAtLeast(allyFollowers({ evolved: true }), 1), [evolveIt(THIS)])),
      onEvolved(repeat(2, random(oppFollowers(), 1, "r"), damage(slot("r"), 1))),
    ],
  },
  [id("朋友の学級")]: {
    abilities: [
      onTurnEnd(
        draw(1),
        when(
          countAtLeast(allyFollowers({ superEvolved: true }), 1),
          [heal(2)],
          [when(countAtLeast(allyFollowers({ evolved: true }), 1), [heal(1)])],
        ),
      ),
    ],
  },
  [id("飛躍の姉妹・ベルディリア＆カステル")]: {
    // デッキから出したカードを指す対象が無いので、出す前の自分の場のフォロワーをスロット "before" に入れておき、
    // 出した後の「before に無い自分のフォロワー」を出したカードとする
    abilities: [
      fanfare(
        random(allyFollowers(), 5, "before"),
        { op: "summonFromDeck", filter: { type: "follower", costMax: 2 }, kinds: 1 },
        random(allyFollowers({ notInSlot: "before" }), 1, "s"),
        superEvolveIt(slot("s")),
      ),
      onSuperEvolve(crest("飛躍の姉妹・ベルディリア＆カステル")),
    ],
  },
  [id("希望の光彩・リテュエル")]: {
    abilities: [
      fanfare(mode([damage(oppFollowers(), 3)], [damage(OPP_LEADER, 3)], [heal(3)]), damage(THIS, 3)),
      onEvolve(crest("希望の光彩・リテュエル")),
    ],
  },

  // ---- 第9弾 ----
  [id("条規の構成員")]: { abilities: [onLeaderHealedEach(when(OWN_TURN, [evolveIt(THIS)]))] },
  [id("ペリュトン")]: { abilities: [fanfare(summon("ペリュトン", 2))] },
  [id("咆哮の聖堂")]: {
    abilities: [
      lastWords(summon("ホーリーフレイムタイガー"), random(oppFollowers(), 1, "r"), damage(slot("r"), 4)),
      act(3, countdown(-3)),
    ],
  },
  [id("紀律の諜報員")]: {
    abilities: [fanfare(grant(THIS, ["ambush"], "untilOpponentTurnEnd")), onTurnEnd(heal(1))],
  },
  [id("ミラクルアルミラージ")]: {
    abilities: [],
    crystallize: crystalOf("ミラクルアルミラージ", 1, 3, act(1, countdown(-1))),
  },
  [id("刻みし約束")]: {
    abilities: [spell(modeAll(HAS_COST6, [random(oppFollowers(), 1, "r"), damage(slot("r"), 3)], [heal(2)]))],
  },
  [id("誓言の幹部")]: {
    abilities: [
      fanfare(heal(2)),
      onLeaderHealedEach(when(OWN_TURN, [random(oppFollowers(), 1, "r"), destroy(slot("r"))])),
      onSuperEvolve(heal(2)),
    ],
  },
  [id("神紋ユラティオ")]: {
    abilities: [fanfare(destroy(allFollowers())), act(1, destroy(THIS), draw(1), heal(1))],
  },
  [id("神紋の咎人・エルラーデ")]: {
    abilities: [fanfare(...CHOOSE_DESTROY), onEvolve(crest("神紋の咎人・エルラーデ"))],
  },
  [id("翼天の変貌・オルメリオ")]: {
    abilities: [
      onAllyDestroyed(
        { type: "amulet" },
        cycleEffects([random(oppFollowers(), 2, "r"), damage(slot("r"), 3)], [heal(2)], [summon("ホーリーファルコン")]),
      ),
      onEvolve(destroy(allyAmulets())),
    ],
  },

  // ---- 第10弾「ニーゲルヘリア神殺事件」 ----
  [id("地害の加工人")]: { abilities: [lastWords(addToHand("神域の物証", 2))] },
  [id("孤高なる鍛錬")]: {
    abilities: [spell(choose(allyFollowers()), buff(slot(), 2, 2), grant(slot(), ["barrier"]))],
  },
  [id("地害の調教師")]: { abilities: [fanfare(addToHand("地害の兎")), onEvolve(gainPp(1))] },
  [id("不毛の証言")]: {
    // （1）は相手のフォロワーがいなくてもクレストを持つものとした（推定）
    abilities: [
      spell(mode([random(oppFollowers(), 1, "r"), damage(slot("r"), 4), crest("不毛の証言")], [summon("地害の兎")])),
    ],
  },
  [id("有翼の奏者")]: {
    abilities: [fanfare(summon("ホーリーファルコン")), onEvolve(buff(otherAllyFollowers(), 1, 1))],
  },
  [id("荒廃の繁殖")]: {
    abilities: [spell(when(ENHANCED, [summon("地害の兎", 4)], [summon("地害の兎", 2)]))],
  },
  [id("地害の三悪・ラピッドハット")]: {
    // 超進化では【進化時】（クレスト。カウント1）の後に【超進化時】（+1）が働くので、クレストのカウントは2になる
    abilities: [
      fanfare(...CHOOSE_BANISH, summon("地害の兎")),
      onEvolve(crest("地害の三悪・ラピッドハット")),
      onSuperEvolve(RAPIDHAT_CREST_PLUS1),
    ],
  },
  [id("亜教の偶像")]: {
    cannotAttack: true,
    // コピーは元のカード（場での強化・進化は写さない）。これ自身の【進化時】で消滅させたものにも働く
    abilities: [
      onBanishedSide("opponent", { type: "follower" }, when(OWN_TURN, [copy(FROM_EVENT, 1, "board")])),
      onEvolve(...CHOOSE_BANISH),
    ],
  },
  [id("闘志の修行僧")]: { abilities: [onAttack(buff(THIS, 2, 2), grant(THIS, ["barrier"]))] },
  [id("地害の矯正者")]: {
    abilities: [fanfare(...CHOOSE_BANISH, summon("地害の兎", 2)), onSuperEvolve(draw(2), heal(2))],
  },
  // 第10弾のトークン
  [id("地害の兎")]: {
    // 「場に出たとき」なので能力で出たときも働く。手札が無ければ消滅は起きず、進化だけする
    abilities: [
      onEnter(random(minCost(handCards()), 1, "r"), banish(slot("r")), evolveIt(THIS)),
      lastWords(damage(OPP_LEADER, 2)),
    ],
  },

  // ---- トークン ----
  [id("月影の指輪")]: {
    abilities: [onTurnEnd(when(AMULETS_3, [damage(union(oppFollowers(), OPP_LEADER), 3)]))],
  },
  [id("天書の深淵")]: {
    // 「自分のアミュレットを選んだなら」は手札に加える方にも掛かるものとした（掛からなければ毎ターン使い回せる。推定）
    abilities: [
      spell(
        choose(boardCards("both")),
        destroy(slot()),
        when(CHOSE_OWN_AMULET, [damage(OPP_LEADER, 2), addToHand("天書の深淵")]),
      ),
    ],
  },
};

/** このクラスのカードが与えるクレストの能力（キーは crestIdOf("カード名")） */
export const BISHOP_ROT_CRESTS: Record<string, CardAbilities> = {
  [crestIdOf("霧巻花・クキシロ")]: {
    abilities: [
      onAllyDraw({ costIn: [1, 3, 5] }, when(OWN_TURN, [copy(fromCards("清純なる白狐", "ホーリーファルコン"), 1, "board")])),
      onAllyDraw(
        { costIn: [2, 4, 6] },
        when(OWN_TURN, [copy(fromCards("清純なる白狐", "ホーリーファルコン"), 1, "board", { side: "opponent" })]),
      ),
    ],
  },
  [crestIdOf("飛躍の姉妹・ベルディリア＆カステル")]: {
    abilities: [
      {
        trigger: { on: "allyAttack", filter: { type: "follower", superEvolved: true }, followerOnly: true },
        effects: [grantAttacksTemp(EVENT, 2)],
      },
    ],
  },
  [crestIdOf("希望の光彩・リテュエル")]: {
    abilities: [lastWords(summon("希望の光彩・リテュエル", 1, "s"), evolveIt(slot("s")))],
  },
  [crestIdOf("神紋の咎人・エルラーデ")]: {
    // 「…あるなら、相手のリーダーに1ダメージ。自分のリーダーを1回復。」の条件は回復にも掛かるものとした（推定）
    abilities: [onTurnEnd(when(HAS_COST6, [damage(OPP_LEADER, 1), heal(1)]))],
  },

  // ---- 第10弾「ニーゲルヘリア神殺事件」（【カウントダウン】はデータから読む） ----
  [crestIdOf("不毛の証言")]: { abilities: [onTurnStart(heal(1), addToHand("神域の物証"))] },
  [crestIdOf("地害の三悪・ラピッドハット")]: { abilities: [onTurnStart(summon("地害の兎"))] },
};
