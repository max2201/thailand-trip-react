/**
 * Легенда карты как пульт: каждый пункт включает/выключает свою группу точек.
 * Меняет только то, что видно на карте, — выборку в таблице задают фильтры.
 * Состояние (что выключено и радиус круга) запоминается в localStorage этого браузера.
 */
import type { Row } from './types'
import { dec, dec1, fmt } from './format'

export type LegendKey = 'g9' | 'g8' | 'glow' | 'gnone' | 'plus' | 'minus' | 'nomark' | 'anchor' | 'ring'
/** off — выключенные группы, r — радиус круга (м), all — показывать отметки всех участников, а не только мои. */
export interface LegendState { off: LegendKey[]; r: number; all: boolean }

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
      const r = Math.round(Number(o.r) / 10) * 10
      return { off: o.off.filter((k: LegendKey) => ALL.includes(k)), r: r >= R_MIN && r <= R_MAX ? r : R_DEF, all: !!o.all }
    }
  } catch { /* ignore */ }
  return { off: [], r: R_DEF, all: false }
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
 * Отметка для карты. Режим «только мои» — моя отметка. Режим «все» — моя, а если её нет,
 * то чужая: плюс, если кто-то поставил плюс, иначе минус, если кто-то поставил минус.
 */
export function shownMark(mine: number, others: [string, number][], all: boolean): number {
  if (mine || !all) return mine
  return others.some((x) => x[1] === 1) ? 1 : others.some((x) => x[1] === -1) ? -1 : 0
}

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

export const radiusText = (m: number) => (m < 1000 ? `${m} м` : `${dec((m / 1000).toFixed(m % 100 ? 2 : 1))} км`)

/**
 * Радиус из текста: «1,5», «1.5 км», «800», «800 м». Без единиц: до 10 — километры, больше — метры.
 * Округляем до 10 м и держим в пределах 100 м — 5 км. Непонятный текст — null.
 */
export function parseRadius(text: string): number | null {
  const m = text.trim().toLowerCase().replace(',', '.').replace(/\s+/g, '').match(/^(\d+(?:\.\d+)?|\.\d+)(км|km|к|k|м|m)?$/)
  if (!m) return null
  const v = parseFloat(m[1]), u = m[2]
  const meters = u === 'м' || u === 'm' || (!u && v > 10) ? v : v * 1000
  return Math.min(R_MAX, Math.max(R_MIN, Math.round(meters / 10) * 10))
}

/**
 * Общее состояние легенды: карта его меняет, а флажок «Только в радиусе» в фильтрах читает радиус.
 * Не зависит от фреймворка — как и хранилище отметок, компоненты подписываются через subscribe().
 */
class LegendStore {
  private state: LegendState = loadLegend()
  private listeners = new Set<() => void>()
  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn) } }
  get = () => this.state
  set = (s: LegendState) => { this.state = s; saveLegend(s); this.listeners.forEach((f) => f()) }
}
export const legendStore = new LegendStore()

/** Значок отмеченного отеля: кружок цвета оценки с «+» или «−» внутри. Чужая отметка — с пунктирной обводкой. */
export function pinHtml(mark: number, fill: string, selected: boolean, foreign = false) {
  return `<span class="mpin ${mark === 1 ? 'mp-plus' : 'mp-minus'}${foreign ? ' mp-oth' : ''}${selected ? ' sel' : ''}" style="background:${fill}">${mark === 1 ? '+' : '−'}</span>`
}

const esc = (s: string) => s.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch] as string)

const NEXT: Record<number, string> = { 0: 'поставить «+»', 1: 'поменять на «−»', [-1]: 'снять отметку' }

/**
 * Подсказка над точкой: оценка, расстояние, цена и чьи отметки.
 * У выбранной точки — что сделает следующий клик (клик по выбранной точке переключает мою отметку).
 */
export function tooltipHtml(r: Row, mark: number, others: [string, number][], selected = false) {
  let s = `<b>${esc(r.nm)}</b>: ${r.my == null ? 'нет оценки' : dec1(r.my)}`
  if (r.km != null && !r.anchor) s += `, ${dec(r.km.toFixed(1))} км`
  if (r.night) s += `, ${fmt(r.night)} ₽`
  const marks = [...(mark ? [['ваш', mark] as [string, number]] : []), ...others]
  if (marks.length) s += '<br>' + marks.map(([n, v]) => `${esc(n)} ${v === 1 ? '+' : '−'}`).join(', ')
  if (selected) s += `<br><small style="color:#5D6977">ещё клик по точке — ${NEXT[mark] ?? NEXT[0]}</small>`
  return s
}
