// デッキ一覧（保存したデッキ・デフォルトデッキ）と、新規作成・インポート。デフォルトデッキとデッキ構築は画面で選んだフォーマットのもの

import type { ComponentChildren } from "preact";
import { useState } from "preact/hooks";
import { CLASS_NAMES } from "../cards";
import { DECK_CLASSES, deckToText, parseDeckText, type Deck, type DeckClass } from "../cards/deck";
import { DeckBuilder } from "./DeckBuilder";
import { ExportBox } from "./ExportBox";
import { defaultDeckChoice, formatDecks, FORMATS, isPlayableIn, type FormatId } from "./format";
import { newDeckId, type SavedDeck } from "./storage";

interface Props {
  decks: readonly SavedDeck[];
  format: FormatId;
  onChange: (decks: SavedDeck[]) => void;
}

/** 今のフォーマットで使えないデッキに付ける説明（ほかのフォーマットで使えるならそれを書く） */
function unplayableNote(format: FormatId, deck: Deck): string {
  if (isPlayableIn(format, deck)) return "";
  const other = (Object.keys(FORMATS) as FormatId[]).find((f) => f !== format && isPlayableIn(f, deck));
  return other ? `（${FORMATS[other].name}用）` : "（未完成）";
}

type Editing = { id: string | null; deck: Deck };

export function Decks({ decks, format, onChange }: Props) {
  const [editing, setEditing] = useState<Editing | null>(null);
  const [newClass, setNewClass] = useState<DeckClass>("elf");
  const [importText, setImportText] = useState("");
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [exporting, setExporting] = useState<string | null>(null);

  if (editing) {
    return (
      <DeckBuilder
        initial={editing.deck}
        format={format}
        onCancel={() => setEditing(null)}
        onSave={(deck) => {
          const saved: SavedDeck = { ...deck, id: editing.id ?? newDeckId(), updatedAt: Date.now() };
          onChange(editing.id ? decks.map((d) => (d.id === editing.id ? saved : d)) : [saved, ...decks]);
          setEditing({ id: saved.id, deck });
        }}
      />
    );
  }

  function importDeck() {
    const { deck, errors } = parseDeckText(importText);
    setImportErrors(errors);
    if (deck) {
      setImportText("");
      setEditing({ id: null, deck });
    }
  }

  const row = (key: string, deck: Deck, buttons: ComponentChildren) => (
    <li key={key} class={`deck-row class-${deck.class}`}>
      <div class="deck-row-main">
        <strong>{deck.name}</strong>
        <span class="muted">
          {CLASS_NAMES[deck.class]} / {deck.cards.length}枚{unplayableNote(format, deck)}
        </span>
      </div>
      <div class="row-buttons">{buttons}</div>
      {exporting === key && <ExportBox text={deckToText(deck)} fileName={deck.name} />}
    </li>
  );
  const exportButton = (key: string) => (
    <button type="button" onClick={() => setExporting(exporting === key ? null : key)}>
      エクスポート
    </button>
  );

  return (
    <div class="decks">
      <section class="panel">
        <h2>新しいデッキ</h2>
        <div class="row-buttons">
          <select value={newClass} onChange={(e) => setNewClass(e.currentTarget.value as DeckClass)}>
            {DECK_CLASSES.map((c) => (
              <option key={c} value={c}>
                {CLASS_NAMES[c]}
              </option>
            ))}
          </select>
          <button
            type="button"
            class="primary"
            onClick={() => setEditing({ id: null, deck: { name: `${CLASS_NAMES[newClass]}デッキ`, class: newClass, cards: [] } })}
          >
            作成
          </button>
        </div>
      </section>

      <section class="panel">
        <h2>保存したデッキ</h2>
        {decks.length === 0 ? (
          <p class="muted">まだありません。保存したデッキはこのブラウザに保存されます。</p>
        ) : (
          <ul class="deck-list">
            {decks.map((d) =>
              row(
                d.id,
                d,
                <>
                  <button type="button" onClick={() => setEditing({ id: d.id, deck: d })}>
                    編集
                  </button>
                  <button
                    type="button"
                    onClick={() => onChange([{ ...d, id: newDeckId(), name: `${d.name}のコピー`, updatedAt: Date.now() }, ...decks])}
                  >
                    複製
                  </button>
                  {exportButton(d.id)}
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`「${d.name}」を削除しますか？`)) onChange(decks.filter((x) => x.id !== d.id));
                    }}
                  >
                    削除
                  </button>
                </>,
              ),
            )}
          </ul>
        )}
      </section>

      {formatDecks(format).length > 0 && (
        <section class="panel">
          <h2>デフォルトデッキ（{FORMATS[format].name}）</h2>
          <ul class="deck-list">
            {formatDecks(format).map((d) =>
              row(
                defaultDeckChoice(format, d.key),
                d,
                <>
                  <button type="button" onClick={() => setEditing({ id: null, deck: { ...d, name: `${d.name}のコピー` } })}>
                    コピーして編集
                  </button>
                  {exportButton(defaultDeckChoice(format, d.key))}
                </>,
              ),
            )}
          </ul>
        </section>
      )}

      <section class="panel">
        <h2>インポート</h2>
        <p class="muted">エクスポートしたテキストを貼り付けてください。</p>
        <textarea
          rows={6}
          value={importText}
          placeholder={"名前: エルフテスト\nクラス: エルフ\n3 フェアリーテイマー\n..."}
          onInput={(e) => setImportText(e.currentTarget.value)}
        />
        <div class="row-buttons">
          <button type="button" disabled={importText.trim() === ""} onClick={importDeck}>
            読み込む
          </button>
        </div>
        {importErrors.length > 0 && (
          <ul class="problems">
            {importErrors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
