"""Compare one archived AI coding pass with provisional labels on the same fictional task pairs."""
import csv
import json
from collections import Counter
from pathlib import Path

base = Path(__file__).resolve().parent

def read_csv(path):
    with path.open(encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))

def index(rows, field):
    lookup = {row[field]: row for row in rows}
    if len(lookup) != len(rows):
        raise ValueError(f"Duplicate {field}")
    return lookup

items = index(read_csv(base / "blinded-items.csv"), "review_id")
key = index(read_csv(base / "synthetic-id-key.csv"), "review_id")
decisions = index(json.loads((base / "synthetic-decisions.json").read_text()), "review_id")
original = index(json.loads((base / "task-pairs.json").read_text(encoding="utf-8")), "id")
assert len(items) == 48 and items.keys() == key.keys() == decisions.keys()
assert {k["original_id"] for k in key.values()} == original.keys()
rows = []
for rid, decision in decisions.items():
    label = decision["decision"]
    assert label in {"same", "different", "unsure"} and decision["reason"].strip()
    item = original[key[rid]["original_id"]]
    assert all(items[rid][k] == item[k] for k in ("source", "request"))
    expected = "same" if item["same"] else "different"
    rows.append(dict(review_id=rid, split=item["split"], source=item["source"], request=item["request"],
                     ai_decision=label, ai_rationale=decision["reason"], provisional=expected, agrees=label==expected))
out = base / "results" / "synthetic-coding.csv"
with out.open("w", encoding="utf-8-sig", newline="") as handle:
    writer = csv.DictWriter(handle, fieldnames=list(rows[0]))
    writer.writeheader()
    writer.writerows(rows)
print(dict(Counter(r["ai_decision"] for r in rows)), sum(r["agrees"] for r in rows), "agreements out of", len(rows))
print("Disagreements", [r["review_id"] for r in rows if not r["agrees"]])

