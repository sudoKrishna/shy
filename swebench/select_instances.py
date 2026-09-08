import sys
import json
import random
from datasets import load_dataset

N = int(sys.argv[1]) if len(sys.argv) > 1 else 15
SEED = int(sys.argv[2]) if len(sys.argv) > 2 else 42

ds = load_dataset("princeton-nlp/SWE-bench_Lite", split="test")
rows = list(ds)

random.seed(SEED)
selected = random.sample(rows, N)

with open("swebench/data/instances.json", "w") as f:
    json.dump(selected, f, indent=2)

print(f"selected {N} instances (seed={SEED}):")
for r in selected:
    print(" -", r["instance_id"], r["repo"])
