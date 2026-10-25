// カード能力を宣言的に記述するためのデータ型。
// 能力はすべて JSON シリアライズ可能なデータで、エンジン（rust/engine/src/effects.rs）が解釈する。
// 能力の定義は src/cards/abilities/ にカードIDごとに置く。

import type { CardType, ClassId } from "../cards/types";
import type { StaticKeyword } from "./types";

/** 能力の持ち主から見た陣営 */
export type Side = "self" | "opponent" | "both";

/** カードの条件。省略した項目は問わない。 */
export interface CardFilter {
  type?: CardType;
  tribe?: string;
  class?: ClassId;
  /** カードID（いずれか） */
  ids?: string[];
  costMax?: number;
  /** コストが Value と等しい */
  costEq?: Value;
  defenseMax?: number;
  keyword?: StaticKeyword;
  /** 進化前（進化も超進化もしていない） */
  notEvolved?: boolean;
  /** 「他の」: 能力の持ち主自身を除く */
  excludeSelf?: boolean;
  /** 【スペルブースト時】を持つ */
  spellboost?: boolean;
  /** 【土の印】アミュレット */
  earthSigil?: boolean;
  // ---- ローテーションで足した条件（docs/rules.md 12章） ----
  costMin?: number;
  /** コストがこのいずれか */
  costIn?: number[];
  originalCostMin?: number;
  originalCostMax?: number;
  originalCostEq?: number;
  originalCostIn?: number[];
  /** 元のコストが Value と等しい */
  originalCostEqValue?: Value;
  notTribe?: string;
  /** 進化後（超進化を含む） */
  evolved?: boolean;
  superEvolved?: boolean;
  /** ダメージを受けている */
  damaged?: boolean;
  /** このターン中に攻撃していない */
  notAttacked?: boolean;
  /** 【ラストワード】を持つ */
  hasLastWords?: boolean;
  /** 能力を誘発させたカード（event）を除く */
  excludeEvent?: boolean;
  /** スロットのカードを除く（「選んでいない」） */
  notInSlot?: string;
  /** カードに書かれたキーワード（手札・山札のカードにも使う。keyword は場のカードだけ） */
  cardKeyword?: StaticKeyword;
}

/** 対象の集合。解決すると実体ID（iid、リーダーは負の値）の配列になる。 */
export type Target =
  | { kind: "this" }
  | { kind: "leader"; side: Side }
  | { kind: "board"; side: Side; filter?: CardFilter }
  | { kind: "hand"; filter?: CardFilter; side?: Side }
  /** 山札のカード */
  | { kind: "deck"; side?: Side; filter?: CardFilter }
  /** クレスト（ids があればそのクレストだけ） */
  | { kind: "crests"; side: Side; ids?: string[] }
  /** 左から count 枚（手札は並び順、場は場に出た順） */
  | { kind: "leftmost"; of: Target; count: number }
  /** 体力が最小のリーダーすべて */
  | { kind: "minHpLeaders" }
  | { kind: "slot"; slot: string }
  /** 能力を誘発させたカード（場に出たフォロワー、交戦相手など） */
  | { kind: "event" }
  | { kind: "union"; of: Target[] }
  /** 攻撃力が最大のものに絞る */
  | { kind: "maxAttack"; of: Target };

/** 数値 */
export type Value =
  | number
  | { kind: "var"; name: string }
  | { kind: "count"; of: Target }
  | { kind: "combo" }
  | { kind: "sigils" }
  | { kind: "thisAttack" }
  /** スロットのカードのコストの合計 */
  | { kind: "costOf"; slot: string }
  /** これの X（ストームブラスト等） */
  | { kind: "thisX" }
  /** このターン中に破壊された自分のフォロワー（条件付き）の元の攻撃力/体力の合計 */
  | { kind: "destroyedThisTurn"; stat: "attack" | "defense"; filter?: CardFilter }
  // ---- ローテーションで足した値（docs/rules.md 12章） ----
  /** スロットのカード（先頭）の値。場・手札を離れていれば選んだときのカードの元の値 */
  | { kind: "slotStat"; slot: string; stat: CardStat }
  /** 能力を誘発させたカードの値 */
  | { kind: "eventStat"; stat: CardStat }
  /** これのコスト（プレイ・捨てたときのコスト。手札にあれば今のコスト） */
  | { kind: "thisCost" }
  /** 自分の信仰値 */
  | { kind: "faith" }
  | { kind: "sub"; a: Value; b: Value }
  /** このバトル中に場に出た自分のフォロワーのうち条件に合う枚数（filter.excludeSelf ならこれを除く） */
  | { kind: "enteredCount"; filter?: CardFilter }
  /** 同じく、その種類の数 */
  | { kind: "enteredKinds"; filter?: CardFilter };

export type CardStat = "attack" | "defense" | "cost" | "originalCost";

export type Condition =
  | { kind: "awakened" }
  | { kind: "combo"; atLeast: number }
  | { kind: "enhanced" }
  | { kind: "superEvolveTurn" }
  | { kind: "thisSuperEvolved" }
  | { kind: "handCount"; atMost: number }
  | { kind: "attackingFollower" }
  | { kind: "varAtLeast"; name: string; value: number }
  | { kind: "thisXAtLeast"; value: number }
  | { kind: "maxPp"; atLeast: number }
  | { kind: "not"; cond: Condition }
  // ---- ローテーションで足した条件（docs/rules.md 12章） ----
  /** 奥義ゲージが atLeast 以上（奥義 10・解放奥義 15） */
  | { kind: "ultimate"; atLeast: number }
  /** 【連携_N】 */
  | { kind: "link"; atLeast: number }
  | { kind: "leaderHpAtMost"; side: Side; value: number }
  /** 自分のリーダーの体力が相手のリーダーの体力より大きい */
  | { kind: "leaderHpGreater" }
  /** これが進化後（超進化を含む） */
  | { kind: "thisEvolved" }
  | { kind: "ownTurn" }
  | { kind: "valueAtLeast"; value: Value; atLeast: number }
  /** スロットのカード（選んだときのカード）が条件に合う。own なら自分のカード */
  | { kind: "slotMatches"; slot: string; filter?: CardFilter; own?: boolean }
  | { kind: "deckNoDuplicates" }
  /** 直前の自分のターンに自分のフォロワーがリーダーを攻撃していた */
  | { kind: "attackedLeaderLastTurn" }
  /** このバトル中に自分がプレイしたカードの元のコストに from〜to がすべて含まれる */
  | { kind: "playedCostsCover"; from: number; to: number }
  | { kind: "thisCostEq"; value: number }
  /** これに【融合】していた */
  | { kind: "fused" }
  | { kind: "evolvedCountAtLeast"; atLeast: number }
  | { kind: "handSameCostAtLeast"; atLeast: number }
  /** 自分の手札の元のコストの大きい順に n 枚の合計が、相手の同じ合計より大きい */
  | { kind: "handTopCostGreater"; n: number }
  /** エンハンスで atLeast 以上の PP を払った（エンハンスが複数あるカード） */
  | { kind: "enhancedAtLeast"; atLeast: number }
  | { kind: "and"; conds: Condition[] };

export type Duration = "permanent" | "endOfTurn" | "untilOpponentTurnEnd";

/** copy・transform の元になるカード */
export type CardSource =
  | { kind: "zone"; zone: "hand" | "deck" | "board"; side: Side; filter?: CardFilter; pick: "random" | "left" | "all" }
  /** このバトル中に破壊された自分のカード（filter.type がアミュレットならアミュレット、それ以外はフォロワー） */
  | { kind: "destroyed"; filter?: CardFilter; highestCost?: boolean }
  /** スロットのカード（選んだときのカード） */
  | { kind: "slot"; slot: string }
  | { kind: "this" }
  | { kind: "event" }
  /** 書かれたカードからランダム（1種類なら常にそのカード） */
  | { kind: "cards"; ids: string[] };

export type Effect =
  // 選択・乱数
  | { op: "choose"; slot: string; from: Target; count: number }
  | { op: "random"; slot: string; from: Target; count: Value }
  /** allIf の条件なら選ばずにすべて（（1）から順に）。「2つを選んで」は組み合わせを選択肢にする（helpers の modePick） */
  | { op: "mode"; options: Effect[][]; allIf?: Condition }
  // ダメージ・破壊・移動
  | { op: "damage"; target: Target; amount: Value }
  | { op: "distribute"; target: Target; amount: Value }
  | { op: "destroy"; target: Target; countVar?: string }
  | { op: "banish"; target: Target; countVar?: string }
  | { op: "bounce"; target: Target }
  | { op: "heal"; target: Target; amount: Value }
  | { op: "setDefense"; target: Target; value: number }
  // カードの生成・移動
  | { op: "draw"; count: Value; filter?: CardFilter; side?: Side; slot?: string; kinds?: boolean }
  | { op: "drawAll"; filter: CardFilter; slot?: string }
  | { op: "addToHand"; cardId: string; count: Value; slot?: string }
  | { op: "summon"; cardId: string; count: Value; slot?: string; side?: Side }
  /** スロットのカードと同名のカードを場に出す（コピー） */
  | { op: "summonCopy"; from: string; slot?: string }
  | { op: "reanimate"; cost: number; slot?: string }
  /** デッキの条件に合うカードからランダムに N 種類を場に出す */
  | { op: "summonFromDeck"; filter: CardFilter; kinds: number }
  /** このバトル中に破壊された自分の元のコスト最大のアミュレットからランダム1枚と同名のカードを場に出す */
  | { op: "summonDestroyedAmulet" }
  | { op: "returnToDeck"; target: Target; countVar?: string }
  | { op: "discard"; target: Target }
  | { op: "transform"; target: Target; cardId?: string; from?: CardSource }
  // 能力値・能力の付与
  | { op: "buff"; target: Target; attack: Value; defense: Value; duration?: Duration }
  | {
      op: "grant";
      target: Target;
      keywords?: StaticKeyword[];
      maxAttacks?: number;
      abilities?: Ability[];
      duration?: Duration;
      /** 「フォロワーやリーダーを攻撃できない」 */
      noAttack?: boolean;
    }
  | { op: "loseKeyword"; target: Target; keyword: StaticKeyword }
  | { op: "cannotAttack"; target: Target; until: "opponentTurnEnd" }
  | { op: "evolve"; target: Target; kind: "evolve" | "superEvolve" }
  // 手札
  | { op: "spellboost"; target: Target; times: number }
  | { op: "costChange"; target: Target; amount: number; duration?: Duration }
  | { op: "addX"; target: Target; amount: number }
  | { op: "countdown"; target: Target; amount: number }
  // リソース
  | { op: "gainPp"; amount: Value | "max" }
  | { op: "addMaxPp"; amount: number }
  | { op: "addCombo"; amount: number }
  | { op: "addGraveyard"; amount: number }
  | { op: "addSigils"; amount: Value }
  | { op: "earthRite"; amount: number; then: Effect[] }
  | { op: "necromancy"; amount: number; then: Effect[] }
  | { op: "crest"; crestId: string; side: "self" | "opponent" }
  | { op: "apocalypseDeck" }
  | { op: "setLeaderMaxHp"; side: "self" | "opponent"; value: number }
  // 制御
  | { op: "if"; cond: Condition; then: Effect[]; else?: Effect[] }
  | { op: "repeat"; times: Value; effects: Effect[] }
  | { op: "setVar"; name: string; value: Value }
  // ---- ローテーションで足した効果（docs/rules.md 12章） ----
  /** 下記の能力からランダム count 個（unused なら、このカードでまだ働いていないものから） */
  | { op: "randomEffects"; options: Effect[][]; count: number; unused?: boolean }
  /** 下記の能力から順に1つ（カードごとに進む） */
  | { op: "cycleEffects"; options: Effect[][] }
  /** これ自身の【ファンファーレ】をもう一度働かせる */
  | { op: "triggerOwn"; on: "fanfare" }
  /** カードを作って手札・場・山札に加える */
  | {
      op: "copy";
      from: CardSource;
      count: Value;
      dest: "hand" | "board" | "deck";
      side?: Side;
      /** 違う種類を count 種類 */
      kinds?: boolean;
      slot?: string;
      /** 手札に非公開で加える */
      hidden?: boolean;
    }
  | { op: "setCost"; target: Target; value: number; duration?: Duration }
  /** 能力すべてを失う */
  | { op: "silence"; target: Target }
  /** from のキーワードからランダム count 個を持つ */
  | { op: "randomKeywords"; target: Target; from: StaticKeyword[]; count: number }
  | { op: "loseLastWords"; target: Target }
  | { op: "gainEp"; amount: number }
  | { op: "gainSep"; amount: number }
  /** 手札のカードを（プレイせずに）場に出す */
  | { op: "moveToBoard"; target: Target }
  /** これをデッキから場に出す（【直接召喚】） */
  | { op: "directSummon" }
  /** PP を amount 消費して then（足りなければ働かない） */
  | { op: "payPp"; amount: number; then: Effect[] }
  | { op: "addFaith"; amount: number }
  /** 信仰値を amount 減らして then（足りなければ働かない） */
  | { op: "spendFaith"; amount: number; then: Effect[] }
  /** 自分の信仰は能力を持つ */
  | { op: "grantFaith"; abilities: Ability[] }
  /** 合計が total になる0以上の整数をランダムに vars に入れる */
  | { op: "splitRandom"; total: Value; vars: string[] }
  /** リーダーの状態（受けるダメージの上限・加算） */
  | {
      op: "leaderStatus";
      side: Side;
      cap?: { atLeast: number; to: number };
      plus?: number;
      duration?: Duration;
    }
  | { op: "addLeaderMaxHp"; side: Side; amount: number }
  /** 手札のカードの奥義ゲージを +amount */
  | { op: "addGauge"; target: Target; amount: number };

export type Trigger =
  | { on: "fanfare" }
  /** スペルを使ったとき */
  | { on: "spell" }
  | { on: "lastWords" }
  /** EP を使って進化させたとき */
  | { on: "evolve" }
  /** SEP を使って超進化させたとき */
  | { on: "superEvolve" }
  /** 効果を含め、これが進化したとき */
  | { on: "evolved" }
  | { on: "attack" }
  | { on: "clash" }
  | { on: "turnStart" }
  | { on: "turnEnd"; whose: "self" | "opponent" }
  /** 自分のカードが場に出たとき（これ自身は含まない） */
  | { on: "allyEnter"; filter?: CardFilter }
  /** これが場に出たとき */
  | { on: "enter" }
  /** アクト（プレイヤーが起動する） */
  | { on: "act"; cost: number }
  /** 自分がアミュレットをアクトしたとき */
  | { on: "allyAct" }
  /** これに融合したとき */
  | { on: "fused" }
  /** 自分が融合したとき */
  | { on: "allyFuse" }
  /** 手札にある間、スペルブーストされたとき */
  | { on: "spellboost" }
  /** 手札にある間、自分のフォロワーが場を離れたとき */
  | { on: "allyLeaveInHand" }
  | { on: "discarded" }
  /** 自分の（side があればその側の）カードが破壊されたとき。アミュレットは filter.type が amulet のときだけ */
  | { on: "allyDestroyed"; filter?: CardFilter; side?: Side }
  | { on: "leaderHealed" }
  // ---- ローテーションで足した誘発（docs/rules.md 12章） ----
  /** 自分がカードをプレイしたとき（event はプレイしたカード。filter.type はプレイした形） */
  | { on: "allyPlay"; filter?: CardFilter; enhanced?: boolean }
  /** 自分のフォロワーが進化したとき（効果による進化・超進化を含む。superOnly なら超進化だけ） */
  | { on: "allyEvolve"; filter?: CardFilter; superOnly?: boolean }
  | { on: "enemyEnter"; filter?: CardFilter }
  /** これの攻撃力か体力が場で+されたとき */
  | { on: "buffed" }
  /** これを引いたとき */
  | { on: "drawn" }
  /** 自分がカードを引いたとき（event は引いたカード） */
  | { on: "allyDraw"; filter?: CardFilter }
  /** 自分のフォロワーが攻撃するとき（event は攻撃するフォロワー） */
  | { on: "allyAttack"; filter?: CardFilter; leaderOnly?: boolean; followerOnly?: boolean }
  /** 相手のフォロワーが攻撃するとき */
  | { on: "enemyAttack"; filter?: CardFilter; leaderOnly?: boolean }
  /** これが超進化したとき（効果による超進化を含む） */
  | { on: "superEvolved" }
  | { on: "directSummoned" }
  /** 自分が【土の秘術】したとき */
  | { on: "earthRite" };

export interface Ability {
  trigger: Trigger;
  effects: Effect[];
  /** 自分のターンごとに1回 */
  oncePerOwnTurn?: boolean;
  /** 【超進化時】で【進化時】を置き換える（「〜ではなく」） */
  replacesEvolve?: boolean;
  /** 「手札で働く」「デッキで働く」能力（場では働かない） */
  zone?: "hand" | "deck";
}

/** アクセラレート・結晶の能力（cost は払うPP、countdown は結晶のカウントダウン） */
export interface AltPlay {
  cost: number;
  countdown?: number;
  abilities: Ability[];
}

/** カードごとの能力定義 */
export interface CardAbilities {
  abilities: Ability[];
  /** 場を離れる場合、消滅する */
  banishOnLeave?: boolean;
  /** プレイできない */
  unplayable?: boolean;
  /** 相手は能力でこれしか選べない */
  onlySelectable?: boolean;
  /** X の初期値（手札にある間に変化する） */
  initialX?: number;
  /** 【融合】できる素材の条件 */
  fusion?: CardFilter;
  /** テキスト上の能力のうち未実装のもの（説明） */
  unimplemented?: string;
  // ---- ローテーションで足した常在の能力（docs/rules.md 12章） ----
  /** 受ける atLeast 以上のダメージを to にする */
  damageCap?: { atLeast: number; to: number };
  /** 能力によって破壊できない */
  indestructible?: boolean;
  /** フォロワーやリーダーを攻撃できない */
  cannotAttack?: boolean;
  /** 【守護】を無視して攻撃できる */
  ignoreWard?: boolean;
  /** （クレスト）自分のフォロワーの【ファンファーレ】や【エンハンス】は働かない */
  suppressFanfare?: boolean;
  /** アクセラレート（PP が元のコストに足りないときスペルとしてプレイ。能力は spell） */
  accelerate?: AltPlay;
  /** 結晶（PP が元のコストに足りないときカウントダウンアミュレットとしてプレイ） */
  crystallize?: AltPlay;
  /** 信仰（デッキに入れると付く。能力は信仰値を増やす条件など） */
  faith?: { abilities: Ability[] };
}
