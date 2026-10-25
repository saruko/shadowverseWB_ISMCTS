// ローテーションのニュートラルのカード（トークン・クレスト含む）のカード単位の最小シナリオテスト

import { describe, expect, it } from "vitest";
import { applyAction, newHandCard, type FollowerOnBoard, type GameState, type PlayerIndex } from "../src/engine";
import { board, can, follower, handNames, names, passTurns, play, rid, setup, toBoard, toHand } from "./rotationHelpers";

const FILLER_NAME = "燃え滾る闘志・フェザー"; // ロイヤル 3コスト 5/4 能力なし

/** エンジンの JSON にある、このバトル中の記録（TypeScript の型には無い） */
type PlayerExt = { evolvedCount: number; playedCosts: number };
const ext = (s: GameState, p: PlayerIndex) => (s.players[p] as unknown as { ext: PlayerExt }).ext;

const followers = (s: GameState, p: PlayerIndex) => board(s, p).filter((c): c is FollowerOnBoard => c.kind === "follower");
const byName = (s: GameState, p: PlayerIndex, name: string) => board(s, p).filter((c) => c.cardId === rid(name));
/** デッキにカードを加える（setup の deck はマリガンで手札に入って消えることがあるので使わない） */
const toDeck = (s: GameState, p: PlayerIndex, name: string) => {
  const h = newHandCard(s, rid(name));
  s.players[p].deck.unshift({ iid: h.iid, cardId: h.cardId });
};
const evolve = (s: GameState, iid: number, ...targets: number[][]) => {
  let t = applyAction(s, { type: "evolve", iid });
  for (const x of targets) t = applyAction(t, { type: "choose", targets: x });
  return t;
};

describe("第4弾", () => {
  it("空駆ける庇護者・カタリナ: 【奥義】で相手のフォロワー2枚に5ダメージ", () => {
    const { s, me, opp } = setup({ turn: 10 });
    toBoard(s, opp, FILLER_NAME, { defense: 9, maxDefense: 9 });
    toBoard(s, opp, FILLER_NAME, { defense: 9, maxDefense: 9 });
    const t = play(s, toHand(s, me, "空駆ける庇護者・カタリナ"));
    expect(followers(t, opp).map((f) => f.defense)).toEqual([4, 4]);
  });

  it("空駆ける庇護者・カタリナ: 奥義ゲージが10未満なら働かない", () => {
    const { s, me, opp } = setup({ turn: 9 });
    toBoard(s, opp, FILLER_NAME, { defense: 9, maxDefense: 9 });
    const t = play(s, toHand(s, me, "空駆ける庇護者・カタリナ"));
    expect(followers(t, opp).map((f) => f.defense)).toEqual([9]);
  });

  it("空駆ける庇護者・カタリナ: 受ける4以上のダメージを3にする", () => {
    const { s, me, opp } = setup();
    const k = toBoard(s, opp, "空駆ける庇護者・カタリナ");
    const t = play(s, toHand(s, me, "途絶した輪廻・ゼラエル")); // 候補が1枚なら自動で選ぶ
    expect(follower(t, k.iid)?.defense).toBe(2);
  });

  it("愛すべき相棒・ビィ: 超進化可能ターンなら進化する", () => {
    const a = setup({ turn: 7 });
    let t = play(a.s, toHand(a.s, a.me, "愛すべき相棒・ビィ"));
    expect(followers(t, a.me)[0]?.evolve).toBe("evolved");
    const b = setup({ turn: 5 });
    t = play(b.s, toHand(b.s, b.me, "愛すべき相棒・ビィ"));
    expect(followers(t, b.me)[0]?.evolve).toBe("none");
  });

  it("コスモスの御使い・ユニ: 自分のターン終了時、自分のリーダーを1回復（フォロワーの回復はエンジン未対応）", () => {
    const { s, me } = setup();
    toBoard(s, me, "コスモスの御使い・ユニ");
    s.players[me].leaderHp = 10;
    const t = applyAction(s, { type: "endTurn" });
    expect(t.players[me].leaderHp).toBe(11);
  });

  it("蒼い空を征く騎空士・グラン＆ジータ: モード（1）と【奥義】で進化", () => {
    const { s, me, opp } = setup({ turn: 10 });
    toBoard(s, opp, FILLER_NAME, { defense: 9, maxDefense: 9 });
    const t = play(s, toHand(s, me, "蒼い空を征く騎空士・グラン＆ジータ"), 0);
    expect(followers(t, opp)[0]?.defense).toBe(4);
    expect(followers(t, me)[0]?.evolve).toBe("evolved");
  });

  it("蒼い空を征く騎空士・グラン＆ジータ: モード（2）でフォロワー2枚を引く。奥義でなければ進化しない", () => {
    const { s, me } = setup({ turn: 3 });
    const t = play(s, toHand(s, me, "蒼い空を征く騎空士・グラン＆ジータ"), 1);
    expect(handNames(t, me)).toEqual([FILLER_NAME, FILLER_NAME]);
    expect(followers(t, me)[0]?.evolve).toBe("none");
  });

  it("空の命運を握る少女・ルリア: 【エンハンス_8】でコスト7以上のフォロワーを引き、PPを7回復", () => {
    const { s, me } = setup();
    toDeck(s, me, "途絶した輪廻・ゼラエル");
    const t = play(s, toHand(s, me, "空の命運を握る少女・ルリア"));
    expect(handNames(t, me)).toEqual(["途絶した輪廻・ゼラエル"]);
    expect(t.players[me].pp).toBe(9);
  });

  it("天司長の後継・サンダルフォン: 進化6回で直接召喚され、クレストを持って手札に戻る", () => {
    const { s, me } = setup();
    toDeck(s, me, "天司長の後継・サンダルフォン");
    ext(s, me).evolvedCount = 6;
    const t = passTurns(s, 1);
    expect(handNames(t, me)).toContain("天司長の後継・サンダルフォン");
    expect(names(t, me)).not.toContain("天司長の後継・サンダルフォン");
    expect(t.players[me].deck.some((c) => c.cardId === rid("天司長の後継・サンダルフォン"))).toBe(false);
    expect(t.players[me].crests).toHaveLength(1);
  });

  it("天司長の後継・サンダルフォン: 進化5回なら直接召喚されない", () => {
    const { s, me } = setup();
    toDeck(s, me, "天司長の後継・サンダルフォン");
    ext(s, me).evolvedCount = 5;
    const t = passTurns(s, 1);
    expect(t.players[me].crests).toHaveLength(0);
  });

  it("天司長の後継・サンダルフォン: 【解放奥義】で2ダメージを5回", () => {
    const { s, me, opp } = setup({ turn: 15 });
    const t = play(s, toHand(s, me, "天司長の後継・サンダルフォン"));
    expect(t.players[opp].leaderHp).toBe(s.players[opp].leaderHp - 10);
  });

  it("天司長の後継・サンダルフォン: 奥義ゲージ14なら働かない", () => {
    const { s, me, opp } = setup({ turn: 14 });
    const t = play(s, toHand(s, me, "天司長の後継・サンダルフォン"));
    expect(t.players[opp].leaderHp).toBe(s.players[opp].leaderHp);
  });

  it("クレスト：天司長の後継・サンダルフォン: 自分のターン終了時にリーダーを1回復。カウントダウン2", () => {
    const { s, me } = setup();
    toDeck(s, me, "天司長の後継・サンダルフォン");
    ext(s, me).evolvedCount = 6;
    let t = passTurns(s, 1);
    expect(t.players[me].crests[0]?.countdown).toBe(2);
    t.players[me].leaderHp = 10;
    t = applyAction(t, { type: "endTurn" });
    expect(t.players[me].leaderHp).toBe(11);
    t = applyAction(t, { type: "endTurn" });
    expect(t.players[me].crests[0]?.countdown).toBe(1);
    t = passTurns(t, 1);
    expect(t.players[me].crests).toHaveLength(0);
  });
});

describe("第5弾", () => {
  it("達筆の怪異: 場に他の元のコスト1のカードがあれば+1/+1", () => {
    const a = setup();
    toBoard(a.s, a.opp, "達筆の怪異");
    let t = play(a.s, toHand(a.s, a.me, "達筆の怪異"));
    expect(followers(t, a.me)[0]?.attack).toBe(2);
    const b = setup();
    toBoard(b.s, b.opp, FILLER_NAME);
    t = play(b.s, toHand(b.s, b.me, "達筆の怪異"));
    expect(followers(t, b.me)[0]?.attack).toBe(1);
  });

  it("スターライトゴッデス: 手札3枚を捨て、手札左から3枚のコピーを加える", () => {
    const { s, me } = setup({ turn: 6 });
    s.players[me].ep = 2;
    const g = toBoard(s, me, "スターライトゴッデス");
    const h = ["愛すべき相棒・ビィ", "達筆の怪異", "混濁せし民", "退廃の涙", "輪廻転衝"].map((n) => toHand(s, me, n));
    const t = evolve(s, g.iid, [h[0] as number, h[2] as number, h[4] as number]);
    expect(handNames(t, me)).toEqual(["達筆の怪異", "退廃の涙", "達筆の怪異", "退廃の涙"]);
    expect(t.players[me].graveyard).toBe(s.players[me].graveyard + 3);
  });

  it("軍配の偉丈夫: 手札のコストの大きい順3枚の合計が相手より大きければ、相手のフォロワーすべてを破壊", () => {
    const a = setup({ turn: 6 });
    a.s.players[a.me].ep = 2;
    const g = toBoard(a.s, a.me, "軍配の偉丈夫");
    ["途絶した輪廻・ゼラエル", "途絶した輪廻・ゼラエル", "愛すべき相棒・ビィ"].forEach((n) => toHand(a.s, a.me, n));
    ["途絶した輪廻・ゼラエル", "愛すべき相棒・ビィ", "愛すべき相棒・ビィ", "愛すべき相棒・ビィ"].forEach((n) => toHand(a.s, a.opp, n));
    toBoard(a.s, a.opp, FILLER_NAME);
    toBoard(a.s, a.opp, FILLER_NAME);
    let t = evolve(a.s, g.iid);
    expect(followers(t, a.opp)).toHaveLength(0);
    // 同じ合計なら働かない
    const b = setup({ turn: 6 });
    b.s.players[b.me].ep = 2;
    const g2 = toBoard(b.s, b.me, "軍配の偉丈夫");
    toHand(b.s, b.me, "途絶した輪廻・ゼラエル");
    toHand(b.s, b.opp, "途絶した輪廻・ゼラエル");
    toBoard(b.s, b.opp, FILLER_NAME);
    t = evolve(b.s, g2.iid);
    expect(followers(t, b.opp)).toHaveLength(1);
  });

  it("大遊戯世界: プレイしたカードと同じ元のコストのカードが場（これ自身を含む）にあればカウント-1", () => {
    const { s, me, opp } = setup();
    const w = toBoard(s, me, "大遊戯世界");
    const cd = () => (board(t, me).find((c) => c.iid === w.iid) as { countdown: number | null } | undefined)?.countdown;
    let t = s;
    expect(cd()).toBe(5);
    // 元のコスト1: 大遊戯世界自身がある
    t = play(t, toHand(t, me, "達筆の怪異"));
    expect(cd()).toBe(4);
    // 元のコスト2: 場に他のコスト2がない
    t = play(t, toHand(t, me, "愛すべき相棒・ビィ"));
    expect(cd()).toBe(4);
    // 相手の場のコスト2も数える
    toBoard(t, opp, "混濁せし民");
    t = play(t, toHand(t, me, "愛すべき相棒・ビィ"));
    expect(cd()).toBe(3);
  });

  it("大遊戯世界: 【ラストワード】で2枚引く", () => {
    const { s, me } = setup();
    toBoard(s, me, "大遊戯世界");
    const a = board(s, me)[0] as { countdown: number | null };
    a.countdown = 1;
    const t = passTurns(s, 1);
    expect(names(t, me)).toEqual([]);
    expect(t.players[me].hand).toHaveLength(3); // ターン開始時のドロー1枚＋2枚
  });

  it("《世界》の提示: 2枚引き、攻撃力最大のフォロワーを破壊。【エンハンス_10】で相手のフォロワーとリーダーに4ダメージ", () => {
    const a = setup();
    a.s.players[a.me].pp = 5;
    toBoard(a.s, a.opp, FILLER_NAME, { attack: 7 });
    toBoard(a.s, a.opp, FILLER_NAME, { defense: 9, maxDefense: 9 });
    let t = play(a.s, toHand(a.s, a.me, "《世界》の提示"));
    expect(t.players[a.me].hand).toHaveLength(2);
    expect(followers(t, a.opp).map((f) => f.defense)).toEqual([9]);
    expect(t.players[a.opp].leaderHp).toBe(a.s.players[a.opp].leaderHp);
    const b = setup();
    toBoard(b.s, b.opp, FILLER_NAME, { attack: 7 });
    toBoard(b.s, b.opp, FILLER_NAME, { defense: 9, maxDefense: 9 });
    t = play(b.s, toHand(b.s, b.me, "《世界》の提示"));
    expect(followers(t, b.opp).map((f) => f.defense)).toEqual([5]);
    expect(t.players[b.opp].leaderHp).toBe(b.s.players[b.opp].leaderHp - 4);
  });

  it("八界花・ゲテンオウ: 手札を捨て、モード（1）で8枚引く", () => {
    const { s, me } = setup();
    toHand(s, me, "愛すべき相棒・ビィ");
    toHand(s, me, "愛すべき相棒・ビィ");
    const t = play(s, toHand(s, me, "八界花・ゲテンオウ"), 0);
    expect(handNames(t, me)).toEqual(Array(8).fill(FILLER_NAME));
    expect(t.players[me].graveyard).toBe(s.players[me].graveyard + 2);
  });

  it("八界花・ゲテンオウ: モード（2）で2枚引き、それのコストを-8", () => {
    const { s, me } = setup();
    toDeck(s, me, "途絶した輪廻・ゼラエル");
    toHand(s, me, "愛すべき相棒・ビィ");
    const t = play(s, toHand(s, me, "八界花・ゲテンオウ"), 1);
    expect(t.players[me].hand).toHaveLength(2);
    expect(t.players[me].hand.every((h) => h.costMod === -8)).toBe(true);
  });
});

describe("第6弾", () => {
  it("混濁せし民: 【ラストワード】で相手のリーダーに1ダメージ", () => {
    const { s, me, opp } = setup();
    const c = toBoard(s, opp, "混濁せし民");
    const t = play(s, toHand(s, me, "這い寄られし者"));
    expect(follower(t, c.iid)).toBeUndefined();
    expect(t.players[me].leaderHp).toBe(s.players[me].leaderHp - 1);
  });

  it("這い寄られし者: 選んだ相手のフォロワーを破壊", () => {
    const { s, me, opp } = setup();
    const a = toBoard(s, opp, FILLER_NAME);
    const b = toBoard(s, opp, FILLER_NAME);
    const t = play(s, toHand(s, me, "這い寄られし者"), [b.iid]);
    expect(followers(t, opp).map((f) => f.iid)).toEqual([a.iid]);
  });

  it("侵略されし世界: 【アクト】で手札1枚が相手のデッキのカードのコピーに変身", () => {
    const { s, me } = setup();
    const w = toBoard(s, me, "侵略されし世界");
    const h = toHand(s, me, "愛すべき相棒・ビィ");
    toHand(s, me, "達筆の怪異");
    let t = applyAction(s, { type: "act", iid: w.iid });
    t = applyAction(t, { type: "choose", targets: [h] });
    expect(handNames(t, me)).toEqual([FILLER_NAME, "達筆の怪異"]);
  });

  it("闇を彷徨う獣: ランダム3つの能力を持つ", () => {
    for (const seed of [1, 2, 3]) {
      const { s, me } = setup({ seed });
      const t = play(s, toHand(s, me, "闇を彷徨う獣"));
      const kws = followers(t, me)[0]?.keywords ?? [];
      expect(kws).toHaveLength(3);
      expect(kws.every((k) => ["storm", "bane", "intimidate", "drain", "aura", "barrier"].includes(k))).toBe(true);
    }
  });

  it("暗黒次元: 自分のターン終了時、アサイラントでないフォロワーすべてに2ダメージ", () => {
    const { s, me, opp } = setup();
    toBoard(s, me, "暗黒次元");
    const a = toBoard(s, opp, FILLER_NAME);
    const b = toBoard(s, me, "畏怖の象徴・オメガオテプ");
    const t = applyAction(s, { type: "endTurn" });
    expect(follower(t, a.iid)?.defense).toBe(2);
    expect(follower(t, b.iid)?.defense).toBe(4);
  });

  it("畏怖の象徴・オメガオテプ: ランダム2つの能力が働く", () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const { s, me, opp } = setup({ seed });
      s.players[me].pp = 9;
      toBoard(s, opp, FILLER_NAME);
      const t = play(s, toHand(s, me, "畏怖の象徴・オメガオテプ"));
      const o = followers(t, me)[0] as FollowerOnBoard;
      const happened = [
        followers(t, opp).length === 0,
        t.players[opp].leaderHp < s.players[opp].leaderHp,
        t.players[me].pp === 2,
        o.attack > 4,
      ].filter(Boolean).length;
      // （4）でファンファーレをもう一度働かせると3つ以上になることがある
      expect(happened).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("第7弾", () => {
  it("ピュアリィキッズ: 【進化時】ニュートラル・カードを引く", () => {
    const { s, me } = setup({ turn: 6 });
    toDeck(s, me, "愛すべき相棒・ビィ");
    s.players[me].ep = 2;
    const k = toBoard(s, me, "ピュアリィキッズ");
    const t = evolve(s, k.iid);
    expect(handNames(t, me)).toEqual(["愛すべき相棒・ビィ"]);
  });

  it("退廃の涙: 相手の場のアミュレットを消滅", () => {
    const { s, me, opp } = setup();
    const a = toBoard(s, opp, "暗黒次元");
    toBoard(s, opp, FILLER_NAME);
    const t = play(s, toHand(s, me, "退廃の涙"), [a.iid]);
    expect(names(t, opp)).toEqual([FILLER_NAME]);
    expect(t.players[opp].destroyedAmulets).toEqual([]);
  });

  it("ゴッズレポーター: 【超進化時】ゴッズレポーター2枚を出す。【ラストワード】で1枚引く", () => {
    const { s, me } = setup({ turn: 8 });
    s.players[me].sep = 2;
    const g = toBoard(s, me, "ゴッズレポーター");
    let t = applyAction(s, { type: "superEvolve", iid: g.iid });
    expect(byName(t, me, "ゴッズレポーター")).toHaveLength(3);
    // 暗黒次元で出した2枚（3/2）を破壊する
    toBoard(t, me, "暗黒次元");
    t = applyAction(t, { type: "endTurn" });
    expect(byName(t, me, "ゴッズレポーター").map((c) => c.iid)).toEqual([g.iid]);
    expect(t.players[me].hand).toHaveLength(2);
  });

  it("享楽の上位市民: 手札1枚を捨て、相手のフォロワーすべてに2ダメージ", () => {
    const { s, me, opp } = setup();
    const h = toHand(s, me, "愛すべき相棒・ビィ");
    toHand(s, me, "達筆の怪異");
    toBoard(s, opp, FILLER_NAME);
    toBoard(s, opp, FILLER_NAME);
    const t = play(s, toHand(s, me, "享楽の上位市民"), [h]);
    expect(handNames(t, me)).toEqual(["達筆の怪異"]);
    expect(followers(t, opp).map((f) => f.defense)).toEqual([2, 2]);
  });

  it("バベロンシティ: 自分のターン終了時に（1）（2）（3）を順に。アクトでカウント+1", () => {
    const { s, me, opp } = setup();
    const c = toBoard(s, me, "バベロンシティ");
    const cd = (t: GameState) => (board(t, me).find((x) => x.iid === c.iid) as { countdown: number | null } | undefined)?.countdown;
    const f = toBoard(s, opp, FILLER_NAME, { defense: 9, maxDefense: 9 });
    s.players[me].leaderHp = 10;
    const actDiscard = (t: GameState) => {
      const h = toHand(t, me, "愛すべき相棒・ビィ");
      toHand(t, me, "達筆の怪異");
      return applyAction(applyAction(t, { type: "act", iid: c.iid }), { type: "choose", targets: [h] });
    };
    let t = actDiscard(s);
    expect(cd(t)).toBe(2);
    expect(t.players[me].pp).toBe(9);
    t = applyAction(t, { type: "endTurn" });
    expect(follower(t, f.iid)?.defense).toBe(7);
    t = applyAction(t, { type: "endTurn" });
    expect(cd(t)).toBe(1);
    t = actDiscard(t);
    const hp = t.players[me].leaderHp;
    t = applyAction(t, { type: "endTurn" });
    expect(t.players[me].leaderHp).toBe(hp + 2);
    t = applyAction(t, { type: "endTurn" });
    t = actDiscard(t);
    const oppHp = t.players[opp].leaderHp;
    t = applyAction(t, { type: "endTurn" });
    expect(t.players[opp].leaderHp).toBe(oppHp - 2);
    expect(cd(t)).toBeUndefined();
  });

  it("バベロンシティ: アクトしなければ次の自分のターン開始時にカウントダウンで破壊される", () => {
    const { s, me } = setup();
    toBoard(s, me, "バベロンシティ");
    const t = passTurns(s, 1);
    expect(names(t, me)).toEqual([]);
  });

  it("特記標的・ヘイレムハニィ: フォロワーへの攻撃で【バリア】を持ち、交戦相手は攻撃できず相手のターン終了時に消滅", () => {
    const { s, me, opp } = setup();
    const h = toBoard(s, me, "特記標的・ヘイレムハニィ");
    const e = toBoard(s, opp, FILLER_NAME);
    let t = applyAction(s, { type: "attack", attacker: h.iid, target: e.iid });
    expect(follower(t, h.iid)?.defense).toBe(4); // バリアで戦闘ダメージを受けない
    expect(follower(t, h.iid)?.keywords).not.toContain("barrier"); // バリアはダメージを防いで失う
    expect(follower(t, e.iid)?.defense).toBe(3);
    t = applyAction(t, { type: "endTurn" });
    expect(follower(t, e.iid)).toBeDefined(); // 自分（ヘイレムハニィ側）のターン終了時には消滅しない
    // 相手のターン: 交戦相手は攻撃できない
    expect(can(t, { type: "attack", attacker: e.iid, target: "leader" })).toBe(false);
    t = applyAction(t, { type: "endTurn" });
    expect(follower(t, e.iid)).toBeUndefined();
    expect(t.players[opp].graveyardFollowers).toEqual([]); // 消滅なので破壊されたフォロワーに入らない
  });

  it("特記標的・ヘイレムハニィ: リーダーへの攻撃ではバリアを持たない", () => {
    const { s, me } = setup();
    const h = toBoard(s, me, "特記標的・ヘイレムハニィ");
    const t = applyAction(s, { type: "attack", attacker: h.iid, target: "leader" });
    expect(follower(t, h.iid)?.keywords).not.toContain("barrier");
  });

  it("特記標的・ヘイレムハニィ: 【ラストワード】でクレスト。クレストのカウントダウンが0で進化したヘイレムハニィを出す", () => {
    const { s, me } = setup();
    toBoard(s, me, "暗黒次元");
    toBoard(s, me, "特記標的・ヘイレムハニィ", { defense: 2, maxDefense: 2 });
    let t = applyAction(s, { type: "endTurn" });
    expect(t.players[me].crests.map((c) => c.countdown)).toEqual([2]);
    t = applyAction(t, { type: "endTurn" });
    expect(t.players[me].crests.map((c) => c.countdown)).toEqual([1]);
    t = passTurns(t, 1);
    expect(t.players[me].crests).toHaveLength(0);
    const hs = byName(t, me, "特記標的・ヘイレムハニィ") as FollowerOnBoard[];
    expect(hs.map((x) => x.evolve)).toEqual(["evolved"]);
  });

  it("バベロンメイヤー・エルタロ: 自分のターン終了時に1枚引く", () => {
    const { s, me } = setup();
    toBoard(s, me, "バベロンメイヤー・エルタロ");
    const t = applyAction(s, { type: "endTurn" });
    expect(t.players[me].hand).toHaveLength(1);
  });
});

describe("第8弾", () => {
  it("克己の聖鳥・ハンサ: 【進化時】+5/+5", () => {
    const { s, me } = setup({ turn: 6 });
    s.players[me].ep = 2;
    const h = toBoard(s, me, "克己の聖鳥・ハンサ");
    const t = evolve(s, h.iid);
    expect([follower(t, h.iid)?.attack, follower(t, h.iid)?.defense]).toEqual([8, 8]);
  });

  it("タイムレスジャーニー・レイナ: EPを1回復", () => {
    const { s, me } = setup();
    s.players[me].ep = 0;
    const t = play(s, toHand(s, me, "タイムレスジャーニー・レイナ"));
    expect(t.players[me].ep).toBe(1);
  });

  it("早鐘の歓喜・アルフィード: 選んだフォロワーに4ダメージ。【進化時】【疾走】", () => {
    const { s, me, opp } = setup({ turn: 6 });
    s.players[me].ep = 2;
    toBoard(s, opp, FILLER_NAME, { defense: 9, maxDefense: 9 });
    const b = toBoard(s, opp, FILLER_NAME, { defense: 9, maxDefense: 9 });
    let t = play(s, toHand(s, me, "早鐘の歓喜・アルフィード"), [b.iid]);
    expect(followers(t, opp).map((f) => f.defense)).toEqual([9, 5]);
    const a = followers(t, me)[0] as FollowerOnBoard;
    t = evolve(t, a.iid);
    expect(follower(t, a.iid)?.keywords).toContain("storm");
  });

  it("救世の勇姿: 相手の手札のコピーを非公開で加えてコストを-1し、1枚引く", () => {
    const { s, me, opp } = setup();
    toHand(s, opp, "途絶した輪廻・ゼラエル");
    const t = play(s, toHand(s, me, "救世の勇姿"));
    expect(handNames(t, me)).toEqual(["途絶した輪廻・ゼラエル", FILLER_NAME]);
    const c = t.players[me].hand[0];
    expect(c?.costMod).toBe(-1);
    expect(c?.revealed).toBe(false);
  });

  it("忘失の無垢・アイカ: 破壊された自分のフォロワーと同名のカードを手札に（【進化時】も同じ）", () => {
    const { s, me } = setup({ turn: 6 });
    s.players[me].ep = 2;
    s.players[me].graveyardFollowers = [rid("愛すべき相棒・ビィ")];
    let t = play(s, toHand(s, me, "忘失の無垢・アイカ"));
    expect(handNames(t, me)).toEqual(["愛すべき相棒・ビィ"]);
    t = evolve(t, (followers(t, me)[0] as FollowerOnBoard).iid);
    expect(handNames(t, me)).toEqual(["愛すべき相棒・ビィ", "愛すべき相棒・ビィ"]);
  });

  it("相承の意思: モード（2）【リアニメイト_2】、（3）自分のフォロワーすべて+1/+0", () => {
    const a = setup();
    a.s.players[a.me].graveyardFollowers = [rid("愛すべき相棒・ビィ"), rid("途絶した輪廻・ゼラエル")];
    let t = play(a.s, toHand(a.s, a.me, "相承の意思"), 1);
    expect(names(t, a.me)).toEqual(["愛すべき相棒・ビィ"]);
    const b = setup();
    toBoard(b.s, b.me, FILLER_NAME);
    t = play(b.s, toHand(b.s, b.me, "相承の意思"), 2);
    expect(followers(t, b.me)[0]?.attack).toBe(6);
  });

  it("アルビオンバハムート: モード（1）場の他のフォロワーすべてを消滅、（3）クレストすべてを消滅", () => {
    const a = setup();
    toBoard(a.s, a.me, FILLER_NAME);
    toBoard(a.s, a.opp, FILLER_NAME);
    toBoard(a.s, a.opp, "暗黒次元");
    let t = play(a.s, toHand(a.s, a.me, "アルビオンバハムート"), 0);
    expect(names(t, a.me)).toEqual(["アルビオンバハムート"]);
    expect(names(t, a.opp)).toEqual(["暗黒次元"]);
    // クレスト（ヘイレムハニィのラストワードで持たせる）
    const b = setup();
    toBoard(b.s, b.opp, "特記標的・ヘイレムハニィ");
    t = play(b.s, toHand(b.s, b.me, "這い寄られし者"));
    expect(t.players[b.opp].crests).toHaveLength(1);
    t.players[b.me].pp = 10;
    t = play(t, toHand(t, b.me, "アルビオンバハムート"), 2);
    expect(t.players[b.opp].crests).toHaveLength(0);
    expect(names(t, b.opp)).toEqual([]); // 消滅なのでクレストのラストワードは働かない
  });

  it("気高き黒翼・オリヴィエ: SEPを2回復", () => {
    const { s, me } = setup();
    s.players[me].sep = 0;
    const t = play(s, toHand(s, me, "気高き黒翼・オリヴィエ"));
    expect(t.players[me].sep).toBe(2);
  });
});

describe("第9弾", () => {
  it("最古の獄卒: 選んだフォロワーに6ダメージ、選んでいないフォロワーからランダム1枚に2ダメージ", () => {
    const { s, me, opp } = setup();
    const a = toBoard(s, opp, FILLER_NAME, { defense: 9, maxDefense: 9 });
    const b = toBoard(s, opp, FILLER_NAME, { defense: 9, maxDefense: 9 });
    const t = play(s, toHand(s, me, "最古の獄卒"), [b.iid]);
    expect(follower(t, b.iid)?.defense).toBe(3);
    expect(follower(t, a.iid)?.defense).toBe(7);
  });

  it("最古の獄卒: アクセラレート（コスト1）でスペルとしてプレイし、ランダム1枚に2ダメージ", () => {
    const { s, me, opp } = setup();
    s.players[me].pp = 1;
    toBoard(s, opp, FILLER_NAME);
    const t = play(s, toHand(s, me, "最古の獄卒"));
    expect(names(t, me)).toEqual([]);
    expect(t.players[me].pp).toBe(0);
    expect(followers(t, opp)[0]?.defense).toBe(2);
    expect(t.players[me].graveyard).toBe(s.players[me].graveyard + 1);
  });

  it("輪廻転衝: 破壊された元のコスト最大のフォロワーと同名のカードをデッキに加え、1枚引く", () => {
    const { s, me } = setup();
    s.players[me].deck = [];
    s.players[me].graveyardFollowers = [rid("愛すべき相棒・ビィ"), rid("途絶した輪廻・ゼラエル"), rid("達筆の怪異")];
    const t = play(s, toHand(s, me, "輪廻転衝"));
    expect(handNames(t, me)).toEqual(["途絶した輪廻・ゼラエル"]);
  });

  it("ブレードエンジェル: 自分の場の他のフォロワー2枚を選んで+3/+3", () => {
    const { s, me } = setup();
    const a = toBoard(s, me, FILLER_NAME);
    const b = toBoard(s, me, FILLER_NAME);
    const c = toBoard(s, me, FILLER_NAME);
    const t = play(s, toHand(s, me, "ブレードエンジェル"), [a.iid, c.iid]);
    expect([a, b, c].map((x) => follower(t, x.iid)?.attack)).toEqual([8, 5, 8]);
  });

  it("無我の看守: 『最古の獄卒』を加え、手札のニュートラル・カードの枚数ダメージをランダム2枚に。【進化時】PP1回復", () => {
    const { s, me, opp } = setup({ turn: 6 });
    s.players[me].ep = 2;
    toHand(s, me, "愛すべき相棒・ビィ");
    toHand(s, me, FILLER_NAME); // ロイヤルは数えない
    toBoard(s, opp, FILLER_NAME, { defense: 9, maxDefense: 9 });
    toBoard(s, opp, FILLER_NAME, { defense: 9, maxDefense: 9 });
    let t = play(s, toHand(s, me, "無我の看守"));
    expect(handNames(t, me)).toEqual(["愛すべき相棒・ビィ", FILLER_NAME, "最古の獄卒"]);
    expect(followers(t, opp).map((f) => f.defense)).toEqual([7, 7]);
    expect(t.players[me].pp).toBe(5);
    t = evolve(t, (byName(t, me, "無我の看守")[0] as FollowerOnBoard).iid);
    expect(t.players[me].pp).toBe(6);
  });

  it("混迷の監獄・アズヴォルト: 1～8をプレイ済みなら自分のターン終了時に破壊、ラストワードで4種類を出して+3/+3", () => {
    const { s, me } = setup();
    toBoard(s, me, "混迷の監獄・アズヴォルト");
    s.players[me].graveyardFollowers = ["愛すべき相棒・ビィ", "達筆の怪異", "混濁せし民", "最古の獄卒", "途絶した輪廻・ゼラエル", "愛すべき相棒・ビィ"].map(rid);
    ext(s, me).playedCosts = 0b111111110; // 1～8
    const t = applyAction(s, { type: "endTurn" });
    expect(names(t, me)).not.toContain("混迷の監獄・アズヴォルト");
    const fs = followers(t, me);
    expect(fs).toHaveLength(4);
    expect(new Set(fs.map((f) => f.cardId)).size).toBe(4);
    const bee = fs.find((f) => f.cardId === rid("愛すべき相棒・ビィ"));
    if (bee) expect([bee.attack, bee.defense]).toEqual([5, 5]);
  });

  it("混迷の監獄・アズヴォルト: 1～8のどれかをプレイしていなければ破壊されない", () => {
    const { s, me } = setup();
    toBoard(s, me, "混迷の監獄・アズヴォルト");
    ext(s, me).playedCosts = 0b111111010; // 2 が無い
    const t = applyAction(s, { type: "endTurn" });
    expect(names(t, me)).toEqual(["混迷の監獄・アズヴォルト"]);
  });

  it("途絶した輪廻・ゼラエル: 1～8をプレイ済みなら自分のターン終了時にデッキから直接召喚（ファンファーレは働かない）", () => {
    const { s, me, opp } = setup();
    toDeck(s, me, "途絶した輪廻・ゼラエル");
    const e = toBoard(s, opp, FILLER_NAME);
    ext(s, me).playedCosts = 0b111111110;
    const t = applyAction(s, { type: "endTurn" });
    expect(names(t, me)).toEqual(["途絶した輪廻・ゼラエル"]);
    expect(follower(t, e.iid)?.defense).toBe(4);
  });
});
