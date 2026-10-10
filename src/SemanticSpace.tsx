import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import sem from './data/semantic.json'
import { SEQUENCES, OPTIONS, reducedMotion, type SeqId } from './state'
import { Heading, Said, Mark, type Props } from './App'

// ── measured data (precomputed by scripts/embed.py, never altered here) ──
type Group = 'anchor' | 'a' | 'b' | 'option'
type Term = { text: string; group: Group; x: number; y: number; z: number }
const TERMS = sem.terms as Term[]
const IDX = new Map(TERMS.map((t, i) => [t.text, i]))
const cos = (a: string, b: string) => sem.similarity[IDX.get(a)!][IDX.get(b)!]
const ANCHOR = TERMS[0].text
const CORE = TERMS.filter(t => t.group !== 'option')
const GROUP_WORDS = { a: CORE.filter(t => t.group === 'a'), b: CORE.filter(t => t.group === 'b') }

const nearest = (text: string, n = 3) =>
  CORE.filter(t => t.text !== text).map(t => ({ text: t.text, v: cos(text, t.text) })).sort((p, q) => q.v - p.v).slice(0, n)

// Plain-language reading of a cosine value. Thresholds are presentation only, chosen for this vocabulary.
const closeness = (v: number) => (v >= 0.6 ? '매우 가까움' : v >= 0.45 ? '가까운 편' : v >= 0.3 ? '조금 떨어짐' : '먼 편')

// ── artistic parameter: earlier records weigh more in the overlay. Not a measured quantity. ──
const W = (k: number) => 1 / (k + 1)
const W_SUM = [0, 1, 2, 3, 4, 5].reduce((s, k) => s + W(k), 0)
function salience(seq: SeqId, upto: number) {
  const s = { a: 0, b: 0 }
  SEQUENCES[seq].slice(0, upto + 1).forEach((r, k) => { s[r.tone] += W(k) / W_SUM })
  return s
}

// ── cloud: each word's position is measured; the haze of particles around it is decoration ──
// Seeded so the cloud looks the same on every visit.
function mulberry32(a: number) {
  return () => { a |= 0; a = a + 0x6d2b79f5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 }
}
// Centre the drawing on the words' bounding box and scale to a unit sphere (one uniform factor, so
// relative distances are untouched).
const MID = (['x', 'y', 'z'] as const).map(k => (Math.max(...TERMS.map(t => t[k])) + Math.min(...TERMS.map(t => t[k]))) / 2)
const RAD = Math.max(...TERMS.map(t => Math.hypot(t.x - MID[0], t.y - MID[1], t.z - MID[2])))
const unit = (p: readonly [number, number, number]) => [(p[0] - MID[0]) / RAD, (p[1] - MID[1]) / RAD, (p[2] - MID[2]) / RAD] as const
const POS = TERMS.map(t => unit([t.x, t.y, t.z]))
// A floor under the cloud: a grid plus a drop line from each word gives the eye a depth reference.
const FLOOR = Math.min(...POS.map(p => p[1])) - 0.12
const GRID = Array.from({ length: 9 }, (_, i) => -0.9 + i * 0.225)

const rand = mulberry32(1946)
const gauss = () => Math.sqrt(-2 * Math.log(rand() || 1e-9)) * Math.cos(2 * Math.PI * rand())
const HAZE = POS.map((p, i) => {
  const g = TERMS[i].group
  const n = { anchor: 420, a: 220, b: 220, option: 140 }[g], sd = g === 'anchor' ? 0.1 : 0.08
  return Array.from({ length: n }, () => [p[0] + gauss() * sd, p[1] + gauss() * sd, p[2] + gauss() * sd] as const)
})

const PITCH = -0.35
function project(p: readonly [number, number, number], yaw: number, size: number) {
  const x1 = p[0] * Math.cos(yaw) + p[2] * Math.sin(yaw)
  const z1 = -p[0] * Math.sin(yaw) + p[2] * Math.cos(yaw)
  const y2 = p[1] * Math.cos(PITCH) - z1 * Math.sin(PITCH)
  const z2 = p[1] * Math.sin(PITCH) + z1 * Math.cos(PITCH)
  const k = 3.2 / (3.2 + z2) // perspective: nearer (smaller z2) is larger
  return { x: size / 2 + x1 * k * size * 0.34, y: size * 0.44 - y2 * k * size * 0.34, k, z: z2 } // nudged up to make room for the floor
}

function useWidth() {
  const ref = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(600)
  useLayoutEffect(() => {
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width))
    ro.observe(ref.current!)
    return () => ro.disconnect()
  }, [])
  return [ref, w] as const
}

export default function SemanticSpace({ s, set }: Props) {
  const [sel, setSel] = useState(ANCHOR)
  const [replay, setReplay] = useState<{ seq: SeqId; i: number } | null>(null)
  const [plotRef, size] = useWidth()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const labelRefs = useRef<(HTMLButtonElement | null)[]>([])

  // Replay a sequence record by record; the overlay follows it.
  useEffect(() => {
    if (!replay || replay.i >= 5) return
    const t = setTimeout(() => setReplay(r => r && { ...r, i: r.i + 1 }), 1100)
    return () => clearTimeout(t)
  }, [replay])
  const startReplay = (seq: SeqId) => setReplay({ seq, i: reducedMotion() ? 5 : 0 })

  const sal = replay ? salience(replay.seq, replay.i) : null
  const responses = [
    { key: 'J1', j: s.original!, name: 'JUDGMENT_001' },
  ].map(r => ({ ...r, t: TERMS.find(t => t.text === r.j.option) }))
  const visible = (t: Term) => t.group !== 'option' || responses.some(r => r.t === t)

  // The draw loop reads the latest render's values through a ref, so React never re-renders per frame.
  const live = useRef({ sel, sal, responses, size })
  live.current = { sel, sal, responses, size }
  const view = useRef({ yaw: 0.5, drag: null as null | { x: number; yaw: number; moved: boolean }, hold: 0 })

  useEffect(() => {
    const canvas = canvasRef.current!, ctx = canvas.getContext('2d')!
    let raf = 0, last = performance.now()
    const frame = (now: number) => {
      const { sel, sal, responses, size } = live.current, v = view.current
      const dpr = devicePixelRatio || 1
      if (canvas.width !== Math.round(size * dpr)) { canvas.width = canvas.height = Math.round(size * dpr) }
      // slow drift, paused while the viewer is dragging or pointing at the space
      if (!reducedMotion() && !v.drag && now > v.hold) v.yaw += (now - last) / 1000 * 0.12
      last = now

      const css = getComputedStyle(canvas)
      const c = (n: string) => css.getPropertyValue(n).trim()
      const ink = c('--ink'), sys = c('--ink-sys'), tone = { a: c('--tone-a'), b: c('--tone-b') }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, size, size)

      // floor grid and drop lines (depth reference, not data)
      ctx.strokeStyle = c('--line-strong'); ctx.lineWidth = 1
      for (const g of GRID) {
        for (const [a, b] of [[[g, FLOOR, -0.9], [g, FLOOR, 0.9]], [[-0.9, FLOOR, g], [0.9, FLOOR, g]]] as const) {
          const p = project(a, v.yaw, size), q = project(b, v.yaw, size)
          ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke()
        }
      }
      ctx.strokeStyle = sys; ctx.fillStyle = sys
      POS.forEach((p, i) => {
        if (!visible(TERMS[i])) return
        const top = project(p, v.yaw, size), foot = project([p[0], FLOOR, p[2]], v.yaw, size)
        ctx.globalAlpha = 0.35; ctx.setLineDash([2, 3])
        ctx.beginPath(); ctx.moveTo(top.x, top.y); ctx.lineTo(foot.x, foot.y); ctx.stroke(); ctx.setLineDash([])
        ctx.globalAlpha = 0.6; ctx.beginPath(); ctx.ellipse(foot.x, foot.y, 3 * foot.k, 1.2 * foot.k, 0, 0, Math.PI * 2); ctx.fill()
      })
      ctx.globalAlpha = 1

      // haze
      TERMS.forEach((t, i) => {
        if (!visible(t)) return
        const g = t.group
        ctx.fillStyle = g === 'anchor' ? ink : sal && (g === 'a' || g === 'b') ? tone[g] : sys
        const base = g === 'anchor' ? 0.32 : g === 'option' ? 0.18 : 0.2
        const glow = sal && (g === 'a' || g === 'b') ? 0.08 + sal[g] * 0.7 : base
        for (const p of HAZE[i]) {
          const q = project(p, v.yaw, size)
          ctx.globalAlpha = glow * (0.45 + 0.55 * (1 - (q.z + 1) / 2))
          const r = 1.6 * q.k
          ctx.fillRect(q.x - r / 2, q.y - r / 2, r, r)
        }
      })
      ctx.globalAlpha = 1

      const P = POS.map(p => project(p, v.yaw, size))
      // selected word → its nearest neighbours, thicker when more similar
      const s0 = P[IDX.get(sel)!]
      ctx.strokeStyle = sys
      for (const n of nearest(sel)) {
        const q = P[IDX.get(n.text)!]
        ctx.globalAlpha = 0.6; ctx.lineWidth = 0.6 + n.v * 1.6
        ctx.beginPath(); ctx.moveTo(s0.x, s0.y); ctx.lineTo(q.x, q.y); ctx.stroke()
      }
      ctx.globalAlpha = 1
      // the observed answer: a ring
      ctx.strokeStyle = ink; ctx.lineWidth = 1
      const placed = responses.filter(r => r.t).map(r => P[IDX.get(r.t!.text)!])
      placed.forEach((q, i) => { ctx.beginPath(); ctx.arc(q.x, q.y, (7 + i * 4) * q.k, 0, Math.PI * 2); ctx.stroke() })
      // word cores
      TERMS.forEach((t, i) => {
        if (!visible(t)) return
        const q = P[i]
        ctx.fillStyle = t.group === 'anchor' || t.group === 'a' ? ink : sys
        if (t.group === 'b') ctx.fillRect(q.x - 2.5 * q.k, q.y - 2.5 * q.k, 5 * q.k, 5 * q.k)
        else { ctx.beginPath(); ctx.arc(q.x, q.y, (t.group === 'anchor' ? 4 : 2.6) * q.k, 0, Math.PI * 2); ctx.fill() }
      })

      // labels follow their words; farther words are smaller and fainter
      TERMS.forEach((_, i) => {
        const el = labelRefs.current[i]
        if (!el) return
        const q = P[i]
        el.style.transform = `translate(${q.x}px, ${q.y}px) translate(-50%, -125%) scale(${0.8 + 0.25 * q.k})`
        el.style.opacity = String(Math.min(1, 0.45 + 0.65 * (1 - (q.z + 1) / 2)))
        el.style.zIndex = String(Math.round((2 - q.z) * 10))
      })
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [])

  // drag sideways to turn the cloud; vertical swipes still scroll the page (touch-action: pan-y)
  const onDown = (e: React.PointerEvent) => {
    view.current.drag = { x: e.clientX, yaw: view.current.yaw, moved: false }
    ;(e.target as Element).setPointerCapture(e.pointerId)
  }
  const onMove = (e: React.PointerEvent) => {
    const d = view.current.drag
    if (!d) { view.current.hold = performance.now() + 1500; return }
    if (Math.abs(e.clientX - d.x) > 3) d.moved = true
    view.current.yaw = d.yaw + (e.clientX - d.x) * 0.01
  }
  const onUp = (e: React.PointerEvent) => {
    const d = view.current.drag
    view.current.drag = null
    view.current.hold = performance.now() + 3000
    if (!d || d.moved) return
    // a tap selects the nearest word within reach (labels stay the keyboard path)
    const box = (e.currentTarget as Element).getBoundingClientRect()
    const px = e.clientX - box.left, py = e.clientY - box.top
    let best = '', dist = 28
    TERMS.forEach(t => {
      if (!visible(t)) return
      const q = project(POS[IDX.get(t.text)!], view.current.yaw, size)
      const dd = Math.hypot(q.x - px, q.y - py)
      if (dd < dist) { dist = dd; best = t.text }
    })
    if (best) setSel(best)
  }

  const selT = TERMS[IDX.get(sel)!]
  const answer = responses[0].t

  return (
    <main className="stack" style={{ gap: 28, paddingTop: 28 }}>
      <div className="stack" style={{ gap: 10 }}>
        <Heading>“{ANCHOR}” 주변의 말들</Heading>
        <p className="refl" style={{ margin: 0 }}>
          가까이 모여 있는 말일수록, 한국어 언어 모델이 서로 비슷한 뜻으로 쓰인다고 본 말입니다. 누군가의 마음을 잰 것이 아니라 말들 사이의 거리를 그린 것입니다.
        </p>
      </div>

      <div className="space-wrap">
        <div>
          <div className="plot" ref={plotRef} role="group" aria-label="말들 사이의 거리. 단어를 선택하면 가까운 말들이 표시됩니다."
            onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp}
            onPointerLeave={() => { view.current.hold = performance.now() + 800 }}>
            <canvas ref={canvasRef} aria-hidden style={{ width: size, height: size }} />
            {TERMS.map((t, i) => {
              if (!visible(t)) return null
              const mine = responses.filter(r => r.t === t).map(r => r.name.slice(-3))
              const dim = sal && (t.group === 'a' || t.group === 'b') ? sal[t.group] < 0.35 : false
              return (
                <button key={t.text} ref={el => { labelRefs.current[i] = el }}
                  className={['term', t.group === 'anchor' && 'anchor', mine.length > 0 && 'human-label', sel === t.text && 'sel', dim && 'dim'].filter(Boolean).join(' ')}
                  aria-pressed={sel === t.text}
                  aria-label={`${t.text}${mine.length ? `, 당신의 응답 ${mine.join(', ')}` : ''}`}
                  onPointerDown={e => e.stopPropagation()}
                  onClick={() => setSel(t.text)}>
                  {t.text}{mine.length > 0 && <span className="id" style={{ fontSize: 9, marginLeft: 6 }}>{mine.join(' ')}</span>}
                </button>
              )
            })}
          </div>
          <p className="sys sys-dim" style={{ fontSize: 13, margin: '10px 0 0' }}>
            옆으로 끌어서 돌려 볼 수 있습니다. 단어를 누르면 그 말과 가장 가까운 말들이 이어집니다.
          </p>
        </div>

        <aside className="panel">
          <section className="pin">
            <span className="id">JUDGMENT_001</span>
            <Said j={s.original!} />
            {!answer && <span className="sys sys-dim">선택한 해석이 없어 이 공간에 위치하지 않습니다.</span>}
            {s.original!.text && <span className="sys sys-dim">자유 서술은 좌표로 변환되지 않았습니다.</span>}
          </section>

          <section>
            {/* Optional: replaying an order lights up the cloud record by record. Nothing is gated on it. */}
            <span className="label">순서 다시 보기</span>
            <div className="row">
              {(['A', 'B'] as const).map(id => (
                <button key={id} className="btn btn-line" aria-pressed={replay?.seq === id} onClick={() => startReplay(id)}>
                  Sequence {id}{id === s.seq ? ' (received)' : ''}
                </button>
              ))}
            </div>
            {replay && (
              <div className="replay-strip sys" aria-live="polite">
                {SEQUENCES[replay.seq].map((r, i) => (
                  <span key={r.text} className={i <= replay.i ? 'on' : ''}>{r.text}</span>
                ))}
              </div>
            )}
          </section>

          <section aria-live="polite">
            <span className="label">선택한 말</span>
            <p className="sys-lg" style={{ margin: 0, fontSize: 28 }}>{sel}</p>
            <p className="sys" style={{ margin: 0 }}>
              {selT.group === 'a' || selT.group === 'b'
                ? <><Mark tone={selT.group} /> 이 작품이 나눈 두 묶음 가운데 ‘{GROUP_WORDS[selT.group].slice(0, 2).map(t => t.text).join(', ')}’ 쪽 말</>
                : selT.group === 'anchor' ? '모든 해석이 출발하는 표현' : '처음에 고를 수 있었던 답'}
            </p>
            <dl className="kv sys" style={{ margin: 0 }}>
              {sel !== ANCHOR && <>
                <dt>“{ANCHOR}”와</dt>
                <dd><span style={{ color: 'var(--ink)' }}>{closeness(cos(sel, ANCHOR))}</span> <span className="id">{cos(sel, ANCHOR).toFixed(2)}</span></dd>
              </>}
              {answer && sel !== answer.text && <>
                <dt>당신의 답과</dt>
                <dd><span style={{ color: 'var(--ink)' }}>{closeness(cos(sel, answer.text))}</span> <span className="id">{cos(sel, answer.text).toFixed(2)}</span></dd>
              </>}
              <dt>가장 가까운 말</dt>
              <dd style={{ color: 'var(--ink)' }}>{nearest(sel).map(n => n.text).join(', ')}</dd>
            </dl>
            <p className="sys sys-dim" style={{ margin: 0, fontSize: 13 }}>
              숫자는 0에서 1 사이의 닮은 정도입니다. 1에 가까울수록 언어 모델이 두 말을 비슷하게 봅니다.
            </p>
          </section>

          <section>
            <div><button className="btn" onClick={() => set(x => ({ ...x, act: 'reflection' }))}>Continue</button></div>
          </section>
        </aside>
      </div>
    </main>
  )
}

// keep the option list and the embedded vocabulary in step (also checked by scripts/verify.ts)
if (import.meta.env.DEV) OPTIONS.forEach(o => console.assert(IDX.has(o), `no embedding for ${o}`))
