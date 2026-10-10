// Content, session model and persistence. No network: everything stays in this browser.

export type SeqId = 'A' | 'B'
export type Act = 'intro' | 'encounter' | 'judgment' | 'archive' | 'space' | 'revelation'

// tone is the artwork's own framing, used only after the revelation (overlay + labels).
export const RECORDS = [
  { text: '성실하다', tone: 'a' },
  { text: '책임감 있다', tone: 'a' },
  { text: '배려심 있다', tone: 'a' },
  { text: '남의 말을 듣지 않는다', tone: 'b' },
  { text: '냉정하다', tone: 'b' },
  { text: '무례하다', tone: 'b' },
] as const

export const SEQUENCES: Record<SeqId, readonly (typeof RECORDS)[number][]> = {
  A: RECORDS,
  B: [...RECORDS].reverse(),
}

// Interleaved so the option list itself does not lead with one reading.
export const OPTIONS = ['소신이 있다', '자기 생각만 옳다고 여긴다', '원칙을 지킨다', '타협하지 못한다'] as const
export const UNSURE = '아직 잘 모르겠다' // a valid answer with no coordinate

export interface Judgment {
  readonly option: string
  readonly at: string // ISO time
}

export interface Session {
  seq: SeqId
  act: Act
  shown: number // records displayed so far in ACT I
  original: Judgment | null // write-once
  revealed: boolean
}

const KEY = 'first-impression/v1'

export function freshSession(): Session {
  const forced = new URLSearchParams(location.search).get('seq')?.toUpperCase()
  const seq: SeqId = forced === 'A' || forced === 'B' ? forced : Math.random() < 0.5 ? 'A' : 'B'
  return { seq, act: 'intro', shown: 0, original: null, revealed: false }
}

export function loadSession(): Session {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const s = JSON.parse(raw)
      if (s?.act === 'reflection') s.act = 'revelation' // the former fifth step: resume at the end of the fourth
      delete s?.reflectionStep
      if (valid(s)) return s
    }
  } catch { /* private mode / blocked storage: run without persistence */ }
  return freshSession()
}

const ACTS: readonly Act[] = ['intro', 'encounter', 'judgment', 'archive', 'space', 'revelation']
const AFTER_ANSWER: readonly Act[] = ['archive', 'space', 'revelation']

/** A stored session from an older or damaged save is dropped rather than half-loaded. */
function valid(s: unknown): s is Session {
  const x = s as Session
  return !!x && (x.seq === 'A' || x.seq === 'B') && ACTS.includes(x.act) && Number.isInteger(x.shown)
    && (x.original === null || typeof x.original?.option === 'string')
    && (!AFTER_ANSWER.includes(x.act) || x.original !== null) // the later scenes need the answer
}

export function saveSession(s: Session) {
  try { localStorage.setItem(KEY, JSON.stringify(s)) } catch { /* see above */ }
}

export function clearSession() {
  try { localStorage.removeItem(KEY) } catch { /* see above */ }
}

/** The original judgment can be set once; later writes are ignored. */
export function recordOriginal(s: Session, j: Judgment): Session {
  return s.original ? s : { ...s, original: Object.freeze({ ...j }), act: 'archive' }
}

/** One step back, or null where there is none. Once the original judgment exists there is no way
 *  back to the judgment form (it is write-once), so the scene right after it has no back. */
export function back(s: Session): Session | null {
  switch (s.act) {
    case 'encounter': return s.shown > 1 ? { ...s, shown: Math.min(s.shown, 7) - 1 } : { ...s, act: 'intro' }
    case 'judgment': return { ...s, act: 'encounter', shown: 7 }
    case 'space': return { ...s, act: 'archive' }
    case 'revelation': return { ...s, act: 'space' }
    default: return null // intro, archive
  }
}

export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches
