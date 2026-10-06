/**
 * Легенда карты как пульт: каждый пункт включает/выключает свою группу точек.
 * Меняет только то, что видно на карте, — выборку в таблице задают фильтры.
 * Состояние (что выключено и радиус круга) запоминается в localStorage этого браузера.
 */
import type { Row } from './types'
import { dec, dec1, fmt } from './format'

export type LegendKey = 'g9' | 'g8' | 'glow' | 'gnone' | 'plus' | 'minus' | 'nomark' | 'anchor' | 'ring'
export interface LegendState { off: LegendKey[]; r: number }

/** Группы по оценке: ключ, подпись, CSS-переменная цвета. */
export const LEGEND_SCORE: [LegendKey, string, string][] = [
  ['g9', '9+', '--good'], ['g8', '8–8,9', '--warn'], ['glow', 'ниже 8', '--bad'], ['gnone', 'нет оценки', '--muted'],
]
/** Группы по моим отметкам: ключ, подпись, отметка. */
export const LEGEND_MARK: [LegendKey, string, 0 | 1 | -1][] = [['plus', 'плюсы', 1], ['minus', 'минусы', -1], ['nomark', 'без отметки', 0]]

export const R_MIN = 100
export const R_MAX = 5000
export const R_STEP = 100
const R_DEF = 1000
const KEY = 'thai-trip-map-legend'
const ALL: LegendKey[] = ['g9', 'g8', 'glow', 'gnone', 'plus', 'minus', 'nomark', 'anchor', 'ring']

export function loadLegend(): LegendState {
  try {
    const o = JSON.parse(localStorage.getItem(KEY) || 'null')
    if (o && Array.isArray(o.off)) {
      const r = Math.round(Number(o.r) / R_STEP) * R_STEP
      return { off: o.off.filter((k: LegendKey) => ALL.includes(k)), r: r >= R_MIN && r <= R_MAX ? r : R_DEF }
    }
  } catch { /* ignore */ }
  return { off: [], r: R_DEF }
}
export function saveLegend(s: LegendState) {
  try { localStorage.setItem(KEY, JSON.stringify(s)) } catch { /* ignore */ }
}
export function toggleKey(s: LegendState, k: LegendKey): LegendState {
  return { ...s, off: s.off.includes(k) ? s.off.filter((x) => x !== k) : [...s.off, k] }
}

export const scoreKey = (my: number | null): LegendKey => (my == null ? 'gnone' : my >= 9 ? 'g9' : my >= 8 ? 'g8' : 'glow')
export const markKey = (m: number): LegendKey => (m === 1 ? 'plus' : m === -1 ? 'minus' : 'nomark')

/**
 * Показывать ли отель на карте. visible — отели, прошедшие фильтры таблицы.
 * Выбранный в таблице отель показываем всегда, «наш» — по своему пункту легенды.
 */
export function shownOnMap(r: Row, mark: number, visible: Set<number>, off: LegendKey[], selected: number | null) {
  if (r.id === selected) return true
  if (r.anchor) return !off.includes('anchor')
  if (!visible.has(r.id)) return false
  return !off.includes(scoreKey(r.my)) && !off.includes(markKey(mark))
}

/** Сколько отелей из выборки таблицы попадает в каждую группу (без «нашего»). */
export function legendCounts(rows: Row[], visible: Set<number>, mark: (id: number) => number) {
  const c: Partial<Record<LegendKey, number>> = {}
  for (const r of rows) {
    if (r.anchor || !visible.has(r.id)) continue
    const a = scoreKey(r.my), b = markKey(mark(r.id))
    c[a] = (c[a] ?? 0) + 1
    c[b] = (c[b] ?? 0) + 1
  }
  return c
}

export const radiusText = (m: number) => (m < 1000 ? `${m} м` : `${dec((m / 1000).toFixed(1))} км`)

/** Значок отмеченного отеля: кружок цвета оценки с «+» или «−» внутри. */
export function pinHtml(mark: number, fill: string, selected: boolean) {
  return `<span class="mpin ${mark === 1 ? 'mp-plus' : 'mp-minus'}${selected ? ' sel' : ''}" style="background:${fill}">${mark === 1 ? '+' : '−'}</span>`
}

const esc = (s: string) => s.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch] as string)

/** Подсказка над точкой: оценка, расстояние, цена и чьи отметки. */
export function tooltipHtml(r: Row, mark: number, others: [string, number][]) {
  let s = `<b>${esc(r.nm)}</b>: ${r.my == null ? 'нет оценки' : dec1(r.my)}`
  if (r.km != null && !r.anchor) s += `, ${dec(r.km.toFixed(1))} км`
  if (r.night) s += `, ${fmt(r.night)} ₽`
  const marks = [...(mark ? [['ваш', mark] as [string, number]] : []), ...others]
  if (marks.length) s += '<br>' + marks.map(([n, v]) => `${esc(n)} ${v === 1 ? '+' : '−'}`).join(', ')
  return s
}
