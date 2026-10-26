// テスト・自己対戦用のデッキ生成

import { ALL_CARDS, CARDS_BY_ID, DECK_SIZE, MAX_COPIES, STARTER, inFormat, type ClassId, type Format } from "../cards";
import { shuffle, type GameState, type Rng } from "../engine";

/** 指定クラスの、そのフォーマット（既定はスターター）の合法なデッキをランダムに作る */
export function randomDeck(deckClass: Exclude<ClassId, "neutral">, rng: Rng, format: Format = STARTER): string[] {
  const candidates = ALL_CARDS.filter(
    (c) => inFormat(format, c) && (c.class === deckClass || c.class === "neutral"),
  );
  const pool = candidates.flatMap((c) => Array.from({ length: MAX_COPIES }, () => c.id));
  shuffle(pool, rng);
  return pool.slice(0, DECK_SIZE);
}

/** スターター以外のカードを含むデッキか（エンジンがローテーションの補正を使う試合。rust/engine/src/game.rs の ext.rotation と同じ判定） */
export function isRotationDeck(cards: readonly string[]): boolean {
  return cards.some((id) => {
    const c = CARDS_BY_ID.get(id);
    return c !== undefined && !inFormat(STARTER, c);
  });
}

/** ローテーションのデッキの試合の局面か（ブラウザでローテーションの試合の補正を読み込むか決める） */
export function isRotationState(state: GameState): boolean {
  return state.players.some((p) => p.ext?.rotation === true);
}
