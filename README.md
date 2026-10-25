# shadowverseWB_ISMCTS

シャドウバース ワールズビヨンド（Shadowverse: Worlds Beyond）の対戦シミュレータと、その上で育てる対戦 AI です。
ローテーションのカードをすべて実装したルールエンジン（Rust）と、相手の手札を何通りも仮定して読む探索 AI、自己対戦で学んだ評価の補正を持ちます。

[wistery-k/Shadowverse-Wb-Sim](https://github.com/wistery-k/Shadowverse-Wb-Sim)（スターター向けのシミュレータ）を元にした改造版です。

> **非公式ファンプロジェクト**です。Cygames 社および関連企業とは一切関係ありません。
> ゲーム名・カード名・カードテキストの権利は各権利者に帰属します。
> 本リポジトリは画像・音源などのアセットを一切含みません。

## できること

- **ルールエンジン**: スターター（第1弾＋ベーシック）と、ローテーション（ベーシック＋直近6パック）の全カード・トークン・クレストの能力。
  ルールの仕様と出典は [`docs/rules.md`](docs/rules.md)。決定的（シード付き乱数）で、決まった試合の結果をゴールデンテストで固定している
- **AI**:
  - 探索 AI: 相手の手札を何通りも引き直して、自分のターン末までのビームサーチと、相手のターンの読みで手を選ぶ。手で作った評価関数に、自己対戦の TD 学習で作った補正（小さなニューラルネットワーク）を足して点数にする
  - 貪欲法（1 手読み）・ランダム
- **自動対戦**: デッキ × AI の総当たりと勝率表（`npm run sim`）、AI の設定どうしの比較（`svwb compare`）、自己対戦の書き出しと補正の学習（`svwb td selfplay`・`npm run td`）
- **ブラウザの画面**: 人間 vs AI の対戦、デッキ構築、AI 対戦の勝率表とリプレイ、局面を編集して AI の考えを見るサンドボックス（サーバーなし。AI もブラウザの中で動く）
- **デッキ**: スターターのデッキ（`data/decks`）と、ローテーションの環境デッキ 14 個（`data/decks-rotation`。プロリーグの公開デッキリストと攻略サイトの Tier 表から選んだ。出典は各ファイルの先頭）

## 状況（2026-10-25）

| 項目 | 状況 |
| --- | --- |
| ルールエンジン | スターター・ローテーションとも全カード実装済み（第9弾まで） |
| 探索 AI（スターター） | 貪欲法に約 7 割、補正なしの探索 AI に 5 割強勝つ。実験の記録は [`docs/ai-notes.md`](docs/ai-notes.md) |
| 探索 AI（ローテーション） | 補正にローテーションのカードを足した段階（属性から埋めた重み）。自己対戦での学び直しはこれから |
| ブラウザの画面 | スターターのデッキで対戦・AI 対戦。ローテーションのデッキはまだ画面に出ない |

## 動かし方

Node と Rust（cargo）が要ります。WASM 向けのターゲットを入れておきます（`rustup target add wasm32-unknown-unknown`）。
`npm test`・`npm run dev`・`npm run build` は先にエンジンの WASM を作ります（`npm run wasm`）。

```sh
npm install
npm run dev        # 開発サーバー（ブラウザの画面）
npm test           # テスト
npm run typecheck  # 型チェック
npm run build      # 本番ビルド（dist/）
npm run fetch-cards # 公式カード一覧APIのレスポンスを data/raw/ に取得（全カード。1 秒ずつ待って取る）
npm run cards      # data/raw/*.json から data/cards.json・crests.json を生成
py -I scripts/fetch_cards.py --out <フォルダ>  # data/raw/*.json を パック名/クラス名/cards.json に分けて書き出す（閲覧用。Python が要る）
npm run sim        # デフォルトデッキの AI 同士の総当たり（例: npm run sim -- --games 50 --agents greedy,random。ローテーションのデッキは --format rotation）
npm run compare    # 探索 AI の設定同士の比較（例: npm run compare -- 105 '{}' '{"lethal":false}'）
                   # sim と compare は試合を CPU のコア数だけ並列に行う（並列数は環境変数 THREADS で指定）
npm run sim-report # sim の --json の結果（--shard で分けたものも）を Markdown の表にまとめる
npm run game       # 1試合だけ行い、行動の列を表示する（リプレイ画面の「再現に必要な情報」のコマンド）
npm run svwb       # Rust 版の CLI（ゴールデンテスト・計測・自己対戦・比較。rust/README.md）
npm run td         # 評価の補正の学習（自己対戦は svwb td selfplay）
npm run pack-run   # 1 回分の出力（自己対戦・モデル・ログ）を、共有フォルダに上げる .tar.gz にまとめる
```

各コマンドが受け付ける引数の一覧は [`docs/commands.md`](docs/commands.md) にあります。
ローテーションのデッキで補正を学び直す一連の手順は `bash scripts/rotation-retrain.sh <作業フォルダ>`（中身はファイルの先頭）です。

## ディレクトリ構成

```
rust/
  engine/   ルールエンジンと AI（UI 非依存・決定的・シード付き乱数）。自己対戦・比較の CLI（svwb）
  wasm/     ブラウザ・Node から呼ぶ WASM
src/
  engine/   局面の型・能力の DSL と、WASM のエンジンを呼ぶ関数
  cards/    カード定義（data/cards.json からの読み込みと検証）・能力の定義（rotation/ がローテーションのカード）
  ai/       選べる AI の一覧と、AI の思考を行う Web Worker
  ui/       ブラウザ UI
  sim/      AI vs AI の自動対戦ランナー
data/
  cards.json・crests.json  カードデータ（scripts/convert-cards.ts で生成）
  decks/           スターターのデッキ（data/decks/README.md）
  decks-rotation/  ローテーションのデッキ（data/decks-rotation/README.md）
  value-net.json   学習した評価の補正（スターター）
  raw/             公式カード一覧APIのレスポンス（コミットしない）
docs/
  rules.md          実装するルールの仕様メモ（出典付き）
  ai-notes.md       AI の実験記録（試したこと・結果・採否）
  commands.md       コマンドと引数の一覧
  rotation-authoring.md  ローテーションのカードの能力の書き方
tests/
scripts/
```

## CI

`main` を含むすべての push と PR で、`.github/workflows/ci.yml` が TypeScript の型チェック・テスト・ビルドと、Rust の書式・lint・テスト（ゴールデンテストを含む）を回します。
`main` への push ごとに「自動対戦」ワークフロー（`.github/workflows/auto-match.yml`）が、探索 AI どうしでデフォルトデッキの総当たりを回し、勝率表を Actions の実行結果のサマリーに出します。

GitHub Pages には公開しません。

## ライセンス

未定です。元のリポジトリにもライセンスの記載がなく、カードデータの取り扱いが確定してから決めます。
