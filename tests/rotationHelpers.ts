// ローテーションのカードのテスト用の補助（tests/rotation-<クラス>.test.ts から使う）

import { ALL_CARDS } from "../src/cards";
import {
  applyAction,
  createGame,
  legalActions,
  newBoardCard,
  newHandCard,
  type Action,
  type FollowerOnBoard,
  type GameState,
  type PlayerIndex,
} from "../src/engine";

/** カード名からカードID。同名の再録があれば後に出た版（ローテーションの版） */
export const rid = (name: string): string => {
  const cards = ALL_CARDS.filter((c) => c.name === name);
  const card = cards[cards.length - 1];
  if (!card) throw new Error(`カードがありません: ${name}`);
  return card.id;
};

/** ローテーションの能力のないフォロワー。デッキをこれで埋めると、このバトル中の記録（連携など）を取る対戦になる */
export const FILLER = rid("燃え滾る闘志・フェザー");

/**
 * マリガン後、先攻のターン中の状態。PP は 10、手札は空。デッキはローテーションのカード（FILLER と deck で渡したもの）。
 * turn で自分のターン数（進化・超進化の解禁や奥義ゲージに効く）を決められる
 */
export function setup(opts: { seed?: number; deck?: string[]; oppDeck?: string[]; turn?: number } = {}): {
  s: GameState;
  me: PlayerIndex;
  opp: PlayerIndex;
} {
  const fill = (names: string[] = []) => {
    const ids = names.map(rid);
    return [...ids, ...Array(40 - ids.length).fill(FILLER)];
  };
  // 先攻（me）が deck を使うように、先攻がプレイヤー1なら入れ替えて作り直す（先攻は decks によらずシードで決まる）
  const seed = opts.seed ?? 1;
  let s = createGame({ decks: [fill(opts.deck), fill(opts.oppDeck)], seed });
  if (s.first === 1) s = createGame({ decks: [fill(opts.oppDeck), fill(opts.deck)], seed });
  s = applyAction(s, { type: "mulligan", player: s.first, swap: [] });
  s = applyAction(s, { type: "mulligan", player: (1 - s.first) as PlayerIndex, swap: [] });
  const me = s.active;
  const opp = (1 - me) as PlayerIndex;
  // 手札を空にする。deck・oppDeck で渡したカードが初期手札に来ていたら、山札に戻す
  for (const p of [me, opp]) {
    for (const h of s.players[p].hand) if (h.cardId !== FILLER) s.players[p].deck.push({ iid: h.iid, cardId: h.cardId });
    s.players[p].hand = [];
  }
  s.players[me].pp = s.players[me].maxPp = 10;
  if (opts.turn !== undefined) s.players[me].turnCount = opts.turn;
  return { s, me, opp };
}

export function toHand(s: GameState, p: PlayerIndex, name: string): number {
  const h = newHandCard(s, rid(name));
  s.players[p].hand.push(h);
  return h.iid;
}

export function toBoard(s: GameState, p: PlayerIndex, name: string, opts: Partial<FollowerOnBoard> = {}) {
  const c = newBoardCard(s, rid(name));
  if (c.kind === "follower") Object.assign(c, { enteredTurn: 0, ...opts });
  s.players[p].board.push(c);
  return c;
}

export const can = (s: GameState, a: Action) => legalActions(s).some((x) => JSON.stringify(x) === JSON.stringify(a));
export const board = (s: GameState, p: PlayerIndex) => s.players[p].board;
export const names = (s: GameState, p: PlayerIndex) => board(s, p).map((c) => ALL_CARDS.find((x) => x.id === c.cardId)?.name);
export const handNames = (s: GameState, p: PlayerIndex) =>
  s.players[p].hand.map((c) => ALL_CARDS.find((x) => x.id === c.cardId)?.name);
export const follower = (s: GameState, iid: number) =>
  [...s.players[0].board, ...s.players[1].board].find((c) => c.iid === iid) as FollowerOnBoard | undefined;

/** カードをプレイする（選択・モードがあれば choices を順に答える。数なら mode、配列なら choose） */
export function play(s: GameState, iid: number, ...choices: (number | number[])[]): GameState {
  let t = applyAction(s, { type: "play", iid });
  for (const c of choices) t = applyAction(t, typeof c === "number" ? { type: "mode", index: c } : { type: "choose", targets: c });
  return t;
}

/** 自分のターンを n 回進める（相手は何もしない） */
export function passTurns(s: GameState, n: number): GameState {
  for (let i = 0; i < n; i++) s = applyAction(applyAction(s, { type: "endTurn" }), { type: "endTurn" });
  return s;
}
