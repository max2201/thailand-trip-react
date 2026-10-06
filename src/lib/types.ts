export type CityId = 'bkk' | 'cm' | 'cr' | 'pt'
export type Level = '' | 'fw' | 'fb'
export type Mark = 1 | -1

/** Отель: статичные данные, посчитанные пайплайном по всем отзывам. */
export interface Hotel {
  id: number
  nm: string            // название
  cat: string           // тип на trip.com
  st: number            // звёзды
  z: string             // район
  la: number | null
  ln: number | null
  sc: number | null     // оценка trip.com
  cl: number | null     // чистота
  fa: number | null     // удобства
  lo: number | null     // расположение
  se: number | null     // сервис
  rv: number            // отзывов на trip.com
  an: number            // прочитано отзывов
  tot: number
  ng: number | null     // % негатива
  ns: number | null     // % жалоб на шум
  ro: number; ror: number   // тараканы/клопы (всего, за 2025–26)
  at: number                // муравьи/комары
  sm: number; smr: number   // запах
  dm: number; dmr: number   // сырость
  ins: number; insr: number // насекомые всего
  am: string[]; amn: number // удобства
  yr: string
  pr: string[]; co: string[] // плюсы / минусы
  cp: [number, number, number, number, number] | null // база, флаги, негатив, динамика, мало отзывов
  sv?: number           // в сохранённых на trip.com
  fx?: string[]         // чем известен
  rf?: string[]         // осторожно
  lc?: string           // где
  bal?: number          // упоминаний балкона
}

/**
 * Отметки trip.com в выдаче (собирает пайплайн): m — значок партнёра (3 или 4), a — [место, рейтинг, где],
 * n — «Работает с 2026», «Отремонтирован в 2025»…, ad — реклама, p — акции, d — скидка в %, r — выводы trip.com из отзывов.
 */
export interface TcMarks { m?: number; a?: [number, string, string]; n?: string[]; ad?: 1; p?: string[]; d?: number; r?: string[] }

/** [ночь, всего, бесплатная отмена, номер, койка, общий санузел, без окна, отметки trip.com (0 — нет)] */
export type PriceTuple = [number | null, number | null, 0 | 1, string, 0 | 1, 0 | 1, 0 | 1, (TcMarks | 0)?]
export type Prices = Record<string, PriceTuple>

export type EventTuple = [date: string, title: string, place: string, status: string, note: string]

export interface Stop {
  id: string; city: CityId; title: string; sub: string
  ci: string; co: string; nights: number; days: string; together: boolean
  anchor: number; anchorName: string; proposed: number; proposedName: string
  prio: string[]; note: string; events: EventTuple[]
  alat: number; alng: number; limit: number; priceCount: number
}

export interface District { z: string[]; t: string; tag: string; what: string; pro: string; con: string; who: string }
export interface Guide {
  name: string; intro: string; districts: District[]
  sights: [name: string, district: string, text: string][]
  trips: [name: string, time: string, text: string, tip: string][]
}

export interface TripIndex {
  stops: Stop[]
  guides: Record<CityId, Guide>
  tripwide: [date: string, title: string, place: string, status: string][]
  cities: Record<CityId, { meds: number; count: number }>
  builtAt: string
  reviews: number
}

export interface Parts { base: number; fl: number; neg: number; tr: number; sm: number; prox: number; value: number }

/** Отель в контексте конкретной остановки: цена на её даты, расстояние, моя оценка. */
export interface Row extends Hotel {
  tg: string
  night: number | null; total: number | null; free: boolean; room: string
  dorm: boolean; shared: boolean; nowin: boolean
  km: number | null; anchor: boolean; proposed: boolean
  balRoom: boolean; balRev: boolean; balcony: boolean
  my: number | null; parts: Parts | null; gem: boolean
  flagRate: number | null; insLvl: Level; smLvl: Level; dmLvl: Level; clean: boolean
  rank: number
  tc: TcMarks | null
}

export interface StopRows { rows: Row[]; medp: number; p35: number }
