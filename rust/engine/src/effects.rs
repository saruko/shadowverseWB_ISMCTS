//! 能力（DSL）の解釈と、解決スタックの実行（src/engine/effects.ts の移植）。
//! 処理の順番（乱数を引く順を含む）は TypeScript 版と同じにしてある。変えるとゴールデンテストの結果が変わる。

use crate::data::*;
use crate::game::handle_internal;
use crate::state::*;

// ---- 対象 ----

pub fn card_matches(s: &GameState, ctx: &Ctx, iid: Iid, filter: Option<&CardFilter>) -> bool {
    let Some(f) = filter else { return true };
    if f.exclude_self && iid == ctx.source {
        return false;
    }
    let board = s.board_card(iid);
    let hand = if board.is_some() {
        None
    } else {
        s.hand_card(iid)
    };
    let cid = match (board, hand) {
        (Some(b), _) => b.card,
        (None, Some(h)) => h.card,
        _ => return false,
    };
    let cd = card(cid);
    if let Some(t) = f.ctype {
        // 場の結晶はアミュレット（docs/rules.md 12章）
        let ctype = if board.is_some_and(|b| b.ext.crystal) {
            CardType::Amulet
        } else {
            cd.ctype
        };
        if ctype != t {
            return false;
        }
    }
    if let Some(t) = f.tribe {
        if !cd.tribes.contains(&t) {
            return false;
        }
    }
    if let Some(c) = f.class {
        if cd.class != c {
            return false;
        }
    }
    if let Some(ids) = &f.ids {
        if !ids.contains(&cid) {
            return false;
        }
    }
    let cost = match hand {
        Some(h) => hand_cost(h),
        None => cd.cost,
    };
    if let Some(m) = f.cost_max {
        if cost > m {
            return false;
        }
    }
    if let Some(v) = &f.cost_eq {
        if cost != eval_value(s, ctx, v) {
            return false;
        }
    }
    if f.spellboost
        && !abilities_of(cid)
            .abilities
            .iter()
            .any(|a| a.trigger.on() == On::Spellboost)
    {
        return false;
    }
    if f.earth_sigil && !cd.earth_sigil {
        return false;
    }
    if f.evidence && !cd.evidence {
        return false;
    }
    if let Some(c) = board {
        if let Some(k) = f.keyword {
            if !c.has_keyword(k) {
                return false;
            }
        }
        if let Some(m) = f.defense_max {
            if !c.is_follower || c.defense > m {
                return false;
            }
        }
        if f.not_evolved && (!c.is_follower || c.evolve != Evolve::None) {
            return false;
        }
    } else if f.keyword.is_some() || f.defense_max.is_some() || f.not_evolved {
        return false;
    }
    extra_matches(s, ctx, iid, cid, cost, board, hand.map(|h| h.keywords), f)
}

/// ローテーションで足した条件（docs/rules.md 12章）。cost は今のコスト（手札・山札では変化したコスト）
#[allow(clippy::too_many_arguments)]
fn extra_matches(
    s: &GameState,
    ctx: &Ctx,
    iid: Iid,
    cid: CardIdx,
    cost: i32,
    board: Option<&OnBoard>,
    hand_kw: Option<Kw>,
    f: &CardFilter,
) -> bool {
    let cd = card(cid);
    if f.cost_min.is_some_and(|m| cost < m) {
        return false;
    }
    if f.cost_in.as_ref().is_some_and(|v| !v.contains(&cost)) {
        return false;
    }
    let oc = cd.cost;
    if f.original_cost_min.is_some_and(|m| oc < m)
        || f.original_cost_max.is_some_and(|m| oc > m)
        || f.original_cost_eq.is_some_and(|m| oc != m)
        || f.original_cost_in
            .as_ref()
            .is_some_and(|v| !v.contains(&oc))
    {
        return false;
    }
    if let Some(v) = &f.original_cost_eq_value {
        if oc != eval_value(s, ctx, v) {
            return false;
        }
    }
    if f.not_tribe.is_some_and(|t| cd.tribes.contains(&t)) {
        return false;
    }
    if f.exclude_event && ctx.event == Some(iid) {
        return false;
    }
    if f.not_in_slot.is_some_and(|sl| ctx.slot(sl).contains(&iid)) {
        return false;
    }
    if let Some(k) = f.card_keyword {
        let has = cd.keywords.has(k)
            || hand_kw.is_some_and(|h| h.has(k))
            || board.is_some_and(|b| b.has_keyword(k));
        if !has {
            return false;
        }
    }
    if f.has_last_words {
        let lw = match board {
            Some(b) => b.abilities().any(|a| a.trigger.on() == On::LastWords),
            None => abilities_of(cid)
                .abilities
                .iter()
                .any(|a| a.trigger.on() == On::LastWords),
        };
        if !lw {
            return false;
        }
    }
    if f.evolved || f.super_evolved || f.damaged || f.not_attacked {
        let Some(b) = board.filter(|b| b.is_follower) else {
            return false;
        };
        if (f.evolved && b.evolve == Evolve::None)
            || (f.super_evolved && b.evolve != Evolve::SuperEvolved)
            || (f.damaged && b.defense >= b.max_defense)
            || (f.not_attacked && b.attacks_this_turn > 0)
        {
            return false;
        }
    }
    true
}

/// カードの種類だけで判定できる条件（場・手札にないカード: 破壊されたカード、場に出た記録、プレイしたカード等）
pub fn card_idx_matches(s: &GameState, ctx: &Ctx, cid: CardIdx, f: Option<&CardFilter>) -> bool {
    let Some(f) = f else { return true };
    let cd = card(cid);
    if f.ctype.is_some_and(|t| cd.ctype != t)
        || f.tribe.is_some_and(|t| !cd.tribes.contains(&t))
        || f.class.is_some_and(|c| cd.class != c)
        || f.ids.as_ref().is_some_and(|ids| !ids.contains(&cid))
        || f.cost_max.is_some_and(|m| cd.cost > m)
        || f.defense_max
            .is_some_and(|m| cd.ctype == CardType::Follower && cd.defense > m)
        || f.keyword.is_some_and(|k| !cd.keywords.has(k))
        || (f.spellboost
            && !abilities_of(cid)
                .abilities
                .iter()
                .any(|a| a.trigger.on() == On::Spellboost))
        || (f.earth_sigil && !cd.earth_sigil)
        || (f.evidence && !cd.evidence)
    {
        return false;
    }
    if let Some(v) = &f.cost_eq {
        if cd.cost != eval_value(s, ctx, v) {
            return false;
        }
    }
    if f.evolved || f.super_evolved || f.damaged || f.not_attacked || f.not_evolved {
        return false;
    }
    extra_matches(s, ctx, -1, cid, cd.cost, None, None, f)
}

fn side_players(s: &GameState, ctx: &Ctx, side: Side) -> ([PlayerIndex; 2], usize) {
    match side {
        Side::Me => ([ctx.controller, 0], 1),
        Side::Opponent => ([opponent(ctx.controller), 0], 1),
        Side::Both => (s.turn_order(), 2),
    }
}

/// 能力の対象として残っているか（場・手札・リーダー）。山札・クレストのカードは専用の対象（Deck・Crests）で指す
fn exists_entity(s: &GameState, id: Iid) -> bool {
    is_leader(id) || s.find_board(id).is_some() || s.find_hand(id).is_some()
}

/// 山札のカード (プレイヤー, 添字)
pub fn find_deck(s: &GameState, iid: Iid) -> Option<(PlayerIndex, usize)> {
    (0..2).find_map(|p| {
        s.players[p]
            .deck
            .iter()
            .position(|r| r.iid == iid)
            .map(|i| (p, i))
    })
}

/// クレスト (プレイヤー, 添字)
pub fn find_crest(s: &GameState, iid: Iid) -> Option<(PlayerIndex, usize)> {
    (0..2).find_map(|p| {
        s.players[p]
            .crests
            .iter()
            .position(|c| c.iid == iid)
            .map(|i| (p, i))
    })
}

fn side_of(s: &GameState, ctx: &Ctx, side: Option<Side>) -> ([PlayerIndex; 2], usize) {
    side_players(s, ctx, side.unwrap_or(Side::Me))
}

pub fn resolve_target(s: &GameState, ctx: &Ctx, t: &Target) -> Vec<Iid> {
    let mut out = Vec::new();
    resolve_into(s, ctx, t, &mut out);
    out
}

fn resolve_into(s: &GameState, ctx: &Ctx, t: &Target, out: &mut Vec<Iid>) {
    match t {
        Target::This => {
            // クレストの能力の「これ」はクレスト自身（第10弾。「これを破壊」「これのカウントを-1」）
            if exists_entity(s, ctx.source) || find_crest(s, ctx.source).is_some() {
                out.push(ctx.source)
            }
        }
        Target::Leader { side } => {
            let (ps, n) = side_players(s, ctx, *side);
            for &p in &ps[..n] {
                out.push(leader_id(p));
            }
        }
        Target::Board { side, filter } => {
            let (ps, n) = side_players(s, ctx, *side);
            for &p in &ps[..n] {
                let board = &s.players[p].board;
                let perm = order_perm(board.iter().map(|c| c.order));
                let len = board.len();
                for k in 0..len {
                    let c = &board[perm.as_ref().map(|v| v[k]).unwrap_or(k)];
                    if card_matches(s, ctx, c.iid, filter.as_ref()) {
                        out.push(c.iid);
                    }
                }
            }
        }
        Target::Hand { filter, side } => {
            let (ps, n) = side_of(s, ctx, *side);
            for &p in &ps[..n] {
                for c in &s.players[p].hand {
                    if card_matches(s, ctx, c.iid, filter.as_ref()) {
                        out.push(c.iid);
                    }
                }
            }
        }
        Target::Deck { side, filter } => {
            let (ps, n) = side_of(s, ctx, *side);
            for &p in &ps[..n] {
                for r in &s.players[p].deck {
                    let ok = match filter {
                        None => true,
                        Some(f) => deck_card_matches(s, ctx, p, r, f),
                    };
                    if ok {
                        out.push(r.iid);
                    }
                }
            }
        }
        Target::Crests { side, ids } => {
            let (ps, n) = side_players(s, ctx, *side);
            for &p in &ps[..n] {
                let crests = &s.players[p].crests;
                let perm = order_perm(crests.iter().map(|c| c.order));
                for k in 0..crests.len() {
                    let c = &crests[perm.as_ref().map(|v| v[k]).unwrap_or(k)];
                    if ids.as_ref().is_none_or(|v| v.contains(&c.crest)) {
                        out.push(c.iid);
                    }
                }
            }
        }
        Target::Leftmost { of, count } => {
            let v = resolve_target(s, ctx, of);
            out.extend(v.into_iter().take((*count).max(0) as usize));
        }
        Target::MinHpLeaders => {
            let (h0, h1) = (s.players[0].leader_hp, s.players[1].leader_hp);
            for p in s.turn_order() {
                if s.players[p].leader_hp == h0.min(h1) {
                    out.push(leader_id(p));
                }
            }
        }
        Target::Slot { slot } => {
            for &id in ctx.slot(*slot) {
                if exists_entity(s, id) {
                    out.push(id);
                }
            }
        }
        Target::Event => {
            if let Some(e) = ctx.event {
                if exists_entity(s, e) {
                    out.push(e);
                }
            }
        }
        Target::Union { of } => {
            for x in of {
                resolve_into(s, ctx, x, out);
            }
        }
        Target::MaxAttack { of } => {
            let fs: Vec<&OnBoard> = resolve_target(s, ctx, of)
                .into_iter()
                .filter_map(|id| s.follower(id))
                .collect();
            if let Some(max) = fs.iter().map(|f| f.attack_value()).max() {
                for f in fs {
                    if f.attack_value() == max {
                        out.push(f.iid);
                    }
                }
            }
        }
        Target::MinCost { of } => {
            let v: Vec<(Iid, i32)> = resolve_target(s, ctx, of)
                .into_iter()
                .map(|id| (id, entity_stat(s, ctx, id, CardStat::Cost)))
                .collect();
            if let Some(min) = v.iter().map(|x| x.1).min() {
                out.extend(v.iter().filter(|x| x.1 == min).map(|x| x.0));
            }
        }
        Target::SameName { of, slot } => {
            let Some((sc, _)) = slot_card(s, ctx, *slot) else {
                return;
            };
            let name = &card(sc).name;
            for id in resolve_target(s, ctx, of) {
                let c = s
                    .board_card(id)
                    .map(|b| b.card)
                    .or_else(|| s.hand_card(id).map(|h| h.card));
                if c.is_some_and(|c| card(c).name == *name) {
                    out.push(id);
                }
            }
        }
    }
}

/// 相手のカードを能力で選ぶ場合の制限（潜伏・オーラ、「相手は能力でこれしか選べない」）
fn selectable(s: &GameState, chooser: PlayerIndex, ids: Vec<Iid>) -> Vec<Iid> {
    let opp = opponent(chooser);
    let is_opp = |id: Iid| {
        if is_leader(id) {
            leader_owner(id) == opp
        } else {
            s.find_board(id).map(|(p, _)| p) == Some(opp)
        }
    };
    // 【潜伏】【オーラ】と、証拠・アミュレット（相手の能力で選ばれない。docs/rules.md 12章）
    let blocked = |id: Iid| {
        s.board_card(id)
            .map(|c| c.has_keyword(AMBUSH) || c.has_keyword(AURA) || c.evidence.is_some())
            .unwrap_or(false)
    };
    let only: Vec<Iid> = ids
        .iter()
        .copied()
        .filter(|&id| {
            is_opp(id)
                && !blocked(id)
                && s.board_card(id)
                    .map(|c| abilities_of(c.card).only_selectable)
                    .unwrap_or(false)
        })
        .collect();
    ids.into_iter()
        .filter(|&id| {
            if !is_opp(id) {
                return true;
            }
            if blocked(id) {
                return false;
            }
            only.is_empty() || only.contains(&id)
        })
        .collect()
}

/// 「選ぶ」の候補
pub fn choose_candidates(s: &GameState, ctx: &Ctx, from: &Target) -> Vec<Iid> {
    selectable(s, ctx.controller, resolve_target(s, ctx, from))
}

// ---- 値と条件 ----

fn source_x(s: &GameState, ctx: &Ctx) -> i32 {
    if let Some(b) = s.board_card(ctx.source) {
        if b.is_follower {
            if let Some(x) = b.x {
                return x;
            }
        }
    }
    if let Some(h) = s.hand_card(ctx.source) {
        if let Some(x) = h.x {
            return x;
        }
    }
    ctx.source_x.unwrap_or(0)
}

pub fn eval_value(s: &GameState, ctx: &Ctx, v: &Value) -> i32 {
    let o = match v {
        Value::Num(n) => return *n,
        Value::Obj(o) => o,
    };
    let pl = &s.players[ctx.controller];
    match o {
        ValueObj::Var { name } => ctx.var(*name),
        ValueObj::Count { of } => resolve_target(s, ctx, of).len() as i32,
        ValueObj::Combo => pl.combo,
        ValueObj::Sigils => pl
            .board
            .iter()
            .find(|c| !c.is_follower && c.sigils.is_some())
            .and_then(|c| c.sigils)
            .unwrap_or(0),
        ValueObj::ThisAttack => match s.follower(ctx.source) {
            Some(f) => f.attack_value(),
            None => ctx.source_attack,
        },
        ValueObj::ThisDefense => entity_stat(s, ctx, ctx.source, CardStat::Defense),
        ValueObj::Evidence => evidence_amulet(s, ctx.controller)
            .and_then(|i| pl.board[i].evidence)
            .unwrap_or(0),
        ValueObj::LeaderMissingHp { side } => {
            let (ps, n) = side_players(s, ctx, *side);
            ps[..n]
                .iter()
                .map(|&q| (s.players[q].leader_max_hp - s.players[q].leader_hp).max(0))
                .sum()
        }
        ValueObj::CostOf { slot } => ctx.var(*slot),
        ValueObj::ThisX => source_x(s, ctx),
        ValueObj::DestroyedThisTurn { stat, filter } => pl
            .destroyed_this_turn
            .iter()
            .filter(|r| match filter {
                None => true,
                Some(f) => {
                    let cd = card(r.card);
                    f.tribe.map(|t| cd.tribes.contains(&t)).unwrap_or(true)
                        && f.ctype.map(|t| cd.ctype == t).unwrap_or(true)
                }
            })
            .map(|r| {
                if *stat == Stat::Attack {
                    r.attack
                } else {
                    r.defense
                }
            })
            .sum(),
        ValueObj::SlotStat { slot, stat } => match ctx.slot(*slot).first() {
            Some(&id) => entity_stat(s, ctx, id, *stat),
            None => 0,
        },
        ValueObj::EventStat { stat } => match ctx.event {
            Some(id) => entity_stat(s, ctx, id, *stat),
            None => 0,
        },
        ValueObj::ThisCost => this_cost(s, ctx),
        ValueObj::Faith => pl.ext.faith.as_ref().map(|f| f.value).unwrap_or(0),
        ValueObj::Sub { a, b } => eval_value(s, ctx, a) - eval_value(s, ctx, b),
        ValueObj::EnteredCount { filter } => {
            let n = pl
                .ext
                .entered
                .iter()
                .filter(|&&cid| card_idx_matches(s, ctx, cid, filter.as_ref()))
                .count() as i32;
            // 「他の」: 場にあるこれ自身の分を除く
            let own = filter.as_ref().is_some_and(|f| f.exclude_self)
                && s.follower(ctx.source)
                    .is_some_and(|b| card_idx_matches(s, ctx, b.card, filter.as_ref()));
            n - own as i32
        }
        ValueObj::EnteredKinds { filter } => {
            let mut kinds: Vec<CardIdx> = Vec::new();
            for &cid in pl.ext.entered.iter() {
                if !kinds.contains(&cid) && card_idx_matches(s, ctx, cid, filter.as_ref()) {
                    kinds.push(cid);
                }
            }
            kinds.len() as i32
        }
    }
}

/// カード（場・手札にあれば今の値、無ければ選んだときのカードの元の値）の値
fn entity_stat(s: &GameState, ctx: &Ctx, id: Iid, stat: CardStat) -> i32 {
    if let Some(b) = s.board_card(id) {
        return match stat {
            CardStat::Attack => b.attack_value(),
            CardStat::Defense => b.defense,
            CardStat::Cost | CardStat::OriginalCost => card(b.card).cost,
        };
    }
    if let Some(h) = s.hand_card(id) {
        let cd = card(h.card);
        return match stat {
            CardStat::Attack => (cd.attack + h.attack_mod).max(0),
            CardStat::Defense => (cd.defense + h.defense_mod).max(0),
            CardStat::Cost => hand_cost(h),
            CardStat::OriginalCost => cd.cost,
        };
    }
    let known = ctx
        .ext
        .slot_cards
        .iter()
        .find(|x| x.0 == id)
        .map(|x| x.1)
        .or(if ctx.event == Some(id) {
            ctx.ext.event_card
        } else {
            None
        });
    match known {
        Some(cid) => {
            let cd = card(cid);
            match stat {
                CardStat::Attack => cd.attack,
                CardStat::Defense => cd.defense,
                CardStat::Cost | CardStat::OriginalCost => cd.cost,
            }
        }
        None => 0,
    }
}

/// これのコスト（プレイ・捨てたときのコスト。手札にあれば今のコスト）
fn this_cost(s: &GameState, ctx: &Ctx) -> i32 {
    if let Some(c) = ctx.ext.source_cost {
        return c;
    }
    match s.hand_card(ctx.source) {
        Some(h) => hand_cost(h),
        None => ctx.ext.source_card.map(|c| card(c).cost).unwrap_or(0),
    }
}

/// 奥義ゲージ（プレイしたときの値。手札にあれば今の値）
fn gauge(s: &GameState, ctx: &Ctx) -> i32 {
    if let Some(g) = ctx.ext.gauge {
        return g;
    }
    let turns = s.players[ctx.controller].turn_count;
    match s.hand_card(ctx.source) {
        Some(h) => turns + h.ext.gauge_evolves,
        None => turns,
    }
}

/// スロットのカード（選んだときのカード）と持ち主
fn slot_card(s: &GameState, ctx: &Ctx, slot: SlotId) -> Option<(CardIdx, PlayerIndex)> {
    let id = *ctx.slot(slot).first()?;
    if let Some((p, i)) = s.find_board(id) {
        return Some((s.players[p].board[i].card, p));
    }
    if let Some((p, i)) = s.find_hand(id) {
        return Some((s.players[p].hand[i].card, p));
    }
    ctx.ext
        .slot_cards
        .iter()
        .find(|x| x.0 == id)
        .map(|x| (x.1, x.2))
}

pub fn eval_cond(s: &GameState, ctx: &Ctx, c: &Condition) -> bool {
    let pl = &s.players[ctx.controller];
    match c {
        Condition::Awakened => pl.max_pp >= 7,
        Condition::Combo { at_least } => pl.combo >= *at_least,
        Condition::Enhanced => ctx.enhanced,
        Condition::SuperEvolveTurn => s.super_evolve_turn_reached(ctx.controller),
        Condition::ThisSuperEvolved => s
            .follower(ctx.source)
            .map(|f| f.evolve == Evolve::SuperEvolved)
            .unwrap_or(false),
        Condition::HandCount { at_most } => pl.hand.len() as i32 <= *at_most,
        Condition::AttackingFollower => ctx.event.map(|e| !is_leader(e)).unwrap_or(false),
        Condition::VarAtLeast { name, value } => ctx.var(*name) >= *value,
        Condition::ThisXAtLeast { value } => source_x(s, ctx) >= *value,
        Condition::MaxPp { at_least } => pl.max_pp >= *at_least,
        Condition::Not { cond } => !eval_cond(s, ctx, cond),
        Condition::Ultimate { at_least } => gauge(s, ctx) >= *at_least,
        Condition::Link { at_least } => pl.ext.entered.len() as i32 >= *at_least,
        Condition::LeaderHpAtMost { side, value } => {
            let (ps, n) = side_players(s, ctx, *side);
            ps[..n].iter().all(|&p| s.players[p].leader_hp <= *value)
        }
        Condition::LeaderHpGreater => pl.leader_hp > s.players[opponent(ctx.controller)].leader_hp,
        Condition::ThisEvolved => s
            .follower(ctx.source)
            .map(|f| f.evolve != Evolve::None)
            .unwrap_or(false),
        Condition::OwnTurn => s.active == ctx.controller,
        Condition::ValueAtLeast { value, at_least } => eval_value(s, ctx, value) >= *at_least,
        Condition::SlotMatches { slot, filter, own } => match slot_card(s, ctx, *slot) {
            Some((cid, owner)) => {
                (!*own || owner == ctx.controller) && card_idx_matches(s, ctx, cid, filter.as_ref())
            }
            None => false,
        },
        Condition::DeckNoDuplicates => {
            let mut seen: Vec<CardIdx> = Vec::with_capacity(pl.deck.len());
            pl.deck.iter().all(|r| {
                if seen.contains(&r.card) {
                    false
                } else {
                    seen.push(r.card);
                    true
                }
            })
        }
        Condition::AttackedLeaderLastTurn => {
            let prev = if s.active == ctx.controller {
                pl.turn_count - 1
            } else {
                pl.turn_count
            };
            prev > 0 && (pl.ext.attacked_leader_turn == prev || pl.ext.attacked_leader_prev == prev)
        }
        Condition::PlayedCostsCover { from, to } => {
            (*from..=*to).all(|c| pl.ext.played_costs & (1u32 << c.clamp(0, 31)) != 0)
        }
        Condition::ThisCostEq { value } => this_cost(s, ctx) == *value,
        Condition::Fused => ctx.ext.fused || s.board_card(ctx.source).is_some_and(|b| b.ext.fused),
        Condition::ActedThisTurn { evidence } => {
            let t = if *evidence {
                pl.ext.acted_evidence_turn
            } else {
                pl.ext.acted_amulet_turn
            };
            t != 0 && t == s.turn
        }
        Condition::EvolvedCountAtLeast { at_least } => pl.ext.evolved_count >= *at_least,
        Condition::HandSameCostAtLeast { at_least } => {
            let mut counts = [0i32; 32];
            for h in pl.hand.iter() {
                counts[hand_cost(h).clamp(0, 31) as usize] += 1;
            }
            counts.iter().any(|&n| n >= *at_least)
        }
        Condition::HandTopCostGreater { n } => {
            let top = |p: PlayerIndex| {
                let mut v: Vec<i32> = s.players[p]
                    .hand
                    .iter()
                    .map(|h| card(h.card).cost)
                    .collect();
                v.sort_unstable_by(|a, b| b.cmp(a));
                v.iter().take((*n).max(0) as usize).sum::<i32>()
            };
            top(ctx.controller) > top(opponent(ctx.controller))
        }
        Condition::EnhancedAtLeast { at_least } => ctx.enhanced && ctx.ext.paid_cost >= *at_least,
        Condition::And { conds } => conds.iter().all(|c| eval_cond(s, ctx, c)),
    }
}

// ---- 誘発 ----

// 探索では局面を複製してから手を打つので、複製した局面の空の解決スタック・誘発待ちに毎回領域を
// 確保しないよう、解決し終えて空になったものの領域を取っておいて使い回す（中身は変わらない）
thread_local! {
    static SPARE: std::cell::RefCell<(Vec<Frame>, std::collections::VecDeque<Queued>)> =
        Default::default();
}

/// 解決し終えて空になった解決スタック・誘発待ちの領域を、次に使うまで取っておく
fn keep_spare(s: &mut GameState) {
    if s.stack.capacity() == 0 && s.queue.capacity() == 0 {
        return;
    }
    SPARE.with(|b| {
        let b = &mut *b.borrow_mut();
        if s.stack.is_empty() && b.0.capacity() == 0 {
            std::mem::swap(&mut s.stack, &mut b.0);
        }
        if s.queue.is_empty() && b.1.capacity() == 0 {
            std::mem::swap(&mut s.queue, &mut b.1);
        }
    });
}

pub fn push_frame(s: &mut GameState, effects: Effects, ctx: Ctx) {
    if !effects.is_empty() {
        if s.stack.capacity() == 0 {
            SPARE.with(|b| std::mem::swap(&mut s.stack, &mut b.borrow_mut().0));
        }
        s.stack.push(Frame {
            effects,
            pc: 0,
            ctx,
        });
    }
}

fn queue(s: &mut GameState, ability: &'static Ability, ctx: Ctx) {
    if s.queue.capacity() == 0 {
        SPARE.with(|b| std::mem::swap(&mut s.queue, &mut b.borrow_mut().1));
    }
    s.queue.push_back(Queued { ability, ctx });
}

/// 「自分のターンごとに1回」の確認と記録
fn use_once(used: &mut Vec<(u8, i32)>, key: u8, turn_id: i32) -> bool {
    match used.iter_mut().find(|(k, _)| *k == key) {
        Some(e) if e.1 == turn_id => false,
        Some(e) => {
            e.1 = turn_id;
            true
        }
        None => {
            used.push((key, turn_id));
            true
        }
    }
}

/// 誘発の判定の結果: None なら誘発しない。Some(event) は文脈の event を上書きする（Some(None) は上書きしない）
type Matched = Option<Option<Iid>>;

/// プレイヤー p のクレスト（古い順）→場（古い順）のうち、条件を満たす能力を誘発させる
fn fire_side(
    s: &mut GameState,
    p: PlayerIndex,
    matcher: impl FnMut(&GameState, &Trigger, Iid) -> Matched,
) {
    fire_side_parts(s, p, true, true, matcher);
}

/// fire_side のうち、クレスト（crests）と、場・信仰・手札・デッキ（rest）のどちらを見るか選べるもの（ターン開始時の処理順用）
fn fire_side_parts(
    s: &mut GameState,
    p: PlayerIndex,
    crests: bool,
    rest: bool,
    mut matcher: impl FnMut(&GameState, &Trigger, Iid) -> Matched,
) {
    let turn_id = s.players[p].turn_count;
    // 誘発の判定は状態を変えないので、クレストと場をそれぞれ並べ替えた順に見ていく
    let crest_perm = order_perm(s.players[p].crests.iter().map(|c| c.order));
    let n_crests = if crests { s.players[p].crests.len() } else { 0 };
    for k in 0..n_crests {
        let ci = crest_perm.as_ref().map(|v| v[k]).unwrap_or(k);
        let (iid, crest_idx) = {
            let c = &s.players[p].crests[ci];
            (c.iid, c.crest)
        };
        for (i, ability) in crest_abilities_of(crest_idx).iter().enumerate() {
            let Some(event) = matcher(s, &ability.trigger, iid) else {
                continue;
            };
            if ability.once_per_own_turn
                && !use_once(
                    &mut s.players[p].crests.make_mut()[ci].used_once,
                    i as u8,
                    turn_id,
                )
            {
                continue;
            }
            let mut ctx = Ctx::new(p, iid);
            ctx.event = event;
            queue(s, ability, ctx);
        }
    }
    if !rest {
        return;
    }
    let board_perm = order_perm(s.players[p].board.iter().map(|c| c.order));
    let n_board = s.players[p].board.len();
    for k in 0..n_board {
        let bi = board_perm.as_ref().map(|v| v[k]).unwrap_or(k);
        let c = &s.players[p].board[bi];
        let (iid, is_follower, lost) = (c.iid, c.is_follower, c.ext.lost_last_words);
        let own = c.own_abilities();
        let n_granted = c.granted.len();
        for i in 0..own.len() + n_granted {
            let ability: &'static Ability = if i < own.len() {
                &own[i]
            } else {
                s.players[p].board[bi].granted[i - own.len()]
            };
            if ability.zone.is_some() || (lost && ability.trigger.on() == On::LastWords) {
                continue;
            }
            let Some(event) = matcher(s, &ability.trigger, iid) else {
                continue;
            };
            if ability.once_per_own_turn
                && is_follower
                && !use_once(
                    &mut s.players[p].board.make_mut()[bi].used_once,
                    i as u8,
                    turn_id,
                )
            {
                continue;
            }
            let c = &s.players[p].board[bi];
            let mut ctx = Ctx::new(p, iid);
            if is_follower {
                ctx.source_x = c.x;
                ctx.source_attack = c.attack_value();
            }
            ctx.event = event;
            queue(s, ability, ctx);
        }
    }
    // 信仰（docs/rules.md 12章）
    if let Some(f) = &s.players[p].ext.faith {
        let (iid, fc, n_granted) = (f.iid, f.card, f.granted.len());
        let base: &'static [Ability] = abilities_of(fc)
            .faith
            .as_ref()
            .map(|d| d.abilities.as_slice())
            .unwrap_or(&[]);
        for i in 0..base.len() + n_granted {
            let ability: &'static Ability = if i < base.len() {
                &base[i]
            } else {
                s.players[p].ext.faith.as_ref().unwrap().granted[i - base.len()]
            };
            let Some(event) = matcher(s, &ability.trigger, iid) else {
                continue;
            };
            let mut ctx = Ctx::new(p, iid);
            ctx.event = event;
            queue(s, ability, ctx);
        }
    }
    // 「手札で働く」
    let d = data();
    for hi in 0..s.players[p].hand.len() {
        let h = &s.players[p].hand[hi];
        let (iid, cid, x) = (h.iid, h.card, h.x);
        if !d.zone_hand[cid as usize] {
            continue;
        }
        for ability in &abilities_of(cid).abilities {
            if ability.zone != Some(Zone::Hand) {
                continue;
            }
            let Some(event) = matcher(s, &ability.trigger, iid) else {
                continue;
            };
            let mut ctx = Ctx::new(p, iid);
            ctx.source_x = x;
            ctx.event = event;
            queue(s, ability, ctx);
        }
    }
    // 「デッキで働く」（同じタイミングで働く同名カードは1枚だけ）
    let mut seen: Vec<CardIdx> = Vec::new();
    for di in 0..s.players[p].deck.len() {
        let r = s.players[p].deck[di];
        if !d.zone_deck[r.card as usize] || seen.contains(&r.card) {
            continue;
        }
        let mut fired = false;
        for ability in &abilities_of(r.card).abilities {
            if ability.zone != Some(Zone::Deck) {
                continue;
            }
            let Some(event) = matcher(s, &ability.trigger, r.iid) else {
                continue;
            };
            let mut ctx = Ctx::new(p, r.iid);
            ctx.event = event;
            ctx.ext.source_card = Some(r.card);
            queue(s, ability, ctx);
            fired = true;
        }
        if fired {
            seen.push(r.card);
        }
    }
}

/// 手札のカードの能力を誘発させる
fn fire_hand(s: &mut GameState, p: PlayerIndex, hi: usize, on: On) {
    let h = &s.players[p].hand[hi];
    let (iid, cid, x) = (h.iid, h.card, h.x);
    for ability in &abilities_of(cid).abilities {
        if ability.trigger.on() == on {
            let mut ctx = Ctx::new(p, iid);
            ctx.source_x = x;
            queue(s, ability, ctx);
        }
    }
}

/// カード自身の能力のうち、指定の誘発のもの
pub fn own_abilities(cid: CardIdx, on: On) -> Vec<&'static Ability> {
    abilities_of(cid)
        .abilities
        .iter()
        .filter(|a| a.trigger.on() == on)
        .collect()
}

pub fn board_abilities_on(c: &OnBoard, on: On) -> Vec<&'static Ability> {
    c.abilities().filter(|a| a.trigger.on() == on).collect()
}

// ---- 場への出入り ----

/// カードを場に出す（場が満杯なら出さない）。出したら true
pub fn enter_board(s: &mut GameState, p: PlayerIndex, mut c: OnBoard) -> bool {
    if !s.can_add_to_board(p) {
        return false;
    }
    // 【土の印】アミュレットは1枚にまとまる
    if !c.is_follower && c.sigils.is_some() {
        let pl = &mut s.players[p];
        if let Some(oi) = pl
            .board
            .iter()
            .position(|x| !x.is_follower && x.sigils.is_some())
        {
            c.sigils = Some(c.sigils.unwrap() + pl.board[oi].sigils.unwrap_or(0));
            pl.board.make_mut().remove(oi);
        }
    }
    // 証拠・アミュレットは、他の証拠・アミュレットすべてを消滅させて数を合算する（docs/rules.md 12章）
    if c.evidence.is_some() {
        let others: Vec<(Iid, i32)> = s.players[p]
            .board
            .iter()
            .filter(|x| x.evidence.is_some())
            .map(|x| (x.iid, x.evidence.unwrap_or(0)))
            .collect();
        for (oid, n) in others {
            c.evidence = Some(c.evidence.unwrap() + n);
            leave_board(s, oid, LeaveReason::Banish);
        }
    }
    let (iid, cid) = (c.iid, c.card);
    let enter = board_abilities_on(&c, On::Enter);
    if c.is_follower && s.players[p].ext.rotation {
        let e = s.players[p].ext.entered.make_mut();
        let at = e.partition_point(|&x| x <= cid);
        e.insert(at, cid);
    }
    s.players[p].board.make_mut().push(c);
    for a in enter {
        queue(s, a, Ctx::new(p, iid));
    }
    fire_side(s, p, |s, t, src| match t {
        Trigger::AllyEnter { filter }
            if src != iid && card_matches(s, &Ctx::new(p, src), iid, filter.as_ref()) =>
        {
            Some(Some(iid))
        }
        _ => None,
    });
    let opp = opponent(p);
    fire_side(s, opp, |s, t, src| match t {
        Trigger::EnemyEnter { filter }
            if card_matches(s, &Ctx::new(opp, src), iid, filter.as_ref()) =>
        {
            Some(Some(iid))
        }
        _ => None,
    });
    let _ = cid;
    true
}

#[derive(Clone, Copy, PartialEq, Eq)]
pub enum LeaveReason {
    Destroy,
    Banish,
    Bounce,
}

/// 場から離れる処理。ラストワード等を誘発させる
pub fn leave_board(s: &mut GameState, iid: Iid, mut reason: LeaveReason) {
    let Some((p, _)) = s.find_board(iid) else {
        return;
    };
    if reason == LeaveReason::Destroy {
        if let Some(at) = &mut s.attack {
            if at.defender == iid {
                at.defender_destroyed = true;
            }
        }
    }
    let cid = s.board_card(iid).unwrap().card;
    if abilities_of(cid).banish_on_leave {
        reason = LeaveReason::Banish;
    }
    let is_follower = s.board_card(iid).unwrap().is_follower;
    // 破壊されたときの誘発は、離れる前の状態で条件を判定する
    if reason == LeaveReason::Destroy {
        // アミュレットは filter.type がアミュレットの能力だけ（docs/rules.md 12章）
        let kind_ok = |filter: &Option<CardFilter>| {
            is_follower || filter.as_ref().and_then(|f| f.ctype) == Some(CardType::Amulet)
        };
        fire_side(s, p, |s, t, src| match t {
            Trigger::AllyDestroyed { filter, side }
                if matches!(side, None | Some(Side::Me) | Some(Side::Both))
                    && kind_ok(filter)
                    && src != iid
                    && card_matches(s, &Ctx::new(p, src), iid, filter.as_ref()) =>
            {
                Some(Some(iid))
            }
            _ => None,
        });
        let opp = opponent(p);
        fire_side(s, opp, |s, t, src| match t {
            Trigger::AllyDestroyed { filter, side }
                if matches!(side, Some(Side::Opponent) | Some(Side::Both))
                    && kind_ok(filter)
                    && card_matches(s, &Ctx::new(opp, src), iid, filter.as_ref()) =>
            {
                Some(Some(iid))
            }
            _ => None,
        });
    }
    // 場で消滅したときの誘発（第10弾。離れる前の状態で条件を判定する）
    if reason == LeaveReason::Banish {
        fire_side(s, p, |s, t, src| match t {
            Trigger::AllyBanished { filter, side }
                if matches!(side, None | Some(Side::Me) | Some(Side::Both))
                    && src != iid
                    && card_matches(s, &Ctx::new(p, src), iid, filter.as_ref()) =>
            {
                Some(Some(iid))
            }
            _ => None,
        });
        let opp = opponent(p);
        fire_side(s, opp, |s, t, src| match t {
            Trigger::AllyBanished { filter, side }
                if matches!(side, Some(Side::Opponent) | Some(Side::Both))
                    && card_matches(s, &Ctx::new(opp, src), iid, filter.as_ref()) =>
            {
                Some(Some(iid))
            }
            _ => None,
        });
        // event のカードが場を離れても分かるように（ローテーションの対戦だけ。スターターの局面は変えない）
        if s.players[p].ext.rotation || s.players[opp].ext.rotation {
            for q in s.queue.iter_mut() {
                if q.ctx.event == Some(iid) && q.ctx.ext.event_card.is_none() {
                    q.ctx.ext.event_card = Some(cid);
                }
            }
        }
    }
    let idx = s.players[p]
        .board
        .iter()
        .position(|c| c.iid == iid)
        .unwrap();
    let c = s.players[p].board.make_mut().remove(idx);

    match reason {
        LeaveReason::Destroy => {
            let pl = &mut s.players[p];
            pl.graveyard += 1;
            let base = card(c.card);
            if c.is_follower {
                pl.graveyard_followers.make_mut().push(c.card);
                let f = base.ctype == CardType::Follower;
                pl.destroyed_this_turn.make_mut().push(DestroyedRecord {
                    card: c.card,
                    attack: if f { base.attack } else { 0 },
                    defense: if f { base.defense } else { 0 },
                });
            } else {
                pl.destroyed_amulets.make_mut().push(c.card);
            }
            for a in board_abilities_on(&c, On::LastWords) {
                let mut ctx = Ctx::new(p, c.iid);
                ctx.source_attack = if c.is_follower { c.attack_value() } else { 0 };
                if s.players[p].ext.rotation {
                    ctx.ext.source_card = Some(c.card);
                }
                queue(s, a, ctx);
            }
        }
        LeaveReason::Bounce => {
            let h = revealed_hand_card(s, c.card, None);
            s.add_hand_card(p, h);
        }
        LeaveReason::Banish => {
            // 「これが場で消滅したとき」
            for a in board_abilities_on(&c, On::Banished) {
                let mut ctx = Ctx::new(p, c.iid);
                ctx.ext.source_card = Some(c.card);
                queue(s, a, ctx);
            }
        }
    }

    if c.is_follower {
        for hi in 0..s.players[p].hand.len() {
            fire_hand(s, p, hi, On::AllyLeaveInHand);
        }
    }
}

/// 超進化したフォロワーは持ち主のターン中、効果で破壊されない
pub fn immune_to_effect_destroy(s: &GameState, iid: Iid) -> bool {
    match s.find_board(iid) {
        Some((p, i)) => {
            let c = &s.players[p].board[i];
            (c.evolve == Evolve::SuperEvolved && p == s.active)
                || c.statics().is_some_and(|a| a.indestructible)
        }
        None => false,
    }
}

/// 体力0以下のフォロワーを破壊する（手番のプレイヤーの場から、古い順）
pub fn destroy_dead(s: &mut GameState) {
    for p in s.turn_order() {
        if !s.players[p]
            .board
            .iter()
            .any(|c| c.is_follower && c.defense <= 0)
        {
            continue;
        }
        let is_dead = |c: &&OnBoard| c.is_follower && c.defense <= 0;
        let board = &s.players[p].board;
        if board.iter().filter(is_dead).count() == 1 {
            let iid = board.iter().find(is_dead).unwrap().iid;
            leave_board(s, iid, LeaveReason::Destroy);
            continue;
        }
        let mut dead: Vec<(i32, Iid)> = board
            .iter()
            .filter(is_dead)
            .map(|c| (c.order, c.iid))
            .collect();
        dead.sort_by_key(|x| x.0);
        for (_, iid) in dead {
            leave_board(s, iid, LeaveReason::Destroy);
        }
    }
}

// ---- ダメージ・回復 ----

/// フォロワーにダメージを与え、実際に与えたダメージを返す
pub fn damage_follower(s: &mut GameState, iid: Iid, amount: i32) -> i32 {
    if amount <= 0 {
        return 0;
    }
    let Some((p, i)) = s.find_board(iid) else {
        return 0;
    };
    let active = s.active;
    let f = &mut s.players[p].board.make_mut()[i];
    if f.has_keyword(BARRIER) {
        f.keywords = f.keywords.without(BARRIER);
        f.temp_keywords = f.temp_keywords.without(BARRIER);
        return 0;
    }
    if f.evolve == Evolve::SuperEvolved && p == active {
        return 0;
    }
    let mut amount = amount;
    if let Some(cap) = f.statics().and_then(|a| a.damage_cap.as_ref()) {
        if amount >= cap.at_least {
            amount = cap.to;
        }
    }
    f.defense -= amount;
    amount
}

/// リーダーにダメージを与える（受けるダメージの上限・加算を反映）。与えたダメージを返す
pub fn damage_leader(s: &mut GameState, p: PlayerIndex, amount: i32) -> i32 {
    if amount <= 0 {
        return 0;
    }
    let pl = &mut s.players[p];
    let mut amount = amount + pl.ext.leader_plus;
    if let Some((at_least, to, _)) = pl.ext.leader_cap {
        if amount >= at_least {
            amount = to;
        }
    }
    pl.leader_hp -= amount;
    amount
}

pub fn damage_entity(s: &mut GameState, id: Iid, amount: i32) {
    if amount <= 0 {
        return;
    }
    if is_leader(id) {
        damage_leader(s, leader_owner(id), amount);
        return;
    }
    if s.follower(id).is_some() {
        damage_follower(s, id, amount);
    }
}

pub fn heal_leader(s: &mut GameState, p: PlayerIndex, amount: i32) {
    let pl = &mut s.players[p];
    let healed = pl.leader_max_hp.min(pl.leader_hp + amount) - pl.leader_hp;
    if healed <= 0 {
        return;
    }
    pl.leader_hp += healed;
    fire_side(s, p, |_, t, _| {
        if matches!(t, Trigger::LeaderHealed) {
            Some(None)
        } else {
            None
        }
    });
}

// ---- 進化 ----

/// 進化・超進化させる（能力値と状態のみ。誘発は呼び出し側）
pub fn evolve_follower(s: &mut GameState, p: PlayerIndex, iid: Iid, kind: EvolveKind) {
    let i = s.players[p]
        .board
        .iter()
        .position(|c| c.iid == iid)
        .unwrap();
    let f = &mut s.players[p].board.make_mut()[i];
    let bonus = if kind == EvolveKind::Evolve {
        EVOLVE_BONUS
    } else {
        SUPER_EVOLVE_BONUS
    };
    f.evolve = if kind == EvolveKind::Evolve {
        Evolve::Evolved
    } else {
        Evolve::SuperEvolved
    };
    f.attack += bonus;
    f.defense += bonus;
    f.max_defense += bonus;
    let evolved = board_abilities_on(f, On::Evolved);
    let super_evolved = if kind == EvolveKind::SuperEvolve {
        board_abilities_on(f, On::SuperEvolved)
    } else {
        Vec::new()
    };
    for a in evolved {
        queue(s, a, Ctx::new(p, iid));
    }
    for a in super_evolved {
        queue(s, a, Ctx::new(p, iid));
    }
    // このバトル中の進化の回数・手札の奥義ゲージ（docs/rules.md 12章）
    if s.players[p].ext.rotation {
        s.players[p].ext.evolved_count += 1;
    }
    let d = data();
    if s.players[p]
        .hand
        .iter()
        .any(|h| d.uses_gauge[h.card as usize])
    {
        for h in s.players[p].hand.make_mut().iter_mut() {
            if d.uses_gauge[h.card as usize] {
                h.ext.gauge_evolves += 1;
            }
        }
    }
    let is_super = kind == EvolveKind::SuperEvolve;
    fire_side(s, p, |s, t, src| match t {
        Trigger::AllyEvolve { filter, super_only }
            if (!*super_only || is_super)
                && card_matches(s, &Ctx::new(p, src), iid, filter.as_ref()) =>
        {
            Some(Some(iid))
        }
        _ => None,
    });
}

/// カードを引いた後の誘発（「これを引いたとき」「自分がカードを引いたとき」。マリガンでは働かない）
pub fn after_draw(s: &mut GameState, p: PlayerIndex, drawn: &[Iid]) {
    if s.phase != Phase::Main {
        return;
    }
    for &iid in drawn {
        let Some(h) = s.players[p].hand.iter().find(|h| h.iid == iid) else {
            continue;
        };
        let (cid, x) = (h.card, h.x);
        for a in &abilities_of(cid).abilities {
            if a.trigger.on() == On::Drawn {
                let mut ctx = Ctx::new(p, iid);
                ctx.source_x = x;
                queue(s, a, ctx);
            }
        }
        fire_side(s, p, |s, t, src| match t {
            Trigger::AllyDraw { filter }
                if src != iid && card_matches(s, &Ctx::new(p, src), iid, filter.as_ref()) =>
            {
                Some(Some(iid))
            }
            _ => None,
        });
    }
}

/// 自分がカードをプレイしたときの誘発。played_as はプレイした形（アクセラレートならスペル）
pub fn fire_ally_play(
    s: &mut GameState,
    p: PlayerIndex,
    iid: Iid,
    cid: CardIdx,
    played_as: CardType,
    enhanced: bool,
) {
    fire_side(s, p, |s, t, src| match t {
        Trigger::AllyPlay {
            filter,
            enhanced: need,
        } if src != iid
            && (!*need || enhanced)
            && filter
                .as_ref()
                .and_then(|f| f.ctype)
                .is_none_or(|t| t == played_as)
            && card_idx_matches(
                s,
                &Ctx::new(p, src),
                cid,
                filter
                    .as_ref()
                    .map(|f| CardFilter {
                        ctype: None,
                        ..f.clone()
                    })
                    .as_ref(),
            ) =>
        {
            Some(Some(iid))
        }
        _ => None,
    });
    // event のカードが場・手札を離れても分かるように（スペル等）
    if !s.players[p].ext.rotation {
        return;
    }
    for q in s.queue.iter_mut() {
        if q.ctx.event == Some(iid) && q.ctx.ext.event_card.is_none() {
            q.ctx.ext.event_card = Some(cid);
        }
    }
}

/// 攻撃するときの誘発（自分・相手のフォロワーが攻撃するとき）。誘発待ちに入れたものを返す（戦闘より先に解決するため）
pub fn fire_attack_triggers(s: &mut GameState, attacker: Iid, to_leader: bool) -> Vec<Queued> {
    let Some((p, _)) = s.find_board(attacker) else {
        return Vec::new();
    };
    let before = s.queue.len();
    fire_side(s, p, |s, t, src| match t {
        Trigger::AllyAttack {
            filter,
            leader_only,
            follower_only,
        } if (!*leader_only || to_leader)
            && (!*follower_only || !to_leader)
            && card_matches(s, &Ctx::new(p, src), attacker, filter.as_ref()) =>
        {
            Some(Some(attacker))
        }
        _ => None,
    });
    let opp = opponent(p);
    fire_side(s, opp, |s, t, src| match t {
        Trigger::EnemyAttack {
            filter,
            leader_only,
        } if (!*leader_only || to_leader)
            && card_matches(s, &Ctx::new(opp, src), attacker, filter.as_ref()) =>
        {
            Some(Some(attacker))
        }
        _ => None,
    });
    s.queue.drain(before..).collect()
}

/// 自分が【土の秘術】したときの誘発
fn fire_earth_rite(s: &mut GameState, p: PlayerIndex) {
    fire_side(s, p, |_, t, _| {
        if matches!(t, Trigger::EarthRite) {
            Some(None)
        } else {
            None
        }
    });
}

/// クレストを取り除く（destroy なら【ラストワード】が働く。docs/rules.md 12章）
fn remove_crest(s: &mut GameState, iid: Iid, destroy: bool) {
    let Some((q, i)) = find_crest(s, iid) else {
        return;
    };
    let c = s.players[q].crests.make_mut().remove(i);
    if destroy {
        for a in crest_abilities_of(c.crest) {
            if a.trigger.on() == On::LastWords {
                queue(s, a, Ctx::new(q, iid));
            }
        }
    }
}

/// 能力の元（場のカード・クレスト）の「順に1つ」「働いていないランダム1つ」の状態。
/// 元が無くなっていれば、無くなったときに文脈へ写したもの
fn source_options<'a>(s: &'a mut GameState, ctx: &'a mut Ctx) -> Option<(&'a mut u8, &'a mut u16)> {
    let iid = ctx.source;
    if let Some((q, i)) = s.find_board(iid) {
        let b = &mut s.players[q].board.make_mut()[i];
        return Some((&mut b.ext.cycle, &mut b.ext.used_options));
    }
    if let Some((q, i)) = find_crest(s, iid) {
        let c = &mut s.players[q].crests.make_mut()[i];
        return Some((&mut c.cycle, &mut c.used_options));
    }
    ctx.ext.source_options.as_mut().map(|(c, u)| (c, u))
}

/// 誘発待ちのうち元が iid の能力に、「順に1つ」「働いていないもの」の状態を写す（元が先に無くなっても分かるように）
pub fn keep_source_options(s: &mut GameState, iid: Iid, cycle: u8, used: u16) {
    if cycle == 0 && used == 0 {
        return;
    }
    for q in s.queue.iter_mut() {
        if q.ctx.source == iid {
            q.ctx.ext.source_options = Some((cycle, used));
        }
    }
}

/// copy・transform の元のカードを count 枚（kinds なら違う種類）選ぶ
fn pick_cards(
    s: &mut GameState,
    ctx: &Ctx,
    from: &CardSource,
    count: i32,
    kinds: bool,
) -> Vec<CardIdx> {
    let p = ctx.controller;
    let count = count.max(0) as usize;
    let live = |s: &GameState, id: Iid| {
        s.board_card(id)
            .map(|b| b.card)
            .or_else(|| s.hand_card(id).map(|h| h.card))
    };
    let mut pool: Vec<CardIdx> = match from {
        CardSource::Zone {
            zone,
            side,
            filter,
            pick,
        } => {
            let (ps, n) = side_players(s, ctx, *side);
            let mut v = Vec::new();
            for &q in &ps[..n] {
                match zone {
                    Zone::Hand => {
                        for h in s.players[q].hand.iter() {
                            if card_matches(s, ctx, h.iid, filter.as_ref()) {
                                v.push(h.card);
                            }
                        }
                    }
                    Zone::Deck => {
                        for r in s.players[q].deck.iter() {
                            if filter
                                .as_ref()
                                .is_none_or(|f| deck_card_matches(s, ctx, q, r, f))
                            {
                                v.push(r.card);
                            }
                        }
                    }
                    Zone::Board => {
                        for b in s.players[q].board.iter() {
                            if card_matches(s, ctx, b.iid, filter.as_ref()) {
                                v.push(b.card);
                            }
                        }
                    }
                }
            }
            match pick {
                Pick::Left => {
                    v.truncate(count);
                    return v;
                }
                Pick::All => return v,
                Pick::Random => v,
            }
        }
        CardSource::Destroyed {
            filter,
            highest_cost,
        } => {
            let amulets = filter.as_ref().and_then(|f| f.ctype) == Some(CardType::Amulet);
            let list = if amulets {
                &s.players[p].destroyed_amulets
            } else {
                &s.players[p].graveyard_followers
            };
            let mut v: Vec<CardIdx> = list
                .iter()
                .copied()
                .filter(|&c| card_idx_matches(s, ctx, c, filter.as_ref()))
                .collect();
            if *highest_cost {
                if let Some(m) = v.iter().map(|&c| card(c).cost).max() {
                    v.retain(|&c| card(c).cost == m);
                }
            }
            v
        }
        CardSource::Slot { slot } => {
            let mut v = Vec::new();
            for &id in ctx.slot(*slot) {
                let c = live(s, id)
                    .or_else(|| ctx.ext.slot_cards.iter().find(|x| x.0 == id).map(|x| x.1));
                if let Some(c) = c {
                    for _ in 0..count {
                        v.push(c);
                    }
                }
            }
            return v;
        }
        CardSource::This => {
            let c = live(s, ctx.source).or(ctx.ext.source_card);
            return c.map(|c| vec![c; count]).unwrap_or_default();
        }
        CardSource::Event => {
            let c = ctx.event.and_then(|e| live(s, e)).or(ctx.ext.event_card);
            return c.map(|c| vec![c; count]).unwrap_or_default();
        }
        CardSource::Cards { ids } => {
            let mut v = Vec::new();
            for _ in 0..count {
                if ids.is_empty() {
                    break;
                }
                let k = if ids.len() == 1 {
                    0
                } else {
                    s.rng_int(ids.len())
                };
                v.push(ids[k]);
            }
            return v;
        }
    };
    if kinds {
        let mut ks: Vec<CardIdx> = Vec::new();
        for c in pool {
            if !ks.contains(&c) {
                ks.push(c);
            }
        }
        pool = ks;
    }
    s.shuffle(&mut pool);
    pool.truncate(count);
    pool
}

/// スロットに入れたカードを記録する（場・手札を離れても選んだカードが分かるように）
fn record_slot_cards(s: &GameState, ctx: &mut Ctx, ids: &[Iid]) {
    // スターターの対戦では使わない（局面を変えないため）
    if !s.players[ctx.controller].ext.rotation {
        return;
    }
    for &id in ids {
        let rec = s
            .find_board(id)
            .map(|(q, i)| (s.players[q].board[i].card, q))
            .or_else(|| s.find_hand(id).map(|(q, i)| (s.players[q].hand[i].card, q)));
        if let Some((c, q)) = rec {
            match ctx.ext.slot_cards.iter_mut().find(|x| x.0 == id) {
                Some(x) => *x = (id, c, q),
                None => ctx.ext.slot_cards.push((id, c, q)),
            }
        }
    }
}

// ---- 誘発のきっかけ ----

/// 「自分のターン開始時」の能力を誘発させる（crests: クレスト、rest: 場・信仰・手札・デッキ。docs/rules.md 11章の処理順）
pub fn fire_turn_start_parts(s: &mut GameState, crests: bool, rest: bool) {
    let p = s.active;
    fire_side_parts(s, p, crests, rest, |_, t, _| {
        if matches!(t, Trigger::TurnStart) {
            Some(None)
        } else {
            None
        }
    });
}

pub fn fire_turn_end(s: &mut GameState) {
    let [me, opp] = s.turn_order();
    fire_side(s, me, |_, t, _| {
        if matches!(t, Trigger::TurnEnd { whose: Whose::Me }) {
            Some(None)
        } else {
            None
        }
    });
    fire_side(s, opp, |_, t, _| {
        if matches!(
            t,
            Trigger::TurnEnd {
                whose: Whose::Opponent
            }
        ) {
            Some(None)
        } else {
            None
        }
    });
}

/// 自分がアミュレット（iid）を【アクト】したときの誘発（filter はアクトしたアミュレットで判定する。event は無し）
pub fn fire_ally_act(s: &mut GameState, p: PlayerIndex, iid: Iid) {
    fire_side(s, p, |s, t, src| match t {
        Trigger::AllyAct { filter } if card_matches(s, &Ctx::new(p, src), iid, filter.as_ref()) => {
            Some(None)
        }
        _ => None,
    });
}

/// 自分が融合したときの誘発（materials は素材のカード）
pub fn fire_ally_fuse(s: &mut GameState, p: PlayerIndex, materials: &[CardIdx]) {
    fire_side(s, p, |s, t, src| match t {
        Trigger::AllyFuse { filter } => {
            let ctx = Ctx::new(p, src);
            materials
                .iter()
                .any(|&c| card_idx_matches(s, &ctx, c, filter.as_ref()))
                .then_some(None)
        }
        _ => None,
    });
}

/// 手札のカード（iid）をスペルブーストする
pub fn fire_spellboost(s: &mut GameState, p: PlayerIndex, iid: Iid, times: i32) {
    for _ in 0..times {
        let Some(hi) = s.players[p].hand.iter().position(|c| c.iid == iid) else {
            return;
        };
        s.players[p].hand.make_mut()[hi].boosts += 1;
        fire_hand(s, p, hi, On::Spellboost);
    }
}

/// 能力を直ちに解決スタックに積む（行動による発動）。先に書かれた能力から解決するよう、逆順に積む
pub fn push_abilities(s: &mut GameState, abilities: &[&'static Ability], ctx: &Ctx) {
    for a in abilities.iter().rev() {
        push_ability(s, a, ctx);
    }
}

/// カード自身の能力のうち on のものを、push_abilities(s, &own_abilities(cid, on), ctx) と同じ順に積む
pub fn push_own_abilities(s: &mut GameState, cid: CardIdx, on: On, ctx: &Ctx) {
    for a in abilities_of(cid)
        .abilities
        .iter()
        .filter(|a| a.trigger.on() == on)
        .rev()
    {
        push_ability(s, a, ctx);
    }
}

fn push_ability(s: &mut GameState, a: &'static Ability, ctx: &Ctx) {
    let c = Ctx {
        slots: Vec::new(),
        vars: ctx.vars.clone(),
        ..ctx.clone_shallow()
    };
    push_frame(s, Effects::Dsl(&a.effects), c);
}

impl Ctx {
    /// slots・vars を空にした複製
    pub fn clone_shallow(&self) -> Ctx {
        Ctx {
            controller: self.controller,
            source: self.source,
            event: self.event,
            slots: Vec::new(),
            vars: Vec::new(),
            enhanced: self.enhanced,
            source_x: self.source_x,
            source_attack: self.source_attack,
            ext: CtxExt {
                slot_cards: Vec::new(),
                ..self.ext.clone()
            },
        }
    }
}

pub fn push_internal(s: &mut GameState, effects: &[FEff], ctx: Ctx) {
    push_frame(s, Effects::internal(effects), ctx);
}

// ---- 効果の実行 ----

/// 選択された対象を記録して再開する
pub fn answer_choose(s: &mut GameState, targets: Vec<Iid>) {
    let Some(Pending::Choose {
        player,
        slot,
        candidates,
        ..
    }) = s.pending.take()
    else {
        panic!("選択待ちではありません")
    };
    let frame = s.stack.last().expect("選択待ちではありません");
    if discards_or_returns(frame, slot) {
        hide_hand_choice(s, player, &candidates);
    }
    let mut ctx = std::mem::take(&mut s.stack.last_mut().expect("選択待ちではありません").ctx);
    record_slot_cards(s, &mut ctx, &targets);
    let frame = s.stack.last_mut().expect("選択待ちではありません");
    frame.ctx = ctx;
    frame.ctx.set_slot(slot, targets);
    frame.pc += 1;
}

/// 能力の残りの効果で、slot のカードを捨てるか山札に戻すか
fn discards_or_returns(frame: &Frame, slot: SlotId) -> bool {
    (frame.pc + 1..frame.effects.len()).any(|i| {
        matches!(
            frame.effects.get(i),
            FEff::Dsl(
                Effect::Discard {
                    target: Target::Slot { slot: x },
                    ..
                } | Effect::ReturnToDeck {
                    target: Target::Slot { slot: x },
                    ..
                }
            ) if *x == slot
        )
    })
}

/// 手札から選んで捨てる・山札に戻すカードは、相手にはどれを選んだか分からない（docs/rules.md）。
/// 候補だった手札のカードは、相手に分かっていた中身（公開）や条件付きで引いた条件の印を消す
fn hide_hand_choice(s: &mut GameState, p: PlayerIndex, candidates: &[Iid]) {
    let marked = |h: &HandCard| candidates.contains(&h.iid) && (h.revealed || h.drawn_by.is_some());
    if !s.players[p].hand.iter().any(marked) {
        return;
    }
    for h in s.players[p].hand.make_mut().iter_mut() {
        if candidates.contains(&h.iid) {
            h.revealed = false;
            h.drawn_by = None;
        }
    }
}

pub fn answer_mode(s: &mut GameState, index: usize) {
    let Some(Pending::Mode { .. }) = s.pending else {
        panic!("モード選択待ちではありません")
    };
    let frame = s.stack.last_mut().expect("モード選択待ちではありません");
    let FEff::Dsl(Effect::Mode { options, .. }) = frame.effects.get(frame.pc) else {
        panic!("モード選択の効果がありません")
    };
    splice(
        frame,
        options.get(index).map(|v| v.as_slice()).unwrap_or(&[]),
        1,
    );
    s.pending = None;
}

/// 現在の効果を effects（times 回繰り返し）で置き換える（if・repeat 等の展開）
fn splice(frame: &mut Frame, effects: &'static [Effect], times: usize) {
    let pc = frame.pc;
    let n = frame.effects.len();
    if pc == 0 && n == 1 && times == 1 {
        frame.effects = Effects::Dsl(effects);
        return;
    }
    let mut v = Vec::with_capacity(n + effects.len() * times);
    v.extend((0..pc).map(|i| frame.effects.get(i)));
    for _ in 0..times {
        v.extend(effects.iter().map(FEff::Dsl));
    }
    v.extend((pc + 1..n).map(|i| frame.effects.get(i)));
    frame.effects = Effects::List(v);
}

/// 現在の効果を、いくつかの効果の並びをつないだもので置き換える
fn splice_lists(frame: &mut Frame, lists: &[&'static [Effect]]) {
    let pc = frame.pc;
    let n = frame.effects.len();
    let mut v = Vec::with_capacity(n + lists.iter().map(|l| l.len()).sum::<usize>());
    v.extend((0..pc).map(|i| frame.effects.get(i)));
    for l in lists {
        v.extend(l.iter().map(FEff::Dsl));
    }
    v.extend((pc + 1..n).map(|i| frame.effects.get(i)));
    frame.effects = Effects::List(v);
}

fn pick_random(s: &mut GameState, mut pool: Vec<Iid>, count: usize) -> Vec<Iid> {
    s.shuffle(&mut pool);
    pool.truncate(count);
    pool
}

/// 自分の場の証拠・アミュレットの位置
fn evidence_amulet(s: &GameState, p: PlayerIndex) -> Option<usize> {
    s.players[p].board.iter().position(|c| c.evidence.is_some())
}

fn sigil_amulet(s: &GameState, p: PlayerIndex) -> Option<usize> {
    s.players[p]
        .board
        .iter()
        .position(|c| !c.is_follower && c.sigils.is_some())
}

/// 効果を1つ実行する（frame はスタックから外してある）。選択待ちで中断したら false
fn exec(s: &mut GameState, frame: &mut Frame, eff: &'static Effect) -> bool {
    #[cfg(feature = "coverage")]
    coverage::hit(eff.op_name());
    let p = frame.ctx.controller;
    macro_rules! targets {
        ($t:expr) => {
            resolve_target(s, &frame.ctx, $t)
        };
    }
    macro_rules! val {
        ($v:expr) => {
            eval_value(s, &frame.ctx, $v)
        };
    }
    match eff {
        Effect::Choose { slot, from, count } => {
            let candidates = choose_candidates(s, &frame.ctx, from);
            if candidates.len() <= *count as usize {
                record_slot_cards(s, &mut frame.ctx, &candidates);
                frame.ctx.set_slot(*slot, candidates);
                frame.pc += 1;
                return true;
            }
            s.pending = Some(Pending::Choose {
                player: p,
                slot: *slot,
                candidates,
                count: *count as usize,
            });
            return false;
        }
        Effect::Random { slot, from, count } => {
            let pool = targets!(from);
            let n = val!(count).max(0) as usize;
            let v = pick_random(s, pool, n);
            record_slot_cards(s, &mut frame.ctx, &v);
            frame.ctx.set_slot(*slot, v);
        }
        Effect::Mode { options, all_if } => {
            if all_if.as_ref().is_some_and(|c| eval_cond(s, &frame.ctx, c)) {
                let lists: Vec<&'static [Effect]> = options.iter().map(|o| o.as_slice()).collect();
                splice_lists(frame, &lists);
                return true;
            }
            s.pending = Some(Pending::Mode {
                player: p,
                options: options.len(),
            });
            return false;
        }
        Effect::Damage { target, amount } => {
            let amount = val!(amount);
            for id in targets!(target) {
                damage_entity(s, id, amount);
            }
        }
        Effect::Distribute { target, amount } => {
            // 古いフォロワーから順に、その体力と同じ値を割り当てる。ダメージは同時に与える
            let mut rest = val!(amount);
            let ids = targets!(target);
            let mut fs: Vec<(i32, Iid, i32)> = ids
                .iter()
                .filter_map(|&id| s.follower(id).map(|f| (f.order, f.iid, f.defense)))
                .collect();
            // 対象にリーダーがあれば、フォロワーに割り当てた残りをリーダーに（劫焔のキマイラ。docs/rules.md 11章 ⚠️）
            let leader = ids.iter().copied().find(|&id| is_leader(id));
            fs.sort_by_key(|x| x.0);
            let mut plan = Vec::new();
            for (_, iid, def) in fs {
                if rest <= 0 {
                    break;
                }
                let n = rest.min(def.max(0));
                plan.push((iid, n));
                rest -= n;
            }
            for (iid, n) in plan {
                damage_follower(s, iid, n);
            }
            if let Some(l) = leader.filter(|_| rest > 0) {
                damage_entity(s, l, rest);
            }
        }
        Effect::Destroy { target, count_var } => {
            let mut count = 0;
            for id in targets!(target) {
                if find_crest(s, id).is_some() {
                    remove_crest(s, id, true);
                    count += 1;
                    continue;
                }
                let Some(c) = s.board_card(id) else { continue };
                if c.is_follower && immune_to_effect_destroy(s, id) {
                    continue;
                }
                leave_board(s, id, LeaveReason::Destroy);
                count += 1;
            }
            if let Some(v) = count_var {
                frame.ctx.set_var(*v, count);
            }
        }
        Effect::Banish { target, count_var } => {
            let mut count = 0;
            for id in targets!(target) {
                if find_crest(s, id).is_some() {
                    remove_crest(s, id, false);
                    count += 1;
                } else if let Some((q, i)) = find_deck(s, id) {
                    s.players[q].deck.make_mut().remove(i);
                    s.take_kept(q, id);
                    count += 1;
                } else if s.find_board(id).is_some() {
                    leave_board(s, id, LeaveReason::Banish);
                    count += 1;
                } else if let Some((q, i)) = s.find_hand(id) {
                    // 手札のカードの消滅（地害の兎。墓場には行かない）
                    s.players[q].hand.make_mut().remove(i);
                    count += 1;
                }
            }
            if let Some(v) = count_var {
                frame.ctx.set_var(*v, count);
            }
        }
        Effect::Bounce { target } => {
            for id in targets!(target) {
                leave_board(s, id, LeaveReason::Bounce);
            }
        }
        Effect::Heal { target, amount } => {
            let amount = val!(amount);
            for id in targets!(target) {
                if is_leader(id) {
                    heal_leader(s, leader_owner(id), amount);
                } else if let Some((q, i)) = s.find_follower(id) {
                    // フォロワーの回復は最大体力まで（docs/rules.md 12章）
                    let f = &mut s.players[q].board.make_mut()[i];
                    f.defense = f.max_defense.min(f.defense + amount.max(0));
                }
            }
        }
        Effect::SetDefense { target, value } => {
            for id in targets!(target) {
                if let Some((q, i)) = s.find_follower(id) {
                    let f = &mut s.players[q].board.make_mut()[i];
                    f.defense = *value;
                    f.max_defense = *value;
                }
            }
        }
        Effect::Draw {
            count,
            filter,
            side,
            slot,
            kinds,
        } => {
            let n = val!(count);
            let q = match side {
                Some(Side::Opponent) => opponent(p),
                _ => p,
            };
            let drawn = match filter {
                Some(f) if *kinds => {
                    // 違う種類を n 枚（1枚ずつ、引いた種類を除いて引く）
                    let hint = draw_hint(s, &frame.ctx, f);
                    let mut got: Vec<CardIdx> = Vec::new();
                    let mut drawn = Vec::new();
                    for _ in 0..n {
                        let ctx = &frame.ctx;
                        let gotv = got.clone();
                        let pred = |st: &GameState, r: &CardRef| {
                            !gotv.contains(&r.card) && deck_card_matches(st, ctx, q, r, f)
                        };
                        let d = s.draw_cards(q, 1, Some(&pred), Some(hint));
                        if d.is_empty() {
                            break;
                        }
                        if let Some(h) = s.hand_card(d[0]) {
                            got.push(h.card);
                        }
                        drawn.extend(d);
                    }
                    drawn
                }
                Some(f) => {
                    let hint = draw_hint(s, &frame.ctx, f);
                    let ctx = &frame.ctx;
                    let pred = |st: &GameState, r: &CardRef| deck_card_matches(st, ctx, q, r, f);
                    s.draw_cards(q, n, Some(&pred), Some(hint))
                }
                None => s.draw_cards(q, n, None, None),
            };
            if let Some(sl) = slot {
                frame.ctx.set_slot(*sl, drawn.clone());
            }
            after_draw(s, q, &drawn);
        }
        Effect::DrawAll { filter, slot } => {
            let n = {
                let ctx = &frame.ctx;
                s.players[p]
                    .deck
                    .iter()
                    .filter(|r| deck_card_matches(s, ctx, p, r, filter))
                    .count() as i32
            };
            let hint = draw_hint(s, &frame.ctx, filter);
            let drawn = {
                let ctx = &frame.ctx;
                let pred = |st: &GameState, r: &CardRef| deck_card_matches(st, ctx, p, r, filter);
                s.draw_cards(p, n, Some(&pred), Some(hint))
            };
            if let Some(sl) = slot {
                frame.ctx.set_slot(*sl, drawn.clone());
            }
            after_draw(s, p, &drawn);
        }
        Effect::AddToHand {
            card_id,
            count,
            slot,
        } => {
            let mut ids = Vec::new();
            let mut i = 0;
            while i < val!(count) {
                let h = revealed_hand_card(s, *card_id, None);
                let iid = h.iid;
                if s.add_hand_card(p, h) {
                    ids.push(iid);
                }
                i += 1;
            }
            if let Some(sl) = slot {
                frame.ctx.set_slot(*sl, ids);
            }
        }
        Effect::Summon {
            card_id,
            count,
            slot,
            side,
        } => {
            let q = match side {
                Some(Side::Opponent) => opponent(p),
                _ => p,
            };
            let mut ids = Vec::new();
            let mut i = 0;
            while i < val!(count) {
                let c = s.new_board_card(*card_id, None);
                let iid = c.iid;
                if !enter_board(s, q, c) {
                    break;
                }
                ids.push(iid);
                i += 1;
            }
            if let Some(sl) = slot {
                frame.ctx.set_slot(*sl, ids);
            }
        }
        Effect::SummonCopy { from, slot } => {
            let mut ids = Vec::new();
            for id in frame.ctx.slot(*from).to_vec() {
                let src = s
                    .hand_card(id)
                    .map(|h| h.card)
                    .or_else(|| s.board_card(id).map(|b| b.card));
                let Some(cid) = src else { continue };
                let c = s.new_board_card(cid, None);
                let iid = c.iid;
                if enter_board(s, p, c) {
                    ids.push(iid);
                }
            }
            if let Some(sl) = slot {
                frame.ctx.set_slot(*sl, ids);
            }
        }
        Effect::Reanimate { cost, slot } => {
            let costs: Vec<(CardIdx, i32)> = s.players[p]
                .graveyard_followers
                .iter()
                .map(|&id| (id, card(id).cost))
                .filter(|x| x.1 <= *cost)
                .collect();
            if let Some(max) = costs.iter().map(|x| x.1).max() {
                let mut best: Vec<CardIdx> = Vec::new();
                for &(id, c) in &costs {
                    if c == max && !best.contains(&id) {
                        best.push(id);
                    }
                }
                let k = s.rng_int(best.len());
                let chosen = best[k];
                let c = s.new_board_card(chosen, None);
                let iid = c.iid;
                if enter_board(s, p, c) {
                    if let Some(sl) = slot {
                        frame.ctx.set_slot(*sl, vec![iid]);
                    }
                }
            } else if let Some(sl) = slot {
                frame.ctx.set_slot(*sl, Vec::new());
            }
        }
        Effect::SummonFromDeck { filter, kinds } => {
            let mut ks: Vec<CardIdx> = Vec::new();
            for r in &s.players[p].deck {
                if !ks.contains(&r.card) && deck_card_matches(s, &frame.ctx, p, r, filter) {
                    ks.push(r.card);
                }
            }
            s.shuffle(&mut ks);
            for &cid in ks.iter().take((*kinds).max(0) as usize) {
                if !s.can_add_to_board(p) {
                    break;
                }
                // 同じカードが複数あれば、条件に合うもの（手札でコストが変わったものを含む）を出す
                let idx = s.players[p]
                    .deck
                    .iter()
                    .position(|r| r.card == cid && deck_card_matches(s, &frame.ctx, p, r, filter))
                    .unwrap();
                let r = s.players[p].deck.make_mut().remove(idx);
                // 場に出したカードには手札で付いた状態を使わない（山札から出すのはアミュレットだけで、場では状態が効かない）
                s.take_kept(p, r.iid);
                let h = s.new_hand_card(r.card, Some(r.iid));
                let c = s.new_board_card(r.card, Some(&h));
                enter_board(s, p, c);
            }
        }
        Effect::SummonDestroyedAmulet => {
            let da = &s.players[p].destroyed_amulets;
            if let Some(max) = da.iter().map(|&id| card(id).cost).max() {
                let mut best: Vec<CardIdx> = Vec::new();
                for &id in da {
                    if card(id).cost == max && !best.contains(&id) {
                        best.push(id);
                    }
                }
                let k = s.rng_int(best.len());
                let c = s.new_board_card(best[k], None);
                enter_board(s, p, c);
            }
        }
        Effect::ReturnToDeck { target, count_var } => {
            let ids = targets!(target);
            let mut moved = 0;
            for &id in &ids {
                let Some((q, i)) = s.find_hand(id) else {
                    continue;
                };
                let h = s.players[q].hand.make_mut().remove(i);
                s.return_to_deck(q, h);
                moved += 1;
            }
            if let Some(v) = count_var {
                frame.ctx.set_var(*v, moved);
            }
            if !ids.is_empty() {
                let mut deck = std::mem::take(&mut s.players[p].deck).into_vec();
                s.shuffle(&mut deck);
                s.players[p].deck = deck.into();
            }
        }
        Effect::Discard { target, count_var } => {
            let var = cost_var_of(target);
            let mut discarded = 0;
            for id in targets!(target) {
                let Some((q, i)) = s.find_hand(id) else {
                    continue;
                };
                discarded += 1;
                frame.ctx.set_var(var, hand_cost(&s.players[q].hand[i]));
                let h = s.players[q].hand.make_mut().remove(i);
                s.players[q].graveyard += 1;
                let on_discarded = own_abilities(h.card, On::Discarded);
                // 捨てたカードは相手には見えない。公開されていたカードと、【捨てられたとき】が働くカードは分かる
                if !h.revealed && on_discarded.is_empty() {
                    s.players[q].hidden_discards.make_mut().push(h.card);
                }
                let cost = hand_cost(&h);
                let rotation = s.players[q].ext.rotation;
                for a in on_discarded {
                    let mut ctx = Ctx::new(q, h.iid);
                    if rotation {
                        ctx.ext.source_cost = Some(cost);
                        ctx.ext.source_card = Some(h.card);
                    }
                    queue(s, a, ctx);
                }
            }
            if let Some(v) = count_var {
                frame.ctx.set_var(*v, discarded);
            }
        }
        Effect::Transform {
            target,
            card_id,
            from,
        } => {
            for id in targets!(target) {
                let cid = match (card_id, from) {
                    (Some(c), _) => Some(*c),
                    (None, Some(src)) => {
                        let ctx = frame.ctx.clone();
                        pick_cards(s, &ctx, src, 1, false).first().copied()
                    }
                    (None, None) => None,
                };
                let Some(cid) = cid else { continue };
                if let Some((q, i)) = find_deck(s, id) {
                    s.players[q].deck.make_mut()[i].card = cid;
                    s.take_kept(q, id);
                    continue;
                }
                transform(s, id, cid);
            }
        }
        Effect::Buff {
            target,
            attack,
            defense,
            duration,
        } => {
            let a = val!(attack);
            let d = val!(defense);
            for id in targets!(target) {
                if let Some((q, i)) = s.find_follower(id) {
                    let f = &mut s.players[q].board.make_mut()[i];
                    if *duration == Some(Duration::EndOfTurn) {
                        f.temp_attack += a;
                    } else {
                        f.attack = (f.attack + a).max(0);
                    }
                    f.defense += d;
                    f.max_defense += d;
                    // 「これの攻撃力か体力が場で+されたとき」（docs/rules.md 12章）
                    if a > 0 || d > 0 {
                        let buffed = board_abilities_on(f, On::Buffed);
                        let once_ok = !buffed.is_empty();
                        if once_ok {
                            let turn_id = s.players[q].turn_count;
                            for (k, ab) in buffed.into_iter().enumerate() {
                                if ab.once_per_own_turn {
                                    let key = 200u8.wrapping_add(k as u8);
                                    let used = &mut s.players[q].board.make_mut()[i].used_once;
                                    if !use_once(used, key, turn_id) {
                                        continue;
                                    }
                                }
                                queue(s, ab, Ctx::new(q, id));
                            }
                        }
                    }
                    continue;
                }
                if let Some((q, i)) = s.find_hand(id) {
                    let h = &mut s.players[q].hand.make_mut()[i];
                    h.attack_mod += a;
                    h.defense_mod += d;
                    continue;
                }
                if let Some((q, i)) = find_deck(s, id) {
                    let r = s.players[q].deck[i];
                    let mut h = match s.take_kept(q, id) {
                        Some(h) => h,
                        None => s.new_hand_card(r.card, Some(r.iid)),
                    };
                    h.attack_mod += a;
                    h.defense_mod += d;
                    if hand_state_changed(&h) {
                        s.players[q].deck_kept.push(h);
                    }
                }
            }
        }
        Effect::Grant {
            target,
            keywords,
            max_attacks,
            abilities,
            duration,
            no_attack,
        } => {
            let kw = keywords.unwrap_or_default();
            let until = s.turn + 1;
            for id in targets!(target) {
                if let Some((q, i)) = s.find_board(id) {
                    let b = &mut s.players[q].board.make_mut()[i];
                    match duration {
                        Some(Duration::EndOfTurn) => b.temp_keywords = b.temp_keywords.with(kw),
                        Some(Duration::UntilOpponentTurnEnd) if !kw.is_empty() => {
                            b.ext.timed_keywords = b.ext.timed_keywords.with(kw);
                            b.ext.timed_until = until;
                        }
                        _ => b.keywords = b.keywords.with(kw),
                    }
                    if *no_attack {
                        match duration {
                            Some(Duration::EndOfTurn) => b.ext.temp_no_attack = true,
                            Some(Duration::UntilOpponentTurnEnd) => {
                                b.cannot_attack_until = Some(until)
                            }
                            _ => b.ext.no_attack = true,
                        }
                    }
                    if let (true, Some(m)) = (b.is_follower, max_attacks) {
                        if *duration == Some(Duration::EndOfTurn) {
                            b.ext.temp_max_attacks = b.ext.temp_max_attacks.max(*m);
                        } else {
                            b.max_attacks = b.max_attacks.max(*m);
                        }
                    }
                    if let Some(ab) = abilities {
                        b.granted.extend(ab.iter());
                    }
                    continue;
                }
                if let Some((q, i)) = s.find_hand(id) {
                    let h = &mut s.players[q].hand.make_mut()[i];
                    h.keywords = h.keywords.with(kw);
                }
            }
        }
        Effect::LoseKeyword { target, keyword } => {
            for id in targets!(target) {
                if let Some(b) = s.board_card_mut(id) {
                    b.keywords = b.keywords.without(*keyword);
                    b.temp_keywords = b.temp_keywords.without(*keyword);
                }
            }
        }
        Effect::CannotAttack { target, .. } => {
            let until = s.turn + 1;
            for id in targets!(target) {
                if let Some((q, i)) = s.find_follower(id) {
                    s.players[q].board.make_mut()[i].cannot_attack_until = Some(until);
                }
            }
        }
        Effect::Evolve { target, kind } => {
            for id in targets!(target) {
                if let Some((q, i)) = s.find_follower(id) {
                    if s.players[q].board[i].evolve == Evolve::None {
                        evolve_follower(s, q, id, *kind);
                    }
                }
            }
        }
        Effect::Spellboost { target, times } => {
            for id in targets!(target) {
                if let Some((q, _)) = s.find_hand(id) {
                    fire_spellboost(s, q, id, *times);
                }
            }
        }
        Effect::CostChange {
            target,
            amount,
            duration,
        } => {
            for id in targets!(target) {
                if let Some((q, i)) = s.find_hand(id) {
                    let h = &mut s.players[q].hand.make_mut()[i];
                    if *duration == Some(Duration::EndOfTurn) {
                        h.ext.temp_cost_mod += amount;
                    } else {
                        h.cost_mod += amount;
                    }
                }
            }
        }
        Effect::AddX { target, amount } => {
            for id in targets!(target) {
                if let Some((q, i)) = s.find_hand(id) {
                    let h = &mut s.players[q].hand.make_mut()[i];
                    h.x = Some(h.x.unwrap_or(0) + amount);
                } else if let Some((q, i)) = s.find_follower(id) {
                    let f = &mut s.players[q].board.make_mut()[i];
                    f.x = Some(f.x.unwrap_or(0) + amount);
                }
            }
        }
        Effect::Countdown { target, amount } => {
            for id in targets!(target) {
                if let Some((q, i)) = find_crest(s, id) {
                    let c = &mut s.players[q].crests.make_mut()[i];
                    if let Some(cd) = c.countdown {
                        c.countdown = Some(cd + amount);
                        if cd + amount <= 0 {
                            remove_crest(s, id, true);
                        }
                    }
                    continue;
                }
                let Some((q, i)) = s.find_board(id) else {
                    continue;
                };
                let a = &mut s.players[q].board.make_mut()[i];
                if a.is_follower {
                    continue;
                }
                if let Some(cd) = a.countdown {
                    a.countdown = Some(cd + amount);
                    if cd + amount <= 0 {
                        leave_board(s, id, LeaveReason::Destroy);
                    }
                }
            }
        }
        Effect::GainPp { amount } => {
            // 回復は PP最大値まで。エクストラPPで最大値を超えている場合は減らさない
            let v = match amount {
                PpAmount::Max(_) => None,
                PpAmount::Value(v) => Some(val!(v)),
            };
            let pl = &mut s.players[p];
            pl.pp = pl.pp.max(match v {
                None => pl.max_pp,
                Some(v) => pl.max_pp.min(pl.pp + v),
            });
        }
        Effect::AddMaxPp { amount } => {
            let pl = &mut s.players[p];
            pl.max_pp = MAX_PP.min(pl.max_pp + amount);
        }
        Effect::AddCombo { amount } => s.players[p].combo += amount,
        Effect::AddGraveyard { amount } => s.players[p].graveyard += amount,
        Effect::AddSigils { amount } => {
            let n = val!(amount);
            if let Some(i) = sigil_amulet(s, p) {
                let a = &mut s.players[p].board.make_mut()[i];
                a.sigils = Some(a.sigils.unwrap_or(0) + n);
            } else if s.can_add_to_board(p) {
                let mut c = s.new_board_card(data().earth_sigil_token, None);
                if !c.is_follower {
                    c.sigils = Some(n);
                }
                enter_board(s, p, c);
            }
        }
        Effect::EarthRite { amount, then } => {
            if let Some(i) = sigil_amulet(s, p) {
                let a = &mut s.players[p].board.make_mut()[i];
                if a.sigils.unwrap_or(0) >= *amount {
                    let left = a.sigils.unwrap_or(0) - amount;
                    a.sigils = Some(left);
                    let iid = a.iid;
                    // スタックが0になった【土の印】アミュレットは破壊される（紐づいた能力より先）
                    if left == 0 {
                        leave_board(s, iid, LeaveReason::Destroy);
                    }
                    fire_earth_rite(s, p);
                    splice(frame, then, 1);
                    return true;
                }
            }
        }
        Effect::Necromancy { amount, then } => {
            if s.players[p].graveyard >= *amount {
                s.players[p].graveyard -= amount;
                splice(frame, then, 1);
                return true;
            }
        }
        Effect::Crest { crest_id, side } => {
            let holder = if *side == Side::Me { p } else { opponent(p) };
            assert!(
                data().crest_abilities[*crest_id as usize].is_some(),
                "クレストの能力が未定義"
            );
            let iid = s.new_iid();
            let order = s.next_order;
            s.next_order += 1;
            let countdown = data().crests[*crest_id as usize].countdown;
            s.players[holder].crests.make_mut().push(CrestInstance {
                iid,
                crest: *crest_id,
                countdown,
                order,
                used_once: Vec::new(),
                cycle: 0,
                used_options: 0,
            });
        }
        Effect::ApocalypseDeck => {
            let mut deck = Vec::new();
            for &(cid, n) in &data().apocalypse_deck {
                for _ in 0..n {
                    let iid = s.new_iid();
                    deck.push(CardRef { iid, card: cid });
                }
            }
            s.shuffle(&mut deck);
            s.players[p].deck = deck.into();
            s.players[p].deck_kept.clear();
        }
        Effect::SetLeaderMaxHp { side, value } => {
            let t = &mut s.players[if *side == Side::Me { p } else { opponent(p) }];
            t.leader_max_hp = *value;
            t.leader_hp = t.leader_hp.min(*value);
        }
        Effect::HalveLeaderMaxHp { side } => {
            let (ps, n) = side_players(s, &frame.ctx, *side);
            for &q in &ps[..n] {
                let t = &mut s.players[q];
                // 端数は切り上げ（docs/rules.md 12章 ⚠️）
                t.leader_max_hp = (t.leader_max_hp + 1) / 2;
                t.leader_hp = t.leader_hp.min(t.leader_max_hp);
            }
        }
        Effect::SpendEvidence { amount, then } => {
            if let Some(i) = evidence_amulet(s, p) {
                let a = &mut s.players[p].board.make_mut()[i];
                let have = a.evidence.unwrap_or(0);
                if have >= *amount {
                    a.evidence = Some(have - amount);
                    let iid = a.iid;
                    // 数が0になった証拠・アミュレットは破壊される（消滅ではない。docs/rules.md 12章）
                    if have - amount == 0 {
                        leave_board(s, iid, LeaveReason::Destroy);
                    }
                    splice(frame, then, 1);
                    return true;
                }
            }
        }
        Effect::SwapStats { target } => {
            for id in targets!(target) {
                if let Some((q, i)) = s.find_hand(id) {
                    let h = &mut s.players[q].hand.make_mut()[i];
                    let cd = card(h.card);
                    let (a, d) = (cd.attack + h.attack_mod, cd.defense + h.defense_mod);
                    h.attack_mod = d - cd.attack;
                    h.defense_mod = a - cd.defense;
                } else if let Some((q, i)) = s.find_board(id) {
                    let f = &mut s.players[q].board.make_mut()[i];
                    if f.is_follower {
                        let (a, d) = (f.attack, f.defense);
                        f.attack = d;
                        f.defense = a;
                        f.max_defense = a;
                    }
                }
            }
            destroy_dead(s);
        }
        Effect::SetStats {
            target,
            attack,
            defense,
        } => {
            let (a, d) = (
                eval_value(s, &frame.ctx, attack).max(0),
                eval_value(s, &frame.ctx, defense).max(0),
            );
            for id in targets!(target) {
                if let Some((q, i)) = s.find_hand(id) {
                    let h = &mut s.players[q].hand.make_mut()[i];
                    let cd = card(h.card);
                    h.attack_mod = a - cd.attack;
                    h.defense_mod = d - cd.defense;
                } else if let Some((q, i)) = s.find_board(id) {
                    let f = &mut s.players[q].board.make_mut()[i];
                    if f.is_follower {
                        f.attack = a;
                        f.defense = d;
                        f.max_defense = d;
                    }
                }
            }
            destroy_dead(s);
        }
        Effect::If {
            cond,
            then,
            otherwise,
        } => {
            let ok = eval_cond(s, &frame.ctx, cond);
            let list: &'static [Effect] = if ok {
                then
            } else {
                otherwise.as_deref().unwrap_or(&[])
            };
            splice(frame, list, 1);
            return true;
        }
        Effect::Repeat { times, effects } => {
            let n = val!(times).max(0) as usize;
            splice(frame, effects, n);
            return true;
        }
        Effect::SetVar { name, value } => {
            let v = val!(value);
            frame.ctx.set_var(*name, v);
        }
        Effect::RandomEffects {
            options,
            count,
            unused,
        } => {
            let used = if *unused {
                source_options(s, &mut frame.ctx)
                    .map(|(_, u)| *u)
                    .unwrap_or(0)
            } else {
                0
            };
            let mut idx: Vec<usize> = (0..options.len())
                .filter(|&i| used & (1 << i) == 0)
                .collect();
            s.shuffle(&mut idx);
            idx.truncate((*count).max(0) as usize);
            idx.sort_unstable();
            if *unused {
                if let Some((_, u)) = source_options(s, &mut frame.ctx) {
                    for &i in &idx {
                        *u |= 1 << i;
                    }
                }
            }
            let lists: Vec<&'static [Effect]> =
                idx.iter().map(|&i| options[i].as_slice()).collect();
            splice_lists(frame, &lists);
            return true;
        }
        Effect::CycleEffects { options } => {
            if options.is_empty() {
                frame.pc += 1;
                return true;
            }
            let k = match source_options(s, &mut frame.ctx) {
                Some((c, _)) => {
                    let k = *c as usize % options.len();
                    *c = ((k + 1) % options.len()) as u8;
                    k
                }
                None => 0,
            };
            splice(frame, &options[k], 1);
            return true;
        }
        Effect::TriggerOwn { on } => {
            let on = match on {
                OwnTrigger::Fanfare => On::Fanfare,
            };
            if let Some(b) = s.board_card(frame.ctx.source) {
                let abilities = board_abilities_on(b, on);
                let ctx = frame.ctx.clone();
                push_abilities(s, &abilities, &ctx);
            }
        }
        Effect::Copy {
            from,
            count,
            dest,
            side,
            kinds,
            slot,
            hidden,
        } => {
            let n = val!(count);
            let ctx = frame.ctx.clone();
            let cards = pick_cards(s, &ctx, from, n, *kinds);
            let q = match side {
                Some(Side::Opponent) => opponent(p),
                _ => p,
            };
            let mut ids = Vec::new();
            for cid in cards {
                match dest {
                    Dest::Hand => {
                        let h = if *hidden {
                            s.new_hand_card(cid, None)
                        } else {
                            revealed_hand_card(s, cid, None)
                        };
                        let iid = h.iid;
                        if s.add_hand_card(q, h) {
                            ids.push(iid);
                        }
                    }
                    Dest::Board => {
                        let c = s.new_board_card(cid, None);
                        let iid = c.iid;
                        if enter_board(s, q, c) {
                            ids.push(iid);
                        }
                    }
                    Dest::Deck => {
                        let iid = s.new_iid();
                        s.players[q]
                            .deck
                            .make_mut()
                            .push(CardRef { iid, card: cid });
                        ids.push(iid);
                    }
                }
            }
            if *dest == Dest::Deck && !ids.is_empty() {
                let mut deck = std::mem::take(&mut s.players[q].deck).into_vec();
                s.shuffle(&mut deck);
                s.players[q].deck = deck.into();
            }
            if let Some(sl) = slot {
                frame.ctx.set_slot(*sl, ids);
            }
        }
        Effect::SetCost {
            target,
            value,
            duration,
        } => {
            for id in targets!(target) {
                if let Some((q, i)) = s.find_hand(id) {
                    let h = &mut s.players[q].hand.make_mut()[i];
                    if *duration == Some(Duration::EndOfTurn) {
                        h.ext.temp_cost_set = Some(*value);
                    } else {
                        h.ext.cost_set = Some(*value);
                        h.cost_mod = 0;
                        h.ext.temp_cost_mod = 0;
                        h.ext.temp_cost_set = None;
                    }
                }
            }
        }
        Effect::Silence { target } => {
            for id in targets!(target) {
                if let Some(b) = s.board_card_mut(id) {
                    b.ext.silenced = true;
                    b.keywords = Kw::EMPTY;
                    b.temp_keywords = Kw::EMPTY;
                    b.ext.timed_keywords = Kw::EMPTY;
                    b.ext.no_attack = false;
                    b.ext.temp_no_attack = false;
                    b.ext.temp_max_attacks = 0;
                    b.granted.clear();
                    if b.is_follower {
                        b.max_attacks = 1;
                    }
                }
            }
        }
        Effect::RandomKeywords {
            target,
            from,
            count,
        } => {
            let ids = targets!(target);
            for id in ids {
                let mut ks: Vec<u16> = from.iter().collect();
                s.shuffle(&mut ks);
                ks.truncate((*count).max(0) as usize);
                ks.sort_unstable();
                let mut k = Kw::EMPTY;
                for i in ks {
                    k = k.with(Kw::one(i));
                }
                if let Some(b) = s.board_card_mut(id) {
                    b.keywords = b.keywords.with(k);
                }
            }
        }
        Effect::LoseLastWords { target } => {
            for id in targets!(target) {
                if let Some(b) = s.board_card_mut(id) {
                    b.ext.lost_last_words = true;
                } else if let Some((q, i)) = s.find_hand(id) {
                    s.players[q].hand.make_mut()[i].ext.lost_last_words = true;
                }
            }
        }
        Effect::GainEp { amount } => {
            let pl = &mut s.players[p];
            pl.ep = EP.min(pl.ep + amount);
        }
        Effect::GainSep { amount } => {
            let pl = &mut s.players[p];
            pl.sep = SEP.min(pl.sep + amount);
        }
        Effect::MoveToBoard { target } => {
            for id in targets!(target) {
                let Some((q, i)) = s.find_hand(id) else {
                    continue;
                };
                if !s.can_add_to_board(q) {
                    continue;
                }
                let h = s.players[q].hand.make_mut().remove(i);
                let b = s.new_board_card(h.card, Some(&h));
                enter_board(s, q, b);
            }
        }
        Effect::DirectSummon => {
            let src = frame.ctx.source;
            if let Some((q, i)) = find_deck(s, src) {
                if s.can_add_to_board(q) {
                    let r = s.players[q].deck.make_mut().remove(i);
                    let kept = s.take_kept(q, r.iid);
                    let h = match kept {
                        Some(h) => h,
                        None => s.new_hand_card(r.card, Some(r.iid)),
                    };
                    let b = s.new_board_card(r.card, Some(&h));
                    enter_board(s, q, b);
                    for a in &abilities_of(r.card).abilities {
                        if a.trigger.on() == On::DirectSummoned {
                            queue(s, a, Ctx::new(q, r.iid));
                        }
                    }
                }
            }
        }
        Effect::PayPp { amount, then } => {
            if s.players[p].pp >= *amount {
                s.players[p].pp -= amount;
                splice(frame, then, 1);
                return true;
            }
        }
        Effect::AddFaith { amount } => {
            if let Some(f) = &mut s.players[p].ext.faith {
                f.value += amount;
            }
        }
        Effect::SpendFaith { amount, then } => {
            if let Some(f) = &mut s.players[p].ext.faith {
                if f.value >= *amount {
                    f.value -= amount;
                    splice(frame, then, 1);
                    return true;
                }
            }
        }
        Effect::GrantFaith { abilities } => {
            if let Some(f) = &mut s.players[p].ext.faith {
                f.granted.extend(abilities.iter());
            }
        }
        Effect::SplitRandom { total, vars } => {
            let total = val!(total).max(0);
            let n = vars.len();
            if n > 0 {
                // 合計 total の n 個の0以上の整数（1つずつランダムに割り振る）
                let mut parts = vec![0i32; n];
                for _ in 0..total {
                    let k = s.rng_int(n);
                    parts[k] += 1;
                }
                for (v, x) in vars.iter().zip(parts) {
                    frame.ctx.set_var(*v, x);
                }
            }
        }
        Effect::LeaderStatus {
            side,
            cap,
            plus,
            duration,
        } => {
            let until = if *duration == Some(Duration::UntilOpponentTurnEnd) {
                s.turn + 1
            } else {
                0
            };
            let (ps, n) = side_players(s, &frame.ctx, *side);
            for &q in &ps[..n] {
                let e = &mut s.players[q].ext;
                if let Some(c) = cap {
                    e.leader_cap = Some((c.at_least, c.to, until));
                }
                if let Some(x) = plus {
                    e.leader_plus += x;
                }
            }
        }
        Effect::AddLeaderMaxHp { side, amount } => {
            let (ps, n) = side_players(s, &frame.ctx, *side);
            for &q in &ps[..n] {
                let pl = &mut s.players[q];
                pl.leader_max_hp = (pl.leader_max_hp + amount).max(1);
                pl.leader_hp = pl.leader_hp.min(pl.leader_max_hp);
            }
        }
        Effect::AddGauge { target, amount } => {
            for id in targets!(target) {
                if let Some((q, i)) = s.find_hand(id) {
                    s.players[q].hand.make_mut()[i].ext.gauge_evolves += amount;
                }
            }
        }
    }
    frame.pc += 1;
    true
}

fn cost_var_of(t: &Target) -> VarId {
    // discard は変数 `cost:<slot>` に書く（slot でない対象は `cost:_`）
    let d = data();
    let name = match t {
        Target::Slot { slot } => format!("cost:{}", d.slot_names[*slot as usize]),
        _ => "cost:_".to_string(),
    };
    d.var_names
        .iter()
        .position(|v| *v == name)
        .map(|i| i as VarId)
        .unwrap_or(VarId::MAX)
}

/// 中身が相手にも分かる手札のカード
fn revealed_hand_card(s: &mut GameState, c: CardIdx, iid: Option<Iid>) -> HandCard {
    let mut h = s.new_hand_card(c, iid);
    h.revealed = true;
    h
}

fn draw_hint(s: &GameState, ctx: &Ctx, f: &'static CardFilter) -> DrawHint {
    DrawHint {
        filter: f,
        cost_eq: f.cost_eq.as_ref().map(|v| eval_value(s, ctx, v)),
    }
}

/// p の山札のカード r が f に合うか。コストは手札で変化したコストで見る（「元のコスト」ではない。docs/rules.md）
fn deck_card_matches(
    s: &GameState,
    ctx: &Ctx,
    p: PlayerIndex,
    r: &CardRef,
    f: &CardFilter,
) -> bool {
    let cid = r.card;
    let cd = card(cid);
    if let Some(t) = f.ctype {
        if cd.ctype != t {
            return false;
        }
    }
    if let Some(t) = f.tribe {
        if !cd.tribes.contains(&t) {
            return false;
        }
    }
    if let Some(c) = f.class {
        if cd.class != c {
            return false;
        }
    }
    if let Some(ids) = &f.ids {
        if !ids.contains(&cid) {
            return false;
        }
    }
    let cost = s.deck_cost(p, r);
    if let Some(m) = f.cost_max {
        if cost > m {
            return false;
        }
    }
    if let Some(v) = &f.cost_eq {
        if cost != eval_value(s, ctx, v) {
            return false;
        }
    }
    let kept_kw = s.players[p]
        .deck_kept
        .iter()
        .find(|h| h.iid == r.iid)
        .map(|h| h.keywords);
    extra_matches(s, ctx, r.iid, cid, cost, None, kept_kw, f)
}

fn transform(s: &mut GameState, id: Iid, cid: CardIdx) {
    if let Some((q, i)) = s.find_board(id) {
        let mut fresh = s.new_board_card(cid, None);
        let old = &s.players[q].board[i];
        fresh.iid = old.iid;
        fresh.order = old.order;
        if fresh.is_follower && old.is_follower {
            fresh.entered_turn = old.entered_turn;
        }
        s.players[q].board.make_mut()[i] = fresh;
        return;
    }
    if let Some((q, i)) = s.find_hand(id) {
        let h = revealed_hand_card(s, cid, Some(id));
        s.players[q].hand.make_mut()[i] = h;
    }
}

/// 解決スタックと誘発待ちを、選択待ちか空になるまで実行する
pub fn run(s: &mut GameState) {
    while s.phase != Phase::Ended && s.pending.is_none() {
        let Some(top) = s.stack.last_mut() else {
            let Some(q) = s.queue.pop_front() else { break };
            push_frame(s, Effects::Dsl(&q.ability.effects), q.ctx);
            continue;
        };
        if top.pc >= top.effects.len() {
            s.stack.pop();
            // 能力の解決が1つ終わったら、誘発待ち（FIFO）から1つ取り出して解決する
            if let Some(q) = s.queue.pop_front() {
                push_frame(s, Effects::Dsl(&q.ability.effects), q.ctx);
            }
            continue;
        }
        match top.effects.get(top.pc) {
            FEff::Dsl(eff) => {
                let mut frame = s.stack.pop().unwrap();
                let ok = exec(s, &mut frame, eff);
                s.stack.push(frame);
                if !ok {
                    break;
                }
            }
            internal => {
                top.pc += 1;
                let controller = top.ctx.controller;
                handle_internal(s, controller, internal);
            }
        }
        destroy_dead(s);
        s.check_leaders();
    }
    if s.phase == Phase::Ended {
        s.stack.clear();
        s.queue.clear();
        s.pending = None;
    }
    keep_spare(s);
}

#[cfg(feature = "coverage")]
pub mod coverage {
    use std::collections::HashMap;
    use std::sync::Mutex;
    static HITS: Mutex<Option<HashMap<&'static str, u64>>> = Mutex::new(None);
    pub fn hit(name: &'static str) {
        *HITS
            .lock()
            .unwrap()
            .get_or_insert_with(HashMap::new)
            .entry(name)
            .or_insert(0) += 1;
    }
    pub fn hits() -> HashMap<&'static str, u64> {
        HITS.lock().unwrap().clone().unwrap_or_default()
    }
}
