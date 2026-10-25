// ローテーションのナイトメアのカード（トークン・クレスト含む）の最小シナリオテスト

import { describe, expect, it } from "vitest";
import { ALL_CARDS } from "../src/cards";
import { NIGHTMARE_ROT, NIGHTMARE_ROT_CRESTS } from "../src/cards/abilities/rotation/nightmare";
import {
  applyAction,
  newHandCard,
  type AmuletOnBoard,
  type FollowerOnBoard,
  type GameState,
  type PlayerIndex,
} from "../src/engine";
import { FILLER, board, can, handNames, names, play, rid, setup, toBoard, toHand } from "./rotationHelpers";

const nameOf = (cardId: string) => ALL_CARDS.find((c) => c.id === cardId)?.name;
const find = (s: GameState, p: PlayerIndex, name: string) =>
  board(s, p).find((c) => nameOf(c.cardId) === name) as FollowerOnBoard | undefined;
const all = (s: GameState, p: PlayerIndex, name: string) =>
  board(s, p).filter((c) => nameOf(c.cardId) === name) as FollowerOnBoard[];
const crestIds = (s: GameState, p: PlayerIndex) => s.players[p].crests.map((c) => c.crestId);
const evolve = (s: GameState, iid: number) => applyAction(s, { type: "evolve", iid });
const superEvolve = (s: GameState, iid: number) => applyAction(s, { type: "superEvolve", iid });
const endTurn = (s: GameState) => applyAction(s, { type: "endTurn" });
/** デッキにカードを足す（setup の deck は初期手札に引かれて消えることがあるため） */
const toDeck = (s: GameState, p: PlayerIndex, name: string) => {
  const h = newHandCard(s, rid(name));
  s.players[p].deck.push({ iid: h.iid, cardId: h.cardId });
};

describe("ナイトメアの定義", () => {
  it("rotation-brief.md の全カード・全クレストに定義がある", () => {
    const cards = [
      "10451110", "10451120", "10451310", "10452110", "10452120", "10452130", "10453110", "10453310", "10454110",
      "10454120", "10551110", "10551120", "10551310", "10552110", "10552120", "10552310", "10553110", "10553310",
      "10554110", "10554120", "10651110", "10651120", "10651310", "10652110", "10652120", "10652310", "10653110",
      "10653310", "10654110", "10654120", "10751110", "10751120", "10751310", "10752110", "10752120", "10752310",
      "10753110", "10753310", "10754110", "10754120", "10851110", "10851120", "10851130", "10852110", "10852120",
      "10852310", "10853110", "10853310", "10854110", "10854120", "10951110", "10951120", "10951310", "10952110",
      "10952120", "10952310", "10953110", "10953310", "10954110", "10954120", "90051140", "90054330",
    ];
    expect(Object.keys(NIGHTMARE_ROT).sort()).toEqual([...cards].sort());
    expect(Object.keys(NIGHTMARE_ROT_CRESTS).sort()).toEqual(
      ["10451312", "10453312", "10454122", "10553312", "10554112", "10954112"].sort(),
    );
  });
});

describe("リアニメイト・ネクロマンス", () => {
  it("闇の理・フェディエル: ネクロマンス_6 でリアニメイト_2 と _1、出したものは進化する。ターン終了時に相手のフォロワー -2/-2", () => {
    const { s, me, opp } = setup();
    s.players[me].graveyard = 10;
    s.players[me].graveyardFollowers = [rid("渇仰の悪魔"), rid("キュートな悪魔・リリム")];
    const o = toBoard(s, opp, "燃え滾る闘志・フェザー");
    let t = play(s, toHand(s, me, "闇の理・フェディエル"));
    expect(find(t, me, "渇仰の悪魔")?.evolve).toBe("evolved");
    expect(find(t, me, "キュートな悪魔・リリム")?.evolve).toBe("evolved");
    expect(find(t, me, "闇の理・フェディエル")?.evolve).toBe("none");
    expect(t.players[me].graveyard).toBe(4);
    t = endTurn(t);
    const f = board(t, opp).find((c) => c.iid === o.iid) as FollowerOnBoard;
    expect([f.attack, f.defense]).toEqual([3, 2]);
  });

  it("闇の理・フェディエル: 墓場が足りなければ働かない", () => {
    const { s, me } = setup();
    s.players[me].graveyard = 5;
    s.players[me].graveyardFollowers = [rid("渇仰の悪魔")];
    const t = play(s, toHand(s, me, "闇の理・フェディエル"));
    expect(names(t, me)).toEqual(["闇の理・フェディエル"]);
  });

  it("イステンデッドVSマルチルゲート: リアニメイト_2 を3回、相手のフォロワーすべてに2ダメージ", () => {
    const { s, me, opp } = setup();
    s.players[me].graveyardFollowers = [rid("渇仰の悪魔")];
    toBoard(s, opp, "燃え滾る闘志・フェザー");
    const t = play(s, toHand(s, me, "イステンデッドVSマルチルゲート"));
    expect(all(t, me, "渇仰の悪魔").length).toBe(3);
    expect(all(t, me, "渇仰の悪魔").every((c) => c.defense === 2)).toBe(true);
    expect((board(t, opp)[0] as FollowerOnBoard).defense).toBe(2);
  });

  it("イステンデッドVSマルチルゲートのクレスト: ターン終了時、ラストワードを持つ自分のカードと相手のフォロワーを1枚ずつ破壊", () => {
    const { s, me, opp } = setup({ turn: 7 });
    const ist = toBoard(s, me, "イステンデッドVSマルチルゲート");
    toBoard(s, me, "渇仰の悪魔");
    toBoard(s, opp, "燃え滾る闘志・フェザー");
    let t = superEvolve(s, ist.iid);
    expect(crestIds(t, me).length).toBe(1);
    t = endTurn(t);
    expect(names(t, me)).toEqual(["イステンデッドVSマルチルゲート"]);
    expect(names(t, opp)).toEqual([]);
  });

  it("イステンデッドVSマルチルゲートのクレスト: ラストワードを持つカードがなければ相手のフォロワーも破壊しない", () => {
    const { s, me, opp } = setup({ turn: 7 });
    const ist = toBoard(s, me, "イステンデッドVSマルチルゲート");
    toBoard(s, opp, "燃え滾る闘志・フェザー");
    const t = endTurn(superEvolve(s, ist.iid));
    expect(names(t, opp)).toEqual(["燃え滾る闘志・フェザー"]);
  });

  it("デッドプレゼンター・マクミラン: ネクロマンス_10 で腐臭のゾンビ3枚。自分のターンに出た死者は +1/+0 突進・守護、相手のリーダーに1ダメージ", () => {
    const { s, me, opp } = setup();
    s.players[me].graveyard = 10;
    const t = play(s, toHand(s, me, "デッドプレゼンター・マクミラン"));
    const zs = all(t, me, "腐臭のゾンビ");
    expect(zs.length).toBe(3);
    for (const z of zs) {
      expect(z.attack).toBe(3);
      expect(z.keywords).toEqual(expect.arrayContaining(["rush", "ward"]));
    }
    expect(t.players[opp].leaderHp).toBe(17);
  });

  it("陽と月の薔薇・セレス: ネクロマンス_20 で手札のナイトメア・カードのコスト-2、ターン終了時に4回復", () => {
    const { s, me } = setup();
    s.players[me].graveyard = 20;
    s.players[me].leaderHp = 10;
    toHand(s, me, "渇仰の悪魔");
    toHand(s, me, "燃え滾る闘志・フェザー");
    let t = play(s, toHand(s, me, "陽と月の薔薇・セレス"));
    expect(t.players[me].hand.map((h) => h.costMod)).toEqual([-2, 0]);
    t = endTurn(t);
    expect(t.players[me].leaderHp).toBe(14);
  });
});

describe("奥義・解放奥義・クレスト", () => {
  it("コラプション: 場のフォロワー -2/-2、両者がクレストを持つ。解放奥義なら自分のクレストを破壊", () => {
    const { s, me, opp } = setup({ turn: 15 });
    toBoard(s, opp, "燃え滾る闘志・フェザー");
    const t = play(s, toHand(s, me, "コラプション"));
    expect(crestIds(t, me)).toEqual([]);
    expect(crestIds(t, opp)).toEqual(["10453312"]);
    expect((board(t, opp)[0] as FollowerOnBoard).defense).toBe(2);
  });

  it("コラプション: 解放奥義でなければ両者に残り、それぞれのターン終了時に持ち主のリーダーに2ダメージ", () => {
    const { s, me, opp } = setup({ turn: 3 });
    let t = play(s, toHand(s, me, "コラプション"));
    expect(crestIds(t, me)).toEqual(["10453312"]);
    expect(crestIds(t, opp)).toEqual(["10453312"]);
    t = endTurn(t);
    expect(t.players[me].leaderHp).toBe(18);
    expect(t.players[opp].leaderHp).toBe(20);
    t = endTurn(t);
    expect(t.players[opp].leaderHp).toBe(18);
  });

  it("狡知の堕天司・ベリアル: 他のフォロワーすべてに10ダメージ。解放奥義でクレスト、超進化時にカウント-1（0でラストワード20ダメージ）", () => {
    const { s, me, opp } = setup({ turn: 15 });
    toBoard(s, me, "燃え滾る闘志・フェザー");
    toBoard(s, opp, "燃え滾る闘志・フェザー");
    let t = play(s, toHand(s, me, "狡知の堕天司・ベリアル"));
    expect(names(t, me)).toEqual(["狡知の堕天司・ベリアル"]);
    expect(names(t, opp)).toEqual([]);
    expect(t.players[me].crests.map((c) => c.countdown)).toEqual([4]);
    (t.players[me].crests[0] as { countdown: number | null }).countdown = 1;
    t = superEvolve(t, (find(t, me, "狡知の堕天司・ベリアル") as FollowerOnBoard).iid);
    expect(crestIds(t, me)).toEqual([]);
    expect(t.players[opp].leaderHp).toBeLessThanOrEqual(0);
    expect(t.winner).toBe(me);
  });

  it("狡知の堕天司・ベリアル: 超進化時にクレストのカウント-1", () => {
    const { s, me } = setup({ turn: 15 });
    let t = play(s, toHand(s, me, "狡知の堕天司・ベリアル"));
    t = superEvolve(t, (find(t, me, "狡知の堕天司・ベリアル") as FollowerOnBoard).iid);
    expect(t.players[me].crests.map((c) => c.countdown)).toEqual([3]);
  });

  it("狡知の堕天司・ベリアル: 解放奥義でなければクレストを持たない", () => {
    const { s, me } = setup({ turn: 9 });
    const t = play(s, toHand(s, me, "狡知の堕天司・ベリアル"));
    expect(crestIds(t, me)).toEqual([]);
  });

  it("ヴァリアントエッジ: 自分に2ダメージ。クレストはターン終了時に相手のフォロワーに2ダメージ、1回復", () => {
    const { s, me, opp } = setup();
    toBoard(s, opp, "燃え滾る闘志・フェザー");
    let t = play(s, toHand(s, me, "ヴァリアントエッジ"));
    expect(t.players[me].leaderHp).toBe(18);
    t = endTurn(t);
    expect(t.players[me].leaderHp).toBe(19);
    expect((board(t, opp)[0] as FollowerOnBoard).defense).toBe(2);
  });

  it("厳酷なる奥夜花のクレスト: ターン終了時に1枚引き、手札に同じコストが4枚以上なら守護のスケルトン", () => {
    const { s, me } = setup();
    for (let i = 0; i < 3; i++) toHand(s, me, "燃え滾る闘志・フェザー");
    let t = play(s, toHand(s, me, "厳酷なる奥夜花"));
    t = endTurn(t);
    expect(t.players[me].hand.length).toBe(4);
    expect(find(t, me, "スケルトン")?.keywords).toContain("ward");
  });

  it("厳酷なる奥夜花のクレスト: 同じコストが4枚に満たなければスケルトンは出ない", () => {
    const { s, me } = setup();
    toHand(s, me, "燃え滾る闘志・フェザー");
    const t = endTurn(play(s, toHand(s, me, "厳酷なる奥夜花")));
    expect(names(t, me)).toEqual([]);
  });

  it("充つ《恋人と節制》・ミルティオ＆ルーゼン: 進化したとき他のフォロワーからランダム6枚を破壊", () => {
    const { s, me, opp } = setup({ turn: 5 });
    const m = toBoard(s, me, "充つ《恋人と節制》・ミルティオ＆ルーゼン");
    for (let i = 0; i < 3; i++) toBoard(s, me, "燃え滾る闘志・フェザー");
    for (let i = 0; i < 4; i++) toBoard(s, opp, "燃え滾る闘志・フェザー");
    const t = evolve(s, m.iid);
    expect(board(t, me).length + board(t, opp).length).toBe(2);
    expect(find(t, me, "充つ《恋人と節制》・ミルティオ＆ルーゼン")).toBeDefined();
    expect(crestIds(t, me)).toEqual([]);
  });

  it("充つ《恋人と節制》・ミルティオ＆ルーゼン: リアニメイト_4 と _2", () => {
    const { s, me } = setup();
    s.players[me].graveyardFollowers = [rid("渇仰の悪魔"), rid("紅札の魂魄使い")];
    const t = play(s, toHand(s, me, "充つ《恋人と節制》・ミルティオ＆ルーゼン"));
    expect(names(t, me)).toEqual(["充つ《恋人と節制》・ミルティオ＆ルーゼン", "紅札の魂魄使い", "渇仰の悪魔"]);
  });

  it("ミルティオ＆ルーゼンのクレスト: フォロワーのファンファーレ・エンハンスは働かず、プレイしたフォロワーは進化する", () => {
    const { s, me, opp } = setup({ turn: 7 });
    const m = toBoard(s, me, "充つ《恋人と節制》・ミルティオ＆ルーゼン");
    let t = superEvolve(s, m.iid);
    expect(crestIds(t, me)).toEqual(["10554112"]);
    t = play(t, toHand(t, me, "強襲の特攻隊長"));
    expect(t.players[me].leaderHp).toBe(20);
    expect(t.players[opp].leaderHp).toBe(20);
    expect(find(t, me, "強襲の特攻隊長")?.evolve).toBe("evolved");
    t = play(t, toHand(t, me, "リリーブウルフ"));
    const w = find(t, me, "リリーブウルフ") as FollowerOnBoard;
    expect(w.evolve).toBe("evolved");
    expect(w.keywords).not.toContain("bane");
    // 効果で進化しても「これが進化したとき」は働く
    t.players[me].pp = 10;
    t = play(t, toHand(t, me, "旧き天眼・ビバティー"));
    expect(handNames(t, me)).toEqual(["天眼の深淵"]);
  });
});

describe("ラストワード（失う・同名・付与）", () => {
  it("幽冥の中尉: ラストワードで +1/+0 突進の中尉を出し、それはラストワードを失う", () => {
    const { s, me, opp } = setup();
    toBoard(s, opp, "幽冥の中尉");
    let t = play(s, toHand(s, me, "トゥインクルデビル"));
    expect(names(t, opp)).toEqual(["幽冥の中尉"]);
    const l = board(t, opp)[0] as FollowerOnBoard;
    expect(l.attack).toBe(2);
    expect(l.keywords).toContain("rush");
    expect(t.players[opp].leaderHp).toBe(18);
    t.players[me].pp = 10;
    t = play(t, toHand(t, me, "トゥインクルデビル"));
    expect(names(t, opp)).toEqual([]);
  });

  it("腐臭のゾンビ: ラストワードで出したゾンビはラストワードを失う", () => {
    const { s, me, opp } = setup();
    toBoard(s, opp, "腐臭のゾンビ");
    let t = play(s, toHand(s, me, "トゥインクルデビル"));
    expect(names(t, opp)).toEqual(["腐臭のゾンビ"]);
    t.players[me].pp = 10;
    t = play(t, toHand(t, me, "トゥインクルデビル"));
    expect(names(t, opp)).toEqual([]);
  });

  it("不屈の鋭刃・バザラガ: ラストワードで同名を出し、自分のリーダーに2ダメージ", () => {
    const { s, me, opp } = setup();
    toBoard(s, opp, "不屈の鋭刃・バザラガ");
    const t = play(s, toHand(s, me, "トゥインクルデビル"));
    expect(names(t, opp)).toEqual(["不屈の鋭刃・バザラガ"]);
    // トゥインクルデビルの2ダメージとラストワードの2ダメージ
    expect(t.players[opp].leaderHp).toBe(16);
  });

  it("死神払い: 付与したラストワードで同名のカードを出す（渇命の破壊者で破壊）", () => {
    const { s, me } = setup();
    toBoard(s, me, "燃え滾る闘志・フェザー");
    let t = play(s, toHand(s, me, "死神払い"));
    t = play(t, toHand(t, me, "渇命の破壊者"));
    expect(all(t, me, "燃え滾る闘志・フェザー").length).toBe(1);
    expect(find(t, me, "渇命の破壊者")?.evolve).toBe("evolved");
    expect(find(t, me, "バット")?.evolve).toBe("evolved");
  });

  it("淵底の大佐（結晶）: PP2でカウントダウン4のアミュレット。カウント0で淵底の大佐が場に出る", () => {
    const { s, me } = setup();
    s.players[me].pp = 2;
    let t = play(s, toHand(s, me, "淵底の大佐"));
    const a = board(t, me)[0] as AmuletOnBoard;
    expect(a.kind).toBe("amulet");
    expect(a.countdown).toBe(4);
    a.countdown = 1;
    t = applyAction(endTurn(t), { type: "endTurn" });
    const f = find(t, me, "淵底の大佐");
    expect(f?.kind).toBe("follower");
    expect(f?.keywords).toContain("ward");
  });

  it("淵底の大佐: ラストワードで相手のフォロワーをランダム1枚破壊、2回復", () => {
    const { s, me, opp } = setup();
    s.players[me].leaderHp = 10;
    toBoard(s, me, "淵底の大佐");
    toBoard(s, opp, "燃え滾る闘志・フェザー");
    const t = play(s, toHand(s, me, "渇命の破壊者"));
    expect(names(t, opp)).toEqual([]);
    expect(t.players[me].leaderHp).toBe(12);
  });
});

describe("『スケルトン』・死者", () => {
  it("フェイタルテイカー: 他のフォロワーすべてをスケルトンに変身。進化時の1ダメージで壊れたスケルトン1枚ごとに1回復", () => {
    const { s, me, opp } = setup({ turn: 5 });
    s.players[me].leaderHp = 10;
    toBoard(s, me, "燃え滾る闘志・フェザー");
    toBoard(s, opp, "燃え滾る闘志・フェザー");
    toBoard(s, opp, "渇仰の悪魔");
    let t = play(s, toHand(s, me, "フェイタルテイカー"));
    expect(names(t, me)).toEqual(["スケルトン", "フェイタルテイカー"]);
    expect(names(t, opp)).toEqual(["スケルトン", "スケルトン"]);
    t = evolve(t, (find(t, me, "フェイタルテイカー") as FollowerOnBoard).iid);
    expect(names(t, me)).toEqual(["フェイタルテイカー"]);
    expect(names(t, opp)).toEqual([]);
    expect(t.players[me].leaderHp).toBe(13);
  });

  it("テイマースケルトン: 出したゾンビとスケルトン（死者）は疾走を持つ", () => {
    const { s, me } = setup();
    const t = play(s, toHand(s, me, "テイマースケルトン"));
    expect(find(t, me, "腐臭のゾンビ")?.keywords).toContain("storm");
    expect(find(t, me, "スケルトン")?.keywords).toContain("storm");
  });

  it("テイマースケルトン: 超進化時、他のフォロワーを選んで破壊したら相手のフォロワーをランダム1枚破壊", () => {
    const { s, me, opp } = setup({ turn: 7 });
    const tm = toBoard(s, me, "テイマースケルトン");
    toBoard(s, me, "スケルトン");
    toBoard(s, opp, "燃え滾る闘志・フェザー");
    const t = superEvolve(s, tm.iid);
    expect(names(t, me)).toEqual(["テイマースケルトン"]);
    expect(names(t, opp)).toEqual([]);
  });

  it("テイマースケルトン: 超進化時、選ぶフォロワーがなければ相手のフォロワーも破壊しない", () => {
    const { s, me, opp } = setup({ turn: 7 });
    const tm = toBoard(s, me, "テイマースケルトン");
    toBoard(s, opp, "燃え滾る闘志・フェザー");
    const t = superEvolve(s, tm.iid);
    expect(names(t, opp)).toEqual(["燃え滾る闘志・フェザー"]);
  });

  it("青春の謳歌: ゴースト・バット・スケルトンを出し、それらは進化する", () => {
    const { s, me } = setup();
    const t = play(s, toHand(s, me, "青春の謳歌"));
    expect(names(t, me)).toEqual(["ゴースト", "バット", "スケルトン"]);
    expect(board(t, me).every((c) => (c as FollowerOnBoard).evolve === "evolved")).toBe(true);
  });
});

describe("その他の複雑なカード", () => {
  it("傍死のアナテマ・徒姫: デッキのコスト2以下のナイトメア・フォロワー2種類を出し、それらは突進を持つ", () => {
    const { s, me } = setup();
    for (const n of ["渇仰の悪魔", "幽冥の中尉", "憧憬の鉄槌・アルメイダ", "ゴーストエスケーパー"]) toDeck(s, me, n);
    const t = play(s, toHand(s, me, "傍死のアナテマ・徒姫"));
    const others = board(t, me).filter((c) => nameOf(c.cardId) !== "傍死のアナテマ・徒姫");
    expect(others.length).toBe(2);
    expect(new Set(others.map((c) => c.cardId)).size).toBe(2);
    for (const c of others) expect(c.keywords).toContain("rush");
    expect(others.map((c) => nameOf(c.cardId))).not.toContain("ゴーストエスケーパー");
  });

  it("奥夜花・シャクドウ: 手札を戻して同じ枚数引き、同じコストが4枚以上なら4ダメージ（2回）", () => {
    const { s, me, opp } = setup();
    for (let i = 0; i < 4; i++) toHand(s, me, "燃え滾る闘志・フェザー");
    toBoard(s, opp, "燃え滾る闘志・フェザー");
    const t = play(s, toHand(s, me, "奥夜花・シャクドウ"));
    expect(t.players[me].hand.length).toBe(4);
    expect(t.players[opp].leaderHp).toBe(12);
    expect(names(t, opp)).toEqual([]);
  });

  it("鉄鎖の繋がり: エンハンス_4 なら2回", () => {
    const { s, me, opp } = setup();
    let t = play(s, toHand(s, me, "鉄鎖の繋がり"));
    expect([t.players[me].leaderHp, t.players[opp].leaderHp]).toEqual([18, 18]);
    t.players[me].pp = 3;
    t = play(t, toHand(t, me, "鉄鎖の繋がり"));
    expect([t.players[me].leaderHp, t.players[opp].leaderHp]).toEqual([17, 17]);
  });

  it("ガロダートVSゼット: 手札で、ターン終了時に自分のリーダーの体力が12以下ならコスト-1", () => {
    const { s, me } = setup();
    toHand(s, me, "ガロダートVSゼット");
    s.players[me].leaderHp = 12;
    let t = endTurn(s);
    expect(t.players[me].hand.find((h) => nameOf(h.cardId) === "ガロダートVSゼット")?.costMod).toBe(-1);
    t = applyAction(t, { type: "endTurn" });
    t.players[me].leaderHp = 13;
    t = endTurn(t);
    expect(t.players[me].hand.find((h) => nameOf(h.cardId) === "ガロダートVSゼット")?.costMod).toBe(-1);
  });

  it("ガロダートVSゼット: モード（2）で守護と相手のフォロワーすべてに8ダメージ", () => {
    const { s, me, opp } = setup();
    toBoard(s, opp, "燃え滾る闘志・フェザー");
    const t = play(s, toHand(s, me, "ガロダートVSゼット"), 1);
    expect(find(t, me, "ガロダートVSゼット")?.keywords).toContain("ward");
    expect(names(t, opp)).toEqual([]);
  });

  it("変わりし流れ: 手札1枚を戻して2枚引き、超進化可能ターンなら引いたカードのコスト-1", () => {
    const a = setup({ turn: 7 });
    toHand(a.s, a.me, "燃え滾る闘志・フェザー");
    const t = play(a.s, toHand(a.s, a.me, "変わりし流れ"));
    expect(t.players[a.me].hand.map((h) => h.costMod)).toEqual([-1, -1]);
    const b = setup({ turn: 3 });
    toHand(b.s, b.me, "燃え滾る闘志・フェザー");
    const u = play(b.s, toHand(b.s, b.me, "変わりし流れ"));
    expect(u.players[b.me].hand.map((h) => h.costMod)).toEqual([0, 0]);
  });

  it("『最強』の魅惑: 相手のフォロワーを消滅し、そのコピーを自分の場に出す", () => {
    const { s, me, opp } = setup();
    const o = toBoard(s, opp, "燃え滾る闘志・フェザー");
    if (o.kind === "follower") o.attack = 9;
    const t = play(s, toHand(s, me, "『最強』の魅惑"));
    expect(names(t, opp)).toEqual([]);
    expect(t.players[opp].graveyard).toBe(0);
    expect(names(t, me)).toEqual(["燃え滾る闘志・フェザー"]);
    expect((board(t, me)[0] as FollowerOnBoard).attack).toBe(5);
  });

  it("渇命の破壊者: 選ぶフォロワーがいなければ進化しない", () => {
    const { s, me } = setup();
    const t = play(s, toHand(s, me, "渇命の破壊者"));
    expect(names(t, me)).toEqual(["渇命の破壊者"]);
    expect(find(t, me, "渇命の破壊者")?.evolve).toBe("none");
  });

  it("枯渇の神魔・アルメス: 交戦相手を破壊。能力で破壊されない", () => {
    const { s, me, opp } = setup();
    const a = toBoard(s, me, "枯渇の神魔・アルメス");
    const o = toBoard(s, opp, "燃え滾る闘志・フェザー");
    if (o.kind === "follower") o.defense = o.maxDefense = 30;
    let t = applyAction(s, { type: "attack", attacker: a.iid, target: o.iid });
    expect(names(t, opp)).toEqual([]);
    t = play(t, toHand(t, me, "渇命の破壊者"));
    expect(find(t, me, "枯渇の神魔・アルメス")).toBeDefined();
    expect(find(t, me, "渇命の破壊者")?.evolve).toBe("evolved");
  });

  it("覇空の武神・ナタク: ターン終了時に4ダメージと2ダメージ（2回目は残ったフォロワーから）", () => {
    const { s, me, opp } = setup();
    toBoard(s, me, "覇空の武神・ナタク");
    toBoard(s, opp, "燃え滾る闘志・フェザー");
    toBoard(s, opp, "燃え滾る闘志・フェザー");
    const t = endTurn(s);
    expect(board(t, opp).map((c) => (c as FollowerOnBoard).defense)).toEqual([2]);
  });

  it("旅立ちの退出: モード2つ（（1）と（2））", () => {
    const { s, me, opp } = setup();
    s.players[me].leaderHp = 10;
    const t = play(s, toHand(s, me, "旅立ちの退出"), 0);
    expect(t.players[opp].leaderHp).toBe(19);
    expect(t.players[me].leaderHp).toBe(12);
  });

  it("旅立ちの退出: モード2つ（（2）と（4））で墓場+4", () => {
    const { s, me } = setup();
    const g = s.players[me].graveyard;
    // 組み合わせは (1,2) (1,3) (1,4) (2,3) (2,4) (3,4) の順
    const t = play(s, toHand(s, me, "旅立ちの退出"), 4);
    expect(t.players[me].graveyard).toBe(g + 1 + 4);
  });

  it("橋渡しの青鬼: 相手のフォロワーは相手のターン終了まで攻撃できない。1枚引く", () => {
    const { s, me, opp } = setup();
    const o = toBoard(s, opp, "燃え滾る闘志・フェザー");
    let t = play(s, toHand(s, me, "橋渡しの青鬼"));
    expect(handNames(t, me).length).toBe(1);
    t = endTurn(t);
    expect(can(t, { type: "attack", attacker: o.iid, target: "leader" })).toBe(false);
  });

  it("生滅の技巧・ネハン: 自分の場の進化前のフォロワーすべて（これを含む）が進化", () => {
    const { s, me } = setup();
    toBoard(s, me, "燃え滾る闘志・フェザー");
    const t = play(s, toHand(s, me, "生滅の技巧・ネハン"));
    expect(board(t, me).every((c) => (c as FollowerOnBoard).evolve === "evolved")).toBe(true);
    expect(t.players[me].leaderHp).toBe(18);
  });

  it("愛の旅人・サテュロス: 進化後のフォロワーがいれば進化する", () => {
    const { s, me } = setup();
    toBoard(s, me, "燃え滾る闘志・フェザー", { evolve: "evolved" });
    const t = play(s, toHand(s, me, "愛の旅人・サテュロス"));
    expect(find(t, me, "愛の旅人・サテュロス")?.evolve).toBe("evolved");
    const u = setup();
    const t2 = play(u.s, toHand(u.s, u.me, "愛の旅人・サテュロス"));
    expect(find(t2, u.me, "愛の旅人・サテュロス")?.evolve).toBe("none");
  });

  it("元素の共鳴・バアル: モード（1）で他のフォロワー1枚とこれが+1/+1", () => {
    const { s, me } = setup();
    const f = toBoard(s, me, "燃え滾る闘志・フェザー");
    const t = play(s, toHand(s, me, "元素の共鳴・バアル"), 0);
    const b = find(t, me, "元素の共鳴・バアル") as FollowerOnBoard;
    expect([b.attack, b.defense]).toEqual([3, 3]);
    const g = board(t, me).find((c) => c.iid === f.iid) as FollowerOnBoard;
    expect([g.attack, g.defense]).toEqual([6, 5]);
  });

  it("マザーな悪魔・フィオレ: バット3枚は突進を持つ", () => {
    const { s, me } = setup();
    const t = play(s, toHand(s, me, "マザーな悪魔・フィオレ"));
    const bats = all(t, me, "バット");
    expect(bats.length).toBe(3);
    for (const b of bats) expect(b.keywords).toContain("rush");
  });

  it("バニーな悪魔・リミル: 自分のリーダーの体力が大きいときだけバット2枚", () => {
    const { s, me, opp } = setup();
    s.players[opp].leaderHp = 19;
    const t = play(s, toHand(s, me, "バニーな悪魔・リミル"));
    expect(all(t, me, "バット").length).toBe(2);
    const u = setup();
    const t2 = play(u.s, toHand(u.s, u.me, "バニーな悪魔・リミル"));
    expect(all(t2, u.me, "バット").length).toBe(0);
  });

  it("残虐の炸裂: 体力最小のリーダーすべてに3ダメージ", () => {
    const { s, me, opp } = setup();
    let t = play(s, toHand(s, me, "残虐の炸裂"));
    expect([t.players[me].leaderHp, t.players[opp].leaderHp]).toEqual([17, 17]);
    t.players[opp].leaderHp = 10;
    t = play(t, toHand(t, me, "残虐の炸裂"));
    expect([t.players[me].leaderHp, t.players[opp].leaderHp]).toEqual([17, 7]);
  });

  it("透き通る信念・アンサージュ: 守護を無視してリーダーを攻撃できる", () => {
    const { s, me, opp } = setup();
    const a = toBoard(s, me, "透き通る信念・アンサージュ");
    toBoard(s, opp, "淵底の大佐");
    expect(can(s, { type: "attack", attacker: a.iid, target: "leader" })).toBe(true);
  });

  it("夜の唱のライブ: 6ダメージを割りふる。ネクロマンス_6 で相手のリーダーに2ダメージ", () => {
    const { s, me, opp } = setup();
    s.players[me].graveyard = 6;
    toBoard(s, opp, "燃え滾る闘志・フェザー");
    toBoard(s, opp, "燃え滾る闘志・フェザー");
    const t = play(s, toHand(s, me, "夜の唱のライブ"));
    expect(board(t, opp).map((c) => (c as FollowerOnBoard).defense)).toEqual([2]);
    expect(t.players[opp].leaderHp).toBe(18);
  });

  it("憧憬の鉄槌・アルメイダ: エンハンス_4 で進化して+1/+1", () => {
    const { s, me } = setup();
    const t = play(s, toHand(s, me, "憧憬の鉄槌・アルメイダ"));
    const a = find(t, me, "憧憬の鉄槌・アルメイダ") as FollowerOnBoard;
    expect(a.evolve).toBe("evolved");
    expect([a.attack, a.defense]).toEqual([6, 4]);
  });

  it("FILLER は能力のないフォロワー", () => {
    expect(FILLER).toBe(rid("燃え滾る闘志・フェザー"));
  });
});
