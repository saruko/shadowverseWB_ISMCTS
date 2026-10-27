// カード能力の定義を簡潔に書くための補助関数。生成されるのは src/engine/dsl.ts のデータ。

import rawCards from "../../../data/cards.json";
import type {
  Ability,
  CardFilter,
  CardSource,
  CardStat,
  Condition,
  Duration,
  Effect,
  Side,
  Target,
  Trigger,
  Value,
} from "../../engine/dsl";
import type { StaticKeyword } from "../../engine/types";

// 同名の再録（第1弾のカードが第8弾にもある等）は、先に出た版（ID の小さい方。cards.json は ID 順）を引く
const ID_BY_NAME = new Map<string, string>();
for (const c of rawCards as { id: string; name: string }[]) if (!ID_BY_NAME.has(c.name)) ID_BY_NAME.set(c.name, c.id);

/** カード名からカードIDを引く（定義の読みやすさのため名前で書く） */
export function id(name: string): string {
  const v = ID_BY_NAME.get(name);
  if (!v) throw new Error(`カードがありません: ${name}`);
  return v;
}

// ---- 対象 ----

export const THIS: Target = { kind: "this" };
export const EVENT: Target = { kind: "event" };
export const SELF_LEADER: Target = { kind: "leader", side: "self" };
export const OPP_LEADER: Target = { kind: "leader", side: "opponent" };
export const BOTH_LEADERS: Target = { kind: "leader", side: "both" };
export const slot = (name = "t"): Target => ({ kind: "slot", slot: name });
export const union = (...of: Target[]): Target => ({ kind: "union", of });

const followers = (side: "self" | "opponent" | "both", filter: CardFilter = {}): Target => ({
  kind: "board",
  side,
  filter: { type: "follower", ...filter },
});
export const oppFollowers = (filter?: CardFilter) => followers("opponent", filter);
export const allyFollowers = (filter?: CardFilter) => followers("self", filter);
/** 自分の場の他のフォロワー */
export const otherAllyFollowers = (filter?: CardFilter) => followers("self", { excludeSelf: true, ...filter });
export const allFollowers = (filter?: CardFilter) => followers("both", filter);
export const allyCards = (filter?: CardFilter): Target => ({ kind: "board", side: "self", ...(filter ? { filter } : {}) });
export const allyAmulets = (filter?: CardFilter): Target => ({ kind: "board", side: "self", filter: { type: "amulet", ...filter } });
export const handCards = (filter?: CardFilter): Target => ({ kind: "hand", ...(filter ? { filter } : {}) });

// ---- 能力 ----

const ability = (trigger: Trigger, effects: Effect[], extra: Partial<Ability> = {}): Ability => ({ trigger, effects, ...extra });

export const fanfare = (...effects: Effect[]) => ability({ on: "fanfare" }, effects);
export const spell = (...effects: Effect[]) => ability({ on: "spell" }, effects);
export const lastWords = (...effects: Effect[]) => ability({ on: "lastWords" }, effects);
export const onEvolve = (...effects: Effect[]) => ability({ on: "evolve" }, effects);
/** 【超進化時】（【進化時】に加えて働く） */
export const onSuperEvolve = (...effects: Effect[]) => ability({ on: "superEvolve" }, effects);
/** 【超進化時】「〜ではなく」（【進化時】を置き換える） */
export const onSuperEvolveInstead = (...effects: Effect[]) => ability({ on: "superEvolve" }, effects, { replacesEvolve: true });
export const onEvolved = (...effects: Effect[]) => ability({ on: "evolved" }, effects);
export const onAttack = (...effects: Effect[]) => ability({ on: "attack" }, effects);
export const onClash = (...effects: Effect[]) => ability({ on: "clash" }, effects);
export const onEnter = (...effects: Effect[]) => ability({ on: "enter" }, effects);
export const onTurnStart = (...effects: Effect[]) => ability({ on: "turnStart" }, effects);
export const onTurnEnd = (...effects: Effect[]) => ability({ on: "turnEnd", whose: "self" }, effects);
export const onOpponentTurnEnd = (...effects: Effect[]) => ability({ on: "turnEnd", whose: "opponent" }, effects);
export const onAllyEnter = (filter: CardFilter, ...effects: Effect[]) => ability({ on: "allyEnter", filter }, effects);
export const act = (cost: number, ...effects: Effect[]) => ability({ on: "act", cost }, effects);
export const onAllyAct = (...effects: Effect[]) => ability({ on: "allyAct" }, effects);
/** 自分が証拠・アミュレットを【アクト】したとき（第10弾） */
export const onEvidenceAct = (...effects: Effect[]) => ability({ on: "allyAct", filter: { evidence: true } }, effects);
export const onFused = (...effects: Effect[]) => ability({ on: "fused" }, effects);
export const onAllyFuse = (...effects: Effect[]) => ability({ on: "allyFuse" }, effects);
/** 自分がアミュレットを【融合】したとき（素材にアミュレットがある。第10弾） */
export const onAmuletFuse = (...effects: Effect[]) => ability({ on: "allyFuse", filter: { type: "amulet" } }, effects);
export const onSpellboost = (...effects: Effect[]) => ability({ on: "spellboost" }, effects);
export const onAllyLeaveInHand = (...effects: Effect[]) => ability({ on: "allyLeaveInHand" }, effects);
export const onDiscarded = (...effects: Effect[]) => ability({ on: "discarded" }, effects);
export const onAllyDestroyed = (filter: CardFilter, ...effects: Effect[]) => ability({ on: "allyDestroyed", filter }, effects);
export const onLeaderHealed = (...effects: Effect[]) => ability({ on: "leaderHealed" }, effects, { oncePerOwnTurn: true });
export const oncePerOwnTurn = (a: Ability): Ability => ({ ...a, oncePerOwnTurn: true });

// ---- 効果 ----

/** プレイ・進化・アクトで働く能力では、ほかの効果より前に書く（対象は行動したときに選ぶ。docs/rules.md 11章） */
export const choose = (from: Target, count = 1, name = "t"): Effect => ({ op: "choose", slot: name, from, count });
export const random = (from: Target, count = 1, name = "t"): Effect => ({ op: "random", slot: name, from, count });
export const mode = (...options: Effect[][]): Effect => ({ op: "mode", options });

export const damage = (target: Target, amount: Value): Effect => ({ op: "damage", target, amount });
export const distribute = (target: Target, amount: Value): Effect => ({ op: "distribute", target, amount });
export const destroy = (target: Target, countVar?: string): Effect =>
  countVar ? { op: "destroy", target, countVar } : { op: "destroy", target };
export const banish = (target: Target): Effect => ({ op: "banish", target });
export const bounce = (target: Target): Effect => ({ op: "bounce", target });
export const heal = (amount: Value, target: Target = SELF_LEADER): Effect => ({ op: "heal", target, amount });
export const setDefense = (target: Target, value: number): Effect => ({ op: "setDefense", target, value });

export const draw = (count: Value, filter?: CardFilter): Effect => (filter ? { op: "draw", count, filter } : { op: "draw", count });
export const addToHand = (name: string, count: Value = 1): Effect => ({ op: "addToHand", cardId: id(name), count });
export const summon = (name: string, count: Value = 1, name2?: string): Effect =>
  name2 ? { op: "summon", cardId: id(name), count, slot: name2 } : { op: "summon", cardId: id(name), count };
export const returnToDeck = (target: Target): Effect => ({ op: "returnToDeck", target });
export const discard = (target: Target, countVar?: string): Effect => (countVar ? { op: "discard", target, countVar } : { op: "discard", target });
export const transform = (target: Target, name: string): Effect => ({ op: "transform", target, cardId: id(name) });

export const buff = (target: Target, attack: Value, defense: Value, duration?: Duration): Effect =>
  duration ? { op: "buff", target, attack, defense, duration } : { op: "buff", target, attack, defense };
export const grant = (target: Target, keywords: StaticKeyword[], duration?: Duration): Effect =>
  duration ? { op: "grant", target, keywords, duration } : { op: "grant", target, keywords };
export const grantAbilities = (target: Target, abilities: Ability[]): Effect => ({ op: "grant", target, abilities });
export const grantAttacks = (target: Target, maxAttacks: number): Effect => ({ op: "grant", target, maxAttacks });
export const evolveIt = (target: Target = THIS): Effect => ({ op: "evolve", target, kind: "evolve" });
export const superEvolveIt = (target: Target): Effect => ({ op: "evolve", target, kind: "superEvolve" });

export const spellboost = (target: Target, times: number): Effect => ({ op: "spellboost", target, times });
export const costChange = (target: Target, amount: number): Effect => ({ op: "costChange", target, amount });

export const gainPp = (amount: Value | "max"): Effect => ({ op: "gainPp", amount });
export const addSigils = (amount: Value): Effect => ({ op: "addSigils", amount });
export const earthRite = (amount: number, ...then: Effect[]): Effect => ({ op: "earthRite", amount, then });
export const necromancy = (amount: number, ...then: Effect[]): Effect => ({ op: "necromancy", amount, then });
export const crest = (name: string, side: "self" | "opponent" = "self"): Effect => ({ op: "crest", crestId: crestIdOf(name), side });

export const when = (cond: Condition, then: Effect[], otherwise?: Effect[]): Effect =>
  otherwise ? { op: "if", cond, then, else: otherwise } : { op: "if", cond, then };
export const repeat = (times: Value, ...effects: Effect[]): Effect => ({ op: "repeat", times, effects });

// ---- 条件・値 ----

export const AWAKENED: Condition = { kind: "awakened" };
export const ENHANCED: Condition = { kind: "enhanced" };
export const combo = (atLeast: number): Condition => ({ kind: "combo", atLeast });
export const COMBO: Value = { kind: "combo" };
export const SIGILS: Value = { kind: "sigils" };
export const THIS_X: Value = { kind: "thisX" };
export const THIS_ATTACK: Value = { kind: "thisAttack" };
export const count = (of: Target): Value => ({ kind: "count", of });
export const v = (name: string): Value => ({ kind: "var", name });

// ---- ローテーションで足した仕組み（docs/rules.md 12章） ----

const LATEST_ID_BY_NAME = new Map<string, string>();
for (const c of rawCards as { id: string; name: string }[]) LATEST_ID_BY_NAME.set(c.name, c.id);

/** カード名から後に出た版（ID の大きい方）のカードIDを引く。同名の再録で、ローテーションの版の能力を定義するときに使う */
export function rid(name: string): string {
  const v = LATEST_ID_BY_NAME.get(name);
  if (!v) throw new Error(`カードがありません: ${name}`);
  return v;
}

// 対象
export const oppHand = (filter?: CardFilter): Target => ({ kind: "hand", side: "opponent", ...(filter ? { filter } : {}) });
export const deckCards = (filter?: CardFilter, side: Side = "self"): Target => ({ kind: "deck", side, ...(filter ? { filter } : {}) });
/** クレスト（名前は「クレスト：」を除いたカード名） */
export const crestsOf = (side: Side, ...names: string[]): Target =>
  names.length > 0 ? { kind: "crests", side, ids: names.map(crestIdOf) } : { kind: "crests", side };
export const leftmost = (of: Target, count = 1): Target => ({ kind: "leftmost", of, count });
export const MIN_HP_LEADERS: Target = { kind: "minHpLeaders" };
/** 場の他のフォロワー（両方の場） */
export const otherFollowers = (filter?: CardFilter) => followers("both", { excludeSelf: true, ...filter });
/** 自分の場の他のカード（フォロワー・アミュレット） */
export const otherAllyCards = (filter?: CardFilter): Target => ({ kind: "board", side: "self", filter: { excludeSelf: true, ...filter } });
export const boardCards = (side: Side, filter?: CardFilter): Target => ({ kind: "board", side, ...(filter ? { filter } : {}) });

// 誘発
export const onAllyPlay = (filter: CardFilter, ...effects: Effect[]) => ability({ on: "allyPlay", filter }, effects);
/** 自分がカードを【エンハンス】でプレイしたとき */
export const onEnhancePlay = (...effects: Effect[]) => ability({ on: "allyPlay", enhanced: true }, effects);
export const onAllyEvolve = (filter: CardFilter, ...effects: Effect[]) => ability({ on: "allyEvolve", filter }, effects);
export const onAllySuperEvolve = (filter: CardFilter, ...effects: Effect[]) =>
  ability({ on: "allyEvolve", filter, superOnly: true }, effects);
export const onEnemyEnter = (filter: CardFilter, ...effects: Effect[]) => ability({ on: "enemyEnter", filter }, effects);
export const onBuffed = (...effects: Effect[]) => ability({ on: "buffed" }, effects);
export const onDrawn = (...effects: Effect[]) => ability({ on: "drawn" }, effects);
export const onAllyDraw = (filter: CardFilter, ...effects: Effect[]) => ability({ on: "allyDraw", filter }, effects);
export const onAllyAttack = (filter: CardFilter, ...effects: Effect[]) => ability({ on: "allyAttack", filter }, effects);
export const onEnemyAttackLeader = (filter: CardFilter, ...effects: Effect[]) =>
  ability({ on: "enemyAttack", filter, leaderOnly: true }, effects);
export const onSuperEvolved = (...effects: Effect[]) => ability({ on: "superEvolved" }, effects);
export const onDirectSummoned = (...effects: Effect[]) => ability({ on: "directSummoned" }, effects);
export const onEarthRite = (...effects: Effect[]) => ability({ on: "earthRite" }, effects);
/** side の場のカードが破壊されたとき（『スケルトン』が破壊されたとき 等） */
export const onDestroyed = (side: Side, filter: CardFilter, ...effects: Effect[]) => ability({ on: "allyDestroyed", filter, side }, effects);
/** 自分のリーダーが回復したとき（自分のターンごとに1回の制限なし） */
export const onLeaderHealedEach = (...effects: Effect[]) => ability({ on: "leaderHealed" }, effects);
/** 「手札で働く」 */
export const inHand = (a: Ability): Ability => ({ ...a, zone: "hand" });
/** 「デッキで働く」 */
export const inDeck = (a: Ability): Ability => ({ ...a, zone: "deck" });

// 効果
/** 【モード】で、条件 cond ならすべて */
export const modeAll = (cond: Condition, ...options: Effect[][]): Effect => ({ op: "mode", options, allIf: cond });
/** 【モード】n つを選んで（組み合わせを選択肢にする。選択肢は（1）（2）…の順のまま） */
export function modePick(n: number, ...options: Effect[][]): Effect {
  const combos: Effect[][] = [];
  const rec = (start: number, picked: number[]) => {
    if (picked.length === n) {
      combos.push(picked.flatMap((i) => options[i] ?? []));
      return;
    }
    for (let i = start; i < options.length; i++) rec(i + 1, [...picked, i]);
  };
  rec(0, []);
  return { op: "mode", options: combos };
}
export const randomEffects = (count: number, ...options: Effect[][]): Effect => ({ op: "randomEffects", options, count });
/** 下記の能力から働いていないランダム1つ */
export const randomUnused = (...options: Effect[][]): Effect => ({ op: "randomEffects", options, count: 1, unused: true });
export const cycleEffects = (...options: Effect[][]): Effect => ({ op: "cycleEffects", options });
export const triggerOwnFanfare: Effect = { op: "triggerOwn", on: "fanfare" };
export const copy = (
  from: CardSource,
  count: Value,
  dest: "hand" | "board" | "deck",
  opts: { side?: Side; kinds?: boolean; slot?: string; hidden?: boolean } = {},
): Effect => ({ op: "copy", from, count, dest, ...opts });
/** 『名前』N枚を自分のデッキに加える */
export const addToDeck = (name: string, count: Value = 1): Effect => copy(fromCards(name), count, "deck");
/** 『名前』N枚を相手の場に出す */
export const summonOpp = (name: string, count: Value = 1): Effect => ({ op: "summon", cardId: id(name), count, side: "opponent" });
/** 『名前』を手札に加え、slot にする（「それは〜」と続くとき） */
export const addToHandAs = (name: string, slotName: string, count: Value = 1): Effect => ({
  op: "addToHand",
  cardId: id(name),
  count,
  slot: slotName,
});
export const setCost = (target: Target, value: number, duration?: Duration): Effect =>
  duration ? { op: "setCost", target, value, duration } : { op: "setCost", target, value };
export const costChangeTemp = (target: Target, amount: number): Effect => ({ op: "costChange", target, amount, duration: "endOfTurn" });
export const silence = (target: Target): Effect => ({ op: "silence", target });
export const randomKeywords = (target: Target, from: StaticKeyword[], count: number): Effect => ({ op: "randomKeywords", target, from, count });
export const loseLastWords = (target: Target): Effect => ({ op: "loseLastWords", target });
export const gainEp = (amount = 1): Effect => ({ op: "gainEp", amount });
export const gainSep = (amount = 1): Effect => ({ op: "gainSep", amount });
export const moveToBoard = (target: Target): Effect => ({ op: "moveToBoard", target });
export const directSummon: Effect = { op: "directSummon" };
export const payPp = (amount: number, ...then: Effect[]): Effect => ({ op: "payPp", amount, then });
export const addFaith = (amount = 1): Effect => ({ op: "addFaith", amount });
export const spendFaith = (amount: number, ...then: Effect[]): Effect => ({ op: "spendFaith", amount, then });
export const grantFaith = (...abilities: Ability[]): Effect => ({ op: "grantFaith", abilities });
export const splitRandom = (total: Value, ...vars: string[]): Effect => ({ op: "splitRandom", total, vars });
/** 「フォロワーやリーダーを攻撃できない。」を持つ（duration 省略は永続） */
export const grantNoAttack = (target: Target, duration?: Duration): Effect =>
  duration ? { op: "grant", target, noAttack: true, duration } : { op: "grant", target, noAttack: true };
export const grantAttacksTemp = (target: Target, maxAttacks: number): Effect => ({ op: "grant", target, maxAttacks, duration: "endOfTurn" });
export const addGauge = (target: Target, amount = 1): Effect => ({ op: "addGauge", target, amount });
export const opponentDraws = (count: Value): Effect => ({ op: "draw", count, side: "opponent" });
export const drawAs = (count: Value, slotName: string, filter?: CardFilter): Effect =>
  filter ? { op: "draw", count, filter, slot: slotName } : { op: "draw", count, slot: slotName };

// ---- 第10弾（docs/rules.md 12章） ----
/** 証拠・アミュレット */
export const EVIDENCE_AMULET: CardFilter = { type: "amulet", evidence: true };
/** 自分の場の証拠の数 */
export const EVIDENCE: Value = { kind: "evidence" };
/** 「自分の場の証拠を-N（して、…）」（足りなければ何も起きず、後の能力も働かない。0 になったら破壊） */
export const spendEvidence = (amount: number, ...then: Effect[]): Effect => ({ op: "spendEvidence", amount, then });
/** これが場で消滅したとき */
export const onBanished = (...effects: Effect[]) => ability({ on: "banished" }, effects);
/** 自分の（side の）カードが場で消滅したとき */
export const onAllyBanished = (filter: CardFilter, ...effects: Effect[]) => ability({ on: "allyBanished", filter }, effects);
export const onBanishedSide = (side: Side, filter: CardFilter, ...effects: Effect[]) => ability({ on: "allyBanished", filter, side }, effects);
/** このターン中に自分がアミュレット（evidence なら証拠・アミュレット）を【アクト】していた */
export const actedThisTurn = (evidence = false): Condition => (evidence ? { kind: "actedThisTurn", evidence } : { kind: "actedThisTurn" });
export const swapStats = (target: Target = THIS): Effect => ({ op: "swapStats", target });
export const setStats = (target: Target, attack: Value, defense: Value): Effect => ({ op: "setStats", target, attack, defense });
export const halveLeaderMaxHp = (side: Side = "opponent"): Effect => ({ op: "halveLeaderMaxHp", side });
export const minCost = (of: Target): Target => ({ kind: "minCost", of });
export const sameName = (of: Target, slotName = "t"): Target => ({ kind: "sameName", of, slot: slotName });
export const maxAttack = (of: Target): Target => ({ kind: "maxAttack", of });
export const THIS_DEFENSE: Value = { kind: "thisDefense" };
export const leaderMissingHp = (side: Side = "opponent"): Value => ({ kind: "leaderMissingHp", side });

// 条件
export const ULTIMATE: Condition = { kind: "ultimate", atLeast: 10 };
export const RELEASED_ULTIMATE: Condition = { kind: "ultimate", atLeast: 15 };
export const link = (atLeast: number): Condition => ({ kind: "link", atLeast });
export const OWN_TURN: Condition = { kind: "ownTurn" };
export const THIS_EVOLVED: Condition = { kind: "thisEvolved" };
export const SUPER_EVOLVE_TURN: Condition = { kind: "superEvolveTurn" };
export const valueAtLeast = (value: Value, atLeast: number): Condition => ({ kind: "valueAtLeast", value, atLeast });
export const countAtLeast = (of: Target, atLeast: number): Condition => valueAtLeast(count(of), atLeast);
export const slotMatches = (slotName: string, filter?: CardFilter, own = false): Condition =>
  filter ? { kind: "slotMatches", slot: slotName, filter, own } : { kind: "slotMatches", slot: slotName, own };
export const DECK_NO_DUPLICATES: Condition = { kind: "deckNoDuplicates" };
export const ATTACKED_LEADER_LAST_TURN: Condition = { kind: "attackedLeaderLastTurn" };
export const enhancedAtLeast = (atLeast: number): Condition => ({ kind: "enhancedAtLeast", atLeast });
export const and = (...conds: Condition[]): Condition => ({ kind: "and", conds });
export const not = (cond: Condition): Condition => ({ kind: "not", cond });

// 値
export const slotStat = (slotName: string, stat: CardStat): Value => ({ kind: "slotStat", slot: slotName, stat });
export const eventStat = (stat: CardStat): Value => ({ kind: "eventStat", stat });
export const THIS_COST: Value = { kind: "thisCost" };
export const FAITH: Value = { kind: "faith" };
export const sub = (a: Value, b: Value): Value => ({ kind: "sub", a, b });
export const enteredCount = (filter?: CardFilter): Value => (filter ? { kind: "enteredCount", filter } : { kind: "enteredCount" });
export const enteredKinds = (filter?: CardFilter): Value => (filter ? { kind: "enteredKinds", filter } : { kind: "enteredKinds" });

// copy・transform の元
export const fromZone = (
  zone: "hand" | "deck" | "board",
  side: Side,
  pick: "random" | "left" | "all",
  filter?: CardFilter,
): CardSource => ({ kind: "zone", zone, side, pick, ...(filter ? { filter } : {}) });
export const destroyedCards = (filter?: CardFilter, highestCost = false): CardSource => ({
  kind: "destroyed",
  ...(filter ? { filter } : {}),
  ...(highestCost ? { highestCost } : {}),
});
export const fromSlot = (slotName = "t"): CardSource => ({ kind: "slot", slot: slotName });
export const FROM_THIS: CardSource = { kind: "this" };
export const FROM_EVENT: CardSource = { kind: "event" };
export const fromCards = (...names: string[]): CardSource => ({ kind: "cards", ids: names.map(id) });
export const transformFrom = (target: Target, from: CardSource): Effect => ({ op: "transform", target, from });

// ---- クレスト ----

import rawCrests from "../../../data/crests.json";
const CREST_ID_BY_NAME = new Map((rawCrests as { id: string; name: string }[]).map((c) => [c.name, c.id]));
export function crestIdOf(name: string): string {
  const v2 = CREST_ID_BY_NAME.get(`クレスト：${name}`);
  if (!v2) throw new Error(`クレストがありません: ${name}`);
  return v2;
}
