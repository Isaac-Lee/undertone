import { useEffect, useRef, useState } from 'react'
import sem from './data/semantic.json'
import { setById, sequences, reducedMotion, type SeqId, type Rec, type Tone } from './state'
import { Heading, Said, Mark, type Props } from './App'

// Plain-language reading of a cosine value. Thresholds are presentation only.
const closeness = (v: number) => (v >= 0.6 ? '매우 가까움' : v >= 0.45 ? '가까운 편' : v >= 0.3 ? '조금 떨어짐' : '먼 편')

// ── artistic parameter: earlier records weigh more in the pull. Not a measured quantity. ──
const W = (k: number) => 1 / (k + 1)
const W_SUM = [0, 1, 2, 3, 4, 5].reduce((s, k) => s + W(k), 0)
function salience(order: Rec[], upto: number) {
  const s = { a: 0, b: 0 }
  order.slice(0, upto + 1).forEach((r, k) => { s[r.tone] += W(k) / W_SUM })
  return s
}

// ── layout, in a 360×400 box ──
// The two groups are the artwork's framing, so they are drawn apart on purpose (a left, b right) and every
// label has its own slot — the model's raw distances do not flatten into 2-D without words piling up.
// Within a group, the word leaning hardest to its side takes the outermost slot.
// The four answers sit below, left/right by their measured lean: that position is data.
const BOX = { w: 360, h: 400 }
const POLE = { a: [90, 190], b: [270, 190] } as const
const SLOTS = [[40, 188], [74, 128], [64, 256], [118, 166], [126, 220]] // a side, outermost first; b mirrors
const ANCHOR_Y = 52
export const TONE_NAME = { a: '좋게 읽히는', b: '나쁘게 읽히는' } as const
const PULL_MS = 3200 // the single pull
const OPTION_Y = [296, 334, 362, 388] // the first gap is wider: a long second answer sits under the first

type Group = 'anchor' | 'a' | 'b' | 'option'
type Term = { text: string; group: Group }
const SEM = sem.sets as Record<string, { terms: Term[]; similarity: number[][] }>

/** Everything the diagram derives from one set's measured similarities (precomputed by scripts/embed.py,
 *  never altered here). Computed once per set. */
function measure(id: string) {
  const w = setById(id), data = SEM[id]
  const TERMS = data.terms
  const IDX = new Map(TERMS.map((t, i) => [t.text, i]))
  const cos = (a: string, b: string) => data.similarity[IDX.get(a)!][IDX.get(b)!]
  const ANCHOR = w.anchor
  const CORE = TERMS.filter(t => t.group !== 'option')
  const GROUP_WORDS = { a: CORE.filter(t => t.group === 'a'), b: CORE.filter(t => t.group === 'b') }
  const nearest = (text: string, n = 3) =>
    CORE.filter(t => t.text !== text).map(t => ({ text: t.text, v: cos(text, t.text) })).sort((p, q) => q.v - p.v).slice(0, n)
  // measured lean: mean similarity to the a-words minus mean similarity to the b-words
  const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length
  const lean = (text: string) =>
    mean(GROUP_WORDS.a.filter(t => t.text !== text).map(t => cos(text, t.text))) -
    mean(GROUP_WORDS.b.filter(t => t.text !== text).map(t => cos(text, t.text)))
  const MID = (mean(GROUP_WORDS.a.map(t => lean(t.text))) + mean(GROUP_WORDS.b.map(t => lean(t.text)))) / 2
  const SPOT = new Map<string, [number, number]>()
  for (const g of ['a', 'b'] as const) {
    ;[...GROUP_WORDS[g]].sort((p, q) => Math.abs(lean(q.text) - MID) - Math.abs(lean(p.text) - MID))
      .forEach((t, k) => SPOT.set(t.text, g === 'a' ? [SLOTS[k][0], SLOTS[k][1]] : [BOX.w - SLOTS[k][0], SLOTS[k][1]]))
  }
  const OPTIONS = w.options
  const SPAN = Math.max(...OPTIONS.map(o => Math.abs(lean(o) - MID)))
  OPTIONS.forEach((o, k) => SPOT.set(o, [Math.round(180 - (lean(o) - MID) / SPAN * 100), OPTION_Y[k]]))
  const side = (text: string): Tone => (SPOT.get(text)![0] < 180 ? 'a' : 'b')
  return { TERMS, IDX, cos, ANCHOR, GROUP_WORDS, nearest, SPOT, OPTIONS, side, orders: sequences(w) }
}
const MEASURED = new Map<string, ReturnType<typeof measure>>()
const measured = (id: string) => MEASURED.get(id) ?? MEASURED.set(id, measure(id)).get(id)!

// A label's centre is kept far enough from the edges for its text to fit (about one em per Hangul
// syllable at 3.9% of the box width); the dot itself stays at its measured place.
const textWidth = (text: string) => [...text].reduce((n, c) => n + (c === ' ' ? 0.3 : 1), 0) * 3.9 * BOX.w / 100
const labelX = (text: string, x: number, lo = 0, hi: number = BOX.w, scale = 1) => {
  const half = textWidth(text) * scale / 2 + 6
  return Math.min(hi - half, Math.max(lo + half, x))
}
// The answers alternate sides row by row, so each answer's label stays in its own half; a label too
// long for its half is set a little smaller. Labels in neighbouring rows then never meet.
const HALF = BOX.w / 2 - 4
const fitScale = (text: string) => Math.min(1, (HALF - 12) / textWidth(text))

// Decorative haze around each group, seeded so it looks the same on every visit.
function mulberry32(a: number) {
  return () => { a |= 0; a = a + 0x6d2b79f5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 }
}
const rand = mulberry32(1946)
const gauss = () => Math.sqrt(-2 * Math.log(rand() || 1e-9)) * Math.cos(2 * Math.PI * rand())
// Kept inside the group's own band (between the pull lines and the answers) and off the centre line,
// so no dot sits under a label below or beside the group.
const HAZE = (['a', 'b'] as const).flatMap(g => Array.from({ length: 110 }, () => {
  for (;;) {
    const x = POLE[g][0] + gauss() * 26, y = POLE[g][1] + gauss() * 30
    if (y > 120 && y < 250 && Math.abs(x - 180) > 24) return { g, x, y }
  }
}))

/** Glides toward `target` over `ms` (ease-out), from wherever it currently is.
 *  A new `run` snaps it back to `start` first, so a replay begins from the same place. */
function useGlide(target: number, ms: number, run: number, start: number) {
  const [v, setV] = useState(target)
  const cur = useRef(target)
  const lastRun = useRef(run)
  useEffect(() => {
    if (lastRun.current !== run) { lastRun.current = run; cur.current = start; setV(start) }
    const from = cur.current, t0 = performance.now()
    if (from === target) return
    if (reducedMotion()) { cur.current = target; setV(target); return }
    let raf = 0
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / ms)
      cur.current = from + (target - from) * (1 - (1 - k) ** 3)
      setV(cur.current)
      if (k < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target, ms, run, start])
  return v
}

const pct = (x: number, y: number) => ({ left: `${x / BOX.w * 100}%`, top: `${y / BOX.h * 100}%` })

export default function SemanticSpace({ s, set }: Props) {
  const { TERMS, IDX, cos, ANCHOR, GROUP_WORDS, nearest, SPOT, OPTIONS, side, orders } = measured(s.set)
  const [sel, setSel] = useState(ANCHOR)
  const [open, setOpen] = useState(false) // phones: the inspector is a sheet shown after a tap
  // The participant's own order plays once on arrival; either order can be replayed.
  const [replay, setReplay] = useState<{ seq: SeqId; i: number }>({ seq: s.seq, i: reducedMotion() ? 5 : -1 })
  useEffect(() => {
    if (replay.i >= 5) return
    const t = setTimeout(() => setReplay(r => ({ ...r, i: r.i + 1 })), replay.i < 0 ? 900 : 1300)
    return () => clearTimeout(t)
  }, [replay])
  const [run, setRun] = useState(0)
  const startReplay = (seq: SeqId) => { setRun(n => n + 1); setReplay({ seq, i: reducedMotion() ? 5 : -1 }) }

  const sal = replay.i < 0 ? { a: 0, b: 0 } : salience(orders[replay.seq], replay.i)
  // The groups light record by record, but the phrase is pulled once: one slow glide to where the whole
  // order leaves it, starting with the first record.
  const end = replay.i < 0 ? { a: 0, b: 0 } : salience(orders[replay.seq], 5)
  const pull = end.a - end.b // > 0 pulls toward a (left)
  const anchorX = useGlide(180 - pull * 110, PULL_MS, run, 180) // one value drives the label and both lines
  const answer = OPTIONS.find(o => o === s.original!.option)
  // The panel (result, replay, Continue) arrives as one piece when the pull settles (third record).
  // Its space is held from the start, so nothing jumps; once shown it stays for replays.
  const [told, setTold] = useState(reducedMotion())
  useEffect(() => { if (replay.i >= 2) setTold(true) }, [replay.i])
  const firstTone = orders[s.seq][0].tone

  const term = (text: string, cls: string, style: React.CSSProperties) => (
    <button key={text} className={`term ${cls}` + (sel === text ? ' sel' : '')} style={style}
      aria-pressed={sel === text} onClick={() => { setSel(text); setOpen(true); setTold(true) }}>{text}</button>
  )
  const selT = TERMS[IDX.get(sel)!]

  return (
    <main className="stack space-main">
      <Heading>먼저 읽은 기록이 ‘{ANCHOR}’를 끌어당깁니다</Heading>

      <div className="space-wrap">
        <div>
          <div className="plot" role="group" aria-label="두 뜻의 묶음과 네 개의 답. 단어를 선택하면 오른쪽에 자세한 값이 표시됩니다.">
            <svg aria-hidden viewBox={`0 0 ${BOX.w} ${BOX.h}`}>
              {HAZE.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r={1.1} fill={`var(--tone-${p.g})`} style={{ opacity: 0.12 + sal[p.g] * 0.35, transition: 'opacity .9s' }} /> // lit is a hint, not a glare
              ))}
              {(['a', 'b'] as const).map(g => (
                <line key={g} x1={anchorX} y1={ANCHOR_Y + 14} x2={POLE[g][0]} y2={POLE[g][1] - 70}
                  stroke={`var(--tone-${g})`} strokeLinecap="round"
                  style={{ strokeWidth: 0.5 + end[g] * 5, opacity: 0.25 + end[g] * 0.75, transition: `all ${PULL_MS}ms var(--ease)` }} />
              ))}
              {[...SPOT].map(([text, [x, y]]) => {
                const g = TERMS[IDX.get(text)!].group
                const tone = g === 'option' ? side(text) : g
                return tone === 'b'
                  ? <rect key={text} x={x - 2.5} y={y - 2.5} width={5} height={5} fill="var(--tone-b)" />
                  : <circle key={text} cx={x} cy={y} r={2.6} fill="none" stroke="var(--tone-a)" strokeWidth={1.4} />
              })}
              {answer && <circle cx={SPOT.get(answer)![0]} cy={SPOT.get(answer)![1]} r={9} fill="none" stroke="var(--ink)" />}
              <line x1={180} x2={180} y1={296} y2={396} stroke="var(--line-strong)" strokeDasharray="2 4" />
            </svg>
            {(['a', 'b'] as const).map(g => (
              // group names sit in the empty top corners, each on its own group's side
              <span key={g} className="pole-name" style={{ top: `${14 / BOX.h * 100}%`, [g === 'a' ? 'left' : 'right']: '3.5%', transform: 'translateY(-50%)' }}>
                <Mark tone={g} /> {TONE_NAME[g]} 뜻
              </span>
            ))}
            {term(ANCHOR, 'anchor', { ...pct(anchorX, ANCHOR_Y), transform: 'translate(-50%, -50%)' })}
            {(['a', 'b'] as const).flatMap(g => GROUP_WORDS[g].map(t => {
              const [x, y] = SPOT.get(t.text)!
              return term(t.text, sal[g] < 0.3 ? 'dim' : '', { ...pct(labelX(t.text, x), y), transform: 'translate(-50%, -125%)' })
            }))}
            {OPTIONS.map(o => {
              const [x, y] = SPOT.get(o)!
              const lit = Math.min(1, Math.max(0, (side(o) === 'a' ? pull : -pull) * 2))
              const k = fitScale(o), a = side(o) === 'a'
              const lx = a ? labelX(o, x, 0, HALF, k) : labelX(o, x, BOX.w - HALF, BOX.w, k)
              return term(o, o === answer ? 'human-label' : '', {
                ...pct(lx, y), fontSize: k < 1 ? `max(10px, ${(3.9 * k).toFixed(2)}cqi)` : undefined, transform: o === answer ? 'translate(-50%, calc(-100% - .75em))' : 'translate(-50%, -115%)', // clear the answer's ring
                opacity: o === answer ? 1 : 0.6 + 0.4 * lit, transition: `opacity ${PULL_MS}ms`, // far side recedes, stays readable
              })
            })}
          </div>
          <p className="sys sys-dim" style={{ fontSize: 13, margin: '10px 0 0' }}>
            두 묶음과 끌려가는 움직임은 작품의 표현이고, 아래 네 답의 좌우 위치는 언어 모델이 잰 값입니다.
          </p>
        </div>

        <aside className="panel" aria-hidden={!told}
          style={{ opacity: told ? 1 : 0, pointerEvents: told ? undefined : 'none', transition: 'opacity .8s var(--ease)' }}>
          <section className="pin">
            <span className="sys sys-dim m-hide">당신의 답</span>
            <span className="m-hide"><Said j={s.original!} /></span>
            {!answer && <span className="sys sys-dim">이 답은 그림에 위치가 없습니다.</span>}
            {answer && (
              <span className="sys">
                당신은 {TONE_NAME[firstTone]} 기록을 먼저 읽었고, 당신의 답 ‘{answer}’{side(answer) === firstTone ? '도' : '는 반대로'} {TONE_NAME[side(answer)]} 쪽에 있습니다.
              </span>
            )}
          </section>

          <section>
            <span className="label m-hide">당신이 읽은 순서</span>
            <div className="row">
              <button className="btn btn-line" onClick={() => startReplay(s.seq)}>끌림 다시 보기</button>
            </div>
            <div className="replay-strip sys m-hide" aria-live="polite">
              {orders[replay.seq].map((r, i) => (
                <span key={r.text} className={i <= replay.i ? 'on' : ''}><Mark tone={r.tone} /> {r.text}</span>
              ))}
            </div>
          </section>

          <section aria-live="polite" className={'inspector' + (open ? ' open' : '')}>
            <span className="row" style={{ justifyContent: 'space-between' }}>
              <span className="label">선택한 말</span>
              <button className="btn btn-quiet m-only" style={{ minHeight: 44, minWidth: 44 }} onClick={() => setOpen(false)}>닫기</button>
            </span>
            <p className="sys-lg" style={{ margin: 0, fontSize: 28 }}>{sel}</p>
            <p className="sys" style={{ margin: 0 }}>
              {selT.group === 'a' || selT.group === 'b'
                ? <><Mark tone={selT.group} /> {TONE_NAME[selT.group]} 뜻의 묶음에 속한 말</>
                : selT.group === 'anchor' ? '질문의 기준이 된 말' : '고를 수 있었던 답'}
            </p>
            <dl className="kv sys" style={{ margin: 0 }}>
              {sel !== ANCHOR && <>
                <dt>“{ANCHOR}”와</dt>
                <dd><span style={{ color: 'var(--ink)' }}>{closeness(cos(sel, ANCHOR))}</span> <span className="id">{cos(sel, ANCHOR).toFixed(2)}</span></dd>
              </>}
              {answer && sel !== answer && <>
                <dt>당신의 답과</dt>
                <dd><span style={{ color: 'var(--ink)' }}>{closeness(cos(sel, answer))}</span> <span className="id">{cos(sel, answer).toFixed(2)}</span></dd>
              </>}
              <dt>가장 가까운 말</dt>
              <dd style={{ color: 'var(--ink)' }}>{nearest(sel).map(n => n.text).join(', ')}</dd>
            </dl>
            <p className="sys sys-dim" style={{ margin: 0, fontSize: 13 }}>
              숫자는 0에서 1 사이의 닮은 정도입니다. 1에 가까울수록 언어 모델이 두 말을 비슷하게 봅니다.
            </p>
          </section>

          <div><button className="btn" onClick={() => set(x => ({ ...x, act: 'revelation', revealed: true }))}>계속하기</button></div>
        </aside>
      </div>
    </main>
  )
}

