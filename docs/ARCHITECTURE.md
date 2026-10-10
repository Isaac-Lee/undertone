# Architecture

## State machine

```
intro ─BEGIN→ encounter(shown 1..6, 7=complete) ─PROCEED→ judgment
judgment ─RECORD (write-once original)→ archive ─CONTINUE→ space
space: the reader's order replays, the phrase is pulled once ─CONTINUE→ revelation (revealed=true)
revelation: reversed order → the reader's answer → primacy note, which ends the piece
            처음부터 다시 (clears the session), 공유하기 and 작품에 관하여 fade in after the note
```

Steps shown to the reader: encounter = 1, judgment + archive = 2, space = 3, revelation = 4.

The whole `Session` (in `src/state.ts`) is saved to `localStorage` on every change, so a reload
returns the reader to the same step and record. `recordOriginal` ignores a second write and freezes
the stored object. `loadSession` drops a save that doesn't match the current shape (a damaged save, or a
later step without an answer) and starts fresh; a save from the removed fifth step resumes at step 4.

## Session

| field | meaning |
|---|---|
| `seq` | `'A'` or `'B'`. Picked at random once (or set by `?seq=` on a fresh session) |
| `act` | current scene |
| `shown` | how many records have been displayed in step 1 |
| `original` | `{ option, at }`, the reader's answer. Immutable |
| `revealed` | true once step 4 has been entered |

## Data provenance

| kind | source | where |
|---|---|---|
| reader input | the option the reader picked | `Session.original` |
| embeddings / cosine | `jhgan/ko-sroberta-multitask` | `semantic.json.similarity` |
| answer left/right position | lean = mean cosine to a-words − mean cosine to b-words | `lean()` in `SemanticSpace.tsx` |
| group word placement | the artwork's layout (fixed slots per group; PCA x,y,z in `semantic.json` is no longer drawn) | `SLOTS` in `SemanticSpace.tsx` |
| region grouping, record tone | the artwork's framing | `GROUP_A/B` in `embed.py`, `RECORDS[].tone` |
| overlay weights and the anchor's pull | artistic parameter w(k)=1/k | `W()` in `SemanticSpace.tsx` |
| aggregate statistics | none collected | — |

## Interaction rules

- Every record in step 1 gets identical timing and styling. Tone is not visible until step 3.
- There are no timers that end a step, no scores, and no feedback on whether an answer is right.
- Nothing on screen says a judgment was caused by order. Step 4 leaves that to the reader: only they can know.
- Positions in step 3 are fixed. Only the anchor phrase moves, and its pull is labelled as the artwork's expression. Interaction changes the selection and the replay.
