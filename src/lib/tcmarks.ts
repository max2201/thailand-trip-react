/**
 * Отметки самого trip.com, которые он ставит отелям в выдаче (их собирает пайплайн, см. tripcom.marks):
 * значок партнёра, место в тематическом рейтинге, «новый / после ремонта», реклама, акции и скидки,
 * короткие выводы trip.com из отзывов. Здесь — подписи, проверка «есть ли отметка» для фильтра и вес для сортировки.
 */
import type { TcMarks } from './types'
import { dec } from './format'

export type TcKey = 'partner' | 'award' | 'new' | 'promo' | 'ad'

/** Группы для фильтра: ключ, подпись, пояснение. */
export const TC_LABELS: [TcKey, string, string][] = [
  ['partner', 'Значок партнёра', 'Trip.com отмечает объекты, с которыми сотрудничает: «высокая репутация» или «отличная репутация»'],
  ['award', 'В рейтинге trip.com', 'Место в тематическом рейтинге trip.com: «Высококлассные», «Местный колорит», «Отличный вид»…'],
  ['new', 'Новый или после ремонта', '«Работает с 2025», «Отремонтирован в 2026», «Новое на Trip.com»'],
  ['promo', 'Скидка или акция', 'Скидка от обычной цены, спецпредложение, ограниченная акция, цена для зарегистрированных'],
  ['ad', 'Реклама', 'Отель оплатил место в выдаче trip.com'],
]

const MEDAL: Record<number, [string, string]> = {
  3: ['партнёр · высокая репутация', 'Trip.com тесно сотрудничает с объектами с высокой репутацией, которые дают выгодные предложения'],
  4: ['партнёр · отличная репутация', 'Trip.com сотрудничает с объектами с отличной репутацией: высокое качество услуг и выгодные предложения'],
}
export const medalText = (m: number) => (MEDAL[m] ?? ['партнёр trip.com', 'Значок партнёра trip.com'])[0]
export const medalTitle = (m: number) => (MEDAL[m] ?? ['', 'Значок партнёра trip.com'])[1]

export const awardText = (a: [number, string, string]) => `№ ${a[0]} в «${a[1]}»`
export const awardTitle = (a: [number, string, string]) => `№ ${a[0]} в рейтинге trip.com «${a[1]}»${a[2] ? ` (${a[2]})` : ''}`

/** «−28 %, спецпредложение» */
export function promoText(tc: TcMarks) {
  return [...(tc.d ? [`−${dec(tc.d)} %`] : []), ...(tc.p ?? []).map((p) => p.charAt(0).toLowerCase() + p.slice(1))].join(', ')
}

/** «Хорошее расположение, понравилось» */
export const reviewText = (tc: TcMarks) => (tc.r ?? []).map((x, i) => (i ? x.charAt(0).toLowerCase() + x.slice(1) : x)).join(', ')

export function tcHas(tc: TcMarks | null, k: TcKey) {
  if (!tc) return false
  switch (k) {
    case 'partner': return !!tc.m
    case 'award': return !!tc.a
    case 'new': return !!tc.n?.length
    case 'promo': return !!(tc.p?.length || tc.d)
    case 'ad': return !!tc.ad
  }
}

/** Вес для сортировки: рейтинг (чем выше место, тем больше) → значок партнёра → «новый» → акции. */
export function tcScore(tc: TcMarks | null) {
  if (!tc) return 0
  return (tc.a ? 4 + (20 - Math.min(20, tc.a[0])) / 20 : 0) + (tc.m ? 2 : 0) + (tc.n?.length ? 1 : 0) + (tc.p?.length || tc.d ? 0.3 : 0)
}
