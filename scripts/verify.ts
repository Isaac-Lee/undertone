// Integrity checks for the artwork's data. Run: npm run verify
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { SETS, sequences, recordOriginal, back, type Session } from '../src/state.ts'

const sem = JSON.parse(readFileSync(new URL('../src/data/semantic.json', import.meta.url), 'utf8'))
assert.equal(new Set(SETS.map(w => w.id)).size, SETS.length, 'set ids must be unique')

for (const w of SETS) {
  const at = `set ${w.id}`
  // Same information, only the order differs.
  const { A, B } = sequences(w)
  assert.equal(A.length, 6, at)
  assert.deepEqual(A.map(r => r.tone), ['a', 'a', 'a', 'b', 'b', 'b'], at)
  assert.deepEqual(B.map(r => r.text), A.map(r => r.text).reverse(), at)
  assert.equal(new Set(A.map(r => r.text)).size, 6, `${at}: records repeat`)
  // Four answers, five words per group, nothing listed twice.
  assert.equal(w.options.length, 4, at)
  assert.equal(w.groups.a.length, 5, at)
  assert.equal(w.groups.b.length, 5, at)
  const words = [w.anchor, ...w.groups.a, ...w.groups.b, ...w.options]
  assert.equal(new Set(words).size, words.length, `${at}: a word appears twice`)
  // Every word the diagram draws has a measured similarity row.
  const data = sem.sets?.[w.id]
  assert.ok(data, `${at}: no embeddings; run uv run scripts/embed.py`)
  const texts = data.terms.map((t: { text: string }) => t.text)
  for (const t of words) assert.ok(texts.includes(t), `${at}: no embedding for ${t}`)
  assert.equal(data.similarity.length, texts.length, at)
  data.similarity.forEach((row: number[], i: number) => assert.ok(Math.abs(row[i] - 1) < 1e-3, at))
}

// The original judgment is write-once.
const s0 = { original: null, act: 'judgment' } as unknown as Session
const s1 = recordOriginal(s0, { option: '소신이 있다', at: 't0' })
const s2 = recordOriginal(s1, { option: '자기 생각만 옳다고 여긴다', at: 't1' })
assert.equal(s2.original?.option, '소신이 있다')

// Going back never reaches the judgment form once a judgment exists.
let w: Session | null = { ...s1, act: 'revelation', shown: 7 } as Session
for (let i = 0; w && i < 20; i++) { assert.notEqual(w.act, 'judgment'); w = back(w) }
assert.throws(() => { (s1.original as { option: string }).option = 'x' })

console.log(`verify: ok — ${SETS.length} sets: ${SETS.map(w => w.anchor).join(' · ')}`)
