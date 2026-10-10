import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react'
import {
  SETS, setById, sequences, UNSURE, loadSession, saveSession, clearSession, freshSession,
  recordOriginal, reducedMotion, back, type Session, type Judgment, type Rec, type Tone,
} from './state'
import SemanticSpace from './SemanticSpace'

export type Props = { s: Session; set: (f: (s: Session) => Session) => void }

export const TITLE = '첫인상'
// Where the participant is in the piece: step number and what the step does.
const STEP: Record<Session['act'], string> = {
  intro: '', encounter: '1 / 4  기록 읽기', judgment: '2 / 4  답하기', archive: '2 / 4  답하기',
  space: '3 / 4  끌림', revelation: '4 / 4  순서',
}

export default function App() {
  const [s, setS] = useState(loadSession)
  useEffect(() => saveSession(s), [s])
  // dev only: lets browser checks jump between sets and scenes without reloading (stripped from builds)
  if (import.meta.env.DEV) (window as unknown as { __setSession: typeof setS }).__setSession = setS
  // Move focus to each act's heading so keyboard and screen-reader users land in the new scene.
  useEffect(() => { document.querySelector<HTMLElement>('[data-focus]')?.focus() }, [s.act])

  const Scene = { intro: Intro, encounter: Encounter, judgment: JudgmentAct, archive: Archive, revelation: Revelation, space: SemanticSpace }[s.act]
  return (
    <div className="stage">
      <header className="bar">
        <span className="row" style={{ gap: 16 }}>
          {back(s) && <button className="back" onClick={() => setS(x => back(x) ?? x)}>이전</button>}
          {s.act !== 'intro' && <span className="id">{TITLE}</span>}
        </span>
        <span className="id" style={{ whiteSpace: 'pre' }}>{STEP[s.act]}</span>
      </header>
      <Scene key={s.set} s={s} set={setS} /> {/* a new set always starts its scenes fresh */}
      <MoreBelow />
    </div>
  )
}

/** The scrollbar is hidden, so when a screen is taller than the window, a cue at the bottom says so.
 *  It disappears once the bottom is reached. */
function MoreBelow() {
  const [more, setMore] = useState(false)
  useEffect(() => {
    // Only what can be seen counts: space held for something not yet faded in is not "more".
    const visibleBottom = (el: Element): number => {
      const cs = getComputedStyle(el)
      if (el.getAttribute('aria-hidden') === 'true' || cs.opacity === '0' || cs.visibility === 'hidden' || cs.position === 'fixed') return 0
      const ownText = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent!.trim())
      let b = !el.children.length || ownText ? el.getBoundingClientRect().bottom : 0
      for (const c of el.children) b = Math.max(b, visibleBottom(c))
      return b
    }
    const check = () => {
      const main = document.querySelector('main')
      setMore(!!main && visibleBottom(main) - innerHeight > 8)
    }
    const ro = new ResizeObserver(check)
    ro.observe(document.body)
    // content swapped or revealed without a size change (a page inside a scene, a panel switched on)
    const mo = new MutationObserver(check)
    mo.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['aria-hidden', 'class'] })
    // a fade or entrance that has just finished
    const events = ['scroll', 'resize', 'animationend', 'transitionend'] as const
    events.forEach(e => addEventListener(e, check, { passive: true, capture: true }))
    return () => { ro.disconnect(); mo.disconnect(); events.forEach(e => removeEventListener(e, check, { capture: true })) }
  }, [])
  return (
    <button className={'more-below' + (more ? ' on' : '')} tabIndex={more ? 0 : -1} aria-hidden={!more}
      onClick={() => scrollBy({ top: innerHeight * 0.7, behavior: 'smooth' })}>
      아래에 더 있습니다 <span aria-hidden>↓</span>
    </button>
  )
}

// ── shared bits ─────────────────────────────────────────────

export function Heading({ children, className = 'label' }: { children: React.ReactNode; className?: string }) {
  return <h1 data-focus tabIndex={-1} className={className} style={{ margin: 0, fontWeight: className === 'title' ? undefined : 'normal' }}>{children}</h1>
}


/** The participant's own answer, in the human voice. Never paraphrased. */
export function Said({ j }: { j: Judgment }) {
  return <p className="human said" style={{ margin: 0 }}>{j.option}</p>
}

/** The interpretation choices; one must be picked. */
function JudgmentForm({ options, onSubmit, label }: { options: string[]; onSubmit: (j: Judgment) => void; label: string }) {
  const [option, setOption] = useState<string | null>(null)
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (option) onSubmit({ option, at: new Date().toISOString() })
  }
  return (
    <form onSubmit={submit} className="stack" style={{ gap: 28 }}>
      <fieldset className="choices">
        <legend className="sr-only">가장 가까운 뜻을 고르세요</legend>
        {[...options, UNSURE].map(o => (
          <label key={o} className="choice human">
            <input type="radio" name="interp" value={o} checked={option === o} onChange={() => setOption(o)} />
            <span className={o === UNSURE ? 'unsure' : ''}>{o}</span>
          </label>
        ))}
      </fieldset>
      <div><button className="btn" disabled={!option}>{label}</button></div>
    </form>
  )
}

function useDelay(ms: number, deps: unknown[] = []) {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    setReady(false)
    const t = setTimeout(() => setReady(true), reducedMotion() ? 0 : ms)
    return () => clearTimeout(t)
  }, deps)
  return ready
}

const pad = (n: number) => String(n).padStart(2, '0')

// ── INTRO ───────────────────────────────────────────────────

function Intro({ set }: Props) {
  return (
    <main className="center enter">
      <div className="stack" style={{ gap: 14 }}>
        <p className="intro-eyebrow">한 사람에 대한 기록 여섯 개</p>
        <Heading className="title">{TITLE}</Heading>
        {/* six records being read one after another, in the share image's two marks. They alternate,
            so the intro shows that records come in two kinds without hinting at either order. */}
        <div className="reading" aria-hidden>{[0, 1, 2, 3, 4, 5].map(i => <span key={i} className={i % 2 ? 'b' : 'a'} style={{ animationDelay: `${i * 450}ms` }} />)}</div>
      </div>
      <p className="sys" style={{ margin: 0, fontSize: 17, color: 'var(--ink)' }}>
        <span className="balanced">한 사람에 대한 짧은 기록 6개를 하나씩 보여드립니다.</span>
        <span className="balanced">다 읽고 나면 질문 하나에 답하게 됩니다.</span>
      </p>
      <p className="sys sys-dim" style={{ margin: 0 }}>약 3분 · 소리 없음</p>
      <div><button className="btn" onClick={() => set(s => ({ ...s, act: 'encounter', shown: 1 }))}>시작하기</button></div>
    </main>
  )
}

// ── ACT I — ENCOUNTER ───────────────────────────────────────

const DWELL = 1600 // identical minimum reading time for every record

function Encounter({ s, set }: Props) {
  const seq = sequences(setById(s.set))[s.seq]
  const done = s.shown > seq.length
  const ready = useDelay(DWELL, [s.shown])
  return (
    <main className="center">
      <Heading>{done ? '기록 끝' : `기록 ${s.shown} / ${seq.length}`}</Heading>
      <div aria-live="polite" className="record">
        {!done && (
          <p key={s.shown} className="sys-lg enter" style={{ margin: 0 }}>{seq[s.shown - 1].text}</p>
        )}
        {done && <p className="sys-lg enter" style={{ margin: 0, color: 'var(--muted)' }}>기록 6개를 모두 읽었습니다.</p>}
      </div>
      <p className="sys sys-dim" style={{ margin: 0 }}>
        {done ? '이제 이 사람에 관한 질문에 답하게 됩니다.'
          : ready ? '준비되면 다음 기록으로 넘어가세요.' : '이 기록이 어떤 사람을 말해 주는지 잠시 떠올려 보세요.'}
      </p>
      <div>
        {done
          ? <button className="btn" onClick={() => set(x => ({ ...x, act: 'judgment' }))}>질문 보기</button>
          : <button className="btn" disabled={!ready} onClick={() => set(x => ({ ...x, shown: x.shown + 1 }))}>
              {s.shown === seq.length ? '읽기 마치기' : '다음 기록'}
            </button>}
      </div>
    </main>
  )
}

// ── ACT II — JUDGMENT ───────────────────────────────────────

function JudgmentAct({ s, set }: Props) {
  const w = setById(s.set)
  return (
    <main className="center enter" style={{ maxWidth: 620 }}>
      <div className="stack" style={{ gap: 4 }}>
        <Heading className="human">이 사람은 {w.anchor}고 합니다.</Heading>
        <p className="human" style={{ margin: 0 }}>이 사람에게 ‘{w.anchor}’는 어떤 뜻일까요?</p>
      </div>
      <JudgmentForm options={w.options} label="이 뜻으로 답하기" onSubmit={j => set(s => recordOriginal(s, j))} />
    </main>
  )
}

// ── transformation: human expression → system archive ───────

function useTyped(full: string, start: boolean) {
  const [n, setN] = useState(0)
  useEffect(() => {
    if (!start) return
    if (reducedMotion()) { setN(full.length); return }
    const t = setInterval(() => setN(k => (k >= full.length ? (clearInterval(t), k) : k + 1)), 32)
    return () => clearInterval(t)
  }, [start, full])
  return [full.slice(0, n), n >= full.length] as const
}

function Archive({ s, set }: Props) {
  // A plain recap before moving on: the six records as read, then the answer they led to.
  const j = s.original!
  const show = useDelay(1400)
  const [typed, stored] = useTyped(j.option === UNSURE ? '이 사람이 어떤지 아직 잘 모르겠다' : `이 사람은 ${j.option}`, show)
  return (
    <main className="center">
      <Heading>이 기록들을 읽고, 이렇게 답했습니다</Heading>
      <ol className="sys archive-list">
        {sequences(setById(s.set))[s.seq].map((r, i) => (
          <li key={r.text}><span className="id">{pad(i + 1)}</span><span>{r.text}</span></li>
        ))}
        {show && (
          <li className="enter mine-entry" aria-live="polite">
            <span className="sys sys-dim">당신의 답</span><span className={stored ? 'human' : 'human caret'}>{typed}</span>
          </li>
        )}
      </ol>
      <div style={{ minHeight: 44 }}>
        {stored && <button className="btn enter" onClick={() => set(x => ({ ...x, act: 'space' }))}>계속하기</button>}
      </div>
    </main>
  )
}

// ── ACT III — REVELATION ────────────────────────────────────

/** Group marker: hollow circle vs filled square, so the framing never relies on colour alone. */
export function Mark({ tone }: { tone: Tone }) {
  return <span className={`mark mark-${tone}`} aria-hidden />
}

/** The participant's own order is revealed record by record on the left; then the reversed order is
 *  filled in from its first slot down, each record crossing over from where it sat on the left. */
const ROW = 40 // px, matches .seq li height in styles.css
const STEP_IN = 450 // one record of the participant's order appears
const T_CROSS = 6 * STEP_IN + 600 // crossing starts
const STEP_CROSS = 650, CROSS_DUR = 1000
const REORDER_MS = T_CROSS + 5 * STEP_CROSS + CROSS_DUR // everything has landed

function SeqColumn({ records, side }: { records: Rec[]; side: 'left' | 'right' }) {
  const mine = side === 'left'
  return (
    <div className={`seq seq-${side}` + (mine ? ' mine' : '')}>
      <h3 className={mine ? '' : 'enter'} style={mine ? undefined : { animationDelay: `${T_CROSS - 300}ms` }}>
        <span className="tag">{mine ? '당신이 받은 순서' : '반대 순서'}</span>
      </h3>
      <ol className="sys">
        {records.map((r, j) => (
          <li key={r.text} className={mine ? 'enter' : 'cross'}
            style={mine ? { animationDelay: `${j * STEP_IN}ms` }
              // right row j holds the participant's record 5-j: start beside it, then cross, top slot first
              : { '--from': `${(5 - 2 * j) * ROW}px`, animationDelay: `${T_CROSS + j * STEP_CROSS}ms` } as React.CSSProperties}>
            <span className="id">{pad(j + 1)}</span><Mark tone={r.tone} /><span>{r.text}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}

function Revelation({ s, set }: Props) {
  const [page, setPage] = useState(0) // 0 reorder · 1 your answer · 2 primacy note — one screen each, so nothing needs scrolling
  const [run, setRun] = useState(0) // bump to replay the reorder
  useEffect(() => { if (page) document.querySelector<HTMLElement>('[data-focus]')?.focus() }, [page])
  const delay = (ms: number) => ({ animationDelay: `${ms + REORDER_MS}ms` })
  // Lines join the same record across the two orders (row i in A ↔ row 5-i in B). Each is an S-curve
  // that leaves its number horizontally, with a gap before the number and round caps.
  // How far a crossing record travels sideways: from the left column's edge to its slot on the right.
  const seqsRef = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const el = seqsRef.current
    if (!el) return
    const measure = () => {
      const [l, r] = el.querySelectorAll('ol')
      el.style.setProperty('--dx', `${r.getBoundingClientRect().left - l.getBoundingClientRect().right}px`)
    }
    measure()
    addEventListener('resize', measure)
    return () => removeEventListener('resize', measure)
  }, [page, run])
  if (page === 1) return (
    <main className="center" style={{ gap: 36 }}>
      <Heading className="human">처음 읽은 기록이 당신의 답에 영향을 주었을까요?</Heading>
      <div className="pin enter stack" style={{ gap: 2 }}>
        <span className="sys sys-dim">당신의 답</span>
        <Said j={s.original!} />
      </div>
      <div className="enter" style={{ animationDelay: '800ms' }}><button className="btn btn-human" onClick={() => setPage(2)}>순서에 관하여</button></div>
    </main>
  )
  if (page === 2) return (
    <main className="center" style={{ gap: 24 }}>
      <Heading className="sr-only">순서에 관하여</Heading>
      <PrimacyNote />
      {/* the note's last line is the ending; what follows arrives after a pause, not as a next step */}
      <Ending s={s}
        restart={() => { clearSession(); set(() => freshSession()) }}
        next={() => set(x => ({ ...freshSession([...x.played, x.set], x.set), act: 'encounter', shown: 1 }))} />
    </main>
  )
  const w = setById(s.set), orders = sequences(w)
  return (
    <main className="center" style={{ gap: 28 }}>
      <Heading>기록이 제시된 순서</Heading>
      <div className="seqs" key={run} ref={seqsRef}>
        <SeqColumn records={orders[s.seq]} side="left" />
        <div aria-hidden />
        <SeqColumn records={orders[s.seq === 'A' ? 'B' : 'A']} side="right" />
      </div>
      <p key={'c' + run} className="sys enter" style={{ margin: '-12px 0 0', animationDelay: `${T_CROSS - 300}ms` }}>
        같은 기록 6개가, 다른 사람에게는 반대 순서로 제시되었습니다.<br />
        <span className="sys-dim"><Mark tone="a" /> 좋게 읽히는 기록 · <Mark tone="b" /> 나쁘게 읽히는 기록</span>
      </p>
      <div className="enter" key={'r' + run} style={{ animationDelay: `${REORDER_MS}ms`, marginTop: -12 }}>
        <button className="btn btn-quiet" onClick={() => setRun(n => n + 1)}>순서 다시 보기</button>
      </div>
      <div className="stack" style={{ gap: 8 }}>
        <p className="refl-lg enter" style={delay(600)}>같은 기록이 순서만 바뀌면,</p>
        <p className="refl-lg enter" style={delay(1900)}>‘{w.anchor}’는 반대쪽으로 끌려갑니다.</p>
      </div>
      <div className="enter" style={delay(3000)}><button className="btn" onClick={() => setPage(1)}>계속하기</button></div>
    </main>
  )
}

// ── ENDING ──────────────────────────────────────────────────

/** The message a reader sends a friend: the title line, what they did, their own reading, an invitation,
 *  then the link on its own line so chat apps build a preview from it. The order they read is left out,
 *  so the reversal still surprises the friend. */
function shareText(anchor: string, option: string, url: string) {
  const mine = option === UNSURE ? `나는 ‘${anchor}’가 무슨 뜻인지 아직 잘 모르겠어요.` : `나는 ‘${anchor}’를 ‘${option}’로 읽었어요.`
  return [`${TITLE} | 같은 기록, 다른 순서`, '', '한 사람에 대한 짧은 기록 6개를 읽고 질문 하나에 답했어요.', mine, '당신은 어떻게 읽을까요? (약 3분)', '', url].join('\n')
}

function Ending({ s, restart, next }: { s: Session; restart: () => void; next: () => void }) {
  const about = useRef<HTMLDialogElement>(null)
  const [status, setStatus] = useState('')
  const share = async () => {
    const url = location.origin + location.pathname // never the ?seq= / ?set= of this visit
    // The link goes inside the text: apps differ in how they join a separate url to the text.
    const text = shareText(setById(s.set).anchor, s.original!.option, url)
    try {
      if (navigator.share) { await navigator.share({ title: TITLE, text }); return }
      await navigator.clipboard.writeText(text)
      setStatus('공유할 문구를 복사했습니다')
    } catch { /* dismissed share sheet, or clipboard blocked */ }
  }
  return (
    <div className="ending row" key="ending">
      <button className="btn btn-line" onClick={next}>다른 단어로 해보기</button>
      <button className="btn btn-quiet" onClick={restart}>처음부터 다시</button>
      <button className="btn btn-quiet" onClick={share}>공유하기</button>
      <button className="btn btn-quiet" onClick={() => about.current?.showModal()}>작품에 관하여</button>
      <span className="sys sys-dim" aria-live="polite">{status}</span>
      <About ref={about} />
    </div>
  )
}

function About({ ref }: { ref: React.Ref<HTMLDialogElement> }) {
  return (
    <dialog ref={ref} className="about" aria-labelledby="about-title" onClick={e => { if (e.target === e.currentTarget) e.currentTarget.close() }}>
      <article className="note">
        <p className="note-eyebrow" id="about-title">작품에 관하여</p>
        <p className="note-lede">{TITLE}</p>
        <p className="note-body">
          한 사람에 대한 같은 기록 여섯 개를, 무작위로 정해지는 두 순서 가운데 하나로 보여줍니다.
          좋게 읽히는 기록이 먼저 오는 순서와, 나쁘게 읽히는 기록이 먼저 오는 순서입니다.
          두 가지로 읽힐 수 있는 말 {SETS.length}개가 준비되어 있고, 할 때마다 아직 해보지 않은 말이 나옵니다.
        </p>
        <p className="note-body">
          끌림 그림에서 두 묶음과 질문의 말이 끌려가는 움직임은 작품의 표현입니다.
          네 답의 좌우 위치만 측정값으로, 한국어 문장 임베딩 모델(jhgan/ko-sroberta-multitask)에서 각 답이 두 묶음의 말과 얼마나 비슷한지를 비교했습니다.
        </p>
        <p className="note-body">답은 이 브라우저에만 저장되고 어디로도 보내지지 않습니다. 처음부터 다시를 누르면 지워집니다.</p>
        <p className="note-foot">
          참고 · Asch, S. E. (1946). Forming impressions of personality. <i>Journal of Abnormal and Social Psychology</i>, 41(3), 258–290.<br />
          글꼴 · IBM Plex Sans KR, IBM Plex Mono (SIL Open Font License 1.1)
        </p>
        <form method="dialog"><button className="btn">닫기</button></form>
      </article>
    </dialog>
  )
}

// Asch (1946): the same six traits, in one order and its reverse. Korean glosses of
// intelligent, industrious, impulsive, critical, stubborn, envious.
const ASCH = ['똑똑한', '근면한', '충동적인', '비판적인', '고집이 센', '질투하는']

function PrimacyNote() {
  return (
    <article className="note enter">
      <p className="note-eyebrow">초두 효과 · primacy effect</p>
      <p className="note-lede">먼저 접한 정보가<br />뒤의 정보보다 인상에 더 크게 남는 경향.</p>
      <figure className="note-figure">
        <figcaption>1946 · 솔로몬 애쉬의 실험</figcaption>
        {[ASCH, [...ASCH].reverse()].map((list, k) => (
          <div key={k} className="note-row">
            <ol>{list.map(w => <li key={w} className={w === '고집이 센' ? 'hit' : ''}>{w}</li>)}</ol>
            <span className="note-result">{k === 0 ? '→ 더 호의적인 인상' : '→ 덜 호의적인 인상'}</span>
          </div>
        ))}
      </figure>
      <p className="note-body">
        장점이 먼저 나온 목록을 읽은 사람들이 대체로 더 호의적인 인상을 이야기했습니다.
        먼저 읽은 단어가 틀이 되어, 뒤의 단어를 그 안에서 읽게 된 것입니다.
      </p>
      <p className="note-foot">
        여러 사람에게서 관찰되는 경향이지, 한 사람의 한 번의 판단을 설명하는 법칙은 아닙니다. 당신의 판단이 순서 때문이었는지는 당신만 알 수 있습니다.
      </p>
    </article>
  )
}
