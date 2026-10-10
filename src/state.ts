// Session model and persistence. No network: everything stays in this browser.
import setsData from './data/sets.json' with { type: 'json' }

export const UNSURE = '아직 잘 모르겠다' // a valid answer with no coordinate

export type SeqId = 'A' | 'B'
export type Act = 'intro' | 'encounter' | 'judgment' | 'archive' | 'space' | 'revelation'
export type Tone = 'a' | 'b'

/** One word set: a phrase that reads two ways, six records (three per reading), four answers
 *  (two per reading, interleaved so the list never leads with one) and the diagram's two groups.
 *  The groups and tones are the artwork's framing; only the similarities in semantic.json are measured. */
export interface WordSet {
  id: string
  anchor: string
  records: Record<Tone, string[]>
  options: string[]
  groups: Record<Tone, string[]>
}
export type Rec = { text: string; tone: Tone }

export const SETS = setsData as WordSet[]
export const setById = (id: string) => SETS.find(w => w.id === id)!

/** Order A puts the 'a' (good-sounding) records first; B is the same six reversed. */
export function sequences(w: WordSet): Record<SeqId, Rec[]> {
  const A: Rec[] = [...w.records.a.map(text => ({ text, tone: 'a' as const })), ...w.records.b.map(text => ({ text, tone: 'b' as const }))]
  return { A, B: [...A].reverse() }
}

export interface Judgment {
  readonly option: string
  readonly at: string // ISO time
}

export interface Session {
  set: string // WordSet id
  played: string[] // sets finished in this browser, so 다른 단어로 해보기 offers a new one
  seq: SeqId
  act: Act
  shown: number // records displayed so far in ACT I
  original: Judgment | null // write-once
  revealed: boolean
}

const KEY = 'first-impression/v1'

const pick = <T,>(xs: readonly T[]) => xs[Math.floor(Math.random() * xs.length)]

/** A new run: a random order, and a random set not played yet (all sets again once every one has
 *  been played, never the one just finished). ?seq=A|B and ?set=<id> force them, for testing. */
export function freshSession(played: string[] = [], last?: string): Session {
  const q = new URLSearchParams(location.search)
  const forcedSeq = q.get('seq')?.toUpperCase()
  const seq: SeqId = forcedSeq === 'A' || forcedSeq === 'B' ? forcedSeq : pick(['A', 'B'] as const)
  const unplayed = SETS.filter(w => !played.includes(w.id) && w.id !== last)
  const pool = unplayed.length ? unplayed : SETS.filter(w => w.id !== last)
  const forcedSet = q.get('set')
  const set = forcedSet && SETS.some(w => w.id === forcedSet) ? forcedSet : pick(pool).id
  return { set, played: unplayed.length ? played : [], seq, act: 'intro', shown: 0, original: null, revealed: false }
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
    && SETS.some(w => w.id === x.set) && Array.isArray(x.played)
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
