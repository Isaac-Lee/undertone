# 첫인상 (The First Impression)
The words remain the same. What they mean does not.

An interactive web artwork about primacy and interpretation, in Korean, about three minutes long. A
reader sees six short records about one person, says what a two-sided phrase such as *“고집이 세다”*
means for this person, watches that phrase get pulled toward the records they read first, and then finds
out that other readers got the same six records in the opposite order. There are 11 word sets; each run
gets a random one, and 다른 단어로 해보기 at the end moves on to a set not played yet.

## Run

```bash
npm install
```

```bash
npm run dev
```

Then open http://localhost:5173. On a fresh session, `?seq=A` / `?seq=B` forces the order and
`?set=<id>` (an id from `src/data/sets.json`) forces the word set, for testing. Otherwise both are
picked at random and kept for the session.

```bash
npm run verify
```

`verify` checks every set: six records, three per reading; both orders hold the same records and only
the order differs; four answers and five words per group, none repeated; every word has a measured
similarity row. It also checks that the answer can't be overwritten.

```bash
npm run build
```

`build` checks that the bundled fonts still cover every character on screen, type-checks, and writes a
static site to `dist/`.

## Deploy

The site is deployed on [Vercel](https://vercel.com) from `main`. `vercel.json` sets the Vite build
(`npm run build` → `dist/`) and long-lived caching for the hashed files in `/assets`. To set it up once:
**Add New → Project**, import this GitHub repository, and keep the detected settings. After that every
push to `main` deploys to production, and other branches get preview URLs.

Link previews (KakaoTalk, Slack, X, Facebook) need an absolute URL for the share image. On Vercel the
build reads the production address from `VERCEL_PROJECT_PRODUCTION_URL` automatically. If you add a
custom domain, set `SITE_URL=https://your.domain` in the project's environment variables so previews use it.

`dist/` is plain static files with relative paths, so it also runs from any other static host:

```bash
SITE_URL=https://your.domain/path npm run build
```

## The four steps

| Step | What happens |
|---|---|
| 1 — 기록 읽기 | Six records, one at a time. Every record gets the same 1.6 s minimum before 다음 기록 is enabled, with a hint to picture the person meanwhile. Nothing hints that there are two orders. |
| 2 — 답하기 | “이 사람은 고집이 세다고 합니다. 이 사람에게 ‘고집이 세다’는 어떤 뜻일까요?” Four readings, alternating between the two senses, plus *아직 잘 모르겠다*. The answer is write-once. Then a short recap, “이 기록들을 읽고, 이렇게 답했습니다”: the six records as read, with the answer typed out beneath them. |
| 3 — 끌림 | A 2-D diagram of the two groups of meaning (좋게 / 나쁘게 읽히는 뜻). The reader's order replays: each record lights its group, and “고집이 세다” glides once toward the group read first. The four answers sit left/right by their measured lean, and one sentence says which side the reader's answer is on. Tapping a word shows its measured similarities. |
| 4 — 순서 | The reversed order is revealed: the reader's order appears record by record, then the reversed order fills in from its first record down, each crossing over from where it sat. “같은 기록이 순서만 바뀌면, ‘고집이 세다’는 반대쪽으로 끌려갑니다.” Then the reader's answer with “처음 읽은 기록이 당신의 답에 영향을 주었을까요?”, and a note on Asch's 1946 experiment that ends the piece on “당신의 판단이 순서 때문이었는지는 당신만 알 수 있습니다.” Then, after a pause: 반대 순서로 다시 읽기 (the same set in the other order, with a fresh answer) and 다른 단어로 해보기, and below them 처음부터 다시, 공유하기 and 첫인상에 관하여. 공유하기 sends a short message with the reader's own reading (not their order) and the link on its own line. |

## Word sets

Each set in `src/data/sets.json` is one phrase that reads two ways, with:

- `records`: three good-sounding (`a`) and three bad-sounding (`b`) records. Order A shows `a` first, order B is the same six reversed.
- `options`: four answers, meant for group a, b, a, b, so the list never leads with one reading.
- `groups`: five words for each reading, drawn as the two groups in the 끌림 diagram.

To add or change a set, edit `sets.json`, then recompute the similarities and the fonts:

```bash
uv run scripts/embed.py
```

```bash
npm run fonts
```

`embed.py` prints `ok` or `OFF` per set. `OFF` means at least one answer lands on the other side of the
diagram than intended (the model reads it closer to the other group); reword it until every set is `ok`.

## Measured vs. represented

The 끌림 diagram mixes data and expression, and says so under the diagram and in 첫인상에 관하여:

- **Measured.** Each answer's left/right position is its *lean*: mean cosine similarity to its set's 좋게
  읽히는 words minus mean similarity to the 나쁘게 읽히는 words, from `jhgan/ko-sroberta-multitask`
  (Korean SBERT, 768-d, mean pooling, L2-normalised). The inspector shows the raw cosines.
  See `scripts/embed.py` → `src/data/semantic.json`.
- **Framing.** The two groups (for 고집이 세다: 소신·신념·원칙·의지·일관성 / 자기중심·막무가내·불통·완고함·융통성
  없음) are the artwork's own grouping, drawn apart on purpose with a fixed slot per word. The model's
  distances don't flatten into 2-D without words piling up (2-D stress ≈ 0.28 for 고집이 세다), so word
  positions within a group are layout, not data.
- **Expression.** The pull and the group glow are a metaphor for primacy: each record weighs w(k) = 1/k,
  so earlier records weigh more. The background dots are seeded decoration.

## Typography

One Korean face (IBM Plex Sans KR) for every voice, with IBM Plex Mono for counts and step labels.
Voices differ by size, weight, leading and ink only. All Korean text uses `word-break: keep-all`.
Light and dark follow `prefers-color-scheme`. Group markers are a hollow circle and a filled square, so
the framing never relies on colour alone.

Fonts are self-hosted and cut to the characters the piece uses: `npm run fonts` takes the used slices of
the `@fontsource` packages, subsets them with fontTools and merges each weight into one file in
`src/fonts/` (5 files, about 110 KB in total, instead of about 760 KB across 59 slices). Run it after changing any
on-screen text; it needs Python with `pip install "fonttools[woff]"`. The build fails if you forget.
Licences: SIL OFL 1.1.

## Code

```
src/state.ts             content, session model, write-once answer, localStorage
src/App.tsx              steps 1, 2, 4, the ending and 첫인상에 관하여
src/SemanticSpace.tsx    step 3: layout, pull, inspector
src/styles.css           tokens, voices, layout
src/fonts/, fonts.generated.css   subsetted fonts (generated by npm run fonts)
src/data/sets.json       the 11 word sets (phrase, records, answers, groups)
src/data/semantic.json   precomputed cosine matrices per set (generated by embed.py)
scripts/embed.py         embedding pipeline (uv inline deps; downloads the model once)
scripts/fonts.mjs, subset_fonts.py   font subsetting
scripts/verify.ts        data-integrity assertions
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the state machine and data model.

## Privacy

There is no backend, no account and no analytics. The session (order, answer, progress) lives only in
this browser's `localStorage` under `first-impression/v1`, and 처음부터 다시 clears it. A damaged or
outdated save starts a fresh session. If storage is blocked, the piece still runs; it just doesn't
persist. 공유하기 shares the reader's chosen reading and the bare address, never their order.

## Limitations / next steps

- An optional, consented aggregate (how many readers of each order chose each reading) would make the
  effect visible across people. It needs a small backend and a consent step, so it isn't built.
- A screen-reader pass with VoiceOver/NVDA hasn't been done; only the ARIA structure has been checked.
