# Cuts the font slices listed by scripts/fonts.mjs to the characters the app uses and merges each
# weight into one woff2 in src/fonts/. Needs fonttools with woff2 support:  pip install "fonttools[woff]"
import io
import json
import pathlib
import shutil

from fontTools import subset
from fontTools.merge import Merger
from fontTools.ttLib import TTFont

root = pathlib.Path(__file__).resolve().parent.parent
jobs_file = root / 'scripts' / '.fonts-jobs.json'
jobs = json.loads(jobs_file.read_text(encoding='utf8'))


def codepoints(rng: str) -> list[int]:
    out: list[int] = []
    for part in rng.split(','):
        a, _, b = part.strip()[2:].partition('-')
        out.extend(range(int(a, 16), int(b or a, 16) + 1))
    return out


def cut(path: pathlib.Path, unicodes: list[int]) -> io.BytesIO:
    font = TTFont(path)
    opts = subset.Options()
    opts.layout_features = ['*']  # keep kerning and any shaping the face has
    opts.name_IDs = ['*']         # keep the licence and copyright records
    sub = subset.Subsetter(opts)
    sub.populate(unicodes=unicodes)
    sub.subset(font)
    font.flavor = None            # the merger works on plain sfnt
    buf = io.BytesIO()
    font.save(buf)
    buf.seek(0)
    return buf


out_dir = root / 'src' / 'fonts'
shutil.rmtree(out_dir, ignore_errors=True)
out_dir.mkdir(parents=True)

before = after = 0
for job in jobs:
    unicodes = codepoints(job['range'])
    parts = [cut(root / s, unicodes) for s in job['srcs']]
    font = Merger().merge(parts) if len(parts) > 1 else TTFont(parts[0])
    font.flavor = 'woff2'
    dst = root / job['out']
    font.save(dst)
    before += sum((root / s).stat().st_size for s in job['srcs'])
    after += dst.stat().st_size
    print(f"  {dst.name}: {len(job['srcs'])} slices, {dst.stat().st_size / 1024:.0f} KB")

jobs_file.unlink()
print(f'fonts: {before / 1024:.0f} KB of slices -> {after / 1024:.0f} KB in {len(jobs)} files')
