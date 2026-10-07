import type { Row, Stop } from './types'
import { TC_LABELS, tcHas, tcScore, type TcKey } from './tcmarks'
import { flatArea, inArea, unflatArea, type Area } from './lasso'

export type FlagKey =
  | 'noinsect' | 'nosmell' | 'nodorm' | 'ownbath' | 'balcony' | 'balroom' | 'free' | 'gem'
  | 'plusonly' | 'anyplus' | 'hideminus' | 'saved' | 'inradius'
export type RangeKey = 'pmin' | 'pmax' | 'mmin' | 'mmax' | 'tmin' | 'tmax' | 'kmax' | 'rmin'
export type SortKey =
  | 'mark' | 'rank' | 'name' | 'my' | 'night' | 'free' | 'km' | 'brief' | 'pr' | 'co' | 'flag'
  | 'sc' | 'tcm' | 'cl' | 'fa' | 'lo' | 'se' | 'amn' | 'st' | 'yr' | 'ry' | 'ng' | 'ns'

export interface Filters {
  q: string
  zones: string[]
  types: string[]
  tcm: TcKey[]          // отметки trip.com: показывать отели, у которых есть хотя бы одна из выбранных
  flags: FlagKey[]
  ranges: Partial<Record<RangeKey, number>>
  area: Area | null     // область, обведённая лассо на карте
  sort: SortKey
  dir: 1 | -1
}

export const FLAG_LABELS: [FlagKey, string][] = [
  ['noinsect', 'Без насекомых'], ['nosmell', 'Без запаха и сырости'], ['nodorm', 'Скрыть койки'],
  ['ownbath', 'Свой санузел'], ['balcony', 'С балконом'], ['balroom', 'Балкон в самом дешёвом номере'],
  ['free', 'Бесплатная отмена'], ['gem', 'Только находки'], ['inradius', 'Только в радиусе'], ['plusonly', 'Только с моим плюсом'],
  ['anyplus', 'Плюс у кого-то из нас'], ['hideminus', 'Скрыть с минусом'], ['saved', 'Мои сохранённые на trip.com'],
]
export const ASC_FIRST: SortKey[] = ['mark', 'km', 'night', 'rank', 'name', 'free', 'ng', 'ns', 'flag']

export const defaultFilters = (stop: Stop): Filters => ({
  q: '', zones: [...stop.prio], types: [], tcm: [], flags: ['nodorm'], ranges: {}, area: null, sort: 'my', dir: -1,
})

export interface MarkView {
  mine: (id: number) => 0 | 1 | -1
  anyPlus: (id: number) => boolean
}

const inRange = (v: number | null, lo?: number, hi?: number) =>
  !((lo != null && (v == null || v < lo)) || (hi != null && (v == null || v > hi)))

/** radiusM — радиус круга на карте (в метрах): его использует флажок «Только в радиусе». */
export function passes(r: Row, f: Filters, marks: MarkView, radiusM?: number) {
  if (f.q && !r.nm.toLowerCase().includes(f.q.toLowerCase())) return false
  // Обведённая на карте область — строгий фильтр, даже для отелей из плана
  if (f.area && f.area.length >= 3 && (r.la == null || r.ln == null || !inArea(r.la, r.ln, f.area))) return false
  const plan = r.anchor || r.proposed
  if (f.zones.length && !f.zones.includes(r.z) && !plan) return false
  if (plan) return true
  const R = f.ranges
  if (!inRange(r.night, R.pmin, R.pmax) || !inRange(r.my, R.mmin, R.mmax) || !inRange(r.sc, R.tmin, R.tmax)) return false
  if (R.kmax != null && (r.km == null || r.km > R.kmax)) return false
  if (radiusM != null && f.flags.includes('inradius') && (r.km == null || r.km * 1000 > radiusM)) return false
  if (R.rmin != null && r.an < R.rmin) return false
  const has = (k: FlagKey) => f.flags.includes(k)
  if (has('noinsect') && (r.ins > 0 || !r.an)) return false
  if (has('nosmell') && (!r.an || ((r.sm + r.dm) / r.an) * 100 >= 1.5)) return false
  if (has('nodorm') && r.dorm) return false
  if (has('ownbath') && (r.shared || r.dorm)) return false
  if (has('free') && !r.free) return false
  if (has('gem') && !r.gem) return false
  if (f.types.length && !f.types.includes(r.tg)) return false
  if (f.tcm?.length && !f.tcm.some((k) => tcHas(r.tc, k))) return false
  if (has('saved') && !r.sv) return false
  if (has('balcony') && !r.balcony) return false
  if (has('balroom') && !r.balRoom) return false
  const m = marks.mine(r.id)
  if (has('plusonly') && m !== 1) return false
  if (has('anyplus') && !marks.anyPlus(r.id)) return false
  if (has('hideminus') && m === -1) return false
  return true
}

export function sortValue(r: Row, k: SortKey, marks: MarkView): number | string | null {
  switch (k) {
    case 'mark': { const m = marks.mine(r.id); return m === 1 ? 0 : m === -1 ? 3 : marks.anyPlus(r.id) ? 1 : 2 }
    case 'name': return r.nm.toLowerCase()
    case 'free': return r.free ? 0 : 1
    case 'brief': return (r.fx || []).length - 2 * (r.rf || []).length
    case 'pr': return r.pr.length
    case 'co': return r.co.length
    case 'flag': return r.flagRate
    case 'tcm': return tcScore(r.tc)
    case 'yr': return r.yr ? +r.yr : null
    case 'ry': return r.ry ? +r.ry : null
    default: return (r as unknown as Record<string, number | null>)[k] ?? null
  }
}

export function applyFilters(rows: Row[], f: Filters, marks: MarkView, radiusM?: number) {
  // «Наш» отель идёт в общем списке и сортируется как все (проходит любые фильтры, кроме поиска по названию).
  const list = rows.filter((r) => passes(r, f, marks, radiusM))
  list.sort((a, b) => {
    const x = sortValue(a, f.sort, marks), y = sortValue(b, f.sort, marks)
    if (x == null && y == null) return 0
    if (x == null) return 1
    if (y == null) return -1
    return (x > y ? 1 : x < y ? -1 : 0) * f.dir || (b.my ?? -1) - (a.my ?? -1)
  })
  return list
}

/** Фильтры ↔ строка запроса, чтобы ссылкой можно было поделиться. */
export function encodeFilters(f: Filters, stop: Stop): string {
  const d = defaultFilters(stop)
  const o: Record<string, unknown> = {}
  if (f.q) o.q = f.q
  if (f.zones.join('|') !== d.zones.join('|')) o.z = f.zones
  if (f.types.length) o.t = f.types
  if (f.tcm.length) o.c = f.tcm
  if (f.flags.join(',') !== d.flags.join(',')) o.f = f.flags
  if (Object.keys(f.ranges).length) o.r = f.ranges
  if (f.area?.length) o.a = flatArea(f.area)
  if (f.sort !== d.sort || f.dir !== d.dir) o.s = [f.sort, f.dir]
  return Object.keys(o).length ? JSON.stringify(o) : ''
}
export function decodeFilters(raw: string | null | undefined, stop: Stop): Filters {
  const f = defaultFilters(stop)
  if (!raw) return f
  try {
    const o = JSON.parse(raw)
    if (typeof o.q === 'string') f.q = o.q
    if (Array.isArray(o.z)) f.zones = o.z
    if (Array.isArray(o.t)) f.types = o.t
    if (Array.isArray(o.c)) f.tcm = o.c.filter((k: TcKey) => TC_LABELS.some(([x]) => x === k))
    if (Array.isArray(o.f)) f.flags = o.f.filter((k: FlagKey) => FLAG_LABELS.some(([x]) => x === k))
    if (o.r && typeof o.r === 'object') f.ranges = o.r
    f.area = unflatArea(o.a)
    if (Array.isArray(o.s)) { f.sort = o.s[0]; f.dir = o.s[1] === 1 ? 1 : -1 }
  } catch { /* битая ссылка — просто фильтры по умолчанию */ }
  return f
}
