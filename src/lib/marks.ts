import type { Mark } from './types'
import { TRIP_ID } from './config'
import { firestore } from './fb'

/**
 * Отметки «+/−»: локально (localStorage) и в общей базе Firestore.
 * Не зависит от фреймворка: компоненты подписываются через subscribe() и читают version.
 * Схема в базе совместима с первой версией сайта: trips/<TRIP_ID>/people/<p-имя> = { m, t, name }.
 */
type MarkMap = Record<string, Record<string, Mark>>
export type SyncMode = 'connecting' | 'shared' | 'local' | 'error'

const MKEY = 'thai-trip-marks-v1'
const NKEY = 'thai-trip-name'
const nameId = (n: string) => 'p-' + n.trim().toLowerCase().replace(/[/\s.]+/g, '-').slice(0, 40)
const clone = <T>(o: T): T => JSON.parse(JSON.stringify(o))

interface Remote { set: (id: string, body: object) => Promise<void> }

export class MarksStore {
  version = 0
  marks: MarkMap = {}
  others: Record<string, MarkMap> = {}
  names: Record<string, string> = {}
  myName: string | null = null
  mode: SyncMode = 'connecting'
  error = ''
  private uid: string | null = null
  private all: Record<string, MarkMap> = {}
  private listeners = new Set<() => void>()
  private remote: Remote | null = null
  private firstServer = false
  private dirty = false
  private writing = false
  private pending = false
  private timer: ReturnType<typeof setTimeout> | null = null

  constructor() {
    try { this.marks = JSON.parse(localStorage.getItem(MKEY) || '{}') || {} } catch { this.marks = {} }
    try { this.myName = localStorage.getItem(NKEY) } catch { this.myName = null }
    this.uid = this.myName ? nameId(this.myName) : null
  }

  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn) } }
  getVersion = () => this.version
  private emit() { this.version++; this.listeners.forEach((f) => f()) }

  get needName() { return !this.myName }
  get canWrite() { return this.mode === 'shared' && !!this.uid }

  mine(stop: string, id: number): 0 | 1 | -1 { return (this.marks[stop]?.[id] as Mark | undefined) ?? 0 }
  othersFor(stop: string, id: number): [string, Mark][] {
    const out: [string, Mark][] = []
    for (const [u, m] of Object.entries(this.others)) { const v = m?.[stop]?.[id]; if (v === 1 || v === -1) out.push([u, v]) }
    return out
  }
  anyPlus(stop: string, id: number) { return this.mine(stop, id) === 1 || this.othersFor(stop, id).some((x) => x[1] === 1) }
  nameOf(uid: string) { return (this.names[uid] || '').trim() || 'Участник' }
  counts(stop: string) {
    let p = 0, m = 0
    for (const v of Object.values(this.marks[stop] || {})) { if (v === 1) p++; else if (v === -1) m++ }
    return { p, m }
  }
  othersCounts(stop: string) {
    return Object.entries(this.others).map(([u, mm]) => {
      let p = 0, n = 0
      for (const v of Object.values(mm?.[stop] || {})) { if (v === 1) p++; else if (v === -1) n++ }
      return { uid: u, name: this.nameOf(u), p, m: n }
    }).filter((x) => x.p || x.m)
  }
  /** Имена людей, у которых уже есть отметки, — для кнопок «Я — …». */
  knownNames() {
    const out: string[] = []
    for (const [u, m] of Object.entries(this.all)) {
      if (u === this.uid) continue
      const has = Object.values(m || {}).some((o) => Object.keys(o || {}).length)
      const nm = this.names[u]
      if (has && nm && !out.includes(nm)) out.push(nm)
    }
    return out.sort((a, b) => a.localeCompare(b, 'ru'))
  }

  cycle(stop: string, id: number) {
    const cur = this.mine(stop, id)
    const next = cur === 0 ? 1 : cur === 1 ? -1 : 0
    this.marks[stop] = { ...(this.marks[stop] || {}) }
    if (next) this.marks[stop][id] = next as Mark
    else delete this.marks[stop][id]
    this.save()
  }
  clearStop(stop: string) { delete this.marks[stop]; this.save() }

  setName(n: string) {
    n = n.trim().slice(0, 30)
    if (!n) return
    try { localStorage.setItem(NKEY, n) } catch { /* приватный режим */ }
    this.myName = n
    this.uid = nameId(n)
    this.firstServer = false
    this.others = { ...this.all }
    delete this.others[this.uid]
    this.reconcile(this.all[this.uid] || null, { fromCache: false, hasPendingWrites: false })
    this.emit()
  }

  async init() {
    try {
      const { fs, db } = await firestore()
      const col = fs.collection(db, 'trips', TRIP_ID, 'people')
      this.remote = { set: (id, body) => fs.setDoc(fs.doc(col, id), body) }
      this.mode = 'shared'
      this.emit()
      fs.onSnapshot(col, { includeMetadataChanges: true }, (snap) => {
        const all: Record<string, MarkMap> = {}
        snap.docs.forEach((d) => {
          const body = d.data() as { m?: MarkMap; name?: string }
          all[d.id] = body.m && typeof body.m === 'object' ? body.m : {}
          if (body.name) this.names[d.id] = String(body.name).slice(0, 40)
        })
        this.all = all
        const others = { ...all }
        if (this.uid) delete others[this.uid]
        this.others = others
        this.reconcile(this.uid ? all[this.uid] || null : null, snap.metadata)
        this.emit()
      }, (e) => { this.mode = 'error'; this.error = e.code || String(e); this.emit() })
    } catch (e) {
      this.mode = 'error'
      this.error = (e as { code?: string }).code || 'нет связи'
      this.emit()
    }
  }

  private reconcile(mine: MarkMap | null, meta: { fromCache: boolean; hasPendingWrites: boolean }) {
    if (!this.uid) return
    if (!meta.fromCache && !this.firstServer) {
      this.firstServer = true
      if (mine) { this.marks = clone(mine); this.saveLocal() }
      else if (Object.values(this.marks).some((o) => Object.keys(o || {}).length)) this.queue()
    } else if (this.firstServer && mine && !this.dirty && !meta.hasPendingWrites) {
      this.marks = clone(mine)
      this.saveLocal()
    }
  }
  private saveLocal() { try { localStorage.setItem(MKEY, JSON.stringify(this.marks)) } catch { /* ignore */ } }
  private save() { this.saveLocal(); this.queue(); this.emit() }
  private queue() {
    if (!this.canWrite) return
    this.dirty = true
    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(() => this.flush(), 700)
  }
  private async flush() {
    this.timer = null
    if (!this.remote || !this.uid) return
    if (this.writing) { this.pending = true; return }
    this.writing = true
    try {
      await this.remote.set(this.uid, { m: this.marks, t: Date.now(), name: this.myName })
      if (!this.pending && !this.timer) this.dirty = false
    } catch (e) {
      const code = (e as { code?: string }).code || ''
      if (code === 'permission-denied' || code === 'invalid-argument') { this.mode = 'error'; this.error = code; this.dirty = false; this.emit() }
      else setTimeout(() => this.queue(), 1500 + Math.random() * 1500)
    }
    this.writing = false
    if (this.pending) { this.pending = false; this.flush() }
  }
}

export const marksStore = new MarksStore()
