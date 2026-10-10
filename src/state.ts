// Content, session model and persistence. No network: everything stays in this browser.

export type SeqId = 'A' | 'B'
export type Act = 'intro' | 'encounter' | 'judgment' | 'archive' | 'revelation' | 'space' | 'reflection'

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
  readonly option: string | null
  readonly text: string
  readonly at: string // ISO time
}

export interface Session {
  seq: SeqId
  act: Act
  shown: number // records displayed so far in ACT I
  original: Judgment | null // write-once
  revealed: boolean
  reflectionStep: number
}

const KEY = 'first-impression/v1'

export function freshSession(): Session {
  const forced = new URLSearchParams(location.search).get('seq')?.toUpperCase()
  const seq: SeqId = forced === 'A' || forced === 'B' ? forced : Math.random() < 0.5 ? 'A' : 'B'
  return { seq, act: 'intro', shown: 0, original: null, revealed: false, reflectionStep: 0 }
}

export function loadSession(): Session {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as Session
  } catch { /* private mode / blocked storage: run without persistence */ }
  return freshSession()
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
    case 'revelation': return { ...s, act: 'archive' }
    case 'space': return { ...s, act: 'revelation' }
    case 'reflection': return s.reflectionStep > 0 ? { ...s, reflectionStep: s.reflectionStep - 1 } : { ...s, act: 'space' }
    default: return null // intro, archive
  }
}

export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches
