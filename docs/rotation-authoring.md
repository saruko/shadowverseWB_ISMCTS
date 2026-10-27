# ローテーションのカード能力の書き方

ローテーションのカード（第4〜9弾、以後の新弾）・トークン・クレストの能力を `src/cards/abilities/rotation/<クラス>.ts` に書くときの決まり。
ルールは `docs/rules.md`（特に 12章）、DSL の型は `src/engine/dsl.ts`、補助関数は `src/cards/abilities/helpers.ts`。
スターターのクラスのファイル（`src/cards/abilities/elf.ts` 等）が書き方の見本。

## ファイル

- カード・トークン: `<CLASS>_ROT`（キーはカードID）。クレスト: `<CLASS>_ROT_CRESTS`（キーは `crestIdOf("カード名")`）
- スターターで定義済みのカード（ベーシック等）は書かない（同じキーがあると読み込みでエラー）
- テスト: `tests/rotation-<クラス>.test.ts`（`tests/rotationHelpers.ts` の `setup` 等を使う）
- エンジン（`rust/`・`src/engine/`）や他のクラスのファイルは変えない。表現できない能力は下の「表現できないとき」

## キーにするID

- `[id("カード名")]` が基本。同名の再録（第1弾のカードが第8弾にもある等）は `id` が先に出た版を返すので、
  ローテーションの版は `[rid("カード名")]`（後に出た版）で書く
- 能力の中で他のカードを指すとき（`summon("フェアリー")` 等）は名前で書いてよい（先に出た版になる。トークン・再録で能力が同じなら問題ない）

## 自動で読み取るもの（定義に書かない）

- 単独行の【守護】【疾走】【突進】【必殺】【ドレイン】【潜伏】【威圧】【バリア】【オーラ】、「1ターンに2回攻撃できる。」
- 【カウントダウン_N】の初期値、【エンハンス_N】の支払い（複数あれば払える最大のもの）
- 能力テキストが上の行だけのカードは定義が要らない

## よく使う書き方

| テキスト | 書き方 |
| --- | --- |
| 【ファンファーレ】 / スペル / 【ラストワード】 | `fanfare(...)` / `spell(...)` / `lastWords(...)` |
| 【進化時】（EP・SEPで進化させたときだけ） | `onEvolve(...)` |
| 【超進化時】 / 「1枚ではなく2枚」等の置き換え | `onSuperEvolve(...)` / `onSuperEvolveInstead(...)`（進化時の分も含めて書く） |
| これが進化したとき（効果を含む） / 超進化したとき | `onEvolved(...)` / `onSuperEvolved(...)` |
| 【進化時】【ファンファーレ】と同じ能力が働く | 効果の配列を変数にして両方に渡す |
| 相手の場のフォロワー1枚を選ぶ。それに… | `choose(oppFollowers())` → `damage(slot(), n)`（**選ぶは他の効果より前**。テストで確かめる） |
| ランダム1枚 | `random(oppFollowers(), 1, "r")` → `slot("r")` |
| 「…」をN回行う | `repeat(n, random(...), damage(slot(), x))` |
| 【エンハンス_N】 | `when(ENHANCED, [...])`。複数のエンハンスは `when(enhancedAtLeast(7), ...)` |
| 【コンボ_N】【覚醒】【土の秘術_N】【ネクロマンス_N】 | `when(combo(n), ...)` / `when(AWAKENED, ...)` / `earthRite(n, ...)` / `necromancy(n, ...)` |
| 【奥義】/【解放奥義】 | `when(ULTIMATE, [...])` / `when(RELEASED_ULTIMATE, [...])` |
| 【連携_N】 | `when(link(n), [...])` |
| 【モード】1つ / 2つを選んで | `mode([...], [...])` / `modePick(2, [...], [...], ...)` |
| 【モード】…【エンハンス_8】（条件）なら1つを選ぶのではなくすべて | `modeAll(ENHANCED, [...], [...])` |
| 下記の能力からランダムN個 / 働いていないランダム1つ / 順に1つ | `randomEffects(n, ...)` / `randomUnused(...)` / `cycleEffects(...)` |
| 自分のターンなら | `when(OWN_TURN, [...])` |
| 自分のターンごとに1回 | `oncePerOwnTurn(onAllyPlay(...))` |
| 手札で働く。〜したとき | `inHand(onAllyEvolve({ type: "follower" }, costChange(THIS, -1)))` 等 |
| デッキで働く。〜なら【直接召喚】 | `inDeck(onTurnStart(when(cond, [directSummon])))`、「直接召喚されたとき」は `onDirectSummoned(...)` |
| 自分がスペル（カード）をプレイしたとき | `onAllyPlay({ type: "spell" }, ...)`（event はプレイしたカード） |
| 自分がカードを【エンハンス】でプレイしたとき | `onEnhancePlay(...)` |
| 自分のフォロワーが進化した（超進化した）とき | `onAllyEvolve({ type: "follower" }, ...)` / `onAllySuperEvolve(...)` |
| 自分の〜・フォロワーが場に出たとき | `onAllyEnter({ type: "follower", tribe: "妖精" }, ...)`（event は出たカード） |
| 相手のフォロワーが場に出たとき | `onEnemyEnter({ type: "follower" }, ...)` |
| 自分の（相手の）フォロワーが攻撃するとき | `onAllyAttack(filter, ...)` / `onEnemyAttackLeader(filter, ...)` |
| これを引いたとき / 自分がカードを引いたとき | `onDrawn(...)` / `onAllyDraw({}, ...)` |
| これの攻撃力か体力が場で+されたとき | `onBuffed(...)` |
| 自分のアミュレットが破壊されたとき | `onAllyDestroyed({ type: "amulet" }, ...)` |
| 『X』が破壊されたとき（どちらの場でも） | `onDestroyed("both", { ids: [id("X")] }, ...)` |
| 自分のリーダーが回復したとき（1ターン1回の制限なし） | `onLeaderHealedEach(...)` |
| 自分が【土の秘術】したとき | `onEarthRite(...)` |
| 『X』を出す。それは【守護】を持つ | `summon("X", 1, "s")` → `grant(slot("s"), ["ward"])` |
| 『X』を手札に加える。それの… | `addToHandAs("X", "h")` → `costChange(slot("h"), -1)` |
| 『X』N枚をデッキに加える | `addToDeck("X", n)` |
| 相手の場に出す | `summonOpp("X")` |
| …のコピー（同名のカード）を手札・場に | `copy(fromZone("hand", "opponent", "random"), 1, "hand", { hidden: true })`、`copy(destroyedCards({ type: "follower" }), 1, "hand", { hidden: true })`、`copy(fromSlot(), 1, "board")`、`copy(FROM_THIS, 1, "board")` |
| 非公開で手札に加える | `copy(..., "hand", { hidden: true })` |
| 〜に変身する（ランダムなコピー） | `transform(target, "X")` / `transformFrom(target, fromZone("deck", "self", "random", { type: "follower" }))` |
| コストをNにする / ターン終了まで-1 | `setCost(target, n)`・`setCost(target, n, "endOfTurn")` / `costChangeTemp(target, -1)` |
| 能力すべてを失う | `silence(target)` |
| 【ラストワード】を失う | `loseLastWords(slot("s"))` |
| フォロワーやリーダーを攻撃できない（常在） | `{ cannotAttack: true }`（カードの能力に書く） |
| 相手のターン終了まで、それは「フォロワーやリーダーを攻撃できない。」 | `{ op: "cannotAttack", target, until: "opponentTurnEnd" }`（既存）。ターン終了までは `grantNoAttack(target, "endOfTurn")` |
| 相手のターン終了まで、これは【潜伏】を持つ | `grant(THIS, ["ambush"], "untilOpponentTurnEnd")` |
| ターン終了まで「1ターンに2回攻撃できる」 | `grantAttacksTemp(target, 2)` |
| 受ける4以上のダメージを3にする / 能力によって破壊できない / 【守護】を無視して攻撃できる | カードの能力に `damageCap: { atLeast: 4, to: 3 }` / `indestructible: true` / `ignoreWard: true` |
| リーダーの受けるダメージの上限・加算 | `{ op: "leaderStatus", side, cap: { atLeast: 1, to: 0 }, duration: "untilOpponentTurnEnd" }` / `{ op: "leaderStatus", side: "opponent", plus: 1 }` |
| EP・SEPを回復 | `gainEp(1)` / `gainSep(2)` |
| PPを2消費して | `payPp(2, ...)` |
| 相手は自身のデッキから1枚を引く | `opponentDraws(1)` |
| 手札のカードを場に出す（プレイではない） | `moveToBoard(slot())` |
| これの【ファンファーレ】を働かせる | `triggerOwnFanfare` |
| 奥義ゲージを+1 | `addGauge(handCards(), 1)` |
| 引いたカードのコスト | `drawAs(1, "d", { type: "follower" })` → `slotStat("d", "cost")` |
| 選んだカードの攻撃力 / これのコスト / 選んだのがスペルなら | `slotStat("t", "attack")` / `THIS_COST` / `when(slotMatches("t", { type: "spell" }), ...)` |
| このバトル中に場に出た自分の他の『X』の枚数 / アーティファクト・フォロワーの種類 | `enteredCount({ ids: [id("X")], excludeSelf: true })` / `enteredKinds({ type: "follower", tribe: "アーティファクト" })` |
| 値の比較・差 | `when(valueAtLeast(v, n), ...)`・`when(countAtLeast(target, n), ...)` / `sub(a, b)` |
| デッキに重複がない / 直前の自分のターンにリーダーを攻撃 | `when(DECK_NO_DUPLICATES, ...)` / `when(ATTACKED_LEADER_LAST_TURN, ...)` |
| クレストのカウント / 自分のクレストを破壊 | `{ op: "countdown", target: crestsOf("self", "カード名"), amount: 2 }` / `destroy(crestsOf("self", "カード名"))` |
| クレストすべてを消滅 | `banish(crestsOf("both"))` |
| 自分のデッキのフォロワーすべては+1/+1 | `buff(deckCards({ type: "follower" }), 1, 1)` |
| 自分のデッキのコスト1、3、5…のカードすべてを消滅（その枚数） | `{ op: "banish", target: deckCards({ costIn: [1, 3, 5] }), countVar: "n" }` → `v("n")` |
| 手札すべてをデッキに戻し、その枚数引く | `{ op: "returnToDeck", target: handCards(), countVar: "n" }` → `draw(v("n"))` |

フィルター（`CardFilter`）には `originalCostMin/Max/Eq`・`costMin`・`costIn`・`notTribe`・`evolved`・`superEvolved`・`damaged`・`notAttacked`・
`hasLastWords`・`excludeSelf`・`excludeEvent`・`notInSlot`・`cardKeyword`（手札・山札のカードの書かれたキーワード）がある。
「元のコスト」は `originalCost*`、「コスト」は `cost*`（手札で変化したコスト）。

## 第10弾（ニーゲルヘリア神殺事件）で足した部品

ルールは `docs/rules.md` 12章「第10弾…で加わるルール」。見本は `src/cards/abilities/rotation/neutral.ts` の第10弾の節と `tests/rotation-neutral.test.ts` の「第10弾: 【証拠】」。

| テキスト | 書き方 |
| --- | --- |
| 【証拠】（単独行） | 自動で読み取る（場に出ると証拠の数 1、合算・相手に選ばれないはエンジンが行う） |
| 証拠・アミュレットの「コスト1【アクト】自分のデッキから1枚を引く。自分の場の証拠を-1する。」 | `evidenceAct`（neutral.ts から import） |
| 『神域の物証』1枚を自分の場に出す / 手札に加える / 相手の場に出す | `summon("神域の物証")` / `addToHand("神域の物証")` / `summonOpp("神域の物証")` |
| 自分の場の証拠を-N して、… | `spendEvidence(n, ...)`（足りなければ何も起きず、後の能力も働かない。ユーザー判断） |
| 自分の場の証拠の数 | `EVIDENCE` |
| 証拠・アミュレット（フィルター） | `EVIDENCE_AMULET`（`{ type: "amulet", evidence: true }`） |
| 自分が証拠・アミュレットを【アクト】したとき / アミュレットを【アクト】したとき | `onEvidenceAct(...)` / `onAllyAct(...)`。「手札で働く。」なら `inHand(...)` で包む |
| このターン中に自分が証拠・アミュレット（アミュレット）を【アクト】していたなら | `when(actedThisTurn(true), ...)` / `when(actedThisTurn(), ...)` |
| これが場で消滅したとき / 自分のカードが場で消滅したとき / 相手のフォロワーが場で消滅したとき | `onBanished(...)` / `onAllyBanished({}, ...)` / `onBanishedSide("opponent", { type: "follower" }, ...)`（event は消滅したカード。コピーは `copy(FROM_EVENT, 1, "board")`） |
| これの攻撃力と体力を入れ替える | `swapStats(THIS)` |
| それは攻撃力X/体力Yになる | `setStats(target, x, y)`。これの攻撃力・体力は `THIS_ATTACK`・`THIS_DEFENSE` |
| 相手のリーダーの体力の最大値から体力を引いた数 | `leaderMissingHp("opponent")` |
| 相手のリーダーの体力の最大値を半分にする | `halveLeaderMaxHp("opponent")` |
| コスト最小のカードからランダム1枚 / 攻撃力最大の… / 選んだカードと同名の… | `random(minCost(handCards()), 1, "r")` / `maxAttack(oppFollowers())` / `sameName(oppFollowers(), "t")` |
| 捨てた枚数（「これで捨てた枚数」） | `discard(target, "n")` → `v("n")` |
| 【融合】アミュレット / 自分がアミュレットを【融合】したとき | `fusion: { type: "amulet" }` / `onAmuletFuse(...)` |

## 結晶・アクセラレート・信仰

`data/cards.json` の `special` に公式の文言・コストがある。カードの能力に次のように書く。

- アクセラレート: `accelerate: { cost: N, abilities: [spell(...)] }`（PP が元のコストに足りないときスペルとしてプレイ）
- 結晶: `crystallize: { cost: N, countdown: M, abilities: [lastWords(summon("このカード")), act(1, ...)] }`（カウントダウンアミュレットとして場に出る）
- 信仰: `faith: { abilities: [onAllyEvolve({ type: "follower" }, addFaith(1))] }`。「信仰値を-10して、…自分の信仰は「…」を持つ」は
  `spendFaith(10, addToHand("…"), grantFaith(onAllyEvolve({ type: "follower" }, damage(OPP_LEADER, 1))))`。信仰値は `FAITH`

## 表現できないとき

DSL の部品で書けない能力は、書ける部分だけ書き、カードの能力に `unimplemented: "書けなかった内容"` を付ける。
エンジンは変えず、最後の報告にカード名・書けない理由・必要な部品を挙げる。ルールが分からない（テキストから決められない）ものも同じく報告する。

## テスト

- 新しい仕組み（上の表の後半）を使うカードと、効果が複雑なカードは、カード単位の最小シナリオテストを書く（`tests/rotationHelpers.ts`）
- 実行（作業用のコピーで）: `node scripts/build-wasm.mjs` の後に `npx vitest run tests/rotation-<クラス>.test.ts tests/abilities-coverage.test.ts`、型は `npm run typecheck`
- `tests/abilities-coverage.test.ts` の「選ぶは他の効果より前」の検査を通す
