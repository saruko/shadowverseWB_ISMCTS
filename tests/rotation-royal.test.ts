// ローテーションのロイヤルのカード（src/cards/abilities/rotation/royal.ts）の最小シナリオ

import { describe, expect, it } from "vitest";
import { applyAction, leaderId, type GameState, type PlayerIndex } from "../src/engine";
import {
  FILLER,
  board,
  can,
  follower,
  handNames,
  names,
  passTurns,
  play,
  rid,
  setup,
  toBoard,
  toHand,
} from "./rotationHelpers";

// rust 側の状態（JSON）にある、ローテーションの記録（連携・信仰）
const ext = (s: GameState, p: PlayerIndex) => (s.players[p] as unknown as { ext: Record<string, unknown> }).ext;
/** このバトル中に場に出た自分のフォロワーの数（連携）を n にする */
const setLink = (s: GameState, p: PlayerIndex, n: number) => {
  ext(s, p).entered = Array(n).fill(FILLER);
};
const faithValue = (s: GameState, p: PlayerIndex) => (ext(s, p).faith as { value: number } | null)?.value;
const crestNames = (s: GameState, p: PlayerIndex) => s.players[p].crests.map((c) => c.crestId);
const evolve = (s: GameState, iid: number, ...targets: number[][]) => {
  let t = applyAction(s, { type: "evolve", iid });
  for (const x of targets) t = applyAction(t, { type: "choose", targets: x });
  return t;
};
const superEvolve = (s: GameState, iid: number, ...targets: number[][]) => {
  let t = applyAction(s, { type: "superEvolve", iid });
  for (const x of targets) t = applyAction(t, { type: "choose", targets: x });
  return t;
};
const hp = (s: GameState, p: PlayerIndex) => s.players[p].leaderHp;
/** 手札のカードのコスト（プレイできる最小の PP。setCost は TS の handCost に表れないので、エンジンの合法手で見る） */
const handCostOf = (s: GameState, p: PlayerIndex, name: string) => {
  const h = s.players[p].hand.find((c) => c.cardId === rid(name));
  if (!h) return undefined;
  for (let pp = 0; pp <= 10; pp++) {
    const c = structuredClone(s);
    c.players[p].pp = pp;
    if (can(c, { type: "play", iid: h.iid })) return pp;
  }
  return undefined;
};

describe("第4弾", () => {
  it("信念の蹴撃・ランドル: エンハンス_5 なら疾走", () => {
    const { s, me } = setup();
    const t = play(s, toHand(s, me, "信念の蹴撃・ランドル"));
    expect(board(t, me)[0]?.keywords).toContain("storm");
    const u = setup();
    u.s.players[u.me].pp = 4;
    const t2 = play(u.s, toHand(u.s, u.me, "信念の蹴撃・ランドル"));
    expect(board(t2, u.me)[0]?.keywords).not.toContain("storm");
  });

  it("決意の輝竜・アーサー: 進化時にモルドレッドを出す", () => {
    const { s, me } = setup({ turn: 5 });
    const a = toBoard(s, me, "決意の輝竜・アーサー");
    const t = evolve(s, a.iid);
    expect(names(t, me)).toEqual(["決意の輝竜・アーサー", "迷夢の獅子・モルドレッド"]);
  });

  it("真王の刃・黄金の騎士: エンハンス_8 ならすべて（超進化・4ダメージ・4回復）", () => {
    const { s, me, opp } = setup();
    s.players[me].leaderHp = 10;
    toBoard(s, opp, "燃え滾る闘志・フェザー");
    toBoard(s, opp, "燃え滾る闘志・フェザー");
    const t = play(s, toHand(s, me, "真王の刃・黄金の騎士"));
    expect(t.pending).toBeNull();
    expect(board(t, opp)).toHaveLength(0);
    expect(hp(t, me)).toBe(14);
    expect(follower(t, board(t, me)[0]!.iid)?.evolve).toBe("superEvolved");
  });

  it("真王の刃・黄金の騎士: エンハンスなしは1つを選ぶ", () => {
    const { s, me } = setup();
    s.players[me].pp = 7;
    s.players[me].leaderHp = 10;
    const t = play(s, toHand(s, me, "真王の刃・黄金の騎士"), 2);
    expect(hp(t, me)).toBe(14);
    expect(follower(t, board(t, me)[0]!.iid)?.evolve).toBe("none");
  });

  it("リッター・シュナイト: （1）左から1枚が2回攻撃・（3）PP2とEP1を回復", () => {
    const { s, me } = setup();
    const a = toBoard(s, me, "信念の蹴撃・ランドル");
    const b = toBoard(s, me, "信念の蹴撃・ランドル");
    const t = play(s, toHand(s, me, "リッター・シュナイト"), 0);
    expect(follower(t, a.iid)?.maxAttacks).toBe(2);
    expect(follower(t, b.iid)?.maxAttacks).toBe(1);
    const u = setup();
    u.s.players[u.me].ep = 1;
    const t2 = play(u.s, toHand(u.s, u.me, "リッター・シュナイト"), 2);
    expect(t2.players[u.me].pp).toBe(7);
    expect(t2.players[u.me].ep).toBe(2);
  });

  it("真紅と群青・ゼタ＆ベアトリクス: エンハンス_6 で出したものは必殺、これは疾走", () => {
    const { s, me } = setup();
    const t = play(s, toHand(s, me, "真紅と群青・ゼタ＆ベアトリクス"));
    const [self, other] = board(t, me);
    expect(self?.keywords).toContain("storm");
    expect(other?.keywords).toContain("bane");
  });

  it("十天衆の頭目・シエテ: 奥義で進化前のフォロワーすべてを進化、解放奥義で超進化", () => {
    const run = (turn: number) => {
      const { s, me } = setup({ turn });
      const a = toBoard(s, me, "信念の蹴撃・ランドル");
      const t = play(s, toHand(s, me, "十天衆の頭目・シエテ"));
      return [follower(t, a.iid)?.evolve, follower(t, board(t, me)[1]!.iid)?.evolve];
    };
    expect(run(9)).toEqual(["none", "none"]);
    expect(run(10)).toEqual(["evolved", "evolved"]);
    expect(run(15)).toEqual(["superEvolved", "superEvolved"]);
  });
});

describe("第5弾", () => {
  it("喜捨の名士: スペルを捨てたら6回復、それ以外は3回復", () => {
    for (const [name, heal] of [
      ["輝く金貨", 6],
      ["信念の蹴撃・ランドル", 3],
    ] as const) {
      const { s, me } = setup();
      s.players[me].leaderHp = 10;
      const keep = toHand(s, me, "黄金の杯");
      const x = toHand(s, me, name);
      const iid = toHand(s, me, "喜捨の名士");
      const t = play(s, iid, [x]);
      expect(hp(t, me)).toBe(10 + heal);
      expect(t.players[me].hand.map((h) => h.iid)).toEqual([keep]);
    }
  });

  it("煙管の美玉: 手札のスペルが2枚以上なら+1/+1して守護", () => {
    const { s, me } = setup();
    toHand(s, me, "輝く金貨");
    toHand(s, me, "黄金の杯");
    const t = play(s, toHand(s, me, "煙管の美玉"));
    const c = follower(t, board(t, me)[0]!.iid)!;
    expect([c.attack, c.defense]).toEqual([4, 4]);
    expect(c.keywords).toContain("ward");
  });

  it("麗金花の散財: 手札のスペルが無ければプレイできない。捨てて3ダメージを2回", () => {
    const { s, me, opp } = setup();
    const iid = toHand(s, me, "麗金花の散財");
    toHand(s, me, "信念の蹴撃・ランドル");
    expect(can(s, { type: "play", iid })).toBe(false);
    const coin = toHand(s, me, "輝く金貨");
    toBoard(s, opp, "燃え滾る闘志・フェザー");
    expect(can(s, { type: "play", iid })).toBe(true);
    const t = play(s, iid);
    expect(handNames(t, me)).toEqual(["信念の蹴撃・ランドル"]);
    expect(t.players[me].hand.some((h) => h.iid === coin)).toBe(false);
    expect(board(t, opp)).toHaveLength(0);
  });

  it("剽疾の武闘家: 引いたターンはコスト3", () => {
    const { s, me } = setup({ deck: Array(40).fill("剽疾の武闘家"), oppDeck: Array(40).fill("剽疾の武闘家") });
    const t = play(s, toHand(s, me, "輝く金貨"), 0);
    expect(handCostOf(t, me, "剽疾の武闘家")).toBe(3);
    t.players[me].pp = 3;
    const h = t.players[me].hand[0]!.iid;
    expect(can(t, { type: "play", iid: h })).toBe(true);
    const u = passTurns(t, 1);
    const old = u.players[me].hand.find((c) => c.iid === h)!;
    u.players[me].pp = 5;
    expect(can(u, { type: "play", iid: old.iid })).toBe(false);
  });

  it("吉祥蛙: ターン終了時、手札のスペルが2枚以上なら相手のフォロワーすべてに5ダメージ", () => {
    const { s, me, opp } = setup();
    toBoard(s, me, "吉祥蛙");
    toBoard(s, opp, "燃え滾る闘志・フェザー");
    toHand(s, me, "輝く金貨");
    const t = applyAction(s, { type: "endTurn" });
    expect(board(t, opp)).toHaveLength(1);
    const u = setup();
    toBoard(u.s, u.me, "吉祥蛙");
    toBoard(u.s, u.opp, "燃え滾る闘志・フェザー");
    toHand(u.s, u.me, "輝く金貨");
    toHand(u.s, u.me, "輝く金貨");
    const t2 = applyAction(u.s, { type: "endTurn" });
    expect(board(t2, u.opp)).toHaveLength(0);
  });

  it("優しき援軍: エンハンス_4 で4枚", () => {
    const { s, me } = setup();
    expect(names(play(s, toHand(s, me, "優しき援軍")), me)).toEqual(Array(4).fill("ナイト"));
    const u = setup();
    u.s.players[u.me].pp = 3;
    expect(names(play(u.s, toHand(u.s, u.me, "優しき援軍")), u.me)).toEqual(Array(2).fill("ナイト"));
  });

  it("不動の将校: 攻撃できない。ターン終了時にスティールナイト", () => {
    const { s, me } = setup();
    const c = toBoard(s, me, "不動の将校");
    expect(can(s, { type: "attack", attacker: c.iid, target: "leader" })).toBe(false);
    const t = applyAction(s, { type: "endTurn" });
    expect(names(t, me)).toEqual(["不動の将校", "スティールナイト"]);
  });

  it("猛る《戦車》・オルオーン: 進化前は相手の全体に7、進化後は7ダメージをランダムに3回", () => {
    const { s, me, opp } = setup();
    toBoard(s, me, "猛る《戦車》・オルオーン");
    toBoard(s, opp, "燃え滾る闘志・フェザー");
    const t = applyAction(s, { type: "endTurn" });
    expect(board(t, opp)).toHaveLength(0);
    expect(hp(t, opp)).toBe(20);
    // 進化後: 他のフォロワーがいなければ両方のリーダーに合わせて21ダメージ
    const u = setup();
    toBoard(u.s, u.me, "猛る《戦車》・オルオーン", { evolve: "evolved" });
    const t2 = applyAction(u.s, { type: "endTurn" });
    expect(40 - hp(t2, u.me) - hp(t2, u.opp)).toBe(21);
  });

  it("麗金花・ウンケイ: 消滅させて金貨。超進化でクレスト（ターン終了時に金貨）", () => {
    const { s, me, opp } = setup({ turn: 7 });
    toBoard(s, opp, "燃え滾る闘志・フェザー");
    const t = play(s, toHand(s, me, "麗金花・ウンケイ"));
    expect(board(t, opp)).toHaveLength(0);
    expect(t.players[opp].graveyard).toBe(s.players[opp].graveyard);
    expect(handNames(t, me)).toEqual(["輝く金貨"]);
    const u = superEvolve(t, board(t, me)[0]!.iid);
    expect(crestNames(u, me)).toEqual([String(10524122)]);
    const v = applyAction(u, { type: "endTurn" });
    expect(handNames(v, me)).toEqual(["輝く金貨", "輝く金貨"]);
  });
});

describe("第6弾", () => {
  it("天剣授与: エンハンス_7 で勇烈の兵士3枚は+2/+2", () => {
    const { s, me } = setup();
    const t = play(s, toHand(s, me, "天剣授与"));
    expect(board(t, me).map((c) => [follower(t, c.iid)?.attack, follower(t, c.iid)?.defense])).toEqual(Array(3).fill([4, 4]));
  });

  it("威風の行軍: クレストのカウントを+2。クレストはエンハンスでプレイしたとき勇烈の兵士を出す", () => {
    const { s, me } = setup();
    const t = play(s, toHand(s, me, "威風の行軍"));
    expect(t.players[me].crests.map((c) => c.countdown)).toEqual([4]);
    // 威風の行軍そのもののエンハンスでは働かない（プレイした時点ではクレストが無い）
    expect(board(t, me)).toHaveLength(0);
    const u = play(t, toHand(t, me, "勇烈の兵士"));
    expect(names(u, me)).toEqual(["勇烈の兵士", "勇烈の兵士"]);
    // エンハンスでないプレイでは働かない
    const w = setup();
    w.s.players[w.me].pp = 2;
    const t2 = play(w.s, toHand(w.s, w.me, "威風の行軍"));
    expect(t2.players[w.me].crests.map((c) => c.countdown)).toEqual([2]);
    t2.players[w.me].pp = 2;
    const u2 = play(t2, toHand(t2, w.me, "信念の蹴撃・ランドル"));
    expect(names(u2, w.me)).toEqual(["信念の蹴撃・ランドル"]);
  });

  it("苛烈の参謀: 破壊。エンハンス_6 でPP3回復と勇烈の兵士", () => {
    const { s, me, opp } = setup();
    toBoard(s, opp, "燃え滾る闘志・フェザー");
    const t = play(s, toHand(s, me, "苛烈の参謀"));
    expect(board(t, opp)).toHaveLength(0);
    expect(t.players[me].pp).toBe(7);
    expect(handNames(t, me)).toEqual(["勇烈の兵士"]);
  });

  it("凄烈の天剣: エンハンス_3 なら引いて3ダメージ", () => {
    const { s, me, opp } = setup();
    const f = toBoard(s, opp, "燃え滾る闘志・フェザー");
    const t = play(s, toHand(s, me, "凄烈の天剣"));
    expect(t.players[me].hand).toHaveLength(1);
    expect(follower(t, f.iid)?.defense).toBe(1);
  });

  it("凄烈の剣王・ロードノエル四世: 複数のエンハンス（必殺・ドレイン・疾走）", () => {
    const run = (pp: number) => {
      const { s, me } = setup();
      s.players[me].pp = pp;
      const t = play(s, toHand(s, me, "凄烈の剣王・ロードノエル四世"));
      return board(t, me)
        .slice(1)
        .map((c) => c.keywords.filter((k) => k !== "rush"));
    };
    expect(run(6)).toEqual([["bane"]]);
    expect(run(7)).toEqual([["bane"], ["drain"]]);
    expect(run(8)).toEqual([["bane"], ["drain"], ["storm"]]);
  });

  it("旧き天剣・イドメタ: 信仰（エンハンスで+1）。進化時に信仰値を-5して全体+1/+1の能力", () => {
    const deck = ["旧き天剣・イドメタ"];
    const { s, me, opp } = setup({ deck, oppDeck: deck, turn: 5 });
    toBoard(s, opp, "燃え滾る闘志・フェザー", { defense: 20, maxDefense: 20 });
    expect(faithValue(s, me)).toBe(0);
    let t = play(s, toHand(s, me, "旧き天剣・イドメタ"));
    expect(handNames(t, me)).toEqual(["天剣の深淵"]);
    // 天剣の深淵（エンハンス_1）は PP があれば必ずエンハンス
    t = play(t, t.players[me].hand[0]!.iid);
    expect(faithValue(t, me)).toBe(1);
    ext(t, me).faith = { ...(ext(t, me).faith as object), value: 5 };
    const ido = board(t, me)[0]!.iid;
    t = evolve(t, ido);
    expect(faithValue(t, me)).toBe(0);
    t.players[me].pp = 10;
    t = play(t, toHand(t, me, "勇烈の兵士"));
    const ido2 = follower(t, ido)!;
    expect([ido2.attack, ido2.defense]).toEqual([4, 5]);
    // 出したばかりの勇烈の兵士（エンハンスで+1/+1）にも+1/+1
    const sol = follower(t, board(t, me)[1]!.iid)!;
    expect([sol.attack, sol.defense]).toEqual([4, 4]);
    expect(faithValue(t, me)).toBe(1);
  });

  it("旧き天剣・イドメタ: 信仰値が足りなければ進化時は働かない", () => {
    const deck = ["旧き天剣・イドメタ"];
    const { s, me } = setup({ deck, oppDeck: deck, turn: 5 });
    const ido = toBoard(s, me, "旧き天剣・イドメタ");
    ext(s, me).faith = { ...(ext(s, me).faith as object), value: 4 };
    let t = evolve(s, ido.iid);
    expect(faithValue(t, me)).toBe(4);
    t = play(t, toHand(t, me, "勇烈の兵士"));
    expect(follower(t, ido.iid)?.attack).toBe(3);
  });
});

describe("第7弾", () => {
  it("曲走の工兵: 手札にある間、自分のフォロワーが超進化したらコスト1", () => {
    const { s, me } = setup({ turn: 7 });
    const a = toBoard(s, me, "信念の蹴撃・ランドル");
    toHand(s, me, "曲走の工兵");
    const t = superEvolve(s, a.iid);
    expect(handCostOf(t, me, "曲走の工兵")).toBe(1);
    // 進化では変わらない
    const u = setup({ turn: 7 });
    const b = toBoard(u.s, u.me, "信念の蹴撃・ランドル");
    toHand(u.s, u.me, "曲走の工兵");
    expect(handCostOf(evolve(u.s, b.iid), u.me, "曲走の工兵")).toBe(3);
  });

  it("彼我の調律: 3ダメージ。連携_10 なら相手のターン終了まで攻撃できない", () => {
    const { s, me, opp } = setup();
    const f = toBoard(s, opp, "燃え滾る闘志・フェザー");
    const t = play(s, toHand(s, me, "彼我の調律"));
    expect(follower(t, f.iid)?.defense).toBe(1);
    expect(follower(t, f.iid)?.cannotAttackUntil).toBeNull();
    const u = setup();
    const g = toBoard(u.s, u.opp, "燃え滾る闘志・フェザー");
    setLink(u.s, u.me, 10);
    let t2 = play(u.s, toHand(u.s, u.me, "彼我の調律"));
    t2 = applyAction(t2, { type: "endTurn" });
    expect(can(t2, { type: "attack", attacker: g.iid, target: "leader" })).toBe(false);
  });

  it("無音の包囲: 突進を持つスティールナイト。連携_10 なら2枚", () => {
    const { s, me } = setup();
    const t = play(s, toHand(s, me, "無音の包囲"));
    expect(handNames(t, me)).toEqual(["スティールナイト"]);
    expect(t.players[me].hand[0]?.keywords).toEqual(["rush"]);
    const u = setup();
    setLink(u.s, u.me, 10);
    const t2 = play(u.s, toHand(u.s, u.me, "無音の包囲"));
    expect(t2.players[u.me].hand.map((h) => h.keywords)).toEqual([["rush"], ["rush"]]);
    // 場に出しても突進
    const u2 = play(t2, t2.players[u.me].hand[0]!.iid);
    expect(board(u2, u.me)[0]?.keywords).toContain("rush");
  });

  it("響爪の分班長: ナイト3枚を出してから、選んだ能力が他のフォロワーすべてに働く", () => {
    const { s, me } = setup();
    const t = play(s, toHand(s, me, "響爪の分班長"), 0);
    const knights = board(t, me).slice(1).map((c) => follower(t, c.iid)!);
    expect(knights.map((k) => [k.attack, k.defense, k.keywords.includes("rush")])).toEqual(Array(3).fill([2, 1, true]));
    const self = follower(t, board(t, me)[0]!.iid)!;
    expect(self.attack).toBe(3);
  });

  it("静粛齎す抜刀: 6ダメージ。連携_10 なら自分のフォロワーの数のダメージ", () => {
    const { s, me, opp } = setup();
    const a = toBoard(s, opp, "燃え滾る闘志・フェザー", { defense: 10, maxDefense: 10 });
    const b = toBoard(s, opp, "燃え滾る闘志・フェザー", { defense: 10, maxDefense: 10 });
    toBoard(s, me, "ナイト");
    toBoard(s, me, "ナイト");
    setLink(s, me, 10);
    const t = play(s, toHand(s, me, "静粛齎す抜刀"), [a.iid]);
    expect(follower(t, a.iid)?.defense).toBe(2);
    expect(follower(t, b.iid)?.defense).toBe(8);
  });

  it("統音のアナテマ・ギルダリア: 連携_20 でクレストと進化（スティールナイト2枚に突進、クレストで2ダメージ）", () => {
    const { s, me, opp } = setup();
    setLink(s, me, 20);
    const t = play(s, toHand(s, me, "統音のアナテマ・ギルダリア"));
    expect(crestNames(t, me)).toEqual(["10724112"]);
    expect(follower(t, board(t, me)[0]!.iid)?.evolve).toBe("evolved");
    expect(names(t, me)).toEqual(["統音のアナテマ・ギルダリア", "スティールナイト", "スティールナイト"]);
    expect(board(t, me).slice(1).every((c) => c.keywords.includes("rush"))).toBe(true);
    expect(hp(t, opp)).toBe(18);
    // 連携が足りなければ何もしない
    const u = setup();
    setLink(u.s, u.me, 18);
    const t2 = play(u.s, toHand(u.s, u.me, "統音のアナテマ・ギルダリア"));
    expect(t2.players[u.me].crests).toHaveLength(0);
    expect(names(t2, u.me)).toEqual(["統音のアナテマ・ギルダリア"]);
  });

  it("寛厳の音帥・セザール: スティールナイト2枚。他のロイヤル・フォロワーは+1/+3して守護", () => {
    const { s, me } = setup();
    const t = play(s, toHand(s, me, "寛厳の音帥・セザール"));
    const knights = board(t, me).slice(1).map((c) => follower(t, c.iid)!);
    expect(knights.map((k) => [k.attack, k.defense, k.keywords.includes("ward")])).toEqual(Array(2).fill([3, 5, true]));
  });
});

describe("第8弾", () => {
  it("武力と治安・ナハト・ナハト＆ヴィンセント: 超進化時もファンファーレと同じ", () => {
    const { s, me, opp } = setup({ turn: 7 });
    const c = toBoard(s, me, "武力と治安・ナハト・ナハト＆ヴィンセント");
    toBoard(s, opp, "燃え滾る闘志・フェザー", { defense: 3, maxDefense: 3 });
    const t = superEvolve(s, c.iid);
    expect(names(t, me)).toEqual(["武力と治安・ナハト・ナハト＆ヴィンセント", "ナハトの私兵"]);
    expect(board(t, opp)).toHaveLength(0);
  });

  it("寡黙なアサシン・シャイリィ: 進化時に選んだフォロワーは相手のターン終了まで攻撃できない", () => {
    const { s, me, opp } = setup({ turn: 5 });
    const c = toBoard(s, me, "寡黙なアサシン・シャイリィ");
    const f = toBoard(s, opp, "燃え滾る闘志・フェザー");
    let t = evolve(s, c.iid);
    t = applyAction(t, { type: "endTurn" });
    expect(can(t, { type: "attack", attacker: f.iid, target: "leader" })).toBe(false);
    t = passTurns(applyAction(t, { type: "endTurn" }), 0);
    t = applyAction(t, { type: "endTurn" });
    expect(can(t, { type: "attack", attacker: f.iid, target: "leader" })).toBe(true);
  });

  it("ジェイルブレイク・カッツェ: スペルをプレイしたとき、ターンに1回2ダメージ", () => {
    const { s, me, opp } = setup();
    toBoard(s, me, "ジェイルブレイク・カッツェ");
    const f = toBoard(s, opp, "燃え滾る闘志・フェザー");
    let t = play(s, toHand(s, me, "黄金の杯"));
    expect(follower(t, f.iid)?.defense).toBe(2);
    t = play(t, toHand(t, me, "黄金の杯"));
    expect(follower(t, f.iid)?.defense).toBe(2);
  });

  it("リライブリライフ: 攻撃力最大のフォロワーは-10/-10。エンハンス_6 で異形3枚", () => {
    const { s, me, opp } = setup();
    const big = toBoard(s, opp, "燃え滾る闘志・フェザー");
    const small = toBoard(s, opp, "ナイト");
    const t = play(s, toHand(s, me, "リライブリライフ"));
    expect(follower(t, big.iid)).toBeUndefined();
    expect(follower(t, small.iid)).toBeDefined();
    expect(names(t, me)).toEqual(["異形", "異形", "異形"]);
  });

  it("沖田総司: 超進化可能ターンなら進化。フォロワーへの攻撃で3ダメージを3回", () => {
    const { s, me, opp } = setup({ turn: 7 });
    const f = toBoard(s, opp, "燃え滾る闘志・フェザー", { defense: 20, maxDefense: 20 });
    let t = play(s, toHand(s, me, "沖田総司"));
    const o = board(t, me)[0]!.iid;
    expect(follower(t, o)?.evolve).toBe("evolved");
    t = applyAction(t, { type: "attack", attacker: o, target: f.iid });
    // 3ダメージ×3 と戦闘の4ダメージ
    expect(follower(t, f.iid)?.defense).toBe(20 - 9 - 4);
    // 進化前は1回
    const u = setup({ turn: 6 });
    const g = toBoard(u.s, u.opp, "燃え滾る闘志・フェザー", { defense: 20, maxDefense: 20 });
    let t2 = play(u.s, toHand(u.s, u.me, "沖田総司"));
    const o2 = board(t2, u.me)[0]!.iid;
    expect(follower(t2, o2)?.evolve).toBe("none");
    t2 = applyAction(t2, { type: "attack", attacker: o2, target: g.iid });
    expect(follower(t2, g.iid)?.defense).toBe(20 - 3 - 2);
  });

  it("二等分の日常: 自分の場のカードが2枚以上ならすべて", () => {
    const { s, me, opp } = setup();
    s.players[me].leaderHp = 10;
    toBoard(s, me, "ナイト");
    toBoard(s, me, "ナイト");
    toBoard(s, opp, "燃え滾る闘志・フェザー");
    const t = play(s, toHand(s, me, "二等分の日常"));
    expect(board(t, opp)).toHaveLength(0);
    expect(hp(t, me)).toBe(12);
    const u = setup();
    toBoard(u.s, u.me, "ナイト");
    const t2 = applyAction(u.s, { type: "play", iid: toHand(u.s, u.me, "二等分の日常") });
    expect(t2.pending).not.toBeNull();
  });

  it("天命の弾丸・バニー＆バロン: 同名を出す。連携_20 で4ダメージ", () => {
    const { s, me, opp } = setup();
    setLink(s, me, 18);
    // これと出したもので20
    const t = play(s, toHand(s, me, "天命の弾丸・バニー＆バロン"));
    expect(names(t, me)).toEqual(["天命の弾丸・バニー＆バロン", "天命の弾丸・バニー＆バロン"]);
    expect(hp(t, opp)).toBe(16);
  });

  it("焦がれし炎将・マーズ: 兵士が出るたびに+2/+0と突進、これは+1/+0", () => {
    const { s, me } = setup();
    const t = play(s, toHand(s, me, "焦がれし炎将・マーズ"));
    const [mars, ...knights] = board(t, me).map((c) => follower(t, c.iid)!);
    expect(mars?.attack).toBe(4);
    expect(knights.map((k) => [k.attack, k.keywords.includes("rush")])).toEqual(Array(3).fill([3, true]));
  });
});

describe("第9弾・トークン", () => {
  it("ファランクス: エンハンス_6 で守護のスティールナイト5枚", () => {
    const { s, me } = setup();
    const t = play(s, toHand(s, me, "ファランクス"));
    expect(board(t, me).filter((c) => c.keywords.includes("ward"))).toHaveLength(5);
  });

  it("獰猛なる指揮官: エンハンス_7 でそれとこれは+3/+0して突進", () => {
    const { s, me } = setup();
    const t = play(s, toHand(s, me, "獰猛なる指揮官"));
    const all = board(t, me).map((c) => follower(t, c.iid)!);
    expect(all.map((c) => [c.attack, c.keywords.includes("rush")])).toEqual([
      [7, true],
      [5, true],
      [5, true],
    ]);
  });

  it("燃え落ちる縁: コスト3なら、コスト1の燃え落ちる縁を加える（それからは加えない）", () => {
    const { s, me, opp } = setup();
    toBoard(s, opp, "燃え滾る闘志・フェザー", { defense: 20, maxDefense: 20 });
    let t = play(s, toHand(s, me, "燃え落ちる縁"));
    expect(handNames(t, me)).toEqual(["燃え落ちる縁"]);
    expect(handCostOf(t, me, "燃え落ちる縁")).toBe(1);
    t.players[me].pp = 1;
    t = play(t, t.players[me].hand[0]!.iid);
    expect(t.players[me].hand).toHaveLength(0);
  });

  it("波濤の副船長: 超進化で進化時の能力と、コスト0の黄金の小剣・首飾り", () => {
    const { s, me, opp } = setup({ turn: 7 });
    const c = toBoard(s, me, "波濤の副船長");
    const f = toBoard(s, opp, "燃え滾る闘志・フェザー");
    const t = superEvolve(s, c.iid);
    expect(follower(t, f.iid)?.defense).toBe(1);
    expect(names(t, me)).toEqual(["波濤の副船長", "戦慄の海賊旗"]);
    expect(handNames(t, me)).toEqual(["黄金の小剣", "黄金の首飾り"]);
    t.players[me].pp = 0;
    expect(t.players[me].hand.every((h) => can(t, { type: "play", iid: h.iid }))).toBe(true);
  });

  it("逆行の咎人・バルバロス・戦慄の海賊旗: カウント-5、スペルで-1、0で相手のリーダーに2ダメージ", () => {
    const { s, me, opp } = setup();
    const old = toBoard(s, me, "戦慄の海賊旗");
    let t = play(s, toHand(s, me, "逆行の咎人・バルバロス"));
    const flags = board(t, me).filter((c) => c.kind === "amulet");
    expect(flags.map((c) => (c.kind === "amulet" ? c.countdown : null))).toEqual([2, 2]);
    t = play(t, toHand(t, me, "黄金の杯"));
    t = play(t, toHand(t, me, "黄金の杯"));
    expect(board(t, me).some((c) => c.iid === old.iid)).toBe(false);
    expect(hp(t, opp)).toBe(16);
  });

  it("アージュドール: エンハンス_6 で海賊旗2枚と4ダメージ", () => {
    const { s, me, opp } = setup();
    toBoard(s, opp, "燃え滾る闘志・フェザー");
    const t = play(s, toHand(s, me, "アージュドール"));
    expect(names(t, me)).toEqual(["戦慄の海賊旗", "戦慄の海賊旗"]);
    // 出した海賊旗はこのスペルではカウントが減らない
    expect(board(t, me).map((c) => (c.kind === "amulet" ? c.countdown : null))).toEqual([7, 7]);
    expect(board(t, opp)).toHaveLength(0);
  });

  it("黄金の小剣: 相手のリーダーも選べる", () => {
    const { s, me, opp } = setup();
    toBoard(s, opp, "燃え滾る闘志・フェザー");
    const t = play(s, toHand(s, me, "黄金の小剣"), [leaderId(opp)]);
    expect(hp(t, opp)).toBe(19);
  });

  it("輝く金貨: （2）ランダム1枚に2ダメージ", () => {
    const { s, me, opp } = setup();
    const f = toBoard(s, opp, "燃え滾る闘志・フェザー");
    const t = play(s, toHand(s, me, "輝く金貨"), 1);
    expect(follower(t, f.iid)?.defense).toBe(2);
  });

  it("天剣の深淵: エンハンス_1 なら3ダメージ、PP0なら1ダメージ", () => {
    const { s, me, opp } = setup();
    const f = toBoard(s, opp, "燃え滾る闘志・フェザー");
    expect(follower(play(s, toHand(s, me, "天剣の深淵")), f.iid)?.defense).toBe(1);
    const u = setup();
    const g = toBoard(u.s, u.opp, "燃え滾る闘志・フェザー");
    u.s.players[u.me].pp = 0;
    expect(follower(play(u.s, toHand(u.s, u.me, "天剣の深淵")), g.iid)?.defense).toBe(3);
  });
});
