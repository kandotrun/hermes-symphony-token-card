from __future__ import annotations

import importlib.util
import json
import sqlite3
import subprocess
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "export_usage.py"

spec = importlib.util.spec_from_file_location("export_usage", SCRIPT)
assert spec is not None
export_usage = importlib.util.module_from_spec(spec)
assert spec.loader is not None
sys.modules[spec.name] = export_usage
spec.loader.exec_module(export_usage)


def write_jsonl(path: Path, events: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("".join(json.dumps(event) + "\n" for event in events), encoding="utf-8")


def token_event(total: int, *, input_tokens: int | None = None, cached: int = 0, output: int = 0, reasoning: int = 0) -> dict:
    return {
        "timestamp": "2026-05-21T01:15:00Z",
        "type": "event_msg",
        "payload": {
            "type": "token_count",
            "info": {
                "total_token_usage": {
                    "input_tokens": input_tokens if input_tokens is not None else total - output,
                    "cached_input_tokens": cached,
                    "output_tokens": output,
                    "reasoning_output_tokens": reasoning,
                    "total_tokens": total,
                }
            },
        },
    }


def create_hermes_db(path: Path) -> None:
    con = sqlite3.connect(path)
    con.execute(
        """
        create table sessions (
            id text primary key,
            source text not null,
            model text,
            model_config text,
            title text,
            started_at real not null,
            input_tokens integer default 0,
            output_tokens integer default 0,
            cache_read_tokens integer default 0,
            cache_write_tokens integer default 0,
            reasoning_tokens integer default 0
        )
        """
    )
    # 2026-05-21 01:00:00 JST
    con.execute(
        "insert into sessions values (?,?,?,?,?,?,?,?,?,?,?)",
        ("hermes-session", "slack", "gpt-5.5", "{}", "regular Hermes work", 1779292800.0, 100, 20, 30, 40, 5),
    )
    con.commit()
    con.close()


class CodexRolloutParsingTests(unittest.TestCase):
    def test_counts_one_max_cumulative_token_usage_per_symphony_rollout(self) -> None:
        root = self.create_tempdir()
        rollout = root / "2026" / "05" / "21" / "rollout-symphony.jsonl"
        write_jsonl(
            rollout,
            [
                {"timestamp": "2026-05-21T01:00:00Z", "type": "session_meta", "payload": {"originator": "symphony-orchestrator"}},
                token_event(100, input_tokens=80, cached=50, output=20, reasoning=8),
                token_event(250, input_tokens=220, cached=180, output=30, reasoning=10),
                token_event(200, input_tokens=170, cached=140, output=30, reasoning=9),
            ],
        )
        write_jsonl(
            root / "rollout-plain-codex.jsonl",
            [
                {"timestamp": "2026-05-21T01:00:00Z", "type": "session_meta", "payload": {"originator": "codex_exec"}},
                token_event(999),
            ],
        )

        rows = export_usage.load_symphony_codex_rollouts(root)

        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["usage"]["total_tokens"], 250)
        self.assertEqual(rows[0]["usage"]["cached_input_tokens"], 180)

    def test_end_to_end_export_separates_hermes_sessions_from_symphony_codex_workers(self) -> None:
        root = self.create_tempdir()
        db = root / "state.db"
        out = root / "out"
        codex = root / "codex"
        create_hermes_db(db)
        write_jsonl(
            codex / "rollout-1.jsonl",
            [
                {"timestamp": "2026-05-21T01:10:00Z", "type": "session_meta", "payload": {"originator": "symphony-orchestrator"}},
                token_event(1_000, input_tokens=900, cached=700, output=100, reasoning=40),
            ],
        )

        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPT),
                "--db",
                str(db),
                "--codex-sessions",
                str(codex),
                "--out",
                str(out),
                "--timezone",
                "Asia/Tokyo",
                "--now",
                "2026-05-21T02:00:00+09:00",
            ],
            check=True,
            text=True,
            capture_output=True,
        )

        self.assertIn("total_today_tokens", result.stdout)
        usage = json.loads((out / "data" / "usage.json").read_text())
        self.assertEqual(usage["categories"]["hermes"]["today"]["tokens"], 195)
        self.assertEqual(usage["categories"]["symphony"]["today"]["tokens"], 1_000)
        self.assertEqual(usage["categories"]["symphony"]["today"]["cache"], 700)
        self.assertEqual(usage["categories"]["total"]["today"]["tokens"], 1_195)
        self.assertIn("Symphony tokens", (out / "public" / "symphony.svg").read_text())

    def create_tempdir(self) -> Path:
        import shutil
        import tempfile

        path = Path(tempfile.mkdtemp(prefix="token-card-test-"))
        self.addCleanup(lambda: shutil.rmtree(path, ignore_errors=True))
        return path


if __name__ == "__main__":
    import unittest

    unittest.main()
