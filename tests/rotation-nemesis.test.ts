// ローテーションのネメシスのカード（トークン・クレスト含む）の最小シナリオテスト

import { describe, expect, it } from "vitest";
import { applyAction, type FollowerOnBoard, type GameState, type PlayerIndex } from "../src/engine";
import { FILLER, board, follower, handNames, names, passTurns, play, rid, setup, toBoard, toHand } from "./rotationHelpers";

const F = "燃え滾る闘志・フェザー"; // 5/4 能力なし

const find = (s: GameState, p: PlayerIndex, name: string) =>
  board(s, p).find((c) => c.cardId === rid(name)) as FollowerOnBoard | undefined;
const all = (s: GameState, p: PlayerIndex, name: string) =>
  board(s, p).filter((c) => c.cardId === rid(name)) as FollowerOnBoard[];
const ext = (s: GameState, p: PlayerIndex) => (s.players[p] as unknown as { ext: { entered: string[] } }).ext;
/** このバトル中に場に出た自分のアーティファクト・フォロワーを3種類にする */
const threeArtifactKinds = (s: GameState, p: PlayerIndex) => {
  ext(s, p).entered = ["アナライズアーティファクト", "エンシェントアーティファクト", "ミスティックアーティファクト"]
    .map(rid)
    .sort();
};
/** 自分のデッキを重複のないカードだけにする */
const uniqueDeck = (s: GameState, p: PlayerIndex, cards: string[]) => {
  s.players[p].deck = cards.map((n, i) => ({ ...s.players[p].deck[i]!, cardId: rid(n) }));
};
/** 自分のデッキの先頭のカードを書き換える（setup の deck で渡したカードは初期手札に入るため） */
const putInDeck = (s: GameState, p: PlayerIndex, cards: string[]) => {
  cards.forEach((n, i) => {
    s.players[p].deck[i]!.cardId = rid(n);
  });
};
const evolve = (s: GameState, iid: number, ...targets: number[][]) => {
  let t = applyAction(s, { type: "evolve", iid });
  for (const c of targets) t = applyAction(t, { type: "choose", targets: c });
  return t;
};
const superEvolve = (s: GameState, iid: number, ...targets: number[][]) => {
  let t = applyAction(s, { type: "superEvolve", iid });
  for (const c of targets) t = applyAction(t, { type: "choose", targets: c });
  return t;
};
const endTurn = (s: GameState) => applyAction(s, { type: "endTurn" });

describe("第4弾", () => {
  it("再起の夜王・ショウ: 超進化可能ターンならバリアを持つ", () => {
    for (const [turn, has] of [
      [7, true],
      [5, false],
    ] as const) {
      const { s, me } = setup({ turn });
      const t = play(s, toHand(s, me, "再起の夜王・ショウ"));
      expect(find(t, me, "再起の夜王・ショウ")?.keywords.includes("barrier")).toBe(has);
    }
  });

  it("爆燃の総長・ツバサの奥義ゲージ+1で、轟雷の閃狼・ユーステスの【奥義】が働く（9ターン目）", () => {
    const { s, me, opp } = setup({ turn: 9 });
    toBoard(s, opp, F);
    const f = toBoard(s, me, F);
    let t = play(s, toHand(s, me, "爆燃の総長・ツバサ"));
    const yu = toHand(t, me, "轟雷の閃狼・ユーステス");
    // ツバサは手札のユーステスより前にプレイしたので、後から加えたユーステスにはゲージが乗っていない
    t = play(t, yu);
    expect(follower(t, f.iid)?.evolve).toBe("none");

    const s2 = setup({ turn: 9 });
    const f2 = toBoard(s2.s, s2.me, F);
    const yu2 = toHand(s2.s, s2.me, "轟雷の閃狼・ユーステス");
    let t2 = play(s2.s, toHand(s2.s, s2.me, "爆燃の総長・ツバサ"));
    expect(t2.pending).toBeNull();
    t2 = play(t2, yu2, [f2.iid]);
    expect(follower(t2, f2.iid)?.evolve).toBe("evolved");
    expect(find(t2, s2.me, "轟雷の閃狼・ユーステス")?.evolve).toBe("evolved");
  });

  it("轟雷の閃狼・ユーステス: 10ターン目なら奥義。交戦時に交戦相手に3ダメージ", () => {
    const { s, me, opp } = setup({ turn: 10 });
    const e = toBoard(s, opp, "ミスティックアーティファクト"); // 4/5
    let t = play(s, toHand(s, me, "轟雷の閃狼・ユーステス")); // 他の進化前のフォロワーがいなくても、これは進化する
    const yu = find(t, me, "轟雷の閃狼・ユーステス")!;
    expect(yu.evolve).toBe("evolved");
    yu.enteredTurn = 0;
    t = applyAction(t, { type: "attack", attacker: yu.iid, target: e.iid });
    // 交戦時3 + 戦闘7 で破壊
    expect(follower(t, e.iid)).toBeUndefined();
  });

  it("厳烈なる教官・イルザ: モード2で相手のリーダーに4ダメージ、モード1でランダム4ダメージを3回", () => {
    const { s, me, opp } = setup();
    const hp = s.players[opp].leaderHp;
    const t = play(s, toHand(s, me, "厳烈なる教官・イルザ"), 1);
    expect(t.players[opp].leaderHp).toBe(hp - 4);
    const s2 = setup();
    for (let i = 0; i < 3; i++) toBoard(s2.s, s2.opp, F);
    const t2 = play(s2.s, toHand(s2.s, s2.me, "厳烈なる教官・イルザ"), 0);
    const left = board(t2, s2.opp) as FollowerOnBoard[];
    // 合計12ダメージ（体力4が3体: 破壊された体力の合計 + 残りが受けたダメージ = 12）
    const dealt = (3 - left.length) * 4 + left.reduce((a, f) => a + (4 - f.defense), 0);
    expect(dealt).toBe(12);
  });

  it("空慕う帰還者・カシウス: 選んだ手札のアーティファクト・フォロワーの攻撃力のダメージ", () => {
    const { s, me, opp } = setup();
    const e = toBoard(s, opp, "ミスティックアーティファクト"); // 4/5
    const art = toHand(s, me, "アタックアーティファクト"); // 5/1
    toHand(s, me, "ミスティックアーティファクト"); // 4/5
    const t = play(s, toHand(s, me, "空慕う帰還者・カシウス"), [art]);
    expect(follower(t, e.iid)).toBeUndefined();
    const s2 = setup();
    const e2 = toBoard(s2.s, s2.opp, "ミスティックアーティファクト");
    const mys = toHand(s2.s, s2.me, "ミスティックアーティファクト");
    toHand(s2.s, s2.me, "アタックアーティファクト");
    const t2 = play(s2.s, toHand(s2.s, s2.me, "空慕う帰還者・カシウス"), [mys]);
    expect(follower(t2, e2.iid)?.defense).toBe(1);
  });

  it("ケイオス・レギオン: 解放奥義（15ターン目）なら6ダメージ、そうでなければ3", () => {
    for (const [turn, dmg] of [
      [15, 6],
      [14, 3],
    ] as const) {
      const { s, me, opp } = setup({ turn });
      const hp = s.players[opp].leaderHp;
      const t = play(s, toHand(s, me, "ケイオス・レギオン"));
      expect(t.players[opp].leaderHp).toBe(hp - dmg);
    }
  });

  it("光の理・ル・オー: 相手の手札のフォロワー+1/+0。奥義でクレスト。クレストで相手の疾走の攻撃が-3", () => {
    const { s, me, opp } = setup({ turn: 10 });
    const oh = toHand(s, opp, F);
    let t = play(s, toHand(s, me, "光の理・ル・オー"));
    expect(t.players[opp].hand.find((h) => h.iid === oh)?.attackMod).toBe(1);
    expect(t.players[me].crests).toHaveLength(1);
    t = endTurn(t);
    const storm = toBoard(t, opp, "再起の夜王・ショウ"); // 2/1 疾走
    const hp = t.players[me].leaderHp;
    t = applyAction(t, { type: "attack", attacker: storm.iid, target: "leader" });
    expect(t.players[me].leaderHp).toBe(hp);
    // 疾走を持たないフォロワーは下がらない
    const plain = toBoard(t, opp, F);
    t = applyAction(t, { type: "attack", attacker: plain.iid, target: "leader" });
    expect(t.players[me].leaderHp).toBe(hp - 5);
  });

  it("光の理・ル・オー: 9ターン目ならクレストを持たない", () => {
    const { s, me } = setup({ turn: 9 });
    const t = play(s, toHand(s, me, "光の理・ル・オー"));
    expect(t.players[me].crests).toHaveLength(0);
  });

  it("全一の王・ベルゼバブ: 選んだ2枚は能力を失って9ダメージ。相手のリーダーの受けるダメージ+1", () => {
    const { s, me, opp } = setup();
    const a = toBoard(s, opp, "撃針の看守"); // ラストワード: 回復2
    const b = toBoard(s, opp, F);
    toBoard(s, opp, F);
    s.players[opp].leaderHp = 15;
    let t = play(s, toHand(s, me, "全一の王・ベルゼバブ"), [a.iid, b.iid]);
    expect(follower(t, a.iid)).toBeUndefined();
    expect(follower(t, b.iid)).toBeUndefined();
    expect(t.players[opp].leaderHp).toBe(15); // ラストワードは失っている
    t.players[me].pp = 10;
    t = play(t, toHand(t, me, "テレポートスラッシュ")); // リーダーに1ダメージ → 2
    expect(t.players[opp].leaderHp).toBe(13);
  });
});

describe("第5弾", () => {
  it("ステージメーカー: 人形2体。エンハンス7なら疾走", () => {
    const { s, me } = setup();
    const t = play(s, toHand(s, me, "ステージメーカー"));
    expect(find(t, me, "改良型・操り人形")?.keywords).toContain("storm");
    expect(find(t, me, "操り人形")?.keywords).toContain("storm");
    const s2 = setup();
    s2.s.players[s2.me].pp = 4;
    const t2 = play(s2.s, toHand(s2.s, s2.me, "ステージメーカー"));
    expect(find(t2, s2.me, "操り人形")?.keywords).not.toContain("storm");
  });

  it("満開の技術屋: スペルを引き、スペルをプレイしたとき相手のフォロワーすべてに3ダメージ", () => {
    const { s, me, opp } = setup();
    putInDeck(s, me, ["尽小花の照臨"]);
    const e = toBoard(s, opp, F);
    let t = play(s, toHand(s, me, "満開の技術屋"));
    expect(handNames(t, me)).toEqual(["尽小花の照臨"]);
    t = play(t, t.players[me].hand[0]!.iid);
    expect(follower(t, e.iid)?.defense).toBe(1);
  });

  it("ネオジオグラファー: βを手札に。超進化時に手札のコスト5以下のアーティファクト・フォロワーのコピーを場に", () => {
    const { s, me } = setup({ turn: 7 });
    s.players[me].sep = 2;
    let t = play(s, toHand(s, me, "ネオジオグラファー"));
    expect(handNames(t, me)).toEqual(["デストロイアーティファクトβ"]);
    const neo = find(t, me, "ネオジオグラファー")!;
    neo.enteredTurn = 0;
    t = superEvolve(t, neo.iid);
    expect(names(t, me)).toContain("デストロイアーティファクトβ");
    expect(handNames(t, me)).toEqual(["デストロイアーティファクトβ"]); // コピーなので手札に残る
  });

  it("清宵の偶兎: スペルをプレイすると進化する", () => {
    const { s, me } = setup();
    const u = toBoard(s, me, "清宵の偶兎");
    const t = play(s, toHand(s, me, "尽小花の照臨"));
    expect(follower(t, u.iid)?.evolve).toBe("evolved");
  });

  it("リヴァイブチューニング: 手札を捨て、破壊された自分のフォロワー2種類と同名のカードを非公開で手札に", () => {
    const { s, me } = setup();
    s.players[me].graveyardFollowers = [rid("撃針の看守"), rid("撃針の看守"), rid("再起の夜王・ショウ")];
    toHand(s, me, F); // 候補が1枚なので自動で選ぶ
    const t = play(s, toHand(s, me, "リヴァイブチューニング"));
    expect([...handNames(t, me)].sort()).toEqual(["再起の夜王・ショウ", "撃針の看守"].sort());
    expect(t.players[me].hand.every((h) => !h.revealed)).toBe(true);
  });

  it("ニューロンインタラプター: 他のフォロワーの数だけPP回復。ラストワードで2枚引く", () => {
    const { s, me } = setup();
    toBoard(s, me, F);
    toBoard(s, me, F);
    const t = play(s, toHand(s, me, "ニューロンインタラプター"));
    expect(t.players[me].pp).toBe(10 - 5 + 2);
  });

  it("誠心なる尽小花: 場のカードをイマリの小鬼に変身", () => {
    const { s, me, opp } = setup();
    const e = toBoard(s, opp, F);
    toBoard(s, me, F);
    const t = play(s, toHand(s, me, "誠心なる尽小花"), [e.iid]);
    expect(names(t, opp)).toEqual(["イマリの小鬼"]);
  });

  it("廻る《運命の輪》・スロース: ターン開始時に働いていないものから1つずつ。3つ働いたら何もしない", () => {
    const { s, me } = setup();
    const sl = toBoard(s, me, "廻る《運命の輪》・スロース");
    s.players[me].leaderHp = 10;
    let t = s;
    for (let i = 0; i < 4; i++) t = passTurns(t, 1);
    expect(t.players[me].leaderHp).toBe(13);
    expect(follower(t, sl.iid)?.defense).toBe(4); // +2/+2 は1回だけ
    expect(follower(t, sl.iid)?.attack).toBe(2);
  });

  it("廻る《運命の輪》・スロース: 進化後ならターン終了時に相手がクレストを持ち、これは消滅。クレストは相手のターン開始時に働く", () => {
    const { s, me, opp } = setup();
    toBoard(s, me, "廻る《運命の輪》・スロース", { evolve: "evolved" });
    let t = endTurn(s);
    expect(names(t, me)).toEqual([]);
    expect(t.players[me].graveyardFollowers).toEqual([]); // 消滅（破壊ではない）
    expect(t.players[opp].crests).toHaveLength(1);
    expect(t.players[opp].crests[0]!.countdown).toBe(2); // 相手のターン開始時に3から減った
    // 相手のターン開始時に1つ働いた。（2）と（3）は相手のリーダー体力・場で確かめにくいので、使った印で確かめる
    const used = (t.players[opp].crests[0] as unknown as { usedOptions: number }).usedOptions;
    expect([1, 2, 4]).toContain(used);
  });

  it("廻る《運命の輪》・スロースのクレスト: （2）で持ち主の場のフォロワーすべて-2/-2。カウントダウン3で、ターン開始時に3回働く", () => {
    const { s, me, opp } = setup();
    toBoard(s, me, "廻る《運命の輪》・スロース", { evolve: "evolved" });
    let t = endTurn(s); // 相手のターン（1回目）: 1つ働く
    // 残りを（2）だけにする
    (t.players[opp].crests[0] as unknown as { usedOptions: number }).usedOptions = 0b101;
    t = endTurn(t);
    const weak = toBoard(t, opp, "再起の夜王・ショウ"); // 2/1
    const f = toBoard(t, opp, F); // 5/4
    t = endTurn(t); // 相手のターン（2回目）
    expect(follower(t, weak.iid)).toBeUndefined();
    expect(follower(t, f.iid)?.attack).toBe(3);
    expect(follower(t, f.iid)?.defense).toBe(2);
    expect(t.players[opp].crests[0]?.countdown).toBe(1);
    t = endTurn(t);
    // 3回目も働くか確かめるため、残りをまた（2）だけにする
    (t.players[opp].crests[0] as unknown as { usedOptions: number }).usedOptions = 0b101;
    const g = toBoard(t, opp, F); // 5/4
    t = endTurn(t); // 相手のターン（3回目）: 能力が働いてから、カウントダウンが0になって無くなる（docs/rules.md 11章）
    expect(follower(t, g.iid)?.attack).toBe(3);
    expect(follower(t, g.iid)?.defense).toBe(2);
    expect(t.players[opp].crests).toHaveLength(0);
  });

  it("尽小花・イマリ: 手札を捨ててスペルを引く。進化後はスペルで小鬼。超進化時にコスト1のスペル2種類", () => {
    const { s, me } = setup({ turn: 7 });
    putInDeck(s, me, ["尽小花の照臨", "尽小花の照臨", "リヴァイブチューニング", "リヴァイブチューニング", "ストーン・ブレイク"]);
    s.players[me].sep = 2;
    toHand(s, me, F);
    let t = play(s, toHand(s, me, "尽小花・イマリ"));
    expect(handNames(t, me)).toHaveLength(1);
    expect(t.players[me].hand[0]!.cardId).not.toBe(FILLER);
    t.players[me].hand = [];
    const im = find(t, me, "尽小花・イマリ")!;
    im.enteredTurn = 0;
    t = superEvolve(t, im.iid);
    expect([...handNames(t, me)].sort()).toEqual(["リヴァイブチューニング", "尽小花の照臨"].sort());
    const spell = t.players[me].hand.find((h) => h.cardId === rid("尽小花の照臨"))!;
    t = play(t, spell.iid);
    expect(names(t, me)).toContain("イマリの小鬼");
  });
});

describe("第6弾（アクセラレート等）", () => {
  it("低劣の玩具: PPが足りればフォロワーとして3枚引く。2〜5PPならアクセラレートで『低劣の玩具』を出す（引かない）", () => {
    const { s, me } = setup();
    let t = play(s, toHand(s, me, "低劣の玩具"));
    expect(t.players[me].hand).toHaveLength(3);
    const s2 = setup();
    s2.s.players[s2.me].pp = 3;
    t = play(s2.s, toHand(s2.s, s2.me, "低劣の玩具"));
    expect(names(t, s2.me)).toEqual(["低劣の玩具"]);
    expect(t.players[s2.me].hand).toHaveLength(0);
    expect(t.players[s2.me].pp).toBe(1);
  });

  it("拙劣の人形: ファンファーレで1枚出して両方進化。アクセラレートでは2枚出す（進化しない）", () => {
    const { s, me } = setup();
    let t = play(s, toHand(s, me, "拙劣の人形"));
    expect(all(t, me, "拙劣の人形").map((f) => f.evolve)).toEqual(["evolved", "evolved"]);
    const s2 = setup();
    s2.s.players[s2.me].pp = 4;
    t = play(s2.s, toHand(s2.s, s2.me, "拙劣の人形"));
    expect(all(t, s2.me, "拙劣の人形").map((f) => f.evolve)).toEqual(["none", "none"]);
    expect(t.players[s2.me].pp).toBe(1);
  });

  it("愚劣の兵器: ファンファーレで2枚。ターン終了時にそれぞれ3ダメージを割りふる。アクセラレートで1枚", () => {
    const { s, me, opp } = setup();
    for (let i = 0; i < 3; i++) toBoard(s, opp, "ミスティックアーティファクト"); // 体力5
    let t = play(s, toHand(s, me, "愚劣の兵器"));
    expect(all(t, me, "愚劣の兵器")).toHaveLength(3);
    t = endTurn(t);
    // 3枚 × 3ダメージ = 9 を古いものから割りふる: 5（破壊）+ 4
    expect(board(t, opp).map((c) => (c as FollowerOnBoard).defense)).toEqual([1, 5]);
    const s2 = setup();
    s2.s.players[s2.me].pp = 5;
    t = play(s2.s, toHand(s2.s, s2.me, "愚劣の兵器"));
    expect(all(t, s2.me, "愚劣の兵器")).toHaveLength(1);
    expect(t.players[s2.me].pp).toBe(1);
  });

  it("アクセラレートはスペルをプレイしたものとして扱う（満開の技術屋が働く）", () => {
    const { s, me, opp } = setup();
    toBoard(s, me, "満開の技術屋");
    const e = toBoard(s, opp, F);
    s.players[me].pp = 2;
    const t = play(s, toHand(s, me, "低劣の玩具"));
    expect(follower(t, e.iid)?.defense).toBe(1);
  });

  it("凡百の製図: 3枚を出して+0/+1", () => {
    const { s, me } = setup();
    const t = play(s, toHand(s, me, "凡百の製図"));
    expect([...names(t, me)]).toEqual(["愚劣の兵器", "低劣の玩具", "拙劣の人形"]);
    expect((board(t, me) as FollowerOnBoard[]).map((f) => f.defense)).toEqual([5, 4, 2]);
  });

  it("劣悪の天斧: 手札で働く。元のコスト5以上のフォロワーが場に出たら、ターン終了までコスト-1。進化と6ダメージ", () => {
    const { s, me, opp } = setup();
    const ax = toHand(s, me, "劣悪の天斧");
    let t = play(s, toHand(s, me, "ニューロンインタラプター"));
    const e = toBoard(t, opp, "ミスティックアーティファクト");
    const pp = t.players[me].pp;
    t = play(t, ax);
    expect(t.players[me].pp).toBe(pp - 2);
    expect(find(t, me, "ニューロンインタラプター")?.evolve).toBe("evolved");
    expect(follower(t, e.iid)).toBeUndefined();
  });

  it("劣悪の純心・カミシラ: 出した玩具・人形は進化する。超進化時に元のコスト5以上の枚数のダメージ", () => {
    const { s, me, opp } = setup({ turn: 7 });
    s.players[me].sep = 2;
    let t = play(s, toHand(s, me, "劣悪の純心・カミシラ"));
    expect(find(t, me, "低劣の玩具")?.evolve).toBe("evolved");
    expect(find(t, me, "拙劣の人形")?.evolve).toBe("evolved");
    expect(find(t, me, "劣悪の純心・カミシラ")?.evolve).toBe("none");
    const k = find(t, me, "劣悪の純心・カミシラ")!;
    k.enteredTurn = 0;
    const hp = t.players[opp].leaderHp;
    t = superEvolve(t, k.iid);
    expect(t.players[opp].leaderHp).toBe(hp - 3);
  });

  it("旧き天斧・ヨグゼンタ → 天斧の深淵: 元のコスト5以上のフォロワーと同名のカードを非公開で、コスト-3", () => {
    const { s, me } = setup();
    let t = play(s, toHand(s, me, "旧き天斧・ヨグゼンタ"));
    expect(handNames(t, me)).toEqual([]);
    const big = toBoard(t, me, "ニューロンインタラプター");
    t = play(t, toHand(t, me, "旧き天斧・ヨグゼンタ"));
    expect(handNames(t, me)).toEqual(["天斧の深淵"]);
    expect(big.cardId).toBe(rid("ニューロンインタラプター"));
    t = play(t, t.players[me].hand[0]!.iid); // 候補が1枚なので自動で選ぶ
    expect(handNames(t, me)).toEqual(["ニューロンインタラプター"]);
    const h = t.players[me].hand[0]!;
    expect(h.revealed).toBe(false);
    expect(h.costMod).toBe(-3);
  });

  it("小胆のパイオニア: 体力3以下を消滅", () => {
    const { s, me, opp } = setup();
    const a = toBoard(s, opp, "撃針の看守");
    toBoard(s, opp, F);
    const t = play(s, toHand(s, me, "小胆のパイオニア"));
    expect(follower(t, a.iid)).toBeUndefined();
    expect(t.players[opp].graveyardFollowers).toEqual([]);
  });

  it("天斧授与: 元のコスト5以上がいれば1枚引く", () => {
    const { s, me, opp } = setup();
    toBoard(s, opp, F);
    toBoard(s, me, "ニューロンインタラプター");
    const t = play(s, toHand(s, me, "天斧授与"));
    expect(t.players[me].hand).toHaveLength(1);
  });
});

describe("第7弾（場に出たアーティファクト・フォロワーの種類）", () => {
  it("ツインドローンガール → テレポートスラッシュ: 場に出たアーティファクト・フォロワーの種類の数のダメージ（同じ種類は1）", () => {
    const { s, me, opp } = setup({ turn: 5 });
    s.players[me].ep = 2;
    const e = toBoard(s, opp, "ミスティックアーティファクト");
    let t = play(s, toHand(s, me, "ツインドローンガール"));
    const g = find(t, me, "ツインドローンガール")!;
    g.enteredTurn = 0;
    t = evolve(t, g.iid);
    expect(all(t, me, "アナライズアーティファクト")).toHaveLength(2);
    expect(t.players[me].hand).toHaveLength(2); // アナライズの「場に出たとき」
    t = play(t, toHand(t, me, "テレポートスラッシュ"));
    expect(follower(t, e.iid)?.defense).toBe(4);
  });

  it("ドープダンサー: 3種類以上なら2枚", () => {
    const { s, me } = setup();
    let t = play(s, toHand(s, me, "ドープダンサー"));
    expect(all(t, me, "ドープダンサー")).toHaveLength(2);
    const s2 = setup();
    threeArtifactKinds(s2.s, s2.me);
    t = play(s2.s, toHand(s2.s, s2.me, "ドープダンサー"));
    expect(all(t, s2.me, "ドープダンサー")).toHaveLength(3);
  });

  it("ストリートラン: 3種類以上ならすべて、でなければ1つを選ぶ", () => {
    const { s, me } = setup();
    let t = play(s, toHand(s, me, "ストリートラン"), 1);
    expect(handNames(t, me)).toEqual(["エンシェントアーティファクト"]);
    const s2 = setup();
    threeArtifactKinds(s2.s, s2.me);
    t = play(s2.s, toHand(s2.s, s2.me, "ストリートラン"));
    expect(handNames(t, s2.me)).toEqual(["アナライズアーティファクト", "エンシェントアーティファクト"]);
  });

  it("ボールドペインター: 破壊。3種類以上ならエンシェントとミスティックを出す", () => {
    const { s, me, opp } = setup();
    const e = toBoard(s, opp, F);
    threeArtifactKinds(s, me);
    const t = play(s, toHand(s, me, "ボールドペインター"));
    expect(follower(t, e.iid)).toBeUndefined();
    expect(names(t, me)).toEqual(["ボールドペインター", "エンシェントアーティファクト", "ミスティックアーティファクト"]);
  });

  it("ワイルドキャスター: アナライズ（エンハンス5でミスティックも）。アーティファクトは突進を持つ", () => {
    const { s, me } = setup();
    const t = play(s, toHand(s, me, "ワイルドキャスター"));
    expect(find(t, me, "アナライズアーティファクト")?.keywords).toContain("rush");
    expect(find(t, me, "ミスティックアーティファクト")?.keywords).toContain("rush");
    const s2 = setup();
    s2.s.players[s2.me].pp = 4;
    const t2 = play(s2.s, toHand(s2.s, s2.me, "ワイルドキャスター"));
    expect(names(t2, s2.me)).toEqual(["ワイルドキャスター", "アナライズアーティファクト"]);
  });

  it("虚刻のアナテマ・スカーレット: 種類の数のダメージ", () => {
    const { s, me, opp } = setup();
    const e = toBoard(s, opp, "ミスティックアーティファクト");
    threeArtifactKinds(s, me);
    const t = play(s, toHand(s, me, "虚刻のアナテマ・スカーレット"));
    expect(follower(t, e.iid)?.defense).toBe(2);
  });

  it("奮励の追走・ミュー: アーティファクトが出たらランダム3ダメージ。超進化時、3種類以上なら疾走", () => {
    const { s, me, opp } = setup({ turn: 7 });
    s.players[me].sep = 2;
    const e = toBoard(s, opp, "ミスティックアーティファクト");
    const mu = toBoard(s, me, "奮励の追走・ミュー");
    ext(s, me).entered = [rid("アナライズアーティファクト"), rid("ミスティックアーティファクト")].sort();
    const t = superEvolve(s, mu.iid);
    expect(follower(t, e.iid)?.defense).toBe(2); // エンシェントが出て3ダメージ
    expect(follower(t, mu.iid)?.keywords).toContain("storm"); // エンシェントで3種類
  });

  it("フラッシュブリンク: 超進化可能ターンなら手札のフォロワーも+1/+0", () => {
    const { s, me } = setup({ turn: 7 });
    const f = toBoard(s, me, F);
    const h = toHand(s, me, F);
    const t = play(s, toHand(s, me, "フラッシュブリンク"));
    expect(follower(t, f.iid)?.attack).toBe(6);
    expect(t.players[me].hand.find((x) => x.iid === h)?.attackMod).toBe(1);
  });

  it("エッジーマスター: アーティファクトが場に出たら回復1。進化時にミスティック", () => {
    const { s, me } = setup({ turn: 5 });
    s.players[me].ep = 2;
    s.players[me].leaderHp = 10;
    const m = toBoard(s, me, "エッジーマスター");
    const t = evolve(s, m.iid);
    expect(names(t, me)).toContain("ミスティックアーティファクト");
    expect(t.players[me].leaderHp).toBe(11);
  });
});

describe("第8弾", () => {
  it("ありふれた幸福・クラトス: ラストワードで出したものはラストワードを失う", () => {
    const { s, me, opp } = setup();
    toBoard(s, opp, "ありふれた幸福・クラトス");
    let t = play(s, toHand(s, me, "ハクガ燐斂"));
    expect(names(t, opp)).toEqual(["ありふれた幸福・クラトス"]);
    t = play(t, toHand(t, me, "ハクガ燐斂"));
    expect(names(t, opp)).toEqual([]);
  });

  it("デバイスマニピュレーター・ジルク: 破壊されたアーティファクト・フォロワーと同名のカードを非公開で", () => {
    const { s, me } = setup();
    s.players[me].graveyardFollowers = [rid(F), rid("撃針の看守")];
    const t = play(s, toHand(s, me, "デバイスマニピュレーター・ジルク"));
    expect(handNames(t, me)).toEqual(["撃針の看守"]);
    expect(t.players[me].hand[0]!.revealed).toBe(false);
  });

  it("切り拓く未来: 3種類以上ならEP回復", () => {
    const { s, me, opp } = setup();
    toBoard(s, opp, F);
    s.players[me].ep = 0;
    threeArtifactKinds(s, me);
    const t = play(s, toHand(s, me, "切り拓く未来"));
    expect(t.players[me].ep).toBe(1);
  });

  it("決断の交差・アシュレイ＆リディア: エンハンス9で進化・疾走、進化したとき守護からランダム2枚を破壊", () => {
    const { s, me, opp } = setup();
    const a = toBoard(s, opp, F);
    const b = toBoard(s, opp, F);
    const c = toBoard(s, opp, "撃針の看守"); // 守護
    let t = play(s, toHand(s, me, "決断の交差・アシュレイ＆リディア"), [a.iid]);
    const al = find(t, me, "決断の交差・アシュレイ＆リディア")!;
    expect(al.evolve).toBe("evolved");
    expect(al.keywords).toContain("storm");
    expect(follower(t, a.iid)).toBeUndefined();
    expect(follower(t, c.iid)).toBeUndefined();
    expect(follower(t, b.iid)).toBeDefined();
  });

  it("アナタの先輩・エース: 進化時に他の進化前のフォロワーを進化", () => {
    const { s, me } = setup({ turn: 5 });
    s.players[me].ep = 2;
    const f = toBoard(s, me, F);
    const ace = toBoard(s, me, "アナタの先輩・エース");
    const t = evolve(s, ace.iid);
    expect(follower(t, f.iid)?.evolve).toBe("evolved");
  });

  it("エクセシブガーディアン・リオナ: 超進化時に他のフォロワーに潜伏", () => {
    const { s, me } = setup({ turn: 7 });
    s.players[me].sep = 2;
    const f = toBoard(s, me, F);
    const r = toBoard(s, me, "エクセシブガーディアン・リオナ");
    const t = superEvolve(s, r.iid);
    expect(follower(t, f.iid)?.keywords).toContain("ambush");
  });

  it("穢れなき日々: 超進化可能ターンなら回復2", () => {
    const { s, me } = setup({ turn: 7 });
    s.players[me].leaderHp = 10;
    const t = play(s, toHand(s, me, "穢れなき日々"));
    expect(t.players[me].leaderHp).toBe(12);
    expect(t.players[me].hand).toHaveLength(2);
  });
});

describe("第9弾（デッキに重複するカードがない）", () => {
  it("青錆の下っ端: 重複がないときだけ5ダメージ", () => {
    const { s, me, opp } = setup();
    const e = toBoard(s, opp, F);
    let t = play(s, toHand(s, me, "青錆の下っ端"));
    expect(follower(t, e.iid)?.defense).toBe(4);
    uniqueDeck(t, me, [F, "尽小花の照臨"]);
    t = play(t, toHand(t, me, "青錆の下っ端"));
    expect(follower(t, e.iid)).toBeUndefined();
  });

  it("錬磨の用心棒: 重複がないなら4ダメージと回復4", () => {
    const { s, me, opp } = setup();
    const e = toBoard(s, opp, F);
    s.players[me].leaderHp = 10;
    uniqueDeck(s, me, [F]);
    const t = play(s, toHand(s, me, "錬磨の用心棒"));
    expect(follower(t, e.iid)).toBeUndefined();
    expect(t.players[me].leaderHp).toBe(14);
  });

  it("屈辱なる放逐: 捨てて必殺のネメシス・フォロワーを引く。重複がなければさらに2枚", () => {
    const { s, me } = setup();
    uniqueDeck(s, me, [F, "束刃の咎人・カットスロート", "尽小花の照臨", "ストーン・ブレイク"]);
    toHand(s, me, F);
    const t = play(s, toHand(s, me, "屈辱なる放逐"));
    expect(handNames(t, me)[0]).toBe("束刃の咎人・カットスロート");
    expect(t.players[me].hand).toHaveLength(3);
  });

  it("ハクガ燐斂: 重複がないならすべて破壊", () => {
    const { s, me, opp } = setup();
    toBoard(s, opp, F);
    toBoard(s, opp, F);
    uniqueDeck(s, me, [F]);
    const t = play(s, toHand(s, me, "ハクガ燐斂"));
    expect(board(t, opp)).toHaveLength(0);
  });

  it("鋳鉄の腹心: 重複がないなら疾走", () => {
    const { s, me, opp } = setup();
    toBoard(s, opp, F);
    uniqueDeck(s, me, [F]);
    const t = play(s, toHand(s, me, "鋳鉄の腹心"));
    expect(find(t, me, "鋳鉄の腹心")?.keywords).toContain("storm");
    expect(board(t, opp)).toHaveLength(0);
  });

  it("束刃の咎人・カットスロート: 進化時にクレスト。クレストでプレイしたフォロワーが自分のターンごとに1回進化", () => {
    const { s, me } = setup({ turn: 5 });
    s.players[me].ep = 2;
    uniqueDeck(s, me, [F, "束刃の咎人・カットスロート"]);
    const c = toBoard(s, me, "束刃の咎人・カットスロート");
    let t = evolve(s, c.iid);
    expect(handNames(t, me)).toEqual(["束刃の咎人・カットスロート"]);
    expect(t.players[me].crests).toHaveLength(1);
    t = play(t, toHand(t, me, F));
    t = play(t, toHand(t, me, F));
    expect(all(t, me, F).map((f) => f.evolve)).toEqual(["evolved", "none"]);
  });

  it("ナイフストリンガー: 人形が場に出たら相手のリーダーに1ダメージ", () => {
    const { s, me, opp } = setup();
    const hp = s.players[opp].leaderHp;
    const t = play(s, toHand(s, me, "ナイフストリンガー"));
    expect(t.players[opp].leaderHp).toBe(hp - 2);
  });

  it("弾哭の変貌・アイズエデン: 撃針の看守を出し、アーティファクトが出たらランダム1枚を破壊", () => {
    const { s, me, opp } = setup();
    toBoard(s, opp, F);
    toBoard(s, opp, F);
    const t = play(s, toHand(s, me, "弾哭の変貌・アイズエデン"));
    expect(names(t, me)).toEqual(["弾哭の変貌・アイズエデン", "撃針の看守"]);
    expect(board(t, opp)).toHaveLength(1);
  });

  it("次元の選定: モード2でミスティック2枚", () => {
    const { s, me } = setup();
    const t = play(s, toHand(s, me, "次元の選定"), 1);
    expect(all(t, me, "ミスティックアーティファクト")).toHaveLength(2);
  });
});


// ---- 第10弾「ニーゲルヘリア神殺事件」（【証拠】【融合】アミュレット。docs/rules.md 8章・12章） ----

const evidenceOf = (s: GameState, p: PlayerIndex) =>
  board(s, p).flatMap((c) => (c.kind === "amulet" && c.evidence !== undefined ? [c.evidence] : []));
/** 自分の場に証拠の数 n の『神域の物証』を置く */
const placeEvidence = (s: GameState, p: PlayerIndex, n: number) => {
  const a = toBoard(s, p, "神域の物証");
  if (a.kind === "amulet") a.evidence = n;
  return a;
};
const fuse = (s: GameState, host: number, ...materials: number[]) => applyAction(s, { type: "fuse", host, materials });

describe("第10弾（【証拠】【融合】アミュレット）", () => {
  it("組み立て失敗: 『改良型・操り人形』を手札に加え、それは【必殺】【守護】からランダム1つを持つ（場に出しても持つ）", () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 8; seed++) {
      const { s, me } = setup({ seed });
      let t = play(s, toHand(s, me, "組み立て失敗"));
      expect(handNames(t, me)).toEqual(["改良型・操り人形"]);
      const kws = t.players[me].hand[0]!.keywords;
      expect(kws).toHaveLength(1);
      expect(["bane", "ward"]).toContain(kws[0]);
      seen.add(kws[0]!);
      t = play(t, t.players[me].hand[0]!.iid);
      expect(find(t, me, "改良型・操り人形")?.keywords).toContain(kws[0]);
    }
    expect(seen.size).toBe(2); // どちらも出る
  });

  it("最凶の収容: スペルにも融合できる。融合したとき『神域の物証』を場に出す。証拠1では破壊は働かず、回復だけ働く", () => {
    const { s, me, opp } = setup();
    const e = toBoard(s, opp, F);
    s.players[me].leaderHp = 10;
    const host = toHand(s, me, "最凶の収容");
    let t = fuse(s, host, toHand(s, me, "神域の物証"));
    expect(t.players[me].hand.map((h) => h.iid)).toEqual([host]);
    expect(evidenceOf(t, me)).toEqual([1]);
    t = play(t, host);
    expect(t.players[me].leaderHp).toBe(12);
    expect(follower(t, e.iid)).toBeDefined(); // 証拠が2未満なので破壊しない
    expect(evidenceOf(t, me)).toEqual([1]); // 証拠も減らない
  });

  it("最凶の収容: 証拠が無いときも破壊は働かない", () => {
    const { s, me, opp } = setup();
    const e = toBoard(s, opp, F);
    s.players[me].leaderHp = 10;
    const t = play(s, toHand(s, me, "最凶の収容"));
    expect(t.players[me].leaderHp).toBe(12);
    expect(follower(t, e.iid)).toBeDefined();
  });

  it("最凶の収容: 証拠2なら-2して（0で破壊）、相手の攻撃力最大のフォロワーを破壊", () => {
    const { s, me, opp } = setup();
    const big = toBoard(s, opp, F); // 5/4
    const small = toBoard(s, opp, F, { attack: 1 });
    placeEvidence(s, me, 2);
    const t = play(s, toHand(s, me, "最凶の収容"));
    expect(follower(t, big.iid)).toBeUndefined();
    expect(follower(t, small.iid)).toBeDefined();
    expect(evidenceOf(t, me)).toEqual([]);
  });

  it("最凶の収容: 証拠3なら1残る", () => {
    const { s, me, opp } = setup();
    const e = toBoard(s, opp, F);
    placeEvidence(s, me, 3);
    const t = play(s, toHand(s, me, "最凶の収容"));
    expect(follower(t, e.iid)).toBeUndefined();
    expect(evidenceOf(t, me)).toEqual([1]);
  });

  it("滅びの怪腕: 融合していなければ4ダメージ、融合していたなら8ダメージ（スペルでも「融合していたなら」が働く）", () => {
    for (const [fused, rest] of [
      [false, 6],
      [true, 2],
    ] as const) {
      const { s, me, opp } = setup();
      const e = toBoard(s, opp, F, { defense: 10 });
      const host = toHand(s, me, "滅びの怪腕");
      let t = s;
      if (fused) {
        t = fuse(t, host, toHand(t, me, "神域の物証"));
        expect(evidenceOf(t, me)).toEqual([1]);
      }
      t = play(t, host);
      expect(follower(t, e.iid)?.defense).toBe(rest);
    }
  });

  it("人滅の執事: ラストワードで『神域の物証』2枚を手札に", () => {
    const { s, me } = setup();
    const b = toBoard(s, me, "人滅の執事");
    // 自分のフォロワーを破壊する手段として、体力を0にしてターンを終える
    follower(s, b.iid)!.defense = 0;
    const t = endTurn(s);
    expect(follower(t, b.iid)).toBeUndefined();
    expect(handNames(t, me)).toEqual(["神域の物証", "神域の物証"]);
  });

  it("人滅の資産家: ファンファーレで『神域の物証』2枚。自分がアミュレットを融合したとき相手のフォロワーすべてに1ダメージ（アミュレット以外の融合では働かない）", () => {
    const { s, me, opp } = setup();
    const e = toBoard(s, opp, F);
    let t = play(s, toHand(s, me, "人滅の資産家"));
    expect(handNames(t, me)).toEqual(["神域の物証", "神域の物証"]);
    // フォロワーを素材にする融合（ウィッチの恍惚の才媛の【融合】カード）では働かない
    t = fuse(t, toHand(t, me, "恍惚の才媛"), toHand(t, me, F));
    expect(follower(t, e.iid)?.defense).toBe(4);
    const host = toHand(t, me, "滅びの怪腕");
    t = fuse(t, host, t.players[me].hand[0]!.iid);
    expect(follower(t, e.iid)?.defense).toBe(3);
  });

  it("人滅の資産家: 進化時に【融合】を持つカード1枚を引く", () => {
    const { s, me } = setup({ turn: 5 });
    s.players[me].ep = 2;
    putInDeck(s, me, [F, F, "ディメンションストレンジャー", "最凶の収容"]);
    const a = toBoard(s, me, "人滅の資産家");
    const t = evolve(s, a.iid);
    expect(handNames(t, me)).toEqual(["最凶の収容"]);
  });

  it("ディメンションストレンジャー: 自分が融合したとき（素材を問わない）突進。超進化時に疾走", () => {
    const { s, me } = setup({ turn: 7 });
    s.players[me].sep = 2;
    const d = toBoard(s, me, "ディメンションストレンジャー", { enteredTurn: s.turn });
    let t = fuse(s, toHand(s, me, "恍惚の才媛"), toHand(s, me, F));
    expect(follower(t, d.iid)?.keywords).toContain("rush");
    expect(follower(t, d.iid)?.keywords).not.toContain("storm");
    t = superEvolve(t, d.iid);
    expect(follower(t, d.iid)?.keywords).toContain("storm");
  });

  it("ディメンションストレンジャー: ラストワードでクレスト（カウントダウン2）。融合でカウント-1、0で破壊されて『ディメンションストレンジャー』を出す", () => {
    const { s, me } = setup();
    const d = toBoard(s, me, "ディメンションストレンジャー");
    follower(s, d.iid)!.defense = 0;
    let t = endTurn(s);
    expect(follower(t, d.iid)).toBeUndefined();
    expect(t.players[me].crests.map((c) => c.countdown)).toEqual([2]);
    // 自分のターン開始時にカウントが1進む
    t = endTurn(t);
    expect(t.players[me].crests.map((c) => c.countdown)).toEqual([1]);
    expect(names(t, me)).toEqual([]);
    t = fuse(t, toHand(t, me, "最凶の収容"), toHand(t, me, "神域の物証"));
    expect(t.players[me].crests).toEqual([]);
    expect(names(t, me)).toEqual(["神域の物証", "ディメンションストレンジャー"]);
  });

  it("ランチャーキャット: ファンファーレでアタックアーティファクトとエンシェントアーティファクトを出す", () => {
    const { s, me } = setup();
    const t = play(s, toHand(s, me, "ランチャーキャット"));
    expect(names(t, me)).toEqual(["ランチャーキャット", "アタックアーティファクト", "エンシェントアーティファクト"]);
  });

  it("人滅の紳士: 自分がアミュレットを融合したとき、相手のフォロワーからランダム1枚を破壊し、自分のリーダーを2回復", () => {
    const { s, me, opp } = setup();
    toBoard(s, opp, F);
    toBoard(s, opp, F);
    let t = play(s, toHand(s, me, "人滅の紳士"));
    expect(handNames(t, me)).toEqual(["神域の物証", "神域の物証"]);
    t.players[me].leaderHp = 10;
    t = fuse(t, toHand(t, me, "人滅の三悪・ランペイジ"), t.players[me].hand[0]!.iid, t.players[me].hand[1]!.iid);
    expect(board(t, opp)).toHaveLength(1);
    expect(t.players[me].leaderHp).toBe(12);
    // 2枚を素材にしても、融合したときの能力は1回だけ働く（出る『神域の物証』も1枚）
    expect(evidenceOf(t, me)).toEqual([1]);
  });

  it("人滅の三悪・ランペイジ: 選んだフォロワーと同名の相手のフォロワーすべてを破壊。融合していなければ最大体力はそのまま", () => {
    const { s, me, opp } = setup();
    const a = toBoard(s, opp, F);
    const b = toBoard(s, opp, F);
    const c = toBoard(s, opp, "撃針の看守");
    const t = play(s, toHand(s, me, "人滅の三悪・ランペイジ"), [a.iid]);
    expect(follower(t, a.iid)).toBeUndefined();
    expect(follower(t, b.iid)).toBeUndefined();
    expect(follower(t, c.iid)).toBeDefined();
    expect(t.players[opp].leaderMaxHp).toBe(20);
  });

  it("人滅の三悪・ランペイジ: 融合していたなら相手のリーダーの最大体力を半分（端数切り上げ）。体力は新しい最大値まで下がる", () => {
    const { s, me, opp } = setup();
    const e = toBoard(s, opp, F);
    s.players[opp].leaderMaxHp = 15;
    s.players[opp].leaderHp = 12;
    const host = toHand(s, me, "人滅の三悪・ランペイジ");
    let t = fuse(s, host, toHand(s, me, "神域の物証"));
    expect(evidenceOf(t, me)).toEqual([1]);
    t = play(t, host); // 候補が1枚なので自動で選ばれる
    expect(follower(t, e.iid)).toBeUndefined();
    expect(t.players[opp].leaderMaxHp).toBe(8);
    expect(t.players[opp].leaderHp).toBe(8);
  });
});
