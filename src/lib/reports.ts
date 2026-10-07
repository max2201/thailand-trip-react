/**
 * Подробные отчёты по отелям, которые человек отметил плюсом.
 *
 * Кнопка кладёт заявку в Firestore: trips/<TRIP_ID>/reports/<id> = { stop, hotels, name, t, status: 'queued' }.
 * Claude по расписанию дежурит у очереди (с 8:00 до 24:00 по UTC+7), читает все отзывы и карточки отелей
 * на trip.com и записывает готовый отчёт в поле r (JSON строкой) со статусом 'ready'.
 * Сайт подписан на заявки текущей остановки и показывает ход работы и готовый отчёт сразу, без перезагрузки.
 * Порядок работы обработчика — REPORTS.md в репозитории thailand-trip-pipeline.
 */
import { TRIP_ID } from './config'
import { firestore } from './fb'

export type RStatus = 'queued' | 'working' | 'ready' | 'error' | 'cancelled'

export interface RQuote { t: string; s: '+' | '-' | '~'; r?: number | null; d?: string | null }
export interface RCat {
  key: string; title: string
  n: number; pos: number; neg: number; mix: number; share: number
  rn?: number; rpos?: number; rneg?: number
  good: string[]; bad: string[]; quotes: RQuote[]
}
export interface RSection { title: string; text?: string; items?: string[] }
export interface RHotel {
  id: number; name: string; stars?: number | null; score?: number | null; sub?: Record<string, string>
  reviews: number; analyzed: number; avg?: number | null; recentAvg?: number | null; recentN?: number; low?: number | null
  period?: string; night?: number | null; km?: number | null; anchor?: boolean; zone?: string | null
  open?: string; renov?: string; url?: string
  verdict: string; fit?: string; unfit?: string; pros: string[]; cons: string[]
  cats: RCat[]; sections: RSection[]
}
export interface RRow { group: string; label: string; cells: string[]; best?: number[] }
export interface Report {
  v: number; made: string; stop: string; title: string; dates: string; by?: string
  summary: string[]; picks: { title: string; text: string }[]
  cols: { id: number; name: string }[]; compare: RRow[]; hotels: RHotel[]
}
export interface ReportDoc {
  id: string; stop: string; hotels: number[]; name: string; t: number
  status: RStatus; prog: string; err: string; done: number | null; raw: string
}

const STATUS_TEXT: Record<RStatus, string> = {
  queued: 'в очереди', working: 'готовится', ready: 'готов', error: 'не получился', cancelled: 'отменён',
}
export const statusText = (s: RStatus) => STATUS_TEXT[s] ?? s
export const isOpen = (d: ReportDoc) => d.status === 'queued' || d.status === 'working'

/** Время в Таиланде (и в Красноярске) — UTC+7. Дежурство — с 8:00 до 24:00. */
export const thaiHour = (t = Date.now()) => new Date(t + 7 * 3600e3).getUTCHours()
export const onDuty = (t = Date.now()) => thaiHour(t) >= 8
export const DUTY_TEXT = 'Claude проверяет заявки каждые 30 секунд с 8:00 до 24:00 (время Таиланда и Красноярска, UTC+7). Отчёт готовится 10–40 минут: окно можно закрыть, он появится здесь сам.'

const MONTHS = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']
/** «7 окт, 14:52» по времени UTC+7. */
export function whenText(t: number) {
  const d = new Date(t + 7 * 3600e3)
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}, ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
}
/** «2026-03-08» → «март 2026». */
export function monthText(d?: string | null) {
  if (!d || d.length < 7) return ''
  const m = +d.slice(5, 7)
  return `${['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'][m - 1] ?? ''} ${d.slice(0, 4)}`
}
export const sameSet = (a: number[], b: number[]) => a.length === b.length && a.every((x) => b.includes(x))

/** Доли хвалят / по-разному / ругают для полоски темы, в процентах от числа упоминаний. */
export function catBar(c: RCat) {
  const n = Math.max(1, c.n)
  return { pos: (100 * c.pos) / n, mix: (100 * c.mix) / n, neg: (100 * c.neg) / n }
}

/** Большой отчёт обработчик сжимает, чтобы влезть в документ Firestore (до 1 МБ): «gz:» + base64 от gzip. */
async function unzip(b64: string) {
  const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
  return new Response(new Blob([bin]).stream().pipeThrough(new DecompressionStream('gzip'))).text()
}
function parseReport(txt: string): Report | null {
  try { const r = JSON.parse(txt) as Report; return r && Array.isArray(r.hotels) ? r : null } catch { return null }
}

function toDoc(id: string, o: Record<string, unknown>): ReportDoc {
  return {
    id, stop: String(o.stop ?? ''), hotels: Array.isArray(o.hotels) ? o.hotels.map(Number) : [], name: String(o.name ?? ''),
    t: Number(o.t) || 0, status: (o.status as RStatus) || 'queued', prog: String(o.prog ?? ''), err: String(o.err ?? ''),
    done: o.done ? Number(o.done) : null, raw: typeof o.r === 'string' ? o.r : '',
  }
}

/** Заявки и отчёты текущей остановки. Не зависит от фреймворка: компоненты подписываются через subscribe(). */
export class ReportsStore {
  version = 0
  stop: string | null = null
  docs: ReportDoc[] = []
  state: 'idle' | 'loading' | 'ok' | 'error' = 'idle'
  error = ''
  private listeners = new Set<() => void>()
  private off: (() => void) | null = null
  private count = 0
  private parsed = new Map<string, Report | null>()
  private unzipping = new Set<string>()

  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn) } }
  getVersion = () => this.version
  private emit() { this.version++; this.listeners.forEach((f) => f()) }

  /** Следить за заявками остановки, пока она открыта. Возвращает функцию «перестать следить». */
  watch(stop: string) {
    if (this.stop !== stop) {
      this.halt()
      this.stop = stop; this.docs = []; this.count = 0; this.state = 'loading'
      this.start(stop)
      this.emit()
    }
    this.count++
    return () => {
      if (this.stop !== stop || --this.count > 0) return
      this.halt(); this.stop = null; this.docs = []; this.state = 'idle'; this.emit()
    }
  }
  private halt() { this.off?.(); this.off = null }
  private async start(stop: string) {
    try {
      const { fs, db } = await firestore()
      if (this.stop !== stop) return
      const q = fs.query(fs.collection(db, 'trips', TRIP_ID, 'reports'), fs.where('stop', '==', stop))
      this.off = fs.onSnapshot(q, (snap) => {
        if (this.stop !== stop) return
        this.docs = snap.docs.map((d) => toDoc(d.id, d.data())).filter((d) => d.status !== 'cancelled').sort((a, b) => b.t - a.t)
        this.state = 'ok'; this.error = ''
        this.emit()
      }, (e) => { this.state = 'error'; this.error = e.code || String(e); this.emit() })
    } catch (e) {
      this.state = 'error'; this.error = (e as { code?: string }).code || 'нет связи'; this.emit()
    }
  }

  /** Готовый отчёт из заявки (разбираем один раз; сжатый — распаковываем в фоне и сообщаем подписчикам). */
  report(d: ReportDoc): Report | null {
    if (d.status !== 'ready' || !d.raw) return null
    const key = d.id + ':' + (d.done ?? '')
    if (this.parsed.has(key)) return this.parsed.get(key) ?? null
    if (d.raw.startsWith('gz:')) {
      if (!this.unzipping.has(key)) {
        this.unzipping.add(key)
        unzip(d.raw.slice(3)).then(parseReport, () => null).then((r) => { this.parsed.set(key, r); this.unzipping.delete(key); this.emit() })
      }
      return null
    }
    this.parsed.set(key, parseReport(d.raw))
    return this.parsed.get(key) ?? null
  }

  /** Последняя заявка этого человека на такой же набор отелей — чтобы не заказывать то же самое дважды. */
  findSame(hotels: number[], name: string) {
    return this.docs.find((d) => d.name === name && sameSet(d.hotels, hotels) && d.status !== 'error') ?? null
  }

  async request(stop: string, hotels: number[], name: string) {
    const { fs, db } = await firestore()
    const ref = await fs.addDoc(fs.collection(db, 'trips', TRIP_ID, 'reports'), {
      stop, hotels, name: name.trim().slice(0, 30), t: Date.now(), status: 'queued',
    })
    return ref.id
  }

  async cancel(id: string) {
    const { fs, db } = await firestore()
    await fs.updateDoc(fs.doc(db, 'trips', TRIP_ID, 'reports', id), { status: 'cancelled', prog: '' })
  }

  /** Для автотестов: подставить заявки без базы. */
  setForTest(stop: string, docs: Partial<ReportDoc>[]) {
    this.halt(); this.stop = stop; this.count = Math.max(this.count, 1); this.state = 'ok'
    this.docs = docs.map((d, i) => ({ ...toDoc(d.id ?? 'test' + i, {}), ...d }) as ReportDoc)
    this.emit()
  }
}

export const reportsStore = new ReportsStore()
if (typeof window !== 'undefined') (window as unknown as { __ttReports: ReportsStore }).__ttReports = reportsStore

/** Чьи-то сообщения об ошибке базы — человеческим языком. */
export function errorText(code: string) {
  if (code === 'permission-denied') return 'База пока не принимает заявки на отчёты (правила Firestore ещё не обновлены).'
  if (code === 'unavailable' || code === 'нет связи') return 'Нет связи с общей базой. Если вы в России, попробуйте через VPN.'
  return 'Не получилось связаться с базой: ' + code
}
