# Architecture

## State machine

```
intro ─BEGIN→ encounter(shown 1..6, 7=complete) ─PROCEED→ judgment
judgment ─RECORD (write-once original)→ archive ─CONTINUE→ revelation (revealed=true)
revelation ─after note→ space
space: optional replay of A or B (overlay only) ─CONTINUE→ reflection
reflection: step 0 = first judgment, 1..4 = questions, 4 = final + RESTART (clears session)
```

The whole `Session` (in `src/state.ts`) is saved to `localStorage` on every change, so a reload
returns the participant to the same act and record. `recordOriginal` ignores a
second write and freeze the stored object.

## Session

| field | meaning |
|---|---|
| `seq` | `'A'` or `'B'`. Picked at random once (or set by `?seq=` on a fresh session) |
| `act` | current scene |
| `shown` | how many records have been displayed in Act I |
| `original` | `{ option, text, at }` for JUDGMENT_001. Immutable |
| `revealed` | true once Act III has been entered |
| `reflectionStep` | 0–4 |

## Data provenance

| kind | source | where |
|---|---|---|
| participant input | typed or selected by the participant | `Session.original` |
| embeddings / cosine | `jhgan/ko-sroberta-multitask` | `semantic.json.similarity` |
| 3-D coordinates | PCA(3) fitted on the core terms | `semantic.json.terms[].x,y,z` |
| region grouping, record tone | the artwork's framing | `GROUP_A/B` in `embed.py`, `RECORDS[].tone` |
| overlay weights | artistic parameter w(k)=1/k | `W()` in `SemanticSpace.tsx` |
| aggregate statistics | none collected | — |

## Interaction rules

- Every record in Act I gets identical timing and styling. Tone is not visible until Act III.
- There are no timers that end a step, no scores, and no feedback on whether an answer is right.
- Nothing on screen says a judgment was caused by order. Act III says the screen cannot know.
- Positions in the semantic space are fixed. Interaction changes only the viewing angle, the selection and the replay overlay.
