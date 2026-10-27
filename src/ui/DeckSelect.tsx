// デッキの選択（対戦の設定・サンドボックスで共通）。選べるデッキは画面で選んだフォーマットのもの

import { CLASS_NAMES } from "../cards";
import { DECK_CLASSES, type DeckClass } from "../cards/deck";
import type { Rng } from "../engine";
import { randomDeck } from "../sim/decks";
import { defaultDeckChoice, formatDecks, FORMATS, isPlayableIn, type FormatId } from "./format";
import type { SavedDeck } from "./storage";

/** デッキの選択肢: "saved:<id>" / "default:<key>"（スターター）/ "rotation:<key>"・"rotation9:<key>"（ローテーション）/ "random:<class>" */
export type DeckChoice = string;

/** 選んだデッキのカード（ランダムならそのフォーマットのカードから rng で作る）。見つからないか、そのフォーマットで使えなければ null */
export function resolveDeck(choice: DeckChoice, saved: readonly SavedDeck[], rng: Rng, format: FormatId): string[] | null {
  const [kind, value] = [choice.slice(0, choice.indexOf(":")), choice.slice(choice.indexOf(":") + 1)];
  if (kind === "saved") {
    const d = saved.find((x) => x.id === value);
    return d && isPlayableIn(format, d) ? d.cards : null;
  }
  if (kind === (format === "starter" ? "default" : format)) return formatDecks(format).find((x) => x.key === value)?.cards ?? null;
  if (kind === "random" && DECK_CLASSES.includes(value as DeckClass)) return randomDeck(value as DeckClass, rng, FORMATS[format]);
  return null;
}

export function DeckSelect({
  value,
  saved,
  format,
  onChange,
}: {
  value: DeckChoice;
  saved: readonly SavedDeck[];
  format: FormatId;
  onChange: (v: DeckChoice) => void;
}) {
  const decks = formatDecks(format);
  return (
    <select value={value} onChange={(e) => onChange(e.currentTarget.value)}>
      {saved.length > 0 && (
        <optgroup label="保存したデッキ">
          {saved.map((d) => (
            <option key={d.id} value={`saved:${d.id}`} disabled={!isPlayableIn(format, d)}>
              {d.name}（{CLASS_NAMES[d.class]}）{isPlayableIn(format, d) ? "" : ` - ${FORMATS[format].name}では使えません`}
            </option>
          ))}
        </optgroup>
      )}
      {decks.length > 0 && (
        <optgroup label="デフォルトデッキ">
          {decks.map((d) => (
            <option key={d.key} value={defaultDeckChoice(format, d.key)}>
              {d.name}（{CLASS_NAMES[d.class]}）
            </option>
          ))}
        </optgroup>
      )}
      <optgroup label="ランダム">
        {DECK_CLASSES.map((c) => (
          <option key={c} value={`random:${c}`}>
            ランダム（{CLASS_NAMES[c]}）
          </option>
        ))}
      </optgroup>
    </select>
  );
}
