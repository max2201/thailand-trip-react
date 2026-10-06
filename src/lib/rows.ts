import type { Hotel, Level, Prices, Row, Stop, StopRows } from './types'
import { clamp, hav, kmText, plural, dec } from './format'

export const TYPES: [string, string[]][] = [
  ['Отели', ['Отель', 'Мотель', 'Парк-отель', 'Отель для свиданий']],
  ['Мини-отели и бутики', ['Небольшая гостиница', 'Отель типа «постель и завтрак»', 'Самобытный объект размещения', 'Рёкан']],
  ['Курорты', ['Курортный отель', 'Лодж', 'Шале', 'Кемпинг', 'Фермерский дом', 'Деревенский дом']],
  ['Гестхаусы', ['Гостевой дом', 'Проживание в семье']],
  ['Апартаменты', ['Квартира', 'Сервисные апартаменты', 'Дом для отпуска', 'Вилла', 'Каюта']],
  ['Хостелы и капсулы', ['Хостел', 'Капсульный отель']],
]
const TYPE_OF: Record<string, string> = {}
TYPES.forEach(([g, list]) => list.forEach((c) => (TYPE_OF[c] = g)))
export const typeGroup = (c: string) => TYPE_OF[c] || 'Другое'
export const TYPE_ORDER = [...TYPES.map((t) => t[0]), 'Другое']

export const AMENITY: Record<string, string> = {
  pool: 'бассейн', gym: 'фитнес', food: 'ресторан/кафе', bar: 'бар', laundry: 'прачечная', lift: 'лифт',
  parking: 'парковка', transfer: 'трансфер', kitchen: 'кухня', spa: 'спа/массаж', work: 'рабочая зона',
}

export function level(count: number, n: number): Level {
  if (!count) return ''
  const r = (count / Math.max(1, n)) * 100
  return r < 1 ? '' : r < 2.5 ? 'fw' : 'fb'
}

const BAL = /балкон|balcon/i
const NO_BAL = /без\s+балкон|no\s+balcon|without\s+balcon/i

/** Строки таблицы для остановки: цена на её даты, расстояние до «нашего» отеля, моя оценка. */
export function buildRows(stop: Stop, hotels: Hotel[], prices: Prices): StopRows {
  const byId = new Map(hotels.map((h) => [h.id, h]))
  const nights = Object.values(prices).map((p) => p[0]).filter((v): v is number => !!v).sort((a, b) => a - b)
  const medp = nights[Math.floor(nights.length / 2)] || 3000
  const p35 = nights[Math.floor(nights.length * 0.35)] || 2500
  const out: Row[] = []
  for (const [id, p] of Object.entries(prices)) {
    const h = byId.get(+id)
    if (!h) continue
    const km = h.la && stop.alat ? hav(stop.alat, stop.alng, h.la, h.ln as number) : null
    const room = p[3] || ''
    const r = {
      ...h, tg: typeGroup(h.cat), night: p[0], total: p[1], free: !!p[2], room,
      dorm: !!p[4], shared: !!p[5], nowin: !!p[6], tc: p[7] || null, km,
      anchor: +id === stop.anchor, proposed: +id === stop.proposed,
    } as Row
    r.balRoom = BAL.test(room) && !NO_BAL.test(room)
    r.balRev = (h.bal || 0) >= 2 || ((h.bal || 0) >= 1 && h.an < 20)
    r.balcony = r.balRoom || r.balRev
    if (h.cp) {
      const [base, fl, neg, tr, sm] = h.cp
      const prox = km == null ? 0 : clamp(0.5 - 0.25 * km, -0.5, 0.4)
      const value = r.night && !r.dorm ? clamp((medp - r.night) / (medp * 0.8), -0.4, 0.4) : 0
      r.my = Math.round(clamp(base + fl + neg + tr + sm + prox + value, 0, 10) * 10) / 10
      r.parts = { base, fl, neg, tr, sm, prox: Math.round(prox * 100) / 100, value: Math.round(value * 100) / 100 }
    } else {
      r.my = null
      r.parts = null
    }
    r.gem = !!(r.my && r.my >= 9.2 && h.an >= 30 && !r.dorm && !r.shared && r.night && r.night <= p35)
    r.flagRate = h.an ? ((h.ro * 3 + h.at + h.sm + h.dm) / h.an) * 100 : null
    const rl = !h.ro ? 0 : h.ro <= 2 && h.ro / h.an < 0.005 ? 1 : 2
    const al = { '': 0, fw: 1, fb: 2 }[level(h.at, h.an)]
    r.insLvl = (['', 'fw', 'fb'] as Level[])[Math.max(rl, al)]
    r.smLvl = level(h.sm, h.an)
    r.dmLvl = level(h.dm, h.an)
    r.clean = h.an >= 5 && h.ins === 0 && ((h.sm + h.dm) / h.an) * 100 < 1.5
    out.push(r)
  }
  out.sort((a, b) => (b.my ?? -1) - (a.my ?? -1))
  out.forEach((r, i) => (r.rank = i + 1))
  return { rows: out, medp, p35 }
}

/** Сколько ехать до «нашего» отеля. */
export function travel(km: number | null, stop: Stop, r: { ln: number | null }) {
  if (km == null) return ''
  const island = stop.city === 'pt' && stop.alng < 100.83
  if (km <= 1.2) return `≈${Math.max(1, Math.round(km * 16))} мин пешком`
  if (island && (r.ln ?? 0) < 100.83) return `≈${Math.round((km * 1.4) / 20 * 60 + 2)} мин на мопеде`
  if (island) return 'другой берег: паром или катер'
  if (stop.city === 'bkk') return `≈${Math.round((km * 1.4) / 14 * 60 + 4)} мин на такси`
  if (stop.city === 'pt') return `≈${Math.round((km * 1.3) / 20 * 60 + 3)} мин на такси или сонгтэо`
  return `≈${Math.round((km * 1.3) / 22 * 60 + 3)} мин на Grab`
}

export interface Brief { known: string[]; warn: string[]; reputation: 'ok' | 'few' | null; where: string; anchorLine: string }

/** «Коротко об отеле»: чем известен, осторожно, где. */
export function brief(r: Row, stop: Stop): Brief {
  const warn = [...(r.rf || [])]
  const n = (c: number) => `${c} ${plural(c, 'отзыв', 'отзыва', 'отзывов')}`
  if (r.insLvl === 'fb') warn.unshift(`часто пишут о насекомых — ${n(r.ins)}`)
  if (r.smLvl === 'fb') warn.unshift(`часто пишут о запахе — ${n(r.sm)}`)
  if (r.dmLvl === 'fb') warn.unshift(`часто пишут о сырости — ${n(r.dm)}`)
  const together = stop.anchor === stop.proposed
  const anchorLine = r.km == null ? '' : r.km < 0.05
    ? `Это и есть ${together ? 'ваш отель по плану' : '«наш отель»'}.`
    : `До ${together ? 'вашего отеля по плану' : '«нашего отеля»'}: ${kmText(r.km)}, ${travel(r.km, stop, r)}.`
  return {
    known: r.fx || [],
    warn: warn.slice(0, 4),
    reputation: warn.length ? null : r.an >= 30 ? 'ok' : 'few',
    where: r.lc || '—',
    anchorLine,
  }
}

export function partsTitle(r: Row) {
  const p = r.parts
  if (!p) return 'Слишком мало отзывов для оценки'
  const sg = (x: number) => (x >= 0 ? '+' : '') + dec(x)
  return `Основа ${dec(p.base.toFixed(1))}; флаги ${dec(p.fl)}; близость ${sg(p.prox)}; цена ${sg(p.value)}; негатив ${sg(p.neg)}; динамика ${sg(p.tr)}${p.sm ? '; мало отзывов ' + dec(p.sm) : ''}`
}

export function zoneStats(rows: Row[], zones: string[]) {
  const list = rows.filter((r) => zones.includes(r.z) && !r.dorm)
  const rated = list.filter((r) => r.an >= 5)
  const prices = list.map((r) => r.night).filter((v): v is number => !!v).sort((a, b) => a - b)
  return {
    n: list.length,
    med: prices.length ? prices[Math.floor((prices.length - 1) / 2)] : null,
    clean: rated.length ? Math.round((rated.filter((r) => r.clean).length / rated.length) * 100) : null,
    gems: list.filter((r) => r.gem).length,
  }
}
export function cityCleanShare(rows: Row[]) {
  const rated = rows.filter((r) => !r.dorm && r.an >= 5)
  return Math.round((rated.filter((r) => r.clean).length / Math.max(1, rated.length)) * 100)
}

export interface Badge { text: string; cls: 'plan' | 'gem' | 'saved' | 'warn' | 'bal'; title?: string }

/** Метки под названием отеля. */
export function badges(r: Row, stop: Stop): Badge[] {
  const out: Badge[] = []
  const together = stop.anchor === stop.proposed
  if (r.anchor) out.push({ text: together ? 'отель по плану' : '«наш отель»', cls: 'plan' })
  else if (r.proposed) out.push({ text: 'предложен вам', cls: 'plan' })
  if (r.gem) out.push({ text: 'находка', cls: 'gem' })
  if (r.sv) out.push({ text: 'в сохранённых', cls: 'saved' })
  if (r.balRoom) out.push({ text: 'балкон в этом номере', cls: 'bal', title: 'Балкон упомянут в названии самого дешёвого номера на ваши даты' })
  else if (r.balRev) out.push({ text: 'есть номера с балконом', cls: 'bal', title: `О балконе пишут в ${r.bal} ${plural(r.bal || 0, 'отзыве', 'отзывах', 'отзывах')}` })
  if (r.dorm) out.push({ text: 'койка в общем номере', cls: 'warn' })
  else if (r.shared) out.push({ text: 'общий санузел', cls: 'warn' })
  if (r.nowin) out.push({ text: 'без окна', cls: 'warn' })
  if (r.night && r.night > (stop.limit || 5000)) out.push({ text: `дороже ${(stop.limit || 5000).toLocaleString('ru-RU')} ₽`, cls: 'warn' })
  return out
}

/** Минусы из отзывов + предупреждение про самый дешёвый номер. */
export function consList(r: Row) {
  const c = [...r.co]
  if (r.dorm) c.unshift('Цена — за место в общем номере или капсулу')
  else if (r.shared) c.unshift('В самом дешёвом номере общий санузел')
  return c
}

export const tripLink = (id: number, stop: Stop) =>
  `https://ru.trip.com/hotels/detail/?hotelId=${id}&checkIn=${stop.ci}&checkOut=${stop.co}&adult=2&crn=1&curr=RUB&locale=ru-RU`
