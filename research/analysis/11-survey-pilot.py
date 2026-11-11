"""Aggregate counts from the survey pilot export. Writes results/survey-pilot.json; no free text or codes are copied.

Run from research/:  python analysis/11-survey-pilot.py <export CSV>
The export lives in responses/exports/study/ (kept out of shared archives because it holds participants' written answers).
"""
import csv
import json
import statistics
import sys
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path

rows = list(csv.DictReader(open(sys.argv[1], encoding="utf-8-sig")))
people = defaultdict(dict)
for r in rows:
    people[r["participant_code"]][r["probe_id"]] = r
P = list(people.values())
assert all(r["mode"] == "study" and r["status"] == "completed" for r in rows)
missed = [p for p in P if any(p[q]["prediction_score"] != "correct" for q in ("lamp", "bookcase"))]
clean = [p for p in P if p not in missed]
wrong = Counter()
for p in P:
    for q in ("lamp", "bookcase"):
        if p[q]["prediction_score"] == "incorrect":
            wrong["expected_allow_rule_blocks" if p[q]["prediction"] == "allow" else "expected_block_rule_allows"] += 1
secs = [(datetime.fromisoformat(p["lamp"]["submitted_at"].replace("Z", "+00:00")) - datetime.fromisoformat(p["lamp"]["consented_at"].replace("Z", "+00:00"))).total_seconds() for p in P]
out = {
    "people": len(P),
    "scope": dict(Counter(p["lamp"]["saved_scope"] for p in P)),
    "lamp": dict(Counter(p["lamp"]["prediction_score"] for p in P)),
    "bookcase": dict(Counter(p["bookcase"]["prediction_score"] for p in P)),
    "missedAtLeastOne": len(missed),
    "wrongDirection": dict(wrong),
    "fitAmongMissed": dict(Counter(p["lamp"]["fit_reported"] for p in missed)),
    "fitAmongAllCorrect": dict(Counter(p["lamp"]["fit_reported"] for p in clean)),
    "medianSeconds": statistics.median(secs),
    "minSeconds": min(secs),
    "maxSeconds": max(secs),
}
Path(__file__).resolve().parent.joinpath("results", "survey-pilot.json").write_text(json.dumps(out, indent=2) + "\n", encoding="utf8")
print(json.dumps(out))
