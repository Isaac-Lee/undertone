# /// script
# requires-python = ">=3.10"
# dependencies = ["sentence-transformers>=3", "numpy"]
# ///
"""Precompute word similarities for every set in src/data/sets.json.

Run:  uv run scripts/embed.py
Out:  src/data/semantic.json

Method
  Embed the anchor phrase, both groups' words and the four answers with a Korean sentence-embedding
  model (mean pooling, L2-normalised: the model's own sentence-transformers config), then take the
  cosine similarity of every pair (dot product of unit vectors). Nothing here is random; re-running
  yields the same file.

The app places each answer left/right by its lean (mean similarity to group a minus group b). This
script prints each answer's side so a set whose answers land on the unintended side is caught while
writing it: options 1 and 3 are meant for group a, 2 and 4 for group b.
"""
import json
import pathlib

import numpy as np
from sentence_transformers import SentenceTransformer

MODEL = "jhgan/ko-sroberta-multitask"
root = pathlib.Path(__file__).resolve().parent.parent
sets = json.loads((root / "src/data/sets.json").read_text(encoding="utf8"))
model = SentenceTransformer(MODEL)

out = {
    "model": MODEL,
    "method": "mean-pooled sentence embeddings, L2-normalised; cosine similarity",
    "sets": {},
}
for s in sets:
    a, b = s["groups"]["a"], s["groups"]["b"]
    terms = [s["anchor"]] + a + b + s["options"]
    groups = ["anchor"] + ["a"] * len(a) + ["b"] * len(b) + ["option"] * len(s["options"])
    emb = model.encode(terms, normalize_embeddings=True)
    sim = emb @ emb.T
    out["sets"][s["id"]] = {
        "terms": [{"text": t, "group": g} for t, g in zip(terms, groups)],
        "similarity": [[round(float(v), 4) for v in row] for row in sim],
    }

    idx = {t: i for i, t in enumerate(terms)}
    def lean(t):
        own = lambda grp: [sim[idx[t], idx[w]] for w in grp if w != t]
        return float(np.mean(own(a)) - np.mean(own(b)))
    mid = (np.mean([lean(w) for w in a]) + np.mean([lean(w) for w in b])) / 2
    sides = ["a" if lean(o) > mid else "b" for o in s["options"]]
    ok = sides == ["a", "b", "a", "b"]
    print(f"{'ok ' if ok else 'OFF'} {s['id']:<12} {s['anchor']}: " + ", ".join(f"{o}={sd}" for o, sd in zip(s["options"], sides)))

path = root / "src/data/semantic.json"
path.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf8")
print(f"wrote {path}")
