// ローテーションのビショップのカード（トークン・クレスト含む）の最小シナリオテスト

import { describe, expect, it } from "vitest";
import { applyAction, newHandCard, type AmuletOnBoard, type GameState, type OnBoard, type PlayerIndex } from "../src/engine";
import {
  board,
  can,
  follower,
  handNames,
  names,
  passTurns,
  play,
  rid,
  setup as baseSetup,
  toBoard,
  toHand,
} from "./rotationHelpers";

/** プレイヤーのローテーションの状態（型に無いので JSON から読む） */
type PlayerExt = { faith: { value: number } | null };
const pext = (s: GameState, p: PlayerIndex) => (s.players[p] as unknown as { ext: PlayerExt }).ext;
/** 場のカードのローテーションの状態 */
type BoardExt = { crystal?: boolean; timedKeywords?: string[]; lostLastWords?: boolean; silenced?: boolean };
const bext = (c: OnBoard | undefined) => (c as unknown as { ext?: BoardExt } | undefined)?.ext;
const amulet = (s: GameState, iid: number) =>
  [...s.players[0].board, ...s.players[1].board].find((c) => c.iid === iid) as AmuletOnBoard | undefined;
const act = (s: GameState, iid: number, ...choices: (number | number[])[]) => {
  let t = applyAction(s, { type: "act", iid });
  for (const c of choices) t = applyAction(t, typeof c === "number" ? { type: "mode", index: c } : { type: "choose", targets: c });
  return t;
};
/** 山札の一番上に置く */
const toDeckTop = (s: GameState, p: PlayerIndex, name: string) => {
  const h = newHandCard(s, rid(name));
  s.players[p].deck.unshift({ iid: h.iid, cardId: h.cardId });
};
const sorted = (xs: (string | undefined)[]) => [...xs].sort();

/**
 * rotationHelpers の setup は deck を常にプレイヤー0のデッキにするが、先攻（me）はシードで決まる。
 * また setup は手札を空にするので、渡したカードが最初の手札に入ると山札から消える。
 * deck を渡すときは、me がプレイヤー0で、渡したカードがすべて山札に残るシードを探す
 */
function setup(opts: Parameters<typeof baseSetup>[0] = {}): ReturnType<typeof baseSetup> {
  const want = opts.deck;
  if (!want) return baseSetup(opts);
  for (let seed = opts.seed ?? 1; ; seed++) {
    const r = baseSetup({ ...opts, seed });
    const deck = r.s.players[r.me].deck.map((d) => d.cardId);
    if (r.me === 0 && want.every((n) => deck.filter((x) => x === rid(n)).length >= want.filter((m) => m === n).length)) return r;
  }
}

describe("結晶", () => {
  it("崇奉の怯者: PPが足りなければ結晶（カウントダウン3）で出て、ラストワードで場に出たときに2回復", () => {
    const { s, me } = setup();
    s.players[me].pp = 2;
    s.players[me].leaderHp = 10;
    let t = play(s, toHand(s, me, "崇奉の怯者"));
    const c = board(t, me)[0];
    expect(c?.kind).toBe("amulet");
    expect((c as AmuletOnBoard).countdown).toBe(3);
    expect(bext(c)?.crystal).toBe(true);
    expect(t.players[me].pp).toBe(0);
    expect(t.players[me].leaderHp).toBe(10); // 結晶では「場に出たとき」は働かない
    t = passTurns(t, 3);
    expect(names(t, me)).toEqual(["崇奉の怯者"]);
    expect(board(t, me)[0]?.kind).toBe("follower");
    expect(t.players[me].leaderHp).toBe(12);
  });

  it("崇奉の怯者: PPが足りればフォロワーとしてプレイし、2回復", () => {
    const { s, me } = setup();
    s.players[me].pp = 5;
    s.players[me].leaderHp = 10;
    const t = play(s, toHand(s, me, "崇奉の怯者"));
    expect(board(t, me)[0]?.kind).toBe("follower");
    expect(t.players[me].leaderHp).toBe(12);
  });

  it("崇敬の塗布者・崇拝の聖騎士: コスト1の結晶で出る", () => {
    for (const name of ["崇敬の塗布者", "崇拝の聖騎士"]) {
      const { s, me } = setup();
      s.players[me].pp = 1;
      let t = play(s, toHand(s, me, name));
      expect((board(t, me)[0] as AmuletOnBoard).countdown).toBe(3);
      t = passTurns(t, 3);
      expect(names(t, me)).toEqual([name]);
      expect(board(t, me)[0]?.kind).toBe("follower");
    }
  });

  it("崇拝の聖騎士: プレイすると『崇拝の聖騎士』をもう1枚出す（出た方のファンファーレは働かない）", () => {
    const { s, me } = setup();
    const t = play(s, toHand(s, me, "崇拝の聖騎士"));
    expect(names(t, me)).toEqual(["崇拝の聖騎士", "崇拝の聖騎士"]);
  });

  it("ミラクルアルミラージ: 結晶はコスト1【アクト】でカウントを-1できる", () => {
    const { s, me } = setup();
    s.players[me].pp = 1;
    let t = play(s, toHand(s, me, "ミラクルアルミラージ"));
    const c = board(t, me)[0] as AmuletOnBoard;
    t.players[me].pp = 1;
    expect(can(t, { type: "act", iid: c.iid })).toBe(true);
    t = act(t, c.iid);
    expect(amulet(t, c.iid)?.countdown).toBe(2);
  });

  it("結晶は「自分の場のアミュレット」に数える", () => {
    const { s, me, opp } = setup();
    toBoard(s, me, "神紋ユラティオ");
    toBoard(s, me, "無欠の時計");
    const e = toBoard(s, opp, "燃え滾る闘志・フェザー");
    s.players[me].pp = 1;
    let t = play(s, toHand(s, me, "崇敬の塗布者")); // 結晶で3枚目のアミュレット
    t.players[me].pp = 10;
    t = play(t, toHand(t, me, "ホーリープランナー"));
    expect(follower(t, e.iid)).toBeUndefined(); // 5ダメージで破壊
  });
});

describe("アミュレット", () => {
  it("汚濁の聖水: コスト1【アクト】でカウント-1、ラストワードで1枚引いて相手のフォロワーをランダムに破壊", () => {
    const { s, me, opp } = setup();
    const a = toBoard(s, me, "汚濁の聖水");
    toBoard(s, opp, "燃え滾る闘志・フェザー");
    let t = act(s, a.iid);
    expect(t.players[me].pp).toBe(9);
    expect(amulet(t, a.iid)?.countdown).toBe(2);
    expect(can(t, { type: "act", iid: a.iid })).toBe(false); // 1ターンに1回
    t = passTurns(t, 2);
    expect(names(t, me)).toEqual([]);
    expect(names(t, opp)).toEqual([]);
    expect(t.players[me].hand.length).toBe(3); // ターン開始時2枚 + ラストワード1枚
  });

  it("咆哮の聖堂: コスト3【アクト】でカウント-3 → 破壊され、タイガーを出して相手のフォロワーに4ダメージ", () => {
    const { s, me, opp } = setup();
    const a = toBoard(s, me, "咆哮の聖堂");
    toBoard(s, opp, "燃え滾る闘志・フェザー");
    const t = act(s, a.iid);
    expect(t.players[me].pp).toBe(7);
    expect(names(t, me)).toEqual(["ホーリーフレイムタイガー"]);
    expect(names(t, opp)).toEqual([]);
  });

  it("リーリエ・ライツ: コスト2【アクト】で自分のフォロワーを『リーリエ・ライツ』に変身させ、1枚引く", () => {
    const { s, me } = setup();
    const a = toBoard(s, me, "リーリエ・ライツ");
    const f = toBoard(s, me, "清純なる白狐");
    const t = act(s, a.iid);
    expect(t.players[me].pp).toBe(8);
    expect(names(t, me)).toEqual(["リーリエ・ライツ"]);
    expect(board(t, me)[0]?.iid).toBe(f.iid);
    expect(board(t, me)[0]?.kind).toBe("amulet");
    expect(t.players[me].hand.length).toBe(1);
  });

  it("空を征く艇: 手札でアクトのたびにコスト-1、アクトで自分の進化前のフォロワーを進化", () => {
    const { s, me } = setup();
    const h = toHand(s, me, "空を征く艇");
    const clock = toBoard(s, me, "無欠の時計");
    const f = toBoard(s, me, "清純なる白狐");
    toBoard(s, me, "清純なる白狐", { evolve: "evolved" });
    let t = act(s, clock.iid);
    expect(t.players[me].hand.find((x) => x.iid === h)?.costMod).toBe(-1);
    t = play(t, h);
    expect(t.players[me].pp).toBe(7); // 10 - 0（無欠の時計のアクト） - 3
    const ship = board(t, me).find((c) => c.cardId === rid("空を征く艇"))!;
    t = act(t, ship.iid); // 進化前は1枚だけなので自動で選ぶ
    expect(follower(t, f.iid)?.evolve).toBe("evolved");
    expect(names(t, me)).not.toContain("空を征く艇");
  });

  it("レ・フィーエの宝石: アクトでモードを選んでから破壊（（2）2枚引く）", () => {
    const { s, me } = setup();
    const a = toBoard(s, me, "レ・フィーエの宝石");
    const t = act(s, a.iid, 1);
    expect(names(t, me)).toEqual([]);
    expect(t.players[me].hand.length).toBe(2);
  });

  it("プロテクションシェル: 【守護】を持つフォロワーの枚数だけ引く", () => {
    const { s, me } = setup();
    const a = toBoard(s, me, "プロテクションシェル");
    toBoard(s, me, "清純なる白狐");
    toBoard(s, me, "清純なる白狐");
    toBoard(s, me, "結びの使徒");
    const t = act(s, a.iid);
    expect(t.players[me].hand.length).toBe(2);
  });

  it("陽光の耳飾り: ファンファーレで手札1枚を選んで戻して1枚引く。アクトも同じ", () => {
    const { s, me } = setup();
    const keep = toHand(s, me, "清純なる白狐");
    const back = toHand(s, me, "結びの使徒");
    let t = play(s, toHand(s, me, "陽光の耳飾り"), [back]);
    expect(t.players[me].hand.map((h) => h.iid)).toContain(keep);
    expect(t.players[me].hand.map((h) => h.iid)).not.toContain(back);
    expect(t.players[me].hand.length).toBe(2);
    const a = board(t, me)[0]!;
    t = act(t, a.iid, [keep]);
    expect(names(t, me)).toEqual([]);
    expect(t.players[me].hand.map((h) => h.iid)).not.toContain(keep);
    expect(t.players[me].hand.length).toBe(2);
  });

  it("無欠の時計: エンハンスで相手のフォロワーすべてに1ダメージ、アクトでも1ダメージ", () => {
    const { s, me, opp } = setup();
    const e = toBoard(s, opp, "燃え滾る闘志・フェザー");
    let t = play(s, toHand(s, me, "無欠の時計"));
    expect(t.players[me].pp).toBe(6);
    expect(follower(t, e.iid)?.defense).toBe(3);
    t = act(t, board(t, me)[0]!.iid);
    expect(follower(t, e.iid)?.defense).toBe(2);
    expect(names(t, me)).toEqual([]);
  });

  it("朋友の学級: ターン終了時に1枚引き、超進化後のフォロワーがいれば2回復", () => {
    const { s, me } = setup();
    toBoard(s, me, "朋友の学級");
    toBoard(s, me, "清純なる白狐", { evolve: "superEvolved" });
    s.players[me].leaderHp = 10;
    const t = applyAction(s, { type: "endTurn" });
    expect(t.players[me].leaderHp).toBe(12);
    expect(t.players[me].hand.length).toBe(1);
  });

  it("神紋ユラティオ: ファンファーレで場のフォロワーすべてを破壊、コスト1【アクト】で1枚引いて1回復", () => {
    const { s, me, opp } = setup();
    toBoard(s, me, "清純なる白狐");
    toBoard(s, opp, "燃え滾る闘志・フェザー");
    s.players[me].leaderHp = 10;
    let t = play(s, toHand(s, me, "神紋ユラティオ"));
    expect(names(t, me)).toEqual(["神紋ユラティオ"]);
    expect(names(t, opp)).toEqual([]);
    t = act(t, board(t, me)[0]!.iid);
    expect(t.players[me].pp).toBe(3);
    expect(t.players[me].leaderHp).toBe(11);
    expect(t.players[me].hand.length).toBe(1);
  });
});

describe("破壊されたアミュレット", () => {
  it("崇高の天書: 自分のアミュレットを選んで破壊すると PP+2。ラストワードで破壊された元のコスト2以下のラストワードのアミュレットを出す", () => {
    const { s, me, opp } = setup();
    const water = toBoard(s, me, "汚濁の聖水");
    toBoard(s, opp, "燃え滾る闘志・フェザー");
    let t = play(s, toHand(s, me, "崇高の天書"), [water.iid]);
    expect(t.players[me].pp).toBe(8); // 10 - 4 + 2
    expect(names(t, opp)).toEqual([]); // 汚濁の聖水のラストワード
    expect(t.players[me].destroyedAmulets).toContain(rid("汚濁の聖水"));
    t = passTurns(t, 2);
    expect(names(t, me)).toEqual(["汚濁の聖水"]);
  });

  it("崇高の天書: 相手のカードを選んだら PP は回復しない", () => {
    const { s, me, opp } = setup();
    toBoard(s, me, "汚濁の聖水");
    const e = toBoard(s, opp, "燃え滾る闘志・フェザー");
    const t = play(s, toHand(s, me, "崇高の天書"), [e.iid]);
    expect(t.players[me].pp).toBe(6);
    expect(names(t, opp)).toEqual([]);
  });

  it("崇高の憎悪・カンディマ: 破壊された条件に合うアミュレット2種類を出す。超進化時に自分のアミュレットを破壊したら3ダメージ", () => {
    const { s, me, opp } = setup({ turn: 10 });
    s.players[me].destroyedAmulets = [rid("汚濁の聖水"), rid("救済の聖典"), rid("汚濁の聖水"), rid("神紋ユラティオ")];
    let t = play(s, toHand(s, me, "崇高の憎悪・カンディマ"));
    expect(sorted(names(t, me))).toEqual(sorted(["崇高の憎悪・カンディマ", "汚濁の聖水", "救済の聖典"]));
    const k = board(t, me).find((c) => c.cardId === rid("崇高の憎悪・カンディマ"))!;
    const u = toBoard(t, me, "神紋ユラティオ");
    const e = toBoard(t, opp, "燃え滾る闘志・フェザー");
    t = applyAction(t, { type: "superEvolve", iid: k.iid });
    t = applyAction(t, { type: "choose", targets: [u.iid] });
    expect(follower(t, e.iid)?.defense).toBe(1);
  });

  it("翼天の変貌・オルメリオ: 自分のアミュレットが破壊されるたび、（1）（2）（3）の順に1つ働く", () => {
    const { s, me, opp } = setup({ turn: 10 });
    const o = toBoard(s, me, "翼天の変貌・オルメリオ");
    for (let i = 0; i < 3; i++) toBoard(s, me, "神紋ユラティオ");
    const e1 = toBoard(s, opp, "燃え滾る闘志・フェザー");
    const e2 = toBoard(s, opp, "燃え滾る闘志・フェザー");
    s.players[me].leaderHp = 10;
    let t = applyAction(s, { type: "evolve", iid: o.iid });
    expect(follower(t, e1.iid)?.defense).toBe(1);
    expect(follower(t, e2.iid)?.defense).toBe(1);
    expect(t.players[me].leaderHp).toBe(12);
    expect(sorted(names(t, me))).toEqual(sorted(["翼天の変貌・オルメリオ", "ホーリーファルコン"]));
    // 次は（1）に戻る
    const clock = toBoard(t, me, "無欠の時計");
    t = act(t, clock.iid); // 1ダメージ → 3ダメージ
    expect(names(t, opp)).toEqual([]);
  });

  it("旧き天書・リアントース: 信仰はデッキに入れると付き、自分のアミュレットが破壊されると+1。ターン終了時に10払って『天書の深淵』", () => {
    const { s, me } = setup({ deck: ["旧き天書・リアントース"] });
    expect(pext(s, me).faith?.value).toBe(0);
    const clock = toBoard(s, me, "無欠の時計");
    let t = act(s, clock.iid);
    expect(pext(t, me).faith?.value).toBe(1);
    // 9 では働かない
    pext(t, me).faith!.value = 9;
    toBoard(t, me, "旧き天書・リアントース");
    let u = applyAction(t, { type: "endTurn" });
    expect(handNames(u, me)).not.toContain("天書の深淵");
    expect(pext(u, me).faith?.value).toBe(9);
    pext(t, me).faith!.value = 10;
    u = applyAction(t, { type: "endTurn" });
    expect(handNames(u, me)).toContain("天書の深淵");
    expect(pext(u, me).faith?.value).toBe(0);
  });

  it("旧き天書・リアントース: 信仰を持つカードがデッキに無ければ信仰は付かない", () => {
    const { s, me } = setup();
    expect(pext(s, me).faith).toBeNull();
  });

  it("旧き天書・リアントース: ファンファーレで場の他のカード3枚を選んで破壊", () => {
    const { s, me, opp } = setup();
    const mine = toBoard(s, me, "神紋ユラティオ");
    const keep = toBoard(s, me, "清純なる白狐");
    const e1 = toBoard(s, opp, "燃え滾る闘志・フェザー");
    const e2 = toBoard(s, opp, "燃え滾る闘志・フェザー");
    const t = play(s, toHand(s, me, "旧き天書・リアントース"), [mine.iid, e1.iid, e2.iid]);
    expect(names(t, opp)).toEqual([]);
    expect(board(t, me).map((c) => c.iid)).toContain(keep.iid);
    expect(names(t, me)).not.toContain("神紋ユラティオ");
  });

  it("天書の深淵: 自分のアミュレットを選んだら相手のリーダーに2ダメージで手札に戻る。相手のカードなら破壊だけ", () => {
    const { s, me, opp } = setup();
    const a = toBoard(s, me, "神紋ユラティオ");
    const e = toBoard(s, opp, "燃え滾る闘志・フェザー");
    let t = play(s, toHand(s, me, "天書の深淵"), [a.iid]);
    expect(t.players[opp].leaderHp).toBe(18);
    expect(handNames(t, me)).toEqual(["天書の深淵"]);
    t = play(t, t.players[me].hand[0]!.iid); // 候補は1枚なので自動で選ぶ
    expect(names(t, opp)).toEqual([]);
    expect(handNames(t, me)).toEqual([]);
    expect(t.players[opp].leaderHp).toBe(18);
  });
});

describe("回復・ドローで誘発", () => {
  it("威徳の至聖・条規の構成員・誓言の幹部: 自分のターンに自分のリーダーが回復すると働く", () => {
    const { s, me, opp } = setup();
    const k = toBoard(s, me, "条規の構成員");
    toBoard(s, me, "誓言の幹部");
    toBoard(s, opp, "燃え滾る闘志・フェザー");
    s.players[me].leaderHp = 10;
    const t = play(s, toHand(s, me, "威徳の至聖"));
    expect(t.players[me].leaderHp).toBe(11);
    expect(follower(t, k.iid)?.evolve).toBe("evolved");
    expect(names(t, opp)).toEqual([]);
    expect(names(t, me)).toEqual(["条規の構成員", "誓言の幹部", "威徳の至聖", "清純なる白狐"]);
  });

  it("威徳の至聖: リーダーの体力が最大なら回復しないので誘発しない", () => {
    const { s, me } = setup();
    const t = play(s, toHand(s, me, "威徳の至聖"));
    expect(names(t, me)).toEqual(["威徳の至聖"]);
  });

  it("威徳の至聖: 回復のたびに働く（1ターン1回の制限なし）。超進化では【進化時】と【超進化時】で2回", () => {
    const { s, me } = setup({ turn: 10 });
    const f = toBoard(s, me, "威徳の至聖");
    s.players[me].leaderHp = 10;
    const t = applyAction(s, { type: "superEvolve", iid: f.iid });
    expect(t.players[me].leaderHp).toBe(12);
    expect(names(t, me)).toEqual(["威徳の至聖", "清純なる白狐", "清純なる白狐"]);
  });

  it("結びの使徒・窮鼠の斎女: 自分のターンにカードを引くと働く", () => {
    const { s, me, opp } = setup();
    toBoard(s, me, "窮鼠の斎女");
    const e = toBoard(s, opp, "燃え滾る闘志・フェザー");
    const t = play(s, toHand(s, me, "結びの使徒")); // エンハンス_4
    const m = board(t, me).find((c) => c.cardId === rid("結びの使徒"))!;
    expect(t.players[me].pp).toBe(6);
    expect(m.keywords).toContain("bane");
    expect(m.keywords).toContain("rush");
    expect(follower(t, e.iid)?.defense).toBe(3);
  });

  it("結びの使徒: エンハンスなしでは引かず、相手のターンのドローでは突進を持たない", () => {
    const { s, me } = setup();
    s.players[me].pp = 1;
    const t = play(s, toHand(s, me, "結びの使徒"));
    const m = board(t, me)[0]!;
    expect(m.keywords).not.toContain("bane");
    expect(m.keywords).not.toContain("rush");
    expect(t.players[me].hand.length).toBe(0);
  });

  it("霧巻花・クキシロ: クレストで、コスト1・3・5を引くと自分の場、コスト2・4・6を引くと相手の場に白狐かファルコン", () => {
    const { s, me, opp } = setup();
    toDeckTop(s, me, "条規の構成員"); // コスト2
    toDeckTop(s, me, "結びの使徒"); // コスト1
    const t = play(s, toHand(s, me, "霧巻花・クキシロ"));
    expect(t.players[me].crests.length).toBe(1);
    expect(handNames(t, me).sort()).toEqual(["条規の構成員", "結びの使徒"].sort());
    const tokens = ["清純なる白狐", "ホーリーファルコン"];
    expect(names(t, me).length).toBe(2);
    expect(tokens).toContain(names(t, me)[1]);
    expect(names(t, opp).length).toBe(1);
    expect(tokens).toContain(names(t, opp)[0]);
  });

  it("霧巻花の激憤・堅固なる霧巻花: 手札をランダムにデッキに戻して引く", () => {
    const { s, me, opp } = setup();
    toHand(s, me, "清純なる白狐");
    let t = play(s, toHand(s, me, "霧巻花の激憤"));
    expect(t.players[me].hand.length).toBe(3);
    const e = toBoard(t, opp, "燃え滾る闘志・フェザー");
    t = play(t, toHand(t, me, "堅固なる霧巻花")); // 候補は1枚なので自動で選ぶ
    expect(e.iid).toBeGreaterThan(0);
    expect(names(t, opp)).toEqual([]);
    t = act(t, board(t, me)[0]!.iid);
    expect(t.players[me].hand.length).toBe(3);
  });
});

describe("フォロワー", () => {
  it("英雄幻視・トルー・魔杖の外科医・ティコ: 自分がアミュレットをアクトすると働く", () => {
    const { s, me } = setup();
    const tru = toBoard(s, me, "英雄幻視・トルー");
    toBoard(s, me, "魔杖の外科医・ティコ");
    const clock = toBoard(s, me, "無欠の時計");
    s.players[me].leaderHp = 10;
    const t = act(s, clock.iid);
    expect(follower(t, tru.iid)?.keywords).toContain("drain");
    expect(t.players[me].leaderHp).toBe(11);
  });

  it("清く正しい修道女・ラムレッダ: 進化時は攻撃できず、ターン終了時に進化後なら場のフォロワーすべてに2ダメージ", () => {
    const { s, me, opp } = setup({ turn: 10 });
    const r = toBoard(s, me, "清く正しい修道女・ラムレッダ");
    const e = toBoard(s, opp, "燃え滾る闘志・フェザー");
    let t = applyAction(s, { type: "evolve", iid: r.iid });
    expect(can(t, { type: "attack", attacker: r.iid, target: e.iid })).toBe(false);
    t = applyAction(t, { type: "endTurn" });
    expect(follower(t, e.iid)?.defense).toBe(2);
    expect(follower(t, r.iid)?.defense).toBe(4);
  });

  it("砂神の巫女・サラ: エンハンス_6で+0/+10。進化時にダメージを受けている相手のフォロワーを破壊", () => {
    const { s, me, opp } = setup({ turn: 10 });
    let t = play(s, toHand(s, me, "砂神の巫女・サラ"));
    const sara = board(t, me)[0]!;
    expect(follower(t, sara.iid)?.defense).toBe(15);
    const hurt = toBoard(t, opp, "燃え滾る闘志・フェザー", { defense: 2 });
    toBoard(t, opp, "燃え滾る闘志・フェザー");
    t = applyAction(t, { type: "evolve", iid: sara.iid });
    expect(follower(t, hurt.iid)).toBeUndefined();
    expect(names(t, opp).length).toBe(1);
  });

  it("ゼエン教の僧侶・ソフィア: デッキのコスト2以下のビショップ・フォロワーを出す。超進化時に他のフォロワーはバリア", () => {
    const { s, me } = setup({ deck: ["条規の構成員"], turn: 10 });
    let t = play(s, toHand(s, me, "ゼエン教の僧侶・ソフィア"));
    expect(names(t, me)).toEqual(["ゼエン教の僧侶・ソフィア", "条規の構成員"]);
    const so = board(t, me)[0]!;
    t = applyAction(t, { type: "superEvolve", iid: so.iid });
    expect(board(t, me)[1]?.keywords).toContain("barrier");
    expect(board(t, me)[0]?.keywords).not.toContain("barrier");
  });

  it("土の理・ガレヲン: 攻撃できない。超進化可能ターンのターン終了時に攻撃していない進化前のフォロワーが進化", () => {
    const { s, me, opp } = setup({ turn: 10 });
    const g = toBoard(s, me, "土の理・ガレヲン");
    toBoard(s, opp, "燃え滾る闘志・フェザー");
    expect(can(s, { type: "attack", attacker: g.iid, target: "leader" })).toBe(false);
    const t = applyAction(s, { type: "endTurn" });
    expect(follower(t, g.iid)?.evolve).toBe("evolved");
  });

  it("土の理・ガレヲン: 超進化可能ターンでなければ進化しない", () => {
    const { s, me } = setup({ turn: 3 });
    const g = toBoard(s, me, "土の理・ガレヲン");
    const t = applyAction(s, { type: "endTurn" });
    expect(follower(t, g.iid)?.evolve).toBe("none");
  });

  it("威容なる星晶騎士・ヴィーラ: 相手のフォロワー2枚を消滅、解放奥義なら超進化", () => {
    for (const [turn, evolve] of [
      [15, "superEvolved"],
      [5, "none"],
    ] as const) {
      const { s, me, opp } = setup({ turn });
      toBoard(s, opp, "燃え滾る闘志・フェザー");
      toBoard(s, opp, "燃え滾る闘志・フェザー");
      const t = play(s, toHand(s, me, "威容なる星晶騎士・ヴィーラ"));
      expect(names(t, opp)).toEqual([]);
      expect(t.players[opp].graveyard).toBe(0);
      expect((board(t, me)[0] as { evolve: string }).evolve).toBe(evolve);
    }
  });

  it("想う《力》・ソフィーナ: （2）で他の守護の進化前のフォロワーを進化+1/+1。（1）で進化し、ターン終了時に他のフォロワーすべて-1/-1", () => {
    {
      const { s, me } = setup();
      const w = toBoard(s, me, "清純なる白狐");
      const t = play(s, toHand(s, me, "想う《力》・ソフィーナ"), 1);
      expect(follower(t, w.iid)?.evolve).toBe("evolved");
      expect(follower(t, w.iid)?.attack).toBe(4);
      expect(follower(t, w.iid)?.defense).toBe(6);
    }
    {
      const { s, me, opp } = setup();
      const w = toBoard(s, me, "清純なる白狐");
      const e = toBoard(s, opp, "燃え滾る闘志・フェザー");
      let t = play(s, toHand(s, me, "想う《力》・ソフィーナ"), 0);
      const so = board(t, me)[1]!;
      expect(follower(t, so.iid)?.evolve).toBe("evolved");
      t = applyAction(t, { type: "endTurn" });
      expect(follower(t, w.iid)?.defense).toBe(2);
      expect(follower(t, e.iid)?.attack).toBe(4);
      expect(follower(t, so.iid)?.defense).toBe(4);
    }
  });

  it("営利の支援者・ホーリープランナー・伝達の聖鳥・審理の守衛: 自分の場のアミュレットが3枚以上なら", () => {
    for (const amulets of [2, 3]) {
      const { s, me, opp } = setup();
      for (let i = 0; i < amulets; i++) toBoard(s, me, "神紋ユラティオ");
      const e = toBoard(s, opp, "燃え滾る闘志・フェザー");
      s.players[me].leaderHp = 10;
      let t = play(s, toHand(s, me, "審理の守衛"));
      const g = board(t, me)[amulets]!;
      expect(follower(t, g.iid)?.evolve).toBe(amulets >= 3 ? "evolved" : "none");
      expect(g.keywords.includes("barrier")).toBe(amulets >= 3);
      t.players[me].pp = 10;
      t = play(t, toHand(t, me, "ホーリープランナー"));
      expect(follower(t, e.iid) === undefined).toBe(amulets >= 3);
      t.players[me].pp = 10;
      if (amulets < 3) {
        t = play(t, toHand(t, me, "伝達の聖鳥"));
        expect(names(t, opp)).toEqual([]);
        expect(t.players[me].leaderHp).toBe(10);
      }
    }
    const { s, me } = setup();
    for (let i = 0; i < 3; i++) toBoard(s, me, "神紋ユラティオ");
    const t = play(s, toHand(s, me, "営利の支援者"));
    expect(names(t, me).filter((n) => n === "営利の支援者").length).toBe(2);
  });

  it("裁神のアナテマ・ロデオ・月影の指輪: 指輪はアミュレット3枚以上でターン終了時に相手のフォロワーとリーダーに3ダメージ。進化時にカウント+1", () => {
    const { s, me, opp } = setup({ turn: 10 });
    toBoard(s, me, "神紋ユラティオ");
    toBoard(s, me, "神紋ユラティオ");
    const e = toBoard(s, opp, "燃え滾る闘志・フェザー");
    let t = play(s, toHand(s, me, "裁神のアナテマ・ロデオ"));
    const ring = board(t, me).find((c) => c.cardId === rid("月影の指輪")) as AmuletOnBoard;
    expect(ring.countdown).toBe(1);
    const rodeo = board(t, me).find((c) => c.cardId === rid("裁神のアナテマ・ロデオ"))!;
    t = applyAction(t, { type: "evolve", iid: rodeo.iid });
    expect(amulet(t, ring.iid)?.countdown).toBe(2);
    t = applyAction(t, { type: "endTurn" });
    expect(t.players[opp].leaderHp).toBe(17);
    expect(follower(t, e.iid)?.defense).toBe(1);
  });

  it("ブロードミッショナリー: アミュレット2枚を引き、進化時に手札のアミュレットの枚数ダメージ", () => {
    const { s, me, opp } = setup({ deck: ["神紋ユラティオ", "無欠の時計"], turn: 10 });
    let t = play(s, toHand(s, me, "ブロードミッショナリー"));
    expect(handNames(t, me).sort()).toEqual(["無欠の時計", "神紋ユラティオ"].sort());
    toHand(t, me, "汚濁の聖水");
    const e = toBoard(t, opp, "燃え滾る闘志・フェザー");
    t = applyAction(t, { type: "evolve", iid: board(t, me)[0]!.iid });
    expect(follower(t, e.iid)?.defense).toBe(1);
  });

  it("天書授与: デッキからアミュレット2枚を引く", () => {
    const { s, me } = setup({ deck: ["神紋ユラティオ", "無欠の時計"] });
    const t = play(s, toHand(s, me, "天書授与"));
    expect(handNames(t, me).sort()).toEqual(["無欠の時計", "神紋ユラティオ"].sort());
  });

  it("アドアマネージャー・イニシア: 消滅させ、アミュレット3枚以上なら3回復。超進化時も同じ", () => {
    const { s, me, opp } = setup({ turn: 10 });
    for (let i = 0; i < 3; i++) toBoard(s, me, "神紋ユラティオ");
    toBoard(s, opp, "燃え滾る闘志・フェザー");
    s.players[me].leaderHp = 10;
    let t = play(s, toHand(s, me, "アドアマネージャー・イニシア"));
    expect(names(t, opp)).toEqual([]);
    expect(t.players[me].leaderHp).toBe(13);
    toBoard(t, opp, "燃え滾る闘志・フェザー");
    t = applyAction(t, { type: "superEvolve", iid: board(t, me)[3]!.iid });
    expect(names(t, opp)).toEqual([]);
    expect(t.players[me].leaderHp).toBe(16);
  });

  it("図書室の魔女・リリウム: 進化時に相手のフォロワーの能力を失わせて2ダメージ", () => {
    const { s, me, opp } = setup({ turn: 10 });
    const l = toBoard(s, me, "図書室の魔女・リリウム");
    const e = toBoard(s, opp, "清純なる白狐");
    const t = applyAction(s, { type: "evolve", iid: l.iid });
    expect(follower(t, e.iid)?.keywords).not.toContain("ward");
    expect(follower(t, e.iid)?.defense).toBe(1);
  });

  it("エルゴンプリーステス・テレサ: 『癒しのシスター』を出し、それは+2/-2して疾走（ファンファーレは働かない）", () => {
    const { s, me } = setup();
    s.players[me].leaderHp = 10;
    const t = play(s, toHand(s, me, "エルゴンプリーステス・テレサ"));
    const sis = board(t, me)[1]!;
    expect(names(t, me)[1]).toBe("癒しのシスター");
    expect(follower(t, sis.iid)?.attack).toBe(5);
    expect(follower(t, sis.iid)?.defense).toBe(3);
    expect(sis.keywords).toContain("storm");
    expect(t.players[me].leaderHp).toBe(10);
  });

  it("天陽の使徒・エーディット: ラストワードで出たものはラストワードを失う", () => {
    const { s, me } = setup();
    toBoard(s, me, "天陽の使徒・エーディット");
    let t = play(s, toHand(s, me, "神紋ユラティオ"));
    expect(names(t, me)).toEqual(["神紋ユラティオ", "天陽の使徒・エーディット"]);
    expect(bext(board(t, me)[1])?.lostLastWords).toBe(true);
    t.players[me].pp = 10;
    t = play(t, toHand(t, me, "神紋ユラティオ"));
    expect(names(t, me)).toEqual(["神紋ユラティオ", "神紋ユラティオ"]);
  });

  it("アビスリサーチャー・ヴィーチェ: 手札で、自分のフォロワーが超進化するとコスト-3", () => {
    const { s, me } = setup({ turn: 10 });
    const h = toHand(s, me, "アビスリサーチャー・ヴィーチェ");
    const f = toBoard(s, me, "清純なる白狐");
    const t = applyAction(s, { type: "superEvolve", iid: f.iid });
    expect(t.players[me].hand.find((x) => x.iid === h)?.costMod).toBe(-3);
  });

  it("脅威の残滓: 体力3以下を1枚選んで消滅、エンハンス_5ならすべて", () => {
    {
      const { s, me, opp } = setup();
      toBoard(s, opp, "清純なる白狐");
      toBoard(s, opp, "結びの使徒");
      toBoard(s, opp, "燃え滾る闘志・フェザー");
      const t = play(s, toHand(s, me, "脅威の残滓"));
      expect(t.players[me].pp).toBe(5);
      expect(names(t, opp)).toEqual(["燃え滾る闘志・フェザー"]);
    }
    {
      const { s, me, opp } = setup();
      s.players[me].pp = 4;
      const a = toBoard(s, opp, "清純なる白狐");
      toBoard(s, opp, "結びの使徒");
      const t = play(s, toHand(s, me, "脅威の残滓"), [a.iid]);
      expect(names(t, opp)).toEqual(["結びの使徒"]);
    }
  });

  it("セイントエクソシスト・コレット: 進化後のフォロワーがいれば進化し、進化したとき1ダメージを2回", () => {
    const { s, me, opp } = setup();
    toBoard(s, me, "清純なる白狐", { evolve: "evolved" });
    const e = toBoard(s, opp, "燃え滾る闘志・フェザー");
    const t = play(s, toHand(s, me, "セイントエクソシスト・コレット"));
    expect(follower(t, board(t, me)[1]!.iid)?.evolve).toBe("evolved");
    expect(follower(t, e.iid)?.defense).toBe(2);
  });

  it("飛躍の姉妹・ベルディリア＆カステル: デッキのコスト2以下のフォロワーを出して超進化させる", () => {
    const { s, me } = setup({ deck: ["条規の構成員"], turn: 10 });
    const old = toBoard(s, me, "清純なる白狐");
    const t = play(s, toHand(s, me, "飛躍の姉妹・ベルディリア＆カステル"));
    expect(names(t, me)).toEqual(["清純なる白狐", "飛躍の姉妹・ベルディリア＆カステル", "条規の構成員"]);
    expect((board(t, me)[2] as { evolve: string }).evolve).toBe("superEvolved");
    expect(follower(t, old.iid)?.evolve).toBe("none");
    expect((board(t, me)[1] as { evolve: string }).evolve).toBe("none");
    expect(t.players[me].crests.length).toBe(0); // クレストは超進化時
  });

  it("クレスト：飛躍の姉妹: 超進化後のフォロワーがフォロワーを攻撃するとき、2回攻撃できる", () => {
    const { s, me, opp } = setup({ turn: 10 });
    const sis = toBoard(s, me, "飛躍の姉妹・ベルディリア＆カステル");
    const a = toBoard(s, me, "清純なる白狐", { evolve: "superEvolved", attack: 5, defense: 9, maxDefense: 9 });
    const e1 = toBoard(s, opp, "結びの使徒");
    const e2 = toBoard(s, opp, "結びの使徒");
    let t = applyAction(s, { type: "superEvolve", iid: sis.iid });
    expect(t.players[me].crests.length).toBe(1);
    t = applyAction(t, { type: "attack", attacker: a.iid, target: e1.iid });
    expect(can(t, { type: "attack", attacker: a.iid, target: e2.iid })).toBe(true);
    // リーダーへの攻撃では持たない
    const u = applyAction(applyAction(s, { type: "superEvolve", iid: sis.iid }), { type: "attack", attacker: a.iid, target: "leader" });
    expect(can(u, { type: "attack", attacker: a.iid, target: e2.iid })).toBe(false);
  });

  it("希望の光彩・リテュエル: モードの後にこれに3ダメージ。進化時のクレストは次のターンに進化した『リテュエル』を出す", () => {
    const { s, me, opp } = setup({ turn: 10 });
    let t = play(s, toHand(s, me, "希望の光彩・リテュエル"), 1);
    expect(t.players[opp].leaderHp).toBe(17);
    const r = board(t, me)[0]!;
    expect(follower(t, r.iid)?.defense).toBe(1);
    t = applyAction(t, { type: "evolve", iid: r.iid });
    expect(t.players[me].crests.length).toBe(1);
    t = passTurns(t, 1);
    expect(t.players[me].crests.length).toBe(0);
    expect(names(t, me)).toEqual(["希望の光彩・リテュエル", "希望の光彩・リテュエル"]);
    expect((board(t, me)[1] as { evolve: string }).evolve).toBe("evolved");
  });

  it("紀律の諜報員: 相手のターン終了まで潜伏。ターン終了時に1回復", () => {
    const { s, me } = setup();
    s.players[me].leaderHp = 10;
    let t = play(s, toHand(s, me, "紀律の諜報員"));
    expect(bext(board(t, me)[0])?.timedKeywords).toContain("ambush");
    t = applyAction(t, { type: "endTurn" });
    expect(t.players[me].leaderHp).toBe(11);
  });

  it("刻みし約束: 元のコスト6以上のカードが自分の場にあれば両方、無ければモードを選ぶ", () => {
    {
      const { s, me, opp } = setup();
      toBoard(s, me, "神紋ユラティオ");
      const e = toBoard(s, opp, "燃え滾る闘志・フェザー");
      s.players[me].leaderHp = 10;
      const t = play(s, toHand(s, me, "刻みし約束"));
      expect(follower(t, e.iid)?.defense).toBe(1);
      expect(t.players[me].leaderHp).toBe(12);
    }
    {
      const { s, me } = setup();
      const t = applyAction(s, { type: "play", iid: toHand(s, me, "刻みし約束") });
      expect(t.pending?.kind).toBe("mode");
    }
  });

  it("イムーバブルパラディン・ペリュトン: 同名のカードを出す", () => {
    let { s, me } = setup();
    let t = play(s, toHand(s, me, "イムーバブルパラディン"));
    expect(names(t, me).length).toBe(4);
    ({ s, me } = setup());
    t = play(s, toHand(s, me, "ペリュトン"));
    expect(names(t, me)).toEqual(["ペリュトン", "ペリュトン", "ペリュトン"]);
  });

  it("神紋の咎人・エルラーデ: 進化時のクレストは、元のコスト6以上のカードがあればターン終了時に1ダメージと1回復", () => {
    const { s, me, opp } = setup({ turn: 10 });
    const el = toBoard(s, me, "神紋の咎人・エルラーデ");
    s.players[me].leaderHp = 10;
    let t = applyAction(s, { type: "evolve", iid: el.iid });
    expect(t.players[me].crests.length).toBe(1);
    t = applyAction(t, { type: "endTurn" });
    expect(t.players[opp].leaderHp).toBe(19);
    expect(t.players[me].leaderHp).toBe(11);
  });

  it("救済の聖典: ラストワードで2枚引き、2ダメージ、2回復", () => {
    const { s, me, opp } = setup();
    toBoard(s, me, "救済の聖典");
    const e = toBoard(s, opp, "燃え滾る闘志・フェザー");
    s.players[me].leaderHp = 10;
    const t = play(s, toHand(s, me, "神紋ユラティオ")); // フォロワーだけ破壊するのでアミュレットは残る
    expect(names(t, me)).toContain("救済の聖典");
    expect(follower(t, e.iid)).toBeUndefined();
    const u = passTurns(s, 4);
    expect(names(u, me)).toEqual([]);
    expect(u.players[me].leaderHp).toBe(12);
  });
});

// ---- 第10弾「ニーゲルヘリア神殺事件」 ----

const RABBIT = "地害の兎";
const FEATHER = "燃え滾る闘志・フェザー";
const evolveOf = (s: GameState, iid: number | undefined) => (iid === undefined ? undefined : follower(s, iid)?.evolve);
const rabbits = (s: GameState, p: PlayerIndex) => board(s, p).filter((c) => c.cardId === rid(RABBIT));

describe("第10弾", () => {
  // エンジンの消滅（banish）は手札のカードに働かない（場・デッキ・クレストだけ）ので、地害の兎は unimplemented。
  // エンジンが手札のカードの消滅に対応したら skip を外す
  it("地害の兎: 場に出たとき、手札のコスト最小のカードを消滅させる（『地害の兎』2枚ならそれぞれが1枚ずつ）", () => {
    {
      const { s, me } = setup();
      toHand(s, me, "地害の矯正者"); // コスト8
      toHand(s, me, "神域の物証"); // コスト1
      const grave = s.players[me].graveyard;
      const t = play(s, toHand(s, me, "不毛の証言"), 1); // （2）『地害の兎』を出す
      expect(handNames(t, me)).toEqual(["地害の矯正者"]);
      expect(t.players[me].graveyard).toBe(grave + 1); // 墓場に行くのはプレイしたスペルだけ（消滅したカードは行かない）
    }
    {
      const { s, me } = setup();
      s.players[me].pp = 5;
      toHand(s, me, "地害の矯正者");
      toHand(s, me, "神域の物証");
      toHand(s, me, "神域の物証");
      const t = play(s, toHand(s, me, "荒廃の繁殖"));
      expect(handNames(t, me)).toEqual(["地害の矯正者"]);
    }
  });

  it("地害の兎: 場に出たとき、これは進化する（手札があってもなくても）。ラストワードで相手のリーダーに2ダメージ", () => {
    {
      const { s, me } = setup();
      toHand(s, me, "神域の物証");
      const t = play(s, toHand(s, me, "不毛の証言"), 1);
      expect(rabbits(t, me)).toHaveLength(1);
      expect(evolveOf(t, rabbits(t, me)[0]?.iid)).toBe("evolved");
    }
    const { s, me, opp } = setup();
    let t = play(s, toHand(s, me, "不毛の証言"), 1);
    expect(evolveOf(t, rabbits(t, me)[0]?.iid)).toBe("evolved");
    t.players[me].pp = 10;
    t = play(t, toHand(t, me, "神紋ユラティオ")); // 場のフォロワーすべてを破壊
    expect(rabbits(t, me)).toHaveLength(0);
    expect(t.players[opp].leaderHp).toBe(18);
  });

  it("荒廃の繁殖: 『地害の兎』2枚を出し（それぞれ進化する）、エンハンス_8なら4枚", () => {
    {
      const { s, me } = setup();
      s.players[me].pp = 5;
      const t = play(s, toHand(s, me, "荒廃の繁殖"));
      expect(rabbits(t, me)).toHaveLength(2);
      expect(rabbits(t, me).every((c) => evolveOf(t, c.iid) === "evolved")).toBe(true);
    }
    {
      const { s, me } = setup();
      const t = play(s, toHand(s, me, "荒廃の繁殖"));
      expect(rabbits(t, me)).toHaveLength(4);
    }
  });

  it("地害の加工人: ラストワードで『神域の物証』2枚を手札に加える", () => {
    const { s, me } = setup();
    toBoard(s, me, "地害の加工人");
    const t = play(s, toHand(s, me, "神紋ユラティオ"));
    expect(handNames(t, me)).toEqual(["神域の物証", "神域の物証"]);
  });

  it("孤高なる鍛錬: 自分のフォロワーを選んで+2/+2とバリア。自分のフォロワーがいなければプレイできない", () => {
    const { s, me } = setup();
    const spellIid = toHand(s, me, "孤高なる鍛錬");
    expect(can(s, { type: "play", iid: spellIid })).toBe(false);
    const a = toBoard(s, me, "清純なる白狐");
    const b = toBoard(s, me, FEATHER);
    let t = applyAction(s, { type: "play", iid: spellIid });
    expect(t.pending?.kind).toBe("choose");
    t = applyAction(t, { type: "choose", targets: [a.iid] });
    expect(follower(t, a.iid)?.attack).toBe(3);
    expect(follower(t, a.iid)?.defense).toBe(5);
    expect(follower(t, a.iid)?.keywords).toContain("barrier");
    expect(follower(t, b.iid)?.attack).toBe(5);
  });

  it("地害の調教師: ファンファーレで『地害の兎』を手札に加え、進化時にPPを1回復", () => {
    const { s, me } = setup({ turn: 10 });
    const iid = toHand(s, me, "地害の調教師");
    let t = play(s, iid);
    expect(handNames(t, me)).toEqual([RABBIT]);
    expect(t.players[me].pp).toBe(7);
    t = applyAction(t, { type: "evolve", iid });
    expect(t.players[me].pp).toBe(8);
  });

  it("不毛の証言: （1）相手のフォロワーからランダム1枚に4ダメージ。クレストは2回のターン開始時に1回復して『神域の物証』を手札に", () => {
    const { s, me, opp } = setup();
    const e = toBoard(s, opp, FEATHER);
    s.players[me].leaderHp = 10;
    let t = play(s, toHand(s, me, "不毛の証言"), 0);
    expect(follower(t, e.iid)).toBeUndefined();
    expect(t.players[me].crests.map((c) => c.countdown)).toEqual([2]);
    t = passTurns(t, 1);
    expect(t.players[me].leaderHp).toBe(11);
    expect(handNames(t, me).filter((n) => n === "神域の物証")).toHaveLength(1);
    expect(t.players[me].crests.map((c) => c.countdown)).toEqual([1]);
    t = passTurns(t, 1);
    expect(t.players[me].leaderHp).toBe(12);
    expect(handNames(t, me).filter((n) => n === "神域の物証")).toHaveLength(2);
    expect(t.players[me].crests).toEqual([]);
  });

  it("有翼の奏者: ファンファーレで『ホーリーファルコン』を出し、進化時に自分の他のフォロワーすべては+1/+1", () => {
    const { s, me } = setup({ turn: 10 });
    const iid = toHand(s, me, "有翼の奏者");
    let t = play(s, iid);
    expect(names(t, me)).toEqual(["有翼の奏者", "ホーリーファルコン"]);
    const falcon = board(t, me)[1]!;
    t = applyAction(t, { type: "evolve", iid });
    expect(follower(t, falcon.iid)?.attack).toBe(3);
    expect(follower(t, falcon.iid)?.defense).toBe(3);
    expect(follower(t, iid)?.attack).toBe(3); // これ自身は+1/+1しない（1/1 の進化で 3/3）
  });

  it("地害の三悪・ラピッドハット: 選んだ相手のフォロワーを消滅させ『地害の兎』を出す。進化時のクレストは次のターン開始時に『地害の兎』を出す", () => {
    const { s, me, opp } = setup({ turn: 10 });
    const e = toBoard(s, opp, FEATHER);
    const iid = toHand(s, me, "地害の三悪・ラピッドハット");
    let t = play(s, iid);
    expect(follower(t, e.iid)).toBeUndefined();
    expect(t.players[opp].graveyard).toBe(s.players[opp].graveyard);
    expect(names(t, me)).toEqual(["地害の三悪・ラピッドハット", RABBIT]);
    t = applyAction(t, { type: "evolve", iid });
    expect(t.players[me].crests.map((c) => c.countdown)).toEqual([1]);
    t = passTurns(t, 1);
    expect(rabbits(t, me)).toHaveLength(2);
    expect(t.players[me].crests).toEqual([]);
  });

  it("地害の三悪・ラピッドハット: 超進化ではクレストのカウントが+1されて2になり、2回『地害の兎』を出す", () => {
    const { s, me } = setup({ turn: 10 });
    const h = toBoard(s, me, "地害の三悪・ラピッドハット");
    let t = applyAction(s, { type: "superEvolve", iid: h.iid });
    expect(t.players[me].crests.map((c) => c.countdown)).toEqual([2]);
    t = passTurns(t, 1);
    expect(rabbits(t, me)).toHaveLength(1);
    expect(t.players[me].crests.map((c) => c.countdown)).toEqual([1]);
    t = passTurns(t, 1);
    expect(rabbits(t, me)).toHaveLength(2);
    expect(t.players[me].crests).toEqual([]);
  });

  it("亜教の偶像: 攻撃できない。自分のターンに相手のフォロワーが場で消滅すると、それのコピーを自分の場に出す（進化時の消滅でも）", () => {
    const { s, me, opp } = setup({ turn: 10 });
    const idol = toBoard(s, me, "亜教の偶像");
    const e = toBoard(s, opp, FEATHER, { attack: 9, defense: 9, maxDefense: 9 });
    expect(can(s, { type: "attack", attacker: idol.iid, target: "leader" })).toBe(false);
    const t = applyAction(s, { type: "evolve", iid: idol.iid });
    expect(follower(t, e.iid)).toBeUndefined();
    expect(names(t, me)).toEqual(["亜教の偶像", FEATHER]);
    const c = board(t, me)[1]!;
    expect(follower(t, c.iid)?.attack).toBe(5); // コピーは元のカード（場での強化は写さない）
    expect(follower(t, c.iid)?.defense).toBe(4);
  });

  it("亜教の偶像: 相手のターンに相手のフォロワーが消滅しても、コピーは出ない", () => {
    const { s, me, opp } = setup();
    toBoard(s, me, "亜教の偶像");
    const g = toBoard(s, opp, "ゴースト"); // 持ち主（相手）のターン終了時に消滅する
    const t = passTurns(s, 1);
    expect(follower(t, g.iid)).toBeUndefined();
    expect(names(t, me)).toEqual(["亜教の偶像"]);
  });

  it("亜教の偶像: ラピッドハットのファンファーレで消滅させた相手のフォロワーもコピーする", () => {
    const { s, me, opp } = setup();
    toBoard(s, me, "亜教の偶像");
    toBoard(s, opp, FEATHER);
    const t = play(s, toHand(s, me, "地害の三悪・ラピッドハット"));
    expect(sorted(names(t, me))).toEqual(sorted(["亜教の偶像", "地害の三悪・ラピッドハット", FEATHER, RABBIT]));
  });

  it("闘志の修行僧: 攻撃時に+2/+2とバリアを得てから戦闘する。1ターンに2回攻撃できる", () => {
    const { s, me, opp } = setup();
    const m = toBoard(s, me, "闘志の修行僧");
    let t = applyAction(s, { type: "attack", attacker: m.iid, target: "leader" });
    expect(t.players[opp].leaderHp).toBe(14);
    expect(follower(t, m.iid)?.keywords).toContain("barrier");
    t = applyAction(t, { type: "attack", attacker: m.iid, target: "leader" });
    expect(t.players[opp].leaderHp).toBe(6);
    expect(follower(t, m.iid)?.defense).toBe(8);
  });

  it("地害の矯正者: 選んだ相手のフォロワーを消滅させ『地害の兎』2枚を出す。超進化時に2枚引いて2回復", () => {
    const { s, me, opp } = setup({ turn: 10 });
    const e1 = toBoard(s, opp, FEATHER);
    const e2 = toBoard(s, opp, FEATHER);
    const iid = toHand(s, me, "地害の矯正者");
    let t = applyAction(s, { type: "play", iid });
    expect(t.pending?.kind).toBe("choose");
    t = applyAction(t, { type: "choose", targets: [e1.iid] });
    expect(follower(t, e1.iid)).toBeUndefined();
    expect(follower(t, e2.iid)).toBeDefined();
    expect(rabbits(t, me)).toHaveLength(2);
    t.players[me].leaderHp = 10;
    const hand = t.players[me].hand.length;
    t = applyAction(t, { type: "superEvolve", iid });
    expect(t.players[me].hand.length).toBe(hand + 2);
    expect(t.players[me].leaderHp).toBe(12);
  });
});
