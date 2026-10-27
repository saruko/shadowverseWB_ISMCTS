// ローテーションのドラゴンのカード（トークン・クレスト含む）の最小シナリオ

import { describe, expect, it } from "vitest";
import { ALL_CARDS } from "../src/cards";
import { crestIdOf } from "../src/cards/abilities/helpers";
import { applyAction, type GameState, type HandCard, type PlayerIndex } from "../src/engine";
import { board, can, follower, handNames, names, passTurns, play, rid, setup, toBoard, toHand } from "./rotationHelpers";

const cardOf = (cardId: string) => ALL_CARDS.find((c) => c.id === cardId)!;

/** 手札のカードの今のコスト（ローテーションの「コストをNにする」を含む） */
const costOf = (h: HandCard): number => {
  const ext = (h as HandCard & { ext?: { costSet: number | null; tempCostSet: number | null; tempCostMod: number } }).ext;
  if (ext?.tempCostSet != null) return ext.tempCostSet;
  const base = ext?.costSet ?? cardOf(h.cardId).cost + h.costMod;
  return Math.max(0, base + (ext?.tempCostMod ?? 0));
};
const handOf = (s: GameState, p: PlayerIndex, name: string) => s.players[p].hand.filter((h) => h.cardId === rid(name));
const crests = (s: GameState, p: PlayerIndex) => s.players[p].crests;
const crestOf = (s: GameState, p: PlayerIndex, name: string) => crests(s, p).find((c) => c.crestId === crestIdOf(name));
const kw = (s: GameState, iid: number) => [...(follower(s, iid)?.keywords ?? []), ...(follower(s, iid)?.tempKeywords ?? [])];

/** 自分のフォロワーで相手のリーダーを攻撃してから、次の自分のターンにする（直前の自分のターンにリーダーを攻撃した状態） */
function attackLeaderThenPass(s: GameState, me: PlayerIndex): GameState {
  const a = toBoard(s, me, "燃え滾る闘志・フェザー");
  s = applyAction(s, { type: "attack", attacker: a.iid, target: "leader" });
  s = passTurns(s, 1);
  s.players[me].pp = 10;
  return s;
}

describe("ドラゴン（ローテーション）", () => {
  // ---- 奥義・解放奥義・手札で働く ----
  it("メグの親友・まりっぺ: 元のコスト3のフォロワー（メグの奥義）が超進化するとコスト0、ターン終了時に超進化後のフォロワーを+1/+1", () => {
    let { s, me } = setup({ turn: 10 });
    const mari = toHand(s, me, "メグの親友・まりっぺ");
    const meg = toHand(s, me, "どこにでもいるフツーの女の子・メグ");
    s = play(s, meg);
    expect(follower(s, meg)?.evolve).toBe("superEvolved");
    expect(costOf(s.players[me].hand.find((h) => h.iid === mari)!)).toBe(0);
    s.players[me].pp = 0;
    expect(can(s, { type: "play", iid: mari })).toBe(true);
    s = play(s, mari);
    // メグ: 元のコスト2のフォロワーが場に出たので守護
    expect(kw(s, meg)).toContain("ward");
    s = applyAction(s, { type: "endTurn" });
    // 2/1 + 超進化 3/3 + 1/1
    expect(follower(s, meg)?.attack).toBe(6);
    expect(follower(s, meg)?.defense).toBe(5);
    // まりっぺ自身は超進化していないので対象外
    expect(follower(s, mari)?.attack).toBe(2);
  });

  it("メグの親友・まりっぺ: コスト0はターン終了まで", () => {
    let { s, me } = setup({ turn: 10 });
    const mari = toHand(s, me, "メグの親友・まりっぺ");
    s = play(s, toHand(s, me, "どこにでもいるフツーの女の子・メグ"));
    expect(costOf(s.players[me].hand.find((h) => h.iid === mari)!)).toBe(0);
    s = passTurns(s, 1);
    expect(costOf(s.players[me].hand.find((h) => h.iid === mari)!)).toBe(2);
  });

  it("どこにでもいるフツーの女の子・メグ: 奥義ゲージが10未満なら超進化しない", () => {
    let { s, me } = setup({ turn: 5 });
    const meg = toHand(s, me, "どこにでもいるフツーの女の子・メグ");
    s = play(s, meg);
    expect(follower(s, meg)?.evolve).toBe("none");
  });

  it("純朴の鋼体・ムゲン: 解放奥義（15）で疾走。超進化時に2枚を選んで破壊", () => {
    let { s, me, opp } = setup({ turn: 15 });
    const m = toHand(s, me, "純朴の鋼体・ムゲン");
    s = play(s, m);
    expect(kw(s, m)).toContain("storm");

    ({ s, me, opp } = setup({ turn: 14 }));
    const m2 = toHand(s, me, "純朴の鋼体・ムゲン");
    s = play(s, m2);
    expect(kw(s, m2)).not.toContain("storm");
    const a = toBoard(s, opp, "大翼のドラゴン");
    const b = toBoard(s, opp, "大翼のドラゴン");
    const c = toBoard(s, opp, "大翼のドラゴン");
    s = applyAction(s, { type: "superEvolve", iid: m2 });
    s = applyAction(s, { type: "choose", targets: [a.iid, c.iid] });
    expect(board(s, opp).map((x) => x.iid)).toEqual([b.iid]);
  });

  // ---- 状態の付与 ----
  it("ラヴマックス・ボンバー: 3ダメージと、相手のターン終了まで攻撃できない", () => {
    let { s, me, opp } = setup();
    const t = toBoard(s, opp, "大翼のドラゴン");
    s = play(s, toHand(s, me, "ラヴマックス・ボンバー"));
    expect(follower(s, t.iid)?.defense).toBe(2);
    s = applyAction(s, { type: "endTurn" });
    expect(can(s, { type: "attack", attacker: t.iid, target: "leader" })).toBe(false);
    s = applyAction(s, { type: "endTurn" });
    s = applyAction(s, { type: "endTurn" });
    expect(can(s, { type: "attack", attacker: t.iid, target: "leader" })).toBe(true);
  });

  it("星晶獣の吸収: 相手の場のカードを消滅し、同名のカードを手札に加える", () => {
    let { s, me, opp } = setup();
    const t = toBoard(s, opp, "大翼のドラゴン");
    s = play(s, toHand(s, me, "星晶獣の吸収"));
    expect(board(s, opp)).toEqual([]);
    expect(handNames(s, me)).toEqual(["大翼のドラゴン"]);
    expect(s.players[opp].graveyardFollowers).toEqual([]);
  });

  it("世界の味方・ゾーイ: エンハンス10で疾走・リーダーの体力の最大値1・相手のターン終了までダメージ0", () => {
    let { s, me, opp } = setup();
    s.players[me].maxPp = 9;
    const z = toHand(s, me, "世界の味方・ゾーイ");
    s = play(s, z);
    expect(s.players[me].maxPp).toBe(10);
    expect(kw(s, z)).toContain("storm");
    expect(s.players[me].leaderMaxHp).toBe(1);
    expect(s.players[me].leaderHp).toBe(1);
    s = applyAction(s, { type: "endTurn" });
    const a = toBoard(s, opp, "大翼のドラゴン");
    s = applyAction(s, { type: "attack", attacker: a.iid, target: "leader" });
    expect(s.players[me].leaderHp).toBe(1);
    expect(s.winner).toBe(null);
    s = applyAction(s, { type: "endTurn" });
    expect((s.players[me] as unknown as { ext: { leaderCap: unknown } }).ext.leaderCap).toBe(null);
  });

  it("世界の味方・ゾーイ: エンハンスでなければ PP 最大値+1 だけ", () => {
    let { s, me } = setup();
    s.players[me].maxPp = 6;
    s.players[me].pp = 6;
    const z = toHand(s, me, "世界の味方・ゾーイ");
    s = play(s, z);
    expect(s.players[me].maxPp).toBe(7);
    expect(kw(s, z)).not.toContain("storm");
    expect(s.players[me].leaderMaxHp).toBe(20);
  });

  // ---- 進化 ----
  it("凍てつく定め・イシュミール: PP最大値10で進化し、相手のフォロワーすべてに3ダメージ", () => {
    let { s, me, opp } = setup();
    const t = toBoard(s, opp, "大翼のドラゴン");
    const i = toHand(s, me, "凍てつく定め・イシュミール");
    s = play(s, i);
    expect(follower(s, i)?.evolve).toBe("evolved");
    expect(follower(s, t.iid)?.defense).toBe(2);
  });

  it("湧水の汲み手: 超進化時は2枚を選んで5ダメージ", () => {
    let { s, me, opp } = setup({ turn: 10 });
    const w = toBoard(s, me, "湧水の汲み手");
    const a = toBoard(s, opp, "大翼のドラゴン", { defense: 6, maxDefense: 6 });
    const b = toBoard(s, opp, "大翼のドラゴン", { defense: 6, maxDefense: 6 });
    s = applyAction(s, { type: "superEvolve", iid: w.iid });
    expect(follower(s, a.iid)?.defense).toBe(1);
    expect(follower(s, b.iid)?.defense).toBe(1);
  });

  it("律する《正義》・イランツァ: 進化前はターン終了時にランダム2枚に8ダメージ・8回復、進化後は相手のリーダーに8ダメージ", () => {
    let { s, me, opp } = setup({ turn: 10 });
    const il = toBoard(s, me, "律する《正義》・イランツァ");
    toBoard(s, opp, "大翼のドラゴン");
    s.players[me].leaderHp = 10;
    s = applyAction(s, { type: "endTurn" });
    expect(board(s, opp)).toEqual([]);
    expect(s.players[me].leaderHp).toBe(18);
    s = applyAction(s, { type: "endTurn" });
    s = applyAction(s, { type: "evolve", iid: il.iid });
    expect(kw(s, il.iid)).not.toContain("ward");
    expect(kw(s, il.iid)).toContain("intimidate");
    s = applyAction(s, { type: "endTurn" });
    expect(s.players[opp].leaderHp).toBe(12);
  });

  it("スパイクドラゴン: 自分のターン終了時に進化し、相手のフォロワーすべてと相手のリーダーに3ダメージ", () => {
    let { s, me, opp } = setup();
    const sp = toBoard(s, me, "スパイクドラゴン");
    const t = toBoard(s, opp, "大翼のドラゴン");
    s = applyAction(s, { type: "endTurn" });
    expect(follower(s, sp.iid)?.evolve).toBe("evolved");
    expect(follower(s, t.iid)?.defense).toBe(2);
    expect(s.players[opp].leaderHp).toBe(17);
  });

  it("キャリーワイバーン: 進化時に手札のフォロワーを+2/+2", () => {
    let { s, me } = setup({ turn: 10 });
    const c = toBoard(s, me, "キャリーワイバーン");
    const h = toHand(s, me, "大翼のドラゴン");
    toHand(s, me, "黒炎の奔流");
    s = applyAction(s, { type: "evolve", iid: c.iid });
    const hc = s.players[me].hand.find((x) => x.iid === h)!;
    expect([hc.attackMod, hc.defenseMod]).toEqual([2, 2]);
  });

  it("ドラゴニックサーバー: PP最大値10で進化し、ターン終了時に2回復", () => {
    let { s, me } = setup();
    s.players[me].leaderHp = 10;
    const d = toHand(s, me, "ドラゴニックサーバー");
    s = play(s, d);
    expect(follower(s, d)?.evolve).toBe("evolved");
    s = applyAction(s, { type: "endTurn" });
    expect(s.players[me].leaderHp).toBe(12);
  });

  it("人狼族の長・ギド: 自分のリーダーの体力が10以下なら進化", () => {
    let { s, me } = setup();
    s.players[me].leaderHp = 10;
    const g = toHand(s, me, "人狼族の長・ギド");
    s = play(s, g);
    expect(follower(s, g)?.evolve).toBe("evolved");
  });

  it("ドラゴニュートの先導者: モードで進化し、攻撃力最大のフォロワーを破壊", () => {
    let { s, me, opp } = setup();
    const big = toBoard(s, opp, "大翼のドラゴン");
    const small = toBoard(s, opp, "ベビーファイアドレイク");
    const d = toHand(s, me, "ドラゴニュートの先導者");
    s = play(s, d, 0);
    expect(follower(s, d)?.evolve).toBe("evolved");
    expect(board(s, opp).map((x) => x.iid)).toEqual([small.iid]);
    expect(follower(s, big.iid)).toBeUndefined();
  });

  it("禁牙の変貌・ノマグダラ: モード（2）で相手のフォロワーすべては-0/-4", () => {
    let { s, me, opp } = setup();
    const big = toBoard(s, opp, "大翼のドラゴン");
    toBoard(s, opp, "ベビーファイアドレイク");
    s = play(s, toHand(s, me, "禁牙の変貌・ノマグダラ"), 1);
    expect(board(s, opp).map((x) => x.iid)).toEqual([big.iid]);
    expect(follower(s, big.iid)?.defense).toBe(1);
  });

  // ---- 値 X ----
  it("波揺花の断裁: 引いたフォロワーのコストのダメージ", () => {
    let { s, me, opp } = setup();
    const t = toBoard(s, opp, "大翼のドラゴン", { defense: 9, maxDefense: 9 });
    s = play(s, toHand(s, me, "波揺花の断裁"));
    const drawn = s.players[me].hand[0]!;
    expect(cardOf(drawn.cardId).type).toBe("follower");
    expect(follower(s, t.iid)?.defense).toBe(9 - cardOf(drawn.cardId).cost);
  });

  it("プロミネンスロア: 場のフォロワーの枚数のダメージ", () => {
    let { s, me, opp } = setup();
    const mine = toBoard(s, me, "大翼のドラゴン");
    const a = toBoard(s, opp, "大翼のドラゴン");
    toBoard(s, opp, "大翼のドラゴン");
    s = play(s, toHand(s, me, "プロミネンスロア"));
    expect(follower(s, mine.iid)?.defense).toBe(2);
    expect(follower(s, a.iid)?.defense).toBe(2);
  });

  it("ルインジェノサイダー: デッキの奇数コストのカードを消滅し、その枚数のダメージを割りふる", () => {
    let { s, me, opp } = setup({ turn: 10, deck: ["大翼のドラゴン", "豪龍の門番", "焦龍の午睡", "黒炎の奔流"] });
    const r = toBoard(s, me, "ルインジェノサイダー");
    const odd = s.players[me].deck.filter((d) => [1, 3, 5, 7, 9].includes(cardOf(d.cardId).cost)).length;
    const before = s.players[me].deck.length;
    const a = toBoard(s, opp, "大翼のドラゴン", { defense: 30, maxDefense: 30 });
    const b = toBoard(s, opp, "大翼のドラゴン", { defense: 30, maxDefense: 30 });
    s = applyAction(s, { type: "superEvolve", iid: r.iid });
    expect(s.players[me].deck.length).toBe(before - odd);
    expect(s.players[me].deck.every((d) => ![1, 3, 5, 7, 9].includes(cardOf(d.cardId).cost))).toBe(true);
    // 古いフォロワーから体力の分を割り当てる
    expect(odd).toBeGreaterThan(30);
    expect(follower(s, a.iid)).toBeUndefined();
    expect(follower(s, b.iid)?.defense).toBe(30 - Math.min(30, odd - 30));
  });

  it("断頭の天刀: スペルはこれのコストのダメージ。捨てられるとコスト5→3の『断頭の天刀』を手札に加える", () => {
    let { s, me, opp } = setup();
    toHand(s, me, "断頭の天刀");
    s = play(s, toHand(s, me, "即断の剣聖"));
    expect(handOf(s, me, "断頭の天刀").map(costOf)).toEqual([5]);
    s.players[me].pp = 10;
    s = play(s, toHand(s, me, "即断の剣聖"));
    expect(handOf(s, me, "断頭の天刀").map(costOf)).toEqual([3]);
    const t = toBoard(s, opp, "大翼のドラゴン");
    s = play(s, handOf(s, me, "断頭の天刀")[0]!.iid);
    expect(follower(s, t.iid)?.defense).toBe(2);
    expect(s.players[me].pp).toBe(10 - 4 - 3);
  });

  it("断頭の天刀: コスト3で捨てられたら何も加えない", () => {
    let { s, me } = setup();
    toHand(s, me, "断頭の天刀");
    s = play(s, toHand(s, me, "即断の剣聖"));
    s.players[me].pp = 10;
    s = play(s, toHand(s, me, "即断の剣聖"));
    s.players[me].pp = 10;
    s = play(s, toHand(s, me, "即断の剣聖"));
    expect(handOf(s, me, "断頭の天刀")).toEqual([]);
  });

  it("天刀授与: コスト4で捨てられるとコスト2の『天刀授与』を加え、それを捨てても増えない", () => {
    let { s, me } = setup();
    toHand(s, me, "天刀授与");
    s = play(s, toHand(s, me, "果断のドラゴニュート"));
    expect(handOf(s, me, "天刀授与").map(costOf)).toEqual([2]);
    s.players[me].pp = 10;
    s = play(s, toHand(s, me, "果断のドラゴニュート"));
    expect(handOf(s, me, "天刀授与")).toEqual([]);
  });

  it("天刀授与: スペルは自分のフォロワー1枚を+2/+2（自分のフォロワーがいなければ使えない）", () => {
    let { s, me } = setup();
    const g = toHand(s, me, "天刀授与");
    expect(can(s, { type: "play", iid: g })).toBe(false);
    const f = toBoard(s, me, "大翼のドラゴン");
    s = play(s, g);
    expect([follower(s, f.iid)?.attack, follower(s, f.iid)?.defense]).toEqual([7, 7]);
  });

  it("旧き天刀・ヴォーラライ: 捨てられると場に出る。進化で『天刀の深淵』1枚、超進化で3枚", () => {
    let { s, me } = setup({ turn: 10 });
    toHand(s, me, "旧き天刀・ヴォーラライ");
    s = play(s, toHand(s, me, "即断の剣聖"));
    expect(names(s, me)).toEqual(["即断の剣聖", "旧き天刀・ヴォーラライ"]);
    const v = board(s, me)[1]!;
    s = applyAction(s, { type: "evolve", iid: v.iid });
    expect(handNames(s, me)).toEqual(["天刀の深淵"]);
    const v2 = toBoard(s, me, "旧き天刀・ヴォーラライ");
    s = passTurns(s, 1);
    s = applyAction(s, { type: "superEvolve", iid: v2.iid });
    expect(handOf(s, me, "天刀の深淵").length).toBe(4);
  });

  it("天刀の深淵: 捨てられたときとスペルで、相手のリーダーに1ダメージ・自分のリーダーを1回復", () => {
    let { s, me, opp } = setup();
    s.players[me].leaderHp = 10;
    toHand(s, me, "天刀の深淵");
    s = play(s, toHand(s, me, "即断の剣聖"));
    expect([s.players[me].leaderHp, s.players[opp].leaderHp]).toEqual([11, 19]);
    s = play(s, toHand(s, me, "天刀の深淵"));
    expect([s.players[me].leaderHp, s.players[opp].leaderHp]).toEqual([12, 18]);
  });

  it("赤色流し: 手札1枚を捨て、相手のフォロワー1枚を破壊。手札が無ければ使えない", () => {
    let { s, me, opp } = setup();
    const r = toHand(s, me, "赤色流し");
    const t = toBoard(s, opp, "大翼のドラゴン");
    expect(can(s, { type: "play", iid: r })).toBe(false);
    toHand(s, me, "焦龍の午睡");
    s = play(s, r);
    expect(s.players[me].hand).toEqual([]);
    expect(follower(s, t.iid)).toBeUndefined();
  });

  it("断頭の斬姫・サガツマツ: 手札1枚を捨て、『赤色流し』2枚を加える", () => {
    let { s, me } = setup();
    toHand(s, me, "焦龍の午睡");
    s = play(s, toHand(s, me, "断頭の斬姫・サガツマツ"));
    expect(handNames(s, me)).toEqual(["赤色流し", "赤色流し"]);
  });

  it("笑顔の調理・キミカ: 手札が無くても引いて回復する", () => {
    let { s, me } = setup();
    s.players[me].leaderHp = 10;
    s = play(s, toHand(s, me, "笑顔の調理・キミカ"));
    expect(s.players[me].hand.length).toBe(1);
    expect(s.players[me].leaderHp).toBe(11);
  });

  it("金銀絢爛・リュミオール＆アルジャンテ: 手札2枚を捨て、相手のフォロワーすべてと相手のリーダーに4ダメージ", () => {
    let { s, me, opp } = setup();
    toHand(s, me, "焦龍の午睡");
    toHand(s, me, "焦龍の午睡");
    const t = toBoard(s, opp, "大翼のドラゴン");
    const l = toHand(s, me, "金銀絢爛・リュミオール＆アルジャンテ");
    s = play(s, l);
    expect(s.players[me].hand).toEqual([]);
    expect(follower(s, t.iid)?.defense).toBe(1);
    expect(s.players[opp].leaderHp).toBe(16);
  });

  it("金銀絢爛・リュミオール＆アルジャンテ: アクセラレート3でPP最大値+1", () => {
    let { s, me } = setup();
    s.players[me].maxPp = 5;
    s.players[me].pp = 5;
    const l = toHand(s, me, "金銀絢爛・リュミオール＆アルジャンテ");
    s = play(s, l);
    expect(board(s, me)).toEqual([]);
    expect(s.players[me].maxPp).toBe(6);
    expect(s.players[me].pp).toBe(2);
  });

  it("退屈な睥睨: 手札とデッキの『退屈な睥睨』すべてが『焦龍の午睡』になる", () => {
    let { s, me } = setup({ deck: ["退屈な睥睨", "退屈な睥睨"] });
    s.players[me].maxPp = 5;
    const inDeck = s.players[me].deck.filter((d) => d.cardId === rid("退屈な睥睨")).length;
    const a = toHand(s, me, "退屈な睥睨");
    toHand(s, me, "退屈な睥睨");
    s = play(s, a);
    expect(s.players[me].maxPp).toBe(6);
    expect(handNames(s, me)).toEqual(["焦龍の午睡"]);
    expect(s.players[me].deck.filter((d) => d.cardId === rid("退屈な睥睨")).length).toBe(0);
    expect(s.players[me].deck.filter((d) => d.cardId === rid("焦龍の午睡")).length).toBe(inDeck);
  });

  it("反照の赤紅・ドラーク＆アルザード: 他の同名の枚数だけ+X/+X、2以上で進化。ラストワードのクレストでコスト2を手札に", () => {
    let { s, me } = setup();
    const ids: number[] = [];
    for (let i = 0; i < 3; i++) {
      s.players[me].pp = 10;
      const d = toHand(s, me, "反照の赤紅・ドラーク＆アルザード");
      ids.push(d);
      s = play(s, d);
    }
    expect(ids.map((x) => follower(s, x)?.attack)).toEqual([4, 5, 8]);
    expect(follower(s, ids[2]!)?.evolve).toBe("evolved");
    expect(follower(s, ids[1]!)?.evolve).toBe("none");
    // 1枚目を破壊（ディザスターブレス: 場のフォロワーすべてに5ダメージ）
    s.players[me].pp = 10;
    s = play(s, toHand(s, me, "ディザスターブレス"));
    expect(follower(s, ids[0]!)).toBeUndefined();
    const before = crests(s, me).filter((c) => c.crestId === crestIdOf("反照の赤紅・ドラーク＆アルザード")).length;
    expect(before).toBe(2);
    s = passTurns(s, 2);
    expect(crests(s, me).length).toBe(0);
    expect(handOf(s, me, "反照の赤紅・ドラーク＆アルザード").map(costOf)).toEqual([2, 2]);
  });

  // ---- クレスト ----
  it("クレッセント・チューブ・ライド: クレスト（カウントダウン4）は自分のターン終了時にランダム1枚を+1/+1", () => {
    let { s, me } = setup();
    const f = toBoard(s, me, "大翼のドラゴン");
    s = play(s, toHand(s, me, "クレッセント・チューブ・ライド"));
    expect(crestOf(s, me, "クレッセント・チューブ・ライド")?.countdown).toBe(4);
    s = applyAction(s, { type: "endTurn" });
    expect(follower(s, f.iid)?.attack).toBe(6);
    s = applyAction(s, { type: "endTurn" });
    expect(crestOf(s, me, "クレッセント・チューブ・ライド")?.countdown).toBe(3);
  });

  it("波揺花・ユウベ: 進化時に手札1枚を捨ててクレスト。海洋・フォロワーの攻撃で+1/+0、ターンに1回『大海のオルカ』", () => {
    let { s, me, opp } = setup({ turn: 10 });
    const y = toHand(s, me, "波揺花・ユウベ");
    s = play(s, y);
    expect(names(s, me)).toEqual(["波揺花・ユウベ", "大海のオルカ"]);
    toHand(s, me, "焦龍の午睡");
    s = applyAction(s, { type: "evolve", iid: y });
    expect(s.players[me].hand).toEqual([]);
    expect(crestOf(s, me, "波揺花・ユウベ")).toBeDefined();
    const o1 = toBoard(s, me, "大海のオルカ");
    const o2 = toBoard(s, me, "大海のオルカ");
    s = applyAction(s, { type: "attack", attacker: o1.iid, target: "leader" });
    expect(s.players[opp].leaderHp).toBe(17);
    expect(handNames(s, me)).toEqual(["大海のオルカ"]);
    s = applyAction(s, { type: "attack", attacker: o2.iid, target: "leader" });
    expect(s.players[opp].leaderHp).toBe(14);
    expect(handNames(s, me)).toEqual(["大海のオルカ"]);
    // ターン終了で +1/+0 は切れる
    s = applyAction(s, { type: "endTurn" });
    expect(follower(s, o1.iid)?.attack).toBe(2);
  });

  it("焦灰のアナテマ・バーンドナイト: 超進化時に相手がクレスト。相手のターン開始時に2ダメージ、回復したときターンに1回1ダメージ", () => {
    let { s, me, opp } = setup({ turn: 10 });
    const b = toHand(s, me, "焦灰のアナテマ・バーンドナイト");
    s = play(s, b);
    s = applyAction(s, { type: "superEvolve", iid: b });
    expect(crestOf(s, opp, "焦灰のアナテマ・バーンドナイト")).toBeDefined();
    s.players[opp].leaderHp = 10;
    s = applyAction(s, { type: "endTurn" });
    expect(s.players[opp].leaderHp).toBe(8);
    s.players[opp].pp = 10;
    s = play(s, toHand(s, opp, "焦龍の午睡"));
    expect(s.players[opp].leaderHp).toBe(10);
    s = play(s, toHand(s, opp, "焦龍の午睡"));
    expect(s.players[opp].leaderHp).toBe(13);
  });

  it("龍谷のエルダードラゴン: 『大翼のドラゴン』とクレスト。クレストは自分のターン終了時に『大翼のドラゴン』、超進化でカウント+2", () => {
    let { s, me } = setup({ turn: 10 });
    const e = toHand(s, me, "龍谷のエルダードラゴン");
    s = play(s, e);
    expect(names(s, me)).toEqual(["龍谷のエルダードラゴン", "大翼のドラゴン"]);
    expect(crestOf(s, me, "龍谷のエルダードラゴン")?.countdown).toBe(2);
    s = applyAction(s, { type: "superEvolve", iid: e });
    expect(crestOf(s, me, "龍谷のエルダードラゴン")?.countdown).toBe(4);
    s = applyAction(s, { type: "endTurn" });
    expect(names(s, me)).toEqual(["龍谷のエルダードラゴン", "大翼のドラゴン", "大翼のドラゴン"]);
  });

  it("わだつみの精: 進化時にクレスト。海洋・フォロワーが場に出ると+1/+1", () => {
    let { s, me } = setup({ turn: 10 });
    const w = toHand(s, me, "わだつみの精");
    s = play(s, w);
    expect(handNames(s, me)).toEqual(["大海のオルカ"]);
    s = applyAction(s, { type: "evolve", iid: w });
    const o = s.players[me].hand[0]!.iid;
    s = play(s, o);
    expect([follower(s, o)?.attack, follower(s, o)?.defense]).toEqual([3, 3]);
  });

  it("クラゲの舞姫・雫の囃子方: 海洋・フォロワーが場に出ると突進と必殺・リーダーを2回復", () => {
    let { s, me } = setup();
    s.players[me].leaderHp = 10;
    const k = toBoard(s, me, "クラゲの舞姫");
    s = play(s, toHand(s, me, "雫の囃子方"));
    expect(kw(s, k.iid)).toEqual(expect.arrayContaining(["rush", "bane"]));
    expect(s.players[me].leaderHp).toBe(12);
  });

  // ---- 直前の自分のターン ----
  it("寸裂の盗人: 直前の自分のターンにリーダーを攻撃していたら疾走。ラストワードで手札に戻る", () => {
    let { s, me } = setup();
    const t1 = toHand(s, me, "寸裂の盗人");
    s = play(s, t1);
    expect(kw(s, t1)).not.toContain("storm");
    s = attackLeaderThenPass(s, me);
    const t2 = toHand(s, me, "寸裂の盗人");
    s = play(s, t2);
    expect(kw(s, t2)).toContain("storm");
    s = play(s, toHand(s, me, "ディザスターブレス"));
    expect(handOf(s, me, "寸裂の盗人").length).toBe(2);
  });

  it("寸裂の盗人: 2ターン前の攻撃は数えない", () => {
    let { s, me } = setup();
    s = attackLeaderThenPass(s, me);
    s = passTurns(s, 1);
    const t = toHand(s, me, "寸裂の盗人");
    s = play(s, t);
    expect(kw(s, t)).not.toContain("storm");
  });

  it("絶倒の襲撃者: フォロワーへの攻撃時、直前の自分のターンにリーダーを攻撃していたら+1/+0（ターン終了まで）", () => {
    let { s, me, opp } = setup();
    const a = toHand(s, me, "絶倒の襲撃者");
    s = play(s, a);
    s = applyAction(s, { type: "attack", attacker: a, target: "leader" });
    expect(s.players[opp].leaderHp).toBe(19);
    s = passTurns(s, 1);
    const t = toBoard(s, opp, "豪龍の門番");
    s = applyAction(s, { type: "attack", attacker: a, target: t.iid });
    expect(follower(s, t.iid)?.defense).toBe(8);
  });

  it("絶倒の襲撃者: 直前の自分のターンに攻撃していなければ+0", () => {
    let { s, me, opp } = setup();
    const a = toHand(s, me, "絶倒の襲撃者");
    s = play(s, a);
    const t = toBoard(s, opp, "豪龍の門番");
    s = applyAction(s, { type: "attack", attacker: a, target: t.iid });
    expect(follower(s, t.iid)?.defense).toBe(9);
  });

  it("絶倒の襲撃者: リーダーへの攻撃でも+1/+0（直前の自分のターンにリーダーを攻撃済み）", () => {
    let { s, me, opp } = setup();
    const a = toHand(s, me, "絶倒の襲撃者");
    s = play(s, a);
    s = applyAction(s, { type: "attack", attacker: a, target: "leader" });
    s = passTurns(s, 1);
    s = applyAction(s, { type: "attack", attacker: a, target: "leader" });
    expect(s.players[opp].leaderHp).toBe(17);
  });

  it("ウンギア: このターンにもリーダーを攻撃した後でも、直前の自分のターンの攻撃で6ダメージ", () => {
    let { s, me, opp } = setup();
    const c = toBoard(s, opp, "大翼のドラゴン");
    s = attackLeaderThenPass(s, me);
    const f = toBoard(s, me, "燃え滾る闘志・フェザー");
    s = applyAction(s, { type: "attack", attacker: f.iid, target: "leader" });
    s = play(s, toHand(s, me, "ウンギア"));
    expect(follower(s, c.iid)).toBeUndefined();
  });

  it("塵土の無頼漢: 直前の自分のターンにリーダーを攻撃していたら4ダメージを2回。進化時に『絶倒の襲撃者』", () => {
    let { s, me, opp } = setup({ turn: 10 });
    const t = toBoard(s, opp, "大翼のドラゴン", { defense: 9, maxDefense: 9 });
    const d = toHand(s, me, "塵土の無頼漢");
    s = play(s, d);
    expect(follower(s, t.iid)?.defense).toBe(5);
    s = applyAction(s, { type: "evolve", iid: d });
    expect(names(s, me)).toContain("絶倒の襲撃者");

    ({ s, me, opp } = setup());
    const t2 = toBoard(s, opp, "大翼のドラゴン", { defense: 9, maxDefense: 9 });
    s = attackLeaderThenPass(s, me);
    s = play(s, toHand(s, me, "塵土の無頼漢"));
    expect(follower(s, t2.iid)?.defense).toBe(1);
  });

  it("ウンギア: 3ダメージを割りふる。直前の自分のターンにリーダーを攻撃していたら6", () => {
    let { s, me, opp } = setup();
    const a = toBoard(s, opp, "大翼のドラゴン");
    const b = toBoard(s, opp, "大翼のドラゴン");
    s = play(s, toHand(s, me, "ウンギア"));
    expect([follower(s, a.iid)?.defense, follower(s, b.iid)?.defense]).toEqual([2, 5]);

    ({ s, me, opp } = setup());
    const c = toBoard(s, opp, "大翼のドラゴン");
    const d = toBoard(s, opp, "大翼のドラゴン");
    s = attackLeaderThenPass(s, me);
    s = play(s, toHand(s, me, "ウンギア"));
    expect(follower(s, c.iid)).toBeUndefined();
    expect(follower(s, d.iid)?.defense).toBe(4);
  });

  it("穿孔の咎人・アンテマリア: 守護を無視して攻撃できる。直前にリーダーを攻撃していたら疾走", () => {
    let { s, me, opp } = setup();
    toBoard(s, opp, "豪龍の門番");
    const a = toBoard(s, me, "穿孔の咎人・アンテマリア");
    const f = toBoard(s, me, "燃え滾る闘志・フェザー");
    expect(can(s, { type: "attack", attacker: a.iid, target: "leader" })).toBe(true);
    expect(can(s, { type: "attack", attacker: f.iid, target: "leader" })).toBe(false);

    ({ s, me, opp } = setup());
    s = attackLeaderThenPass(s, me);
    const b = toHand(s, me, "穿孔の咎人・アンテマリア");
    s = play(s, b);
    expect(can(s, { type: "attack", attacker: b, target: "leader" })).toBe(true);
  });

  // ---- 攻撃時 ----
  it("天頂の戦火・ジェアーダ: フォロワーへの攻撃時にバリアと2回攻撃", () => {
    let { s, me, opp } = setup();
    const j = toBoard(s, me, "天頂の戦火・ジェアーダ");
    // 守護 10/10。ジェアーダはバリアでダメージを受けない
    const t = toBoard(s, opp, "豪龍の門番");
    s = applyAction(s, { type: "attack", attacker: j.iid, target: t.iid });
    expect(follower(s, j.iid)?.defense).toBe(2);
    expect(follower(s, t.iid)?.defense).toBe(4);
    s = applyAction(s, { type: "attack", attacker: j.iid, target: t.iid });
    expect(follower(s, t.iid)).toBeUndefined();
    expect(can(s, { type: "attack", attacker: j.iid, target: "leader" })).toBe(false);
  });

  it("天頂の戦火・ジェアーダ: リーダーへの攻撃では2回攻撃を持たない", () => {
    let { s, me } = setup();
    const j = toBoard(s, me, "天頂の戦火・ジェアーダ");
    s = applyAction(s, { type: "attack", attacker: j.iid, target: "leader" });
    expect(kw(s, j.iid)).toContain("barrier");
    expect(can(s, { type: "attack", attacker: j.iid, target: "leader" })).toBe(false);
  });

  // ---- その他 ----
  it("狐火陽炎: 相手のリーダーを選べる。『狐火陽炎』をデッキに加え、覚醒なら引く", () => {
    let { s, me, opp } = setup();
    const before = s.players[me].deck.length;
    // 相手のフォロワーがいなければ相手のリーダーが自動で選ばれる
    s = play(s, toHand(s, me, "狐火陽炎"));
    expect(s.players[opp].leaderHp).toBe(19);
    expect(s.players[me].deck.length).toBe(before);
    expect(s.players[me].hand.length).toBe(1);
    const all = [...s.players[me].deck.map((d) => d.cardId), ...s.players[me].hand.map((h) => h.cardId)];
    expect(all).toContain(rid("狐火陽炎"));
  });

  it("顎門の別れ: 手札2枚を捨て、ランダム1枚と相手のリーダーに3ダメージ", () => {
    let { s, me, opp } = setup();
    toHand(s, me, "焦龍の午睡");
    toHand(s, me, "焦龍の午睡");
    const t = toBoard(s, opp, "大翼のドラゴン");
    s = play(s, toHand(s, me, "顎門の別れ"));
    expect(s.players[me].hand).toEqual([]);
    expect(follower(s, t.iid)?.defense).toBe(2);
    expect(s.players[opp].leaderHp).toBe(17);
  });

  it("鉄槌のドラグーン・完熟の海魚（エンハンス6）・喧伝の龍人（エンハンス4）", () => {
    let { s, me, opp } = setup();
    const t = toBoard(s, opp, "大翼のドラゴン", { defense: 8, maxDefense: 8 });
    s = play(s, toHand(s, me, "鉄槌のドラグーン"));
    expect(follower(s, t.iid)?.defense).toBe(1);
    expect(names(s, me)).toEqual(["鉄槌のドラグーン", "大翼のドラゴン"]);

    ({ s, me } = setup());
    s = play(s, toHand(s, me, "完熟の海魚"));
    expect(names(s, me)).toEqual(["完熟の海魚", "完熟の海魚", "完熟の海魚"]);
    ({ s, me } = setup());
    s.players[me].pp = 4;
    s = play(s, toHand(s, me, "喧伝の龍人"));
    expect(names(s, me).filter((n) => n === "喧伝の龍人").length).toBe(3);
  });

  it("キラキラサウンド・リーフ＆ロロ: 同名を場に出し、ターン終了時にそれぞれ『大海のオルカ』を加える", () => {
    let { s, me } = setup();
    s = play(s, toHand(s, me, "キラキラサウンド・リーフ＆ロロ"));
    expect(names(s, me)).toEqual(["キラキラサウンド・リーフ＆ロロ", "キラキラサウンド・リーフ＆ロロ"]);
    s = applyAction(s, { type: "endTurn" });
    expect(handNames(s, me)).toEqual(["大海のオルカ", "大海のオルカ"]);
  });

});

// ---- 第10弾「ニーゲルヘリア神殺事件」 ----

describe("ドラゴン（第10弾）", () => {
  it("天喰の暴行者: 破壊されると『神域の物証』を手札に加える", () => {
    let { s, me, opp } = setup();
    const a = toBoard(s, me, "天喰の暴行者");
    const t = toBoard(s, opp, "燃え滾る闘志・フェザー");
    s = applyAction(s, { type: "attack", attacker: a.iid, target: t.iid });
    expect(follower(s, a.iid)).toBeUndefined();
    expect(handNames(s, me)).toEqual(["神域の物証"]);
  });

  it("蒐集の発露: 4ダメージ、手札の証拠・アミュレットからランダム1枚を捨て、元のコスト5以上を1枚引く", () => {
    let { s, me, opp } = setup({ deck: ["大翼のドラゴン"] });
    const t = toBoard(s, opp, "大翼のドラゴン");
    toHand(s, me, "神域の物証");
    toHand(s, me, "天喰の暴行者");
    s = play(s, toHand(s, me, "蒐集の発露"));
    expect(follower(s, t.iid)?.defense).toBe(1);
    expect(handNames(s, me)).toEqual(["天喰の暴行者", "大翼のドラゴン"]);
  });

  it("蒐集の発露: 手札に証拠・アミュレットが無ければ何も捨てず、引く効果は働く", () => {
    let { s, me } = setup({ deck: ["大翼のドラゴン"] });
    toHand(s, me, "天喰の暴行者");
    s = play(s, toHand(s, me, "蒐集の発露"));
    expect(handNames(s, me)).toEqual(["天喰の暴行者", "大翼のドラゴン"]);
  });

  it("アイシクルリザード: 3ダメージを1回。エンハンス_7なら3回と+5/+5", () => {
    let { s, me, opp } = setup();
    const t = toBoard(s, opp, "大翼のドラゴン", { defense: 30, maxDefense: 30 });
    s.players[me].pp = 3;
    const a = toHand(s, me, "アイシクルリザード");
    s = play(s, a);
    expect(follower(s, t.iid)?.defense).toBe(27);
    expect(follower(s, a)?.attack).toBe(2);

    ({ s, me, opp } = setup());
    const t2 = toBoard(s, opp, "大翼のドラゴン", { defense: 30, maxDefense: 30 });
    const b = toHand(s, me, "アイシクルリザード");
    s = play(s, b);
    expect(follower(s, t2.iid)?.defense).toBe(21);
    expect([follower(s, b)?.attack, follower(s, b)?.defense]).toEqual([7, 7]);
  });

  it("水竜神の慈雨: 1枚引いてリーダーを1回復。覚醒（PP最大値7以上）ならPP最大値+1", () => {
    let { s, me } = setup();
    s.players[me].pp = s.players[me].maxPp = 7;
    s.players[me].leaderHp = 10;
    s = play(s, toHand(s, me, "水竜神の慈雨"));
    expect(s.players[me].hand.length).toBe(1);
    expect(s.players[me].leaderHp).toBe(11);
    expect(s.players[me].maxPp).toBe(8);

    ({ s, me } = setup());
    s.players[me].pp = s.players[me].maxPp = 6;
    s = play(s, toHand(s, me, "水竜神の慈雨"));
    expect(s.players[me].maxPp).toBe(6);
  });

  it("偵察のドラゴニュート: 攻撃時、自分の他の進化前のフォロワーからランダム1枚が進化する", () => {
    let { s, me } = setup();
    const d = toBoard(s, me, "偵察のドラゴニュート");
    const done = toBoard(s, me, "燃え滾る闘志・フェザー", { evolve: "evolved" });
    const f = toBoard(s, me, "燃え滾る闘志・フェザー");
    const ep = s.players[me].ep;
    s = applyAction(s, { type: "attack", attacker: d.iid, target: "leader" });
    expect(follower(s, f.iid)?.evolve).toBe("evolved");
    expect(follower(s, done.iid)?.evolve).toBe("evolved");
    expect(follower(s, d.iid)?.evolve).toBe("none");
    expect(s.players[me].ep).toBe(ep);
  });

  it("俯瞰の眼差し: （1）（2）なら『好奇のネズミ』を出してから、自分の場の左から2枚を+1/+0", () => {
    let { s, me } = setup();
    const a = toBoard(s, me, "燃え滾る闘志・フェザー");
    const b = toBoard(s, me, "燃え滾る闘志・フェザー");
    const c = toBoard(s, me, "燃え滾る闘志・フェザー");
    // 組み合わせは（1）（2）、（1）（3）、（1）（4）、（2）（3）、（2）（4）、（3）（4）の順
    s = play(s, toHand(s, me, "俯瞰の眼差し"), 0);
    expect(names(s, me)).toEqual(["燃え滾る闘志・フェザー", "燃え滾る闘志・フェザー", "燃え滾る闘志・フェザー", "好奇のネズミ"]);
    expect([a, b, c].map((x) => follower(s, x.iid)?.attack)).toEqual([6, 6, 5]);

    ({ s, me } = setup());
    const d = toBoard(s, me, "燃え滾る闘志・フェザー");
    s = play(s, toHand(s, me, "俯瞰の眼差し"), 0);
    const rat = board(s, me).find((x) => x.cardId === rid("好奇のネズミ"));
    expect(follower(s, d.iid)?.attack).toBe(6);
    // 好奇のネズミは 1/1（場に他の元のコスト1のカードは無い）
    expect(rat && follower(s, rat.iid)?.attack).toBe(2);
  });

  it("俯瞰の眼差し: （3）（4）なら『神域の物証』3枚を手札に加え、ランダム1枚に4ダメージ", () => {
    let { s, me, opp } = setup();
    const t = toBoard(s, opp, "大翼のドラゴン", { defense: 9, maxDefense: 9 });
    s = play(s, toHand(s, me, "俯瞰の眼差し"), 5);
    expect(handNames(s, me)).toEqual(["神域の物証", "神域の物証", "神域の物証"]);
    expect(follower(s, t.iid)?.defense).toBe(5);
  });

  it("天喰の強奪犯: 手札の証拠・アミュレット1枚を捨ててPP最大値+1。進化時に選んだフォロワーに3ダメージ", () => {
    let { s, me, opp } = setup({ turn: 5 });
    s.players[me].maxPp = 9;
    toHand(s, me, "神域の物証");
    toHand(s, me, "神域の物証");
    const t = toBoard(s, opp, "大翼のドラゴン");
    const r = toHand(s, me, "天喰の強奪犯");
    s = play(s, r);
    expect(handNames(s, me)).toEqual(["神域の物証"]);
    expect(s.players[me].maxPp).toBe(10);
    s = applyAction(s, { type: "evolve", iid: r });
    expect(follower(s, t.iid)?.defense).toBe(2);
  });

  it("天喰の強奪犯: 手札に証拠・アミュレットが無くてもPP最大値+1", () => {
    let { s, me } = setup();
    s.players[me].maxPp = 9;
    toHand(s, me, "天喰の暴行者");
    s = play(s, toHand(s, me, "天喰の強奪犯"));
    expect(handNames(s, me)).toEqual(["天喰の暴行者"]);
    expect(s.players[me].maxPp).toBe(10);
  });

  it("ドラゴニックフィアー・ギルヴァ: 相手のリーダーの減った体力の分のダメージを割りふる。超進化時に疾走と守護", () => {
    let { s, me, opp } = setup({ turn: 7 });
    s.players[opp].leaderHp = s.players[opp].leaderMaxHp - 6;
    const a = toBoard(s, opp, "大翼のドラゴン");
    const b = toBoard(s, opp, "大翼のドラゴン");
    const g = toHand(s, me, "ドラゴニックフィアー・ギルヴァ");
    s = play(s, g);
    expect(follower(s, a.iid)).toBeUndefined();
    expect(follower(s, b.iid)?.defense).toBe(4);
    expect(kw(s, g)).not.toContain("storm");
    s = applyAction(s, { type: "superEvolve", iid: g });
    expect(kw(s, g)).toContain("storm");
    expect(kw(s, g)).toContain("ward");
  });

  it("ドラゴニックフィアー・ギルヴァ: 相手のリーダーの体力が減っていなければダメージは0", () => {
    let { s, me, opp } = setup();
    const a = toBoard(s, opp, "大翼のドラゴン");
    s = play(s, toHand(s, me, "ドラゴニックフィアー・ギルヴァ"));
    expect(follower(s, a.iid)?.defense).toBe(5);
  });

  it("天喰の運び屋: 相手のフォロワー2枚を選んで破壊し、『神域の物証』2枚を手札に加える", () => {
    let { s, me, opp } = setup();
    const a = toBoard(s, opp, "大翼のドラゴン");
    const b = toBoard(s, opp, "大翼のドラゴン");
    const c = toBoard(s, opp, "大翼のドラゴン");
    const iid = toHand(s, me, "天喰の運び屋");
    const t = applyAction(s, { type: "play", iid });
    expect(t.pending?.kind).toBe("choose");
    s = applyAction(t, { type: "choose", targets: [a.iid, c.iid] });
    expect(board(s, opp).map((x) => x.iid)).toEqual([b.iid]);
    expect(handNames(s, me)).toEqual(["神域の物証", "神域の物証"]);
  });

  it("天喰の三悪・ライトオフ: デッキの元のコスト4以下を消滅、手札の証拠・アミュレットすべてを捨て、その枚数だけ8ダメージ", () => {
    let { s, me, opp } = setup({ deck: ["大翼のドラゴン", "黒炎の奔流"] });
    const t = toBoard(s, opp, "大翼のドラゴン", { defense: 30, maxDefense: 30 });
    toHand(s, me, "神域の物証");
    toHand(s, me, "天喰の暴行者");
    toHand(s, me, "神域の物証");
    const grave = s.players[me].graveyard;
    const l = toHand(s, me, "天喰の三悪・ライトオフ");
    s = play(s, l);
    expect(s.players[me].deck.map((d) => cardOf(d.cardId).name).sort()).toEqual(["大翼のドラゴン", "黒炎の奔流"].sort());
    expect(handNames(s, me)).toEqual(["天喰の暴行者"]);
    // 捨てた2枚は墓場へ（消滅したデッキのカードは墓場に行かない）
    expect(s.players[me].graveyard).toBe(grave + 2);
    expect(follower(s, t.iid)?.defense).toBe(14);
    expect(kw(s, l)).toContain("storm");
  });

  it("天喰の三悪・ライトオフ: 手札に証拠・アミュレットが無ければダメージは無い", () => {
    let { s, me, opp } = setup();
    const t = toBoard(s, opp, "大翼のドラゴン");
    s = play(s, toHand(s, me, "天喰の三悪・ライトオフ"));
    expect(follower(s, t.iid)?.defense).toBe(5);
  });
});
