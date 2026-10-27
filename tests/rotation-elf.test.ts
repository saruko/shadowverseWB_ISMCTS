// ローテーションのエルフのカード能力のテスト（src/cards/abilities/rotation/elf.ts）

import { describe, expect, it } from "vitest";
import { ALL_CARDS, ROTATION, inFormat } from "../src/cards";
import { CARD_ABILITIES } from "../src/cards/abilities";
import { applyAction, type FollowerOnBoard, type GameState, type HandCard, type PlayerIndex } from "../src/engine";
import { board, can, follower, handNames, names, passTurns, play, rid, setup as setupAny, toBoard, toHand } from "./rotationHelpers";

/**
 * rotationHelpers の setup は deck をプレイヤー0、oppDeck をプレイヤー1 に渡すが、me は先攻のプレイヤーなので、
 * 先攻がプレイヤー1 になるシードでは deck が相手のデッキになる。deck・oppDeck を使うテストのため、先攻がプレイヤー0 のシードを使う
 */
function setup(opts: Parameters<typeof setupAny>[0] = {}) {
  for (let seed = opts.seed ?? 1; ; seed++) {
    const r = setupAny({ ...opts, seed });
    if (r.me === 0 || (!opts.deck && !opts.oppDeck)) return r;
  }
}

type Faith = { value: number; granted: unknown[] } | null;
const faithOf = (s: GameState, p: PlayerIndex): Faith =>
  (s.players[p] as unknown as { ext?: { faith?: Faith } }).ext?.faith ?? null;
const handExt = (h: HandCard) => (h as unknown as { ext?: { tempCostMod?: number } }).ext;
const crestNames = (s: GameState, p: PlayerIndex) => s.players[p].crests.map((c) => c.crestId);
const fol = (s: GameState, iid: number) => follower(s, iid) as FollowerOnBoard;
const endTurn = (s: GameState) => applyAction(s, { type: "endTurn" });

describe("エルフ（ローテーション）の定義", () => {
  it("能力テキストを持つローテーションのエルフのカードすべてに定義がある", () => {
    const STATIC = /^(【(守護|疾走|突進|必殺|ドレイン|潜伏|威圧|バリア|オーラ|カウントダウン_\d+)】|1ターンに\d回攻撃できる。)$/;
    const missing = ALL_CARDS.filter(
      (c) =>
        c.class === "elf" &&
        inFormat(ROTATION, c) &&
        c.text.split("\n").some((l) => l !== "" && !STATIC.test(l)) &&
        !CARD_ABILITIES[c.id],
    ).map((c) => c.name);
    expect(missing).toEqual([]);
  });
});

describe("第4弾", () => {
  it("カワイイ花マル・マナマル: 自分のターン終了時に進化し、相手のフォロワーすべてに1ダメージ", () => {
    const { s, me, opp } = setup();
    const m = toBoard(s, me, "カワイイ花マル・マナマル");
    const e = toBoard(s, opp, "燃え滾る闘志・フェザー");
    const t = endTurn(s);
    expect(fol(t, m.iid).evolve).toBe("evolved");
    expect(fol(t, e.iid).defense).toBe((e as FollowerOnBoard).defense - 1);
  });

  it("箒星: 4ダメージ。進化後のフォロワーがいれば1枚引く", () => {
    const { s, me, opp } = setup();
    const e = toBoard(s, opp, "燃え滾る闘志・フェザー", { defense: 10, maxDefense: 10 });
    toBoard(s, me, "燃え滾る闘志・フェザー", { evolve: "evolved" });
    const t = play(s, toHand(s, me, "箒星"));
    expect(fol(t, e.iid).defense).toBe(6);
    expect(t.players[me].hand).toHaveLength(1);
    // 進化後のフォロワーがいなければ引かない
    const u = setup();
    toBoard(u.s, u.opp, "燃え滾る闘志・フェザー", { defense: 10, maxDefense: 10 });
    const t2 = play(u.s, toHand(u.s, u.me, "箒星"));
    expect(t2.players[u.me].hand).toHaveLength(0);
  });

  it("美粧の乙女・クロエ: 【エンハンス_8】手札のフォロワーを場に出し、これは手札に戻る", () => {
    const { s, me } = setup();
    const c = toHand(s, me, "美粧の乙女・クロエ");
    const f = toHand(s, me, "情念の毒茨・リコリス");
    toHand(s, me, "グロースベア");
    toHand(s, me, "箒星");
    const t = play(s, c, [f]);
    expect(names(t, me)).toEqual(["情念の毒茨・リコリス"]);
    expect(handNames(t, me)).toEqual(["グロースベア", "箒星", "美粧の乙女・クロエ"]);
    // 出したのはプレイではないので、リコリスのファンファーレ（ミツェルを出す）は働かない
    expect(t.players[me].pp).toBe(2);
  });

  it("綺羅星: 【コンボ_5】でクレストを持ち、クレストのラストワードで相手リーダーに1ダメージと綺羅星を手札に", () => {
    let { s, me, opp } = setup();
    s.players[me].combo = 4;
    s = play(s, toHand(s, me, "綺羅星"));
    expect(s.players[me].crests).toHaveLength(1);
    const hp = s.players[opp].leaderHp;
    s = passTurns(s, 1);
    expect(s.players[me].crests).toHaveLength(0);
    expect(s.players[opp].leaderHp).toBe(hp - 1);
    expect(handNames(s, me)).toContain("綺羅星");
    // コンボが足りなければクレストは持たない
    const u = setup();
    u.s.players[u.me].combo = 3;
    expect(play(u.s, toHand(u.s, u.me, "綺羅星")).players[u.me].crests).toHaveLength(0);
  });

  it("虹色の弓使い・クピタン: 【奥義】で進化して7回の1ダメージ、【解放奥義】で相手リーダーに3ダメージ", () => {
    for (const [turn, evolved, leaderDamage] of [
      [3, false, 0],
      [10, true, 0],
      [15, true, 3],
    ] as const) {
      const { s, me, opp } = setup({ turn });
      toBoard(s, opp, "燃え滾る闘志・フェザー", { defense: 20, maxDefense: 20 });
      const hp = s.players[opp].leaderHp;
      const t = play(s, toHand(s, me, "虹色の弓使い・クピタン"));
      const k = board(t, me)[0] as FollowerOnBoard;
      expect(k.evolve).toBe(evolved ? "evolved" : "none");
      expect((board(t, opp)[0] as FollowerOnBoard).defense).toBe(evolved ? 13 : 20);
      expect(t.players[opp].leaderHp).toBe(hp - leaderDamage);
    }
  });

  it("アルフヘイム: ふだんはモードを選ぶ。【解放奥義】ならすべて", () => {
    const { s, me } = setup({ turn: 3 });
    toBoard(s, me, "燃え滾る闘志・フェザー");
    const t = applyAction(s, { type: "play", iid: toHand(s, me, "アルフヘイム") });
    expect(t.pending).toMatchObject({ kind: "mode", options: 3 });

    const u = setup({ turn: 15 });
    const f = toBoard(u.s, u.me, "燃え滾る闘志・フェザー") as FollowerOnBoard;
    const t2 = play(u.s, toHand(u.s, u.me, "アルフヘイム"));
    expect(t2.pending).toBeNull();
    const g = fol(t2, f.iid);
    expect(g.attack).toBe(f.attack + 1);
    expect(g.defense).toBe(f.defense + 1);
    expect(g.keywords).toEqual(expect.arrayContaining(["rush", "ward"]));
    expect(t2.players[u.me].hand).toHaveLength(1);
  });

  it("風の理・イーウィヤ: 【奥義】EPを1回復", () => {
    const { s, me } = setup({ turn: 10 });
    s.players[me].ep = 0;
    expect(play(s, toHand(s, me, "風の理・イーウィヤ")).players[me].ep).toBe(1);
  });

  it("調和の舞手・ユエル＆ソシエ: 超進化でクレスト。クレストはフォロワーのプレイで1ターンに1回進化させる", () => {
    let { s, me } = setup({ turn: 10 });
    s.players[me].sep = 2;
    const y = toBoard(s, me, "調和の舞手・ユエル＆ソシエ");
    s = applyAction(s, { type: "superEvolve", iid: y.iid });
    expect(s.players[me].crests).toHaveLength(1);
    s = play(s, toHand(s, me, "燃え滾る闘志・フェザー"));
    s = play(s, toHand(s, me, "燃え滾る闘志・フェザー"));
    const [, a, b] = board(s, me) as FollowerOnBoard[];
    expect(a!.evolve).toBe("evolved");
    expect(b!.evolve).toBe("none");
  });

  it("愛憎の舞手・コウ＆ヨウ: 【攻撃時】自分のリーダーを3回復", () => {
    const { s, me } = setup();
    s.players[me].leaderHp = 10;
    const k = toBoard(s, me, "愛憎の舞手・コウ＆ヨウ", { defense: 1 });
    const t = applyAction(s, { type: "attack", attacker: k.iid, target: "leader" });
    expect(t.players[me].leaderHp).toBe(13);
  });

  it("愛憎の舞手・コウ＆ヨウ: 【攻撃時】自分のフォロワーも3回復", () => {
    const { s, me } = setup();
    const k = toBoard(s, me, "愛憎の舞手・コウ＆ヨウ", { defense: 1 });
    const t = applyAction(s, { type: "attack", attacker: k.iid, target: "leader" });
    expect(fol(t, k.iid).defense).toBe(4);
  });
});

describe("第5弾", () => {
  it("森羽子板の匠: ファンファーレで出したフェアリーでも相手リーダーに1ダメージ", () => {
    const { s, me, opp } = setup();
    const hp = s.players[opp].leaderHp;
    const t = play(s, toHand(s, me, "森羽子板の匠"));
    expect(names(t, me)).toEqual(["森羽子板の匠", "フェアリー"]);
    expect(t.players[opp].leaderHp).toBe(hp - 1);
  });

  it("バディングバディーズ: 【コンボ_5】もう1枚出して両方進化", () => {
    const { s, me } = setup();
    s.players[me].combo = 4;
    const t = play(s, toHand(s, me, "バディングバディーズ"));
    expect(board(t, me).map((c) => (c as FollowerOnBoard).evolve)).toEqual(["evolved", "evolved"]);
  });

  it("静かなる応援: 【コンボ_3】で2ダメージ", () => {
    const { s, me, opp } = setup();
    const hp = s.players[opp].leaderHp;
    expect(play(s, toHand(s, me, "静かなる応援")).players[opp].leaderHp).toBe(hp - 1);
    s.players[me].combo = 2;
    expect(play(s, toHand(s, me, "静かなる応援")).players[opp].leaderHp).toBe(hp - 2);
  });

  it("導きの船頭: 超進化で妖精・フォロワーすべてに【必殺】", () => {
    let { s, me } = setup({ turn: 10 });
    s.players[me].sep = 2;
    s = play(s, toHand(s, me, "導きの船頭"));
    const sendo = board(s, me)[0]!;
    s = applyAction(s, { type: "superEvolve", iid: sendo.iid });
    expect(names(s, me)).toEqual(["導きの船頭", "フェアリー", "フェアリー", "フェアリー", "フェアリー"]);
    const fairies = board(s, me).slice(1);
    expect(fairies.every((c) => c.keywords.includes("bane"))).toBe(true);
    expect(fol(s, sendo.iid).keywords).not.toContain("bane");
  });

  it("優雅なる虫風花: X（これを含むコンボ）枚引く", () => {
    const { s, me } = setup();
    s.players[me].combo = 2;
    expect(play(s, toHand(s, me, "優雅なる虫風花")).players[me].hand).toHaveLength(3);
  });

  it("ローフラッド: +X/+X。進化時に手札を捨て、相手のデッキのコピー5枚を非公開で加える", () => {
    let { s, me, opp } = setup({ turn: 10, oppDeck: Array(40).fill("箒星") });
    s.players[me].ep = 2;
    s.players[me].combo = 2;
    s = play(s, toHand(s, me, "天踏む《吊るされた男》・ローフラッド"));
    const r = board(s, me)[0] as FollowerOnBoard;
    expect([r.attack, r.defense]).toEqual([4, 4]);
    toHand(s, me, "綺羅星");
    const oppDeck = s.players[opp].deck.length;
    s = applyAction(s, { type: "evolve", iid: r.iid });
    expect(handNames(s, me)).toEqual(Array(5).fill("箒星"));
    expect(s.players[me].hand.every((h) => !h.revealed)).toBe(true);
    expect(s.players[opp].deck).toHaveLength(oppDeck);
  });

  it("虫風花・ミロク: 進化時にもモードを選ぶ", () => {
    let { s, me } = setup({ turn: 10 });
    s.players[me].ep = 2;
    s = play(s, toHand(s, me, "虫風花・ミロク"), 1);
    expect(s.players[me].pp).toBe(9);
    s = applyAction(s, { type: "evolve", iid: board(s, me)[0]!.iid });
    expect(s.pending).toMatchObject({ kind: "mode", options: 3 });
    s = applyAction(s, { type: "mode", index: 0 });
    expect(handNames(s, me)).toEqual(["フェアリー", "フェアリー"]);
  });
});

describe("第6弾", () => {
  it("新緑のフェアリー: 自分のターン終了時に進化。慈恵の側近は進化でリーダーを回復", () => {
    let { s, me } = setup();
    s.players[me].leaderHp = 10;
    s = play(s, toHand(s, me, "慈恵の側近"));
    expect(names(s, me)).toEqual(["慈恵の側近", "新緑のフェアリー"]);
    s = endTurn(s);
    expect((board(s, me)[1] as FollowerOnBoard).evolve).toBe("evolved");
    expect(s.players[me].leaderHp).toBe(11);
  });

  it("大輪への献上: 手札にある間、自分のフォロワーが進化するとコスト-1", () => {
    let { s, me } = setup({ turn: 10 });
    s.players[me].ep = 2;
    toHand(s, me, "大輪への献上");
    const f = toBoard(s, me, "燃え滾る闘志・フェザー");
    s = applyAction(s, { type: "evolve", iid: f.iid });
    expect(s.players[me].hand[0]!.costMod).toBe(-1);
  });

  it("慈愛の天槍: （1）攻撃力最大のフォロワーを破壊", () => {
    const { s, me, opp } = setup();
    toBoard(s, opp, "燃え滾る闘志・フェザー", { attack: 1 });
    const big = toBoard(s, opp, "燃え滾る闘志・フェザー", { attack: 9 });
    const t = play(s, toHand(s, me, "慈愛の天槍"), 0);
    expect(board(t, opp).map((c) => c.iid)).not.toContain(big.iid);
    expect(board(t, opp)).toHaveLength(1);
  });

  it("慈愛の凛華・オルテニア: 超進化時に選んで破壊", () => {
    let { s, me, opp } = setup({ turn: 10 });
    s.players[me].sep = 2;
    s = play(s, toHand(s, me, "慈愛の凛華・オルテニア"));
    expect(board(s, me)).toHaveLength(4);
    const a = toBoard(s, opp, "燃え滾る闘志・フェザー");
    const b = toBoard(s, opp, "燃え滾る闘志・フェザー");
    s = applyAction(s, { type: "superEvolve", iid: board(s, me)[0]!.iid });
    expect(s.pending).toMatchObject({ kind: "choose", candidates: [a.iid, b.iid] });
    s = applyAction(s, { type: "choose", targets: [b.iid] });
    expect(board(s, opp).map((c) => c.iid)).toEqual([a.iid]);
  });

  it("旧き天槍・ササニド: 信仰は進化で+1。信仰値-10で天槍の深淵を加え、信仰は進化で相手リーダーに1ダメージを持つ", () => {
    let { s, me, opp } = setup({ turn: 10, deck: ["旧き天槍・ササニド"] });
    s.players[me].ep = 2;
    expect(faithOf(s, me)?.value).toBe(0);
    // 信仰値が足りなければ働かない
    const t = play(s, toHand(s, me, "旧き天槍・ササニド"));
    expect(t.players[me].hand).toHaveLength(0);
    s.players[me].hand = [];
    const f = toBoard(s, me, "燃え滾る闘志・フェザー");
    s = applyAction(s, { type: "evolve", iid: f.iid });
    expect(faithOf(s, me)?.value).toBe(1);
    faithOf(s, me)!.value = 10;
    s = play(s, toHand(s, me, "旧き天槍・ササニド"));
    expect(handNames(s, me)).toEqual(["天槍の深淵"]);
    expect(faithOf(s, me)?.value).toBe(0);
    expect(faithOf(s, me)?.granted).toHaveLength(1);
    // 天槍の深淵で進化させると、信仰の能力で相手リーダーに1ダメージ（信仰値も+1）
    const hp = s.players[opp].leaderHp;
    const sasanid = board(s, me).find((c) => c.cardId === rid("旧き天槍・ササニド"))!;
    // 進化前のフォロワーはササニドだけなので自動で選ばれる
    s = play(s, s.players[me].hand[0]!.iid);
    expect(fol(s, sasanid.iid).evolve).toBe("evolved");
    expect(s.players[opp].leaderHp).toBe(hp - 1);
    expect(faithOf(s, me)?.value).toBe(1);
  });

  it("天槍の深淵: 進化前のフォロワーがいなければプレイできない", () => {
    const { s, me } = setup();
    toBoard(s, me, "燃え滾る闘志・フェザー", { evolve: "evolved" });
    const iid = toHand(s, me, "天槍の深淵");
    expect(can(s, { type: "play", iid })).toBe(false);
  });
});

describe("第7弾", () => {
  it("グロースベア: コピーを場に出す。受ける4以上のダメージは3", () => {
    const { s, me } = setup();
    const t = play(s, toHand(s, me, "グロースベア"));
    expect(names(t, me)).toEqual(["グロースベア", "グロースベア"]);
    // 相手の場のグロースベアに天槍授与の4ダメージ → 3ダメージ
    const v = setup();
    const bear = toBoard(v.s, v.opp, "グロースベア");
    const w = play(v.s, toHand(v.s, v.me, "天槍授与"));
    expect(fol(w, bear.iid).defense).toBe(3);
  });

  it("マインドシフト: 手札2枚をデッキに戻して2枚引く", () => {
    const { s, me } = setup();
    const a = toHand(s, me, "箒星");
    const b = toHand(s, me, "綺羅星");
    toHand(s, me, "憂慮の縮小");
    const deck = s.players[me].deck.length;
    const t = play(s, toHand(s, me, "マインドシフト"), [a, b]);
    expect(t.players[me].hand).toHaveLength(3);
    expect(handNames(t, me)[0]).toBe("憂慮の縮小");
    expect(t.players[me].deck).toHaveLength(deck);
  });

  it("エルフトラッパー: 手札1枚をデッキに戻し、フェアリー2枚", () => {
    const { s, me } = setup();
    toHand(s, me, "箒星");
    toHand(s, me, "綺羅星");
    const a = s.players[me].hand[0]!.iid;
    const t = play(s, toHand(s, me, "エルフトラッパー"), [a]);
    expect(handNames(t, me)).toEqual(["綺羅星", "フェアリー", "フェアリー"]);
  });

  it("弓兵の采配者: 4ダメージとコンボ+1", () => {
    const { s, me, opp } = setup();
    const e = toBoard(s, opp, "燃え滾る闘志・フェザー", { defense: 10, maxDefense: 10 });
    const t = play(s, toHand(s, me, "弓兵の采配者"));
    expect(fol(t, e.iid).defense).toBe(6);
    expect(t.players[me].combo).toBe(2);
  });

  it("凍矢の射手: これの攻撃力のダメージ。ターン終了時【コンボ_3】で1枚引く", () => {
    let { s, me, opp } = setup();
    const e = toBoard(s, opp, "燃え滾る闘志・フェザー", { defense: 10, maxDefense: 10 });
    s.players[me].combo = 2;
    s = play(s, toHand(s, me, "凍矢の射手"));
    expect(fol(s, e.iid).defense).toBe(7);
    s = endTurn(s);
    expect(s.players[me].hand).toHaveLength(1);
  });

  it("害意の拡大と憂慮の縮小: 【コンボ_3】のクレストは互いのスペルを手札に加える", () => {
    let { s, me } = setup();
    s.players[me].combo = 2;
    s = play(s, toHand(s, me, "害意の拡大"));
    expect(s.players[me].crests).toHaveLength(1);
    s = passTurns(s, 1);
    expect(handNames(s, me)).toContain("憂慮の縮小");
    const u = setup();
    u.s.players[u.me].combo = 2;
    let t = play(u.s, toHand(u.s, u.me, "憂慮の縮小"));
    expect(t.players[u.me].crests).toHaveLength(1);
    t = passTurns(t, 1);
    expect(handNames(t, u.me)).toContain("害意の拡大");
  });

  it("操嵩のアナテマ・ダストデイズ: -0/-X とコンボ+1。進化でクレスト、クレストはターン終了時【コンボ_3】でデッキのフォロワーを+1/+1", () => {
    let { s, me, opp } = setup({ turn: 10 });
    s.players[me].ep = 2;
    const e = toBoard(s, opp, "燃え滾る闘志・フェザー", { defense: 10, maxDefense: 10 });
    s = play(s, toHand(s, me, "操嵩のアナテマ・ダストデイズ"));
    expect(fol(s, e.iid).defense).toBe(7);
    expect(s.players[me].combo).toBe(2);
    s = applyAction(s, { type: "evolve", iid: board(s, me)[0]!.iid });
    expect(s.players[me].crests).toHaveLength(1);
    s.players[me].combo = 3;
    s = endTurn(s);
    const kept = s.players[me].deck.map((d) => d.kept?.attackMod ?? 0);
    expect(kept.every((x) => x === 1)).toBe(true);
  });

  it("氷界の鹿王: 森の神秘2枚。ターン終了時に攻撃力ぶん割りふり。超進化でクレスト", () => {
    let { s, me, opp } = setup({ turn: 10 });
    s.players[me].sep = 2;
    s = play(s, toHand(s, me, "氷界の鹿王"));
    expect(handNames(s, me)).toEqual(["森の神秘", "森の神秘"]);
    const a = toBoard(s, opp, "燃え滾る闘志・フェザー", { defense: 3, maxDefense: 3 });
    const b = toBoard(s, opp, "燃え滾る闘志・フェザー", { defense: 10, maxDefense: 10 });
    s = applyAction(s, { type: "superEvolve", iid: board(s, me)[0]!.iid });
    expect(s.players[me].crests).toHaveLength(1);
    s.players[me].combo = 3;
    s = endTurn(s);
    // 超進化後の攻撃力 8 を古い順に割りふる
    expect(follower(s, a.iid)).toBeUndefined();
    expect(fol(s, b.iid).defense).toBe(5);
    expect(handNames(s, me)).toHaveLength(3);
  });
});

describe("第8弾", () => {
  it("昔日の天秤・マーロン: 相手のフォロワーの枚数-自分のフォロワーの枚数だけ破壊", () => {
    const { s, me, opp } = setup();
    for (let i = 0; i < 4; i++) toBoard(s, opp, "燃え滾る闘志・フェザー");
    expect(board(play(s, toHand(s, me, "昔日の天秤・マーロン")), opp)).toHaveLength(1);
    // 自分のフォロワーのほうが多ければ何もしない
    const u = setup();
    toBoard(u.s, u.opp, "燃え滾る闘志・フェザー");
    toBoard(u.s, u.me, "燃え滾る闘志・フェザー");
    expect(board(play(u.s, toHand(u.s, u.me, "昔日の天秤・マーロン")), u.opp)).toHaveLength(1);
  });

  it("太古の妖精・ルフレ: +されたとき、自分のターンごとに1回フェアリーを出す", () => {
    const { s, me } = setup();
    toBoard(s, me, "太古の妖精・ルフレ");
    let t = play(s, toHand(s, me, "水鏡の信頼"));
    expect(names(t, me)).toEqual(["太古の妖精・ルフレ", "フェアリー"]);
    t = play(t, toHand(t, me, "水鏡の信頼"));
    expect(names(t, me)).toEqual(["太古の妖精・ルフレ", "フェアリー"]);
  });

  it("情念の毒茨・リコリスと優しき読心者・ミツェル: 互いを出す（出したほうのファンファーレは働かない）", () => {
    const { s, me } = setup();
    let t = play(s, toHand(s, me, "情念の毒茨・リコリス"));
    expect(names(t, me)).toEqual(["情念の毒茨・リコリス", "優しき読心者・ミツェル"]);
    expect(board(t, me).some((c) => c.keywords.includes("barrier"))).toBe(false);
    const u = setup();
    t = play(u.s, toHand(u.s, u.me, "優しき読心者・ミツェル"));
    expect(names(t, u.me)).toEqual(["優しき読心者・ミツェル", "情念の毒茨・リコリス"]);
    expect(board(t, u.me).every((c) => c.keywords.includes("barrier"))).toBe(true);
  });

  it("水鏡の信頼: デッキのコスト2以下のフォロワー2種類を出して+1/+1", () => {
    const { s, me } = setup({ deck: ["賢慮の狸", "賢慮の狸", "発芽の組員", "根差の刺客", "グロースベア"] });
    const t = play(s, toHand(s, me, "水鏡の信頼"));
    const n = names(t, me);
    expect(n).toHaveLength(2);
    expect(new Set(n).size).toBe(2);
    expect(n.every((x) => ["賢慮の狸", "発芽の組員", "根差の刺客", "燃え滾る闘志・フェザー"].includes(x!))).toBe(true);
  });

  it("エターナルクリスタリア・ティア: 【エンハンス_4】で+1/+1し、+されたのでイヴを手札に", () => {
    const { s, me } = setup();
    toBoard(s, me, "燃え滾る闘志・フェザー");
    const t = play(s, toHand(s, me, "エターナルクリスタリア・ティア"));
    const [f, tia] = board(t, me) as FollowerOnBoard[];
    expect(f!.attack).toBe(6);
    expect([tia!.attack, tia!.defense]).toEqual([3, 3]);
    expect(handNames(t, me)).toEqual(["ソードクリスタリア・イヴ"]);
  });

  it("離合の有終・セタス＆メイシア: 選んで破壊し、他のフォロワーを+1/+1", () => {
    const { s, me, opp } = setup();
    const e = toBoard(s, opp, "燃え滾る闘志・フェザー");
    const f = toBoard(s, me, "燃え滾る闘志・フェザー") as FollowerOnBoard;
    toBoard(s, opp, "燃え滾る闘志・フェザー");
    const t = play(s, toHand(s, me, "離合の有終・セタス＆メイシア"), [e.iid]);
    expect(board(t, opp)).toHaveLength(1);
    expect(board(t, opp)[0]!.iid).not.toBe(e.iid);
    expect(fol(t, f.iid).attack).toBe(f.attack + 1);
    expect((board(t, me)[1] as FollowerOnBoard).attack).toBe(4);
  });
});

describe("第9弾", () => {
  it("森林の罠: 相手のフォロワーが場に出たとき、それとこれを破壊", () => {
    let { s, me, opp } = setup();
    s = play(s, toHand(s, me, "森林の罠"));
    s = endTurn(s);
    s.players[opp].hand = [];
    s.players[opp].pp = 10;
    s = play(s, toHand(s, opp, "燃え滾る闘志・フェザー"));
    expect(board(s, opp)).toHaveLength(0);
    expect(board(s, me)).toHaveLength(0);
  });

  it("根差の刺客: 【コンボ_3】で加えたフェアリーは【必殺】を持つ", () => {
    const { s, me } = setup();
    expect(play(s, toHand(s, me, "根差の刺客")).players[me].hand[0]!.keywords).toEqual([]);
    const u = setup();
    u.s.players[u.me].combo = 2;
    expect(play(u.s, toHand(u.s, u.me, "根差の刺客")).players[u.me].hand[0]!.keywords).toEqual(["bane"]);
  });

  it("スパリゾートモンキー: 相手の手札のコピーを非公開で手札に", () => {
    const { s, me, opp } = setup();
    toHand(s, opp, "箒星");
    const t = play(s, toHand(s, me, "スパリゾートモンキー"));
    expect(handNames(t, me)).toEqual(["箒星"]);
    expect(t.players[me].hand[0]!.revealed).toBe(false);
    expect(t.players[opp].hand).toHaveLength(1);
  });

  it("緑傘会の二枚看板: 【コンボ_3】で両方", () => {
    const { s, me } = setup();
    expect(applyAction(s, { type: "play", iid: toHand(s, me, "緑傘会の二枚看板") }).pending).toMatchObject({ kind: "mode" });
    s.players[me].combo = 2;
    const t = play(s, toHand(s, me, "緑傘会の二枚看板"));
    expect(handNames(t, me)).toEqual(["緑傘会の二枚看板", "森の神秘", "フェアリー"]);
  });

  it("枝葉の舎弟頭: 進化時に他のフォロワーを+1/+1して【突進】", () => {
    let { s, me } = setup({ turn: 10 });
    s.players[me].ep = 2;
    const f = toBoard(s, me, "燃え滾る闘志・フェザー") as FollowerOnBoard;
    const e = toBoard(s, me, "枝葉の舎弟頭");
    s = applyAction(s, { type: "evolve", iid: e.iid });
    expect(fol(s, f.iid).attack).toBe(f.attack + 1);
    expect(fol(s, f.iid).keywords).toContain("rush");
  });

  it("緋岸橙酔: 手札にある間、ターン終了時【コンボ_3】でコスト-1", () => {
    let { s, me } = setup();
    toHand(s, me, "緋岸橙酔");
    s.players[me].combo = 3;
    s = endTurn(s);
    expect(s.players[me].hand[0]!.costMod).toBe(-1);
    const u = setup();
    toHand(u.s, u.me, "緋岸橙酔");
    u.s.players[u.me].combo = 2;
    expect(endTurn(u.s).players[u.me].hand[0]!.costMod).toBe(0);
  });

  it("煙管の咎人・マガチヨ: ふだんは1枚を選ぶ。【コンボ_3】ならすべてに4ダメージ", () => {
    const { s, me, opp } = setup();
    const a = toBoard(s, opp, "燃え滾る闘志・フェザー");
    const b = toBoard(s, opp, "燃え滾る闘志・フェザー");
    const t = applyAction(s, { type: "play", iid: toHand(s, me, "煙管の咎人・マガチヨ") });
    expect(t.pending).toMatchObject({ kind: "choose", candidates: [a.iid, b.iid] });
    s.players[me].combo = 2;
    expect(board(play(s, toHand(s, me, "煙管の咎人・マガチヨ")), opp)).toHaveLength(0);
  });

  it("香風の変貌・ヒエン: 手札にある間、カードをプレイするとターン終了までコスト-1。ラストワードで自身を出す", () => {
    let { s, me } = setup();
    toHand(s, me, "香風の変貌・ヒエン");
    s = play(s, toHand(s, me, "綺羅星"));
    s = play(s, toHand(s, me, "綺羅星"));
    expect(handExt(s.players[me].hand[0]!)?.tempCostMod).toBe(-2);
    s = endTurn(s);
    expect(handExt(s.players[me].hand[0]!)?.tempCostMod ?? 0).toBe(0);

    // 相手の場のヒエンを破壊すると、相手の場に新しいヒエンが出る
    const v = setup();
    const h2 = toBoard(v.s, v.opp, "香風の変貌・ヒエン");
    const w = play(v.s, toHand(v.s, v.me, "穏やかなる孤独"));
    expect(h2).toBeDefined();
    expect(names(w, v.opp)).toEqual(["香風の変貌・ヒエン"]);
    expect(board(w, v.opp)[0]!.iid).not.toBe(h2.iid);
  });
});

// ---- 第10弾「ニーゲルヘリア神殺事件」（【証拠】は docs/rules.md 12章） ----

describe("第10弾", () => {
  /** 自分の場の『神域の物証』の証拠の数（無ければ null） */
  const evidence = (s: GameState, p: PlayerIndex) => {
    const a = board(s, p).find((c) => c.kind === "amulet" && c.cardId === rid("神域の物証"));
    return a && a.kind === "amulet" ? (a.evidence ?? null) : null;
  };
  const stats = (s: GameState, iid: number) => [fol(s, iid).attack, fol(s, iid).defense];
  /** 自分のデッキの上から順に names のカードにする（引く順を決める） */
  const stackDeck = (s: GameState, p: PlayerIndex, deckNames: string[]) => {
    deckNames.forEach((n, i) => {
      s.players[p].deck[i] = { ...s.players[p].deck[i]!, cardId: rid(n) };
    });
  };

  it("好奇のネズミ: 場に出たとき、自分の場の他の元のコスト1のカード（アミュレットを含む）が2枚以上なら+2/+1", () => {
    const { s, me } = setup();
    toBoard(s, me, "神域の物証");
    toBoard(s, me, "好奇のネズミ");
    const iid = toHand(s, me, "好奇のネズミ");
    expect(stats(play(s, iid), iid)).toEqual([3, 2]);
    // 他の元のコスト1のカードが1枚（神域の物証だけ）なら+されない
    const u = setup();
    toBoard(u.s, u.me, "神域の物証");
    toBoard(u.s, u.me, "燃え滾る闘志・フェザー");
    const j = toHand(u.s, u.me, "好奇のネズミ");
    expect(stats(play(u.s, j), j)).toEqual([1, 1]);
  });

  it("エレガントシッター: ファンファーレで『神域の物証』を場に出す。進化時、元のコスト1のカードが2枚以上なら2回復", () => {
    const { s, me } = setup({ turn: 5 });
    s.players[me].ep = 2;
    s.players[me].leaderHp = 10;
    const iid = toHand(s, me, "エレガントシッター");
    let t = play(s, iid);
    expect(evidence(t, me)).toBe(1);
    // 元のコスト1のカードが神域の物証だけなら回復しない
    expect(applyAction(t, { type: "evolve", iid }).players[me].leaderHp).toBe(10);
    toBoard(t, me, "好奇のネズミ");
    t = applyAction(t, { type: "evolve", iid });
    expect(t.players[me].leaderHp).toBe(12);
  });

  it("鳥獣の述懐: 『神域の物証』を場に出し、クレストは自分のターン開始時に『好奇のネズミ』を出す（カウントダウン_2で2回）", () => {
    const { s, me } = setup();
    let t = play(s, toHand(s, me, "鳥獣の述懐"));
    expect(names(t, me)).toEqual(["神域の物証"]);
    expect(crestNames(t, me)).toHaveLength(1);
    t = passTurns(t, 1);
    expect(names(t, me)).toEqual(["神域の物証", "好奇のネズミ"]);
    // 1匹目が出たときの他の元のコスト1のカードは神域の物証だけ
    expect(stats(t, board(t, me)[1]!.iid)).toEqual([1, 1]);
    t = passTurns(t, 1);
    // 2匹目は神域の物証と1匹目を数えて+2/+1。カウントが0になったクレストは無くなる
    expect(names(t, me)).toEqual(["神域の物証", "好奇のネズミ", "好奇のネズミ"]);
    expect(stats(t, board(t, me)[2]!.iid)).toEqual([3, 2]);
    expect(crestNames(t, me)).toHaveLength(0);
    t = passTurns(t, 1);
    expect(board(t, me)).toHaveLength(3);
  });

  it("自然の再誕: 『フェアリー』1枚を出して進化させる。【エンハンス_6】なら3枚", () => {
    const { s, me } = setup();
    s.players[me].pp = 5;
    let t = play(s, toHand(s, me, "自然の再誕"));
    expect(names(t, me)).toEqual(["フェアリー"]);
    expect((board(t, me) as FollowerOnBoard[]).map((f) => f.evolve)).toEqual(["evolved"]);
    expect(t.players[me].pp).toBe(2);
    const u = setup();
    t = play(u.s, toHand(u.s, u.me, "自然の再誕"));
    expect(names(t, u.me)).toEqual(["フェアリー", "フェアリー", "フェアリー"]);
    expect((board(t, u.me) as FollowerOnBoard[]).every((f) => f.evolve === "evolved")).toBe(true);
    expect(t.players[u.me].pp).toBe(4);
  });

  it("花園のエルフ: 自分のターン終了時、『森の神秘』と『フェアリー』を手札に加える", () => {
    const { s, me } = setup();
    toBoard(s, me, "花園のエルフ");
    expect(handNames(endTurn(s), me)).toEqual(["森の神秘", "フェアリー"]);
  });

  it("ノーシェの尋問: ランダム1枚に5ダメージ、『好奇のネズミ』を手札に。元のコスト1のカードが2枚以上ならそれは【疾走】", () => {
    const { s, me, opp } = setup();
    const e = toBoard(s, opp, "燃え滾る闘志・フェザー", { defense: 10, maxDefense: 10 });
    let t = play(s, toHand(s, me, "ノーシェの尋問"));
    expect(fol(t, e.iid).defense).toBe(5);
    expect(handNames(t, me)).toEqual(["好奇のネズミ"]);
    expect(t.players[me].hand[0]!.keywords).not.toContain("storm");
    const u = setup();
    toBoard(u.s, u.me, "神域の物証");
    toBoard(u.s, u.me, "好奇のネズミ");
    t = play(u.s, toHand(u.s, u.me, "ノーシェの尋問"));
    expect(t.players[u.me].hand[0]!.keywords).toContain("storm");
  });

  it("伝心の相棒犬: 『神域の物証』を出し【疾走】。進化時、元のコスト1のカードが2枚以上なら『好奇のネズミ』を出す", () => {
    const { s, me } = setup({ turn: 5 });
    s.players[me].ep = 2;
    const iid = toHand(s, me, "伝心の相棒犬");
    let t = play(s, iid);
    expect(names(t, me)).toEqual(["伝心の相棒犬", "神域の物証"]);
    expect(can(t, { type: "attack", attacker: iid, target: "leader" })).toBe(true);
    // 元のコスト1のカードが神域の物証だけなら出さない
    expect(names(applyAction(t, { type: "evolve", iid }), me)).toEqual(["伝心の相棒犬", "神域の物証"]);
    toBoard(t, me, "好奇のネズミ");
    t = applyAction(t, { type: "evolve", iid });
    expect(names(t, me)).toEqual(["伝心の相棒犬", "神域の物証", "好奇のネズミ", "好奇のネズミ"]);
    // 出たネズミは神域の物証ともう1匹を数えて+2/+1
    expect(stats(t, board(t, me)[3]!.iid)).toEqual([3, 2]);
  });

  it("獣言探偵・ノーシェ: 『伝心の相棒犬』と『好奇のネズミ』を出す（相棒犬のファンファーレは働かない）。超進化時、他のフォロワーを+2/+0", () => {
    const { s, me } = setup({ turn: 7 });
    const iid = toHand(s, me, "獣言探偵・ノーシェ");
    const f = toBoard(s, me, "燃え滾る闘志・フェザー") as FollowerOnBoard;
    let t = play(s, iid);
    expect(names(t, me)).toEqual(["燃え滾る闘志・フェザー", "獣言探偵・ノーシェ", "伝心の相棒犬", "好奇のネズミ"]);
    const [, , dog, rat] = board(t, me) as FollowerOnBoard[];
    expect(stats(t, rat!.iid)).toEqual([1, 1]);
    t = applyAction(t, { type: "superEvolve", iid });
    expect(fol(t, f.iid).attack).toBe(f.attack + 2);
    expect(stats(t, dog!.iid)).toEqual([4, 3]);
    expect(stats(t, rat!.iid)).toEqual([3, 1]);
    // これ自身は+されない（超進化の+3/+3だけ）
    expect(stats(t, iid)).toEqual([8, 7]);
  });

  it("群狼の奉仕者: ファンファーレで『群狼の奉仕者』2枚を出す。進化時も同じ（場は5枚まで）", () => {
    const { s, me } = setup({ turn: 5 });
    s.players[me].ep = 2;
    const iid = toHand(s, me, "群狼の奉仕者");
    let t = play(s, iid);
    expect(names(t, me)).toEqual(["群狼の奉仕者", "群狼の奉仕者", "群狼の奉仕者"]);
    t = applyAction(t, { type: "evolve", iid });
    expect(board(t, me)).toHaveLength(5);
  });

  it("生命蒔く異形: 1枚引いてエルフ・フォロワーなら場に出す、を2回。超進化時も同じ", () => {
    const { s, me } = setup({ turn: 7 });
    // エルフ・フォロワー、ニュートラル・フォロワー、エルフ・スペル、エルフ・フォロワーの順に引く
    stackDeck(s, me, ["エレガントシッター", "愛の天使・エクシアス", "鳥獣の述懐", "群狼の奉仕者"]);
    const iid = toHand(s, me, "生命蒔く異形");
    let t = play(s, iid);
    // 場に出すのはプレイではないので、エレガントシッターのファンファーレ（神域の物証）は働かない
    expect(names(t, me)).toEqual(["生命蒔く異形", "エレガントシッター"]);
    expect(handNames(t, me)).toEqual(["愛の天使・エクシアス"]);
    t = applyAction(t, { type: "superEvolve", iid });
    expect(names(t, me)).toEqual(["生命蒔く異形", "エレガントシッター", "群狼の奉仕者"]);
    expect(handNames(t, me)).toEqual(["愛の天使・エクシアス", "鳥獣の述懐"]);
  });
});
