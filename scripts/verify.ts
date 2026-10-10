// Integrity checks for the artwork's data. Run: npm run verify
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { SEQUENCES, OPTIONS, recordOriginal, back, type Session } from '../src/state.ts'

const a = SEQUENCES.A.map(r => r.text)
const b = SEQUENCES.B.map(r => r.text)

// Same information, only the order differs.
assert.equal(a.length, 6)
assert.deepEqual([...a].sort(), [...b].sort())
assert.notDeepEqual(a, b)
assert.deepEqual(SEQUENCES.A.map(r => r.tone), ['a', 'a', 'a', 'b', 'b', 'b'])
assert.deepEqual(b, [...a].reverse())

// The original judgment is write-once.
const s0 = { original: null, act: 'judgment' } as unknown as Session
const s1 = recordOriginal(s0, { option: '소신이 있다', at: 't0' })
const s2 = recordOriginal(s1, { option: '자기 생각만 옳다고 여긴다', at: 't1' })
assert.equal(s2.original?.option, '소신이 있다')

// Going back never reaches the judgment form once a judgment exists.
let w: Session | null = { ...s1, act: 'revelation', shown: 7 } as Session
for (let i = 0; w && i < 20; i++) { assert.notEqual(w.act, 'judgment'); w = back(w) }
assert.throws(() => { (s1.original as { option: string }).option = 'x' })

// Semantic data: every answer option and every core term has a coordinate and a similarity row.
const sem = JSON.parse(readFileSync(new URL('../src/data/semantic.json', import.meta.url), 'utf8'))
const texts = sem.terms.map((t: { text: string }) => t.text)
for (const o of OPTIONS) assert.ok(texts.includes(o), `missing option ${o}`)
assert.equal(sem.similarity.length, texts.length)
sem.similarity.forEach((row: number[], i: number) => assert.ok(Math.abs(row[i] - 1) < 1e-3))
for (const t of sem.terms) assert.ok(Math.abs(t.x) <= 1 && Math.abs(t.y) <= 1)

console.log('verify: ok —', a.join(' · '), '|', b.join(' · '))
