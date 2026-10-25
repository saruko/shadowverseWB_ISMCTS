#!/usr/bin/env bash
# ローテーションのデッキ（data/decks-rotation）に合わせて、探索 AI の補正を学び直し、マリガンを比べる（メイン機で回す用）。
# 経緯と結果は docs/ai-notes.md「ローテーションのデッキで補正を学び直す」。
#
#   bash scripts/rotation-retrain.sh <作業フォルダ> [段階 ...]
#
# リポジトリ直下で実行する。段階を省くと全部を順に行う。段階:
#   m0        今の補正（data/value-net.json）の vocab にローテの 14 デッキのカードとトークン・クレストを足し（td extend --vocabDecks）、
#             属性で埋める（td attr --keepA 0）→ <作業フォルダ>/m0.json
#   selfplay  m0 どうしの自己対戦（14 デッキの全組。CHUNK 試合ずつ data/r<i>.jsonl に書く。できているファイルは飛ばすので、止めても続きから回せる）
#   train     data/r*.jsonl のすべてで m0 から学び、間引き（td prune）、属性で埋める（td attr）→ m1.json（途中のものは m1-raw.json・m1-pruned.json）
#   judge     m1 と m0、m1 と今の補正を 14 デッキで比べる（svwb compare。m1 と m0 は選ぶのに使っていない試合番号でも）→ judge-*.log
#   mulligan  m1 で、返し方ごとに引き直しを試すマリガン（sample）と、コスト 4 以上を返すルール（cost）を比べる（svwb mulligan-compare）→ mulligan.log
#
# 数は環境変数で変えられる（かっこ内は既定）:
#   GAMES（60000）自己対戦の試合数、CHUNK（3000）1 ファイルの試合数、START（3200000）最初の試合番号（他の自己対戦と重ならない）、
#   EPOCHS（3）学習のエポック、JUDGE（1000）比べる組の数（1 組 2 試合）、MULL_GAMES（10）マリガンの比べの games（1 につき 14×13×2 組）、
#   THREADS（CPU のコア数）並列数、NODE_OPTIONS（--max-old-space-size=24000）学習のメモリ
# 目安（サブ機 24 スレッドで測った値）: 自己対戦 0.65 秒/試合（介入込み）・1 試合 100KB ほど（6 万試合で 6GB）、compare 0.23 秒/試合。
# 小さく通すなら: GAMES=20 CHUNK=10 EPOCHS=1 JUDGE=7 MULL_GAMES=1 bash scripts/rotation-retrain.sh /tmp/rot-test

set -euo pipefail

if [ $# -lt 1 ]; then
  sed -n '2,24p' "$0"
  exit 1
fi
W="$1"
shift
STAGES="${*:-m0 selfplay train judge mulligan}"
GAMES="${GAMES:-60000}"
CHUNK="${CHUNK:-3000}"
START="${START:-3200000}"
EPOCHS="${EPOCHS:-3}"
JUDGE="${JUDGE:-1000}"
MULL_GAMES="${MULL_GAMES:-10}"
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=24000}"

mkdir -p "$W/data"
LOG="$W/main.log"
# パスはリポジトリ直下からの相対か絶対（どのコマンドもリポジトリ直下で動く）
DECKS="$(ls data/decks-rotation/*.txt | paste -sd, -)"
log() { echo "[$(date '+%F %T')] $*" | tee -a "$LOG"; }

# 自己対戦の打ち方は、スターターの最後の学び直し（docs/ai-notes.md の s2b）と同じ
selfplay_args=(--eps 0.1 --opp beam --iv 3 --ivZone both --imagined 2 --sampling default)

for stage in $STAGES; do
  case "$stage" in
    m0)
      log "m0: vocab を広げて属性で埋める"
      npm run --silent td -- extend --model data/value-net.json --out "$W/m0x.json" --vocabDecks "$DECKS" | tee -a "$LOG"
      npm run --silent td -- attr --model "$W/m0x.json" --out "$W/m0.json" --keepA 0 | tee -a "$LOG"
      ;;
    selfplay)
      n=$(( (GAMES + CHUNK - 1) / CHUNK ))
      for ((i = 0; i < n; i++)); do
        out="$W/data/r$i.jsonl"
        [ -s "$out" ] && continue
        g=$(( GAMES - i * CHUNK < CHUNK ? GAMES - i * CHUNK : CHUNK ))
        log "selfplay: r$i（$g 試合、g$(( START + i * CHUNK ))〜）"
        npm run --silent svwb -- td selfplay --model "$W/m0.json" --games "$g" --start $(( START + i * CHUNK )) \
          "${selfplay_args[@]}" --decks "$DECKS" --out "$out.tmp" 2>&1 | tail -3 | tee -a "$LOG"
        mv "$out.tmp" "$out"
      done
      ;;
    train)
      data="$(ls "$W"/data/r*.jsonl | paste -sd, -)"
      log "train: $(ls "$W"/data/r*.jsonl | wc -l) ファイル"
      npm run --silent td -- train --model "$W/m0.json" --data "$data" --out "$W/m1-raw.json" \
        --epochs "$EPOCHS" --lr 0.0003 --l2 0.001 --best 1 --bestOn end,imagined --ivRes 0 | tee -a "$LOG"
      npm run --silent td -- prune --model "$W/m1-raw.json" --data "$data" --out "$W/m1-pruned.json" | tee -a "$LOG"
      npm run --silent td -- attr --model "$W/m1-pruned.json" --out "$W/m1.json" --keepA 0 | tee -a "$LOG"
      ;;
    judge)
      m1="{\"valueNet\":\"$W/m1.json\"}"
      m0="{\"valueNet\":\"$W/m0.json\"}"
      log "judge: m1 と m0（g0〜$(( JUDGE - 1 ))）"
      npm run --silent svwb -- compare "$JUDGE" "$m1" "$m0" 0 --decks "$DECKS" 2>&1 | tail -3 | tee "$W/judge-m1-m0.log" | tee -a "$LOG"
      log "judge: m1 と m0（選ぶのに使っていない g$JUDGE〜$(( 2 * JUDGE - 1 ))）"
      npm run --silent svwb -- compare "$JUDGE" "$m1" "$m0" "$JUDGE" --decks "$DECKS" 2>&1 | tail -3 | tee "$W/judge-m1-m0-2.log" | tee -a "$LOG"
      log "judge: m1 と今の補正（ローテのカードが見えない data/value-net.json）"
      npm run --silent svwb -- compare "$JUDGE" "$m1" '{}' 0 --decks "$DECKS" 2>&1 | tail -3 | tee "$W/judge-m1-current.log" | tee -a "$LOG"
      ;;
    mulligan)
      m1="\"valueNet\":\"$W/m1.json\""
      log "mulligan: sample と cost（相手も m1。games $MULL_GAMES）"
      npm run --silent svwb -- mulligan-compare --games "$MULL_GAMES" --decks "$DECKS" \
        --a "{$m1,\"mulligan\":\"sample\"}" --b "{$m1,\"mulligan\":\"cost\"}" --opp "{$m1}" 2>/dev/null | tee "$W/mulligan.log" | tee -a "$LOG"
      ;;
    *)
      echo "不明な段階: $stage（m0 selfplay train judge mulligan）" >&2
      exit 1
      ;;
  esac
done
log "おわり: $STAGES"
