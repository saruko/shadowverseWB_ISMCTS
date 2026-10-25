"""公式のカード一覧APIのレスポンス（data/raw）から、パック名/クラス名/cards.json に分けたカードデータを作る（閲覧用）。

使い方（リポジトリ直下で）: py -I scripts/fetch_cards.py --out <書き出すフォルダ> [--raw <data/raw のフォルダ>]
  --out は必須（リポジトリの外に置く。元データを含むのでコミットしない）。--raw の既定はこのリポジトリの data/raw

API を叩くのはリポジトリの `npm run fetch-cards` だけにし、ここでは同じレスポンスを整形する
（エンジンが読む data/cards.json と、カードデータ/ が必ず同じ取得から作られるように）。
新弾の実装後の手順: npm run fetch-cards → py -I scripts/fetch_cards.py --out <フォルダ> → npm run cards。
新弾のパックのフォルダが増える。既存のファイルは上書きする。
data/raw が欠けている（ページが足りない・一覧のカードの詳細が無い）ときは、何も書かずにエラーで止まる。
"""
import argparse
import json
import re
from collections import Counter, defaultdict
from datetime import datetime, timezone, timedelta
from pathlib import Path

API = "https://shadowverse-wb.com/web/CardList/cardList?offset={offset}"
PAGE_SIZE = 30

DEFAULT_RAW = Path(__file__).resolve().parent.parent / "data" / "raw"

CLASS_NAMES = {
    0: "ニュートラル", 1: "エルフ", 2: "ロイヤル", 3: "ウィッチ",
    4: "ドラゴン", 5: "ナイトメア", 6: "ビショップ", 7: "ネメシス",
}
TYPE_NAMES = {1: "フォロワー", 2: "アミュレット", 3: "カウントダウンアミュレット", 4: "スペル"}
TOKEN_SET_ID = 90000
TOKEN_SET_NAME = "トークン"

JST = timezone(timedelta(hours=9))


def read_pages(raw):
    """data/raw/cardList_<offset>.json（npm run fetch-cards が API のレスポンスをそのまま書いたもの）を offset の順に読む。"""
    files = sorted(raw.glob("cardList_*.json"), key=lambda f: int(f.stem.split("_")[1]))
    if not files:
        raise SystemExit(f"{raw} に cardList_*.json がありません（先に npm run fetch-cards）")
    pages = []
    for f in files:
        body = json.loads(f.read_text(encoding="utf-8"))
        if body["data_headers"].get("result_code") != 1:
            raise SystemExit(f"{f}: result_code={body['data_headers']}")
        pages.append(body["data"])
    total = pages[0]["count"]
    offsets = [int(f.stem.split("_")[1]) for f in files]
    if offsets != list(range(0, total, PAGE_SIZE)):
        raise SystemExit(f"{raw}: ページが足りません（公式 {total} 枚に {len(range(0, total, PAGE_SIZE))} ページ要るが、offset {offsets[:3]}… の {len(files)} ページ）")
    fetched = max(f.stat().st_mtime for f in files)
    return pages, total, datetime.fromtimestamp(fetched, JST)


def plain(text):
    """<color=Keyword>…</color> などのタグを外す。"""
    return re.sub(r"</?[a-zA-Z]+(=[^>]*)?>", "", text or "")


def pack_folder(set_id, set_names):
    if set_id == TOKEN_SET_ID:
        return f"99_{TOKEN_SET_NAME}"
    name = set_names.get(str(set_id), f"不明{set_id}")
    # 10000=ベーシック → 00、10001=第1弾 → 01 …
    return f"{set_id - 10000:02d}_{name}"


def safe(name):
    return re.sub(r'[\\/:*?"<>|]', "_", name)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--raw", type=Path, default=DEFAULT_RAW)
    ap.add_argument("--out", type=Path, required=True)
    args = ap.parse_args()
    ROOT = args.out
    pages, total, fetched_at = read_pages(args.raw)

    details, related, specific = {}, {}, {}
    listed_ids = []
    for p in pages:
        details.update(p["card_details"])
        related.update(p["cards"] or {})
        specific.update(p["specific_effect_card_info"] or {})
        listed_ids += p["sort_card_id_list"]
    # 照合: 一覧に載る枚数と、取得できたユニークなカードの数（欠けていたら何も書かない）
    unique_listed = set(listed_ids)
    listed_missing = sorted(i for i in unique_listed if str(i) not in details)
    if len(unique_listed) != total or listed_missing:
        raise SystemExit(f"{args.raw}: 一覧 {len(unique_listed)} 枚（公式 {total} 枚）、詳細の無いカード {listed_missing[:5]}。npm run fetch-cards で取り直してください")
    master = {k: pages[0][k] for k in ("card_set_names", "tribe_names", "skill_names", "skill_replace_text_names")}
    set_names, tribe_names = master["card_set_names"], master["tribe_names"]

    groups = defaultdict(list)
    for cid, d in details.items():
        c, evo = d["common"], d.get("evo") or {}
        rel = related.get(cid, {})
        rec = {
            "card_id": c["card_id"],
            "name": c["name"],
            "name_ruby": c["name_ruby"],
            "pack": TOKEN_SET_NAME if c["card_set_id"] == TOKEN_SET_ID else set_names.get(str(c["card_set_id"])),
            "card_set_id": c["card_set_id"],
            "class": CLASS_NAMES.get(c["class"], str(c["class"])),
            "type": TYPE_NAMES.get(c["type"], str(c["type"])),
            "cost": c["cost"],
            "atk": c["atk"],
            "life": c["life"],
            "tribes": [tribe_names.get(str(t), str(t)) for t in c["tribes"] if t != 0],
            "rarity": c["rarity"],
            "is_token": c["is_token"],
            "is_include_rotation": c["is_include_rotation"],
            "deck_enabled_num": c["deck_enabled_num"],
            "skill_text": plain(c["skill_text"]),
            "evo_skill_text": plain(evo.get("skill_text")),
            "related_card_ids": rel.get("related_card_ids", []),
            "specific_effect_card_ids": rel.get("specific_effect_card_ids", []),
            "questions": c.get("questions", []),
            "raw": d,
        }
        groups[(pack_folder(c["card_set_id"], set_names), rec["class"])].append(rec)

    summary = Counter()
    for (pack, cls), recs in groups.items():
        out = ROOT / safe(pack) / cls
        out.mkdir(parents=True, exist_ok=True)
        recs.sort(key=lambda r: r["card_id"])
        (out / "cards.json").write_text(json.dumps(recs, ensure_ascii=False, indent=1), encoding="utf-8")
        summary[(pack, cls)] = len(recs)

    master["class_names"] = CLASS_NAMES
    master["type_names"] = TYPE_NAMES
    master["specific_effect_card_info"] = specific
    (ROOT / "_master.json").write_text(json.dumps(master, ensure_ascii=False, indent=1), encoding="utf-8")

    missing_related = sorted({i for r in related.values() for i in r["related_card_ids"]} - {int(k) for k in details})
    log = {
        # 取得の時刻は data/raw のファイルの時刻（ここを動かした時刻ではない）
        "fetched_at": fetched_at.isoformat(timespec="seconds"),
        "source": API.format(offset="N"),
        "raw_dir": str(args.raw.resolve()),
        "official_count": total,
        "listed_unique": len(unique_listed),
        "listed_duplicates": len(listed_ids) - len(unique_listed),
        "listed_missing_details": listed_missing,
        "related_missing_details": missing_related,
        "details_total": len(details),
        "tokens": sum(1 for d in details.values() if d["common"]["is_token"]),
        "per_folder": {f"{p}/{c}": n for (p, c), n in sorted(summary.items())},
    }
    (ROOT / "_取得ログ.json").write_text(json.dumps(log, ensure_ascii=False, indent=1), encoding="utf-8")
    print(json.dumps({k: v for k, v in log.items() if k != "per_folder"}, ensure_ascii=False))


if __name__ == "__main__":
    main()
