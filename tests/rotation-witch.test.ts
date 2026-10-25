// ローテーションのウィッチのカード（トークン・クレスト含む）の最小シナリオテスト

import { describe, expect, it } from "vitest";
import { ALL_CARDS, ALL_CRESTS, ROTATION, inFormat, type Card } from "../src/cards";
import { CARD_ABILITIES, CREST_ABILITIES } from "../src/cards/abilities";
import {
  applyAction,
  handCost,
  leaderId,
  legalActions,
  type AmuletOnBoard,
  type FollowerOnBoard,
  type GameState,
  type PlayerIndex,
} from "../src/engine";
import { FILLER, board, follower, handNames, names, passTurns, play, rid, setup, toBoard, toHand } from "./rotationHelpers";

// setup の deck は player 0 のデッキで、自分（先攻）とは限らないので、信仰を使うテストは両方のデッキに入れる
const KARG = ["旧き天晶・カルギデンスラ"];
const FEATHER = ALL_CARDS.find((c) => c.id === FILLER)!.name;

/** 自分の場の【土の印】を n にする */
function sigils(s: GameState, p: PlayerIndex, n: number) {
  const a = toBoard(s, p, "大地の魔片") as AmuletOnBoard;
  a.sigils = n;
}
const sigilCount = (s: GameState, p: PlayerIndex) =>
  (board(s, p).find((c) => c.kind === "amulet" && c.sigils !== null) as AmuletOnBoard | undefined)?.sigils ?? 0;
const followers = (s: GameState, p: PlayerIndex) => board(s, p).filter((c): c is FollowerOnBoard => c.kind === "follower");
const byName = (s: GameState, p: PlayerIndex, name: string) =>
  followers(s, p).filter((c) => c.cardId === rid(name) || ALL_CARDS.find((x) => x.id === c.cardId)?.name === name);
const crestNames = (s: GameState, p: PlayerIndex) =>
  s.players[p].crests.map((c) => ALL_CRESTS.find((x) => x.id === c.crestId)?.name);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ext = (s: GameState, p: PlayerIndex): any => (s.players[p] as any).ext;
const hand = (s: GameState, p: PlayerIndex, iid: number) => s.players[p].hand.find((h) => h.iid === iid)!;
const ready = (s: GameState, p: PlayerIndex) => {
  s.players[p].ep = 2;
  s.players[p].sep = 2;
};

describe("ウィッチ（ローテーション）の定義", () => {
  it("能力テキストを持つウィッチのカード（生成するトークンを含む）とクレストに定義がある", () => {
    const STATIC_LINE = /^(【(守護|疾走|突進|必殺|ドレイン|潜伏|威圧|バリア|オーラ|土の印|カウントダウン_\d+)】|1ターンに\d回攻撃できる。)$/;
    const byId = new Map(ALL_CARDS.map((c) => [c.id, c]));
    const pool = new Map(ALL_CARDS.filter((c) => c.class === "witch" && inFormat(ROTATION, c)).map((c) => [c.id, c]));
    const queue: Card[] = [...pool.values()];
    while (queue.length > 0) {
      for (const ref of (queue.pop() as Card).related) {
        const r = byId.get(ref);
        if (r && r.class === "witch" && !pool.has(ref)) {
          pool.set(ref, r);
          queue.push(r);
        }
      }
    }
    const missing = [...pool.values()]
      .filter((c) => c.text.split("\n").some((l) => l !== "" && !STATIC_LINE.test(l)) && !CARD_ABILITIES[c.id])
      .map((c) => `${c.id} ${c.name}`);
    expect(missing).toEqual([]);
    const crests = ALL_CRESTS.filter((c) => pool.has(c.source) && !CREST_ABILITIES[c.id]).map((c) => c.name);
    expect(crests).toEqual([]);
  });

  it("第8弾のストームブラストは第1弾と同じ能力", () => {
    const { s, me, opp } = setup();
    const big = toBoard(s, opp, "キャラバンマンモス");
    const sb = toHand(s, me, "ストームブラスト");
    expect(hand(s, me, sb).cardId).toBe("10831310");
    toHand(s, me, "知恵の輝き");
    const w = s.players[me].hand[1]!.iid;
    let t = play(s, w); // スペルブースト → X=3
    t = play(t, sb);
    expect(follower(t, big.iid)?.defense).toBe(7);
  });
});

describe("第4弾", () => {
  it("さすらいの家庭教師・スフラマール: ターン終了時に攻撃力の回数スペルブースト。進化すると攻撃できない", () => {
    const { s, me } = setup({ turn: 8 });
    ready(s, me);
    const f = toBoard(s, me, "さすらいの家庭教師・スフラマール");
    const sb = toHand(s, me, "ストームブラスト");
    const t = applyAction(s, { type: "endTurn" });
    expect(hand(t, me, sb).x).toBe(3);
    // 進化すると 3/3 で、攻撃できない
    let u = applyAction(s, { type: "evolve", iid: f.iid });
    expect(legalActions(u).some((a) => a.type === "attack" && a.attacker === f.iid)).toBe(false);
    u = applyAction(u, { type: "endTurn" });
    expect(hand(u, me, sb).x).toBe(5);
  });

  it("辛苦の旅路・ミレイユ＆リゼット: 【土の秘術_2】で両方が進化する", () => {
    const { s, me } = setup();
    sigils(s, me, 2);
    const m = toHand(s, me, "辛苦の旅路・ミレイユ＆リゼット");
    const t = play(s, m);
    const ms = byName(t, me, "辛苦の旅路・ミレイユ＆リゼット");
    expect(ms.length).toBe(2);
    expect(ms.every((f) => f.evolve === "evolved")).toBe(true);
    expect(sigilCount(t, me)).toBe(0);

    const b = setup();
    const m2 = toHand(b.s, b.me, "辛苦の旅路・ミレイユ＆リゼット");
    const t2 = play(b.s, m2);
    expect(byName(t2, b.me, "辛苦の旅路・ミレイユ＆リゼット").every((f) => f.evolve === "none")).toBe(true);
  });

  it("アンリーシュ: モード（2）で2枚引き、ランダム2枚に4ダメージ、自分に2ダメージ", () => {
    const { s, me, opp } = setup();
    const a = toBoard(s, opp, "ガーディアンゴーレム");
    const b = toBoard(s, opp, "キャラバンマンモス");
    const u = toHand(s, me, "アンリーシュ");
    const t = play(s, u, 1);
    expect(t.players[me].hand.length).toBe(2);
    expect(t.players[me].leaderHp).toBe(18);
    expect(follower(t, a.iid)).toBeUndefined();
    expect(follower(t, b.iid)?.defense).toBe(6);
  });

  it("懐旧の送り火・エルモート: 能力を失わせて3ダメージ。超進化でクレスト（ターン開始時に相手に1ダメージ）", () => {
    const { s, me, opp } = setup({ turn: 8 });
    ready(s, me);
    const ward = toBoard(s, opp, "ラブリーマスターピース");
    const e = toHand(s, me, "懐旧の送り火・エルモート");
    let t = play(s, e);
    expect(follower(t, ward.iid)).toMatchObject({ keywords: [], defense: 5 });
    const el = byName(t, me, "懐旧の送り火・エルモート")[0]!;
    t = applyAction(t, { type: "superEvolve", iid: el.iid });
    expect(crestNames(t, me)).toEqual(["クレスト：懐旧の送り火・エルモート"]);
    t = passTurns(t, 1);
    expect(t.players[opp].leaderHp).toBe(19);
  });

  it("アルケミック・フレア: 【奥義】で相手のリーダーに2ダメージ", () => {
    for (const [turn, hp] of [
      [9, 20],
      [10, 18],
    ] as const) {
      const { s, me, opp } = setup({ turn });
      const g = toBoard(s, opp, "キャラバンマンモス");
      const f = toHand(s, me, "アルケミック・フレア");
      const t = play(s, f);
      expect(follower(t, g.iid)?.defense).toBe(6);
      expect(sigilCount(t, me)).toBe(1);
      expect(t.players[opp].leaderHp).toBe(hp);
    }
  });

  it("水の理・ワムデュス: スペルブーストで+1/+1。超進化時のモード（2）で攻撃力を割りふる", () => {
    const { s, me, opp } = setup({ turn: 8 });
    ready(s, me);
    const w = toHand(s, me, "水の理・ワムデュス");
    const sp = toHand(s, me, "睦まやかな団欒");
    let t = play(s, sp); // プレイで1回 + 能力で1回
    expect(hand(t, me, w)).toMatchObject({ attackMod: 2, defenseMod: 2 });
    t = play(t, w);
    const clay = toBoard(t, opp, "クレイゴーレム");
    const guard = toBoard(t, opp, "ガーディアンゴーレム");
    const big = toBoard(t, opp, "キャラバンマンモス");
    t = applyAction(t, { type: "superEvolve", iid: w });
    t = applyAction(t, { type: "mode", index: 1 }); // 攻撃力 5 を古い順に 2・3
    expect(follower(t, clay.iid)).toBeUndefined();
    expect(follower(t, guard.iid)).toBeUndefined();
    expect(follower(t, big.iid)?.defense).toBe(10);
  });

  it("天才美少女錬金術師・カリオストロ: 【奥義】で進化、【解放奥義】でクレスト（ターン開始時に土の秘術でアルス・マグナ）", () => {
    {
      const { s, me } = setup({ turn: 10 });
      const c = toHand(s, me, "天才美少女錬金術師・カリオストロ");
      const t = play(s, c);
      expect(follower(t, c)?.evolve).toBe("evolved");
      expect(crestNames(t, me)).toEqual([]);
      expect(handNames(t, me)).toEqual(["アルス・マグナ"]);
      expect(sigilCount(t, me)).toBe(2);
    }
    const { s, me } = setup({ turn: 15 });
    const c = toHand(s, me, "天才美少女錬金術師・カリオストロ");
    let t = play(s, c);
    expect(crestNames(t, me)).toEqual(["クレスト：天才美少女錬金術師・カリオストロ"]);
    t.players[me].hand = [];
    t = passTurns(t, 1);
    expect(handNames(t, me).filter((n) => n === "アルス・マグナ").length).toBe(1);
    expect(sigilCount(t, me)).toBe(1);
  });
});

describe("第5弾", () => {
  it("明越花の転変: 手札を1枚選んで捨て、2枚引く", () => {
    const { s, me } = setup();
    const a = toHand(s, me, "クレイゴーレム");
    toHand(s, me, "ガーディアンゴーレム");
    const sp = toHand(s, me, "明越花の転変");
    const t = play(s, sp, [a]);
    expect(t.players[me].hand.length).toBe(3);
    expect(handNames(t, me)).not.toContain("クレイゴーレム");
  });

  it("インソムニアウィッチ: クレストのカウントダウンが0、または進化で破壊すると場のフォロワーすべてに3ダメージ", () => {
    {
      const { s, me, opp } = setup({ turn: 8 });
      ready(s, me);
      const o = toBoard(s, opp, "キャラバンマンモス");
      const iw = toHand(s, me, "インソムニアウィッチ");
      let t = play(s, iw);
      expect(crestNames(t, me)).toEqual(["クレスト：インソムニアウィッチ"]);
      t = applyAction(t, { type: "evolve", iid: iw });
      expect(crestNames(t, me)).toEqual([]);
      expect(follower(t, o.iid)?.defense).toBe(7);
      expect(follower(t, iw)?.defense).toBe(2);
    }
    const { s, me, opp } = setup();
    const o = toBoard(s, opp, "キャラバンマンモス");
    const iw = toHand(s, me, "インソムニアウィッチ");
    let t = play(s, iw);
    t = passTurns(t, 1);
    expect(follower(t, o.iid)?.defense).toBe(10);
    t = passTurns(t, 1);
    expect(crestNames(t, me)).toEqual([]);
    expect(follower(t, o.iid)?.defense).toBe(7);
  });

  it("キティトリック: 【土の秘術_2】でランダム2つの能力が働く", () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const { s, me } = setup({ seed });
      s.players[me].leaderHp = 10;
      sigils(s, me, 2);
      const k = toHand(s, me, "キティトリック");
      const t = play(s, k);
      const got = [
        byName(t, me, "クレイゴーレム").length === 1,
        t.players[me].leaderHp === 12,
        sigilCount(t, me) === 3,
      ];
      expect(got.filter(Boolean).length).toBe(2);
    }
  });

  it("エレメンタルガバナー: 出したガーディアンゴーレムが【土の秘術_1】で進化する", () => {
    const { s, me } = setup();
    sigils(s, me, 2);
    const g = toHand(s, me, "エレメンタルガバナー");
    const t = play(s, g);
    const golems = byName(t, me, "ガーディアンゴーレム");
    expect(golems.map((f) => f.evolve)).toEqual(["evolved", "evolved"]);
    expect(sigilCount(t, me)).toBe(0);
  });

  it("壮美なる明越花: 自分の場のフォロワーはそれぞれデッキのフォロワーのコピーに変身する", () => {
    const { s, me } = setup();
    toBoard(s, me, "クレイゴーレム");
    toBoard(s, me, "ガーディアンゴーレム");
    const sp = toHand(s, me, "壮美なる明越花");
    const t = play(s, sp);
    expect(names(t, me)).toEqual([FEATHER, FEATHER]);
  });

  it("歩む《愚者》・リンクル: クレストは次のリンクルが出たとき相手の最大体力-2。超進化でデッキに10枚", () => {
    const { s, me, opp } = setup({ turn: 8 });
    ready(s, me);
    const a = toHand(s, me, "歩む《愚者》・リンクル");
    const b = toHand(s, me, "歩む《愚者》・リンクル");
    let t = play(s, a);
    expect(t.players[opp].leaderMaxHp).toBe(20);
    t = play(t, b);
    expect(t.players[opp].leaderMaxHp).toBe(18);
    expect(t.players[opp].leaderHp).toBe(18);
    const deck = t.players[me].deck.length;
    t = applyAction(t, { type: "superEvolve", iid: a });
    expect(t.players[me].deck.length).toBe(deck + 10);
  });

  it("明越花・アラ: 進化時に場の他のフォロワー1枚を壮麗なる隼に変身させる", () => {
    const { s, me, opp } = setup({ turn: 8 });
    ready(s, me);
    const ara = toBoard(s, me, "明越花・アラ");
    toBoard(s, me, "クレイゴーレム");
    const o = toBoard(s, opp, "キャラバンマンモス");
    let t = applyAction(s, { type: "evolve", iid: ara.iid });
    t = applyAction(t, { type: "choose", targets: [o.iid] });
    expect(names(t, opp)).toEqual(["壮麗なる隼"]);
  });
});

describe("第6弾", () => {
  it("旧き天晶・カルギデンスラ: 手札で魔手が出るとコスト-1、信仰値+1。疾走の魔手2枚。進化で天晶の深淵", () => {
    const { s, me } = setup({ deck: KARG, oppDeck: KARG, turn: 8 });
    ready(s, me);
    expect(ext(s, me).faith?.value).toBe(0);
    const k = toHand(s, me, "旧き天晶・カルギデンスラ");
    const g = toHand(s, me, "天晶授与");
    let t = play(s, g);
    expect(handCost(hand(t, me, k))).toBe(8);
    expect(ext(t, me).faith.value).toBe(2);
    t = play(t, k);
    const manos = byName(t, me, "天晶の魔手");
    expect(manos.length).toBe(4);
    expect(manos.slice(2).every((f) => f.keywords.includes("storm"))).toBe(true);
    expect(ext(t, me).faith.value).toBe(4);
    t = applyAction(t, { type: "evolve", iid: k });
    expect(handNames(t, me)).toEqual(["天晶の深淵"]);
  });

  it("天晶の深淵: 魔手の+X/+X・回復Y・ダメージZ の合計が信仰値になる", () => {
    for (const seed of [1, 2, 3]) {
      const { s, me, opp } = setup({ deck: KARG, oppDeck: KARG, seed });
      ext(s, me).faith.value = 6;
      s.players[me].leaderHp = 10;
      const d = toHand(s, me, "天晶の深淵");
      const t = play(s, d);
      const mano = byName(t, me, "天晶の魔手")[0]!;
      const x = mano.attack - 1;
      expect(mano.defense - 1).toBe(x);
      const y = t.players[me].leaderHp - 10;
      const z = 20 - t.players[opp].leaderHp;
      expect(x + y + z).toBe(6);
      // 深淵で出した魔手の分の信仰値+1（信仰値は減らない）
      expect(ext(t, me).faith.value).toBe(7);
    }
  });

  it("魔境の生徒: 自分の天晶の魔手が出るたびリーダーを1回復", () => {
    const { s, me } = setup();
    s.players[me].leaderHp = 10;
    const m = toHand(s, me, "魔境の生徒");
    const t = play(s, m);
    expect(t.players[me].leaderHp).toBe(12);
  });

  it("正常の侵食: 魔手を破壊して2枚引く（魔手がいなければプレイできない）", () => {
    const { s, me } = setup();
    const sp = toHand(s, me, "正常の侵食");
    expect(legalActions(s).some((a) => a.type === "play" && a.iid === sp)).toBe(false);
    toBoard(s, me, "天晶の魔手");
    const t = play(s, sp);
    expect(byName(t, me, "天晶の魔手").length).toBe(0);
    expect(t.players[me].hand.length).toBe(2);
  });

  it("魔恋の天晶: 【エンハンス_6】ですべて、そうでなければモードを選ぶ", () => {
    {
      const { s, me } = setup();
      const sp = toHand(s, me, "魔恋の天晶");
      const t = play(s, sp);
      const manos = byName(t, me, "天晶の魔手");
      expect(manos.map((f) => f.attack)).toEqual([2, 2, 2]);
      expect(manos[0]!.keywords).toContain("storm");
      expect(manos[1]!.keywords).not.toContain("storm");
    }
    const { s, me } = setup();
    s.players[me].pp = 5;
    const sp = toHand(s, me, "魔恋の天晶");
    const t = play(s, sp, 0);
    const manos = byName(t, me, "天晶の魔手");
    expect(manos.length).toBe(1);
    expect(manos[0]).toMatchObject({ attack: 2 });
    expect(manos[0]!.keywords).toContain("storm");
  });

  it("魔恋の慕情・シイム: クレストで天晶の魔手が攻撃するとき+1/+0", () => {
    const { s, me, opp } = setup({ turn: 8 });
    ready(s, me);
    const sh = toBoard(s, me, "魔恋の慕情・シイム");
    let t = applyAction(s, { type: "superEvolve", iid: sh.iid });
    expect(crestNames(t, me)).toEqual(["クレスト：魔恋の慕情・シイム"]);
    const mano = toBoard(t, me, "天晶の魔手");
    t = applyAction(t, { type: "attack", attacker: mano.iid, target: "leader" });
    expect(t.players[opp].leaderHp).toBe(18);
    expect(follower(t, mano.iid)?.attack).toBe(2);
  });
});

describe("第7弾", () => {
  it("スレイヴコール・グラトンスペル: 手札で、自分が土の秘術するとコスト-1", () => {
    const { s, me } = setup();
    sigils(s, me, 3);
    const sc = toHand(s, me, "スレイヴコール");
    const gs = toHand(s, me, "グラトンスペル");
    const d = toHand(s, me, "ディンキークリーチャー");
    const t = play(s, d);
    expect(follower(t, d)?.evolve).toBe("evolved");
    expect(handCost(hand(t, me, sc))).toBe(3);
    expect(handCost(hand(t, me, gs))).toBe(3);
  });

  it("スウィートエンティティ: 土の印があればモードを選んで土の秘術、無ければ何もしない", () => {
    {
      const { s, me, opp } = setup();
      sigils(s, me, 1);
      const o = toBoard(s, opp, "キャラバンマンモス");
      const se = toHand(s, me, "スウィートエンティティ");
      const t = play(s, se, 0);
      expect(follower(t, o.iid)?.defense).toBe(7);
      expect(sigilCount(t, me)).toBe(0);
    }
    const { s, me, opp } = setup();
    const o = toBoard(s, opp, "キャラバンマンモス");
    const se = toHand(s, me, "スウィートエンティティ");
    const t = play(s, se);
    expect(t.pending).toBeNull();
    expect(follower(t, o.iid)?.defense).toBe(10);
  });

  it("暴食の間食: モード（2）の【土の秘術_2】", () => {
    const { s, me, opp } = setup();
    sigils(s, me, 2);
    const o = toBoard(s, opp, "ガーディアンゴーレム");
    const sp = toHand(s, me, "暴食の間食");
    const t = play(s, sp, 1);
    expect(follower(t, o.iid)?.defense).toBe(1);
    expect(sigilCount(t, me)).toBe(0);
  });

  it("万食のアナテマ・ララアンセム: クレストは相手のターン終了時に進化したララアンセムを出し、次の自分のターンに消える", () => {
    const { s, me } = setup();
    sigils(s, me, 1);
    const l = toHand(s, me, "万食のアナテマ・ララアンセム");
    let t = play(s, l);
    expect(crestNames(t, me)).toEqual(["クレスト：万食のアナテマ・ララアンセム"]);
    t = passTurns(t, 1);
    const ls = byName(t, me, "万食のアナテマ・ララアンセム");
    expect(ls.map((f) => f.evolve)).toEqual(["none", "evolved"]);
    expect(crestNames(t, me)).toEqual([]);
  });

  it("万食のアナテマ・ララアンセム: 進化時に【土の秘術_1】で選んだ相手のフォロワーを破壊", () => {
    const { s, me, opp } = setup({ turn: 8 });
    ready(s, me);
    sigils(s, me, 1);
    const l = toBoard(s, me, "万食のアナテマ・ララアンセム");
    const a = toBoard(s, opp, "キャラバンマンモス");
    const b = toBoard(s, opp, "クレイゴーレム");
    let t = applyAction(s, { type: "evolve", iid: l.iid });
    t = applyAction(t, { type: "choose", targets: [a.iid] });
    expect(follower(t, a.iid)).toBeUndefined();
    expect(follower(t, b.iid)).toBeDefined();
    expect(sigilCount(t, me)).toBe(0);
  });

  it("ラブリーマスターピース: ラストワードの【土の秘術_2】で相手に3ダメージ", () => {
    const { s, me, opp } = setup();
    sigils(s, me, 2);
    const lm = toBoard(s, me, "ラブリーマスターピース");
    (lm as FollowerOnBoard).defense = 1;
    const sp = toHand(s, me, "インソムニアウィッチ");
    let t = play(s, sp);
    t = passTurns(t, 2); // クレストのラストワードで 3 ダメージ
    expect(follower(t, lm.iid)).toBeUndefined();
    expect(t.players[opp].leaderHp).toBe(17);
  });
});

describe("第8弾", () => {
  it("地を這う雷撃: 攻撃力最大のフォロワーに8ダメージ、相手に2ダメージ、【土の秘術_2】で同名カードを手札に", () => {
    const { s, me, opp } = setup();
    sigils(s, me, 2);
    const small = toBoard(s, opp, "クレイゴーレム");
    const big = toBoard(s, opp, "ガーディアンゴーレム");
    const sp = toHand(s, me, "地を這う雷撃");
    const t = play(s, sp);
    expect(follower(t, big.iid)).toBeUndefined();
    expect(follower(t, small.iid)?.defense).toBe(2);
    expect(t.players[opp].leaderHp).toBe(18);
    expect(handNames(t, me)).toEqual(["地を這う雷撃"]);
  });

  it("マナリアスクリプター・ティコ: 進化でマナリア・スペルのコスト-1、超進化のクレストでマナリア・スペルをプレイすると相手に1ダメージ", () => {
    const { s, me, opp } = setup({ turn: 8 });
    ready(s, me);
    const ty = toHand(s, me, "マナリアスクリプター・ティコ");
    let t = play(s, ty);
    expect(handNames(t, me)).toEqual(["マナリアの魔弾", "マナリアの魔弾"]);
    t = applyAction(t, { type: "superEvolve", iid: ty });
    expect(t.players[me].hand.map(handCost)).toEqual([0, 0]);
    expect(crestNames(t, me)).toEqual(["クレスト：マナリアスクリプター・ティコ"]);
    const o = toBoard(t, opp, "キャラバンマンモス");
    t = play(t, t.players[me].hand[0]!.iid);
    expect(follower(t, o.iid)?.defense).toBe(7);
    expect(t.players[opp].leaderHp).toBe(19);
  });

  it("鋼鉄の微睡み: Xが5以上なら2回復・PPを2回復", () => {
    for (const [x, hp, pp] of [
      [4, 10, 7],
      [5, 12, 9],
    ] as const) {
      const { s, me } = setup();
      s.players[me].leaderHp = 10;
      const sp = toHand(s, me, "鋼鉄の微睡み");
      hand(s, me, sp).x = x;
      const t = play(s, sp);
      expect(t.players[me].hand.length).toBe(2);
      expect(t.players[me].leaderHp).toBe(hp);
      expect(t.players[me].pp).toBe(pp);
    }
  });

  it("恩愛の大地・テトラ＆ラティカ: Xが10以上でソニック・フォー、20以上で大いなる回帰も", () => {
    for (const [x, expected] of [
      [9, []],
      [10, ["ソニック・フォー"]],
      [20, ["ソニック・フォー", "大いなる回帰"]],
    ] as const) {
      const { s, me } = setup();
      const c = toHand(s, me, "恩愛の大地・テトラ＆ラティカ");
      expect(hand(s, me, c).x).toBe(0);
      hand(s, me, c).x = x;
      const t = play(s, c);
      expect(handNames(t, me)).toEqual(expected);
    }
  });

  it("恩愛の大地・テトラ＆ラティカ: スペルブーストでXが増える", () => {
    const { s, me } = setup();
    const c = toHand(s, me, "恩愛の大地・テトラ＆ラティカ");
    const sp = toHand(s, me, "睦まやかな団欒");
    const t = play(s, sp);
    expect(hand(t, me, c).x).toBe(2);
  });

  it("災いの言霊・ジンジャー: 他のフォロワーが出るたび突進を持たせ、手札をスペルブースト", () => {
    const { s, me } = setup();
    const sb = toHand(s, me, "ストームブラスト");
    const g = toHand(s, me, "災いの言霊・ジンジャー");
    const t = play(s, g);
    const golems = byName(t, me, "ガーディアンゴーレム");
    expect(golems.length).toBe(2);
    expect(golems.every((f) => f.keywords.includes("rush"))).toBe(true);
    expect(hand(t, me, sb).x).toBe(4);
  });

  it("ハッピーフラワー・サミー＆マリー: 自分は2枚、相手は1枚引く", () => {
    const { s, me, opp } = setup();
    const h = toHand(s, me, "ハッピーフラワー・サミー＆マリー");
    const t = play(s, h);
    expect(t.players[me].hand.length).toBe(2);
    expect(t.players[opp].hand.length).toBe(1);
  });
});

describe("第9弾", () => {
  it("没入の実験体: このバトル中に他の実験体が5枚以上出ていれば+3/+3", () => {
    for (const [before, atk] of [
      [4, 2],
      [5, 5],
    ] as const) {
      const { s, me } = setup();
      ext(s, me).entered = Array(before).fill(rid("没入の実験体"));
      const x = toHand(s, me, "没入の実験体");
      const t = play(s, x);
      expect(follower(t, x)).toMatchObject({ attack: atk, defense: atk });
    }
  });

  it("没入の実験体: 同時に出た実験体も数える（場に出たときの能力は出し終えてから解決する）", () => {
    const { s, me } = setup();
    let t = s;
    for (const name of ["人らしい愛", "烏ノ涅", "烏ノ涅"]) {
      t.players[me].pp = 10;
      t = play(t, toHand(t, me, name));
    }
    // 実験体（場に3枚、手札に1枚）
    t.players[me].board = [];
    t.players[me].pp = 10;
    // エンハンス_8: 3枚（4〜6枚目）。3枚を出し終えてから「場に出たとき」を解決するので、どれも他の実験体を5枚数える
    t = play(t, toHand(t, me, "心酔の研究者"));
    const subjects = byName(t, me, "没入の実験体");
    expect(subjects.map((f) => f.attack)).toEqual([5, 5, 5]);
    expect(subjects.every((f) => f.keywords.includes("ward"))).toBe(true);
  });

  it("心酔の研究者: エンハンスでないときは2枚（守護なし）。進化時に実験体に必殺", () => {
    const { s, me } = setup({ turn: 8 });
    ready(s, me);
    s.players[me].pp = 7;
    const c = toHand(s, me, "心酔の研究者");
    let t = play(s, c);
    const subjects = byName(t, me, "没入の実験体");
    expect(subjects.length).toBe(2);
    expect(subjects.some((f) => f.keywords.includes("ward"))).toBe(false);
    t = applyAction(t, { type: "evolve", iid: c });
    t = applyAction(t, { type: "choose", targets: [subjects[1]!.iid] });
    expect(follower(t, subjects[1]!.iid)?.keywords).toContain("bane");
  });

  it("キースピリット: 進化時に手札の【スペルブースト時】を持つカードを4回スペルブースト", () => {
    const { s, me } = setup({ turn: 8 });
    ready(s, me);
    const k = toBoard(s, me, "キースピリット");
    const sb = toHand(s, me, "ストームブラスト");
    toHand(s, me, "クレイゴーレム");
    const t = applyAction(s, { type: "evolve", iid: k.iid });
    expect(hand(t, me, sb).x).toBe(6);
  });

  it("高潔なる哲学者: 手札すべてをデッキに戻し、その枚数引く", () => {
    const { s, me } = setup();
    for (let i = 0; i < 3; i++) toHand(s, me, "クレイゴーレム");
    const p = toHand(s, me, "高潔なる哲学者");
    const t = play(s, p);
    expect(t.players[me].hand.length).toBe(3);
  });

  it("人らしい愛: 場と手札の実験体が+1/+0", () => {
    const { s, me } = setup();
    const sp = toHand(s, me, "人らしい愛");
    const t = play(s, sp);
    expect(byName(t, me, "没入の実験体")[0]).toMatchObject({ attack: 3, defense: 2 });
    expect(t.players[me].hand[0]).toMatchObject({ attackMod: 1, defenseMod: 0 });
  });

  it("万術の咎人・セフィー: 融合したときPPを2消費して実験体を出す", () => {
    const { s, me } = setup();
    const host = toHand(s, me, "万術の咎人・セフィー");
    const m = toHand(s, me, "クレイゴーレム");
    const t = applyAction(s, { type: "fuse", host, materials: [m] });
    expect(t.players[me].pp).toBe(8);
    expect(names(t, me)).toEqual(["没入の実験体"]);
  });

  it("万術の咎人・セフィー: クレストで実験体が出たとき、自分のターンごとに1回疾走", () => {
    const { s, me } = setup({ turn: 8 });
    ready(s, me);
    const sf = toBoard(s, me, "万術の咎人・セフィー");
    let t = applyAction(s, { type: "superEvolve", iid: sf.iid });
    expect(crestNames(t, me)).toEqual(["クレスト：万術の咎人・セフィー"]);
    t = play(t, toHand(t, me, "烏ノ涅"));
    t = play(t, toHand(t, me, "烏ノ涅"));
    const subjects = byName(t, me, "没入の実験体");
    expect(subjects.map((f) => f.keywords.includes("storm"))).toEqual([true, false]);
  });

  it("恍惚の才媛: 融合していたなら、超進化時に実験体にドレイン", () => {
    const { s, me } = setup({ turn: 8 });
    ready(s, me);
    const host = toHand(s, me, "恍惚の才媛");
    const m = toHand(s, me, "クレイゴーレム");
    let t = applyAction(s, { type: "fuse", host, materials: [m] });
    t = play(t, host);
    const subject = byName(t, me, "没入の実験体")[0]!;
    t = applyAction(t, { type: "superEvolve", iid: host });
    expect(follower(t, subject.iid)?.keywords).toContain("drain");
  });

  it("恍惚の才媛: 融合していなければ、超進化してもドレインを持たない", () => {
    const { s, me } = setup({ turn: 8 });
    ready(s, me);
    const host = toHand(s, me, "恍惚の才媛");
    let t = play(s, host);
    expect(t.players[me].hand.length).toBe(2);
    const subject = byName(t, me, "没入の実験体")[0]!;
    t = applyAction(t, { type: "superEvolve", iid: host });
    expect(follower(t, subject.iid)?.keywords).not.toContain("drain");
  });
});

describe("トークン", () => {
  it("アルス・マグナ: 相手のリーダーも選べる。自分を1回復", () => {
    const { s, me, opp } = setup();
    s.players[me].leaderHp = 15;
    toBoard(s, opp, "キャラバンマンモス");
    const a = toHand(s, me, "アルス・マグナ");
    const t = play(s, a, [leaderId(opp)]);
    expect(t.players[opp].leaderHp).toBe(18);
    expect(t.players[me].leaderHp).toBe(16);
  });

  it("大いなる回帰: 選んだフォロワーは1ターンに2回攻撃できる", () => {
    const { s, me } = setup();
    const f = toBoard(s, me, "クレイゴーレム");
    const t = play(s, toHand(s, me, "大いなる回帰"));
    expect(follower(t, f.iid)?.maxAttacks).toBe(2);
  });
});
