import { useEffect, useRef, useState, type FormEvent } from 'react'
import {
  SEQUENCES, OPTIONS, UNSURE, RECORDS, loadSession, saveSession, clearSession, freshSession,
  recordOriginal, reducedMotion, back, type Session, type Judgment, type SeqId,
} from './state'
import SemanticSpace from './SemanticSpace'

export type Props = { s: Session; set: (f: (s: Session) => Session) => void }

const ACT_LABEL: Record<Session['act'], string> = {
  intro: '', encounter: 'I', judgment: 'II', archive: 'II', revelation: 'III', space: 'IV', reflection: 'V',
}

export default function App() {
  const [s, setS] = useState(loadSession)
  useEffect(() => saveSession(s), [s])
  // Move focus to each act's heading so keyboard and screen-reader users land in the new scene.
  useEffect(() => { document.querySelector<HTMLElement>('[data-focus]')?.focus() }, [s.act])

  const Scene = { intro: Intro, encounter: Encounter, judgment: JudgmentAct, archive: Archive, revelation: Revelation, space: SemanticSpace, reflection: Reflection }[s.act]
  return (
    <div className="stage">
      <header className="bar">
        <span className="row" style={{ gap: 16 }}>
          {back(s) && <button className="back" onClick={() => setS(x => back(x) ?? x)}>이전</button>}
          {s.act !== 'reflection' && <span className="id">PERSON_001</span>}
        </span>
        {s.act !== 'reflection' && <span className="id">{ACT_LABEL[s.act] && `ACT ${ACT_LABEL[s.act]}`}</span>}
      </header>
      <Scene s={s} set={setS} />
    </div>
  )
}

// ── shared bits ─────────────────────────────────────────────

export function Heading({ children, className = 'label' }: { children: React.ReactNode; className?: string }) {
  return <h1 data-focus tabIndex={-1} className={className} style={{ margin: 0, fontWeight: 'normal' }}>{children}</h1>
}

/** Latin-only text gets the Latin human face; anything with Hangul stays in one Korean face. */
export const latin = (text: string) => (/[\u1100-\u11ff\u3130-\u318f\uac00-\ud7a3]/.test(text) ? '' : ' latin')

/** The participant's own words, in the human voice. Never paraphrased. */
export function Said({ j, big }: { j: Judgment; big?: boolean }) {
  return (
    <div className="stack">
      {j.option && <p className={(big ? 'human-quote' : 'human') + ' said' + latin(j.option)} style={{ margin: 0 }}>{j.option}</p>}
      {j.text && <p className={(big ? 'human-quote' : 'human') + ' said' + latin(j.text)} style={{ margin: 0 }}>{j.text}</p>}
    </div>
  )
}

/** The interpretation choices plus an optional free-text answer. */
function JudgmentForm({ onSubmit, label }: { onSubmit: (j: Judgment) => void; label: string }) {
  const [option, setOption] = useState<string | null>(null)
  const [text, setText] = useState('')
  const ok = option !== null || text.trim() !== ''
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (ok) onSubmit({ option, text: text.trim(), at: new Date().toISOString() })
  }
  return (
    <form onSubmit={submit} className="stack" style={{ gap: 28 }}>
      <fieldset className="choices">
        <legend className="sr-only">해석을 고르십시오</legend>
        {[...OPTIONS, UNSURE].map(o => (
          <label key={o} className="choice human">
            <input type="radio" name="interp" value={o} checked={option === o} onChange={() => setOption(o)} />
            <span className={o === UNSURE ? 'unsure' : ''}>{o}</span>
          </label>
        ))}
      </fieldset>
      <label className="stack" style={{ gap: 6 }}>
        <span className="human">당신의 말로 이 사람을 설명해 주세요. <span className="sys sys-dim">(선택)</span></span>
        <textarea className={'human' + (text ? latin(text) : '')} value={text} onChange={e => setText(e.target.value)} maxLength={400} placeholder="…" />
      </label>
      <div><button className="btn" disabled={!ok}>{label}</button></div>
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
      <p className="label" style={{ margin: 0 }}>The first impression</p>
      <Heading className="title">PERSON_001</Heading>
      <p className="sys" style={{ margin: 0, fontSize: 17, color: 'var(--ink)' }}>
        한 사람에 관한 기록 6건이 하나씩 제시됩니다.<br />기록을 읽은 뒤, 질문에 답하게 됩니다.
      </p>
      <div><button className="btn" onClick={() => set(s => ({ ...s, act: 'encounter', shown: 1 }))}>Begin</button></div>
      <p className="sys sys-dim" style={{ margin: 0 }}>
        응답은 이 브라우저에만 저장되며 어디로도 전송되지 않습니다.
      </p>
    </main>
  )
}

// ── ACT I — ENCOUNTER ───────────────────────────────────────

const DWELL = 1600 // identical minimum reading time for every record

function Encounter({ s, set }: Props) {
  const seq = SEQUENCES[s.seq]
  const done = s.shown > seq.length
  const ready = useDelay(DWELL, [s.shown])
  return (
    <main className="center">
      <Heading>{done ? 'Sequence complete' : `Record ${s.shown} of ${seq.length}`}</Heading>
      <div aria-live="polite" className="record">
        {!done && (
          <p key={s.shown} className="sys-lg enter" style={{ margin: 0 }}>{seq[s.shown - 1].text}</p>
        )}
        {done && <p className="sys-lg enter" style={{ margin: 0, color: 'var(--muted)' }}>6 records displayed.</p>}
      </div>
      <div>
        {done
          ? <button className="btn" onClick={() => set(x => ({ ...x, act: 'judgment' }))}>Proceed</button>
          : <button className="btn" disabled={!ready} onClick={() => set(x => ({ ...x, shown: x.shown + 1 }))}>
              {s.shown === seq.length ? 'End of records' : 'Next record'}
            </button>}
      </div>
    </main>
  )
}

// ── ACT II — JUDGMENT ───────────────────────────────────────

function JudgmentAct({ set }: Props) {
  return (
    <main className="center enter" style={{ maxWidth: 620 }}>
      <div className="stack" style={{ gap: 4 }}>
        <Heading className="human">이 사람은 고집이 세다고 합니다.</Heading>
        <p className="human" style={{ margin: 0 }}>당신은 이 표현을 어떻게 이해합니까?</p>
      </div>
      <JudgmentForm label="Record judgment" onSubmit={j => set(s => recordOriginal(s, j))} />
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
  const j = s.original!
  const show = useDelay(1800)
  const value = [j.option && `SELECTED: "${j.option}"`, j.text && `TEXT: "${j.text}"`].filter(Boolean).join('\n')
  const [typed, stored] = useTyped(value, show)
  return (
    <main className="center">
      <Heading>Judgment recorded.</Heading>
      <Said j={j} big />
      {show && (
        <section className="archive enter" aria-label="system archive">
          <div className="id" style={{ color: 'var(--ink)' }}>SYSTEM ARCHIVE</div>
          <dl className="data">
            <dt>SUBJECT</dt><dd>PERSON_001</dd>
            <dt>ENTRY</dt><dd>JUDGMENT_001</dd>
            <dt>RECORDED</dt><dd>{j.at.replace('T', ' ').slice(0, 19)} UTC</dd>
            <dt>VALUE</dt>
            <dd className="value" style={{ whiteSpace: 'pre-wrap' }} aria-hidden={!stored}>
              <span className={stored ? '' : 'caret'}>{typed}</span>
            </dd>
            <dt>CONTENT</dt><dd>{stored ? 'VERBATIM' : '-'}</dd>
            <dt>STATUS</dt><dd aria-live="polite">{stored ? 'STORED' : 'WRITING'}</dd>
          </dl>
        </section>
      )}
      <div style={{ minHeight: 44 }}>
        {stored && <button className="btn enter" onClick={() => set(x => ({ ...x, act: 'revelation', revealed: true }))}>Continue</button>}
      </div>
    </main>
  )
}

// ── ACT III — REVELATION ────────────────────────────────────

/** Group marker: hollow circle vs filled square, so the framing never relies on colour alone. */
export function Mark({ tone }: { tone: 'a' | 'b' }) {
  return <span className={`mark mark-${tone}`} aria-hidden />
}

/** The order the participant did not receive first appears in their order, then each record
 *  travels to its own slot, so the reversal is seen happening rather than inferred. */
const REORDER_MS = 3600
const ROW = 40 // px, matches .seq li height in styles.css

export function SeqColumn({ id, mine, side }: { id: SeqId; mine: boolean; side: 'left' | 'right' }) {
  return (
    <div className={`seq seq-${side}` + (mine ? ' mine' : '')}>
      <h3><span className="id">SEQUENCE_{id}</span>{mine && <span className="tag">You received</span>}</h3>
      <ol className="sys">
        {SEQUENCES[id].map((r, i) => (
          <li key={r.text} className={mine ? '' : 'travel'}
            style={mine ? undefined : { '--from': `${(5 - 2 * i) * ROW}px`, animationDelay: `${i * 140}ms` } as React.CSSProperties}>
            <span className="id">{pad(i + 1)}</span><Mark tone={r.tone} /><span>{r.text}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}

function Revelation({ s, set }: Props) {
  const [explained, setExplained] = useState(false)
  const [run, setRun] = useState(0) // bump to replay the reorder
  const delay = (ms: number) => ({ animationDelay: `${ms + REORDER_MS}ms` })
  // Lines join the same record across the two orders (row i in A ↔ row 5-i in B). Each is an S-curve
  // that leaves its number horizontally, with a gap before the number and round caps.
  const header = 54 // h3 height 44px + list margin 10px (styles.css .seq)
  return (
    <main className="center" style={{ gap: 36 }}>
      <Heading>Presentation order: two sequences, six records each</Heading>
      <div className="seqs enter" key={run}>
        <SeqColumn id="A" side="left" mine={s.seq === 'A'} />
        <svg aria-hidden viewBox={`0 0 10 ${header + 6 * ROW}`} preserveAspectRatio="none" style={{ height: header + 6 * ROW }}>
          {RECORDS.map((r, i) => (
            <path key={i} className="fade-in" style={{ animationDelay: `${REORDER_MS}ms` }}
              d={`M 1.2 ${header + ROW / 2 + i * ROW} C 4.6 ${header + ROW / 2 + i * ROW}, 5.4 ${header + ROW / 2 + (5 - i) * ROW}, 8.8 ${header + ROW / 2 + (5 - i) * ROW}`}
              fill="none" stroke={`var(--tone-${r.tone})`} strokeOpacity={.75} strokeWidth={1.25} strokeLinecap="round"
              vectorEffect="non-scaling-stroke" />
          ))}
        </svg>
        <SeqColumn id="B" side="right" mine={s.seq === 'B'} />
      </div>
      <div className="enter" key={'r' + run} style={{ animationDelay: `${REORDER_MS}ms`, marginTop: -20 }}>
        <button className="btn btn-quiet" onClick={() => setRun(n => n + 1)}>순서 다시 보기</button>
      </div>
      <p className="sys sys-dim enter" style={{ ...delay(0), margin: 0 }}>
        <Mark tone="a" /> <Mark tone="b" /> 표시는 이 작품이 정한 구분입니다. 두 순서 중 어느 쪽도 기준이 아닙니다.
      </p>
      <div className="stack" style={{ gap: 8 }}>
        <p className="refl-lg enter" style={delay(600)}>당신이 읽은 정보는 같았습니다.</p>
        <p className="refl-lg enter" style={delay(1900)}>달라진 것은 순서뿐입니다.</p>
      </div>
      <p className="human enter" style={{ ...delay(3300), margin: 0 }}>당신이 먼저 읽은 정보는 이후의 해석에 어떤 영향을 주었을까요?</p>
      <div className="pin enter stack" style={{ ...delay(3300), gap: 2 }}>
        <span className="row" style={{ gap: 10 }}><span className="id">JUDGMENT_001</span><span className="sys sys-dim">처음의 응답</span></span>
        <Said j={s.original!} />
      </div>
      {!explained
        ? <div className="enter" style={delay(4100)}><button className="btn btn-human" onClick={() => setExplained(true)}>순서에 관하여</button></div>
        : <PrimacyNote />}
      {explained && <div><button className="btn" onClick={() => set(x => ({ ...x, act: 'space' }))}>말들 사이의 거리 보기</button></div>}
    </main>
  )
}

function PrimacyNote() {
  return (
    <div className="refl enter">
      <p>먼저 접한 정보가 뒤에 오는 정보보다 인상에 더 오래, 더 크게 남는 경향을 <b>초두 효과(primacy effect)</b>라고 부릅니다.</p>
      <p>1946년 심리학자 솔로몬 애쉬는 한 사람을 묘사하는 같은 형용사 목록을 순서만 바꾸어 보여주었습니다. 장점이 먼저 나온 목록을 읽은 사람들은 대체로 더 호의적인 인상을 이야기했습니다. 그 목록에는 ‘고집이 센’이라는 단어도 있었습니다. 먼저 읽은 단어가 일종의 틀이 되어, 뒤에 오는 단어를 그 틀 안에서 읽게 될 수 있다는 것입니다.</p>
      <p>다만 이것은 여러 사람에게서 관찰되는 경향이지, 한 사람의 한 번의 판단을 설명하는 법칙이 아닙니다. 당신의 판단이 순서 때문이었는지, 이 화면은 알지 못합니다.</p>
    </div>
  )
}

// ── ACT V — REFLECTION ──────────────────────────────────────

const QUESTIONS = [
  '당신은 언제 이 사람에 대한 판단을 내렸습니까?',
  '나중에 읽은 정보는 처음의 판단을 바꾸었습니까?',
  '다른 순서로 만났다면 같은 판단을 내렸을까요?',
  '당신의 생각은 어디에서 시작되었습니까?',
]

function Reflection({ s, set }: Props) {
  const step = s.reflectionStep
  const last = step === QUESTIONS.length
  const restart = () => { clearSession(); set(() => ({ ...freshSession(), act: 'intro' })) }
  return (
    <main className="center" style={{ gap: 40, maxWidth: 720 }}>
      {step === 0 && (
        <div className="stack fade-step" style={{ gap: 36 }}>
          <Heading className="sr-only">돌아보기</Heading>
          <div className="stack" style={{ gap: 6 }}>
            <span className="sys sys-dim">처음의 판단</span>
            <Said j={s.original!} big />
          </div>
        </div>
      )}
      {step > 0 && (
        <p key={step} data-focus tabIndex={-1} className="human-quote fade-step" style={{ margin: 0 }} aria-live="polite">
          {QUESTIONS[step - 1]}
        </p>
      )}
      <div style={{ minHeight: 44 }}>
        {!last && <button className="btn btn-human" onClick={() => set(x => ({ ...x, reflectionStep: x.reflectionStep + 1 }))}>계속하기</button>}
        {last && <button className="btn btn-quiet restart" onClick={restart}>Restart</button>}
      </div>
    </main>
  )
}
