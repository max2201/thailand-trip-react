/**
 * Размер карты над таблицей. Пользователь тянет за уголок (мышью или пальцем),
 * размер запоминается в localStorage этого браузера.
 * w = null — карта во всю ширину (подстраивается под окно).
 */
export interface MapSize { w: number | null; h: number }

const KEY = 'thai-trip-map-size'
export const MIN_W = 260
export const MIN_H = 160
const STEP = 24
const maxH = () => Math.round(window.innerHeight * 0.8)

export const defaultMapSize = (): MapSize => ({ w: null, h: window.matchMedia('(max-width: 760px)').matches ? 220 : 320 })

export function loadMapSize(): MapSize | null {
  try {
    const o = JSON.parse(localStorage.getItem(KEY) || 'null')
    if (o && typeof o.h === 'number') return { w: typeof o.w === 'number' ? o.w : null, h: o.h }
  } catch { /* ignore */ }
  return null
}

export function saveMapSize(s: MapSize | null) {
  try {
    if (s) localStorage.setItem(KEY, JSON.stringify(s))
    else localStorage.removeItem(KEY)
  } catch { /* ignore */ }
}

/** Ограничиваем размер: не уже MIN_W, не шире контейнера, по высоте — до 80% окна. Почти вся ширина = вся ширина. */
export function clampMapSize(w: number, h: number, maxW: number): MapSize {
  const cw = Math.min(maxW, Math.max(MIN_W, w))
  return { w: cw >= maxW - 6 ? null : Math.round(cw), h: Math.round(Math.min(maxH(), Math.max(MIN_H, h))) }
}

/** Применить размер к блоку карты. */
export function sizeStyle(s: MapSize) {
  return { width: s.w == null ? '100%' : s.w + 'px', height: s.h + 'px' }
}

/**
 * Тянем за уголок. Pointer events одинаково работают с мышью, пальцем и пером.
 * handle — сам уголок (на нём ловим указатель), box — блок карты.
 * onMove вызывается на каждом движении, onEnd — когда отпустили.
 */
export function startResize(e: PointerEvent, handle: HTMLElement, box: HTMLElement, onMove: (s: MapSize) => void, onEnd: (s: MapSize) => void) {
  if (e.button !== 0) return
  e.preventDefault()
  handle.setPointerCapture(e.pointerId)
  const r = box.getBoundingClientRect()
  const maxW = box.parentElement?.clientWidth ?? r.width
  const x0 = e.clientX, y0 = e.clientY
  let cur = clampMapSize(r.width, r.height, maxW)
  const move = (ev: PointerEvent) => {
    cur = clampMapSize(r.width + ev.clientX - x0, r.height + ev.clientY - y0, maxW)
    onMove(cur)
  }
  const up = () => {
    handle.removeEventListener('pointermove', move)
    handle.removeEventListener('pointerup', up)
    handle.removeEventListener('pointercancel', up)
    document.body.classList.remove('resizing')
    onEnd(cur)
  }
  document.body.classList.add('resizing')
  handle.addEventListener('pointermove', move)
  handle.addEventListener('pointerup', up)
  handle.addEventListener('pointercancel', up)
}

/** Стрелки на уголке: ←/→ — ширина, ↑/↓ — высота. Возвращает новый размер или null, если клавиша не наша. */
export function keyResize(e: KeyboardEvent, box: HTMLElement): MapSize | null {
  const d: Record<string, [number, number]> = { ArrowLeft: [-STEP, 0], ArrowRight: [STEP, 0], ArrowUp: [0, -STEP], ArrowDown: [0, STEP] }
  const v = d[e.key]
  if (!v) return null
  e.preventDefault()
  const r = box.getBoundingClientRect()
  return clampMapSize(r.width + v[0], r.height + v[1], box.parentElement?.clientWidth ?? r.width)
}
