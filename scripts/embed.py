# /// script
# requires-python = ">=3.10"
# dependencies = ["sentence-transformers>=3", "scikit-learn", "numpy"]
# ///
"""Precompute the semantic space for THE FIRST IMPRESSION.

Run:  uv run scripts/embed.py
Out:  src/data/semantic.json

Method
  1. Embed every term with a Korean sentence-embedding model (mean pooling,
     L2-normalised — the model's own sentence-transformers config).
  2. Cosine similarity between every pair (dot product of unit vectors).
  3. PCA(3) fitted on the 11 CORE terms only (anchor + 10 neighbours), so the
     map is defined by the vocabulary, not by the answer options.
  4. Answer options are projected into that same fixed basis (transform only).
  5. Coordinates (centred on the core mean by PCA) are scaled by one global factor into [-1, 1]; aspect is kept.

Nothing here is random; re-running yields the same file.
"""
import json
import pathlib

import numpy as np
from sentence_transformers import SentenceTransformer
from sklearn.decomposition import PCA

MODEL = "jhgan/ko-sroberta-multitask"

ANCHOR = "고집이 세다"
# The two groups are the artwork's framing (author-assigned), not model output.
GROUP_A = ["소신", "신념", "원칙", "의지", "일관성"]
GROUP_B = ["자기중심", "막무가내", "불통", "완고함", "융통성 없음"]
OPTIONS = ["소신이 있다", "원칙을 지킨다", "자기 생각만 옳다고 여긴다", "타협하지 못한다"]

core = [ANCHOR] + GROUP_A + GROUP_B
terms = core + OPTIONS

model = SentenceTransformer(MODEL)
emb = model.encode(terms, normalize_embeddings=True)
sim = emb @ emb.T

pca = PCA(n_components=3, random_state=0).fit(emb[: len(core)])
xyz = pca.transform(emb)
xyz /= np.abs(xyz).max()

def group(t):
    if t == ANCHOR: return "anchor"
    if t in GROUP_A: return "a"
    if t in GROUP_B: return "b"
    return "option"

out = {
    "model": MODEL,
    "method": "mean-pooled sentence embeddings, L2-normalised; cosine similarity; PCA(3) fit on core terms; options projected into the same basis; centred on core mean; uniform scale to [-1,1]",
    "explained_variance": [round(float(v), 4) for v in pca.explained_variance_ratio_],
    "dim": int(emb.shape[1]),
    "terms": [
        {"text": t, "group": group(t), "x": round(float(x), 4), "y": round(float(y), 4), "z": round(float(z), 4)}
        for t, (x, y, z) in zip(terms, xyz)
    ],
    "similarity": [[round(float(v), 4) for v in row] for row in sim],
}
path = pathlib.Path(__file__).resolve().parent.parent / "src/data/semantic.json"
path.write_text(json.dumps(out, ensure_ascii=False, indent=1))
print(f"wrote {path}")
for t, row in zip(terms, sim):
    print(f"{t:>10}  cos(anchor)={row[0]:.3f}")
