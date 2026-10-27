//! カード・クレストのデータと能力の DSL（src/engine/dsl.ts の移植）。
//!
//! `npm run rust-data` が書き出した `data/engine-data.json` をビルド時に埋め込み、最初に使うときに読み込む。
//! カードID・クレストID・タイプ・スロット名・変数名は読み込み時に小さな整数に置き換える。
//! 読み込んだデータは `'static` に置き（プロセスの終わりまで解放しない）、局面からは参照で指す。

use serde::de::{Deserializer, Error as _};
use serde::Deserialize;
use std::cell::RefCell;
use std::collections::HashMap;
use std::sync::OnceLock;

pub type CardIdx = u16;
pub type CrestIdx = u16;
pub type TribeId = u8;
pub type SlotId = u8;
pub type VarId = u8;

// ---- キーワード ----

/// 常在型のキーワードの集合。TypeScript 版の配列と同じく、加えた順を覚えている
/// （評価関数の足し算の順と、局面の同一判定が配列の順に依る）。
/// bits は集合、seq は加えた順のキーワードの番号＋1 を下位から 4 ビットずつ並べたもの
#[derive(Clone, Copy, PartialEq, Eq, Default, Debug, Hash)]
pub struct Kw {
    bits: u16,
    seq: u64,
}

pub const KEYWORD_NAMES: [&str; 9] = [
    "ward",
    "storm",
    "rush",
    "bane",
    "drain",
    "ambush",
    "intimidate",
    "barrier",
    "aura",
];
pub const WARD: Kw = Kw::one(0);
pub const STORM: Kw = Kw::one(1);
pub const RUSH: Kw = Kw::one(2);
pub const BANE: Kw = Kw::one(3);
pub const DRAIN: Kw = Kw::one(4);
pub const AMBUSH: Kw = Kw::one(5);
pub const INTIMIDATE: Kw = Kw::one(6);
pub const BARRIER: Kw = Kw::one(7);
pub const AURA: Kw = Kw::one(8);

impl Kw {
    pub const EMPTY: Kw = Kw { bits: 0, seq: 0 };
    /// 並び順を含めた値（同じ並びのキーワードなら同じ値）
    #[inline]
    pub fn seq(self) -> u64 {
        self.seq
    }
    pub const fn one(i: u16) -> Kw {
        Kw {
            bits: 1 << i,
            seq: i as u64 + 1,
        }
    }
    #[inline]
    pub fn has(self, k: Kw) -> bool {
        self.bits & k.bits != 0
    }
    #[inline]
    pub fn len(self) -> usize {
        self.bits.count_ones() as usize
    }
    /// k のキーワードのうち無いものを、k の順に後ろへ加える
    #[inline]
    pub fn with(self, k: Kw) -> Kw {
        if k.bits & !self.bits == 0 {
            return self;
        }
        let mut r = self;
        for i in k.iter() {
            if r.bits & (1 << i) == 0 {
                r.seq |= (i as u64 + 1) << (4 * r.len());
                r.bits |= 1 << i;
            }
        }
        r
    }
    /// k のキーワードを除く（残りの順は保つ）
    #[inline]
    pub fn without(self, k: Kw) -> Kw {
        if self.bits & k.bits == 0 {
            return self;
        }
        let mut r = Kw::EMPTY;
        for i in self.iter() {
            if k.bits & (1 << i) == 0 {
                r.seq |= (i as u64 + 1) << (4 * r.len());
                r.bits |= 1 << i;
            }
        }
        r
    }
    pub fn is_empty(self) -> bool {
        self.bits == 0
    }
    /// キーワードの番号（KEYWORD_NAMES の添字）を加えた順に
    #[inline]
    pub fn iter(self) -> impl Iterator<Item = u16> {
        let mut s = self.seq;
        std::iter::from_fn(move || {
            if s == 0 {
                return None;
            }
            let i = (s & 15) as u16 - 1;
            s >>= 4;
            Some(i)
        })
    }
    pub fn names(self) -> Vec<&'static str> {
        self.iter().map(|i| KEYWORD_NAMES[i as usize]).collect()
    }
}

fn kw_from_name(name: &str) -> Option<Kw> {
    KEYWORD_NAMES
        .iter()
        .position(|n| *n == name)
        .map(|i| Kw::one(i as u16))
}

impl<'de> Deserialize<'de> for Kw {
    fn deserialize<D: Deserializer<'de>>(d: D) -> Result<Self, D::Error> {
        #[derive(Deserialize)]
        #[serde(untagged)]
        enum One {
            Name(String),
            List(Vec<String>),
        }
        let names = match One::deserialize(d)? {
            One::Name(n) => vec![n],
            One::List(l) => l,
        };
        let mut k = Kw::EMPTY;
        for n in names {
            k = k.with(
                kw_from_name(&n)
                    .ok_or_else(|| D::Error::custom(format!("未知のキーワード: {n}")))?,
            );
        }
        Ok(k)
    }
}

// ---- 読み込み中の名前の対応表 ----

#[derive(Default)]
struct Interner {
    cards: HashMap<String, CardIdx>,
    crests: HashMap<String, CrestIdx>,
    tribes: Vec<String>,
    slots: Vec<String>,
    vars: Vec<String>,
}

thread_local! {
    static INTERN: RefCell<Interner> = RefCell::new(Interner::default());
}

fn intern(list: &mut Vec<String>, s: &str) -> u8 {
    if let Some(i) = list.iter().position(|x| x == s) {
        return i as u8;
    }
    list.push(s.to_string());
    assert!(list.len() < 256, "名前が多すぎます");
    (list.len() - 1) as u8
}

fn de_card<'de, D: Deserializer<'de>>(d: D) -> Result<CardIdx, D::Error> {
    let s = String::deserialize(d)?;
    INTERN
        .with(|i| i.borrow().cards.get(&s).copied())
        .ok_or_else(|| D::Error::custom(format!("未知のカードID: {s}")))
}

fn de_cards<'de, D: Deserializer<'de>>(d: D) -> Result<Option<Vec<CardIdx>>, D::Error> {
    let v = Option::<Vec<String>>::deserialize(d)?;
    v.map(|list| {
        list.iter()
            .map(|s| {
                INTERN
                    .with(|i| i.borrow().cards.get(s).copied())
                    .ok_or_else(|| D::Error::custom(format!("未知のカードID: {s}")))
            })
            .collect()
    })
    .transpose()
}

fn de_crest<'de, D: Deserializer<'de>>(d: D) -> Result<CrestIdx, D::Error> {
    let s = String::deserialize(d)?;
    INTERN
        .with(|i| i.borrow().crests.get(&s).copied())
        .ok_or_else(|| D::Error::custom(format!("未知のクレストID: {s}")))
}

fn de_opt_card<'de, D: Deserializer<'de>>(d: D) -> Result<Option<CardIdx>, D::Error> {
    let s = Option::<String>::deserialize(d)?;
    s.map(|s| {
        INTERN
            .with(|i| i.borrow().cards.get(&s).copied())
            .ok_or_else(|| D::Error::custom(format!("未知のカードID: {s}")))
    })
    .transpose()
}

fn de_card_list<'de, D: Deserializer<'de>>(d: D) -> Result<Vec<CardIdx>, D::Error> {
    let v = Vec::<String>::deserialize(d)?;
    v.iter()
        .map(|s| {
            INTERN
                .with(|i| i.borrow().cards.get(s).copied())
                .ok_or_else(|| D::Error::custom(format!("未知のカードID: {s}")))
        })
        .collect()
}

fn de_crest_ids<'de, D: Deserializer<'de>>(d: D) -> Result<Option<Vec<CrestIdx>>, D::Error> {
    let v = Option::<Vec<String>>::deserialize(d)?;
    v.map(|list| {
        list.iter()
            .map(|s| {
                INTERN
                    .with(|i| i.borrow().crests.get(s).copied())
                    .ok_or_else(|| D::Error::custom(format!("未知のクレストID: {s}")))
            })
            .collect()
    })
    .transpose()
}

fn de_vars<'de, D: Deserializer<'de>>(d: D) -> Result<Vec<VarId>, D::Error> {
    let v = Vec::<String>::deserialize(d)?;
    Ok(v.iter()
        .map(|s| INTERN.with(|i| intern(&mut i.borrow_mut().vars, s)))
        .collect())
}

fn de_tribe<'de, D: Deserializer<'de>>(d: D) -> Result<Option<TribeId>, D::Error> {
    let s = Option::<String>::deserialize(d)?;
    Ok(s.map(|s| INTERN.with(|i| intern(&mut i.borrow_mut().tribes, &s))))
}

fn de_tribes<'de, D: Deserializer<'de>>(d: D) -> Result<Vec<TribeId>, D::Error> {
    let v = Vec::<String>::deserialize(d)?;
    Ok(v.iter()
        .map(|s| INTERN.with(|i| intern(&mut i.borrow_mut().tribes, s)))
        .collect())
}

fn de_slot<'de, D: Deserializer<'de>>(d: D) -> Result<SlotId, D::Error> {
    let s = String::deserialize(d)?;
    Ok(INTERN.with(|i| intern(&mut i.borrow_mut().slots, &s)))
}

fn de_opt_slot<'de, D: Deserializer<'de>>(d: D) -> Result<Option<SlotId>, D::Error> {
    let s = Option::<String>::deserialize(d)?;
    Ok(s.map(|s| INTERN.with(|i| intern(&mut i.borrow_mut().slots, &s))))
}

fn de_var<'de, D: Deserializer<'de>>(d: D) -> Result<VarId, D::Error> {
    let s = String::deserialize(d)?;
    Ok(INTERN.with(|i| intern(&mut i.borrow_mut().vars, &s)))
}

fn de_opt_var<'de, D: Deserializer<'de>>(d: D) -> Result<Option<VarId>, D::Error> {
    let s = Option::<String>::deserialize(d)?;
    Ok(s.map(|s| INTERN.with(|i| intern(&mut i.borrow_mut().vars, &s))))
}

/// `{ kind: "costOf", slot }` は変数 `cost:<slot>` を読む（discard が書く）
fn de_cost_var<'de, D: Deserializer<'de>>(d: D) -> Result<VarId, D::Error> {
    let s = String::deserialize(d)?;
    Ok(var_id_now(&format!("cost:{s}")))
}

fn var_id_now(name: &str) -> VarId {
    INTERN.with(|i| intern(&mut i.borrow_mut().vars, name))
}

// ---- DSL ----

#[derive(Deserialize, Clone, Copy, PartialEq, Eq, Debug)]
#[serde(rename_all = "camelCase")]
pub enum CardType {
    Follower,
    Spell,
    Amulet,
}

#[derive(Deserialize, Clone, Copy, PartialEq, Eq, Debug)]
#[serde(rename_all = "camelCase")]
pub enum ClassId {
    Neutral,
    Elf,
    Royal,
    Witch,
    Dragon,
    Nightmare,
    Bishop,
    Nemesis,
}

impl ClassId {
    pub fn name(self) -> &'static str {
        match self {
            ClassId::Neutral => "neutral",
            ClassId::Elf => "elf",
            ClassId::Royal => "royal",
            ClassId::Witch => "witch",
            ClassId::Dragon => "dragon",
            ClassId::Nightmare => "nightmare",
            ClassId::Bishop => "bishop",
            ClassId::Nemesis => "nemesis",
        }
    }
}

impl CardType {
    pub fn name(self) -> &'static str {
        match self {
            CardType::Follower => "follower",
            CardType::Spell => "spell",
            CardType::Amulet => "amulet",
        }
    }
}

#[derive(Deserialize, Clone, Copy, PartialEq, Eq, Debug)]
#[serde(rename_all = "camelCase")]
pub enum Side {
    #[serde(rename = "self")]
    Me,
    Opponent,
    Both,
}

#[derive(Deserialize, Clone, Debug, Default, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CardFilter {
    #[serde(rename = "type")]
    pub ctype: Option<CardType>,
    #[serde(default, deserialize_with = "de_tribe")]
    pub tribe: Option<TribeId>,
    pub class: Option<ClassId>,
    #[serde(default, deserialize_with = "de_cards")]
    pub ids: Option<Vec<CardIdx>>,
    pub cost_max: Option<i32>,
    pub cost_eq: Option<Box<Value>>,
    pub defense_max: Option<i32>,
    pub keyword: Option<Kw>,
    #[serde(default)]
    pub not_evolved: bool,
    #[serde(default)]
    pub exclude_self: bool,
    #[serde(default)]
    pub spellboost: bool,
    #[serde(default)]
    pub earth_sigil: bool,
    // ---- ローテーションで足した条件（docs/rules.md 12章） ----
    /// 【証拠】アミュレット（証拠・アミュレット）
    #[serde(default)]
    pub evidence: bool,
    pub cost_min: Option<i32>,
    /// コストがこのいずれか
    pub cost_in: Option<Vec<i32>>,
    pub original_cost_min: Option<i32>,
    pub original_cost_max: Option<i32>,
    pub original_cost_eq: Option<i32>,
    pub original_cost_in: Option<Vec<i32>>,
    /// 元のコストが Value と等しい
    pub original_cost_eq_value: Option<Box<Value>>,
    #[serde(default, deserialize_with = "de_tribe")]
    pub not_tribe: Option<TribeId>,
    /// 進化後（超進化を含む）
    #[serde(default)]
    pub evolved: bool,
    #[serde(default)]
    pub super_evolved: bool,
    /// ダメージを受けている
    #[serde(default)]
    pub damaged: bool,
    /// このターン中に攻撃していない
    #[serde(default)]
    pub not_attacked: bool,
    /// 【ラストワード】を持つ
    #[serde(default)]
    pub has_last_words: bool,
    /// 能力を誘発させたカード（event）を除く
    #[serde(default)]
    pub exclude_event: bool,
    /// スロットのカードを除く（「選んでいない」）
    #[serde(default, deserialize_with = "de_opt_slot")]
    pub not_in_slot: Option<SlotId>,
    /// カードに書かれたキーワード（手札・山札のカードにも使う。keyword は場のカードだけ）
    pub card_keyword: Option<Kw>,
}

#[derive(Deserialize, Clone, Debug, PartialEq)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
pub enum Target {
    This,
    Leader {
        side: Side,
    },
    Board {
        side: Side,
        filter: Option<CardFilter>,
    },
    Hand {
        filter: Option<CardFilter>,
        /// 省略は自分の手札
        side: Option<Side>,
    },
    /// 山札のカード
    Deck {
        side: Option<Side>,
        filter: Option<CardFilter>,
    },
    /// クレスト（ids があればそのクレストだけ）
    Crests {
        side: Side,
        #[serde(default, deserialize_with = "de_crest_ids")]
        ids: Option<Vec<CrestIdx>>,
    },
    /// 左から count 枚（手札は並び順、場は場に出た順）
    Leftmost {
        of: Box<Target>,
        count: i32,
    },
    /// 体力が最小のリーダーすべて
    MinHpLeaders,
    Slot {
        #[serde(deserialize_with = "de_slot")]
        slot: SlotId,
    },
    Event,
    Union {
        of: Vec<Target>,
    },
    MaxAttack {
        of: Box<Target>,
    },
    /// コストが最小のものに絞る（手札は今のコスト、場は元のコスト）
    MinCost {
        of: Box<Target>,
    },
    /// スロットのカード（先頭）と同名のものに絞る
    SameName {
        of: Box<Target>,
        #[serde(deserialize_with = "de_slot")]
        slot: SlotId,
    },
}

#[derive(Deserialize, Clone, Copy, PartialEq, Eq, Debug)]
#[serde(rename_all = "camelCase")]
pub enum Stat {
    Attack,
    Defense,
}

// DSL のデータは読み込み時に一度だけ作るので、列挙の大きさの差は問わない
#[allow(clippy::large_enum_variant)]
#[derive(Deserialize, Clone, Debug, PartialEq)]
#[serde(untagged)]
pub enum Value {
    Num(i32),
    Obj(ValueObj),
}

#[derive(Deserialize, Clone, Debug, PartialEq)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
pub enum ValueObj {
    Var {
        #[serde(deserialize_with = "de_var")]
        name: VarId,
    },
    Count {
        of: Target,
    },
    Combo,
    Sigils,
    ThisAttack,
    CostOf {
        #[serde(deserialize_with = "de_cost_var")]
        slot: VarId,
    },
    ThisX,
    DestroyedThisTurn {
        stat: Stat,
        filter: Option<CardFilter>,
    },
    // ---- ローテーションで足した値（docs/rules.md 12章） ----
    /// スロットのカード（先頭の1枚）の値。場・手札を離れていれば、選んだときのカードの元の値
    SlotStat {
        #[serde(deserialize_with = "de_slot")]
        slot: SlotId,
        stat: CardStat,
    },
    /// 能力を誘発させたカードの値
    EventStat {
        stat: CardStat,
    },
    /// これのコスト（プレイ・捨てたときのコスト。手札にあれば今のコスト）
    ThisCost,
    /// 自分の信仰値
    Faith,
    /// a − b
    Sub {
        a: Box<Value>,
        b: Box<Value>,
    },
    /// このバトル中に場に出た自分のフォロワーのうち条件に合う枚数（filter.excludeSelf ならこれを除く）
    EnteredCount {
        filter: Option<CardFilter>,
    },
    /// 同じく、その種類の数
    EnteredKinds {
        filter: Option<CardFilter>,
    },
    /// 自分の場の証拠の数（無ければ 0）
    Evidence,
    /// これの体力（場のフォロワー。手札にあれば手札の体力）
    ThisDefense,
    /// リーダーの体力の最大値 − 体力
    LeaderMissingHp {
        side: Side,
    },
}

#[derive(Deserialize, Clone, Copy, PartialEq, Eq, Debug)]
#[serde(rename_all = "camelCase")]
pub enum CardStat {
    Attack,
    Defense,
    Cost,
    OriginalCost,
}

#[derive(Deserialize, Clone, Debug, PartialEq)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
pub enum Condition {
    Awakened,
    Combo {
        at_least: i32,
    },
    Enhanced,
    SuperEvolveTurn,
    ThisSuperEvolved,
    HandCount {
        at_most: i32,
    },
    AttackingFollower,
    VarAtLeast {
        #[serde(deserialize_with = "de_var")]
        name: VarId,
        value: i32,
    },
    ThisXAtLeast {
        value: i32,
    },
    MaxPp {
        at_least: i32,
    },
    Not {
        cond: Box<Condition>,
    },
    // ---- ローテーションで足した条件（docs/rules.md 12章） ----
    /// 奥義ゲージが at_least 以上（奥義 10・解放奥義 15）
    Ultimate {
        at_least: i32,
    },
    /// 【連携_N】
    Link {
        at_least: i32,
    },
    /// リーダーの体力が value 以下
    LeaderHpAtMost {
        side: Side,
        value: i32,
    },
    /// 自分のリーダーの体力が相手のリーダーの体力より大きい
    LeaderHpGreater,
    /// これが進化後（超進化を含む）
    ThisEvolved,
    /// 自分のターン中
    OwnTurn,
    /// value が at_least 以上
    ValueAtLeast {
        value: Value,
        at_least: i32,
    },
    /// スロットのカード（選んだときのカード）が条件に合う。own なら自分のカード
    SlotMatches {
        #[serde(deserialize_with = "de_slot")]
        slot: SlotId,
        filter: Option<CardFilter>,
        #[serde(default)]
        own: bool,
    },
    /// 自分のデッキに重複するカードがない
    DeckNoDuplicates,
    /// 直前の自分のターンに自分のフォロワーがリーダーを攻撃していた
    AttackedLeaderLastTurn,
    /// このバトル中に自分がプレイしたカードの元のコストに from〜to がすべて含まれる
    PlayedCostsCover {
        from: i32,
        to: i32,
    },
    /// これのコストが value
    ThisCostEq {
        value: i32,
    },
    /// これに【融合】していた
    Fused,
    /// このバトル中に自分のフォロワーが進化した回数が at_least 以上
    EvolvedCountAtLeast {
        at_least: i32,
    },
    /// 自分の手札に同じコストのカードが at_least 枚以上
    HandSameCostAtLeast {
        at_least: i32,
    },
    /// 自分の手札の元のコストの大きい順に n 枚の合計が、相手の同じ合計より大きい
    HandTopCostGreater {
        n: i32,
    },
    /// エンハンスで at_least 以上の PP を払った
    EnhancedAtLeast {
        at_least: i32,
    },
    And {
        conds: Vec<Condition>,
    },
    /// このターン中に自分がアミュレット（evidence なら証拠・アミュレット）を【アクト】していた
    ActedThisTurn {
        #[serde(default)]
        evidence: bool,
    },
}

#[derive(Deserialize, Clone, Copy, PartialEq, Eq, Debug)]
#[serde(rename_all = "camelCase")]
pub enum Duration {
    Permanent,
    EndOfTurn,
    /// 相手のターン終了まで（キーワード・攻撃できない・リーダーの状態）
    UntilOpponentTurnEnd,
}

/// カードの行き先（copy）
#[derive(Deserialize, Clone, Copy, PartialEq, Eq, Debug)]
#[serde(rename_all = "camelCase")]
pub enum Dest {
    Hand,
    Board,
    Deck,
}

#[derive(Deserialize, Clone, Copy, PartialEq, Eq, Debug)]
#[serde(rename_all = "camelCase")]
pub enum Zone {
    Hand,
    Deck,
    Board,
}

#[derive(Deserialize, Clone, Copy, PartialEq, Eq, Debug)]
#[serde(rename_all = "camelCase")]
pub enum Pick {
    Random,
    Left,
    All,
}

/// copy・transform の元になるカード
#[derive(Deserialize, Clone, Debug, PartialEq)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
pub enum CardSource {
    /// 手札・山札・場のカード
    Zone {
        zone: Zone,
        side: Side,
        filter: Option<CardFilter>,
        pick: Pick,
    },
    /// このバトル中に破壊された自分のカード（filter.type がアミュレットならアミュレット、それ以外はフォロワー）
    Destroyed {
        filter: Option<CardFilter>,
        #[serde(default)]
        highest_cost: bool,
    },
    /// スロットのカード（選んだときのカード）
    Slot {
        #[serde(deserialize_with = "de_slot")]
        slot: SlotId,
    },
    This,
    Event,
    /// 書かれたカードからランダム（1種類なら常にそのカード）
    Cards {
        #[serde(deserialize_with = "de_card_list")]
        ids: Vec<CardIdx>,
    },
}

/// 誘発の種類の名前（triggerOwn）
#[derive(Deserialize, Clone, Copy, PartialEq, Eq, Debug)]
#[serde(rename_all = "camelCase")]
pub enum OwnTrigger {
    Fanfare,
}

#[derive(Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct DamageCap {
    pub at_least: i32,
    pub to: i32,
}

/// アクセラレート・結晶の能力
#[derive(Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct AltPlay {
    pub cost: i32,
    /// 結晶のカウントダウン
    pub countdown: Option<i32>,
    pub abilities: Vec<Ability>,
}

/// 信仰（デッキに入れると付く。abilities は信仰値を増やす条件など）
#[derive(Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct FaithDef {
    pub abilities: Vec<Ability>,
}

#[derive(Deserialize, Clone, Copy, PartialEq, Eq, Debug)]
#[serde(rename_all = "camelCase")]
pub enum EvolveKind {
    Evolve,
    SuperEvolve,
}

#[derive(Deserialize, Clone, Copy, PartialEq, Eq, Debug)]
pub enum MaxTag {
    #[serde(rename = "max")]
    Max,
}

#[allow(clippy::large_enum_variant)]
#[derive(Deserialize, Clone, Debug, PartialEq)]
#[serde(untagged)]
pub enum PpAmount {
    Max(MaxTag),
    Value(Value),
}

#[allow(clippy::large_enum_variant)]
#[derive(Deserialize, Clone, Debug, PartialEq)]
#[serde(
    tag = "op",
    rename_all = "camelCase",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
pub enum Effect {
    Choose {
        #[serde(deserialize_with = "de_slot")]
        slot: SlotId,
        from: Target,
        count: i32,
    },
    Random {
        #[serde(deserialize_with = "de_slot")]
        slot: SlotId,
        from: Target,
        count: Value,
    },
    Mode {
        options: Vec<Vec<Effect>>,
        /// この条件なら選ばずにすべて（（1）から順に）。「2つを選んで」は定義側で組み合わせを選択肢にする
        all_if: Option<Condition>,
    },
    Damage {
        target: Target,
        amount: Value,
    },
    Distribute {
        target: Target,
        amount: Value,
    },
    Destroy {
        target: Target,
        #[serde(default, deserialize_with = "de_opt_var")]
        count_var: Option<VarId>,
    },
    Banish {
        target: Target,
        #[serde(default, deserialize_with = "de_opt_var")]
        count_var: Option<VarId>,
    },
    Bounce {
        target: Target,
    },
    Heal {
        target: Target,
        amount: Value,
    },
    SetDefense {
        target: Target,
        value: i32,
    },
    Draw {
        count: Value,
        filter: Option<CardFilter>,
        /// 引くプレイヤー（省略は自分）
        side: Option<Side>,
        #[serde(default, deserialize_with = "de_opt_slot")]
        slot: Option<SlotId>,
        /// 違う種類を引く
        #[serde(default)]
        kinds: bool,
    },
    DrawAll {
        filter: CardFilter,
        #[serde(default, deserialize_with = "de_opt_slot")]
        slot: Option<SlotId>,
    },
    AddToHand {
        #[serde(deserialize_with = "de_card")]
        card_id: CardIdx,
        count: Value,
        #[serde(default, deserialize_with = "de_opt_slot")]
        slot: Option<SlotId>,
    },
    Summon {
        #[serde(deserialize_with = "de_card")]
        card_id: CardIdx,
        count: Value,
        #[serde(default, deserialize_with = "de_opt_slot")]
        slot: Option<SlotId>,
        /// 出す場（省略は自分の場）
        side: Option<Side>,
    },
    SummonCopy {
        #[serde(deserialize_with = "de_slot")]
        from: SlotId,
        #[serde(default, deserialize_with = "de_opt_slot")]
        slot: Option<SlotId>,
    },
    Reanimate {
        cost: i32,
        #[serde(default, deserialize_with = "de_opt_slot")]
        slot: Option<SlotId>,
    },
    SummonFromDeck {
        filter: CardFilter,
        kinds: i32,
    },
    SummonDestroyedAmulet,
    ReturnToDeck {
        target: Target,
        #[serde(default, deserialize_with = "de_opt_var")]
        count_var: Option<VarId>,
    },
    Discard {
        target: Target,
        #[serde(default, deserialize_with = "de_opt_var")]
        count_var: Option<VarId>,
    },
    Transform {
        target: Target,
        #[serde(default, deserialize_with = "de_opt_card")]
        card_id: Option<CardIdx>,
        /// card_id の代わりに、対象ごとにここからランダムに決めたカード
        from: Option<CardSource>,
    },
    Buff {
        target: Target,
        attack: Value,
        defense: Value,
        duration: Option<Duration>,
    },
    Grant {
        target: Target,
        keywords: Option<Kw>,
        max_attacks: Option<i32>,
        abilities: Option<Vec<Ability>>,
        duration: Option<Duration>,
        /// 「フォロワーやリーダーを攻撃できない」
        #[serde(default)]
        no_attack: bool,
    },
    LoseKeyword {
        target: Target,
        keyword: Kw,
    },
    CannotAttack {
        target: Target,
        #[allow(dead_code)]
        until: String,
    },
    Evolve {
        target: Target,
        kind: EvolveKind,
    },
    Spellboost {
        target: Target,
        times: i32,
    },
    CostChange {
        target: Target,
        amount: i32,
        duration: Option<Duration>,
    },
    AddX {
        target: Target,
        amount: i32,
    },
    Countdown {
        target: Target,
        amount: i32,
    },
    GainPp {
        amount: PpAmount,
    },
    AddMaxPp {
        amount: i32,
    },
    AddCombo {
        amount: i32,
    },
    AddGraveyard {
        amount: i32,
    },
    AddSigils {
        amount: Value,
    },
    EarthRite {
        amount: i32,
        then: Vec<Effect>,
    },
    Necromancy {
        amount: i32,
        then: Vec<Effect>,
    },
    Crest {
        #[serde(deserialize_with = "de_crest")]
        crest_id: CrestIdx,
        side: Side,
    },
    ApocalypseDeck,
    SetLeaderMaxHp {
        side: Side,
        value: i32,
    },
    If {
        cond: Condition,
        then: Vec<Effect>,
        #[serde(rename = "else")]
        otherwise: Option<Vec<Effect>>,
    },
    Repeat {
        times: Value,
        effects: Vec<Effect>,
    },
    SetVar {
        #[serde(deserialize_with = "de_var")]
        name: VarId,
        value: Value,
    },
    // ---- ローテーションで足した効果（docs/rules.md 12章） ----
    /// 下記の能力からランダム count 個（unused なら、このカードでまだ働いていないものから）
    RandomEffects {
        options: Vec<Vec<Effect>>,
        count: i32,
        #[serde(default)]
        unused: bool,
    },
    /// 下記の能力から順に1つ（カードごとに進む）
    CycleEffects {
        options: Vec<Vec<Effect>>,
    },
    /// これ自身の能力（【ファンファーレ】）をもう一度働かせる
    TriggerOwn {
        on: OwnTrigger,
    },
    /// カードを作って手札・場・山札に加える
    Copy {
        from: CardSource,
        count: Value,
        dest: Dest,
        /// 加えるプレイヤー（省略は自分）
        side: Option<Side>,
        /// 違う種類を count 種類
        #[serde(default)]
        kinds: bool,
        #[serde(default, deserialize_with = "de_opt_slot")]
        slot: Option<SlotId>,
        /// 手札に非公開で加える
        #[serde(default)]
        hidden: bool,
    },
    /// コストを value にする
    SetCost {
        target: Target,
        value: i32,
        duration: Option<Duration>,
    },
    /// 能力すべてを失う
    Silence {
        target: Target,
    },
    /// from のキーワードからランダム count 個を持つ
    RandomKeywords {
        target: Target,
        from: Kw,
        count: i32,
    },
    /// 【ラストワード】を失う
    LoseLastWords {
        target: Target,
    },
    GainEp {
        amount: i32,
    },
    GainSep {
        amount: i32,
    },
    /// 手札のカードを（プレイせずに）場に出す
    MoveToBoard {
        target: Target,
    },
    /// これをデッキから場に出す（【直接召喚】）
    DirectSummon,
    /// PP を amount 消費して then（足りなければ働かない）
    PayPp {
        amount: i32,
        then: Vec<Effect>,
    },
    AddFaith {
        amount: i32,
    },
    /// 信仰値を amount 減らして then（足りなければ働かない）
    SpendFaith {
        amount: i32,
        then: Vec<Effect>,
    },
    /// 自分の信仰は能力を持つ
    GrantFaith {
        abilities: Vec<Ability>,
    },
    /// 合計が total になる0以上の整数をランダムに vars に入れる
    SplitRandom {
        total: Value,
        #[serde(deserialize_with = "de_vars")]
        vars: Vec<VarId>,
    },
    /// リーダーの状態（受けるダメージの上限・加算）
    LeaderStatus {
        side: Side,
        cap: Option<DamageCap>,
        plus: Option<i32>,
        duration: Option<Duration>,
    },
    AddLeaderMaxHp {
        side: Side,
        amount: i32,
    },
    /// 手札のカードの奥義ゲージを +amount
    AddGauge {
        target: Target,
        amount: i32,
    },
    // ---- 第10弾で足した効果（docs/rules.md 12章） ----
    /// 自分の場の証拠を amount 減らして then（足りなければ何も起きない。0 になったら破壊）
    SpendEvidence {
        amount: i32,
        #[serde(default)]
        then: Vec<Effect>,
    },
    /// 攻撃力と体力を入れ替える（場のフォロワー・手札のフォロワー）
    SwapStats {
        target: Target,
    },
    /// 攻撃力と体力をこの値にする
    SetStats {
        target: Target,
        attack: Value,
        defense: Value,
    },
    /// リーダーの体力の最大値を半分にする（端数は切り上げ）
    HalveLeaderMaxHp {
        side: Side,
    },
}

impl Effect {
    /// 効果の種類の名前（網羅の確認用）
    pub fn op_name(&self) -> &'static str {
        match self {
            Effect::Choose { .. } => "Choose",
            Effect::Random { .. } => "Random",
            Effect::Mode { .. } => "Mode",
            Effect::Damage { .. } => "Damage",
            Effect::Distribute { .. } => "Distribute",
            Effect::Destroy { .. } => "Destroy",
            Effect::Banish { .. } => "Banish",
            Effect::Bounce { .. } => "Bounce",
            Effect::Heal { .. } => "Heal",
            Effect::SetDefense { .. } => "SetDefense",
            Effect::Draw { .. } => "Draw",
            Effect::DrawAll { .. } => "DrawAll",
            Effect::AddToHand { .. } => "AddToHand",
            Effect::Summon { .. } => "Summon",
            Effect::SummonCopy { .. } => "SummonCopy",
            Effect::Reanimate { .. } => "Reanimate",
            Effect::SummonFromDeck { .. } => "SummonFromDeck",
            Effect::SummonDestroyedAmulet => "SummonDestroyedAmulet",
            Effect::ReturnToDeck { .. } => "ReturnToDeck",
            Effect::Discard { .. } => "Discard",
            Effect::Transform { .. } => "Transform",
            Effect::Buff { .. } => "Buff",
            Effect::Grant { .. } => "Grant",
            Effect::LoseKeyword { .. } => "LoseKeyword",
            Effect::CannotAttack { .. } => "CannotAttack",
            Effect::Evolve { .. } => "Evolve",
            Effect::Spellboost { .. } => "Spellboost",
            Effect::CostChange { .. } => "CostChange",
            Effect::AddX { .. } => "AddX",
            Effect::Countdown { .. } => "Countdown",
            Effect::GainPp { .. } => "GainPp",
            Effect::AddMaxPp { .. } => "AddMaxPp",
            Effect::AddCombo { .. } => "AddCombo",
            Effect::AddGraveyard { .. } => "AddGraveyard",
            Effect::AddSigils { .. } => "AddSigils",
            Effect::EarthRite { .. } => "EarthRite",
            Effect::Necromancy { .. } => "Necromancy",
            Effect::Crest { .. } => "Crest",
            Effect::ApocalypseDeck => "ApocalypseDeck",
            Effect::SetLeaderMaxHp { .. } => "SetLeaderMaxHp",
            Effect::If { .. } => "If",
            Effect::Repeat { .. } => "Repeat",
            Effect::SetVar { .. } => "SetVar",
            Effect::RandomEffects { .. } => "RandomEffects",
            Effect::CycleEffects { .. } => "CycleEffects",
            Effect::TriggerOwn { .. } => "TriggerOwn",
            Effect::Copy { .. } => "Copy",
            Effect::SetCost { .. } => "SetCost",
            Effect::Silence { .. } => "Silence",
            Effect::RandomKeywords { .. } => "RandomKeywords",
            Effect::LoseLastWords { .. } => "LoseLastWords",
            Effect::GainEp { .. } => "GainEp",
            Effect::GainSep { .. } => "GainSep",
            Effect::MoveToBoard { .. } => "MoveToBoard",
            Effect::DirectSummon => "DirectSummon",
            Effect::PayPp { .. } => "PayPp",
            Effect::AddFaith { .. } => "AddFaith",
            Effect::SpendFaith { .. } => "SpendFaith",
            Effect::GrantFaith { .. } => "GrantFaith",
            Effect::SplitRandom { .. } => "SplitRandom",
            Effect::LeaderStatus { .. } => "LeaderStatus",
            Effect::AddLeaderMaxHp { .. } => "AddLeaderMaxHp",
            Effect::AddGauge { .. } => "AddGauge",
            Effect::SpendEvidence { .. } => "SpendEvidence",
            Effect::SwapStats { .. } => "SwapStats",
            Effect::SetStats { .. } => "SetStats",
            Effect::HalveLeaderMaxHp { .. } => "HalveLeaderMaxHp",
        }
    }
}

#[derive(Deserialize, Clone, Copy, PartialEq, Eq, Debug)]
#[serde(rename_all = "camelCase")]
pub enum Whose {
    #[serde(rename = "self")]
    Me,
    Opponent,
}

#[derive(Deserialize, Clone, Debug, PartialEq)]
#[serde(
    tag = "on",
    rename_all = "camelCase",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
pub enum Trigger {
    Fanfare,
    Spell,
    LastWords,
    Evolve,
    SuperEvolve,
    Evolved,
    Attack,
    Clash,
    TurnStart,
    TurnEnd {
        whose: Whose,
    },
    AllyEnter {
        filter: Option<CardFilter>,
    },
    Enter,
    Act {
        cost: i32,
    },
    /// 自分がアミュレットを【アクト】したとき（filter があれば、アクトしたアミュレットがそれに合うときだけ）
    AllyAct {
        filter: Option<CardFilter>,
    },
    Fused,
    /// 自分が融合したとき（filter があれば、素材にそれに合うカードがあるときだけ）
    AllyFuse {
        filter: Option<CardFilter>,
    },
    Spellboost,
    AllyLeaveInHand,
    Discarded,
    /// 自分の（side があればその側の）カードが破壊されたとき。アミュレットは filter.type がアミュレットのときだけ
    AllyDestroyed {
        filter: Option<CardFilter>,
        side: Option<Side>,
    },
    LeaderHealed,
    // ---- ローテーションで足した誘発（docs/rules.md 12章） ----
    /// 自分がカードをプレイしたとき（event はプレイしたカード。filter.type はプレイした形）
    AllyPlay {
        filter: Option<CardFilter>,
        /// 【エンハンス】でプレイしたときだけ
        #[serde(default)]
        enhanced: bool,
    },
    /// 自分のフォロワーが進化したとき（効果による進化・超進化を含む。super_only なら超進化だけ）
    AllyEvolve {
        filter: Option<CardFilter>,
        #[serde(default)]
        super_only: bool,
    },
    /// 相手のフォロワーが場に出たとき
    EnemyEnter {
        filter: Option<CardFilter>,
    },
    /// これの攻撃力か体力が場で+されたとき
    Buffed,
    /// これを引いたとき
    Drawn,
    /// 自分がカードを引いたとき（event は引いたカード）
    AllyDraw {
        filter: Option<CardFilter>,
    },
    /// 自分のフォロワーが攻撃するとき（event は攻撃するフォロワー）
    AllyAttack {
        filter: Option<CardFilter>,
        #[serde(default)]
        leader_only: bool,
        #[serde(default)]
        follower_only: bool,
    },
    /// 相手のフォロワーが攻撃するとき（event は攻撃するフォロワー）
    EnemyAttack {
        filter: Option<CardFilter>,
        #[serde(default)]
        leader_only: bool,
    },
    /// これが超進化したとき（効果による超進化を含む）
    SuperEvolved,
    /// これが【直接召喚】されたとき
    DirectSummoned,
    /// 自分が【土の秘術】したとき
    EarthRite,
    // ---- 第10弾で足した誘発（docs/rules.md 12章） ----
    /// これが場で消滅したとき
    Banished,
    /// 自分の（side があればその側の）カードが場で消滅したとき（event は消滅したカード。これ自身は含まない）
    AllyBanished {
        filter: Option<CardFilter>,
        side: Option<Side>,
    },
}

/// 誘発の種類（Trigger の on だけ）
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum On {
    Fanfare,
    Spell,
    LastWords,
    Evolve,
    SuperEvolve,
    Evolved,
    Attack,
    Clash,
    TurnStart,
    TurnEnd,
    AllyEnter,
    Enter,
    Act,
    AllyAct,
    Fused,
    AllyFuse,
    Spellboost,
    AllyLeaveInHand,
    Discarded,
    AllyDestroyed,
    LeaderHealed,
    AllyPlay,
    AllyEvolve,
    EnemyEnter,
    Buffed,
    Drawn,
    AllyDraw,
    AllyAttack,
    EnemyAttack,
    SuperEvolved,
    DirectSummoned,
    EarthRite,
    Banished,
    AllyBanished,
}

impl Trigger {
    pub fn on(&self) -> On {
        match self {
            Trigger::Fanfare => On::Fanfare,
            Trigger::Spell => On::Spell,
            Trigger::LastWords => On::LastWords,
            Trigger::Evolve => On::Evolve,
            Trigger::SuperEvolve => On::SuperEvolve,
            Trigger::Evolved => On::Evolved,
            Trigger::Attack => On::Attack,
            Trigger::Clash => On::Clash,
            Trigger::TurnStart => On::TurnStart,
            Trigger::TurnEnd { .. } => On::TurnEnd,
            Trigger::AllyEnter { .. } => On::AllyEnter,
            Trigger::Enter => On::Enter,
            Trigger::Act { .. } => On::Act,
            Trigger::AllyAct { .. } => On::AllyAct,
            Trigger::Fused => On::Fused,
            Trigger::AllyFuse { .. } => On::AllyFuse,
            Trigger::Spellboost => On::Spellboost,
            Trigger::AllyLeaveInHand => On::AllyLeaveInHand,
            Trigger::Discarded => On::Discarded,
            Trigger::AllyDestroyed { .. } => On::AllyDestroyed,
            Trigger::LeaderHealed => On::LeaderHealed,
            Trigger::AllyPlay { .. } => On::AllyPlay,
            Trigger::AllyEvolve { .. } => On::AllyEvolve,
            Trigger::EnemyEnter { .. } => On::EnemyEnter,
            Trigger::Buffed => On::Buffed,
            Trigger::Drawn => On::Drawn,
            Trigger::AllyDraw { .. } => On::AllyDraw,
            Trigger::AllyAttack { .. } => On::AllyAttack,
            Trigger::EnemyAttack { .. } => On::EnemyAttack,
            Trigger::SuperEvolved => On::SuperEvolved,
            Trigger::DirectSummoned => On::DirectSummoned,
            Trigger::EarthRite => On::EarthRite,
            Trigger::Banished => On::Banished,
            Trigger::AllyBanished { .. } => On::AllyBanished,
        }
    }
}

#[derive(Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Ability {
    pub trigger: Trigger,
    pub effects: Vec<Effect>,
    #[serde(default)]
    pub once_per_own_turn: bool,
    #[serde(default)]
    pub replaces_evolve: bool,
    /// 「手札で働く」「デッキで働く」能力（場では働かない）
    pub zone: Option<Zone>,
}

#[derive(Deserialize, Clone, Debug, Default, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CardAbilities {
    pub abilities: Vec<Ability>,
    #[serde(default)]
    pub banish_on_leave: bool,
    #[serde(default)]
    pub unplayable: bool,
    #[serde(default)]
    pub only_selectable: bool,
    pub initial_x: Option<i32>,
    pub fusion: Option<CardFilter>,
    #[allow(dead_code)]
    pub unimplemented: Option<String>,
    // ---- ローテーションで足した常在の能力（docs/rules.md 12章） ----
    /// 受ける atLeast 以上のダメージを to にする
    pub damage_cap: Option<DamageCap>,
    /// 能力によって破壊できない
    #[serde(default)]
    pub indestructible: bool,
    /// フォロワーやリーダーを攻撃できない
    #[serde(default)]
    pub cannot_attack: bool,
    /// 【守護】を無視して攻撃できる
    #[serde(default)]
    pub ignore_ward: bool,
    /// （クレスト）自分のフォロワーの【ファンファーレ】や【エンハンス】は働かない
    #[serde(default)]
    pub suppress_fanfare: bool,
    pub accelerate: Option<AltPlay>,
    pub crystallize: Option<AltPlay>,
    pub faith: Option<FaithDef>,
}

// ---- カード ----

#[derive(Deserialize, Debug)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Card {
    pub id: String,
    /// カード名（リノセウス用 AI のルールだけが使う。エンジンは使わない）
    pub name: String,
    #[serde(rename = "type")]
    pub ctype: CardType,
    pub class: ClassId,
    pub cost: i32,
    pub attack: i32,
    pub defense: i32,
    pub countdown: Option<i32>,
    #[serde(deserialize_with = "de_tribes")]
    pub tribes: Vec<TribeId>,
    pub keywords: Kw,
    pub max_attacks: i32,
    pub earth_sigil: bool,
    /// 【証拠】アミュレット（第10弾。docs/rules.md 12章）
    #[serde(default)]
    pub evidence: bool,
    pub enhance: Option<i32>,
    /// 【エンハンス】の値すべて（小さい順。enhance はその最小）
    #[serde(default)]
    pub enhance_levels: Vec<i32>,
    /// デッキに入れられない生成専用カード
    pub token: bool,
    /// スターターのデッキに入れられる（ランダムなデッキ・環境の案はこのカードから作る）
    pub starter: bool,
}

#[derive(Deserialize, Debug)]
#[serde(deny_unknown_fields)]
pub struct CrestData {
    pub id: String,
    pub countdown: Option<i32>,
}

pub struct Deck {
    pub key: String,
    pub name: String,
    pub cards: Vec<CardIdx>,
}

pub struct Data {
    pub cards: Vec<Card>,
    /// カードの添字ごとの能力（定義が無ければ空）
    pub abilities: Vec<CardAbilities>,
    pub crests: Vec<CrestData>,
    pub crest_abilities: Vec<Option<CardAbilities>>,
    pub apocalypse_deck: Vec<(CardIdx, i32)>,
    pub decks: Vec<Deck>,
    pub tribe_names: Vec<String>,
    pub slot_names: Vec<String>,
    pub var_names: Vec<String>,
    pub card_by_id: HashMap<String, CardIdx>,
    /// 大地の魔片（【土の印】のトークン）
    pub earth_sigil_token: CardIdx,
    pub var_fused_cost: VarId,
    pub var_fused_kinds: VarId,
    /// カードごと: 「手札で働く」「デッキで働く」能力を持つか、奥義ゲージを使うか（docs/rules.md 12章）
    pub zone_hand: Vec<bool>,
    pub zone_deck: Vec<bool>,
    pub uses_gauge: Vec<bool>,
    /// 「これに【融合】していた」を使う
    pub uses_fused: Vec<bool>,
}

fn cond_has(c: &Condition, pred: fn(&Condition) -> bool) -> bool {
    pred(c)
        || match c {
            Condition::Not { cond } => cond_has(cond, pred),
            Condition::And { conds } => conds.iter().any(|x| cond_has(x, pred)),
            _ => false,
        }
}

/// 効果の並び（入れ子を含む）に pred に合う条件があるか
fn effects_have_cond(list: &[Effect], pred: fn(&Condition) -> bool) -> bool {
    list.iter().any(|e| match e {
        Effect::If {
            cond,
            then,
            otherwise,
        } => {
            cond_has(cond, pred)
                || effects_have_cond(then, pred)
                || otherwise
                    .as_deref()
                    .is_some_and(|o| effects_have_cond(o, pred))
        }
        Effect::Mode { options, all_if } => {
            all_if.as_ref().is_some_and(|c| cond_has(c, pred))
                || options.iter().any(|o| effects_have_cond(o, pred))
        }
        Effect::RandomEffects { options, .. } | Effect::CycleEffects { options } => {
            options.iter().any(|o| effects_have_cond(o, pred))
        }
        Effect::Repeat { effects, .. } => effects_have_cond(effects, pred),
        Effect::EarthRite { then, .. }
        | Effect::Necromancy { then, .. }
        | Effect::PayPp { then, .. }
        | Effect::SpendFaith { then, .. }
        | Effect::SpendEvidence { then, .. } => effects_have_cond(then, pred),
        _ => false,
    })
}

fn effects_use_gauge(list: &[Effect]) -> bool {
    effects_have_cond(list, |c| matches!(c, Condition::Ultimate { .. }))
}

impl Data {
    pub fn card_idx(&self, id: &str) -> CardIdx {
        *self
            .card_by_id
            .get(id)
            .unwrap_or_else(|| panic!("未知のカードID: {id}"))
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct RawData {
    cards: serde_json::Value,
    crests: serde_json::Value,
    card_abilities: serde_json::Value,
    crest_abilities: serde_json::Value,
    apocalypse_deck: Vec<(String, i32)>,
    decks: Vec<RawDeck>,
}

#[derive(Deserialize)]
struct RawDeck {
    key: String,
    name: String,
    cards: Vec<String>,
}

pub fn load(json: &str) -> Data {
    let raw: RawData = serde_json::from_str(json).expect("engine-data.json を読めません");
    INTERN.with(|i| *i.borrow_mut() = Interner::default());
    let cards: Vec<Card> = serde_json::from_value(raw.cards).expect("cards");
    let crests: Vec<CrestData> = serde_json::from_value(raw.crests).expect("crests");
    let card_by_id: HashMap<String, CardIdx> = cards
        .iter()
        .enumerate()
        .map(|(i, c)| (c.id.clone(), i as CardIdx))
        .collect();
    INTERN.with(|i| {
        let mut i = i.borrow_mut();
        i.cards = card_by_id.clone();
        i.crests = crests
            .iter()
            .enumerate()
            .map(|(n, c)| (c.id.clone(), n as CrestIdx))
            .collect();
    });
    let var_fused_cost = var_id_now("fusedCost");
    let var_fused_kinds = var_id_now("fusedKinds");
    let card_ab: HashMap<String, CardAbilities> =
        serde_json::from_value(raw.card_abilities).unwrap_or_else(|e| panic!("cardAbilities: {e}"));
    let crest_ab: HashMap<String, CardAbilities> = serde_json::from_value(raw.crest_abilities)
        .unwrap_or_else(|e| panic!("crestAbilities: {e}"));
    let mut abilities: Vec<CardAbilities> =
        cards.iter().map(|_| CardAbilities::default()).collect();
    for (id, a) in card_ab {
        abilities[card_by_id[&id] as usize] = a;
    }
    let mut crest_abilities: Vec<Option<CardAbilities>> = crests.iter().map(|_| None).collect();
    for (id, a) in crest_ab {
        let n = crests
            .iter()
            .position(|c| c.id == id)
            .expect("未知のクレスト");
        crest_abilities[n] = Some(a);
    }
    let apocalypse_deck = raw
        .apocalypse_deck
        .iter()
        .map(|(id, n)| (card_by_id[id], *n))
        .collect();
    let decks = raw
        .decks
        .into_iter()
        .map(|d| Deck {
            key: d.key,
            name: d.name,
            cards: d.cards.iter().map(|c| card_by_id[c]).collect(),
        })
        .collect();
    let (tribe_names, slot_names, var_names) = INTERN.with(|i| {
        let i = i.borrow();
        (i.tribes.clone(), i.slots.clone(), i.vars.clone())
    });
    let earth_sigil_token = card_by_id["90031210"];
    let zone_hand = abilities
        .iter()
        .map(|a| a.abilities.iter().any(|x| x.zone == Some(Zone::Hand)))
        .collect();
    let zone_deck = abilities
        .iter()
        .map(|a| a.abilities.iter().any(|x| x.zone == Some(Zone::Deck)))
        .collect();
    let uses_gauge = abilities
        .iter()
        .map(|a| a.abilities.iter().any(|x| effects_use_gauge(&x.effects)))
        .collect();
    let uses_fused = abilities
        .iter()
        .map(|a| {
            a.abilities
                .iter()
                .any(|x| effects_have_cond(&x.effects, |c| matches!(c, Condition::Fused)))
        })
        .collect();
    Data {
        cards,
        abilities,
        crests,
        crest_abilities,
        apocalypse_deck,
        decks,
        tribe_names,
        slot_names,
        var_names,
        card_by_id,
        earth_sigil_token,
        var_fused_cost,
        var_fused_kinds,
        zone_hand,
        zone_deck,
        uses_gauge,
        uses_fused,
    }
}

/// 埋め込んだデータの JSON（局面の JSON の能力を読み書きするときにも使う）
pub const ENGINE_DATA_JSON: &str = include_str!("../data/engine-data.json");

static DATA: OnceLock<&'static Data> = OnceLock::new();

/// 埋め込んだデータ（最初の呼び出しで読み込む）
#[inline]
pub fn data() -> &'static Data {
    DATA.get_or_init(|| Box::leak(Box::new(load(ENGINE_DATA_JSON))))
}
