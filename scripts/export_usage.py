#!/usr/bin/env python3
"""Export Hermes/Symphony token usage to JSON and GitHub-embeddable SVGs."""
from __future__ import annotations

import argparse
import html
import json
import os
import re
import sqlite3
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo


@dataclass
class Bucket:
    tokens: int = 0
    input: int = 0
    output: int = 0
    cache: int = 0
    reasoning: int = 0
    sessions: int = 0

    def add(self, row: sqlite3.Row) -> None:
        inp = int(row["input_tokens"] or 0)
        out = int(row["output_tokens"] or 0)
        cache = int(row["cache_read_tokens"] or 0) + int(row["cache_write_tokens"] or 0)
        reasoning = int(row["reasoning_tokens"] or 0)
        self.input += inp
        self.output += out
        self.cache += cache
        self.reasoning += reasoning
        self.tokens += inp + out + cache + reasoning
        self.sessions += 1


def fmt(n: int) -> str:
    if n >= 1_000_000_000:
        return f"{n / 1_000_000_000:.2f}B"
    if n >= 1_000_000:
        return f"{n / 1_000_000:.1f}M"
    if n >= 1_000:
        return f"{n / 1_000:.1f}K"
    return str(n)


def classify(row: sqlite3.Row, symphony_re: re.Pattern[str]) -> str:
    haystack = " ".join(str(row[k] or "") for k in ("id", "source", "title", "model_config"))
    return "symphony" if symphony_re.search(haystack) else "hermes"


def load_rows(db: Path) -> list[sqlite3.Row]:
    con = sqlite3.connect(str(db))
    con.row_factory = sqlite3.Row
    cur = con.cursor()
    return list(cur.execute(
        """
        select id, source, model, model_config, title, started_at,
               input_tokens, output_tokens, cache_read_tokens, cache_write_tokens,
               reasoning_tokens
        from sessions
        where started_at is not null
          and (coalesce(input_tokens,0)+coalesce(output_tokens,0)+coalesce(cache_read_tokens,0)+coalesce(cache_write_tokens,0)+coalesce(reasoning_tokens,0)) > 0
        order by started_at asc
        """
    ))


def make_summary_badge(label: str, today: Bucket, month: Bucket, color: str) -> str:
    return make_badge(label, f"today {fmt(today.tokens)} / month {fmt(month.tokens)}", color)

def make_badge(label: str, value: str, color: str) -> str:
    left = max(64, len(label) * 7 + 18)
    right = max(64, len(value) * 7 + 18)
    w = left + right
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="20" role="img" aria-label="{html.escape(label)}: {html.escape(value)}"><clipPath id="r"><rect width="{w}" height="20" rx="5" fill="#fff"/></clipPath><g clip-path="url(#r)"><rect width="{left}" height="20" fill="#27272a"/><rect x="{left}" width="{right}" height="20" fill="{color}"/></g><g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,sans-serif" font-size="11"><text x="{left/2}" y="14">{html.escape(label)}</text><text x="{left+right/2}" y="14" font-weight="700">{html.escape(value)}</text></g></svg>'''


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", default=os.path.expanduser("~/.hermes/state.db"))
    ap.add_argument("--out", default=".")
    ap.add_argument("--timezone", default="Asia/Tokyo")
    ap.add_argument("--symphony-pattern", default=r"symphony|GitHub Issues版Symphony|TRAC並列")
    args = ap.parse_args()

    out = Path(args.out)
    tz = ZoneInfo(args.timezone)
    now = datetime.now(tz)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    symphony_re = re.compile(args.symphony_pattern, re.I)

    buckets = {k: {"today": Bucket(), "month": Bucket(), "allTime": Bucket()} for k in ("hermes", "symphony", "total")}
    for row in load_rows(Path(args.db).expanduser()):
        dt = datetime.fromtimestamp(float(row["started_at"]), tz=timezone.utc).astimezone(tz)
        kind = classify(row, symphony_re)
        for target in (kind, "total"):
            buckets[target]["allTime"].add(row)
            if dt >= month_start:
                buckets[target]["month"].add(row)
            if dt >= today_start:
                buckets[target]["today"].add(row)

    labels = {"hermes": "Hermes Agent", "symphony": "Symphony", "total": "Total"}
    colors = {"hermes": "#22c55e", "symphony": "#8b5cf6", "total": "#38bdf8"}
    generated = now.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
    data = {
        "generatedAt": generated,
        "timezone": args.timezone,
        "today": now.strftime("%Y-%m-%d"),
        "month": now.strftime("%Y-%m"),
        "note": "Local lower-bound estimate from Hermes sessions table; not provider billing.",
        "categories": {
            k: {"label": labels[k], **{period: asdict(bucket) for period, bucket in periods.items()}}
            for k, periods in buckets.items()
        },
    }

    (out / "data").mkdir(parents=True, exist_ok=True)
    (out / "public").mkdir(parents=True, exist_ok=True)
    (out / "data" / "usage.json").write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")
    for kind in ("hermes", "symphony", "total"):
        (out / "public" / f"{kind}.svg").write_text(make_summary_badge(labels[kind], buckets[kind]["today"], buckets[kind]["month"], colors[kind]))
        (out / "public" / f"{kind}-today.svg").write_text(make_badge(f"{labels[kind]} today", fmt(buckets[kind]["today"].tokens), colors[kind]))
        (out / "public" / f"{kind}-month.svg").write_text(make_badge(f"{labels[kind]} month", fmt(buckets[kind]["month"].tokens), colors[kind]))
    print(json.dumps({"generatedAt": generated, "today": data["today"], "month": data["month"], "total_today_tokens": buckets["total"]["today"].tokens}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
