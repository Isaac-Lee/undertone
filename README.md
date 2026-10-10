# undertone — THE FIRST IMPRESSION
The words remain the same. What they mean does not.

An interactive web artwork about primacy, interpretation and metacognition. A participant reads six
records about PERSON_001, is asked what *“고집이 세다”* means for this person, and then finds out that
another participant got the same six records in the opposite order.

## Run

```bash
npm install
```

```bash
npm run dev
```

Then open http://localhost:5173. Add `?seq=A` or `?seq=B` to a fresh session to force a sequence (for
testing). Otherwise the sequence is picked at random and kept for the session.

```bash
npm run verify
```

`verify` checks the data: both sequences hold the same records, only the order differs, the original
judgment can't be overwritten, and every answer option has an embedding. `npm run build` type-checks
and builds into `dist/`.

To recompute the semantic space (this needs [uv](https://docs.astral.sh/uv/) and downloads the model once):

```bash
uv run scripts/embed.py
```

## The five acts

| Act | What happens | Dominant voice |
|---|---|---|
| I — Encounter | Six records, one at a time. Every record gets the same treatment and the same 1.6 s minimum before NEXT RECORD is enabled. There's no auto-advance. Nothing hints that there are two orders. | system |
| II — Judgment | “이 사람은 고집이 세다고 합니다. 이 사람에게 ‘고집이 세다’는 어떤 뜻일까요?” The four interpretations alternate between the two readings, plus *아직 잘 모르겠다*. One choice is required; there's no free-text field and no timer. The first submission is write-once. | human |
| ↳ Archive | The participant's words stay on screen in the human voice. Below them a SYSTEM ARCHIVE record types out a verbatim copy (`CONTENT: VERBATIM`, `STATUS: STORED`). | human → system |
| III — Revelation | Both sequences side by side, with lines joining identical records and a YOU RECEIVED tag on the participant's order. Then “당신이 읽은 정보는 같았습니다 / 달라진 것은 순서뿐입니다”, a reflection prompt, and a short note on the primacy effect (Asch, 1946) that says it can't explain this participant's judgment. | system + reflection |
| IV — Semantic space | “고집이 세다” 주변의 말들: a fixed 3-D word cloud of the phrase and its neighbours that drifts slowly and turns on a sideways drag, with a plain-language inspector, replay of both sequences and an artistic overlay. Replay is optional and Continue is always available; Act III has already explained the swapped order. There is no second judgment: Act V's questions carry that reflection without asking for a new answer. | system + human |
| V — Reflection | The first judgment, shown alone. Four questions, one at a time, ending on “당신의 생각은 어디에서 시작되었습니까?”. A faint RESTART fades in after about six seconds of stillness. | human |

## Typography: three voices

Visual direction: **mechanical precision, human uncertainty** — an editorial system, not a retro/pixel one.
Fonts follow **who is speaking**, not which screen the text is on. Tokens and classes are in `src/styles.css`.

| Token | Class | Face(s) | Treatment |
|---|---|---|---|
| `--font-system` | `.sys`, `.sys-lg`, `.label` | IBM Plex Sans KR | sentence case, cool grey. Instructions, labels, buttons, Act I records (300 weight, large) |
| `--font-id` | `.id`, `.title` | IBM Plex Mono | the only uppercase on the page: IDs, counts, status codes (PERSON_001, JUDGMENT_001, COS) |
| `--font-human` | `.human`, `.human-quote`, `.said` | IBM Plex Sans KR | larger, warm ink, 1.85 leading, quoted. Participant words, questions to the person |
| `--font-reflection` | `.refl`, `.refl-lg` | IBM Plex Sans KR | 2.0 leading, 34em measure, softer ink; large statements in 300 weight. Explanations, reflective statements |
| `--font-data` | `.data` | D2Coding subset (served as “Undertone Data KR”) | Hangul-aware fixed width, only for code-like data that must keep columns: the SYSTEM ARCHIVE record |

Rules:
- One Korean face (Plex Sans KR) for every voice, so the typeface never switches between scenes. Voices
  differ by size, weight, leading and ink only.
- The system pairs Plex Mono with Plex Sans KR, which come from the same family and are designed to sit together.
- All Korean text uses `word-break: keep-all`; body copy has 1.85–2.0 leading.
- Light by default, dark via `prefers-color-scheme`; one neutral grey family. Square corners everywhere. No em-dashes or `·` separators in visible copy.
- There are no pixel borders, boxes or glyph icons. Group markers are a hollow circle (◦) and a filled
  square, drawn in CSS so the framing doesn't rely on colour. Structure comes from alignment and hairlines.

Licences are all SIL OFL 1.1. IBM Plex Mono and IBM Plex Sans KR come from `@fontsource`.
D2Coding 1.4.0 (© NAVER, OFL with Reserved Font Name) is subset to Latin + Hangul + punctuation with
fonttools and renamed internally to “Undertone Data KR”, as the RFN requires for modified versions. The
licence is in `public/fonts/D2Coding-OFL.txt`.

## Measured vs. represented

The semantic space draws four kinds of things. There are no layer toggles on screen (the audience doesn't
need them); this distinction lives in the code comments and here:

- **MEASURED.** Positions and cosine similarities come from `jhgan/ko-sroberta-multitask`, a Korean
  SBERT model (768-d, mean pooling, L2-normalised). PCA(3) is fitted on the 11 core terms only. The 4
  answer phrases are projected into that same basis, so the map never moves. Because PCA explains
  only 20.7% + 16.9% + 15.8% of the variance, the inspector shows the exact cosine values; the
  intro line under the heading says positions are model-computed relations, not a measured mind. See `scripts/embed.py` → `src/data/semantic.json`.
- **CLOUD.** The haze of particles around each word is decoration (seeded, Gaussian, the same on every
  visit). Only the word positions themselves are measured. The drawing is centred and scaled by one
  uniform factor, so relative distances are unchanged.
- **FRAMING.** The two regions (◦ 소신·신념·원칙·의지·일관성 / ▪ 자기중심·막무가내·불통·완고함·융통성 없음) are the
  artwork's own grouping, not model output. They are not drawn as outlines; they only show through the
  overlay, and their points are told apart by shape (◦ / ▪).
- **RESPONSE.** These are the participant's observed choices, placed at the measured position of the
  phrase they picked. They are not a reading of their mind. *아직 잘 모르겠다* gets no
  coordinate, and the panel says so.
- **OVERLAY.** This is an artistic metaphor for primacy. During a replay each region glows by the
  weight of its records, w(k) = 1/k, so earlier records weigh more. It is not a measurement, and the screen doesn't explain the
  weighting; it is left for the participant to read as an image.

## Code

```
src/state.ts          content, session model, write-once judgments, localStorage
src/App.tsx           act switcher + Acts I, II, archive, III, V; shared Said / JudgmentForm
src/SemanticSpace.tsx Act IV: fixed projection, layers, inspector, replay, reinterpretation
src/styles.css        tokens, three voices, layout
src/data/semantic.json precomputed embeddings → 3-D coords + cosine matrix
scripts/embed.py      embedding + PCA pipeline (uv inline deps)
scripts/verify.ts     data-integrity assertions
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the state machine and data model.

## Privacy

There is no backend, no account and no analytics. The session (sequence, judgments, progress) lives
only in this browser's `localStorage` under `first-impression/v1`, and RESTART clears it. If storage
is blocked, the piece still runs; it just doesn't persist.

## Browser verification (Chrome via the in-app browser, 2026-10-10)

- ✅ Sequence A and Sequence B played in full. The records match RECORDS / reversed (also asserted in `verify`).
- ✅ Assignment survives reloads. `?seq=` only applies to a fresh session.
- ✅ Before judgment, the DOM never contains the other sequence or the SEQ labels.
- ✅ The original judgment survives a reload and can't be overwritten.
- ✅ The archive scene shows the human text in Plex Sans KR and the archived copy in the D2Coding-based data face.
- ✅ Semantic coordinates are static data. Replaying changes only opacity and overlays, never positions.
- ✅ Mobile at 375×812: no horizontal scroll, the space stacks above the panel, labels follow their words in 3-D, and every control is a tap target of at least 44 px.
- ✅ Keyboard only: Tab, then arrow keys through the radio options, then Enter submits. Focus moves to each new act's heading. Plot terms are buttons.
- ✅ No console errors or warnings in dev.
- ⚠️ `prefers-reduced-motion` was checked in code but not emulated in the browser. Under it, CSS animations and delays collapse, the archive skips its typing animation, and replays jump to their final state.

## Limitations / next steps

- There's only one PCA projection. A UMAP view, or a projection fitted with the answer phrases included, could be offered as a second, clearly labelled map.
- The optional consented aggregate (how many A/B participants chose each reading) isn't built. It would need a small backend and a consent step.
- Labels can overlap at some angles in the dense 소신 / 신념 / 의지 / 일관성 cluster; they separate as the cloud turns.
- There's no sound, by design. A screen-reader pass with VoiceOver/NVDA hasn't been done; so far only the ARIA structure has been checked.
