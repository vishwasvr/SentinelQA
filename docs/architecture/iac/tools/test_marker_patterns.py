#!/usr/bin/env python3
"""Dev #27: reference check for the BR-44 CFR range markers (SSM cfr-ranges in templates/20-data.yaml).
One citation-finding regex extracts (title, part); the part is then checked against the ranges.
Reference only; the gate implementation lives in records-api (Developer).
Run: python3 docs/architecture/iac/tools/test_marker_patterns.py"""
import json, pathlib, re, sys

tpl = pathlib.Path(__file__).resolve().parents[1] / "templates" / "20-data.yaml"
m = re.search(r"controlled-data/cfr-ranges.*?Value: '(.*?)'\n", tpl.read_text(), re.S)
RANGES = json.loads(m.group(1))
CITE = re.compile(r"\b(\d{1,2})\s*C\.?F\.?R\.?\s*(?:Parts?\s*|§+\s*)?(\d{1,4})(?:\.\d+)*(?!\d)", re.I)

def hits(text):
    return [i for t, p in ((int(a), int(b)) for a, b in CITE.findall(text))
            for i, r in enumerate(RANGES) if r["title"] == t and r["partFrom"] <= p <= r["partTo"]]

yes = ["22 CFR 120", "22 CFR 121.1", "see 22 CFR 130.2", "22 CFR Part 125", "22 CFR Part 126", "22 cfr 126.4(a)",
       "22 CFR 120-130", "22 C.F.R. 123", "15 CFR 730", "15 CFR 774.1", "15 CFR § 774.1", "15 CFR 730-774", "15 CFR Part 744"]
no = ["22 CFR 119", "22 CFR 131", "22 CFR 1200", "122 CFR 121", "15 CFR 729", "15 CFR 775", "15 CFR 7300", "14 CFR 121", "year ear"]
fail = [t for t in yes if not hits(t)] + [t for t in no if hits(t)]
for n in range(100, 1000):
    assert bool(hits(f"22 CFR {n}")) == (120 <= n <= 130) and bool(hits(f"15 CFR {n}")) == (730 <= n <= 774), n
print("FAIL", fail) if fail else print(f"OK {len(yes)+len(no)} cases + exhaustive 100..999")
sys.exit(1 if fail else 0)
